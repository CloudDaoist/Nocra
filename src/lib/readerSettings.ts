export type ReaderSettings = {
    fontSize: number;
    lineHeight: number;
    maxWidth: number;
    fontFamily: 'sans' | 'serif' | 'mono';
    theme: 'light' | 'sepia' | 'dark' | 'black';
};

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
    fontSize: 18,
    lineHeight: 1.8,
    maxWidth: 800,
    fontFamily: 'serif',
    theme: 'dark'
};
