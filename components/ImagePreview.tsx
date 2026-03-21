import React, { useState, useCallback, useRef } from 'react';

interface Props {
  originalUrl: string;
  processedUrl: string | null;
  fileName: string;
}

export const ImagePreview: React.FC<Props> = ({ originalUrl, processedUrl, fileName }) => {
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updatePos = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = Math.max(2, Math.min(98, ((clientX - rect.left) / rect.width) * 100));
    setSliderPos(pct);
  }, []);

  // ONLY the handle starts drag — NOT clicking on the image
  const onHandlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    dragging.current = true;
    // Capture pointer on the CONTAINER so we can track movement everywhere
    containerRef.current?.setPointerCapture(e.pointerId);
  }, []);

  // Container tracks movement only when dragging is active
  const onContainerPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    e.preventDefault();
    updatePos(e.clientX);
  }, [updatePos]);

  const onContainerPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    containerRef.current?.releasePointerCapture(e.pointerId);
  }, []);

  // No processed image — just show original
  if (!processedUrl) {
    return (
      <div className="liquid-glass overflow-hidden" style={{ borderRadius: '16px' }}>
        <img
          src={originalUrl}
          alt={fileName}
          className="w-full block"
          style={{ maxHeight: '55vh', objectFit: 'contain', background: '#000' }}
        />
        <div className="px-3 py-2 flex items-center gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} />
          <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Original — Select a filter &amp; tap Convert
          </span>
        </div>
      </div>
    );
  }

  // Curtain slider: both images EXACT same size
  // Drag the handle to slide — clicking image does nothing
  return (
    <div
      ref={containerRef}
      className="curtain-container"
      onPointerMove={onContainerPointerMove}
      onPointerUp={onContainerPointerUp}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '16px',
        userSelect: 'none',
        background: '#000',
        touchAction: 'pan-y',
      }}
    >
      {/* AFTER (processed) — bottom layer, full size */}
      <img
        src={processedUrl}
        alt="After"
        className="w-full block"
        style={{ maxHeight: '55vh', objectFit: 'contain' }}
        draggable={false}
      />

      {/* BEFORE (original) — top layer, clipped */}
      <img
        src={originalUrl}
        alt="Before"
        draggable={false}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          clipPath: `inset(0 ${100 - sliderPos}% 0 0)`,
          WebkitClipPath: `inset(0 ${100 - sliderPos}% 0 0)`,
          pointerEvents: 'none',
        }}
      />

      {/* Curtain divider line */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${sliderPos}%`,
          transform: 'translateX(-50%)',
          width: '2px',
          background: 'rgba(255,255,255,0.8)',
          boxShadow: '0 0 8px rgba(255,255,255,0.4)',
          zIndex: 2,
          pointerEvents: 'none',
        }}
      />

      {/* DRAG HANDLE — only this element starts drag */}
      <div
        onPointerDown={onHandlePointerDown}
        style={{
          position: 'absolute',
          top: '50%',
          left: `${sliderPos}%`,
          transform: 'translate(-50%, -50%)',
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.12)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '2px solid rgba(255,255,255,0.5)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 3,
          cursor: 'col-resize',
          touchAction: 'none',
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M9 6L4 12L9 18" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M15 6L20 12L15 18" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* BEFORE badge */}
      <div style={{
        position: 'absolute', bottom: '10px', left: '10px',
        padding: '3px 10px', borderRadius: '20px', fontSize: '9px', fontWeight: 700,
        letterSpacing: '0.8px',
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
        color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)',
        zIndex: 4, pointerEvents: 'none',
      }}>BEFORE</div>

      {/* AFTER badge */}
      <div style={{
        position: 'absolute', bottom: '10px', right: '10px',
        padding: '3px 10px', borderRadius: '20px', fontSize: '9px', fontWeight: 700,
        letterSpacing: '0.8px',
        background: 'rgba(99,102,241,0.4)', backdropFilter: 'blur(8px)',
        color: '#e0d5ff', border: '1px solid rgba(99,102,241,0.3)',
        zIndex: 4, pointerEvents: 'none',
      }}>AFTER</div>
    </div>
  );
};
