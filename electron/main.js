// 1. Define web globals BEFORE any other modules are loaded
(function preinit() {
    const { Blob } = require('buffer');
    if (typeof global.Blob === 'undefined') global.Blob = Blob;
    
    if (typeof global.File === 'undefined') {
        global.File = class File extends global.Blob {
            constructor(parts, filename, options = {}) {
                super(parts, options);
                this.name = filename;
                this.lastModified = options.lastModified || Date.now();
            }
        };
    }

    // Ensure fetch globals are available (Electron 28 has them, but polyfill for robustness)
    if (typeof global.fetch === 'undefined') {
        const undici = require('undici');
        global.fetch = undici.fetch;
        global.FormData = undici.FormData;
        global.Headers = undici.Headers;
        global.Request = undici.Request;
        global.Response = undici.Response;
    }
})();

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = process.env.NODE_ENV !== 'production' || process.env.DEBUG_PROD === 'true';
const Store = require('electron-store');
const store = new Store();
const axios = require('axios');
const nodepub = require('nodepub');
const cheerio = require('cheerio');
const { jsPDF } = require('jspdf');

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
        width: 1200, 
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
        },
        titleBarStyle: 'hiddenInset',
        show: false,
        backgroundColor: '#0f172a',
        vibrancy: 'fullscreen-ui',
    });

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
    const pluginManager = require('./plugin-system/manager');
    const plugins = pluginManager.getAllPlugins();
    event.reply('plugins-list', plugins);
});

