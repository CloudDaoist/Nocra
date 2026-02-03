const cheerio = require('cheerio');
const dayjs = require('dayjs');
const { Parser } = require('htmlparser2');

// Ensure web-like globals are available in Node context for plugins
if (typeof global.fetch === 'undefined') {
    const undici = require('undici');
    global.fetch = undici.fetch;
    global.FormData = undici.FormData;
    global.Headers = undici.Headers;
    global.Request = undici.Request;
    global.Response = undici.Response;
    global.File = undici.File;
} else {
    // Node 20+ has fetch but sometimes File/FormData need to be ensured
    if (typeof global.FormData === 'undefined') global.FormData = require('undici').FormData;
    if (typeof global.Headers === 'undefined') global.Headers = require('undici').Headers;
    if (typeof global.Request === 'undefined') global.Request = require('undici').Request;
    if (typeof global.Response === 'undefined') global.Response = require('undici').Response;
    if (typeof global.File === 'undefined') {
        try {
            // Try to get it from undici if missing
            global.File = require('undici').File;
        } catch (e) {
            // Fallback for older node if undici doesn't have it or isn't installed
            global.File = class File extends Blob {
                constructor(parts, filename, options = {}) {
                    super(parts, options);
                    this.name = filename;
                    this.lastModified = options.lastModified || Date.now();
                }
            };
        }
    }
}

// Mock NovelStatus
const NovelStatus = {
    Unknown: 'Unknown',
    Ongoing: 'Ongoing',
    Completed: 'Completed',
    Licensed: 'Licensed',
    PublishingFinished: 'Publishing Finished',
    Cancelled: 'Cancelled',
    OnHiatus: 'On Hiatus',
};

// Mock defaultCover
const defaultCover = 'https://github.com/LNReader/lnreader-plugins/blob/main/icons/src/coverNotAvailable.jpg?raw=true';

// Mock FilterTypes
const FilterTypes = {
    TextInput: 'Text',
    Picker: 'Picker',
    CheckboxGroup: 'Checkbox',
    Switch: 'Switch',
    ExcludableCheckboxGroup: 'XCheckbox',
};

// Utils
const isUrlAbsolute = (url) => {
    return /^(?:[a-z+]+:)?\/\//i.test(url);
};

// Storage Mock
const storage = {
    get: (key) => '',
    set: (key, value) => {},
    remove: (key) => {},
};

const localStorage = {
    get: (key) => ({}),
    set: (key, value) => {},
    remove: (key) => {},
};

// Fetch API implementation for Node
async function fetchApi(url, init = {}) {
    const response = await fetch(url, {
        ...init,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.162 Mobile Safari/537.36',
            ...init.headers,
        }
    });
    return response;
}

const fetchText = async (url, init) => {
    const res = await fetchApi(url, init);
    return res.text();
};

const fetchFile = async (url, init) => {
    const res = await fetchApi(url, init);
    const buffer = await res.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
};

module.exports = {
    cheerio,
    dayjs,
    Parser,
    NovelStatus,
    defaultCover,
    FilterTypes,
    isUrlAbsolute,
    storage,
    localStorage,
    fetchApi,
    fetchText,
    fetchFile,
};
