const cheerio = require('cheerio');
const dayjs = require('dayjs');
const { Parser } = require('htmlparser2');

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
const defaultCover = null;

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
    // Standardize URL to avoid double slashes if possible (except for protocol)
    let cleanUrl = url;
    if (url.includes('://')) {
        const protocol = url.split('://')[0];
        const rest = url.split('://')[1].replace(/\/+/g, '/');
        cleanUrl = protocol + '://' + rest;
    }

    console.log(`[Plugin Fetch] ${cleanUrl}`);
    
    const response = await fetch(cleanUrl, {
        ...init,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
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
