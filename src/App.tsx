import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import LibraryView from './components/LibraryView';
import BrowseView from './components/BrowseView';
import NovelDetail from './components/NovelDetail';
import Reader from './components/Reader';
import AddNovelModal from './components/AddNovelModal';
import StatusBar from './components/StatusBar';
import SettingsView from './components/SettingsView';
import LogView from './components/LogView';

function App() {
    // Navigation
    const [view, setView] = useState('library'); // 'library', 'browse', 'detail', 'reader', 'settings'

    // Data State
    const [library, setLibrary] = useState<any[]>([]);
    const [selectedNovel, setSelectedNovel] = useState<any>(null);
    const [readingChapter, setReadingChapter] = useState<any>(null);

    // UI State
    const [showAddModal, setShowAddModal] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState<any>(null);
    const [appVersion, setAppVersion] = useState<string>('');
    const [showLogView, setShowLogView] = useState(false);

    useEffect(() => {
        // Listeners
        const removeLibListener = window.api.receive('library-data', (data) => setLibrary(data));
        const removeLogListener = window.api.receive('log-update', (msg: string) => setLogs(prev => [...prev, msg].slice(-20)));
        const removeInfoListener = window.api.receive('app-info', (info: any) => setAppVersion(info.version));

        const removeOpListener = window.api.receive('operation-success', ({ type }) => {
            if (type === 'add-novel') {
                setShowAddModal(false);
            }
        });

        const removeProgressListener = window.api.receive('download-progress', (progress) => {
            setDownloadProgress(progress);
        });

        const removeCompleteListener = window.api.receive('download-complete', () => {
            setIsDownloading(false);
            setDownloadProgress(null);
        });

        const removeErrorListener = window.api.receive('error', (err) => {
            console.error("Global Error:", err);
            setLogs(prev => [...prev, `Error: ${err}`].slice(-20));
        });

        // Initial fetch
        window.api.send('get-library');
        window.api.send('get-app-info');

        return () => {
            if (typeof removeLibListener === 'function') removeLibListener();
            if (typeof removeLogListener === 'function') removeLogListener();
            if (typeof removeInfoListener === 'function') removeInfoListener();
            if (typeof removeOpListener === 'function') removeOpListener();
            if (typeof removeProgressListener === 'function') removeProgressListener();
            if (typeof removeCompleteListener === 'function') removeCompleteListener();
            if (typeof removeErrorListener === 'function') removeErrorListener();
        };
    }, []);

    const handleAddNovel = (url: string) => {
        window.api.send('add-novel', url);
        setView('library');
    };

    const handleRefreshNovel = (url: string) => {
        window.api.send('refresh-novel', url);
    };

    const handleDeleteNovel = (url: string) => {
        window.api.send('remove-novel', url);
        if (selectedNovel && selectedNovel.url === url) {
            setSelectedNovel(null);
            setView('library');
        }
    };

    const handleSelectNovel = (novel: any) => {
        setSelectedNovel(novel);
        setView('detail');
    };

    const handleDownload = (chapters: any) => {
        if (!selectedNovel) return;

        let settings = { concurrency: 1, delay: 500 };
        try {
            const saved = localStorage.getItem('download-settings');
            if (saved) settings = { ...settings, ...JSON.parse(saved) };
        } catch (e) {
            console.error("Failed to load download settings", e);
        }

        setIsDownloading(true);
        window.api.send('start-download', {
            url: selectedNovel.url,
            chapters,
            options: settings
        });
    };

    const handleRead = (chapter: any) => {
        setReadingChapter(chapter);
        setView('reader');
    };

    const handleReadNext = () => {
        if (!selectedNovel || !readingChapter) return;
        const index = selectedNovel.chapters.findIndex((c: any) => c.num === readingChapter.num);
        if (index !== -1 && index + 1 < selectedNovel.chapters.length) {
            setReadingChapter(selectedNovel.chapters[index + 1]);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden font-sans">
            <div className="flex flex-1 overflow-hidden relative">
                {/* Custom Title Bar Drag Area */}
                <div className="absolute top-0 left-0 right-0 h-12 z-[9999] pointer-events-none" style={{ WebkitAppRegion: "drag" } as React.CSSProperties}></div>

                <Sidebar activeTab={view} onTabChange={(tab: string) => setView(tab)} version={appVersion} />

                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-hidden pt-4">
                        {view === 'library' && (
                            <LibraryView
                                library={library}
                                onSelectNovel={handleSelectNovel}
                                onAddNovel={() => setShowAddModal(true)}
                                onDeleteNovel={handleDeleteNovel}
                            />
                        )}

                        {view === 'browse' && (
                            <BrowseView
                                onSelectNovel={(novelUrl) => handleAddNovel(novelUrl)}
                            />
                        )}

                        {view === 'detail' && selectedNovel && (
                            <NovelDetail
                                novel={library.find(n => n.url === selectedNovel.url) || selectedNovel}
                                onBack={() => setView('library')}
                                onDownload={handleDownload}
                                onRefresh={handleRefreshNovel}
                                onRead={handleRead}
                                onDelete={handleDeleteNovel}
                            />
                        )}

                        {view === 'settings' && (
                            <div className="h-full flex flex-col">
                                <SettingsView
                                    library={library}
                                    logs={logs}
                                    onClearLogs={() => setLogs([])}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showLogView && (
                <LogView
                    logs={logs}
                    onClose={() => setShowLogView(false)}
                />
            )}

            <StatusBar
                logs={logs}
                isDownloading={isDownloading}
                progress={downloadProgress}
                onClick={() => setShowLogView(true)}
            />

            {showAddModal && (
                <AddNovelModal
                    onClose={() => setShowAddModal(false)}
                    onAdd={handleAddNovel}
                />
            )}

            {view === 'reader' && readingChapter && (
                <Reader
                    novelUrl={selectedNovel.url}
                    chapter={readingChapter}
                    onClose={() => setView('detail')}
                    onReadNext={handleReadNext}
                />
            )}
        </div>
    );
}

export default App;
