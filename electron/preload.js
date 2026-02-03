const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    send: (channel, data) => {
        let validChannels = ['toMain', 'start-download', 'stop-download', 'fetch-info', 'add-novel', 'refresh-novel', 'remove-novel', 'get-library', 'read-chapter', 'get-plugins', 'search-novels', 'popular-novels'];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    receive: (channel, func) => {
        let validChannels = ['fromMain', 'log-update', 'download-progress', 'info-result', 'error', 'download-complete', 'library-data', 'chapter-status-update', 'operation-success', 'chapter-content', 'plugins-list', 'search-results', 'popular-results'];
        if (validChannels.includes(channel)) {
            const subscription = (event, ...args) => func(...args);
            ipcRenderer.on(channel, subscription);
            return () => {
                ipcRenderer.removeListener(channel, subscription);
            };
        }
        return () => {};
    },
    removeValidListener: (channel) => {
        ipcRenderer.removeAllListeners(channel);
    }
});
