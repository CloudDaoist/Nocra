export { };

declare global {
    interface Window {
        api: {
            send: (channel: string, data?: any) => void;
            receive: (channel: string, func: (...args: any[]) => void) => () => void;
            invoke: (channel: string, data?: any) => Promise<any>;
            removeAllListeners: (channel: string) => void;
        };
    }
}

import 'react';
declare module 'react' {
    interface CSSProperties {
        WebkitAppRegion?: 'drag' | 'no-drag';
    }
}

