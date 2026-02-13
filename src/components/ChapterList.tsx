import React from 'react';
import { Check, BookOpen, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ChapterListProps {
    chapters: any[];
    selectedIndices: number[];
    onToggle: (index: number) => void;
    onToggleAll: () => void;
    savedNovel: any;
    onRead?: (chapter: any) => void;
    downloadingChapterNums?: Set<any>;
}

const ChapterList: React.FC<ChapterListProps> = ({ chapters, selectedIndices, onToggle, onToggleAll, savedNovel, onRead, downloadingChapterNums }) => {
    if (!chapters || chapters.length === 0) return null;

    return (
        <div className="flex flex-col h-full bg-card">
            <div className="flex items-center p-3 border-b border-border bg-muted/20">
                <label className="flex items-center gap-3 cursor-pointer select-none text-sm font-medium text-foreground">
                    <input
                        type="checkbox"
                        checked={selectedIndices.length === chapters.length && chapters.length > 0}
                        onChange={onToggleAll}
                        className="w-4 h-4 rounded border-input text-primary focus:ring-primary/20 accent-primary"
                    />
                    <span>Select All ({chapters.length})</span>
                </label>
            </div>
            <div className="flex-1 flex flex-col p-2 gap-1 overflow-y-auto">
                {chapters.map((chapter, index) => {
                    const isSelected = selectedIndices.includes(index);
                    const isDownloaded = savedNovel && savedNovel.downloads && savedNovel.downloads[chapter.num];
                    const isDownloading = downloadingChapterNums?.has(chapter.num);

                    return (
                        <div
                            key={index}
                            className={cn(
                                "flex items-center gap-3 p-3 rounded-lg border border-transparent transition-all cursor-pointer group hover:bg-muted/50",
                                isSelected ? "bg-accent/10 border-accent/20" : "",
                                isDownloaded ? "pl-2" : ""
                            )}
                            onClick={() => {
                                if (isDownloaded && onRead) {
                                    onRead(chapter);
                                } else {
                                    onToggle(index);
                                }
                            }}
                        >
                            {!isDownloaded && (
                                isDownloading ? (
                                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                                ) : (
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => { }}
                                        className="w-4 h-4 rounded border-input text-primary focus:ring-primary/20 accent-primary"
                                    />
                                )
                            )}

                            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 rounded">{chapter.num}</span>
                                    {isDownloaded && <Check size={14} className="text-green-500" />}
                                </div>
                                <span className={cn(
                                    "text-sm font-medium truncate",
                                    isDownloaded ? "text-primary" : "text-foreground"
                                )}>
                                    {chapter.title}
                                </span>
                            </div>

                            {isDownloaded && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <BookOpen size={14} />
                                </Button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ChapterList;


