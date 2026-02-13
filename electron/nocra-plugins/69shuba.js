const path = require('path');
const fs = require('fs');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');

module.exports = {
    id: '69shuba',
    name: '69Shuba',
    meta: {
        site: 'https://www.69shuba.com',
        novelPrefix: null
    },

    async popularNovels(scraper, page = 1) {
        const url = `https://www.69shuba.com/novels/monthvisit_0_0_${page}.htm`;
        return this.parseList(scraper, url);
    },

    async searchNovels(scraper, query, page = 1) {
        scraper.log(`Searching 69Shuba for: ${query}`);
        const searchUrl = "https://www.69shuba.com/modules/article/search.php";

        // Try native fetch (POST with GBK)
        try {
            // Encode query to GBK
            const gbkQuery = iconv.encode(query, 'gbk');

            // Axios doesn't support 'GBK' encoding natively for form data easily without transformation
            // But we can send a POST request.
            // standard HTML form urlencoded.
            // We need to urlencode the GBK bytes.

            let encodedQuery = '';
            for (let i = 0; i < gbkQuery.length; i++) {
                encodedQuery += '%' + gbkQuery[i].toString(16).toUpperCase();
            }

            const body = `searchkey=${encodedQuery}&submit=Search`;

            const res = await scraper.fetchNative(searchUrl, {
                method: 'POST',
                data: body,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                responseType: 'arraybuffer' // Get buffer to decode GBK info if needed, though usually response is utf-8 or gbk.
                // 69shuba usually returns GBK HTML.
            });

            // Decode response
            const html = iconv.decode(res.data, 'gbk');
            const $ = cheerio.load(html);

            // Check if it redirected to a novel page
            // Axios follows redirects by default.
            // If we are at a novel page, the URL would have changed, but axios.res.request.res.responseUrl might be needed?
            // Or check content.

            // If list: div.newbox or .mybox
            if ($('div.newbox ul li').length > 0 || $('.buklist ul li').length > 0) {
                return this.parseListNative($, scraper, "https://www.69shuba.com");
            }

            // If direct novel (check for booknav2)
            if ($('.booknav2').length > 0) {
                const title = $('.booknav2 h1').text().trim();
                const cover = $('.bookimg2 img').attr('src');
                // Path is the current url. 
                // Axios final url:
                const finalUrl = res.request.res.responseUrl || searchUrl;

                return [{
                    name: title,
                    path: finalUrl,
                    cover: cover
                }];
            }

            return [];

        } catch (e) {
            scraper.log(`Native search failed: ${e.message}. Falling back...`);
        }

        if (!scraper.browser) await scraper.startBrowser();

        try {
            await scraper.page.goto(searchUrl, { waitUntil: 'domcontentloaded' });

            // Wait for input (optional check)
            try {
                await scraper.page.waitForSelector('input[name="searchkey"]', { timeout: 5000 });
            } catch (e) { }

            // Inject form for GBK submission
            const novels = await scraper.page.evaluate(async (action, query) => {
                const form = document.createElement('form');
                form.method = 'POST';
                form.action = action;
                form.acceptCharset = 'GBK';

                const input = document.createElement('input');
                input.type = 'text';
                input.name = 'searchkey';
                input.value = query;

                const submit = document.createElement('input');
                submit.type = 'hidden';
                submit.name = 'submit';
                submit.value = 'Search';

                form.appendChild(input);
                form.appendChild(submit);
                document.body.appendChild(form);
                form.submit();
            }, searchUrl, query);

            await scraper.page.waitForNavigation({ waitUntil: 'domcontentloaded' });

            // Check for direct novel redirect or list
            if (scraper.page.url().match(/\/(txt|book)\/[0-9]+/)) {
                // Direct match - fetch details directly to construct a "novel item"
                // But fetchNovelDetails is not exposed on `this` easily if it was part of scraper.
                // We should implement it here or reuse logic.
                // Let's reuse fetchChapterList logic to get metadata for the search result item.

                // Wait, searchNovels returns a list of {name, path, cover}.
                // We can extract metadata from the current page.
                const details = await scraper.page.evaluate(() => {
                    const titleEl = document.querySelector('div.booknav2 h1');
                    const coverEl = document.querySelector('div.bookimg2 img');
                    return {
                        name: titleEl ? titleEl.innerText.trim() : "Unknown",
                        cover: coverEl ? coverEl.src : ""
                    };
                });

                return [{
                    name: details.name,
                    path: scraper.page.url(),
                    cover: details.cover
                }];
            } else {
                return this.parseList(scraper, scraper.page.url(), true);
            }

        } catch (e) {
            if (e.message.includes('detached Frame') || e.message.includes('Target closed')) {
                scraper.log("Browser detached/closed. Restarting and retrying...");
                await scraper.closeBrowser();
                await scraper.startBrowser();
                return this.searchNovels(scraper, query, page);
            }
            scraper.log(`Search 69Shuba failed: ${e.message}`);
            return [];
        }
    },

    async parseList(scraper, url, isSearch = false) {
        // Try native fetch
        try {
            // 69shuba is GBK, need arraybuffer
            const res = await scraper.fetchNative(url, { responseType: 'arraybuffer' });
            const html = iconv.decode(res.data, 'gbk');
            const $ = cheerio.load(html);

            const novels = this.parseListNative($, scraper, "https://www.69shuba.com");
            if (novels.length > 0) {
                scraper.log(`Native: Extracted ${novels.length} entries.`);
                return novels;
            }
        } catch (e) {
            scraper.log(`Native list parse failed: ${e.message}. Falling back...`);
        }

        if (!scraper.browser) await scraper.startBrowser();

        try {
            if (!isSearch) await scraper.page.goto(url, { waitUntil: 'domcontentloaded' });

            const novels = await scraper.page.evaluate(() => {
                let items = document.querySelectorAll('div.newbox ul li');
                if (items.length === 0) {
                    items = document.querySelectorAll('.buklist ul li, .ullist li'); // Fallback
                }

                return Array.from(items).map(li => {
                    const anchor = li.querySelector('h3 a') || li.querySelector('a');
                    const img = li.querySelector('.imgbox img') || li.querySelector('img');

                    if (!anchor) return null;

                    return {
                        name: anchor.innerText.trim(),
                        path: anchor.getAttribute('href'),
                        cover: img ? img.getAttribute('src') : ""
                    };
                }).filter(n => n !== null);
            });

            return novels.map(n => ({
                ...n,
                path: n.path.startsWith('http') ? n.path : `https://www.69shuba.com${n.path}`,
                cover: n.cover
            }));
        } catch (e) {
            if (e.message.includes('detached Frame') || e.message.includes('Target closed')) {
                scraper.log("Browser detached/closed. Restarting and retrying...");
                await scraper.closeBrowser();
                await scraper.startBrowser();
                return this.parseList(scraper, url, isSearch);
            }
            scraper.log(`Error parsing list: ${e.message}`);
            return [];
        }
    },

    parseListNative($, scraper, baseUrl) {
        const novels = [];
        let items = $('div.newbox ul li');
        if (items.length === 0) {
            items = $('.buklist ul li, .ullist li');
        }

        items.each((i, el) => {
            const anchor = $(el).find('h3 a').length ? $(el).find('h3 a') : $(el).find('a');
            const img = $(el).find('.imgbox img').length ? $(el).find('.imgbox img') : $(el).find('img');

            if (!anchor.length) return;

            const name = anchor.text().trim();
            const href = anchor.attr('href');
            const cover = img.attr('src') || img.attr('data-src') || "";

            novels.push({
                name,
                path: href.startsWith('http') ? href : baseUrl + href,
                cover
            });
        });
        return novels;
    },

    async fetchChapterList(scraper, url, siteInfo) {
        // Try native fetch
        try {
            // GBK
            const res = await scraper.fetchNative(url, { responseType: 'arraybuffer' });
            const html = iconv.decode(res.data, 'gbk');
            const $ = cheerio.load(html);

            // Metadata
            const title = $('div.booknav2 h1').text().trim() || "Unknown";
            const author = $('.booknav2 p a[href*="author"]').text().trim() || "Unknown";
            const cover = $('div.bookimg2 img').attr('src') || "";
            const summary = $('div.navtxt').text().trim() || "";
            const status = $('.booknav2 p').eq(1).text().trim() || "Unknown";

            const metadata = { author, cover, summary, status };
            const contentTitle = title;

            // Need to go to catalog?
            // Check if we have catalog link or if we are AT catalog.
            // Usually catalog is at /book/ or we can construct it.
            // If we are at /txt/, we need to go to catalog.
            // Python logic: url.replace('/txt/', '/').replace('.htm', '

            let catalogUrl = url.replace('/txt/', '/').replace('.htm', '/');
            let $catalog = $;

            if (catalogUrl !== url) {
                scraper.log(`Native: Navigating to catalog ${catalogUrl}`);
                const catRes = await scraper.fetchNative(catalogUrl, { responseType: 'arraybuffer' });
                const catHtml = iconv.decode(catRes.data, 'gbk');
                $catalog = cheerio.load(catHtml);
            }

            const chapters = [];
            $catalog('div#catalog ul li a').each((i, el) => {
                chapters.push({
                    num: String(i + 1).padStart(4, '0'),
                    title: $(el).text().trim(),
                    url: $(el).attr('href')
                });
            });

            if (chapters.length > 0) {
                scraper.log(`Native: Found ${chapters.length} chapters.`);
                return { chapters, contentTitle, siteInfo, metadata };
            }

        } catch (e) {
            scraper.log(`Native fetch failed for chapter list: ${e.message}. Falling back...`);
        }

        if (!scraper.browser) await scraper.startBrowser();
        try {
            scraper.log(`Navigating to ${url}...`);
            await scraper.page.goto(url, { waitUntil: 'domcontentloaded' });

            let contentTitle = '';
            let metadata = { author: '', cover: '', summary: '', status: '' };

            try {
                metadata = await scraper.page.evaluate(() => {
                    const titleEl = document.querySelector('div.booknav2 h1');
                    const authorEl = document.querySelector('.booknav2 p a[href*="author"]');
                    const coverEl = document.querySelector('div.bookimg2 img');
                    const summaryEl = document.querySelector('div.navtxt');
                    const statusEl = document.querySelector('.booknav2 p:nth-child(2)');

                    return {
                        title: titleEl ? titleEl.innerText.trim() : "Unknown",
                        author: authorEl ? authorEl.innerText.trim() : "Unknown",
                        cover: coverEl ? coverEl.src : "",
                        summary: summaryEl ? summaryEl.innerText.trim() : "",
                        status: statusEl ? statusEl.innerText.trim() : "Unknown"
                    };
                });
                contentTitle = metadata.title;
            } catch (e) {
                scraper.log("Failed to extract metadata.");
            }

            const catalogUrl = url.replace('/txt/', '/').replace('.htm', '/');
            if (catalogUrl !== url) {
                scraper.log(`Navigating to catalog: ${catalogUrl}`);
                await scraper.page.goto(catalogUrl, { waitUntil: 'domcontentloaded' });
            }

            const chapters = await scraper.page.evaluate(() => {
                const items = document.querySelectorAll('div#catalog ul li a');
                return Array.from(items).map((a, index) => ({
                    num: String(index + 1).padStart(4, '0'),
                    title: a.innerText.trim(),
                    url: a.href
                }));
            });

            scraper.log(`Found ${chapters.length} chapters.`);

            return {
                chapters,
                contentTitle,
                siteInfo,
                metadata
            };
        } catch (e) {
            if (e.message.includes('detached Frame') || e.message.includes('Target closed')) {
                scraper.log("Browser detached/closed. Restarting and retrying...");
                await scraper.closeBrowser();
                await scraper.startBrowser();
                return this.fetchChapterList(scraper, url, siteInfo);
            }
            scraper.log(`Error parsing chapter list: ${e.message}`);
            return null;
        }
    },

    async downloadChapter(scraper, chapter, saveDir, siteInfo, contentTitle) {
        // Try native fetch
        try {
            const res = await scraper.fetchNative(chapter.url, { responseType: 'arraybuffer' });
            const html = iconv.decode(res.data, 'gbk');
            const $ = cheerio.load(html);

            const container = $('div.txtnav');
            if (container.length) {
                // Cleanup
                container.find('h1').remove();
                container.find('div.txtinfo').remove();
                container.find('div#txtright').remove();

                const content = container.text();
                if (content) {
                    const safeTitle = contentTitle.replace(/[\/\\:*?"<>|]/g, "");
                    const chapterDir = path.join(saveDir, safeTitle);
                    if (!fs.existsSync(chapterDir)) fs.mkdirSync(chapterDir, { recursive: true });
                    fs.writeFileSync(path.join(chapterDir, `Chapter ${chapter.num}.txt`), content);
                    return;
                }
            }
        } catch (e) {
            scraper.log(`Native download failed: ${e.message}. Falling back...`);
        }

        if (!scraper.browser) await scraper.startBrowser();

        try {
            await scraper.page.goto(chapter.url, { waitUntil: 'domcontentloaded' });

            const content = await scraper.page.evaluate(() => {
                const container = document.querySelector('div.txtnav');
                if (!container) return null;

                const h1 = container.querySelector('h1');
                if (h1) h1.remove();

                const txtinfo = container.querySelector('div.txtinfo');
                if (txtinfo) txtinfo.remove();

                const txtright = container.querySelector('div#txtright');
                if (txtright) txtright.remove();

                return container.innerText;
            });

            if (!content) throw new Error("Content container not found.");

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
            scraper.log(`Error downloading ${chapter.num}: ${e.message}`);
            throw e;
        }
    }
};
