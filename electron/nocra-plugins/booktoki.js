const path = require('path');
const fs = require('fs');
const cheerio = require('cheerio');

module.exports = {
    id: 'booktoki',
    name: 'Booktoki',
    meta: {
        site: 'https://booktoki469.com', // Base, though urls vary
        novelPrefix: null,
    },

    async popularNovels(scraper, page = 1) {
        if (!scraper.browser) await scraper.startBrowser();
        const url = `https://booktoki469.com/novel?book=&yoil=&jaum=&tag=&sst=as_update&sod=desc&stx=&page=${page}`;
        return this.parseList(scraper, url);
    },

    async searchNovels(scraper, query, page = 1) {
        if (!scraper.browser) await scraper.startBrowser();
        const url = `https://booktoki469.com/novel?book=&yoil=&jaum=&tag=&sst=as_update&sod=desc&stx=${encodeURIComponent(query)}&page=${page}`;
        return this.parseList(scraper, url);
    },

    async parseList(scraper, url) {
        // Try native fetch first
        try {
            const res = await scraper.fetchNative(url);
            const $ = cheerio.load(res.data);
            const novels = [];

            $('#webtoon-list-all > li').each((i, el) => {
                const anchor = $(el).find('a');
                const img = $(el).find('img');
                const titleSpan = $(el).find('.title');

                const name = titleSpan.length ? titleSpan.text().trim() : ($(el).attr('date-title') || $(el).text().split('\n')[0] || "Unknown");
                const path = anchor.length ? anchor.attr('href') : "";
                const cover = img.length ? (img.attr('src') || img.attr('data-src')) : "";

                novels.push({ name, path, cover });
            });

            if (novels.length > 0) {
                scraper.log(`Native: Extracted ${novels.length} entries.`);
                return this.processNovels(scraper, novels, url);
            }
        } catch (e) {
            scraper.log(`Native fetch failed: ${e.message}. Falling back to browser...`);
        }

        if (!scraper.browser) await scraper.startBrowser();
        scraper.log(`Navigating to list: ${url}`);

        try {
            await scraper.page.goto(url);

            // Wait for Cloudflare challenge
            let koreanTitle = '북토끼';
            let challengeCounter = 0;
            while (!(await scraper.page.title()).includes(koreanTitle)) {
                if (scraper.stopFlag || challengeCounter > 100) break;
                await scraper.sleep(200);
                challengeCounter++;
            }

            scraper.log("List page reached, waiting for container...");

            // Wait for list container
            try {
                await scraper.page.waitForSelector('#webtoon-list-all, .list-container', { timeout: 30000 });
            } catch (e) {
                scraper.log("Timeout waiting for list container.");
            }

            const novels = await scraper.page.evaluate(() => {
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

            scraper.log(`Extracted ${novels.length} entries from list.`);

            return this.processNovels(scraper, novels, scraper.page.url());
        } catch (e) {
            if (e.message.includes('detached Frame') || e.message.includes('Target closed')) {
                scraper.log("Browser detached/closed. Restarting and retrying...");
                await scraper.closeBrowser();
                await scraper.startBrowser();
                return this.parseList(scraper, url);
            }
            scraper.log(`Error parsing list: ${e.message}`);
            return [];
        }
    },

    processNovels(scraper, novels, currentUrl) {
        // Ensure covers are absolute URLs and De-duplicate by path
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
    },

    async fetchChapterList(scraper, url, siteInfo) {
        // Try native fetch
        try {
            const res = await scraper.fetchNative(url);
            const $ = cheerio.load(res.data);

            // Check if blocked by title (e.g. Just a moment...) although axios usually throws on 403/503
            const title = $('title').text();
            if (title.includes('Just a moment') || title.includes('Cloudflare')) {
                throw new Error("Cloudflare detected in content");
            }

            const author = $('.fa-user').parent().text().replace('작업자', '').trim() || 'Unknown';
            const cover = $('.view-img img').attr('src') || $('meta[property="og:image"]').attr('content') || '';
            const summary = $('.view-content').text().trim() || '';
            const contentTitle = $('.page-title .page-desc').text().trim() || "Booktoki Novel";
            const metadata = { author, cover, summary, status: 'Unknown' };

            const chapters = [];
            $('.list-body > ul > li').each((i, el) => {
                const link = $(el).find('a');
                const date = $(el).find('.wr-date').text().trim(); // optionally use date
                let chapTitle = link.html().replace(/<span[\s\S]*?\/span>/g, '').trim();
                // Decode HTML entities if needed, cheerio handles some but innerHTML might keep them
                // better to use text() but structure is complex.
                // let's stick to simple text extraction if possible or just use what we have.
                // Actually $(el).find('a').contents().filter((_,e)=>e.type==='text').text() might work better

                const num = $(el).find('.wr-num').text().trim().padStart(4, '0');
                const href = link.attr('href');

                if (href) {
                    chapters.push({ num, title: chapTitle, url: href });
                }
            });

            if (chapters.length > 0) {
                scraper.log(`Native: Fetched ${chapters.length} chapters.`);
                return { chapters: chapters.reverse(), contentTitle, siteInfo, metadata };
            }
        } catch (e) {
            scraper.log(`Native fetch failed for chapter list: ${e.message}. Falling back...`);
        }

        if (!scraper.browser) await scraper.startBrowser();

        try {
            scraper.log(`Navigating to ${url}...`);
            await Promise.all([scraper.page.waitForNavigation().catch(() => { }), scraper.page.goto(url)]);

            scraper.log("Waiting for Cloudflare challenge...");
            let koreanTitle = '북토끼';

            try {
                while (!(await scraper.page.title()).includes(koreanTitle)) {
                    if (scraper.stopFlag) return;
                    await scraper.sleep(100);
                }
            } catch (e) { }

            scraper.log("Site loaded. Fetching chapters...");

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
                metadata = await scraper.page.evaluate(() => {
                    const authorEl = document.querySelector('.fa-user')?.parentElement?.innerText?.trim() || 'Unknown';
                    const coverEl = document.querySelector('.view-img img')?.src || document.querySelector('meta[property="og:image"]')?.content || '';
                    const summaryEl = document.querySelector('.view-content')?.innerText?.trim() || '';
                    const title = document.querySelector('.page-title .page-desc')?.innerText?.trim() || '';

                    return { author: authorEl.replace('작업자', '').trim(), cover: coverEl, summary: summaryEl, title };
                });
                contentTitle = metadata.title || "Booktoki Novel";
            } catch (e) {
                scraper.log("Failed to extract metadata.");
                contentTitle = "Booktoki Novel";
            }

            while (true) {
                if (scraper.stopFlag) break;

                try {
                    await scraper.page.waitForSelector('.list-body', { timeout: 40000 });
                } catch (e) {
                    scraper.log("Timeout waiting for list body.");
                    break;
                }

                await scraper.sleep(1000);

                const pageChapters = await scraper.page.evaluate(() => {
                    let list = Array.from(document.querySelector('.list-body').querySelectorAll('li'));
                    return list.map(li => ({
                        num: li.querySelector('.wr-num').innerText.trim().padStart(4, '0'),
                        title: li.querySelector('a').innerHTML.replace(/<span[\s\S]*?\/span>/g, '').trim(),
                        url: li.querySelector('a').href
                    }));
                });

                chapters = chapters.concat(pageChapters);

                if (!contentTitle) {
                    contentTitle = await scraper.page.evaluate(() => document.querySelector('.page-title .page-desc').innerText);
                }

                scraper.log(`Fetched ${chapters.length} chapters so far...`);

                const nextButton = await scraper.page.$('ul.pagination li[class="active"] ~ li:not([class="disabled"]) a');
                if (nextButton) {
                    await Promise.all([scraper.page.waitForNavigation(), nextButton.click()]);
                } else {
                    break;
                }
            }

            scraper.log(`Found total ${chapters.length} chapters.`);
            return { chapters: chapters.reverse(), contentTitle, siteInfo, metadata };

        } catch (e) {
            if (e.message.includes('detached Frame') || e.message.includes('Target closed')) {
                scraper.log("Browser detached/closed. Restarting and retrying...");
                await scraper.closeBrowser();
                await scraper.startBrowser();
                return this.fetchChapterList(scraper, url, siteInfo);
            }
            throw e;
        }
    },

    async downloadChapter(scraper, chapter, saveDir, siteInfo, contentTitle) {
        // ... (existing native check is fine before this) ...
        // Try native fetch first
        try {
            const res = await scraper.fetchNative(chapter.url);
            const $ = cheerio.load(res.data);
            // ... (native fetch logic) ...
            let content = $('#novel_content').text();
            if (content && content.trim().length > 0) {
                const safeTitle = contentTitle.replace(/[\/\\:*?"<>|]/g, "");
                const chapterDir = path.join(saveDir, safeTitle);
                if (!fs.existsSync(chapterDir)) fs.mkdirSync(chapterDir, { recursive: true });
                fs.writeFileSync(path.join(chapterDir, `Chapter ${chapter.num}.txt`), content);
                return;
            } else {
                throw new Error("Content empty or not found via native fetch");
            }
        } catch (e) {
            scraper.log(`Native download failed: ${e.message}. Falling back...`);
        }

        if (!scraper.browser) await scraper.startBrowser();
        try {
            scraper.log(`Navigating to ${chapter.url}...`);
            await Promise.all([scraper.page.goto(chapter.url), scraper.page.waitForNavigation().catch(() => { })]);

            // Enhanced Cloudflare waiting logic
            const cfTimeout = 60000; // 60 seconds
            const startTime = Date.now();

            let foundContent = false;
            while (Date.now() - startTime < cfTimeout) {
                if (scraper.stopFlag) break;

                try {
                    // Quick check for content
                    const contentEl = await scraper.page.$('#novel_content');
                    if (contentEl) {
                        foundContent = true;
                        break;
                    }

                    // Check if we are stuck on Cloudflare
                    const title = await scraper.page.title();
                    if (title.includes('Just a moment') || title.includes('Cloudflare')) {
                        scraper.log(`Waiting for Cloudflare challenge... (${Math.round((cfTimeout - (Date.now() - startTime)) / 1000)}s remaining)`);
                    }

                    await scraper.sleep(2000);
                } catch (e) {
                    await scraper.sleep(1000);
                }
            }

            if (!foundContent) {
                throw new Error("Content selector #novel_content not found after waiting (Possible Cloudflare timeout).");
            }

            const content = await scraper.page.evaluate(() => {
                const el = document.querySelector('#novel_content');
                return el ? el.innerText : null;
            });

            if (!content) throw new Error("Content is empty.");

            const safeTitle = contentTitle.replace(/[\/\\:*?"<>|]/g, "");
            const chapterDir = path.join(saveDir, safeTitle);

            if (!fs.existsSync(chapterDir)) fs.mkdirSync(chapterDir, { recursive: true });
            fs.writeFileSync(path.join(chapterDir, `Chapter ${chapter.num}.txt`), content);
        } catch (e) {
            if (e.message.includes('detached Frame') || e.message.includes('Target closed')) {
                scraper.log("Browser detached/closed. Restarting and retrying...");
                await scraper.closeBrowser();
                await scraper.startBrowser();
                return this.downloadChapter(scraper, chapter, saveDir, siteInfo, contentTitle);
            }
            scraper.log(`Error downloading chapter ${chapter.num}: ${e.message}`);
            throw e;
        }
    }
};