ipcMain.on('search-novels', async (event, { query, pluginId }) => {
    const scraper = getScraper();
    try {
        const novels = await scraper.searchNovels(pluginId, query, 1);
        event.reply('search-results', novels.map(n => {
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
            title: result.contentTitle || "Unknown Title",
            cover: result.metadata?.cover,
            provider: String(result.siteInfo?.site || "unknown"),
            chapters: result.chapters || [],
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

ipcMain.on('start-download', async (event, { url, chapters }) => {
    const scraper = getScraper();
    if (!scraper) return;

    const targetDir = path.join(app.getPath('userData'), 'downloads');
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
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

ipcMain.on('read-chapter', async (event, { novelUrl, chapterNum }) => {
    const library = getLibrary();
    const novel = library.find(n => n.url === novelUrl);
    if (!novel || !novel.downloads || !novel.downloads[chapterNum]) {
        event.reply('error', 'Chapter not downloaded.');
        return;
    }
    const { path: savePath } = novel.downloads[chapterNum];
    try {
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

async function getCoverBuffer(url) {
    if (!url) return null;
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(response.data);
    } catch (e) {
        console.error('Failed to fetch cover:', e.message);
        return null;
    }
}

ipcMain.on('export-novel', async (event, { url, chapters, format }) => {
    const library = getLibrary();
    const novel = library.find(n => n.url === url);
    if (!novel) return;

    const { filePath } = await dialog.showSaveDialog(mainWindow, {
        title: `Export as ${format.toUpperCase()}`,
        defaultPath: `${novel.title}.${format === 'txt' ? '' : format}`,
        filters: format === 'txt' ? [] : [{ name: format.toUpperCase(), extensions: [format] }]
    });

    if (!filePath) return;

    try {
        event.reply('log-update', `Exporting ${novel.title} to ${format.toUpperCase()}...`);
        const sortedChapters = [...chapters].sort((a, b) => a.num - b.num);

        const metadata = {
            title: novel.title,
            author: novel.metadata?.author || 'Unknown',
            summary: novel.metadata?.summary || '',
            cover: novel.cover,
            url: novel.url,
            provider: novel.provider
        };

        if (format === 'txt') {
            const exportDir = filePath;
            if (!fs.existsSync(exportDir)) {
                fs.mkdirSync(exportDir, { recursive: true });
            }

            // Export metadata
            fs.writeFileSync(path.join(exportDir, 'bookinfo.json'), JSON.stringify(metadata, null, 2));

            // Export cover if exists
            if (novel.cover) {
                const coverBuf = await getCoverBuffer(novel.cover);
                if (coverBuf) {
                    fs.writeFileSync(path.join(exportDir, 'cover.png'), coverBuf);
                }
            }

            for (const chapter of sortedChapters) {
                const downloadInfo = novel.downloads[chapter.num];
                if (!downloadInfo) continue;
                const savePath = downloadInfo.path;
                const fileList = fs.readdirSync(savePath);
                const textFile = fileList.find(f => f === `Chapter ${chapter.num}.txt`);
                const htmlFile = fileList.find(f => f === `Chapter ${chapter.num}.html`);

                let chapterText = '';
                if (textFile) {
                    chapterText = fs.readFileSync(path.join(savePath, textFile), 'utf-8');
                } else if (htmlFile) {
                    const html = fs.readFileSync(path.join(savePath, htmlFile), 'utf-8');
                    chapterText = html.replace(/<[^>]*>?/gm, '');
                }
                const chapterFileName = `Chapter ${chapter.num}.txt`;
                fs.writeFileSync(path.join(exportDir, chapterFileName), `${chapter.title}\n\n${chapterText}`);
            }
        } else if (format === 'epub') {
            let coverPath = '';
            try {
                if (novel.cover) {
                    const coverBuf = await getCoverBuffer(novel.cover);
                    if (coverBuf) {
                        coverPath = path.join(app.getPath('temp'), `cover_${Date.now()}.png`);
                        fs.writeFileSync(coverPath, coverBuf);
                    }
                }
            } catch (e) {
                console.error("Failed to process cover for EPUB:", e);
            }

            // Fallback for missing cover to prevent nodepub from crashing
            if (!coverPath) {
                try {
                    const fallbackPath = path.join(app.getPath('temp'), `fallback_cover_${Date.now()}.png`);
                    const transparentPixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
                    fs.writeFileSync(fallbackPath, transparentPixel);
                    coverPath = fallbackPath;
                } catch (e) {}
            }

            const epubMetadata = {
                id: novel.url,
                title: novel.title,
                author: novel.metadata?.author || 'Unknown',
                description: novel.metadata?.summary || '',
                source: novel.url,
                contents: [],
                cover: coverPath
            };

            const epub = nodepub.document(epubMetadata);

            for (const chapter of sortedChapters) {
                const downloadInfo = novel.downloads[chapter.num];
                if (!downloadInfo) continue;
                const savePath = downloadInfo.path;
                const fileList = fs.readdirSync(savePath);
                const textFile = fileList.find(f => f === `Chapter ${chapter.num}.txt`);
                const htmlFile = fileList.find(f => f === `Chapter ${chapter.num}.html`);

                let content = '';
                if (htmlFile) {
                    content = fs.readFileSync(path.join(savePath, htmlFile), 'utf-8');
                } else if (textFile) {
                    const text = fs.readFileSync(path.join(savePath, textFile), 'utf-8');
                    content = text.split('\n').map(p => `<p>${p}</p>`).join('');
                }

                // Sanitize and ensure valid XHTML for EPUB
                // Use xmlMode to ensure tags like <br> are self-closed as <br/>
                const $ = cheerio.load(content, { xml: true }, false);
                const xhtmlContent = $.xml();
                
                epub.addSection(chapter.title, `<h1>${chapter.title}</h1>${xhtmlContent}`);
            }

            await epub.writeEPUB(path.dirname(filePath), path.basename(filePath, '.epub'));
            
            // Cleanup temp cover
            if (coverPath && fs.existsSync(coverPath)) {
                try { fs.unlinkSync(coverPath); } catch (e) {}
            }
        } else if (format === 'pdf') {
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 20;
            const contentWidth = pageWidth - (margin * 2);

            // Cover Page
            if (novel.cover) {
                try {
                    const coverBuf = await getCoverBuffer(novel.cover);
                    if (coverBuf) {
                        // Calculate aspect ratio to fit page
                        const imgProps = doc.getImageProperties(coverBuf);
                        const ratio = imgProps.width / imgProps.height;
                        let imgWidth = contentWidth;
                        let imgHeight = contentWidth / ratio;
                        
                        if (imgHeight > (pageHeight - (margin * 2))) {
                            imgHeight = pageHeight - (margin * 2);
                            imgWidth = imgHeight * ratio;
                        }
                        
                        const x = (pageWidth - imgWidth) / 2;
                        const y = (pageHeight - imgHeight) / 2;

                        doc.addImage(coverBuf, 'JPEG', x, y, imgWidth, imgHeight);
                        doc.addPage();
                    }
                } catch (e) {
                    console.error("Failed to add cover to PDF:", e);
                }
            }

            // Title Page
            doc.setFontSize(24);
            const titleLines = doc.splitTextToSize(novel.title, contentWidth);
            doc.text(titleLines, margin, 40);
            
            doc.setFontSize(14);
            doc.text(`Author: ${novel.metadata?.author || 'Unknown'}`, margin, 60 + (titleLines.length * 10));
            doc.text(`Source: ${novel.provider}`, margin, 70 + (titleLines.length * 10));

            // Summary
            if (novel.metadata?.summary) {
                doc.setFontSize(12);
                const summaryLines = doc.splitTextToSize(novel.metadata.summary, contentWidth);
                doc.text(summaryLines, margin, 90 + (titleLines.length * 10));
            }

            for (const chapter of sortedChapters) {
                const downloadInfo = novel.downloads[chapter.num];
                if (!downloadInfo) continue;
                
                doc.addPage();
                doc.setFontSize(18);
                const chapTitleLines = doc.splitTextToSize(chapter.title, contentWidth);
                doc.text(chapTitleLines, margin, 30);

                doc.setFontSize(11);
                const savePath = downloadInfo.path;
                const fileList = fs.readdirSync(savePath);
                const textFile = fileList.find(f => f === `Chapter ${chapter.num}.txt`);
                const htmlFile = fileList.find(f => f === `Chapter ${chapter.num}.html`);

                let text = '';
                if (textFile) {
                    text = fs.readFileSync(path.join(savePath, textFile), 'utf-8');
                } else if (htmlFile) {
                    const html = fs.readFileSync(path.join(savePath, htmlFile), 'utf-8');
                    text = html.replace(/<[^>]*>?/gm, '');
                }

                const lines = doc.splitTextToSize(text, contentWidth);
                
                let y = 40 + (chapTitleLines.length * 10);
                let lastLineEmpty = false;
                
                for (const line of lines) {
                    const isLineEmpty = line.trim().length === 0;
                    
                    // Collapse consecutive empty lines
                    if (isLineEmpty && lastLineEmpty) continue;
                    
                    if (y > 280) {
                        doc.addPage();
                        y = 20;
                    }
                    
                    if (line.trim().length > 0) {
                        doc.text(line, margin, y);
                        y += 6;
                        lastLineEmpty = false;
                    } else {
                        // Paragraph break
                        y += 4; 
                        lastLineEmpty = true;
                    }
                }
            }
            doc.save(filePath);
        }

        event.reply('log-update', `Successfully exported to ${filePath}`);
        event.reply('operation-success', { type: 'export' });
    } catch (e) {
        console.error(e);
        event.reply('error', `Export failed: ${e.message}`);
    }
});
