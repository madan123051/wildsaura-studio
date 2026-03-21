import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Download, Trash2, Settings, ChevronDown, ChevronUp, RotateCcw, Plus } from 'lucide-react';
import { ImageFile, ActiveLUT, ConversionSettings, LUTPreset, CubeLUT } from './types';
import { LUT_PRESETS } from './utils/lutData';
import {
  loadImage,
  processImageToCanvas,
  canvasToWebPBlob,
  generatePreview,
} from './utils/imageProcessor';
import { DropZone } from './components/DropZone';
import { LUTPanel } from './components/LUTPanel';
import { ImagePreview } from './components/ImagePreview';
import { ConversionSettingsPanel } from './components/ConversionSettings';
import { FileList } from './components/FileList';
import './styles.css';

declare const JSZip: any;

const App: React.FC<{}> = () => {
  const [files, setFiles] = useState<ImageFile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeLut, setActiveLut] = useState<ActiveLUT>(null);
  const [intensity, setIntensity] = useState(0.75);
  const [settings, setSettings] = useState<ConversionSettings>({
    quality: 82,
    lossless: false,
    resizeTo4K: false,
    preserveMetadata: true,
    autoConvert: false,
    smartNaming: true,
  });
  const [previewOriginal, setPreviewOriginal] = useState<string | null>(null);
  const [previewProcessed, setPreviewProcessed] = useState<string | null>(null);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [showSettings, setShowSettings] = useState(true);
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const previewTimerRef = useRef<number | null>(null);

  const prevLutRef = useRef<ActiveLUT>(null);
  const prevIntensityRef = useRef<number>(0.75);

  const selectedFile = files.find(f => f.id === selectedId) || null;

  const getActivePreset = useCallback((): LUTPreset | null => {
    if (activeLut?.type === 'preset') {
      return LUT_PRESETS.find(p => p.id === activeLut.presetId) || null;
    }
    return null;
  }, [activeLut]);

  const getActiveCube = useCallback((): CubeLUT | null => {
    if (activeLut?.type === 'cube') return activeLut.lut;
    return null;
  }, [activeLut]);

  // When LUT or intensity changes, reset all files to pending for re-processing
  useEffect(() => {
    const lutChanged = activeLut !== prevLutRef.current;
    const intensityChanged = intensity !== prevIntensityRef.current;
    prevLutRef.current = activeLut;
    prevIntensityRef.current = intensity;
    if ((lutChanged || intensityChanged) && files.length > 0) {
      setFiles(prev => prev.map(f => ({
        ...f, status: 'pending' as const,
        processedUrl: null, processedBlob: null, sizeAfter: null,
      })));
    }
  }, [activeLut, intensity]);

  // Update preview
  useEffect(() => {
    if (!selectedFile) {
      setPreviewOriginal(null);
      setPreviewProcessed(null);
      return;
    }
    setPreviewOriginal(selectedFile.originalUrl);
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    const preset = getActivePreset();
    const cube = getActiveCube();
    if (!preset && !cube) {
      setPreviewProcessed(null);
      return;
    }
    previewTimerRef.current = window.setTimeout(async () => {
      let img = imageCache.current.get(selectedFile.id);
      if (!img) {
        img = await loadImage(selectedFile.file);
        imageCache.current.set(selectedFile.id, img);
      }
      const url = generatePreview(img, preset, cube, intensity);
      setPreviewProcessed(url);
    }, 150);
    return () => { if (previewTimerRef.current) clearTimeout(previewTimerRef.current); };
  }, [selectedId, activeLut, intensity, files, getActivePreset, getActiveCube, selectedFile]);

  // Add files
  const handleFilesAdded = useCallback(async (newFiles: File[]) => {
    const imageFiles: ImageFile[] = [];
    for (const file of newFiles) {
      const id = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const url = URL.createObjectURL(file);
      const img = await loadImage(file);
      imageCache.current.set(id, img);
      imageFiles.push({
        id, file, name: file.name, originalUrl: url,
        processedUrl: null, processedBlob: null,
        width: img.naturalWidth, height: img.naturalHeight,
        status: 'pending', sizeBefore: file.size, sizeAfter: null,
      });
    }
    setFiles(prev => [...prev, ...imageFiles]);
    if (!selectedId && imageFiles.length > 0) setSelectedId(imageFiles[0].id);
  }, [selectedId]);

  // Process single file
  const processFile = useCallback(async (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file) return;
    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'processing' } : f));
    try {
      let img = imageCache.current.get(fileId);
      if (!img) { img = await loadImage(file.file); imageCache.current.set(fileId, img); }
      const preset = getActivePreset();
      const cube = getActiveCube();
      const canvas = processImageToCanvas(img, preset, cube, intensity, settings.resizeTo4K);
      const blob = await canvasToWebPBlob(canvas, settings.quality / 100, settings.lossless, file.sizeBefore);
      const processedUrl = URL.createObjectURL(blob);
      setFiles(prev => prev.map(f => f.id === fileId ? {
        ...f, status: 'done', processedUrl, processedBlob: blob, sizeAfter: blob.size,
      } : f));
    } catch (err) {
      console.error('Processing failed:', err);
      setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'error' } : f));
    }
  }, [files, getActivePreset, getActiveCube, intensity, settings]);

  // Process all pending files
  const processAll = useCallback(async () => {
    setIsProcessingAll(true);
    const preset = getActivePreset();
    const cube = getActiveCube();
    for (const file of files) {
      if (file.status === 'done') continue;
      setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'processing' } : f));
      try {
        let img = imageCache.current.get(file.id);
        if (!img) { img = await loadImage(file.file); imageCache.current.set(file.id, img); }
        const canvas = processImageToCanvas(img, preset, cube, intensity, settings.resizeTo4K);
        const blob = await canvasToWebPBlob(canvas, settings.quality / 100, settings.lossless, file.sizeBefore);
        const processedUrl = URL.createObjectURL(blob);
        setFiles(prev => prev.map(f => f.id === file.id ? {
          ...f, status: 'done', processedUrl, processedBlob: blob, sizeAfter: blob.size,
        } : f));
      } catch (err) {
        console.error('Processing failed for', file.name, err);
        setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'error' } : f));
      }
    }
    setIsProcessingAll(false);
  }, [files, getActivePreset, getActiveCube, intensity, settings]);

  // Auto-convert
  useEffect(() => {
    if (settings.autoConvert && files.some(f => f.status === 'pending') && !isProcessingAll) {
      processAll();
    }
  }, [files, settings.autoConvert, isProcessingAll, processAll]);

  // ═══ RESET — keep files but clear all processed data ═══
  const resetAll = useCallback(() => {
    setFiles(prev => prev.map(f => {
      if (f.processedUrl) URL.revokeObjectURL(f.processedUrl);
      return {
        ...f,
        status: 'pending' as const,
        processedUrl: null,
        processedBlob: null,
        sizeAfter: null,
      };
    }));
    setPreviewProcessed(null);
  }, []);

  // Downloads
  const downloadSingle = useCallback((file: ImageFile) => {
    if (!file.processedBlob) return;
    const baseName = file.name.replace(/\.[^.]+$/, '');
    const lutName = activeLut?.type === 'preset'
      ? LUT_PRESETS.find(p => p.id === activeLut.presetId)?.name.replace(/\s/g, '') || 'Graded'
      : activeLut?.type === 'cube' ? activeLut.name.replace(/\.[^.]+$/, '').replace(/\s/g, '') : 'Converted';
    const fileName = settings.smartNaming ? `${baseName}_WildSaura_${lutName}.webp` : `${baseName}.webp`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file.processedBlob);
    a.download = fileName;
    a.click();
  }, [activeLut, settings.smartNaming]);

  const downloadAllZip = useCallback(async () => {
    const doneFiles = files.filter(f => f.status === 'done' && f.processedBlob);
    if (doneFiles.length === 0) return;
    const zip = new JSZip();
    const lutName = activeLut?.type === 'preset'
      ? LUT_PRESETS.find(p => p.id === activeLut.presetId)?.name.replace(/\s/g, '') || 'Graded'
      : activeLut?.type === 'cube' ? activeLut.name.replace(/\.[^.]+$/, '').replace(/\s/g, '') : 'Converted';
    for (const file of doneFiles) {
      const baseName = file.name.replace(/\.[^.]+$/, '');
      const fileName = settings.smartNaming ? `${baseName}_WildSaura_${lutName}.webp` : `${baseName}.webp`;
      zip.file(fileName, file.processedBlob!);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `WildSaura_${lutName}_${doneFiles.length}files.zip`;
    a.click();
  }, [files, activeLut, settings.smartNaming]);

  // Clear all
  const clearAll = useCallback(() => {
    files.forEach(f => { URL.revokeObjectURL(f.originalUrl); if (f.processedUrl) URL.revokeObjectURL(f.processedUrl); });
    imageCache.current.clear();
    setFiles([]); setSelectedId(null); setPreviewOriginal(null); setPreviewProcessed(null);
  }, [files]);

  const removeFile = useCallback((id: string) => {
    const file = files.find(f => f.id === id);
    if (file) { URL.revokeObjectURL(file.originalUrl); if (file.processedUrl) URL.revokeObjectURL(file.processedUrl); imageCache.current.delete(id); }
    setFiles(prev => prev.filter(f => f.id !== id));
    if (selectedId === id) setSelectedId(files.find(f => f.id !== id)?.id || null);
  }, [files, selectedId]);

  const doneCount = files.filter(f => f.status === 'done').length;
  const pendingCount = files.filter(f => f.status === 'pending').length;
  const totalBefore = files.reduce((s, f) => s + f.sizeBefore, 0);
  const totalAfter = files.filter(f => f.sizeAfter !== null).reduce((s, f) => s + (f.sizeAfter || 0), 0);

  return (
    <div className="min-h-screen" style={{ background: '#08080c', color: '#e5e5e5' }}>
      {/* ═══ Header — compact mobile ═══ */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', position: 'relative', overflow: 'hidden' }}>
        <img src="./assets/logo-banner-text.jpg" alt="" className="header-banner" />
        <div className="flex items-center gap-2.5" style={{ position: 'relative', zIndex: 1 }}>
          <img
            src="./assets/logo-w-icon.jpg"
            alt=""
            style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.1)' }}
          />
          <div>
            <h1 className="text-sm font-semibold tracking-tight">
              <span className="text-white">Wild</span><span className="brand-gradient">Saura</span>
            </h1>
            <p className="text-[8px] tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.2)' }}>Pro Studio</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5" style={{ position: 'relative', zIndex: 1 }}>
          {doneCount > 0 && (
            <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>
              ✓ {doneCount}
            </span>
          )}
        </div>
      </div>

      {/* ═══ Main Content — mobile-first max-width ═══ */}
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '12px 12px 100px 12px' }} className="space-y-3">

        {/* Image Preview or Drop Zone */}
        {files.length === 0 ? (
          <DropZone onFilesAdded={handleFilesAdded} />
        ) : (
          <>
            {/* Preview */}
            {selectedFile && previewOriginal && (
              <ImagePreview
                originalUrl={previewOriginal}
                processedUrl={previewProcessed}
                fileName={selectedFile.name}
              />
            )}

            {/* ═══ LUT Filter Strip ═══ */}
            <LUTPanel
              activeLut={activeLut}
              intensity={intensity}
              previewUrl={previewOriginal}
              onSelectPreset={(preset) => {
                if (preset) setActiveLut({ type: 'preset', presetId: preset.id });
                else setActiveLut(null);
              }}
              onLoadCube={(lut, name) => setActiveLut({ type: 'cube', lut, name })}
              onClearLut={() => setActiveLut(null)}
              onIntensityChange={setIntensity}
            />

            {/* ═══ Files Section ═══ */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold tracking-wider uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Files ({files.length})
                </span>
                {totalAfter > 0 && (
                  <span className="text-[10px] font-medium" style={{ color: totalAfter <= totalBefore ? '#22c55e' : '#f59e0b' }}>
                    {totalAfter <= totalBefore
                      ? `${((1 - totalAfter / totalBefore) * 100).toFixed(0)}% saved`
                      : `+${(((totalAfter / totalBefore) - 1) * 100).toFixed(0)}% — try Resize to 4K`}
                  </span>
                )}
              </div>
              <FileList
                files={files}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onRemove={removeFile}
                onDownloadSingle={downloadSingle}
              />
            </div>

            {/* ═══ SETTINGS — Quality always visible ═══ */}
            <div className="liquid-glass overflow-hidden">
              {/* Quality Slider — ALWAYS VISIBLE */}
              <div className="px-4 pt-3 pb-2">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <Settings size={13} style={{ color: '#a78bfa' }} />
                    <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>WebP Quality</span>
                  </div>
                  <span className="text-sm font-bold brand-gradient">{settings.quality}%</span>
                </div>
                <input
                  type="range"
                  min={30}
                  max={100}
                  value={settings.quality}
                  onChange={e => setSettings(s => ({ ...s, quality: parseInt(e.target.value) }))}
                  className="w-full"
                />
                <div className="flex justify-between mt-1">
                  <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.2)' }}>Small file</span>
                  <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.2)' }}>Best quality</span>
                </div>
              </div>

              {/* Quick Toggles — ALWAYS VISIBLE */}
              <div className="px-4 pb-2 flex flex-wrap gap-2">
                {[
                  { key: 'resizeTo4K' as const, label: '4K Resize', icon: '📐' },
                  { key: 'lossless' as const, label: 'Lossless', icon: '💎' },
                  { key: 'smartNaming' as const, label: 'Smart Name', icon: '🏷️' },
                  { key: 'preserveMetadata' as const, label: 'Keep EXIF', icon: '📷' },
                  { key: 'autoConvert' as const, label: 'Auto', icon: '⚡' },
                ].map(item => (
                  <button
                    key={item.key}
                    onClick={() => setSettings(s => ({ ...s, [item.key]: !s[item.key] }))}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '8px',
                      fontSize: '10px',
                      fontWeight: 600,
                      background: settings[item.key]
                        ? 'rgba(99,102,241,0.15)'
                        : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${settings[item.key]
                        ? 'rgba(99,102,241,0.3)'
                        : 'rgba(255,255,255,0.06)'}`,
                      color: settings[item.key]
                        ? '#a78bfa'
                        : 'rgba(255,255,255,0.3)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {item.icon} {item.label}
                  </button>
                ))}
              </div>

              {/* Size optimization info */}
              <div className="px-4 pb-3">
                <div className="text-[9px] p-2 rounded-lg" style={{
                  background: 'rgba(99,102,241,0.05)',
                  border: '1px solid rgba(99,102,241,0.1)',
                  color: 'rgba(255,255,255,0.35)',
                }}>
                  💡 Auto-optimizes: reduces quality if WebP &gt; original, falls back to JPEG if needed.
                  {!settings.resizeTo4K && ' Enable "4K Resize" for smaller files.'}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ═══ Fixed Bottom Action Bar — mobile-friendly ═══ */}
      {files.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '10px 12px',
          paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
          background: 'rgba(8,8,12,0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          zIndex: 50,
        }}>
          <div style={{ maxWidth: '480px', margin: '0 auto' }}>
            {/* Row 1: Convert button (if pending) */}
            {pendingCount > 0 && (
              <button
                onClick={processAll}
                disabled={isProcessingAll}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  background: isProcessingAll
                    ? 'rgba(99,102,241,0.12)'
                    : 'linear-gradient(135deg, #6366f1, #a855f7)',
                  border: 'none',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  cursor: isProcessingAll ? 'not-allowed' : 'pointer',
                  marginBottom: '8px',
                  opacity: isProcessingAll ? 0.6 : 1,
                }}
              >
                {isProcessingAll
                  ? `⏳ Converting...`
                  : `🎬 Convert to WebP (${pendingCount})`}
              </button>
            )}

            {/* Row 2: Action buttons — all always visible */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Add More */}
              <DropZone onFilesAdded={handleFilesAdded} compact />

              {/* Reset — re-convert with different settings */}
              <button
                onClick={resetAll}
                disabled={doneCount === 0}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  padding: '8px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: 600,
                  background: doneCount > 0 ? 'rgba(251,191,36,0.1)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${doneCount > 0 ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.06)'}`,
                  color: doneCount > 0 ? '#fbbf24' : 'rgba(255,255,255,0.2)',
                  cursor: doneCount > 0 ? 'pointer' : 'default',
                  opacity: doneCount > 0 ? 1 : 0.5,
                }}
              >
                <RotateCcw size={12} /> Reset
              </button>

              {/* Clear All */}
              <button
                onClick={clearAll}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  padding: '8px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: 600,
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)',
                  color: '#f87171', cursor: 'pointer',
                }}
              >
                <Trash2 size={12} /> Clear
              </button>

              {/* Spacer */}
              <div style={{ flex: 1 }} />

              {/* Download Zip — always visible */}
              <button
                onClick={downloadAllZip}
                disabled={doneCount === 0}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '8px 14px', borderRadius: '10px', fontSize: '11px', fontWeight: 700,
                  opacity: doneCount > 0 ? 1 : 0.4,
                  cursor: doneCount > 0 ? 'pointer' : 'default',
                  background: doneCount > 0 ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${doneCount > 0 ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)'}`,
                  color: doneCount > 0 ? '#22c55e' : 'rgba(255,255,255,0.2)',
                }}
              >
                <Download size={14} /> Zip {doneCount > 0 ? `(${doneCount})` : ''}
              </button>
            </div>

            {/* Stats line */}
            {totalAfter > 0 && (
              <div style={{
                textAlign: 'center', paddingTop: '6px',
                fontSize: '9px', color: 'rgba(255,255,255,0.3)',
              }}>
                {(totalBefore / (1024 * 1024)).toFixed(1)} MB →{' '}
                <span style={{ color: totalAfter <= totalBefore ? '#22c55e' : '#f59e0b' }}>
                  {(totalAfter / (1024 * 1024)).toFixed(1)} MB
                </span>
                {totalAfter <= totalBefore && ` (${((1 - totalAfter / totalBefore) * 100).toFixed(0)}% saved)`}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

createRoot(document.getElementById('root')!).render(<App />);
