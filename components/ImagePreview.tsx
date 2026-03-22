import React, { useState, useRef, useCallback, useEffect } from 'react';

interface ImagePreviewProps {
  originalUrl: string;
  processedUrl: string | null;
  fileName: string;
}

const ImagePreview: React.FC<ImagePreviewProps> = ({ originalUrl, processedUrl, fileName }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sliderPos, setSliderPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const updateSlider = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(pct);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateSlider(e.clientX);
  }, [updateSlider]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    updateSlider(e.clientX);
  }, [isDragging, updateSlider]);

  const onPointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    setImageLoaded(false);
  }, [originalUrl]);

  const showComparison = processedUrl !== null;

  return (
    <div
      ref={containerRef}
      onPointerDown={showComparison ? onPointerDown : undefined}
      onPointerMove={showComparison ? onPointerMove : undefined}
      onPointerUp={showComparison ? onPointerUp : undefined}
      style={{
        position: 'relative',
        width: '100%', height: '100%',
        maxWidth: '100%', maxHeight: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
        borderRadius: 8,
        cursor: showComparison ? (isDragging ? 'grabbing' : 'col-resize') : 'default',
        userSelect: 'none',
        touchAction: 'none',
      }}
    >
      {/* Original Image (full) */}
      <img
        src={originalUrl}
        alt="Original"
        draggable={false}
        onLoad={() => setImageLoaded(true)}
        style={{
          maxWidth: '100%', maxHeight: '100%',
          objectFit: 'contain',
          display: 'block',
          opacity: imageLoaded ? 1 : 0,
          transition: 'opacity 0.3s',
        }}
      />

      {/* Processed overlay (clipped by slider) */}
      {showComparison && imageLoaded && (
        <img
          src={processedUrl!}
          alt="Processed"
          draggable={false}
          style={{
            position: 'absolute',
            top: 0, left: 0,
            width: '100%', height: '100%',
            objectFit: 'contain',
            clipPath: `inset(0 ${100 - sliderPos}% 0 0)`,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Slider line + handle */}
      {showComparison && imageLoaded && (
        <>
          {/* Vertical line */}
          <div style={{
            position: 'absolute',
            top: 0, bottom: 0,
            left: `${sliderPos}%`,
            width: 2,
            background: 'rgba(255,255,255,0.6)',
            transform: 'translateX(-1px)',
            pointerEvents: 'none',
            boxShadow: '0 0 8px rgba(0,0,0,0.5)',
          }} />

          {/* Handle circle */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: `${sliderPos}%`,
            transform: 'translate(-50%, -50%)',
            width: 36, height: 36,
            borderRadius: '50%',
            background: 'rgba(15,15,26,0.7)',
            border: '2px solid rgba(255,255,255,0.6)',
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
            boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round">
              <polyline points="8 4 4 12 8 20" />
              <polyline points="16 4 20 12 16 20" />
            </svg>
          </div>
        </>
      )}

      {/* Before / After labels */}
      {showComparison && imageLoaded && (
        <>
          <div style={{
            position: 'absolute', top: 12, left: 12,
            padding: '4px 10px', borderRadius: 6,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
            fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.7)',
            letterSpacing: 0.5, textTransform: 'uppercase',
            pointerEvents: 'none',
          }}>Before</div>
          <div style={{
            position: 'absolute', top: 12, right: 12,
            padding: '4px 10px', borderRadius: 6,
            background: 'rgba(99,102,241,0.3)',
            backdropFilter: 'blur(8px)',
            fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.9)',
            letterSpacing: 0.5, textTransform: 'uppercase',
            pointerEvents: 'none',
          }}>After</div>
        </>
      )}

      {/* No processed image message */}
      {!showComparison && imageLoaded && (
        <div style={{
          position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          padding: '6px 14px', borderRadius: 8,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.08)',
          fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}>
          Select a preset or convert to see comparison
        </div>
      )}

      {/* File name badge */}
      {imageLoaded && (
        <div style={{
          position: 'absolute', bottom: 12, right: 12,
          padding: '3px 8px', borderRadius: 4,
          background: 'rgba(0,0,0,0.4)',
          fontSize: 9, color: 'rgba(255,255,255,0.4)',
          maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}>
          {fileName}
        </div>
      )}
    </div>
  );
};

export default ImagePreview;
