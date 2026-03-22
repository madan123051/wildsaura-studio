import React, { useState, useCallback, useRef } from 'react';

interface DropZoneProps {
  onFilesAdded: (files: File[]) => void;
  compact?: boolean;
}

const ACCEPTED_TYPES = [
  'image/jpeg', 'image/png', 'image/tiff', 'image/webp', 'image/bmp',
];
const ACCEPTED_EXT = '.jpg,.jpeg,.png,.tiff,.tif,.webp,.bmp';

const DropZone: React.FC<DropZoneProps> = ({ onFilesAdded, compact = false }) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const handleFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    const valid = Array.from(fileList).filter(
      (f) => ACCEPTED_TYPES.includes(f.type) || /\.(jpe?g|png|tiff?|webp|bmp)$/i.test(f.name)
    );
    if (valid.length > 0) onFilesAdded(valid);
  }, [onFilesAdded]);

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragCounter.current++;
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current <= 0) { dragCounter.current = 0; setIsDragging(false); }
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const onClick = useCallback(() => { inputRef.current?.click(); }, []);

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    if (inputRef.current) inputRef.current.value = '';
  }, [handleFiles]);

  /* ── Compact mode: small "+ Add" button ── */
  if (compact) {
    return (
      <>
        <input ref={inputRef} type="file" accept={ACCEPTED_EXT} multiple onChange={onInputChange}
          style={{ display: 'none' }} />
        <button onClick={onClick} style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '4px 10px', borderRadius: 6,
          background: 'rgba(99,102,241,0.1)',
          border: '1px solid rgba(99,102,241,0.2)',
          color: '#a78bfa', fontSize: 11, fontWeight: 600,
          cursor: 'pointer', transition: 'all 0.15s',
          whiteSpace: 'nowrap',
        }}
          onMouseEnter={e => {
            (e.target as HTMLElement).style.background = 'rgba(99,102,241,0.2)';
            (e.target as HTMLElement).style.borderColor = 'rgba(99,102,241,0.4)';
          }}
          onMouseLeave={e => {
            (e.target as HTMLElement).style.background = 'rgba(99,102,241,0.1)';
            (e.target as HTMLElement).style.borderColor = 'rgba(99,102,241,0.2)';
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add
        </button>
      </>
    );
  }

  /* ── Full mode: large drop area ── */
  return (
    <div
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onClick}
      style={{
        width: '100%', maxWidth: 520,
        padding: '48px 32px',
        borderRadius: 16,
        border: `2px dashed ${isDragging ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}`,
        background: isDragging ? 'rgba(99,102,241,0.06)' : 'rgba(255,255,255,0.02)',
        cursor: 'pointer',
        textAlign: 'center',
        transition: 'all 0.25s',
        backdropFilter: 'blur(12px)',
      }}
    >
      <input ref={inputRef} type="file" accept={ACCEPTED_EXT} multiple onChange={onInputChange}
        style={{ display: 'none' }} />

      {/* Upload Icon */}
      <div style={{
        width: 64, height: 64, borderRadius: 16, margin: '0 auto 20px',
        background: isDragging ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.25s',
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
          stroke={isDragging ? '#a78bfa' : 'rgba(255,255,255,0.3)'}
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      </div>

      <div style={{ fontSize: 15, fontWeight: 600, color: isDragging ? '#a78bfa' : 'var(--text-primary)', marginBottom: 6 }}>
        {isDragging ? 'Drop files here' : 'Drop images or click to browse'}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        JPEG · PNG · TIFF · WebP · BMP
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12, opacity: 0.6 }}>
        Batch processing supported — add multiple files
      </div>
    </div>
  );
};

export default DropZone;
