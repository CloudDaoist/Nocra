import React, { useState } from 'react';
import ChapterList from './ChapterList';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, RefreshCw, Download, BookOpen, Clock, User, Share2, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NovelDetailProps {
    novel: any;
    onBack: () => void;
    onDownload: (chapters: any[]) => void;
    onRefresh: (url: string) => void;
    onRead: (chapter: any) => void;
}

const NovelDetail: React.FC<NovelDetailProps> = ({ novel, onBack, onDownload, onRefresh, onRead }) => {
    const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
    const [activeTab, setActiveTab] = useState('available'); 

    const isDownloaded = (chapterNum: any) => {
        return novel.downloads && novel.downloads[chapterNum];
    };

    const displayedChapters = activeTab === 'available'
        ? novel.chapters.filter((c: any) => !isDownloaded(c.num))
        : novel.chapters.filter((c: any) => isDownloaded(c.num));

    const toggleChapter = (index: number) => {
        setSelectedIndices(prev =>
            prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
        );
    };

    const toggleAll = () => {
        if (selectedIndices.length === displayedChapters.length) {
            setSelectedIndices([]);
        } else {
            setSelectedIndices(displayedChapters.map((_: any, i: number) => i));
        }
    };

    const handleDownloadSelected = () => {
        const chapters = selectedIndices.map(i => displayedChapters[i]);
        onDownload(chapters);
    };

    const handleReadLatest = () => {
        const downloaded = novel.chapters.filter((c: any) => isDownloaded(c.num));
        if (downloaded.length > 0) {
            onRead(downloaded[downloaded.length - 1]);
        } else {
            onRead(novel.chapters[0]);
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden bg-background relative">
            {/* Immersive Header Backdrop */}
            <div className="absolute top-0 left-0 right-0 h-[400px] overflow-hidden pointer-events-none opacity-20 blur-3xl">
                {novel.cover && (
                    <img src={novel.cover} className="w-full h-full object-cover scale-150" alt="" />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
            </div>

            <div className="flex justify-between items-center px-6 py-4 z-10">
                <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full bg-background/50 backdrop-blur-md border border-border/50">
                    <ArrowLeft size={20} />
                </Button>
                <div className="flex gap-2">
                    <Button variant="ghost" size="icon" className="rounded-full bg-background/50 backdrop-blur-md border border-border/50">
                        <Share2 size={18} />
                    </Button>
                    <Button variant="ghost" size="icon" className="rounded-full bg-background/50 backdrop-blur-md border border-border/50">
                        <MoreHorizontal size={18} />
                    </Button>
                </div>
            </div>

            <ScrollArea className="flex-1 z-10">
                <div className="px-8 pb-10">
                    {/* Novel Hero Section */}
                    <div className="flex flex-col md:flex-row gap-10 items-start pt-4">
                        <div className="w-56 shrink-0 group relative">
                            <div className="aspect-[3/4.5] rounded-2xl overflow-hidden shadow-2xl shadow-black/40 ring-1 ring-white/10 group-hover:ring-primary/40 transition-all duration-500">
                                {novel.cover ? (
                                    <img src={novel.cover} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-muted flex items-center justify-center text-6xl font-bold text-muted-foreground/10 uppercase">
                                        {novel.title.slice(0, 2)}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col gap-6 pt-2">
                            <div className="space-y-3">
                                <div className="flex flex-wrap gap-2 items-center">
                                    <span className="bg-primary/20 text-primary px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                        {novel.provider}
                                    </span>
                                    {novel.metadata?.status && (
                                        <span className="bg-emerald-500/20 text-emerald-500 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                            {novel.metadata.status}
                                        </span>
                                    )}
                                </div>
                                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-[1.1] text-foreground drop-shadow-sm">
                                    {novel.title}
                                </h1>
                                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground pt-1">
                                    <div className="flex items-center gap-2">
                                        <User size={16} className="text-primary/70" />
                                        <span className="font-medium text-foreground/80">{novel.metadata?.author || "Unknown Author"}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Clock size={16} className="text-primary/70" />
                                        <span>Updated {new Date(novel.lastUpdated || Date.now()).toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <BookOpen size={16} className="text-primary/70" />
                                        <span>{novel.chapters.length} Chapters</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-3">
                                <Button size="lg" className="h-12 px-8 gap-2 shadow-xl shadow-primary/20 rounded-xl" onClick={handleReadLatest}>
                                    <BookOpen size={20} /> Start Reading
                                </Button>
                                <Button size="lg" variant="outline" className="h-12 px-6 gap-2 rounded-xl bg-background/50 backdrop-blur-md border-border/50 hover:bg-muted" onClick={() => onRefresh(novel.url)}>
                                    <RefreshCw size={18} /> Refresh
                                </Button>
                            </div>

                            {novel.metadata?.summary && (
                                <div className="space-y-2">
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Summary</h3>
                                    <p className="text-muted-foreground leading-relaxed text-sm max-w-3xl line-clamp-4 hover:line-clamp-none transition-all cursor-pointer">
                                        {novel.metadata.summary}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    <Separator className="my-12 opacity-50" />

                    {/* Chapters Section */}
                    <div className="space-y-6">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <Tabs defaultValue="available" value={activeTab} onValueChange={(val) => { setActiveTab(val); setSelectedIndices([]); }} className="w-full md:w-auto">
                                <TabsList className="bg-muted/50 p-1 h-11 rounded-xl">
                                    <TabsTrigger value="available" className="rounded-lg px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                        Available <span className="ml-2 opacity-50 text-xs font-normal">({novel.chapters.filter((c: any) => !isDownloaded(c.num)).length})</span>
                                    </TabsTrigger>
                                    <TabsTrigger value="downloaded" className="rounded-lg px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                        Downloaded <span className="ml-2 opacity-50 text-xs font-normal">({novel.chapters.filter((c: any) => isDownloaded(c.num)).length})</span>
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>

                            <div className="flex items-center gap-3 w-full md:w-auto">
                                {selectedIndices.length > 0 && activeTab === 'available' && (
                                    <Button onClick={handleDownloadSelected} className="gap-2 h-11 px-6 rounded-xl animate-in fade-in zoom-in duration-200">
                                        <Download size={18} />
                                        Download {selectedIndices.length}
                                    </Button>
                                )}
                                <Button variant="ghost" className="text-primary hover:bg-primary/5 h-11 px-4 rounded-xl font-bold text-xs uppercase tracking-wider" onClick={toggleAll}>
                                    {selectedIndices.length === displayedChapters.length ? 'Deselect All' : 'Select All'}
                                </Button>
                            </div>
                        </div>

                        <div className="bg-card/30 backdrop-blur-sm border border-border/50 rounded-2xl overflow-hidden">
                            <ChapterList
                                chapters={displayedChapters}
                                selectedIndices={selectedIndices}
                                onToggle={toggleChapter}
                                onToggleAll={toggleAll}
                                savedNovel={novel}
                                onRead={onRead}
                            />
                        </div>
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
};

export default NovelDetail;
