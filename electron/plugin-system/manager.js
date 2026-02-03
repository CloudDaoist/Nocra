const path = require("path");
const fs = require("fs");
const createJiti = require("jiti");

const INDEX_URL =
  "https://raw.githubusercontent.com/LNReader/lnreader-plugins/plugins/v3.0.0/.dist/plugins.min.json";

const jiti = createJiti(__filename, {
  alias: {
    "@libs/fetch": path.join(__dirname, "bridge.js"),
    "@libs/filterInputs": path.join(__dirname, "bridge.js"),
    "@libs/novelStatus": path.join(__dirname, "bridge.js"),
    "@libs/isAbsoluteUrl": path.join(__dirname, "bridge.js"),
    "@libs/defaultCover": path.join(__dirname, "bridge.js"),
    "@libs/storage": path.join(__dirname, "bridge.js"),
    cheerio: require.resolve("cheerio"),
    dayjs: require.resolve("dayjs"),
    htmlparser2: require.resolve("htmlparser2"),
  },
  extensions: [".js"],
  interopDefault: true,
});

class PluginManager {
  constructor() {
    this.plugins = new Map();
    this.index = [];
    this.cacheDir = null;
    this.cacheIndexPath = null;
    this.cachePluginsDir = null;
    this.indexUrl = INDEX_URL;
    this.initPromise = null;
    this.addLegacyPlugins();
  }

  addLegacyPlugins() {
    this.plugins.set("booktoki", {
      meta: {
        id: "booktoki",
        name: "Booktoki (High Security)",
        site: "https://booktoki469.com",
        lang: "korean",
        version: "1.1.0",
        isLegacy: true,
      },
      instance: {
        id: "booktoki",
        name: "Booktoki (High Security)",
        site: "https://booktoki469.com",
        version: "1.1.0",
        isLegacy: true,
      },
      isLegacy: true,
    });
  }

  async init({ cacheDir, indexUrl } = {}) {
    if (this.initPromise) return this.initPromise;
    this.cacheDir = cacheDir;
    this.indexUrl = indexUrl || INDEX_URL;

    if (!this.cacheDir) {
      throw new Error("PluginManager init requires cacheDir");
    }

    this.cacheIndexPath = path.join(this.cacheDir, "plugins.min.json");
    this.cachePluginsDir = path.join(this.cacheDir, "plugins");

    this.initPromise = (async () => {
      this.ensureCacheDirs();

      const cachedIndex = this.loadCachedIndex();
      if (cachedIndex && cachedIndex.length > 0) {
        this.registerIndexPlugins(cachedIndex);
        // Background refresh
        this.refreshIndex().catch((e) => {
          console.error("Plugin index refresh failed:", e.message);
        });
        return;
      }

      // No cache available, must fetch
      await this.refreshIndex();
    })();

    return this.initPromise;
  }

  ensureCacheDirs() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
    if (!fs.existsSync(this.cachePluginsDir)) {
      fs.mkdirSync(this.cachePluginsDir, { recursive: true });
    }
  }

  loadCachedIndex() {
    try {
      if (fs.existsSync(this.cacheIndexPath)) {
        const raw = fs.readFileSync(this.cacheIndexPath, "utf-8");
        const parsed = JSON.parse(raw);
        this.index = parsed;
        return parsed;
      }
    } catch (e) {
      console.error("Failed to read cached plugin index:", e.message);
    }
    return null;
  }

  async refreshIndex() {
    const response = await fetch(this.indexUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch plugin index: ${response.status}`);
    }

    const list = await response.json();
    if (!Array.isArray(list)) {
      throw new Error("Invalid plugin index format");
    }

    this.index = list;
    fs.writeFileSync(this.cacheIndexPath, JSON.stringify(list));
    this.registerIndexPlugins(list);
  }

  registerIndexPlugins(list) {
    for (const item of list) {
      if (!item?.id) continue;
      const existing = this.plugins.get(item.id);
      const instance = existing?.instance || null;
      this.plugins.set(item.id, {
        meta: item,
        instance,
      });
    }
  }

  getAllPlugins() {
    return Array.from(this.plugins.values())
      .map((p) => p.meta || p.instance)
      .filter(Boolean)
      .map((p) => ({
        id: p.id,
        name: p.name,
        site: p.site,
        lang: p.lang,
        version: p.version,
        iconUrl: p.iconUrl,
      }));
  }

  getPluginById(id) {
    return this.plugins.get(id);
  }

  getPluginByUrl(url) {
    // Fast match by site
    for (const plugin of this.plugins.values()) {
      const meta = plugin.meta || plugin.instance;
      if (meta?.site && url.includes(meta.site)) return meta;
    }

    // Syosetu uses multiple subdomains
    if (url.includes("syosetu.com")) {
      const syosetu = this.plugins.get("yomou.syosetu");
      return syosetu?.meta || syosetu?.instance || null;
    }

    return null;
  }

  async getPluginInstance(id) {
    const entry = this.plugins.get(id);
    if (!entry) return null;
    if (entry.instance) return entry.instance;
    if (!entry.meta?.url) return null;

    const cachePath = path.join(
      this.cachePluginsDir,
      `${entry.meta.id}@${entry.meta.version}.js`
    );

    if (!fs.existsSync(cachePath)) {
      await this.downloadPlugin(entry.meta.url, cachePath);
    }

    let plugin = jiti(cachePath);
    if (plugin.default) plugin = plugin.default;

    if (plugin?.id) {
      entry.instance = plugin;
      return plugin;
    }

    return null;
  }

  async downloadPlugin(url, destination) {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download plugin: ${response.status}`);
    }

    const code = await response.text();
    fs.writeFileSync(destination, code);
  }
}

module.exports = new PluginManager();
