import React from 'react';

const StatusBar = ({ logs, isDownloading, progress, onClick }: { logs: string[], isDownloading: boolean, progress: any, onClick?: () => void }) => {
    // Get last non-debug log
    const lastMessage = logs.length > 0 ? logs[logs.length - 1] : 'Ready';

    return (
        <div style={styles.container} onClick={onClick}>
            <div style={styles.left}>
                {isDownloading && (
                    <div style={styles.spinner}></div>
                )}
                <span style={styles.message}>{lastMessage}</span>
            </div>

            {progress && (
                <div style={styles.right}>
                    <span>Downloading {progress.current} / {progress.total}</span>
                </div>
            )}
        </div>
    );
};

const styles = {
    container: {
        height: '28px',
        background: 'var(--accent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 10px',
        fontSize: '11px',
        color: 'white',
        fontWeight: '500',
        cursor: 'pointer',
        userSelect: 'none' as 'none',
    },
    left: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    spinner: {
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        border: '2px solid rgba(255,255,255,0.3)',
        borderTopColor: 'white',
        animation: 'spin 1s linear infinite',
    },
    message: {
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: '400px',
    },
    right: {
        marginLeft: 'auto',
    }
};

export default StatusBar;
