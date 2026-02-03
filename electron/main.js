const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV !== 'production' || process.env.DEBUG_PROD === 'true';
const Store = require('electron-store');
const store = new Store();

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    app.quit();
}

// Function to manage library
function getLibrary() {
    return store.get('library', []);
}

function saveToLibrary(novelData) {
    const library = getLibrary();
    const index = library.findIndex(n => n.url === novelData.url);

    // Create new entry or merge with existing
    const newEntry = {
        ...novelData,
        lastUpdated: new Date().toISOString(),
        downloads: index !== -1 ? library[index].downloads : {} // Preserve downloads
    };

    if (index !== -1) {
        library[index] = newEntry;
    } else {
        library.push(newEntry);
    }

    store.set('library', library);
    return newEntry;
}

function updateDownloadStatus(url, chapterNum, path) {
    const library = getLibrary();
    const index = library.findIndex(n => n.url === url);
    if (index !== -1) {
        if (!library[index].downloads) library[index].downloads = {};
        library[index].downloads[chapterNum] = {
            path: path,
            date: new Date().toISOString()
        };
        store.set('library', library);
    }
}

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200, // Wider for sidebar
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
        },
        titleBarStyle: 'hiddenInset',
        show: false,
        backgroundColor: '#0f172a', // Darker slate
        vibrancy: 'fullscreen-ui', // Mac blur effect
    });

    const startUrl = process.env.ELECTRON_START_URL || 'http://localhost:5173';

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });
}

app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

const NocraScraper = require('./scraper');

let mScraper = null;

function getScraper() {
    if (!mScraper && mainWindow) {
        mScraper = new NocraScraper(mainWindow);
    }
    return mScraper;
}

// --- IPC Handlers ---

ipcMain.on('get-library', (event) => {
    event.reply('library-data', getLibrary());
});

ipcMain.on('get-plugins', (event) => {
    console.log("Main: Received get-plugins request");
    const pluginManager = require('./plugin-system/manager');
    const plugins = pluginManager.getAllPlugins();
    console.log(`Main: Sending ${plugins.length} plugins back to renderer`);
    event.reply('plugins-list', plugins);
});

