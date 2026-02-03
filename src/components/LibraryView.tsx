import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Search, Filter, LayoutGrid, List, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface Novel {
    title: string;
    url: string;
    cover?: string;
    provider: string;
    chapters: any[];
}

interface LibraryViewProps {
    library: Novel[];
    onSelectNovel: (novel: Novel) => void;
    onAddNovel: () => void;
    onDeleteNovel: (url: string) => void;
}

const LibraryView: React.FC<LibraryViewProps> = ({ library, onSelectNovel, onAddNovel, onDeleteNovel }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    const filteredLibrary = library.filter(n => 
        (n.title?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
        (n.provider?.toLowerCase() || "").includes(searchQuery.toLowerCase())
    );

    const handleDelete = (e: React.MouseEvent, novel: Novel) => {
        e.stopPropagation();
        if (confirm(`Are you sure you want to delete "${novel.title}"?`)) {
            onDeleteNovel(novel.url);
        }
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-background">
            <div className="px-8 pt-8 pb-4 flex flex-col gap-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Library</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            {library.length} novels in your collection
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="bg-muted p-1 rounded-lg flex gap-1">
                            <button 
                                onClick={() => setViewMode('grid')}
                                className={cn("p-1.5 rounded-md transition-all", viewMode === 'grid' ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground")}
                            >
                                <LayoutGrid size={16} />
                            </button>
                            <button 
                                onClick={() => setViewMode('list')}
                                className={cn("p-1.5 rounded-md transition-all", viewMode === 'list' ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground")}
                            >
                                <List size={16} />
                            </button>
                        </div>
                        <Button onClick={onAddNovel} className="gap-2 shadow-lg shadow-primary/20">
                            <Plus size={18} />
                            Add New
                        </Button>
                    </div>
                </div>

                <div className="flex gap-4">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={16} />
                        <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search your library..."
                            className="pl-10 bg-card border-border/50 focus-visible:ring-1 focus-visible:ring-primary h-11"
                        />
                    </div>
                    <Button variant="outline" className="gap-2 border-border/50 h-11">
                        <Filter size={16} /> Filter
                    </Button>
                </div>
            </div>

            <ScrollArea className="flex-1 px-8">
                <div className="pb-10">
                    {viewMode === 'grid' ? (
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-x-6 gap-y-8">
                            {filteredLibrary.map((novel, i) => (
                                <div 
                                    key={i} 
                                    className="flex flex-col gap-3 group cursor-pointer"
                                    onClick={() => onSelectNovel(novel)}
                                >
                                    <div className="aspect-[3/4.2] rounded-xl bg-muted overflow-hidden relative shadow-md ring-1 ring-border/20 group-hover:ring-primary/30 transition-all duration-300 group-hover:shadow-xl group-hover:-translate-y-1">
                                        {novel.cover ? (
                                            <img 
                                                src={novel.cover} 
                                                alt={novel.title} 
                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-muted-foreground/10 uppercase">
                                                {(novel.title || "??").substring(0, 2)}
                                            </div>
                                        )}
                                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={(e) => handleDelete(e, novel)}
                                                className="bg-black/40 backdrop-blur-md p-1.5 rounded-lg text-white hover:bg-destructive/80 transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 pt-10 translate-y-1 group-hover:translate-y-0 transition-transform duration-300">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-bold text-white/90 bg-primary/80 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                    {novel.provider}
                                                </span>
                                                <span className="text-[10px] text-white/80 font-medium">
                                                    {novel.chapters.length} CH
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="px-1">
                                        <h3 className="font-bold text-sm line-clamp-2 leading-snug group-hover:text-primary transition-colors duration-200">
                                            {novel.title || "Unknown Title"}
                                        </h3>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {filteredLibrary.map((novel, i) => (
                                <div 
                                    key={i}
                                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/50 border border-transparent hover:border-border transition-all group cursor-pointer"
                                    onClick={() => onSelectNovel(novel)}
                                >
                                    <div className="w-12 h-16 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                                        {novel.cover && <img src={novel.cover} className="w-full h-full object-cover" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-sm truncate group-hover:text-primary transition-colors">{novel.title || "Unknown Title"}</h3>
                                        <p className="text-xs text-muted-foreground uppercase mt-0.5">{novel.provider || "Unknown"} • {(novel.chapters || []).length} Chapters</p>
                                    </div>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                        onClick={(e) => handleDelete(e, novel)}
                                    >
                                        <Trash2 size={18} />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}

                    {filteredLibrary.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-32 text-center">
                            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
                                <Search size={32} className="text-muted-foreground opacity-20" />
                            </div>
                            <h3 className="text-lg font-semibold">No novels found</h3>
                            <p className="text-sm text-muted-foreground max-w-xs mt-2">
                                Try adjusting your search query or add a new novel to your library.
                            </p>
                            <Button variant="outline" className="mt-6" onClick={() => setSearchQuery('')}>Clear Search</Button>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
};

export default LibraryView;
