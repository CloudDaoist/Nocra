import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

const AddNovelModal = ({ onClose, onAdd }) => {
    const [url, setUrl] = useState('');
    const [plugins, setPlugins] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        window.api.send('get-plugins');
        const removePluginListener = window.api.receive('plugins-list', (data) => {
            setPlugins(data);
        });
        const removeErrorListener = window.api.receive('error', (err) => {
            setIsLoading(false);
        });

        return () => {
            if (typeof removePluginListener === 'function') removePluginListener();
            if (typeof removeErrorListener === 'function') removeErrorListener();
        };
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (url && !isLoading) {
            setIsLoading(true);
            onAdd(url);
        }
    };

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <div style={styles.header}>
                    <h3>Add New Novel</h3>
                    <button style={styles.closeBtn} onClick={onClose} disabled={isLoading}>×</button>
                </div>
                <form onSubmit={handleSubmit} style={styles.form}>
                    <input
                        type="text"
                        placeholder="Paste URL here..."
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        style={styles.input}
                        autoFocus
                        disabled={isLoading}
                    />
                    
                    <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-[-10px] px-1">
                        Supported Sites Example
                    </div>
                    <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-1 border border-border/50 rounded-lg">
                        {plugins.slice(0, 20).map(p => (
                            <div key={p.id} className="text-[10px] bg-secondary/50 px-2 py-0.5 rounded border border-border/50 text-muted-foreground" title={p.site}>
                                {p.name}
                            </div>
                        ))}
                        {plugins.length > 20 && <div className="text-[10px] px-2 py-0.5">+{plugins.length - 20} more...</div>}
                    </div>

                    <div style={styles.actions}>
                        <button type="button" onClick={onClose} style={styles.cancelBtn} disabled={isLoading}>Cancel</button>
                        <button type="submit" style={styles.submitBtn} disabled={!url || isLoading}>
                            {isLoading ? (
                                <div className="flex items-center gap-2">
                                    <Loader2 className="animate-spin" size={16} />
                                    <span>Adding...</span>
                                </div>
                            ) : (
                                "Add to Library"
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const styles = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        backdropFilter: 'blur(4px)',
    },
    modal: {
        width: '400px',
        background: 'var(--bg-secondary)',
        borderRadius: '16px',
        padding: '24px',
        border: '1px solid var(--border)',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        color: 'var(--text-primary)',
    },
    closeBtn: {
        background: 'transparent',
        border: 'none',
        color: 'var(--text-secondary)',
        fontSize: '24px',
        cursor: 'pointer',
        lineHeight: 1,
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
    },
    input: {
        width: '100%',
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid var(--border)',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        fontSize: '14px',
        outline: 'none',
    },
    actions: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '10px',
    },
    cancelBtn: {
        padding: '8px 16px',
        borderRadius: '8px',
        border: 'none',
        background: 'transparent',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        fontWeight: '500',
    },
    submitBtn: {
        padding: '8px 20px',
        borderRadius: '8px',
        border: 'none',
        background: 'var(--accent)',
        color: 'white',
        cursor: 'pointer',
        fontWeight: '600',
    }
};

export default AddNovelModal;
