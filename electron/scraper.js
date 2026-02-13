const { connect } = require("puppeteer-real-browser");
const fs = require('fs');
const path = require('path');
const pluginManager = require('./plugin-system/manager');
const iconv = require('iconv-lite');
const axios = require('axios');
const cheerio = require('cheerio');

// Load native plugins
const nocraPlugins = new Map();
const pluginsDir = path.join(__dirname, 'nocra-plugins');
if (fs.existsSync(pluginsDir)) {
    fs.readdirSync(pluginsDir).forEach(file => {
        if (file.endsWith('.js')) {
            const plugin = require(path.join(pluginsDir, file));
            if (plugin.id) {
                nocraPlugins.set(plugin.id, plugin);
            }
        }
    });
}

class NocraScraper {
    constructor(mainWindow) {
        this.mainWindow = mainWindow;
        this.browser = null;
        this.page = null;
        this.stopFlag = false;
    }

    log(message) {
        if (this.mainWindow) {
            this.mainWindow.webContents.send('log-update', message);
        }
        console.log(message);
    }

    async startBrowser() {
        if (this.browser) return;
        this.log("Starting high-security browser (Puppeteer)...");
        const { browser, page } = await connect({
            headless: false,
            args: [],
            customConfig: {},
            turnstile: true,
            connectOption: { defaultViewport: null },
            disableXvfb: false,
            ignoreDefaultArgs: ["--enable-automation", "--no-sandbox"],
        });
        this.browser = browser;
        this.page = page;

        this.browser.on('disconnected', () => {
            this.log("Browser disconnected.");
            this.browser = null;
            this.page = null;
        });

        this.log("Browser started.");
    }

