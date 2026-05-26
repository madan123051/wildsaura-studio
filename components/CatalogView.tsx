import React, { useState, useCallback, useRef, useMemo } from 'react';

interface FileItem {
  id: string;
  file: File;
  name: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  originalSize: number;
  width?: number;
  height?: number;
  thumbnailUrl?: string;
  convertedBlob?: Blob;
  convertedSize?: number;
  error?: string;
}

interface CatalogViewProps {
  files: FileItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onFilesAdded: (files: File[]) => void;
  onSwitchToEdit: () => void;
}

type ViewMode = 'grid' | 'list';
type SortKey = 'name' | 'size' | 'status';

const ACCEPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/tiff', 'image/bmp', 'image/x-canon-cr2', 'image/x-canon-cr3', 'image/x-nikon-nef', 'image/x-sony-arw', 'image/x-adobe-dng', 'image/x-fuji-raf'];

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function statusColor(status: FileItem['status']): string {
  switch (status) {
    case 'pending':
      return '#3b82f6';
    case 'processing':
      return '#f59e0b';
    case 'done':
      return '#22c55e';
    case 'error':
      return '#ef4444';
    default:
      return '#888';
  }
}

function statusLabel(status: FileItem['status']): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'processing':
      return 'Processing';
    case 'done':
      return 'Done';
    case 'error':
      return 'Error';
    default:
      return status;
  }
}

const STATUS_ORDER: Record<string, number> = { processing: 0, pending: 1, error: 2, done: 3 };

// ─── Main Component ─────────────────────────────────────────────────────────

