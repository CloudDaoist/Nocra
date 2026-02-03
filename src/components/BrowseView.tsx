import React, { useState, useEffect, useMemo } from 'react';
import { Search, Globe, ChevronRight, Loader2, Filter, ArrowUpDown, SortAsc, SortDesc } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface BrowseViewProps {
    onSelectNovel: (url: string) => void;
}

const BrowseView: React.FC<BrowseViewProps> = ({ onSelectNovel }) => {
    const [plugins, setPlugins] = useState<any[]>([]);
    const [selectedPluginId, setSelectedPluginId] = useState<string | null>(null);
    const [novels, setNovels] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Source filtering and sorting state
    const [sourceSearch, setSourceSearch] = useState('');
    const [languageFilter, setLanguageFilter] = useState('all');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    useEffect(() => {
        console.log("BrowseView: Setting up listeners...");
        const removePopularListener = window.api.receive('popular-results', (results) => {
            console.log("BrowseView: Received popular results", results.length);
            setNovels(results);
            setLoading(false);
        });

        const removeSearchListener = window.api.receive('search-results', (results) => {
            console.log("BrowseView: Received search results", results.length);
            setNovels(results);
            setLoading(false);
        });

        const removeListener = window.api.receive('plugins-list', (data) => {
            console.log("BrowseView: Received plugins list", data.length);
            setPlugins(data);
            if (data.length > 0) {
                const defaultPlugin = data.find((p: any) => p.id === 'royalroad')?.id || data[0].id;
                setSelectedPluginId(defaultPlugin);
            }
        });

        const removeErrorListener = window.api.receive('error', (err) => {
            console.error("BrowseView Error:", err);
            setLoading(false);
        });

        window.api.send('get-plugins');

        return () => {
            console.log("BrowseView: Cleaning up listeners...");
            if (typeof removeListener === 'function') removeListener();
            if (typeof removePopularListener === 'function') removePopularListener();
            if (typeof removeSearchListener === 'function') removeSearchListener();
            if (typeof removeErrorListener === 'function') removeErrorListener();
        };
    }, []);

    const languages = useMemo(() => {
        const langs = new Set(plugins.map(p => p.lang));
        return ['all', ...Array.from(langs).sort()];
    }, [plugins]);

    const filteredPlugins = useMemo(() => {
        return plugins
            .filter(p => {
                const matchesSearch = p.name.toLowerCase().includes(sourceSearch.toLowerCase());
                const matchesLang = languageFilter === 'all' || p.lang === languageFilter;
                return matchesSearch && matchesLang;
            })
            .sort((a, b) => {
                const nameA = a.name.toLowerCase();
                const nameB = b.name.toLowerCase();
                if (sortOrder === 'asc') return nameA.localeCompare(nameB);
                return nameB.localeCompare(nameA);
            });
    }, [plugins, sourceSearch, languageFilter, sortOrder]);

    useEffect(() => {
        if (selectedPluginId) {
            fetchPopular();
        }
    }, [selectedPluginId]);

    const fetchPopular = () => {
        setLoading(true);
        setNovels([]);
        window.api.send('popular-novels', { pluginId: selectedPluginId });
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery) {
            fetchPopular();
            return;
        }
        setLoading(true);
        setNovels([]);
        window.api.send('search-novels', { query: searchQuery, pluginId: selectedPluginId });
    };

    const currentPlugin = plugins.find(p => p.id === selectedPluginId);

    return (
        <div className="flex h-full overflow-hidden">
            {/* Sources Sidebar */}
            <div className="w-72 border-r border-border flex flex-col bg-card/30">
                <div className="p-4 border-b border-border flex flex-col gap-4">
                    <h2 className="font-bold flex items-center gap-2">
                        <Globe size={18} className="text-primary" /> Sources
                    </h2>
                    
                    <div className="flex flex-col gap-2">
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                            <Input
                                value={sourceSearch}
                                onChange={(e) => setSourceSearch(e.target.value)}
                                placeholder="Search sources..."
                                className="pl-8 h-8 text-xs bg-muted/50 border-none focus-visible:ring-1 focus-visible:ring-primary"
                            />
                        </div>
                        
                        <div className="flex gap-2">
                            <Select value={languageFilter} onValueChange={setLanguageFilter}>
                                <SelectTrigger className="h-8 text-[10px] bg-muted/50 border-none flex-1">
                                    <SelectValue placeholder="Language" />
                                </SelectTrigger>
                                <SelectContent>
                                    {languages.map(lang => (
                                        <SelectItem key={lang} value={lang} className="text-[10px] uppercase">
                                            {lang === 'all' ? 'All Languages' : lang}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 bg-muted/50 hover:bg-muted"
                                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                                title={sortOrder === 'asc' ? 'Sort Z-A' : 'Sort A-Z'}
                            >
                                {sortOrder === 'asc' ? <SortAsc size={14} /> : <SortDesc size={14} />}
                            </Button>
                        </div>
                    </div>
                </div>
                
                <ScrollArea className="flex-1">
                    <div className="p-2 space-y-1">
                        {filteredPlugins.map((plugin) => (
                            <div
                                key={plugin.id}
                                className={cn(
                                    "px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors flex items-center justify-between group",
                                    selectedPluginId === plugin.id
                                        ? "bg-primary/10 text-primary font-medium"
                                        : "hover:bg-muted text-muted-foreground hover:text-foreground"
                                )}
                                onClick={() => setSelectedPluginId(plugin.id)}
                            >
                                <span className="truncate flex-1">{plugin.name}</span>
                                <span className="text-[10px] uppercase opacity-50 shrink-0 ml-2">{plugin.lang}</span>
                            </div>
                        ))}
                        {filteredPlugins.length === 0 && (
                            <div className="text-center py-10 text-xs text-muted-foreground">
                                No sources found
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </div>

            {/* Results Area */}
            <div className="flex-1 flex flex-col overflow-hidden bg-background">
                <div className="p-6 border-b border-border flex flex-col gap-4">
                    <div className="flex justify-between items-end">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">
                                {currentPlugin?.name || 'Browse'}
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                {currentPlugin?.site}
                            </p>
                        </div>
                        <form onSubmit={handleSearch} className="flex gap-2 w-full max-w-md">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                <Input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search novels..."
                                    className="pl-10 bg-muted/50 border-none focus-visible:ring-1 focus-visible:ring-primary"
                                />
                            </div>
                            <Button type="submit">Search</Button>
                        </form>
                    </div>
                </div>

                <ScrollArea className="flex-1">
                    <div className="p-6">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                <Loader2 className="animate-spin text-primary" size={40} />
                                <p className="text-muted-foreground animate-pulse">Fetching novels...</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-6">
                                {novels.map((novel, i) => (
                                    <div 
                                        key={i} 
                                        className="flex flex-col gap-3 group cursor-pointer"
                                        onClick={() => onSelectNovel(novel.url || novel.path)}
                                    >
                                        <div className="aspect-[2/3] rounded-xl bg-muted overflow-hidden relative shadow-md ring-1 ring-border/50 group-hover:ring-primary/50 transition-all group-hover:shadow-xl group-hover:-translate-y-1">
                                            {novel.cover ? (
                                                <img 
                                                    src={novel.cover} 
                                                    alt={novel.name} 
                                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-muted-foreground/20">
                                                    {novel.name.substring(0, 2).toUpperCase()}
                                                </div>
                                            )}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                                                <Button size="sm" className="w-full gap-2 h-8 text-xs">
                                                    Add to Library
                                                </Button>
                                            </div>
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-sm line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                                                {novel.name}
                                            </h3>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {!loading && novels.length === 0 && (
                            <div className="text-center py-20 text-muted-foreground">
                                No novels found. Try a different search or source.
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </div>
        </div>
    );
};

export default BrowseView;
