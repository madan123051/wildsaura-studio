import React, { useState, useRef, useCallback, useEffect } from 'react';

/* ── Types ─────────────────────────────────────────────────── */

interface CropRect { x: number; y: number; width: number; height: number; }
interface CropStateInput { rect: CropRect; aspect: string; isActive: boolean; }

interface ImagePreviewProps {
  originalUrl: string;
  processedUrl: string | null;
  fileName: string;
  cropState?: CropStateInput;
  onCropChange?: (rect: CropRect) => void;
}

const ASPECT_MAP: Record<string, number | null> = {
  'free': null, '1:1': 1, '4:3': 4 / 3, '3:2': 3 / 2,
  '16:9': 16 / 9, '9:16': 9 / 16, '5:4': 5 / 4,
};

/* ── Component ─────────────────────────────────────────────── */

const ImagePreview: React.FC<ImagePreviewProps> = ({
  originalUrl, processedUrl, fileName, cropState, onCropChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const cropFrameRef = useRef<HTMLDivElement>(null);
  const cropImgRef = useRef<HTMLImageElement>(null);

  const [imageLoaded, setImageLoaded] = useState(false);
  const [cropView, setCropView] = useState({ scale: 1, panX: 0, panY: 0 });

  /* ── Before/After slider state ── */
  const [sliderPos, setSliderPos] = useState(0.5); // 0..1
  const sliderDragging = useRef(false);
  const sliderPosRef = useRef(0.5);

  const isCropping = cropState?.isActive === true;
  const hasProcessed = processedUrl !== null;

  // Keep ref in sync for native listeners
  useEffect(() => { sliderPosRef.current = sliderPos; }, [sliderPos]);

  /* ── Image load handling (robust with cache detection) ── */
  const prevUrlRef = useRef(originalUrl);
  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
  }, []);

  useEffect(() => {
    // Only reset imageLoaded when the URL actually changes (different file)
    if (prevUrlRef.current !== originalUrl) {
      prevUrlRef.current = originalUrl;
      setImageLoaded(false);
    }

    // Check if image is already cached / complete in browser
    const checkCache = () => {
      const img = imgRef.current;
      if (img && img.complete && img.naturalWidth > 0) {
        setImageLoaded(true);
      }
    };

    // Check immediately, next frame, and after a short delay for safety
    checkCache();
    const raf = requestAnimationFrame(checkCache);
    const t1 = setTimeout(checkCache, 50);
    const t2 = setTimeout(checkCache, 200);
    return () => { cancelAnimationFrame(raf); clearTimeout(t1); clearTimeout(t2); };
  }, [originalUrl]);

  /* ── Frame geometry helper ── */
  const getFrameInfo = useCallback(() => {
    const c = containerRef.current;
    const img = imgRef.current;
    if (!c || !img || !img.naturalWidth) return null;
    const cr = c.getBoundingClientRect();
    const pad = 20;
    const cW = cr.width - pad * 2;
    const cH = cr.height - pad * 2;
    const imgAR = img.naturalWidth / img.naturalHeight;
    const ar = cropState?.aspect ? ASPECT_MAP[cropState.aspect] : null;
    const fAR = ar ?? imgAR;
    let fW: number, fH: number;
    if (fAR > cW / cH) { fW = cW; fH = cW / fAR; }
    else { fH = cH; fW = cH * fAR; }
    let iW: number, iH: number;
    if (imgAR > fAR) { iH = fH; iW = fH * imgAR; }
    else { iW = fW; iH = fW / imgAR; }
    return { fW, fH, iW, iH, cW: cr.width, cH: cr.height };
  }, [cropState?.aspect]);

  const clampPan = useCallback((px: number, py: number, s: number): [number, number] => {
    const f = getFrameInfo();
    if (!f) return [px, py];
    const mx = Math.max(0, (f.iW * s - f.fW) / 2);
    const my = Math.max(0, (f.iH * s - f.fH) / 2);
    return [Math.max(-mx, Math.min(mx, px)), Math.max(-my, Math.min(my, py))];
  }, [getFrameInfo]);

  const emitCropRect = useCallback((s: number, px: number, py: number) => {
    if (!onCropChange) return;
    const f = getFrameInfo();
    if (!f) return;

    // Total size of the image at current scale
    const scaledW = f.iW * s;
    const scaledH = f.iH * s;

    // Normalized width/height of the crop frame relative to the scaled image
    const vw = f.fW / scaledW;
    const vh = f.fH / scaledH;

    // Calculate normalized X and Y
    // px/py are offsets from the center of the image
    // (scaledW - f.fW) / 2 is the offset to align the left edge of the frame with the left edge of the image
    const rx = ((scaledW - f.fW) / 2 - px) / scaledW;
    const ry = ((scaledH - f.fH) / 2 - py) / scaledH;

    onCropChange({
      x: Math.max(0, Math.min(1 - vw, rx)),
      y: Math.max(0, Math.min(1 - vh, ry)),
      width: Math.min(1, vw),
      height: Math.min(1, vh)
    });
  }, [onCropChange, getFrameInfo]);

  /* ── Ref bridges for native listeners ── */
  const fnRef = useRef({ clampPan, emitCropRect, getFrameInfo });
  useEffect(() => { fnRef.current = { clampPan, emitCropRect, getFrameInfo }; });

  /* ── Reset view on crop mode / aspect change (keep EditPanel's rect) ── */
  useEffect(() => {
    if (isCropping) {
      setCropView({ scale: 1, panX: 0, panY: 0 });
      // Emit the correct centered rect based on frame geometry (don't reset to 0,0,1,1)
      requestAnimationFrame(() => {
        fnRef.current.emitCropRect(1, 0, 0);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCropping, cropState?.aspect]);

  /* ── Ref to keep cropView in sync for native listeners ── */
  const cropViewRef = useRef(cropView);
  useEffect(() => { cropViewRef.current = cropView; }, [cropView]);

  /* ── Native crop gesture listeners (pinch + pan + wheel) ── */
  /*
   * IMPORTANT: Touch listeners are on the CONTAINER, not the crop frame.
   * When a user does a 2-finger pinch, the second finger often lands on
   * the dark overlay (a sibling of the crop frame). Events from the
   * overlay bubble to the container but NOT to the crop frame.
   * By listening on the container we catch all touches regardless of
   * which child element they start on.
   *
   * Mouse/wheel listeners stay on the crop frame for cursor styling.
   */
  useEffect(() => {
    const container = containerRef.current;
    const el = cropFrameRef.current;
    if (!container || !isCropping || !imageLoaded) return;

    // Initialize from current React state so re-attaching keeps position
    const cv = cropViewRef.current;
    const g = {
      type: null as 'pan' | 'pinch' | null,
      scale: cv.scale, panX: cv.panX, panY: cv.panY,
      sX: 0, sY: 0, sPanX: 0, sPanY: 0, sScale: 1, sDist: 0, sMidX: 0, sMidY: 0,
      mouseDown: false,
    };

    const applyTransform = () => {
      const img = cropImgRef.current;
      const f = fnRef.current.getFrameInfo();
      if (!img || !f) return;
      const w = f.iW * g.scale;
      const h = f.iH * g.scale;
      img.style.width = w + 'px';
      img.style.height = h + 'px';
      img.style.left = ((f.fW - w) / 2 + g.panX) + 'px';
      img.style.top = ((f.fH - h) / 2 + g.panY) + 'px';
    };

    const commit = () => {
      setCropView({ scale: g.scale, panX: g.panX, panY: g.panY });
      fnRef.current.emitCropRect(g.scale, g.panX, g.panY);
    };

    /* Helper: initialize pinch state from current touches */
    const initPinch = (e: TouchEvent) => {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      g.type = 'pinch';
      g.sDist = Math.sqrt(dx * dx + dy * dy) || 1;
      g.sScale = g.scale;
      g.sPanX = g.panX; g.sPanY = g.panY;
      g.sMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      g.sMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    };

    /* Touch — on CONTAINER for full coverage */
    const onTS = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.touches.length >= 2) {
        initPinch(e);
      } else if (e.touches.length === 1) {
        g.type = 'pan';
        g.sX = e.touches[0].clientX; g.sY = e.touches[0].clientY;
        g.sPanX = g.panX; g.sPanY = g.panY;
      }
    };

    const onTM = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();

      /* Auto-upgrade pan → pinch when second finger appears mid-gesture.
         This catches the case where the second finger started on a sibling
         element (dark overlay) whose touchstart didn't fire on the container
         directly, but touchmove still reports all active touches. */
      if (e.touches.length >= 2 && g.type !== 'pinch') {
        initPinch(e);
        return;
      }

      if (g.type === 'pinch' && e.touches.length >= 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const ns = Math.max(1, Math.min(5, g.sScale * (dist / g.sDist)));
        const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const [cx, cy] = fnRef.current.clampPan(
          g.sPanX + (mx - g.sMidX),
          g.sPanY + (my - g.sMidY),
          ns
        );
        g.scale = ns; g.panX = cx; g.panY = cy;
        applyTransform();
      } else if (g.type === 'pan' && e.touches.length === 1) {
        const dx = e.touches[0].clientX - g.sX;
        const dy = e.touches[0].clientY - g.sY;
        const [cx, cy] = fnRef.current.clampPan(g.sPanX + dx, g.sPanY + dy, g.scale);
        g.panX = cx; g.panY = cy;
        applyTransform();
      }
    };

    const onTE = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 0) { g.type = null; commit(); }
      else if (e.touches.length === 1) {
        g.type = 'pan';
        g.sX = e.touches[0].clientX; g.sY = e.touches[0].clientY;
        g.sPanX = g.panX; g.sPanY = g.panY;
        commit();
      }
    };

    /* Prevent Safari native gesture (pinch-to-zoom page) */
    const preventGesture = (e: Event) => { e.preventDefault(); };

    /* Mouse — on crop frame for cursor */
    const onMD = (e: MouseEvent) => {
      e.preventDefault();
      g.mouseDown = true;
      g.sX = e.clientX; g.sY = e.clientY;
      g.sPanX = g.panX; g.sPanY = g.panY;
      if (el) el.style.cursor = 'grabbing';
    };

    const onMM = (e: MouseEvent) => {
      if (!g.mouseDown) return;
      const dx = e.clientX - g.sX;
      const dy = e.clientY - g.sY;
      const [cx, cy] = fnRef.current.clampPan(g.sPanX + dx, g.sPanY + dy, g.scale);
      g.panX = cx; g.panY = cy;
      applyTransform();
    };

    const onMU = () => {
      if (g.mouseDown) { g.mouseDown = false; if (el) el.style.cursor = 'grab'; commit(); }
    };

    /* Wheel — on container */
    const onW = (e: WheelEvent) => {
      e.preventDefault();
      const ns = Math.max(1, Math.min(5, g.scale - e.deltaY * 0.003));
      const [cx, cy] = fnRef.current.clampPan(g.panX, g.panY, ns);
      g.scale = ns; g.panX = cx; g.panY = cy;
      applyTransform();
      commit();
    };

    /* Attach — touch on container, mouse/wheel on crop frame */
    container.addEventListener('touchstart', onTS, { passive: false });
    container.addEventListener('touchmove', onTM, { passive: false });
    container.addEventListener('touchend', onTE, { passive: false });
    container.addEventListener('touchcancel', onTE, { passive: false });
    container.addEventListener('wheel', onW, { passive: false });
    // Safari gesture prevention
    container.addEventListener('gesturestart', preventGesture, { passive: false } as any);
    container.addEventListener('gesturechange', preventGesture, { passive: false } as any);

    if (el) {
      el.addEventListener('mousedown', onMD);
    }
    window.addEventListener('mousemove', onMM);
    window.addEventListener('mouseup', onMU);

    return () => {
      container.removeEventListener('touchstart', onTS);
      container.removeEventListener('touchmove', onTM);
      container.removeEventListener('touchend', onTE);
      container.removeEventListener('touchcancel', onTE);
      container.removeEventListener('wheel', onW);
      container.removeEventListener('gesturestart', preventGesture as any);
      container.removeEventListener('gesturechange', preventGesture as any);
      if (el) {
        el.removeEventListener('mousedown', onMD);
      }
      window.removeEventListener('mousemove', onMM);
      window.removeEventListener('mouseup', onMU);
    };
  }, [isCropping, imageLoaded]);

  /* ── Before/After slider — ONLY activate near divider line ── */
  useEffect(() => {
    const c = containerRef.current;
    if (!c || isCropping || !hasProcessed || !imageLoaded) return;

    const THRESHOLD = 40; // px from divider to activate drag

    const getPos = (clientX: number): number => {
      const rect = c.getBoundingClientRect();
      return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    };

    const isNearDivider = (clientX: number): boolean => {
      const rect = c.getBoundingClientRect();
      const dividerX = rect.left + rect.width * sliderPosRef.current;
      return Math.abs(clientX - dividerX) <= THRESHOLD;
    };

    /* Touch: only start if single finger near divider */
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      if (!isNearDivider(e.touches[0].clientX)) return;
      e.preventDefault();
      sliderDragging.current = true;
      setSliderPos(getPos(e.touches[0].clientX));
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!sliderDragging.current) return;
      // Cancel if second finger appears (user wants to pinch-zoom)
      if (e.touches.length >= 2) { sliderDragging.current = false; return; }
      e.preventDefault();
      setSliderPos(getPos(e.touches[0].clientX));
    };

    const onTouchEnd = () => { sliderDragging.current = false; };

    /* Mouse: only start if near divider */
    const onMouseDown = (e: MouseEvent) => {
      if (!isNearDivider(e.clientX)) return;
      e.preventDefault();
      sliderDragging.current = true;
      setSliderPos(getPos(e.clientX));
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!sliderDragging.current) return;
      setSliderPos(getPos(e.clientX));
    };

    const onMouseUp = () => { sliderDragging.current = false; };

    c.addEventListener('touchstart', onTouchStart, { passive: false });
    c.addEventListener('touchmove', onTouchMove, { passive: false });
    c.addEventListener('touchend', onTouchEnd);
    c.addEventListener('touchcancel', onTouchEnd);
    c.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      c.removeEventListener('touchstart', onTouchStart);
      c.removeEventListener('touchmove', onTouchMove);
      c.removeEventListener('touchend', onTouchEnd);
      c.removeEventListener('touchcancel', onTouchEnd);
      c.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isCropping, hasProcessed, imageLoaded]);

  /* ── Computed frame info for render ── */
  const fi = imageLoaded && isCropping ? getFrameInfo() : null;

  /* ── Compute image display rect for slider clipping ── */
  const getImgRect = useCallback(() => {
    const c = containerRef.current;
    const img = imgRef.current;
    if (!c || !img || !img.naturalWidth) return null;
    const cr = c.getBoundingClientRect();
    const imgAR = img.naturalWidth / img.naturalHeight;
    const cAR = cr.width / cr.height;
    let w: number, h: number;
    if (imgAR > cAR) { w = cr.width; h = cr.width / imgAR; }
    else { h = cr.height; w = cr.height * imgAR; }
    return {
      left: (cr.width - w) / 2,
      top: (cr.height - h) / 2,
      width: w,
      height: h,
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative', width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', borderRadius: 8,
        userSelect: 'none',
        touchAction: 'none',
        background: isCropping ? '#000' : 'transparent',
        cursor: isCropping ? 'default' : 'default',
      }}
    >
      {/* ── Dimension-source image (visible when NOT cropping) ── */}
      <img
        ref={imgRef}
        src={originalUrl}
        alt=""
        draggable={false}
        onLoad={handleImageLoad}
        style={isCropping ? {
          position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none',
        } : {
          maxWidth: '100%', maxHeight: '100%', objectFit: 'contain',
          opacity: imageLoaded ? 1 : 0, transition: 'opacity 0.3s',
          pointerEvents: 'none',
          ...(hasProcessed ? {
            clipPath: `inset(0 ${(1 - sliderPos) * 100}% 0 0)`,
          } : {}),
        }}
      />

      {/* ── Processed overlay (clipped from right of slider) ── */}
      {!isCropping && processedUrl && imageLoaded && (() => {
        return (
          <img
            src={processedUrl}
            alt=""
            draggable={false}
            style={{
              position: 'absolute',
              maxWidth: '100%', maxHeight: '100%', objectFit: 'contain',
              clipPath: `inset(0 0 0 ${sliderPos * 100}%)`,
              pointerEvents: 'none',
            }}
          />
        );
      })()}

      {/* ── Slider divider line + handle ── */}
      {!isCropping && hasProcessed && imageLoaded && (() => {
        const ir = getImgRect();
        if (!ir) return null;
        const lineX = ir.left + ir.width * sliderPos;
        return (
          <>
            {/* Vertical line */}
            <div
              style={{
                position: 'absolute',
                left: lineX - 1,
                top: ir.top,
                width: 2,
                height: ir.height,
                background: '#fff',
                boxShadow: '0 0 6px rgba(0,0,0,0.5)',
                zIndex: 5,
                pointerEvents: 'none',
              }}
            />
            {/* Drag handle (circle with arrows) */}
            <div
              style={{
                position: 'absolute',
                left: lineX - 18,
                top: ir.top + ir.height / 2 - 18,
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.95)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 6,
                pointerEvents: 'none',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M6 10L2 10M2 10L5 7M2 10L5 13" stroke="#333" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M14 10L18 10M18 10L15 7M18 10L15 13" stroke="#333" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            {/* Before / After labels */}
            <div style={{
              position: 'absolute',
              left: ir.left + 8,
              top: ir.top + 8,
              padding: '3px 8px', borderRadius: 4,
              background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
              fontSize: 10, fontWeight: 600, color: '#fff',
              letterSpacing: 0.5, textTransform: 'uppercase',
              pointerEvents: 'none', zIndex: 5,
            }}>
              Before
            </div>
            <div style={{
              position: 'absolute',
              right: (containerRef.current ? containerRef.current.getBoundingClientRect().width - ir.left - ir.width : 0) + 8,
              top: ir.top + 8,
              padding: '3px 8px', borderRadius: 4,
              background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
              fontSize: 10, fontWeight: 600, color: '#fff',
              letterSpacing: 0.5, textTransform: 'uppercase',
              pointerEvents: 'none', zIndex: 5,
            }}>
              After
            </div>
          </>
        );
      })()}

      {/* CROP MODE */}
      {isCropping && fi && imageLoaded && (
        <>
          {/* Dark background — pointerEvents:none so touches pass through to container */}
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1, pointerEvents: 'none' }} />

          {/* Crop frame */}
          <div
            ref={cropFrameRef}
            style={{
              position: 'absolute',
              left: (fi.cW - fi.fW) / 2,
              top: (fi.cH - fi.fH) / 2,
              width: fi.fW,
              height: fi.fH,
              overflow: 'hidden',
              border: '1.5px solid rgba(255,255,255,0.7)',
              zIndex: 3,
              cursor: 'grab',
              touchAction: 'none',
            }}
          >
            {/* Image inside frame */}
            <img
              ref={cropImgRef}
              src={originalUrl}
              alt=""
              draggable={false}
              style={{
                position: 'absolute',
                width: fi.iW * cropView.scale,
                height: fi.iH * cropView.scale,
                left: (fi.fW - fi.iW * cropView.scale) / 2 + cropView.panX,
                top: (fi.fH - fi.iH * cropView.scale) / 2 + cropView.panY,
                pointerEvents: 'none',
              }}
            />

            {/* Rule of thirds */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}>
              {[33.33, 66.66].map(p => (
                <React.Fragment key={p}>
                  <div style={{ position: 'absolute', left: `${p}%`, top: 0, bottom: 0, width: 0.5, background: 'rgba(255,255,255,0.25)' }} />
                  <div style={{ position: 'absolute', top: `${p}%`, left: 0, right: 0, height: 0.5, background: 'rgba(255,255,255,0.25)' }} />
                </React.Fragment>
              ))}
            </div>

            {/* Corner L-marks */}
            {(['tl', 'tr', 'bl', 'br'] as const).map(c => {
              const t = c[0] === 't';
              const l = c[1] === 'l';
              return (
                <React.Fragment key={c}>
                  <div style={{
                    position: 'absolute',
                    ...(t ? { top: -1 } : { bottom: -1 }),
                    ...(l ? { left: -1 } : { right: -1 }),
                    width: 20, height: 3, background: '#fff', zIndex: 4, borderRadius: 1,
                  }} />
                  <div style={{
                    position: 'absolute',
                    ...(t ? { top: -1 } : { bottom: -1 }),
                    ...(l ? { left: -1 } : { right: -1 }),
                    width: 3, height: 20, background: '#fff', zIndex: 4, borderRadius: 1,
                  }} />
                </React.Fragment>
              );
            })}
          </div>

          {/* Zoom badge */}
          {cropView.scale > 1.01 && (
            <div style={{
              position: 'absolute', top: 12, right: 12,
              padding: '4px 10px', borderRadius: 12,
              background: 'rgba(99,102,241,0.6)', backdropFilter: 'blur(8px)',
              fontSize: 11, fontWeight: 700, color: '#fff',
              pointerEvents: 'none', zIndex: 10,
            }}>
              {cropView.scale.toFixed(1)}x
            </div>
          )}

          {/* Hint */}
          <div style={{
            position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
            padding: '6px 16px', borderRadius: 20,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
            fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.7)',
            pointerEvents: 'none', zIndex: 10,
            display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
          }}>
            Pinch to zoom - Drag to move
          </div>
        </>
      )}

      {/* ── No comparison message ── */}
      {!isCropping && !hasProcessed && imageLoaded && (
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

      {/* ── File name badge ── */}
      {!isCropping && imageLoaded && (
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
