import React, { useState, useRef, useCallback, useEffect } from 'react';

interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CropStateInput {
  rect: CropRect;
  aspect: string;
  isActive: boolean;
}

interface ImagePreviewProps {
  originalUrl: string;
  processedUrl: string | null;
  fileName: string;
  cropState?: CropStateInput;
  onCropChange?: (rect: CropRect) => void;
}

type HandleType = 'move' | 'tl' | 'tr' | 'bl' | 'br' | 'top' | 'bottom' | 'left' | 'right';

const ASPECT_RATIOS: Record<string, number | null> = {
  'free': null,
  '1:1': 1,
  '4:3': 4 / 3,
  '3:2': 3 / 2,
  '16:9': 16 / 9,
  '9:16': 9 / 16,
  '5:4': 5 / 4,
};

const ImagePreview: React.FC<ImagePreviewProps> = ({ originalUrl, processedUrl, fileName, cropState, onCropChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [sliderPos, setSliderPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Crop drag state
  const [dragHandle, setDragHandle] = useState<HandleType | null>(null);
  const dragStartRef = useRef<{ clientX: number; clientY: number; startRect: CropRect } | null>(null);

  const getImageBounds = useCallback(() => {
    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container) return null;

    const containerRect = container.getBoundingClientRect();
    const imgNatW = img.naturalWidth;
    const imgNatH = img.naturalHeight;
    const containerW = containerRect.width;
    const containerH = containerRect.height;

    const scale = Math.min(containerW / imgNatW, containerH / imgNatH);
    const imgW = imgNatW * scale;
    const imgH = imgNatH * scale;
    const imgX = (containerW - imgW) / 2;
    const imgY = (containerH - imgH) / 2;

    return { imgX, imgY, imgW, imgH, containerRect };
  }, []);

  // Before/after slider logic
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
  const isCropping = cropState?.isActive === true;

  // Crop drag handlers
  const handleCropPointerDown = useCallback((e: React.PointerEvent, handle: HandleType) => {
    e.stopPropagation();
    e.preventDefault();
    if (!cropState || !onCropChange) return;

    setDragHandle(handle);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startRect: { ...cropState.rect },
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [cropState, onCropChange]);

  const handleCropPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragHandle || !dragStartRef.current || !cropState || !onCropChange) return;

    const bounds = getImageBounds();
    if (!bounds) return;

    const { imgW, imgH } = bounds;
    const dx = (e.clientX - dragStartRef.current.clientX) / imgW;
    const dy = (e.clientY - dragStartRef.current.clientY) / imgH;
    const s = dragStartRef.current.startRect;
    const aspectRatio = ASPECT_RATIOS[cropState.aspect];

    let newRect: CropRect = { ...s };

    if (dragHandle === 'move') {
      newRect.x = Math.max(0, Math.min(1 - s.width, s.x + dx));
      newRect.y = Math.max(0, Math.min(1 - s.height, s.y + dy));
    } else {
      // Resize from handle
      let nx = s.x, ny = s.y, nw = s.width, nh = s.height;

      if (dragHandle === 'br' || dragHandle === 'right' || dragHandle === 'bottom') {
        if (dragHandle !== 'bottom') nw = Math.max(0.05, s.width + dx);
        if (dragHandle !== 'right') nh = Math.max(0.05, s.height + dy);
        if (dragHandle === 'br') { nw = Math.max(0.05, s.width + dx); nh = Math.max(0.05, s.height + dy); }
      } else if (dragHandle === 'tl' || dragHandle === 'left' || dragHandle === 'top') {
        if (dragHandle !== 'top') { nx = s.x + dx; nw = Math.max(0.05, s.width - dx); }
        if (dragHandle !== 'left') { ny = s.y + dy; nh = Math.max(0.05, s.height - dy); }
        if (dragHandle === 'tl') { nx = s.x + dx; ny = s.y + dy; nw = Math.max(0.05, s.width - dx); nh = Math.max(0.05, s.height - dy); }
      } else if (dragHandle === 'tr') {
        nw = Math.max(0.05, s.width + dx);
        ny = s.y + dy;
        nh = Math.max(0.05, s.height - dy);
      } else if (dragHandle === 'bl') {
        nx = s.x + dx;
        nw = Math.max(0.05, s.width - dx);
        nh = Math.max(0.05, s.height + dy);
      }

      // Enforce aspect ratio
      if (aspectRatio !== null && aspectRatio !== undefined) {
        // Use width as the reference
        nh = nw / aspectRatio;
        if (dragHandle === 'tl' || dragHandle === 'top') {
          ny = s.y + s.height - nh;
        }
        if (dragHandle === 'bl') {
          // Keep top fixed
        }
        if (dragHandle === 'left') {
          ny = s.y + (s.height - nh) / 2;
        }
        if (dragHandle === 'right') {
          ny = s.y + (s.height - nh) / 2;
        }
        if (dragHandle === 'top' || dragHandle === 'bottom') {
          nw = nh * aspectRatio;
          nx = s.x + (s.width - nw) / 2;
        }
      }

      // Clamp to image bounds
      nx = Math.max(0, nx);
      ny = Math.max(0, ny);
      if (nx + nw > 1) nw = 1 - nx;
      if (ny + nh > 1) nh = 1 - ny;
      nw = Math.max(0.05, nw);
      nh = Math.max(0.05, nh);

      newRect = { x: nx, y: ny, width: nw, height: nh };
    }

    onCropChange(newRect);
  }, [dragHandle, cropState, onCropChange, getImageBounds]);

  const handleCropPointerUp = useCallback(() => {
    setDragHandle(null);
    dragStartRef.current = null;
  }, []);

  // Render crop overlay
  const renderCropOverlay = () => {
    if (!isCropping || !cropState || !imageLoaded) return null;

    const bounds = getImageBounds();
    if (!bounds) return null;

    const { imgX, imgY, imgW, imgH } = bounds;
    const r = cropState.rect;
    const cropLeft = imgX + r.x * imgW;
    const cropTop = imgY + r.y * imgH;
    const cropWidth = r.width * imgW;
    const cropHeight = r.height * imgH;

    const handleSize = 12;
    const halfHandle = handleSize / 2;

    const handleStyle = (cursor: string): React.CSSProperties => ({
      position: 'absolute',
      width: handleSize,
      height: handleSize,
      background: '#fff',
      border: '2px solid #6366f1',
      borderRadius: 2,
      cursor,
      zIndex: 12,
      touchAction: 'none',
    });

    const edgeStyle = (cursor: string, isHorizontal: boolean): React.CSSProperties => ({
      position: 'absolute',
      width: isHorizontal ? 24 : 6,
      height: isHorizontal ? 6 : 24,
      background: 'rgba(255,255,255,0.7)',
      borderRadius: 3,
      cursor,
      zIndex: 12,
      touchAction: 'none',
    });

    return (
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 10,
          pointerEvents: 'none',
        }}
        onPointerMove={handleCropPointerMove}
        onPointerUp={handleCropPointerUp}
      >
        {/* Dark overlay outside crop - using 4 divs */}
        <div style={{ position: 'absolute', left: imgX, top: imgY, width: imgW, height: r.y * imgH, background: 'rgba(0,0,0,0.55)' }} />
        <div style={{ position: 'absolute', left: imgX, top: cropTop + cropHeight, width: imgW, height: imgH - (r.y + r.height) * imgH, background: 'rgba(0,0,0,0.55)' }} />
        <div style={{ position: 'absolute', left: imgX, top: cropTop, width: r.x * imgW, height: cropHeight, background: 'rgba(0,0,0,0.55)' }} />
        <div style={{ position: 'absolute', left: cropLeft + cropWidth, top: cropTop, width: imgW - (r.x + r.width) * imgW, height: cropHeight, background: 'rgba(0,0,0,0.55)' }} />

        {/* Crop rectangle border */}
        <div
          style={{
            position: 'absolute',
            left: cropLeft,
            top: cropTop,
            width: cropWidth,
            height: cropHeight,
            border: '2px solid rgba(255,255,255,0.8)',
            boxSizing: 'border-box',
            pointerEvents: 'auto',
            cursor: 'move',
            touchAction: 'none',
          }}
          onPointerDown={(e) => handleCropPointerDown(e, 'move')}
        >
          {/* Rule of thirds grid */}
          <div style={{ position: 'absolute', left: '33.33%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.2)' }} />
          <div style={{ position: 'absolute', left: '66.66%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.2)' }} />
          <div style={{ position: 'absolute', top: '33.33%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.2)' }} />
          <div style={{ position: 'absolute', top: '66.66%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.2)' }} />
        </div>

        {/* Corner handles */}
        <div style={{ ...handleStyle('nw-resize'), left: cropLeft - halfHandle, top: cropTop - halfHandle, pointerEvents: 'auto' }}
          onPointerDown={(e) => handleCropPointerDown(e, 'tl')} />
        <div style={{ ...handleStyle('ne-resize'), left: cropLeft + cropWidth - halfHandle, top: cropTop - halfHandle, pointerEvents: 'auto' }}
          onPointerDown={(e) => handleCropPointerDown(e, 'tr')} />
        <div style={{ ...handleStyle('sw-resize'), left: cropLeft - halfHandle, top: cropTop + cropHeight - halfHandle, pointerEvents: 'auto' }}
          onPointerDown={(e) => handleCropPointerDown(e, 'bl')} />
        <div style={{ ...handleStyle('se-resize'), left: cropLeft + cropWidth - halfHandle, top: cropTop + cropHeight - halfHandle, pointerEvents: 'auto' }}
          onPointerDown={(e) => handleCropPointerDown(e, 'br')} />

        {/* Edge handles */}
        <div style={{ ...edgeStyle('n-resize', true), left: cropLeft + cropWidth / 2 - 12, top: cropTop - 3, pointerEvents: 'auto' }}
          onPointerDown={(e) => handleCropPointerDown(e, 'top')} />
        <div style={{ ...edgeStyle('s-resize', true), left: cropLeft + cropWidth / 2 - 12, top: cropTop + cropHeight - 3, pointerEvents: 'auto' }}
          onPointerDown={(e) => handleCropPointerDown(e, 'bottom')} />
        <div style={{ ...edgeStyle('w-resize', false), left: cropLeft - 3, top: cropTop + cropHeight / 2 - 12, pointerEvents: 'auto' }}
          onPointerDown={(e) => handleCropPointerDown(e, 'left')} />
        <div style={{ ...edgeStyle('e-resize', false), left: cropLeft + cropWidth - 3, top: cropTop + cropHeight / 2 - 12, pointerEvents: 'auto' }}
          onPointerDown={(e) => handleCropPointerDown(e, 'right')} />
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={showComparison && !isCropping ? onPointerDown : undefined}
      onPointerMove={showComparison && !isCropping ? onPointerMove : undefined}
      onPointerUp={showComparison && !isCropping ? onPointerUp : undefined}
      style={{
        position: 'relative',
        width: '100%', height: '100%',
        maxWidth: '100%', maxHeight: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
        borderRadius: 8,
        cursor: isCropping ? 'default' : showComparison ? (isDragging ? 'grabbing' : 'col-resize') : 'default',
        userSelect: 'none',
        touchAction: 'none',
      }}
    >
      {/* Original Image (full) */}
      <img
        ref={imgRef}
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

      {/* Processed overlay (clipped by slider) - hidden during crop */}
      {showComparison && imageLoaded && !isCropping && (
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

      {/* Slider line + handle - hidden during crop */}
      {showComparison && imageLoaded && !isCropping && (
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

      {/* Crop overlay */}
      {renderCropOverlay()}

      {/* Before / After labels - hidden during crop */}
      {showComparison && imageLoaded && !isCropping && (
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

      {/* Crop mode label */}
      {isCropping && imageLoaded && (
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          padding: '4px 12px', borderRadius: 6,
          background: 'rgba(99,102,241,0.4)',
          backdropFilter: 'blur(8px)',
          fontSize: 10, fontWeight: 600, color: '#fff',
          letterSpacing: 0.5, textTransform: 'uppercase',
          pointerEvents: 'none',
          zIndex: 15,
        }}>✂️ Crop Mode</div>
      )}

      {/* No processed image message - hidden during crop */}
      {!showComparison && imageLoaded && !isCropping && (
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
      {imageLoaded && !isCropping && (
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
