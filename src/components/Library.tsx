import React from 'react';

const Library = ({ library, onSelect, onRemove }) => {
    if (!library || library.length === 0) {
        return (
            <div style={styles.empty}>
                <p>Your library is empty.</p>
                <p style={styles.subtext}>Go to "Search" to add novels.</p>
            </div>
        );
    }

    return (
        <div style={styles.grid}>
            {library.map((novel) => (
                <div key={novel.url} style={styles.card} onClick={() => onSelect(novel)}>
                    <div style={styles.cardHeader}>
                        <div style={styles.provider}>{novel.provider.toUpperCase()}</div>
                        <button
                            style={styles.deleteBtn}
                            onClick={(e) => { e.stopPropagation(); onRemove(novel.url); }}
                        >
                            ×
                        </button>
                    </div>
                    <div style={styles.title}>{novel.title}</div>
                    <div style={styles.stats}>
                        {novel.chapters ? Object.keys(novel.chapters).length : 0} Downloaded
                    </div>
                </div>
            ))}
        </div>
    );
};

const styles = {
    empty: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-secondary)',
    },
    subtext: {
        fontSize: '12px',
        marginTop: '8px',
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '20px',
        padding: '20px',
        overflowY: 'auto',
    },
    card: {
        background: 'rgba(30, 41, 59, 0.5)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '15px',
        cursor: 'pointer',
        transition: 'transform 0.2s, background 0.2s',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        position: 'relative',
    },
    cardHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'start',
    },
    provider: {
        fontSize: '10px',
        fontWeight: 'bold',
        color: 'var(--accent)',
        background: 'rgba(56, 189, 248, 0.1)',
        padding: '2px 6px',
        borderRadius: '4px',
    },
    deleteBtn: {
        background: 'transparent',
        border: 'none',
        color: 'var(--text-secondary)',
        fontSize: '18px',
        lineHeight: 1,
        cursor: 'pointer',
        padding: '0 5px',
    },
    title: {
        fontSize: '14px',
        fontWeight: '600',
        color: 'var(--text-primary)',
        lineHeight: '1.4',
    },
    stats: {
        fontSize: '12px',
        color: 'var(--text-secondary)',
        marginTop: 'auto',
    }
};

export default Library;
