const path = require('path');
const fs = require('fs');
const createJiti = require('jiti');


const PLUGIN_ROOT = '/Users/bregassa/Development/Project Nocra/lnreader-plugins';
const PLUGIN_PATH = path.join(PLUGIN_ROOT, 'plugins');

const jiti = createJiti(__filename, {
    alias: {
        '@libs/fetch': path.join(__dirname, 'bridge.js'),
        '@libs/filterInputs': path.join(__dirname, 'bridge.js'),
        '@libs/novelStatus': path.join(__dirname, 'bridge.js'),
        '@libs/isAbsoluteUrl': path.join(__dirname, 'bridge.js'),
        '@libs/defaultCover': path.join(__dirname, 'bridge.js'),
        '@libs/storage': path.join(__dirname, 'bridge.js'),
        '@/types': path.join(PLUGIN_ROOT, 'src/types'),
        'cheerio': require.resolve('cheerio'),
        'dayjs': require.resolve('dayjs'),
        'htmlparser2': require.resolve('htmlparser2'),
    },
    extensions: ['.ts', '.js'],
    interopDefault: true,
});

class PluginManager {
    constructor() {
        this.plugins = new Map();
        this.init();
    }

    init() {
        console.log('Initializing Plugin Manager...');
        
        // Add Native/Legacy Plugins
        this.plugins.set('booktoki', {
            instance: {
                id: 'booktoki',
                name: 'Booktoki (High Security)',
                site: 'https://booktoki469.com',
                version: '1.1.0',
                isLegacy: true
            },
            path: 'native',
            lang: 'korean'
        });

        const languages = fs.readdirSync(PLUGIN_PATH).filter(f => {
            return fs.statSync(path.join(PLUGIN_PATH, f)).isDirectory() && f !== 'multisrc';
        });

        for (const lang of languages) {
            const langPath = path.join(PLUGIN_PATH, lang);
            const pluginFiles = fs.readdirSync(langPath).filter(f => f.endsWith('.ts') && !f.includes('.broken.'));

            for (const file of pluginFiles) {
                const pluginPath = path.join(langPath, file);
                try {
                    let plugin = jiti(pluginPath);
                    if (plugin.default) plugin = plugin.default; // Unwrap ES module default export
                    
                    if (plugin && plugin.id) {
                        this.plugins.set(plugin.id, {
                            instance: plugin,
                            path: pluginPath,
                            lang
                        });
                    }
                } catch (e) {
                    console.error(`Failed to load plugin ${file}:`, e.message);
                }
            }
        }
        
        // Handle multisrc later if needed, but the main ones are in language folders
        console.log(`Loaded ${this.plugins.size} plugins.`);
    }

    getPluginById(id) {
        return this.plugins.get(id);
    }

    getPluginByUrl(url) {
        for (const [id, pluginInfo] of this.plugins) {
            const instance = pluginInfo.instance;
            // Standard site match
            if (instance.site && instance.site.length > 5 && url.includes(instance.site)) {
                return instance;
            }
            // Multi-domain support (like Syosetu)
            if (instance.novelPrefix && instance.novelPrefix.length > 5 && url.includes(instance.novelPrefix)) {
                return instance;
            }
        }
        return null;
    }

    getAllPlugins() {
        return Array.from(this.plugins.values()).map(p => ({
            id: p.instance.id,
            name: p.instance.name,
            site: p.instance.site,
            lang: p.lang,
            version: p.instance.version
        }));
    }
}

module.exports = new PluginManager();
