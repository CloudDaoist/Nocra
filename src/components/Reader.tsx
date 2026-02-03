import React, { useEffect, useState } from 'react';
import { ArrowLeft, Settings, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ReaderProps {
    novelUrl: string;
    chapter: any;
    onClose: () => void;
    onReadNext: () => void;
}

interface ReaderSettings {
    fontSize: number;
    lineHeight: number;
    maxWidth: number;
    fontFamily: string;
    theme: 'light' | 'sepia' | 'dark' | 'black';
}

const DEFAULT_SETTINGS: ReaderSettings = {
    fontSize: 18,
    lineHeight: 1.8,
    maxWidth: 800,
    fontFamily: 'serif',
    theme: 'dark'
};

const THEMES = {
    light: { bg: 'bg-white', text: 'text-gray-900', ui: 'bg-white border-gray-200' },
    sepia: { bg: 'bg-[#f4ecd8]', text: 'text-[#5b4636]', ui: 'bg-[#f4ecd8] border-[#d3c4a9]' },
    dark: { bg: 'bg-zinc-900', text: 'text-zinc-300', ui: 'bg-zinc-900 border-zinc-800' },
    black: { bg: 'bg-black', text: 'text-gray-400', ui: 'bg-black border-zinc-900' },
};

const Reader: React.FC<ReaderProps> = ({ novelUrl, chapter, onClose, onReadNext }) => {
    const [content, setContent] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [settings, setSettings] = useState<ReaderSettings>(() => {
        const saved = localStorage.getItem('reader-settings');
        return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    });
    const [showSettings, setShowSettings] = useState(false);

    useEffect(() => {
        localStorage.setItem('reader-settings', JSON.stringify(settings));
    }, [settings]);

    useEffect(() => {
        setLoading(true);
        setError(null);
        setContent(null);

        window.api.send('read-chapter', { novelUrl, chapterNum: chapter.num });

        const onContent = (data: any) => {
            if (data.chapterNum === chapter.num) {
                setContent(data);
                setLoading(false);
            }
        };

        const onError = (msg: string) => {
            if (loading) {
                setError(msg);
                setLoading(false);
            }
        };

        const removeContentListener = window.api.receive('chapter-content', onContent);
        const removeErrorListener = window.api.receive('error', onError);

        return () => {
            if (typeof removeContentListener === 'function') removeContentListener();
            if (typeof removeErrorListener === 'function') removeErrorListener();
        };
    }, [novelUrl, chapter]);

    const updateSetting = (key: keyof ReaderSettings, value: any) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const currentTheme = THEMES[settings.theme];

    return (
        <div className={cn("fixed inset-0 z-50 flex flex-col transition-colors duration-300 pt-10", currentTheme.bg)}>
            {/* Toolbar */}
            <div className={cn("h-14 flex shrink-0 items-center justify-between px-4 border-b transition-colors duration-300", currentTheme.ui, settings.theme === 'dark' || settings.theme === 'black' ? 'border-border' : 'border-gray-200')}>
                <Button variant="ghost" size="sm" onClick={onClose} className={cn("gap-2", currentTheme.text)}>
                    <ArrowLeft size={16} /> Close
                </Button>

                <div className={cn("font-medium text-sm truncate max-w-sm", currentTheme.text)}>
                    {chapter.title}
                </div>

                <div className="flex gap-2">
                    <Dialog open={showSettings} onOpenChange={setShowSettings}>
                        <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" className={cn("gap-2", currentTheme.text)}>
                                <Settings size={16} /> Config
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[400px]">
                            <DialogHeader>
                                <DialogTitle>Reading Settings</DialogTitle>
                            </DialogHeader>
                            <div className="flex flex-col gap-6 py-4">
                                {/* Theme */}
                                <div className="space-y-3">
                                    <Label>Theme</Label>
                                    <div className="flex gap-2">
                                        {(Object.keys(THEMES) as Array<keyof typeof THEMES>).map(t => (
                                            <button
                                                key={t}
                                                className={cn(
                                                    "w-12 h-12 rounded-full border-2 transition-all",
                                                    t === 'light' ? 'bg-white' : t === 'sepia' ? 'bg-[#f4ecd8]' : t === 'dark' ? 'bg-zinc-900' : 'bg-black',
                                                    settings.theme === t ? "border-primary scale-110 shadow-md" : "border-transparent opacity-70 hover:opacity-100"
                                                )}
                                                onClick={() => updateSetting('theme', t)}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <Separator />

                                {/* Font Family */}
                                <div className="space-y-3">
                                    <Label>Font Family</Label>
                                    <Tabs value={settings.fontFamily} onValueChange={(v) => updateSetting('fontFamily', v)}>
                                        <TabsList className="w-full">
                                            <TabsTrigger value="sans" className="flex-1 font-sans">Sans</TabsTrigger>
                                            <TabsTrigger value="serif" className="flex-1 font-serif">Serif</TabsTrigger>
                                            <TabsTrigger value="mono" className="flex-1 font-mono">Mono</TabsTrigger>
                                        </TabsList>
                                    </Tabs>
                                </div>

                                {/* Sizes */}
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <Label>Font Size</Label>
                                            <span>{settings.fontSize}px</span>
                                        </div>
                                        <Slider
                                            value={[settings.fontSize]}
                                            onValueChange={([v]) => updateSetting('fontSize', v)}
                                            min={12} max={32} step={1}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <Label>Line Height</Label>
                                            <span>{settings.lineHeight}</span>
                                        </div>
                                        <Slider
                                            value={[settings.lineHeight]}
                                            onValueChange={([v]) => updateSetting('lineHeight', v)}
                                            min={1} max={2.5} step={0.1}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <Label>Max Width</Label>
                                            <span>{settings.maxWidth}px</span>
                                        </div>
                                        <Slider
                                            value={[settings.maxWidth]}
                                            onValueChange={([v]) => updateSetting('maxWidth', v)}
                                            min={500} max={1400} step={50}
                                        />
                                    </div>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Button variant="ghost" size="sm" onClick={onReadNext} className={cn("gap-1", currentTheme.text)}>
                        Next <ChevronRight size={16} />
                    </Button>
                </div>
            </div>

            {/* Content Area */}
            <ScrollArea className="flex-1 w-full">
                <div
                    className={cn("mx-auto py-12 px-6 min-h-[calc(100vh-60px)] transition-all duration-300", currentTheme.text)}
                    style={{
                        maxWidth: `${settings.maxWidth}px`,
                        fontSize: `${settings.fontSize}px`,
                        lineHeight: settings.lineHeight,
                        fontFamily: settings.fontFamily === 'mono' ? 'monospace' : settings.fontFamily === 'serif' ? 'Georgia, serif' : 'system-ui, sans-serif'
                    }}
                >
                    {loading && <div className="text-center py-20 opacity-50">Loading content...</div>}
                    {error && <div className="text-center py-20 text-red-500">{error}</div>}

                    {content && content.type === 'text' && (
                        <div className="whitespace-pre-wrap">
                            {content.content}
                        </div>
                    )}

                    {content && content.type === 'html' && (
                        <div 
                            className="plugin-html-content"
                            dangerouslySetInnerHTML={{ __html: content.content }}
                        />
                    )}

                    {content && content.type === 'image' && (
                        <div className="flex flex-col gap-0 items-center">
                            {content.images.map((img: string, i: number) => (
                                <img key={i} src={img} alt={`Page ${i + 1}`} className="max-w-full h-auto" />
                            ))}
                        </div>
                    )}

                    {!loading && !error && (
                        <div className="mt-20 flex justify-center pb-20">
                            <Button onClick={onReadNext} size="lg" className="px-8 shadow-lg">
                                Next Chapter
                            </Button>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
};

export default Reader;