ipcMain.on('search-novels', async (event, { query, pluginId }) => {
    const scraper = getScraper();
    try {
        const novels = await scraper.searchNovels(pluginId, query, 1);
        event.reply('search-results', novels.map(n => {
            // If it's a plugin result, n.path might be relative
            // If it's a legacy result, it might already be absolute or relative
            let url = n.path;
            if (url && !url.startsWith('http')) {
                const pluginManager = require('./plugin-system/manager');
                const plugin = pluginManager.getPluginById(pluginId)?.instance;
                if (plugin) {
                    url = plugin.site + n.path.replace(/^\//, '');
                }
            }
            return { ...n, url };
        }));
    } catch (e) {
        event.reply('error', e.message);
    }
});

ipcMain.on('popular-novels', async (event, { pluginId, page = 1 }) => {
    const scraper = getScraper();
    try {
        const novels = await scraper.popularNovels(pluginId, page);
        event.reply('popular-results', novels.map(n => {
            let url = n.path;
            if (url && !url.startsWith('http')) {
                const pluginManager = require('./plugin-system/manager');
                const plugin = pluginManager.getPluginById(pluginId)?.instance;
                if (plugin) {
                    url = plugin.site + n.path.replace(/^\//, '');
                }
            }
            return { ...n, url };
        }));
    } catch (e) {
        event.reply('error', e.message);
    }
});

ipcMain.on('remove-novel', (event, url) => {
    let library = getLibrary();
    library = library.filter(n => n.url !== url);
    store.set('library', library);
    event.reply('library-data', library);
});

// Add Novel: Fetch info -> Cache -> Return data
ipcMain.on('add-novel', async (event, url) => {
    const scraper = getScraper();
    if (!scraper) return;

    try {
        event.reply('log-update', `Fetching novel info from ${url}...`);
        const result = await scraper.fetchChapterList(url);

        if (!result || !result.chapters) {
            event.reply('error', 'Failed to fetch chapters.');
            return;
        }

        const novelData = {
            url: url,
            title: result.contentTitle,
            cover: result.metadata?.cover,
            provider: result.siteInfo.site,
            chapters: result.chapters,
            metadata: result.metadata || {}
        };

        const savedEntry = saveToLibrary(novelData);
        event.reply('operation-success', { type: 'add-novel', data: savedEntry });
        event.reply('library-data', getLibrary());
        event.reply('log-update', 'Novel added and cached successfully.');
    } catch (e) {
        event.reply('error', e.message);
    }
});

// Refresh Novel: Re-fetch -> Update Cache
ipcMain.on('refresh-novel', async (event, url) => {
    const scraper = getScraper();
    if (!scraper) return;

    try {
        event.reply('log-update', `Refreshing ${url}...`);
        const result = await scraper.fetchChapterList(url);

        if (result && result.chapters) {
            const novelData = {
                url: url,
                title: result.contentTitle,
                provider: result.siteInfo.site,
                chapters: result.chapters,
                metadata: result.metadata || {}
            };
            const savedEntry = saveToLibrary(novelData);
            event.reply('operation-success', { type: 'refresh-novel', data: savedEntry });
            event.reply('library-data', getLibrary());
            event.reply('log-update', 'Novel refreshed.');
        }
    } catch (e) {
        event.reply('error', `Refresh failed: ${e.message}`);
    }
});

// Download Logic
ipcMain.on('start-download', async (event, { url, chapters, saveDir }) => {
    const scraper = getScraper();
    if (!scraper) return;

    let targetDir = saveDir;
    if (!targetDir) {
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: 'Select Base Download Folder',
            properties: ['openDirectory']
        });
        if (canceled) return;
        targetDir = filePaths[0];
    }

    event.reply('log-update', 'Starting download...');

    const siteInfo = scraper.identifySite(url);
    const library = getLibrary();
    const novel = library.find(n => n.url === url);
    const contentTitle = novel ? novel.title : "Unknown Title";

    for (const chapter of chapters) {
        if (scraper.stopFlag) break;
        try {
            await scraper.downloadChapter(chapter, targetDir, siteInfo, contentTitle);

            const safeTitle = contentTitle.replace(/[\/\\:*?"<>|]/g, "");
            const chapterPath = path.join(targetDir, safeTitle);

            updateDownloadStatus(url, chapter.num, chapterPath);
            event.reply('chapter-status-update', { url, chapterNum: chapter.num });

            event.reply('download-progress', {
                current: chapter.num,
                message: `Downloaded ${chapter.title}`
            });

        } catch (e) {
            console.error(e);
            event.reply('error', `Error downloading ${chapter.num}: ${e.message}`);
        }
    }
    event.reply('download-complete', true);
    event.reply('library-data', getLibrary());
});

ipcMain.on('stop-download', () => {
    const scraper = getScraper();
    if (scraper) scraper.stop();
});

// Reader: Read content
ipcMain.on('read-chapter', async (event, { novelUrl, chapterNum }) => {
    const library = getLibrary();
    const novel = library.find(n => n.url === novelUrl);

    if (!novel || !novel.downloads || !novel.downloads[chapterNum]) {
        event.reply('error', 'Chapter not downloaded.');
        return;
    }

    const { path: savePath } = novel.downloads[chapterNum];

    try {
        const fs = require('fs');
        const fileList = fs.readdirSync(savePath);

        const textFile = fileList.find(f => f === `Chapter ${chapterNum}.txt`);
        if (textFile) {
            const content = fs.readFileSync(path.join(savePath, textFile), 'utf-8');
            event.reply('chapter-content', { type: 'text', content, chapterNum });
            return;
        }

        const htmlFile = fileList.find(f => f === `Chapter ${chapterNum}.html`);
        if (htmlFile) {
            const content = fs.readFileSync(path.join(savePath, htmlFile), 'utf-8');
            event.reply('chapter-content', { type: 'html', content, chapterNum });
            return;
        }

        const images = fileList
            .filter(f => f.startsWith(`Chapter ${chapterNum} - image_`))
            .sort()
            .map(f => `file://${path.join(savePath, f)}`);

        if (images.length > 0) {
            event.reply('chapter-content', { type: 'image', images, chapterNum });
            return;
        }

        event.reply('error', 'Content file not found.');
    } catch (e) {
        event.reply('error', `Read error: ${e.message}`);
    }
});
