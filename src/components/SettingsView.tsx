import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { DEFAULT_READER_SETTINGS, ReaderSettings } from "@/lib/readerSettings";
import { cn } from "@/lib/utils";
import {
  FolderOpen,
  RotateCcw,
  Trash2,
  Download,
  Upload,
  Database,
  Server,
  Type,
} from "lucide-react";

interface SettingsViewProps {
  library: any[];
  logs: string[];
  onClearLogs: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({
  library,
  logs,
  onClearLogs,
}) => {
  const [confirmDelete, setConfirmDelete] = useState(true);
  const [libraryViewMode, setLibraryViewMode] = useState<"grid" | "list">(
    "grid",
  );
  const [readerSettings, setReaderSettings] = useState<ReaderSettings>(
    DEFAULT_READER_SETTINGS,
  );
  const [appInfo, setAppInfo] = useState<any>(null);
  const [plugins, setPlugins] = useState<any[]>([]);

  // Download Settings
  const [downloadSettings, setDownloadSettings] = useState({
    concurrency: 1,
    delay: 500,
  });

  useEffect(() => {
    const storedConfirm = localStorage.getItem("library-confirm-delete");
    setConfirmDelete(storedConfirm !== "false");

    const storedView = localStorage.getItem("library-view-mode");
    setLibraryViewMode(storedView === "list" ? "list" : "grid");

    const savedReader = localStorage.getItem("reader-settings");
    if (savedReader) {
      try {
        setReaderSettings({
          ...DEFAULT_READER_SETTINGS,
          ...JSON.parse(savedReader),
        });
      } catch {
        setReaderSettings(DEFAULT_READER_SETTINGS);
      }
    }

    const savedDownload = localStorage.getItem("download-settings");
    if (savedDownload) {
      try {
        setDownloadSettings(JSON.parse(savedDownload));
      } catch { }
    }
  }, []);

  useEffect(() => {
    const removeInfoListener = window.api.receive("app-info", (info) => {
      setAppInfo(info);
    });
    const removePluginListener = window.api.receive("plugins-list", (data) => {
      setPlugins(data);
    });

    window.api.send("get-app-info");
    window.api.send("get-plugins");

    return () => {
      if (typeof removeInfoListener === "function") removeInfoListener();
      if (typeof removePluginListener === "function") removePluginListener();
    };
  }, []);

  const totalChapters = useMemo(() => {
    return library.reduce(
      (sum, novel) => sum + (novel?.chapters?.length || 0),
      0,
    );
  }, [library]);

  const downloadedChapters = useMemo(() => {
    return library.reduce(
      (sum, novel) => sum + Object.keys(novel?.downloads || {}).length,
      0,
    );
  }, [library]);

  const handleConfirmDeleteChange = (value: boolean) => {
    setConfirmDelete(value);
    localStorage.setItem("library-confirm-delete", value ? "true" : "false");
  };

  const handleViewModeChange = (mode: "grid" | "list") => {
    setLibraryViewMode(mode);
    localStorage.setItem("library-view-mode", mode);
  };

  const handleResetReader = () => {
    localStorage.setItem(
      "reader-settings",
      JSON.stringify(DEFAULT_READER_SETTINGS),
    );
    setReaderSettings(DEFAULT_READER_SETTINGS);
  };

  const handleOpenDownloads = () => {
    window.api.send("open-downloads-folder");
  };

  const updateDownloadSettings = (
    key: keyof typeof downloadSettings,
    value: number,
  ) => {
    const newSettings = { ...downloadSettings, [key]: value };
    setDownloadSettings(newSettings);
    localStorage.setItem("download-settings", JSON.stringify(newSettings));
  };

  const handleExportLibrary = () => window.api.send("export-library");
  const handleImportLibrary = () => window.api.send("import-library");
  const handleClearCache = () => window.api.send("clear-cache");

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      <div className="px-8 pt-8 pb-4">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your reading preferences and application data.
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-8 pb-10 grid gap-6 md:grid-cols-2 max-w-6xl">
          {/* LIBRARY */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2 text-primary">
                <Database className="w-5 h-5" />
                <CardTitle>Library</CardTitle>
              </div>
              <CardDescription>
                Manage your collection and data.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/30 border border-border/50 rounded-xl p-3 text-center">
                  <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                    Novels
                  </div>
                  <div className="text-2xl font-bold mt-1">
                    {library.length}
                  </div>
                </div>
                <div className="bg-muted/30 border border-border/50 rounded-xl p-3 text-center">
                  <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                    Chapters
                  </div>
                  <div className="text-2xl font-bold mt-1">{totalChapters}</div>
                </div>
                <div className="bg-muted/30 border border-border/50 rounded-xl p-3 text-center">
                  <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                    Downloads
                  </div>
                  <div className="text-2xl font-bold mt-1">
                    {downloadedChapters}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">Confirm deletion</div>
                    <div className="text-xs text-muted-foreground">
                      Ask before removing novels.
                    </div>
                  </div>
                  <Switch
                    checked={confirmDelete}
                    onCheckedChange={handleConfirmDeleteChange}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">Default view</div>
                    <div className="text-xs text-muted-foreground">
                      Preferred library layout.
                    </div>
                  </div>
                  <div className="flex bg-muted p-1 rounded-lg">
                    <button
                      onClick={() => handleViewModeChange("grid")}
                      className={cn(
                        "px-3 py-1 rounded-md text-xs font-medium transition-all",
                        libraryViewMode === "grid"
                          ? "bg-background shadow text-primary"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      Grid
                    </button>
                    <button
                      onClick={() => handleViewModeChange("list")}
                      className={cn(
                        "px-3 py-1 rounded-md text-xs font-medium transition-all",
                        libraryViewMode === "list"
                          ? "bg-background shadow text-primary"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      List
                    </button>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportLibrary}
                  className="w-full gap-2 h-9"
                >
                  <Upload size={14} /> Export Library
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleImportLibrary}
                  className="w-full gap-2 h-9"
                >
                  <Download size={14} /> Import Library
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* READER */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2 text-primary">
                <Type className="w-5 h-5" />
                <CardTitle>Reader</CardTitle>
              </div>
              <CardDescription>Reading experience defaults.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">Theme</div>
                  <div className="flex gap-1.5">
                    {['light', 'sepia', 'dark', 'black'].map((t) => (
                      <button
                        key={t}
                        className={cn(
                          "w-full h-8 rounded-md border text-[10px] font-medium capitalize transition-all",
                          readerSettings.theme === t ? "ring-2 ring-primary border-primary" : "border-border/50 hover:border-border",
                          t === 'light' ? 'bg-white text-black' :
                            t === 'sepia' ? 'bg-[#f4ecd8] text-[#5b4636]' :
                              t === 'dark' ? 'bg-zinc-900 text-zinc-300' :
                                'bg-black text-gray-400'
                        )}
                        onClick={() => {
                          const newSettings = { ...readerSettings, theme: t as any };
                          setReaderSettings(newSettings);
                          localStorage.setItem('reader-settings', JSON.stringify(newSettings));
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">Font</div>
                  <div className="flex gap-1.5">
                    {['sans', 'serif', 'mono'].map((f) => (
                      <button
                        key={f}
                        className={cn(
                          "w-full h-8 rounded-md border text-[10px] font-medium capitalize transition-all",
                          readerSettings.fontFamily === f ? "bg-primary text-primary-foreground border-primary" : "bg-muted/30 border-border/50 hover:bg-muted",
                        )}
                        onClick={() => {
                          const newSettings = { ...readerSettings, fontFamily: f as any };
                          setReaderSettings(newSettings);
                          localStorage.setItem('reader-settings', JSON.stringify(newSettings));
                        }}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Font Size</span>
                    <span className="font-medium bg-muted px-2 py-0.5 rounded">{readerSettings.fontSize}px</span>
                  </div>
                  <Slider
                    value={[readerSettings.fontSize]}
                    min={12} max={32} step={1}
                    onValueChange={([v]) => {
                      const newSettings = { ...readerSettings, fontSize: v };
                      setReaderSettings(newSettings);
                      localStorage.setItem('reader-settings', JSON.stringify(newSettings));
                    }}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Line Height</span>
                    <span className="font-medium bg-muted px-2 py-0.5 rounded">{readerSettings.lineHeight}</span>
                  </div>
                  <Slider
                    value={[readerSettings.lineHeight]}
                    min={1} max={2.5} step={0.1}
                    onValueChange={([v]) => {
                      const newSettings = { ...readerSettings, lineHeight: v };
                      setReaderSettings(newSettings);
                      localStorage.setItem('reader-settings', JSON.stringify(newSettings));
                    }}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Max Width</span>
                    <span className="font-medium bg-muted px-2 py-0.5 rounded">{readerSettings.maxWidth}px</span>
                  </div>
                  <Slider
                    value={[readerSettings.maxWidth]}
                    min={500} max={1400} step={50}
                    onValueChange={([v]) => {
                      const newSettings = { ...readerSettings, maxWidth: v };
                      setReaderSettings(newSettings);
                      localStorage.setItem('reader-settings', JSON.stringify(newSettings));
                    }}
                  />
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetReader}
                className="w-full gap-2 text-muted-foreground hover:text-destructive"
              >
                <RotateCcw size={14} />
                Reset to defaults
              </Button>
            </CardContent>
          </Card>

          {/* DOWNLOADS */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2 text-primary">
                <FolderOpen className="w-5 h-5" />
                <CardTitle>Downloads</CardTitle>
              </div>
              <CardDescription>Manage offline content storage.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="text-xs font-medium mb-1">Storage Location</div>
                <div className="flex gap-2">
                  <div className="flex-1 text-xs font-mono bg-muted/50 border border-border/60 rounded-md p-2.5 truncate">
                    {appInfo?.downloadsPath || "Loading..."}
                  </div>
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={handleOpenDownloads}
                    title="Open Folder"
                  >
                    <FolderOpen size={16} />
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="text-sm font-medium">Concurrency</div>
                    <div className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded">
                      {downloadSettings.concurrency}
                    </div>
                  </div>
                  <Slider
                    min={1}
                    max={5}
                    step={1}
                    value={[downloadSettings.concurrency]}
                    onValueChange={(vals) =>
                      updateDownloadSettings("concurrency", vals[0])
                    }
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Number of simultaneous downloads.{" "}
                    <span className="text-amber-500">
                      Note: Not everysite support simultaneous downloads.
                    </span>
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="text-sm font-medium">Delay</div>
                    <div className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded">
                      {downloadSettings.delay} ms
                    </div>
                  </div>
                  <Slider
                    min={0}
                    max={5000}
                    step={100}
                    value={[downloadSettings.delay]}
                    onValueChange={(vals) =>
                      updateDownloadSettings("delay", vals[0])
                    }
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Wait time between chapters to avoid IP bans.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SYSTEM */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2 text-primary">
                <Server className="w-5 h-5" />
                <CardTitle>System</CardTitle>
              </div>
              <CardDescription>
                Application health and maintenance.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Version</div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-mono">
                      {appInfo?.version || "N/A"}
                    </div>
                    <CheckForUpdatesButton />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Plugins</div>
                  <div className="text-sm font-mono">
                    {plugins.length} Loaded
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Logs</div>
                  <div className="text-sm font-mono">{logs.length} Entries</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Cache</div>
                  <Button
                    variant="link"
                    className="h-auto p-0 text-xs text-destructive"
                    onClick={handleClearCache}
                  >
                    Clear Cache
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClearLogs}
                  disabled={logs.length === 0}
                  className="gap-2 text-xs"
                >
                  <Trash2 size={14} /> Clear Application Logs
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
};

const CheckForUpdatesButton = () => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{
    available: boolean;
    version?: string;
    url?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = async () => {
    setLoading(true);
    setStatus(null);
    setError(null);
    try {
      const result = await window.api.invoke("check-for-updates");
      setStatus({
        available: result.updateAvailable,
        version: result.latestVersion,
        url: result.url,
      });
    } catch (e) {
      setError("Failed to check");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {!status && !loading && (
        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-2 text-[10px] bg-muted/50 hover:bg-muted text-muted-foreground"
          onClick={check}
        >
          Check for Updates
        </Button>
      )}

      {loading && (
        <span className="text-[10px] text-muted-foreground animate-pulse">
          Checking...
        </span>
      )}

      {error && (
        <span
          className="text-[10px] text-destructive cursor-pointer hover:underline"
          onClick={check}
          title={error}
        >
          Error (Retry)
        </span>
      )}

      {status && !status.available && (
        <span className="text-[10px] text-emerald-500 font-medium">
          Up to date
        </span>
      )}

      {status && status.available && (
        <Button
          variant="default"
          size="sm"
          className="h-5 px-2 text-[10px] bg-primary text-primary-foreground animate-pulse"
          onClick={() => window.api.send("open-external", status.url)}
        >
          Update Available (v{status.version})
        </Button>
      )}
    </div>
  );
};

export default SettingsView;
