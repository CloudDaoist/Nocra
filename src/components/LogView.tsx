import React, { useEffect, useRef } from 'react';
import { X, Terminal } from 'lucide-react';

interface LogViewProps {
    logs: string[];
    onClose: () => void;
}

const LogView: React.FC<LogViewProps> = ({ logs, onClose }) => {
    const logsEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when logs update
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.modal} onClick={e => e.stopPropagation()}>
                <div style={styles.header}>
                    <div style={styles.title}>
                        <Terminal size={18} />
                        <h3>Application Logs</h3>
                    </div>
                    <button style={styles.closeBtn} onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div style={styles.content}>
                    {logs.length === 0 ? (
                        <div style={styles.emptyState}>No logs available.</div>
                    ) : (
                        logs.map((log, index) => (
                            <div key={index} style={styles.logEntry}>
                                <span style={styles.lineNumber}>{(index + 1).toString().padStart(3, '0')}</span>
                                <span style={styles.logText}>{log}</span>
                            </div>
                        ))
                    )}
                    <div ref={logsEndRef} />
                </div>
            </div>
        </div>
    );
};

const styles = {
    overlay: {
        position: 'fixed' as 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: '28px', // Above status bar
        background: 'rgba(0,0,0,0.2)',
        display: 'flex',
        alignItems: 'flex-end', // Align to bottom
        justifyContent: 'center',
        zIndex: 90,
        backdropFilter: 'blur(1px)',
    },
    modal: {
        width: '100%',
        height: '300px',
        background: '#1e1e1e', // Dark theme for terminal look
        borderTop: '1px solid var(--border)',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column' as 'column',
        fontFamily: 'monospace',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 16px',
        background: '#252526',
        borderBottom: '1px solid #333',
        color: '#cccccc',
    },
    title: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '13px',
        fontWeight: 600,
    },
    closeBtn: {
        background: 'transparent',
        border: 'none',
        color: '#cccccc',
        cursor: 'pointer',
        padding: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '4px',
    },
    content: {
        flex: 1,
        overflowY: 'auto' as 'auto',
        padding: '10px',
        display: 'flex',
        flexDirection: 'column' as 'column',
        gap: '4px',
        color: '#d4d4d4',
        fontSize: '12px',
        lineHeight: '1.4',
    },
    logEntry: {
        display: 'flex',
        gap: '10px',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        wordBreak: 'break-word' as 'break-word',
    },
    lineNumber: {
        color: '#569cd6', // VS Code blueish
        minWidth: '30px',
        textAlign: 'right' as 'right',
        userSelect: 'none' as 'none',
        opacity: 0.7,
    },
    logText: {
        whiteSpace: 'pre-wrap' as 'pre-wrap',
    },
    emptyState: {
        padding: '20px',
        textAlign: 'center' as 'center',
        color: '#666',
        fontStyle: 'italic',
    }
};

export default LogView;