const CatalogView: React.FC<CatalogViewProps> = ({
  files,
  selectedId,
  onSelect,
  onRemove,
  onFilesAdded,
  onSwitchToEdit,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const sortedFiles = useMemo(() => {
    const sorted = [...files];
    switch (sortKey) {
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'size':
        sorted.sort((a, b) => b.originalSize - a.originalSize);
        break;
      case 'status':
        sorted.sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9));
        break;
    }
    return sorted;
  }, [files, sortKey]);

  const selectedFile = useMemo(
    () => files.find((f) => f.id === selectedId) || null,
    [files, selectedId]
  );

  // ── Drag & Drop ───────────────────────────────────────────

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDraggingOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDraggingOver(false);

      const droppedFiles = Array.from(e.dataTransfer.files).filter((f) =>
        ACCEPT_TYPES.includes(f.type) || /\.(jpe?g|png|tiff?|webp|bmp|cr2|cr3|nef|arw|dng|raf)$/i.test(f.name)
      );
      if (droppedFiles.length > 0) {
        onFilesAdded(droppedFiles);
      }
    },
    [onFilesAdded]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(e.target.files || []).filter((f) =>
        ACCEPT_TYPES.includes(f.type) || /\.(jpe?g|png|tiff?|webp|bmp|cr2|cr3|nef|arw|dng|raf)$/i.test(f.name)
      );
      if (selected.length > 0) {
        onFilesAdded(selected);
      }
      e.target.value = '';
    },
    [onFilesAdded]
  );

  // ── Batch selection ───────────────────────────────────────

  const toggleSelect = useCallback((id: string, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(files.map((f) => f.id)));
  }, [files]);

  const removeSelected = useCallback(() => {
    selectedIds.forEach((id) => onRemove(id));
    setSelectedIds(new Set());
  }, [selectedIds, onRemove]);

  // ── File input (hidden) ───────────────────────────────────

  const hiddenInput = (
    <input
      ref={fileInputRef}
      type="file"
      multiple
      accept={ACCEPT_TYPES.join(',')}
      style={{ display: 'none' }}
      onChange={handleFileInputChange}
    />
  );

  // ── Empty state ───────────────────────────────────────────

  if (files.length === 0) {
    return (
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isDraggingOver
            ? 'rgba(99,102,241,0.06)'
            : 'var(--bg-primary, #0f0f1a)',
          transition: 'background 0.2s',
        }}
      >
        {hiddenInput}
        <div
          onClick={() => fileInputRef.current?.click()}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
            padding: '60px 40px',
            border: `2px dashed ${isDraggingOver ? '#6366f1' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 16,
            cursor: 'pointer',
            transition: 'all 0.3s',
            maxWidth: 400,
          }}
        >
          {/* Cloud upload icon */}
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 16V8M12 8L9 11M12 8L15 11"
              stroke={isDraggingOver ? '#6366f1' : 'rgba(255,255,255,0.2)'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M20 16.7428C21.2215 15.734 22 14.2195 22 12.5C22 9.46243 19.5376 7 16.5 7C16.2815 7 16.0771 6.886 15.9661 6.69774C14.6621 4.48484 12.2544 3 9.5 3C5.35786 3 2 6.35786 2 10.5C2 12.5661 2.83545 14.4371 4.18695 15.7935"
              stroke={isDraggingOver ? '#6366f1' : 'rgba(255,255,255,0.2)'}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: isDraggingOver ? '#a78bfa' : 'rgba(255,255,255,0.5)',
                marginBottom: 6,
              }}
            >
              {isDraggingOver ? 'Drop images here' : 'Drop images here or click to import'}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
              JPEG, PNG, WebP, TIFF, BMP
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Grid card ─────────────────────────────────────────────

  const renderGridCard = (file: FileItem) => {
    const isSelected = file.id === selectedId;
    const isHovered = hoveredId === file.id;
    const isBatchSelected = selectedIds.has(file.id);

    return (
      <div
        key={file.id}
        onClick={(e) => {
          if (e.ctrlKey || e.metaKey) {
            toggleSelect(file.id, e);
          } else {
            onSelect(file.id);
          }
        }}
        onDoubleClick={() => {
          onSelect(file.id);
          onSwitchToEdit();
        }}
        onMouseEnter={() => setHoveredId(file.id)}
        onMouseLeave={() => setHoveredId(null)}
        style={{
          position: 'relative',
          borderRadius: 8,
          overflow: 'hidden',
          cursor: 'pointer',
          border: isSelected
            ? '2px solid #6366f1'
            : isBatchSelected
            ? '2px solid rgba(99,102,241,0.5)'
            : '2px solid transparent',
          background: 'var(--bg-panel, #1a1a2e)',
          transition: 'all 0.2s',
          transform: isHovered ? 'scale(1.02)' : 'scale(1)',
          boxShadow: isHovered
            ? '0 6px 24px rgba(0,0,0,0.5)'
            : '0 2px 8px rgba(0,0,0,0.25)',
        }}
      >
        {/* Thumbnail */}
        <div style={{ position: 'relative', paddingBottom: '70%', overflow: 'hidden' }}>
          {file.thumbnailUrl ? (
          <img
            src={file.thumbnailUrl}
            alt={file.name}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
          ) : (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 10 }}>No Preview</div>
          )}

          {/* Selected checkmark */}
          {isSelected && (
            <div
              style={{
                position: 'absolute',
                top: 6,
                left: 6,
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: '#6366f1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}

          {/* Status badge */}
          <div
            style={{
              position: 'absolute',
              bottom: 6,
              right: 6,
              padding: '2px 7px',
              borderRadius: 10,
              background: `${statusColor(file.status)}22`,
              border: `1px solid ${statusColor(file.status)}44`,
              color: statusColor(file.status),
              fontSize: 9,
              fontWeight: 600,
              animation: file.status === 'processing' ? 'pulse 1.5s ease-in-out infinite' : 'none',
            }}
          >
            {statusLabel(file.status)}
          </div>

          {/* Remove button on hover */}
          {isHovered && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                onRemove(file.id);
              }}
              style={{
                position: 'absolute',
                top: 6,
                right: 6,
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: 'rgba(0,0,0,0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239,68,68,0.8)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(0,0,0,0.6)';
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M6 6L18 18M6 18L18 6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
          )}

          {/* Hover overlay info */}
          {isHovered && (
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '20px 8px 6px',
                background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.7)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {file.name}
              </div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
                {file.width ?? 0}×{file.height ?? 0} · {formatBytes(file.originalSize)}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── List row ──────────────────────────────────────────────

  const renderListRow = (file: FileItem) => {
    const isSelected = file.id === selectedId;
    const isHovered = hoveredId === file.id;

    return (
      <div
        key={file.id}
        onClick={() => onSelect(file.id)}
        onDoubleClick={() => {
          onSelect(file.id);
          onSwitchToEdit();
        }}
        onMouseEnter={() => setHoveredId(file.id)}
        onMouseLeave={() => setHoveredId(null)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '6px 12px',
          cursor: 'pointer',
          background: isSelected
            ? 'rgba(99,102,241,0.1)'
            : isHovered
            ? 'rgba(255,255,255,0.02)'
            : 'transparent',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          transition: 'background 0.15s',
        }}
      >
        {/* Small thumbnail */}
        {file.thumbnailUrl ? (
        <img
          src={file.thumbnailUrl}
          alt={file.name}
          style={{
            width: 40,
            height: 30,
            objectFit: 'cover',
            borderRadius: 4,
            flexShrink: 0,
          }}
        />
        ) : (
        <div style={{ width: 40, height: 30, borderRadius: 4, flexShrink: 0, background: 'rgba(255,255,255,0.04)' }} />
        )}
        {/* Filename */}
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 12,
            color: '#f0f0f5',
          }}
        >
          {file.name}
        </div>
        {/* Dimensions */}
        <div
          style={{
            width: 90,
            fontSize: 11,
            color: 'rgba(255,255,255,0.4)',
            textAlign: 'right',
            flexShrink: 0,
          }}
        >
          {file.width ?? 0}×{file.height ?? 0}
        </div>
        {/* Size */}
        <div
          style={{
            width: 65,
            fontSize: 11,
            color: 'rgba(255,255,255,0.4)',
            textAlign: 'right',
            flexShrink: 0,
          }}
        >
          {formatBytes(file.originalSize)}
        </div>
        {/* Status */}
        <div
          style={{
            width: 70,
            flexShrink: 0,
            textAlign: 'center',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              padding: '2px 8px',
              borderRadius: 10,
              background: `${statusColor(file.status)}15`,
              border: `1px solid ${statusColor(file.status)}30`,
              color: statusColor(file.status),
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            {statusLabel(file.status)}
          </span>
        </div>
        {/* Actions */}
        <div style={{ width: 30, flexShrink: 0, textAlign: 'center' }}>
          {isHovered && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                onRemove(file.id);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 22,
                height: 22,
                borderRadius: '50%',
                cursor: 'pointer',
                background: 'rgba(255,255,255,0.05)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239,68,68,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M6 6L18 18M6 18L18 6" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Main layout ───────────────────────────────────────────

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-primary, #0f0f1a)',
        color: 'var(--text-primary, #f0f0f5)',
        position: 'relative',
      }}
    >
      {hiddenInput}

      {/* Drag overlay */}
      {isDraggingOver && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 50,
            background: 'rgba(99,102,241,0.08)',
            border: '3px dashed #6366f1',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 16V8M12 8L9 11M12 8L15 11"
                stroke="#6366f1"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M20 16.7428C21.2215 15.734 22 14.2195 22 12.5C22 9.46243 19.5376 7 16.5 7C16.2815 7 16.0771 6.886 15.9661 6.69774C14.6621 4.48484 12.2544 3 9.5 3C5.35786 3 2 6.35786 2 10.5C2 12.5661 2.83545 14.4371 4.18695 15.7935"
                stroke="#6366f1"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#a78bfa', marginTop: 8 }}>
              Drop images to import
            </div>
          </div>
        </div>
      )}

      {/* ── Top toolbar ──────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}
      >
        {/* Title */}
        <span style={{ fontSize: 14, fontWeight: 700, marginRight: 'auto' }}>
          Library
        </span>

        {/* File count */}
        <span
          style={{
            fontSize: 10,
            padding: '2px 8px',
            borderRadius: 10,
            background: 'rgba(99,102,241,0.15)',
            color: '#a78bfa',
            fontWeight: 600,
          }}
        >
          {files.length} file{files.length !== 1 ? 's' : ''}
        </span>

        {/* Sort dropdown */}
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 4,
            color: 'rgba(255,255,255,0.6)',
            fontSize: 11,
            padding: '3px 6px',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="name">Name</option>
          <option value="size">Size</option>
          <option value="status">Status</option>
        </select>

        {/* View toggle */}
        <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.04)', borderRadius: 4, padding: 2 }}>
          {/* Grid icon */}
          <button
            onClick={() => setViewMode('grid')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 26,
              height: 24,
              borderRadius: 3,
              border: 'none',
              cursor: 'pointer',
              background: viewMode === 'grid' ? 'rgba(99,102,241,0.25)' : 'transparent',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="7" height="7" rx="1.5" stroke={viewMode === 'grid' ? '#a78bfa' : 'rgba(255,255,255,0.35)'} strokeWidth="2" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" stroke={viewMode === 'grid' ? '#a78bfa' : 'rgba(255,255,255,0.35)'} strokeWidth="2" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" stroke={viewMode === 'grid' ? '#a78bfa' : 'rgba(255,255,255,0.35)'} strokeWidth="2" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" stroke={viewMode === 'grid' ? '#a78bfa' : 'rgba(255,255,255,0.35)'} strokeWidth="2" />
            </svg>
          </button>
          {/* List icon */}
          <button
            onClick={() => setViewMode('list')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 26,
              height: 24,
              borderRadius: 3,
              border: 'none',
              cursor: 'pointer',
              background: viewMode === 'list' ? 'rgba(99,102,241,0.25)' : 'transparent',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M4 6H20M4 12H20M4 18H20" stroke={viewMode === 'list' ? '#a78bfa' : 'rgba(255,255,255,0.35)'} strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Import button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '5px 12px',
            borderRadius: 6,
            border: 'none',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: '#fff',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M12 4V16M12 4L8 8M12 4L16 8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 17V19C4 20.1 4.9 21 6 21H18C19.1 21 20 20.1 20 19V17" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Import
        </button>
      </div>

      {/* ── Content area ─────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.06) transparent',
        }}
      >
        {viewMode === 'grid' ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 10,
              padding: 12,
            }}
          >
            {sortedFiles.map(renderGridCard)}
          </div>
        ) : (
          <div>
            {/* List header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '6px 12px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                fontSize: 10,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.3)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              <div style={{ width: 40, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>Name</div>
              <div style={{ width: 90, textAlign: 'right', flexShrink: 0 }}>Dimensions</div>
              <div style={{ width: 65, textAlign: 'right', flexShrink: 0 }}>Size</div>
              <div style={{ width: 70, textAlign: 'center', flexShrink: 0 }}>Status</div>
              <div style={{ width: 30, flexShrink: 0 }} />
            </div>
            {sortedFiles.map(renderListRow)}
          </div>
        )}
      </div>

      {/* ── Bottom bar ───────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
          fontSize: 11,
        }}
      >
        {/* Selected file info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.4)' }}>
          {selectedFile ? (
            <>
              <span style={{ color: '#f0f0f5', fontWeight: 500 }}>
                {selectedFile.name}
              </span>
              <span>
                {selectedFile.width ?? 0}×{selectedFile.height ?? 0}
              </span>
              <span>{formatBytes(selectedFile.originalSize)}</span>
            </>
          ) : (
            <span>No file selected</span>
          )}
        </div>

        {/* Batch actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={selectAll}
            style={{
              padding: '3px 10px',
              borderRadius: 4,
              border: '1px solid rgba(255,255,255,0.06)',
              background: 'transparent',
              color: 'rgba(255,255,255,0.4)',
              fontSize: 10,
              cursor: 'pointer',
            }}
          >
            Select All
          </button>
          {selectedIds.size > 0 && (
            <button
              onClick={removeSelected}
              style={{
                padding: '3px 10px',
                borderRadius: 4,
                border: '1px solid rgba(239,68,68,0.15)',
                background: 'transparent',
                color: 'rgba(239,68,68,0.6)',
                fontSize: 10,
                cursor: 'pointer',
              }}
            >
              Remove ({selectedIds.size})
            </button>
          )}
          {selectedId && (
            <button
              onClick={onSwitchToEdit}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 10px',
                borderRadius: 4,
                border: 'none',
                background: 'rgba(99,102,241,0.15)',
                color: '#a78bfa',
                fontSize: 10,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Edit Selected
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                <path d="M5 12H19M19 12L13 6M19 12L13 18" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CatalogView;
