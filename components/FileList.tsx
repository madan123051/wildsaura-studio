import React from 'react';

export interface FileItem {
  id: string;
  file: File;
  name: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  originalSize: number;
  convertedSize?: number;
  convertedBlob?: Blob;
  convertedName?: string;
  convertedFormat?: 'webp' | 'jpeg' | 'png';
  width?: number;
  height?: number;
  thumbnailUrl?: string;
  error?: string;
}

interface FileListProps {
  files: FileItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onDownloadSingle: (file: FileItem) => void;
}

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
};

const StatusDot: React.FC<{ status: FileItem['status'] }> = ({ status }) => {
  if (status === 'processing') {
    return (
      <div className="animate-spin" style={{
        width: 14, height: 14, borderRadius: '50%',
        border: '2px solid transparent',
        borderTopColor: 'var(--accent)',
        borderRightColor: 'var(--accent)',
        flexShrink: 0,
      }} />
    );
  }

  const colors: Record<string, string> = {
    pending: 'rgba(255,255,255,0.2)',
    done: 'var(--success)',
    error: 'var(--error)',
  };

  const icons: Record<string, React.ReactNode> = {
    done: (
      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
    error: (
      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    ),
  };

  return (
    <div style={{
      width: 14, height: 14, borderRadius: '50%',
      background: colors[status] || colors.pending,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      {icons[status] || null}
    </div>
  );
};

const FileList: React.FC<FileListProps> = ({ files, selectedId, onSelect, onRemove, onDownloadSingle }) => {
  if (files.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>No files added yet</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {files.map((f) => {
        const isSelected = f.id === selectedId;
        const savings = f.convertedSize != null
          ? Math.round((1 - f.convertedSize / f.originalSize) * 100)
          : null;

        return (
          <div
            key={f.id}
            className={`file-card${isSelected ? ' selected' : ''}`}
            onClick={() => onSelect(f.id)}
          >
            {/* Thumbnail */}
            <div style={{
              width: 36, height: 36, borderRadius: 6, overflow: 'hidden',
              background: 'rgba(255,255,255,0.05)', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {f.thumbnailUrl ? (
                <img src={f.thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              )}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 11, fontWeight: 600, color: 'var(--text-primary)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {f.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                  {formatSize(f.originalSize)}
                </span>
                {f.width && f.height && (
                  <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                    {f.width}×{f.height}
                  </span>
                )}
                {savings !== null && savings > 0 && (
                  <span style={{ fontSize: 9, color: 'var(--success)', fontWeight: 600 }}>
                    −{savings}%
                  </span>
                )}
              </div>
            </div>

            {/* Status + Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <StatusDot status={f.status} />

              {/* Download button (done files) */}
              {f.status === 'done' && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDownloadSingle(f); }}
                  title="Download"
                  style={{
                    width: 22, height: 22, borderRadius: 5,
                    background: 'rgba(34,197,94,0.1)',
                    border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(34,197,94,0.2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(34,197,94,0.1)')}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </button>
              )}

              {/* Remove button */}
              <button
                className="remove-btn"
                onClick={(e) => { e.stopPropagation(); onRemove(f.id); }}
                title="Remove"
                style={{
                  width: 22, height: 22, borderRadius: 5,
                  background: 'transparent',
                  border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export { formatSize };
export default FileList;
