import React, { useCallback, useRef } from 'react';
import { Plus, Upload } from 'lucide-react';

interface Props {
  onFilesAdded: (files: File[]) => void;
  compact?: boolean;
}

const ACCEPT = 'image/jpeg,image/png,image/tiff,image/webp,image/bmp';

export const DropZone: React.FC<Props> = ({ onFilesAdded, compact }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    const valid = Array.from(fileList).filter(f => f.type.startsWith('image/'));
    if (valid.length > 0) onFilesAdded(valid);
  }, [onFilesAdded]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  if (compact) {
    return (
      <>
        <input ref={inputRef} type="file" accept={ACCEPT} multiple hidden onChange={(e) => handleFiles(e.target.files)} />
        <button
          onClick={() => inputRef.current?.click()}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '8px 12px', borderRadius: '10px', fontSize: '11px', fontWeight: 600,
            background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
            color: '#a78bfa', cursor: 'pointer',
          }}
        >
          <Plus size={13} /> Add
        </button>
      </>
    );
  }

  return (
    <div
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => inputRef.current?.click()}
      className="liquid-glass"
      style={{
        padding: '40px 20px',
        textAlign: 'center',
        cursor: 'pointer',
        borderRadius: '16px',
        border: '2px dashed rgba(99,102,241,0.2)',
      }}
    >
      <input ref={inputRef} type="file" accept={ACCEPT} multiple hidden onChange={(e) => handleFiles(e.target.files)} />
      <Upload size={32} style={{ margin: '0 auto 12px', color: '#6366f1', opacity: 0.6 }} />
      <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>
        Tap to add photos
      </p>
      <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
        JPEG • PNG • TIFF • WebP • Up to 61MP
      </p>
    </div>
  );
};
