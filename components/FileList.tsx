import React from 'react';
import { Download, Trash2, Loader, CheckCircle, AlertCircle } from 'lucide-react';
import { ImageFile } from '../types';

interface Props {
  files: ImageFile[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onDownloadSingle: (file: ImageFile) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export const FileList: React.FC<Props> = ({ files, selectedId, onSelect, onRemove, onDownloadSingle }) => {
  if (files.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {files.map(file => {
        const isSelected = file.id === selectedId;
        const saved = file.sizeAfter !== null ? ((1 - file.sizeAfter / file.sizeBefore) * 100) : null;
        const bigger = saved !== null && saved < 0;

        return (
          <div
            key={file.id}
            className={`file-card ${isSelected ? 'selected' : ''}`}
            onClick={() => onSelect(file.id)}
          >
            {/* Thumbnail */}
            <img
              src={file.originalUrl}
              alt=""
              className="w-11 h-11 rounded-lg object-cover flex-shrink-0"
              style={{ border: '1px solid rgba(255,255,255,0.06)' }}
            />

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-white truncate">{file.name}</div>
              <div className="text-[10px] flex items-center gap-1.5 mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                <span>{file.width}×{file.height}</span>
                <span>•</span>
                <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>{formatSize(file.sizeBefore)}</span>
              </div>
              {/* Size comparison after conversion */}
              {file.sizeAfter !== null && (
                <div className="text-[10px] flex items-center gap-1 mt-0.5">
                  <span style={{ color: 'rgba(255,255,255,0.25)' }}>→</span>
                  <span className="font-bold" style={{ color: bigger ? '#f59e0b' : '#22c55e' }}>
                    {formatSize(file.sizeAfter)}
                  </span>
                  <span style={{ 
                    fontSize: '9px', fontWeight: 700,
                    padding: '1px 4px', borderRadius: '4px',
                    background: bigger ? 'rgba(245,158,11,0.1)' : 'rgba(34,197,94,0.1)',
                    color: bigger ? '#f59e0b' : '#22c55e',
                  }}>
                    {bigger ? `+${Math.abs(saved!).toFixed(0)}%` : `-${saved!.toFixed(0)}%`}
                  </span>
                </div>
              )}
            </div>

            {/* Status / Actions */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {file.status === 'pending' && (
                <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ 
                  background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)' 
                }}>
                  Ready
                </span>
              )}
              {file.status === 'processing' && (
                <Loader size={16} className="animate-spin" style={{ color: '#a78bfa' }} />
              )}
              {file.status === 'done' && (
                <button
                  onClick={e => { e.stopPropagation(); onDownloadSingle(file); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '3px',
                    padding: '4px 10px', borderRadius: '8px', fontSize: '10px', fontWeight: 700,
                    background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.2)',
                    color: '#22c55e', cursor: 'pointer',
                  }}
                >
                  <Download size={12} /> Save
                </button>
              )}
              {file.status === 'error' && (
                <AlertCircle size={14} style={{ color: '#ef4444' }} />
              )}
              <button
                onClick={e => { e.stopPropagation(); onRemove(file.id); }}
                className="p-1 rounded-md"
                title="Remove"
                style={{ color: 'rgba(255,255,255,0.2)' }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