    async closeBrowser() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
            this.log("Browser closed.");
        }
    }

    stop() {
        this.stopFlag = true;
        this.log("Stopping operation...");
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    identifySite(url) {
        // Nocra Plugin Support: Booktoki
        if (url.match(/^https:\/\/booktoki[0-9]+.com\/novel\/[0-9]+/)) {
            const domain = url.match(/^https:\/\/booktoki[0-9]+.com/)[0];
            return { site: 'booktoki', title: 'Booktoki', domain, driver: 'nocra', pluginId: 'booktoki' };
        }

        // Nocra Plugin Support: 69Shuba
        if (url.match(/69shuba|69shu|69xinshu/)) {
            const domainMatch = url.match(/https:\/\/(www\.)?(69shuba\.com|69shu\.com|69xinshu\.com|69shu\.pro|69shuba\.pro)/);
            const domain = domainMatch ? domainMatch[0] : 'https://www.69shuba.com';
            return { site: '69shuba', title: '69Shuba', domain, driver: 'nocra', pluginId: '69shuba' };
        }

        // Plugin Support
        const plugin = pluginManager.getPluginByUrl(url);
        if (plugin) {
            return { site: plugin.id, title: plugin.name, driver: 'plugin', pluginId: plugin.id };
        }

        return null;
    }

    async popularNovels(pluginId, page = 1) {
        const nativePlugin = nocraPlugins.get(pluginId);
        if (nativePlugin) {
            return nativePlugin.popularNovels(this, page);
        }

        const plugin = await pluginManager.getPluginInstance(pluginId);
        if (!plugin) return [];

        // Pass default filters if not provided
        const filters = plugin.filters || {};
        const novels = await plugin.popularNovels(page, { filters });
        return novels.map(n => ({
            ...n,
            cover: this.filterCover(n.cover)
        }));
    }

    async searchNovels(pluginId, query, page = 1) {
        const nativePlugin = nocraPlugins.get(pluginId);
        if (nativePlugin) {
            return nativePlugin.searchNovels(this, query, page);
        }

        const plugin = await pluginManager.getPluginInstance(pluginId);
        if (!plugin) return [];
        const novels = await plugin.searchNovels(query, page);
        return novels.map(n => ({
            ...n,
            cover: this.filterCover(n.cover)
        }));
    }

    filterCover(cover) {
        if (!cover) return null;
        const uglyCover = 'https://github.com/LNReader/lnreader-plugins/blob/main/icons/src/coverNotAvailable.jpg?raw=true';
        if (cover === uglyCover) return null;
        return cover;
    }



    async fetchChapterList(url) {
        this.stopFlag = false;
        const siteInfo = this.identifySite(url);

        if (!siteInfo) {
            this.log("Invalid URL or unsupported site.");
            return null;
        }

        if (siteInfo.driver === 'nocra') {
            const nativePlugin = nocraPlugins.get(siteInfo.pluginId);
            if (nativePlugin) {
                return nativePlugin.fetchChapterList(this, url, siteInfo);
            }
            this.log(`Error: Native plugin ${siteInfo.pluginId} not found.`);
            return null;
        } else {
            return this.fetchChapterListPlugin(url, siteInfo);
        }
    }



    async fetchChapterListPlugin(url, siteInfo) {
        const plugin = await pluginManager.getPluginInstance(siteInfo.pluginId);
        if (!plugin) throw new Error("Plugin not available");
        this.log(`Using plugin: ${plugin.name}`);

        try {
            // Robust path extraction
            let novelPath = url;
            const domains = [plugin.site, plugin.novelPrefix].filter(Boolean);
            for (const domain of domains) {
                if (url.startsWith(domain)) {
                    novelPath = url.replace(domain, '');
                    break;
                }
            }
            // If still starts with http, try to extract path via URL object
            if (novelPath.startsWith('http')) {
                try {
                    const urlObj = new URL(url);
                    novelPath = urlObj.pathname + urlObj.search;
                } catch (e) { }
            }

            if (!novelPath.startsWith('/')) {
                novelPath = '/' + novelPath;
            }

            this.log(`Fetching novel data for path: ${novelPath}`);

            const novel = await plugin.parseNovel(novelPath);

            if (!novel || !novel.chapters) {
                throw new Error("Plugin returned no chapters.");
            }

            const chapters = novel.chapters.map((c, index) => ({
                num: String(index + 1).padStart(4, '0'),
                title: c.name,
                url: c.path // Plugins use 'path' as their identifier for chapters
            }));

            return {
                chapters,
                contentTitle: novel.name || "Untitled Novel",
                siteInfo,
                metadata: {
                    author: novel.author || "Unknown",
                    summary: novel.summary || "",
                    cover: this.filterCover(novel.cover),
                    status: novel.status || "Unknown"
                }
            };
        } catch (e) {
            this.log(`Plugin error: ${e.message}`);
            throw e;
        }
    }

    async downloadChapter(chapter, saveDir, siteInfo, contentTitle) {
        if (this.stopFlag) return;
        this.log(`Downloading: ${chapter.num} - ${chapter.title}`);

        if (siteInfo.driver === 'nocra') {
            const nativePlugin = nocraPlugins.get(siteInfo.pluginId);
            if (nativePlugin) {
                return nativePlugin.downloadChapter(this, chapter, saveDir, siteInfo, contentTitle);
            }
            throw new Error(`Native plugin ${siteInfo.pluginId} not found.`);
        } else {
            return this.downloadChapterPlugin(chapter, saveDir, siteInfo, contentTitle);
        }
    }



    async downloadChapterPlugin(chapter, saveDir, siteInfo, contentTitle) {
        const plugin = await pluginManager.getPluginInstance(siteInfo.pluginId);
        if (!plugin) throw new Error("Plugin not available");
        try {
            this.log(`Fetching content for ${chapter.title}...`);
            const htmlContent = await plugin.parseChapter(chapter.url);

            if (!htmlContent) throw new Error("No content returned from plugin.");

            const safeTitle = contentTitle.replace(/[\/\\:*?"<>|]/g, "");
            const chapterDir = path.join(saveDir, safeTitle);

            if (!fs.existsSync(chapterDir)) fs.mkdirSync(chapterDir, { recursive: true });

            // We save as .html to indicate it's rich content
            fs.writeFileSync(path.join(chapterDir, `Chapter ${chapter.num}.html`), htmlContent);
            this.log(`Saved ${chapter.num} as HTML.`);
        } catch (e) {
            this.log(`Plugin download error: ${e.message}`);
            throw e; // Rethrow to prevent main.js from marking as success
        }
    }



    async fetchInBrowser(url, options = {}) {
        if (!this.browser) await this.startBrowser();

        const method = options.method ? options.method.toUpperCase() : 'GET';
        this.log(`Fetch in browser (${method}): ${url}`);

        if (method === 'GET') {
            try {
                // For GET requests, we use page.goto which is more robust against Cloudflare
                // and handles full page loads (including eventual JS rendering if we waited)
                const response = await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

                // Cloudflare check
                const checkCloudflare = async () => {
                    const title = await this.page.title();
                    if (title.includes('Just a moment') || title.includes('Cloudflare')) {
                        this.log("Cloudflare detected. Waiting...");
                        await this.sleep(5000);
                        return checkCloudflare(); // Retry
                    }
                };
                await checkCloudflare();

                // Get content
                // Note: response.text() is from the network response. 
                // page.content() is the DOM. Plugins usually expect HTML.
                // Let's use page.content() to be safe against JS-rendered content,
                // BUT bridge.js expects a response body.
                // Usually fetch returns the wire response. 
                // Let's return page.content() as it's what the user sees.
                const content = await this.page.content();
                const base64 = Buffer.from(content).toString('base64');

                return {
                    ok: response ? response.ok() : true,
                    status: response ? response.status() : 200,
                    statusText: response ? response.statusText() : 'OK',
                    headers: response ? response.headers() : {},
                    bodyBase64: base64,
                    url: this.page.url()
                };
            } catch (e) {
                this.log(`Navigation error: ${e.message}`);
                throw e;
            }
        } else {
            // POST or other methods - use fetch inside page
            try {
                const targetUrlObj = new URL(url);
                const targetOrigin = targetUrlObj.origin;
                const currentUrl = this.page.url();

                if (!currentUrl.startsWith(targetOrigin)) {
                    this.log(`Navigating to ${targetOrigin} to establish session...`);
                    await this.page.goto(targetOrigin, { waitUntil: 'domcontentloaded' });
                }

                const result = await this.page.evaluate(async (url, options) => {
                    const fetchOptions = options || {};
                    const response = await fetch(url, fetchOptions);

                    const buffer = await response.arrayBuffer();
                    const base64 = btoa(
                        new Uint8Array(buffer)
                            .reduce((data, byte) => data + String.fromCharCode(byte), '')
                    );

                    const headers = {};
                    for (const [key, value] of response.headers) {
                        headers[key] = value;
                    }

                    return {
                        ok: response.ok,
                        status: response.status,
                        statusText: response.statusText,
                        headers: headers,
                        bodyBase64: base64,
                        url: response.url
                    };
                }, url, options);

                return result;
            } catch (e) {
                console.error("Browser fetch error:", e);
                throw e;
            }
        }
    }

    async fetchNative(url, options = {}) {
        this.log(`Fetching native: ${url}`);
        try {
            const response = await axios({
                url,
                method: options.method || 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    ...options.headers
                },
                responseType: options.responseType || 'document',
                ...options
            });
            return response;
        } catch (error) {
            // If it's a 403 or 503, it's likely Cloudflare or bot protection
            if (error.response && (error.response.status === 403 || error.response.status === 503)) {
                throw new Error(`Blocked by site (${error.response.status})`);
            }
            throw error;
        }
    }
}

module.exports = NocraScraper;
