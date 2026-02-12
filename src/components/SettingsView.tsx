import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { DEFAULT_READER_SETTINGS, ReaderSettings } from '@/lib/readerSettings';
import { cn } from '@/lib/utils';
import { FolderOpen, RotateCcw, Trash2 } from 'lucide-react';

interface SettingsViewProps {
    library: any[];
    logs: string[];
    onClearLogs: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ library, logs, onClearLogs }) => {
    const [confirmDelete, setConfirmDelete] = useState(true);
    const [libraryViewMode, setLibraryViewMode] = useState<'grid' | 'list'>('grid');
    const [readerSettings, setReaderSettings] = useState<ReaderSettings>(DEFAULT_READER_SETTINGS);
    const [appInfo, setAppInfo] = useState<any>(null);
    const [plugins, setPlugins] = useState<any[]>([]);

    useEffect(() => {
        const storedConfirm = localStorage.getItem('library-confirm-delete');
        setConfirmDelete(storedConfirm !== 'false');

        const storedView = localStorage.getItem('library-view-mode');
        setLibraryViewMode(storedView === 'list' ? 'list' : 'grid');

        const savedReader = localStorage.getItem('reader-settings');
        if (savedReader) {
            try {
                setReaderSettings({ ...DEFAULT_READER_SETTINGS, ...JSON.parse(savedReader) });
            } catch {
                setReaderSettings(DEFAULT_READER_SETTINGS);
            }
        }
    }, []);

    useEffect(() => {
        const removeInfoListener = window.api.receive('app-info', (info) => {
            setAppInfo(info);
        });
        const removePluginListener = window.api.receive('plugins-list', (data) => {
            setPlugins(data);
        });

        window.api.send('get-app-info');
        window.api.send('get-plugins');

        return () => {
            if (typeof removeInfoListener === 'function') removeInfoListener();
            if (typeof removePluginListener === 'function') removePluginListener();
        };
    }, []);

    const totalChapters = useMemo(() => {
        return library.reduce((sum, novel) => sum + (novel?.chapters?.length || 0), 0);
    }, [library]);

    const downloadedChapters = useMemo(() => {
        return library.reduce((sum, novel) => sum + Object.keys(novel?.downloads || {}).length, 0);
    }, [library]);

    const lastUpdated = useMemo(() => {
        const dates = library
            .map((n) => n?.lastUpdated)
            .filter(Boolean)
            .map((d) => new Date(d))
            .filter((d) => !Number.isNaN(d.getTime()));
        if (dates.length === 0) return null;
        return new Date(Math.max(...dates.map((d) => d.getTime())));
    }, [library]);

    const handleConfirmDeleteChange = (value: boolean) => {
        setConfirmDelete(value);
        localStorage.setItem('library-confirm-delete', value ? 'true' : 'false');
    };

    const handleViewModeChange = (mode: 'grid' | 'list') => {
        setLibraryViewMode(mode);
        localStorage.setItem('library-view-mode', mode);
    };

    const handleResetReader = () => {
        localStorage.setItem('reader-settings', JSON.stringify(DEFAULT_READER_SETTINGS));
        setReaderSettings(DEFAULT_READER_SETTINGS);
    };

    const handleOpenDownloads = () => {
        window.api.send('open-downloads-folder');
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-background">
            <div className="px-8 pt-8 pb-4 flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-sm text-muted-foreground">
                    Tune your reading experience, storage, and library behavior.
                </p>
            </div>

            <ScrollArea className="flex-1">
                <div className="px-8 pb-10 grid gap-6 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Library</CardTitle>
                            <CardDescription>Control how your collection behaves.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-3 gap-2">
                                <div className="rounded-lg border border-border/60 p-3">
                                    <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Novels</div>
                                    <div className="text-lg font-semibold">{library.length}</div>
                                </div>
                                <div className="rounded-lg border border-border/60 p-3">
                                    <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Chapters</div>
                                    <div className="text-lg font-semibold">{totalChapters}</div>
                                </div>
                                <div className="rounded-lg border border-border/60 p-3">
                                    <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Downloaded</div>
                                    <div className="text-lg font-semibold">{downloadedChapters}</div>
                                </div>
                            </div>

                            <Separator />

                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <div className="text-sm font-medium">Confirm before delete</div>
                                    <div className="text-xs text-muted-foreground">Avoid accidental removals.</div>
                                </div>
                                <Switch checked={confirmDelete} onCheckedChange={handleConfirmDeleteChange} />
                            </div>

                            <Separator />

                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <div className="text-sm font-medium">Default view mode</div>
                                    <div className="text-xs text-muted-foreground">Applied next time you open the library.</div>
                                </div>
                                <div className="bg-muted p-1 rounded-lg flex gap-1">
                                    <button
                                        onClick={() => handleViewModeChange('grid')}
                                        className={cn(
                                            "px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                                            libraryViewMode === 'grid'
                                                ? "bg-background shadow-sm text-primary"
                                                : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        Grid
                                    </button>
                                    <button
                                        onClick={() => handleViewModeChange('list')}
                                        className={cn(
                                            "px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                                            libraryViewMode === 'list'
                                                ? "bg-background shadow-sm text-primary"
                                                : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        List
                                    </button>
                                </div>
                            </div>

                            <div className="text-xs text-muted-foreground">
                                Last updated: {lastUpdated ? lastUpdated.toLocaleString() : 'N/A'}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Reader</CardTitle>
                            <CardDescription>Your default reading layout and theme.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-2">
                                <div className="rounded-lg border border-border/60 p-3">
                                    <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Theme</div>
                                    <div className="text-sm font-semibold capitalize">{readerSettings.theme}</div>
                                </div>
                                <div className="rounded-lg border border-border/60 p-3">
                                    <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Font</div>
                                    <div className="text-sm font-semibold capitalize">{readerSettings.fontFamily}</div>
                                </div>
                                <div className="rounded-lg border border-border/60 p-3">
                                    <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Size</div>
                                    <div className="text-sm font-semibold">{readerSettings.fontSize}px</div>
                                </div>
                                <div className="rounded-lg border border-border/60 p-3">
                                    <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Line Height</div>
                                    <div className="text-sm font-semibold">{readerSettings.lineHeight}</div>
                                </div>
                            </div>

                            <Button variant="outline" onClick={handleResetReader} className="w-full gap-2">
                                <RotateCcw size={14} />
                                Reset reader defaults
                            </Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Downloads</CardTitle>
                            <CardDescription>Where your offline chapters are stored.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <div className="text-xs text-muted-foreground">Downloads location</div>
                                <div className="text-xs font-mono bg-muted/50 border border-border/60 rounded-lg p-2 break-all">
                                    {appInfo?.downloadsPath || 'Loading...'}
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                onClick={handleOpenDownloads}
                                disabled={!appInfo?.downloadsPath}
                                className="gap-2"
                            >
                                <FolderOpen size={14} />
                                Open downloads folder
                            </Button>
                            <div className="text-xs text-muted-foreground">
                                Downloaded chapters tracked: {downloadedChapters}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>System</CardTitle>
                            <CardDescription>App info and activity.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-2">
                                <div className="rounded-lg border border-border/60 p-3">
                                    <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Version</div>
                                    <div className="text-sm font-semibold">{appInfo?.version || 'N/A'}</div>
                                </div>
                                <div className="rounded-lg border border-border/60 p-3">
                                    <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Sources</div>
                                    <div className="text-sm font-semibold">{plugins.length}</div>
                                </div>
                            </div>

                            <Separator />

                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <div className="text-sm font-medium">Activity log</div>
                                    <div className="text-xs text-muted-foreground">{logs.length} entries stored</div>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={onClearLogs}
                                    disabled={logs.length === 0}
                                    className="gap-2"
                                >
                                    <Trash2 size={14} />
                                    Clear
                                </Button>
                            </div>

                            {appInfo?.userDataPath && (
                                <div className="text-[11px] text-muted-foreground">
                                    Data directory: <span className="font-mono">{appInfo.userDataPath}</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </ScrollArea>
        </div>
    );
};

export default SettingsView;
