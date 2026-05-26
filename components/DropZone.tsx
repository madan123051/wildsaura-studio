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
  const [sliderPosition, setSliderPosition] = useState(58);
  const inputRef = useRef<HTMLInputElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
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

  const moveSlider = useCallback((clientX: number) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const next = ((clientX - rect.left) / rect.width) * 100;
    setSliderPosition(Math.max(8, Math.min(92, next)));
  }, []);

  const onSliderPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    moveSlider(e.clientX);
  }, [moveSlider]);

  const onSliderPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons === 0) return;
    moveSlider(e.clientX);
  }, [moveSlider]);

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
      className="cinematic-upload-shell"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <input ref={inputRef} type="file" accept={ACCEPTED_EXT} multiple onChange={onInputChange}
        style={{ display: 'none' }} />
      <div className="cinematic-hero">
        <div className="cinematic-background" />
        <div className="cinematic-particles" />
        <div className="cinematic-content">
          <p className="cinematic-kicker">WILDSAURA LOOK — Cinematic Nature Color Science</p>
          <h2>Wildlife Stories, Reimagined in Motion Picture Color</h2>
          <div
            className="before-after-stage"
            ref={sliderRef}
            onPointerDown={onSliderPointerDown}
            onPointerMove={onSliderPointerMove}
          >
            <img
              className="stage-source-image"
              src="https://images.pexels.com/photos/247502/pexels-photo-247502.jpeg?auto=compress&cs=tinysrgb&w=1920&dpr=2"
              alt="Cinematic tiger in natural forest light"
              loading="lazy"
              decoding="async"
            />
            <div className="stage-before" />
            <div className="stage-after" style={{ clipPath: `inset(0 0 0 ${sliderPosition}%)` }} />
            <div className="stage-labels"><span>BEFORE</span><span>AFTER</span></div>
            <div className="stage-overlay-copy">
              <h3>WILDSAURA LOOK</h3>
              <p>Cinematic Nature Color Science</p>
              <p>Transform wildlife into cinematic storytelling.</p>
            </div>
            <div className="stage-divider" style={{ left: `${sliderPosition}%` }}>
              <div className="stage-knob" />
            </div>
          </div>
          <button
            onClick={onClick}
            className={`cinematic-upload-cta ${isDragging ? 'dragging' : ''}`}
          >
            <span className="upload-icon">⬆</span>
            <span>
              <strong>{isDragging ? 'Drop your wildlife story here' : 'Upload Your Image'}</strong>
              <small>JPEG • PNG • RAW • TIFF • WebP</small>
            </span>
          </button>
          <div className="preset-card-row">
            {[
              ['WILDSAURA LOOK', 'Cinematic Nature'],
              ['Deep Forest', 'Moody Jungle'],
              ['Savanna Gold', 'Golden Wildlife'],
              ['Arctic Silence', 'Frozen Atmosphere'],
              ['Rain Earth', 'Monsoon Mood'],
            ].map(([name, mood]) => (
              <div key={name} className="preset-mini-card">
                <b>{name}</b>
                <span>{mood}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DropZone;
