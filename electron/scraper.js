const { connect } = require("puppeteer-real-browser");
const fs = require('fs');
const path = require('path');
const pluginManager = require('./plugin-system/manager');

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
        });
        this.browser = browser;
        this.page = page;
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
        // Legacy Support: Booktoki
        if (url.match(/^https:\/\/booktoki[0-9]+.com\/novel\/[0-9]+/)) {
            const domain = url.match(/^https:\/\/booktoki[0-9]+.com/)[0];
            return { site: 'booktoki', title: 'Booktoki', domain, driver: 'legacy', pluginId: 'booktoki' };
        }

        // Plugin Support
        const plugin = pluginManager.getPluginByUrl(url);
        if (plugin) {
            return { site: plugin.id, title: plugin.name, driver: 'plugin', pluginId: plugin.id };
        }

        return null;
    }

    async popularNovels(pluginId, page = 1) {
        if (pluginId === 'booktoki') {
            return this.popularNovelsLegacy(page);
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
        if (pluginId === 'booktoki') {
            return this.searchNovelsLegacy(query, page);
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

    async popularNovelsLegacy(page = 1) {
        if (!this.browser) await this.startBrowser();
        const url = `https://booktoki469.com/novel?book=&yoil=&jaum=&tag=&sst=as_update&sod=desc&stx=&page=${page}`;
        return this.parseListLegacy(url);
    }

    async searchNovelsLegacy(query, page = 1) {
        if (!this.browser) await this.startBrowser();
        const url = `https://booktoki469.com/novel?book=&yoil=&jaum=&tag=&sst=as_update&sod=desc&stx=${encodeURIComponent(query)}&page=${page}`;
        return this.parseListLegacy(url);
    }

    async parseListLegacy(url) {
        if (!this.browser) await this.startBrowser();
        this.log(`Navigating to list: ${url}`);

        try {
            await this.page.goto(url);

            // Wait for Cloudflare challenge
            let koreanTitle = '북토끼';
            let challengeCounter = 0;
            while (!(await this.page.title()).includes(koreanTitle)) {
                if (this.stopFlag || challengeCounter > 100) break;
                await this.sleep(200);
                challengeCounter++;
            }

            this.log("List page reached, waiting for container...");

            // Wait for list container
            try {
                await this.page.waitForSelector('#webtoon-list-all, .list-container', { timeout: 30000 });
            } catch (e) {
                this.log("Timeout waiting for list container.");
            }

            const novels = await this.page.evaluate(() => {
                const items = document.querySelectorAll('#webtoon-list-all > li');
                return Array.from(items).map(li => {
                    const anchor = li.querySelector('a');
                    const img = li.querySelector('img');
                    const titleSpan = li.querySelector('.title');

                    return {
                        name: titleSpan ? titleSpan.innerText.trim() : (li.getAttribute('date-title') || li.innerText.split('\n')[0] || "Unknown"),
                        path: anchor ? anchor.getAttribute('href') : "",
                        cover: img ? (img.getAttribute('src') || img.getAttribute('data-src')) : ""
                    };
                });
            });

            this.log(`Extracted ${novels.length} entries from list.`);

            // Ensure covers are absolute URLs and De-duplicate by path
            const currentUrl = this.page.url();
            const domainMatch = currentUrl.match(/^https:\/\/booktoki[0-9]+.com/);
            const domain = domainMatch ? domainMatch[0] : "https://booktoki469.com";

            const seenPaths = new Set();
            const uniqueNovels = [];

            for (const n of novels) {
                if (!n.path) continue;

                let absolutePath = n.path.startsWith('http') ? n.path : domain + (n.path.startsWith('/') ? n.path : '/' + n.path);

                // Filter and de-duplicate
                if ((absolutePath.includes('/novel/') || absolutePath.match(/\/novel\/[0-9]+/)) && !seenPaths.has(absolutePath)) {
                    seenPaths.add(absolutePath);
                    uniqueNovels.push({
                        ...n,
                        cover: n.cover && !n.cover.startsWith('http') ? (n.cover.startsWith('//') ? 'https:' + n.cover : domain + (n.cover.startsWith('/') ? n.cover : '/' + n.cover)) : n.cover,
                        path: absolutePath
                    });
                }
            }

            return uniqueNovels;
        } catch (e) {
            this.log(`Error parsing list: ${e.message}`);
            return [];
        }
    }

    async fetchChapterList(url) {
        this.stopFlag = false;
        const siteInfo = this.identifySite(url);

        if (!siteInfo) {
            this.log("Invalid URL or unsupported site.");
            return null;
        }

        if (siteInfo.driver === 'legacy') {
            return this.fetchChapterListLegacy(url, siteInfo);
        } else {
            return this.fetchChapterListPlugin(url, siteInfo);
        }
    }

    async fetchChapterListLegacy(url, siteInfo) {
        if (!this.browser) await this.startBrowser();

        this.log(`Navigating to ${url}...`);
        await Promise.all([this.page.waitForNavigation().catch(() => { }), this.page.goto(url)]);

        this.log("Waiting for Cloudflare challenge...");
        let koreanTitle = '북토끼';

        try {
            while (!(await this.page.title()).includes(koreanTitle)) {
                if (this.stopFlag) return;
                await this.sleep(100);
            }
        } catch (e) { }

        this.log("Site loaded. Fetching chapters...");

        let chapters = [];
        let contentTitle = '';
        let metadata = {
            author: 'Unknown',
            cover: '',
            summary: '',
            status: 'Unknown'
        };

        // Extract Metadata
        try {
            metadata = await this.page.evaluate(() => {
                const authorEl = document.querySelector('.fa-user')?.parentElement?.innerText?.trim() || 'Unknown';
                const coverEl = document.querySelector('.view-img img')?.src || document.querySelector('meta[property="og:image"]')?.content || '';
                const summaryEl = document.querySelector('.view-content')?.innerText?.trim() || '';
                const title = document.querySelector('.page-title .page-desc')?.innerText?.trim() || '';

                // Status often in data-weekday or similar on list, but on page might be different
                // For now use a placeholder or try to find it
                return { author: authorEl.replace('작업자', '').trim(), cover: coverEl, summary: summaryEl, title };
            });
            contentTitle = metadata.title || "Booktoki Novel";
        } catch (e) {
            this.log("Failed to extract metadata.");
            contentTitle = "Booktoki Novel";
        }

        while (true) {
            if (this.stopFlag) break;

            try {
                await this.page.waitForSelector('.list-body', { timeout: 40000 });
            } catch (e) {
                this.log("Timeout waiting for list body.");
                break;
            }

            await this.sleep(1000);

            const pageChapters = await this.page.evaluate(() => {
                let list = Array.from(document.querySelector('.list-body').querySelectorAll('li'));
                return list.map(li => ({
                    num: li.querySelector('.wr-num').innerText.trim().padStart(4, '0'),
                    title: li.querySelector('a').innerHTML.replace(/<span[\s\S]*?\/span>/g, '').trim(),
                    url: li.querySelector('a').href
                }));
            });

            chapters = chapters.concat(pageChapters);

            if (!contentTitle) {
                contentTitle = await this.page.evaluate(() => document.querySelector('.page-title .page-desc').innerText);
            }

            this.log(`Fetched ${chapters.length} chapters so far...`);

            const nextButton = await this.page.$('ul.pagination li[class="active"] ~ li:not([class="disabled"]) a');
            if (nextButton) {
                await Promise.all([this.page.waitForNavigation(), nextButton.click()]);
            } else {
                break;
            }
        }

        this.log(`Found total ${chapters.length} chapters.`);
        return { chapters: chapters.reverse(), contentTitle, siteInfo, metadata };
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

        if (siteInfo.driver === 'legacy') {
            return this.downloadChapterLegacy(chapter, saveDir, siteInfo, contentTitle);
        } else {
            return this.downloadChapterPlugin(chapter, saveDir, siteInfo, contentTitle);
        }
    }

    async downloadChapterLegacy(chapter, saveDir, siteInfo, contentTitle) {
        if (!this.browser) await this.startBrowser();
        try {
            this.log(`Navigating to ${chapter.url}...`);
            await Promise.all([this.page.goto(chapter.url), this.page.waitForNavigation().catch(() => { })]);

            // Enhanced Cloudflare waiting logic
            const cfTimeout = 60000; // 60 seconds
            const startTime = Date.now();

            let foundContent = false;
            while (Date.now() - startTime < cfTimeout) {
                if (this.stopFlag) break;

                try {
                    // Quick check for content
                    const contentEl = await this.page.$('#novel_content');
                    if (contentEl) {
                        foundContent = true;
                        break;
                    }

                    // Check if we are stuck on Cloudflare
                    const title = await this.page.title();
                    if (title.includes('Just a moment') || title.includes('Cloudflare')) {
                        this.log(`Waiting for Cloudflare challenge... (${Math.round((cfTimeout - (Date.now() - startTime)) / 1000)}s remaining)`);
                    }

                    await this.sleep(2000);
                } catch (e) {
                    await this.sleep(1000);
                }
            }

            if (!foundContent) {
                throw new Error("Content selector #novel_content not found after waiting (Possible Cloudflare timeout).");
            }

            const content = await this.page.evaluate(() => {
                const el = document.querySelector('#novel_content');
                return el ? el.innerText : null;
            });

            if (!content) throw new Error("Content is empty.");

            const safeTitle = contentTitle.replace(/[\/\\:*?"<>|]/g, "");
            const chapterDir = path.join(saveDir, safeTitle);

            if (!fs.existsSync(chapterDir)) fs.mkdirSync(chapterDir, { recursive: true });
            fs.writeFileSync(path.join(chapterDir, `Chapter ${chapter.num}.txt`), content);
        } catch (e) {
            this.log(`Error downloading chapter ${chapter.num}: ${e.message}`);
            throw e; // Rethrow to prevent main.js from marking as success
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
}

module.exports = NocraScraper;
