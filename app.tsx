import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider, useToast } from './components/Toast';
import { saveConversion, getUserStats } from './lib/database';
import { uploadThumbnail } from './lib/storage';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import DropZone from './components/DropZone';
import FileList, { formatSize } from './components/FileList';
import type { FileItem } from './components/FileList';
import ImagePreview from './components/ImagePreview';
import LUTPanel from './components/LUTPanel';
import type { LUTPreset } from './components/LUTPanel';
import EditPanel from './components/EditPanel';
import PresetsPanel from './components/PresetsPanel';
import CatalogView from './components/CatalogView';
import { DEFAULT_ADJUSTMENTS, DEFAULT_HSL_STATE } from './types';
import type { EditAdjustments, HSLState } from './types';
import * as editing from './utils/imageEditing';
import { BUILT_IN_PRESETS } from './utils/presetData';
import { applyLUT } from './utils/imageProcessor';
import { BUILT_IN_LUTS } from './utils/lutData';
import './styles.css';

declare const JSZip: any;

// ─── Local type (previously imported from ConversionSettings) ─────
interface ConversionSettingsData {
  quality: number;
  resize4k: boolean;
  lossless: boolean;
  smartName: boolean;
  keepExif: boolean;
  autoConvert: boolean;
}

// ─── Helpers ──────────────────────────────────────────────

const generateId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const createThumbnailUrl = (file: File): Promise<string> =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });

// ─── User Menu Component ──────────────────────────────────

const UserMenu: React.FC<{
  user: any;
  onSignOut: () => void;
  onNavigate: (tab: string) => void;
}> = ({ user, onSignOut, onNavigate }) => {
  const [open, setOpen] = useState(false);

  if (!user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Guest</span>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 8,
          background: open ? 'rgba(255,255,255,0.06)' : 'transparent',
          border: '1px solid transparent',
          cursor: 'pointer', transition: 'all 0.15s',
          color: 'var(--text-secondary)',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = 'transparent'; }}
      >
        {user.photoURL ? (
          <img src={user.photoURL} alt="" style={{ width: 22, height: 22, borderRadius: '50%' }} />
        ) : (
          <div style={{
            width: 22, height: 22, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent), var(--accent-secondary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700, color: '#fff',
          }}>
            {(user.displayName || user.email || '?')[0].toUpperCase()}
          </div>
        )}
        <span style={{ fontSize: 11, fontWeight: 500, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.displayName || user.email?.split('@')[0] || 'User'}
        </span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 199 }}
            onClick={() => setOpen(false)}
          />
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 4,
            width: 180, padding: 4, borderRadius: 10,
            background: 'var(--bg-panel)',
            border: '1px solid var(--border)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
            zIndex: 200,
          }}>
            <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
                {user.displayName || 'User'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.email}
              </div>
            </div>
            {[
              { label: '📊 Dashboard', action: () => { onNavigate('catalog'); setOpen(false); } },
              { label: '🚪 Sign Out', action: () => { onSignOut(); setOpen(false); } },
            ].map((item, i) => (
              <button key={i} onClick={item.action} style={{
                display: 'block', width: '100%', padding: '8px 10px', borderRadius: 6,
                background: 'transparent', border: 'none',
                fontSize: 11, color: 'var(--text-secondary)',
                cursor: 'pointer', textAlign: 'left',
                transition: 'background 0.15s',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >{item.label}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ─── Mobile File Drawer ───────────────────────────────────

const MobileFileDrawer: React.FC<{
  open: boolean;
  onClose: () => void;
  files: FileItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onDownloadSingle: (file: FileItem) => void;
  onFilesAdded: (files: File[]) => void;
}> = ({ open, onClose, files, selectedId, onSelect, onRemove, onDownloadSingle, onFilesAdded }) => {
  if (!open) return null;
  return (
    <>
      <div className="mobile-overlay" onClick={onClose} />
      <aside className="file-sidebar mobile-open" style={{
        width: 260, background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{
          padding: '10px 10px 6px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)' }}>
            Files ({files.length})
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <DropZone onFilesAdded={onFilesAdded} compact />
            <button onClick={onClose} style={{
              width: 24, height: 24, borderRadius: 6, border: 'none',
              background: 'rgba(255,255,255,0.05)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 6 }}>
          <FileList
            files={files} selectedId={selectedId}
            onSelect={(id) => { onSelect(id); onClose(); }}
            onRemove={onRemove} onDownloadSingle={onDownloadSingle}
          />
        </div>
      </aside>
    </>
  );
};

// ─── Main App Component ───────────────────────────────────

const WildSauraApp: React.FC = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const { showToast } = useToast();

  // ── UI State ──
  const [activeTab, setActiveTab] = useState<'catalog' | 'presets' | 'edit'>('edit');
  const [guestMode, setGuestMode] = useState(false);
  const [showAuth, setShowAuth] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // ── File State ──
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ── LUT State ──
  const [presets, setPresets] = useState<LUTPreset[]>(() =>
    BUILT_IN_LUTS.map((lut: any) => ({
      id: lut.id || lut.name.toLowerCase().replace(/\s+/g, '_'),
      name: lut.name,
      data: lut.data,
      size: lut.size,
    }))
  );
  const [activeLutId, setActiveLutId] = useState<string | null>(null);
  const [intensity, setIntensity] = useState(100);

  // ── Edit Adjustments State (NEW) ──
  const [adjustments, setAdjustments] = useState<EditAdjustments>({ ...DEFAULT_ADJUSTMENTS });
  const [hslState, setHslState] = useState<HSLState>({ ...DEFAULT_HSL_STATE });
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  // ── Settings ──
  const [settings, setSettings] = useState<ConversionSettingsData>({
    quality: 82,
    resize4k: false,
    lossless: false,
    smartName: true,
    keepExif: true,
    autoConvert: false,
  });

  // ── Processing State ──
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [previewOriginal, setPreviewOriginal] = useState<string | null>(null);
  const [previewProcessed, setPreviewProcessed] = useState<string | null>(null);

  // ── Refs ──
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const processingRef = useRef(false);

  // ── Responsive handler ──
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ── Selected file ──
  const selectedFile = useMemo(
    () => files.find((f) => f.id === selectedId) || null,
    [files, selectedId]
  );

  // ── Active LUT data ──
  const activeLut = useMemo(
    () => presets.find((p) => p.id === activeLutId) || null,
    [presets, activeLutId]
  );

  // ── File stats ──
  const fileStats = useMemo(() => {
    const total = files.length;
    const done = files.filter((f) => f.status === 'done').length;
    const pending = files.filter((f) => f.status === 'pending').length;
    const totalBefore = files.reduce((sum, f) => sum + f.originalSize, 0);
    const totalAfter = files.filter((f) => f.convertedSize).reduce((sum, f) => sum + (f.convertedSize || 0), 0);
    return { total, done, pending, totalBefore, totalAfter };
  }, [files]);

  // ── Generate preview for selected file ──
  const generatePreview = useCallback(async (file: FileItem) => {
    try {
      const dataUrl = await fileToDataUrl(file.file);
      setPreviewOriginal(dataUrl);

      // Check if any edits or LUT are active
      const hasAdjustments = Object.entries(adjustments).some(([_, v]) => v !== 0);
      const hasHSL = Object.values(hslState).some(ch => ch.hue !== 0 || ch.saturation !== 0 || ch.luminance !== 0);
      const hasLut = activeLut && activeLut.data;

      if (file.status === 'done' && file.convertedBlob) {
        const url = URL.createObjectURL(file.convertedBlob);
        setPreviewProcessed(url);
      } else if (hasAdjustments || hasHSL || hasLut) {
        let img = imageCache.current.get(file.id);
        if (!img) {
          img = await loadImage(dataUrl);
          imageCache.current.set(file.id, img);
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(img.width, 800);
        canvas.height = Math.round(img.height * (canvas.width / img.width));
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const { data } = imageData;
        const w = canvas.width;
        const h = canvas.height;

        // Apply adjustments in order
        if (adjustments.exposure !== 0) editing.adjustExposure(data, w, h, adjustments.exposure);
        if (adjustments.contrast !== 0) editing.adjustContrast(data, w, h, adjustments.contrast);
        if (adjustments.highlights !== 0) editing.adjustHighlights(data, w, h, adjustments.highlights);
        if (adjustments.shadows !== 0) editing.adjustShadows(data, w, h, adjustments.shadows);
        if (adjustments.whites !== 0) editing.adjustWhites(data, w, h, adjustments.whites);
        if (adjustments.blacks !== 0) editing.adjustBlacks(data, w, h, adjustments.blacks);
        if (adjustments.temperature !== 0) editing.adjustTemperature(data, w, h, adjustments.temperature);
        if (adjustments.tint !== 0) editing.adjustTint(data, w, h, adjustments.tint);
        if (adjustments.vibrance !== 0) editing.adjustVibrance(data, w, h, adjustments.vibrance);
        if (adjustments.saturation !== 0) editing.adjustSaturation(data, w, h, adjustments.saturation);
        if (adjustments.clarity !== 0) editing.adjustClarity(data, w, h, adjustments.clarity);
        if (adjustments.sharpness !== 0) editing.adjustSharpness(data, w, h, adjustments.sharpness);
        if (adjustments.denoise !== 0) editing.adjustDenoise(data, w, h, adjustments.denoise);
        if (adjustments.vignette !== 0) editing.applyVignette(data, w, h, adjustments.vignette);
        if (adjustments.grain !== 0) editing.applyFilmGrain(data, w, h, adjustments.grain);
        if (adjustments.fog !== 0) editing.applyFog(data, w, h, adjustments.fog);

        // Apply HSL
        for (const [channel, adj] of Object.entries(hslState)) {
          if (adj.hue !== 0 || adj.saturation !== 0 || adj.luminance !== 0) {
            editing.adjustHSL(data, w, h, channel, adj.hue, adj.saturation, adj.luminance);
          }
        }

        // Apply LUT last
        if (hasLut) {
          applyLUT(data, activeLut!.data, activeLut!.size, intensity / 100);
        }

        ctx.putImageData(imageData, 0, 0);
        setPreviewProcessed(canvas.toDataURL('image/jpeg', 0.85));
      } else {
        setPreviewProcessed(null);
      }
    } catch (err) {
      console.error('Preview error:', err);
    }
  }, [activeLut, intensity, adjustments, hslState]);

  // ── Update preview when selection, LUT, or adjustments change ──
  useEffect(() => {
    if (selectedFile) {
      generatePreview(selectedFile);
    } else {
      setPreviewOriginal(null);
      setPreviewProcessed(null);
    }
  }, [selectedFile, activeLutId, intensity, adjustments, hslState, generatePreview]);

  // ── Handle files added ──
  const handleFilesAdded = useCallback(async (newFiles: File[]) => {
    const items: FileItem[] = await Promise.all(
      newFiles.map(async (file) => {
        const id = generateId();
        const thumbnailUrl = await createThumbnailUrl(file);
        // Get dimensions
        let width = 0, height = 0;
        try {
          const img = await loadImage(thumbnailUrl);
          width = img.naturalWidth;
          height = img.naturalHeight;
          imageCache.current.set(id, img);
        } catch {}

        return {
          id,
          file,
          name: file.name,
          status: 'pending' as const,
          originalSize: file.size,
          width,
          height,
          thumbnailUrl,
        };
      })
    );

    setFiles((prev) => {
      const updated = [...prev, ...items];
      // Auto-select first if none selected
      if (!selectedId && updated.length > 0) {
        setSelectedId(items[0].id);
      }
      return updated;
    });

    showToast(`Added ${items.length} file${items.length > 1 ? 's' : ''}`, 'success');

    // Auto-convert if enabled
    if (settings.autoConvert) {
      setTimeout(() => {
        items.forEach((item) => processFile(item.id));
      }, 100);
    }
  }, [selectedId, settings.autoConvert, showToast]);

  // ── Process single file ──
  const processFile = useCallback(async (fileId: string) => {
    setFiles((prev) => prev.map((f) => f.id === fileId ? { ...f, status: 'processing' as const } : f));

    try {
      const file = files.find((f) => f.id === fileId);
      if (!file) throw new Error('File not found');

      // Load image
      let img = imageCache.current.get(fileId);
      if (!img) {
        const dataUrl = await fileToDataUrl(file.file);
        img = await loadImage(dataUrl);
        imageCache.current.set(fileId, img);
      }

      // Create canvas — apply resize4k BEFORE adjustments
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (settings.resize4k && w > 3840) {
        const scale = 3840 / w;
        w = 3840;
        h = Math.round(h * scale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);

      // Apply adjustments at full resolution
      const hasAdjustments = Object.entries(adjustments).some(([_, v]) => v !== 0);
      const hasHSL = Object.values(hslState).some(ch => ch.hue !== 0 || ch.saturation !== 0 || ch.luminance !== 0);
      const hasLut = activeLut && activeLut.data;

      if (hasAdjustments || hasHSL || hasLut) {
        const imageData = ctx.getImageData(0, 0, w, h);
        const { data } = imageData;

        // Apply adjustments in order
        if (adjustments.exposure !== 0) editing.adjustExposure(data, w, h, adjustments.exposure);
        if (adjustments.contrast !== 0) editing.adjustContrast(data, w, h, adjustments.contrast);
        if (adjustments.highlights !== 0) editing.adjustHighlights(data, w, h, adjustments.highlights);
        if (adjustments.shadows !== 0) editing.adjustShadows(data, w, h, adjustments.shadows);
        if (adjustments.whites !== 0) editing.adjustWhites(data, w, h, adjustments.whites);
        if (adjustments.blacks !== 0) editing.adjustBlacks(data, w, h, adjustments.blacks);
        if (adjustments.temperature !== 0) editing.adjustTemperature(data, w, h, adjustments.temperature);
        if (adjustments.tint !== 0) editing.adjustTint(data, w, h, adjustments.tint);
        if (adjustments.vibrance !== 0) editing.adjustVibrance(data, w, h, adjustments.vibrance);
        if (adjustments.saturation !== 0) editing.adjustSaturation(data, w, h, adjustments.saturation);
        if (adjustments.clarity !== 0) editing.adjustClarity(data, w, h, adjustments.clarity);
        if (adjustments.sharpness !== 0) editing.adjustSharpness(data, w, h, adjustments.sharpness);
        if (adjustments.denoise !== 0) editing.adjustDenoise(data, w, h, adjustments.denoise);
        if (adjustments.vignette !== 0) editing.applyVignette(data, w, h, adjustments.vignette);
        if (adjustments.grain !== 0) editing.applyFilmGrain(data, w, h, adjustments.grain);
        if (adjustments.fog !== 0) editing.applyFog(data, w, h, adjustments.fog);

        // Apply HSL
        for (const [channel, adj] of Object.entries(hslState)) {
          if (adj.hue !== 0 || adj.saturation !== 0 || adj.luminance !== 0) {
            editing.adjustHSL(data, w, h, channel, adj.hue, adj.saturation, adj.luminance);
          }
        }

        // Apply LUT last
        if (hasLut) {
          applyLUT(data, activeLut!.data, activeLut!.size, intensity / 100);
        }

        ctx.putImageData(imageData, 0, 0);
      }

      // Convert to WebP
      const blob: Blob = await new Promise((resolve, reject) => {
        if (settings.lossless) {
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error('Blob creation failed'))),
            'image/webp',
            1.0
          );
        } else {
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error('Blob creation failed'))),
            'image/webp',
            settings.quality / 100
          );
        }
      });

      // Generate output name
      let outName = file.name.replace(/\.[^.]+$/, '');
      if (settings.smartName && activeLut) {
        outName += `_${activeLut.name.replace(/\s+/g, '-').toLowerCase()}`;
      }
      outName += '.webp';

      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId
            ? { ...f, status: 'done' as const, convertedBlob: blob, convertedSize: blob.size }
            : f
        )
      );

      // Save to Firebase if logged in
      if (user) {
        try {
          await saveConversion({
            userId: user.uid,
            fileName: outName,
            originalSize: file.originalSize,
            processedSize: blob.size,
            preset: activeLut?.name || 'None',
            intensity,
            quality: settings.quality,
            width: w,
            height: h,
            savedPercentage: Math.round((1 - blob.size / file.originalSize) * 100),
            createdAt: Date.now(),
          });
        } catch (e) {
          // Silent fail for cloud save
          console.warn('Cloud save failed:', e);
        }
      }

      showToast(`Converted: ${outName}`, 'success');
    } catch (err: any) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId
            ? { ...f, status: 'error' as const, error: err.message || 'Conversion failed' }
            : f
        )
      );
      showToast(`Error: ${err.message || 'Conversion failed'}`, 'error');
    }
  }, [files, activeLut, intensity, settings, user, showToast, adjustments, hslState]);

  // ── Process all pending ──
  const processAll = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    setIsProcessingAll(true);

    const pending = files.filter((f) => f.status === 'pending' || f.status === 'error');
    for (const file of pending) {
      await processFile(file.id);
    }

    processingRef.current = false;
    setIsProcessingAll(false);
    showToast(`Batch complete! ${pending.length} files processed`, 'success');
  }, [files, processFile, showToast]);

  // ── Download single file ──
  const downloadSingle = useCallback((file: FileItem) => {
    if (!file.convertedBlob) return;
    const url = URL.createObjectURL(file.convertedBlob);
    const a = document.createElement('a');
    let outName = file.name.replace(/\.[^.]+$/, '');
    if (settings.smartName && activeLut) {
      outName += `_${activeLut.name.replace(/\s+/g, '-').toLowerCase()}`;
    }
    outName += '.webp';
    a.href = url;
    a.download = outName;
    a.click();
    URL.revokeObjectURL(url);
  }, [settings.smartName, activeLut]);

  // ── Download all as zip ──
  const downloadAllZip = useCallback(async () => {
    const doneFiles = files.filter((f) => f.status === 'done' && f.convertedBlob);
    if (doneFiles.length === 0) return;

    showToast('Creating zip file…', 'info');
    const zip = new JSZip();

    for (const file of doneFiles) {
      let outName = file.name.replace(/\.[^.]+$/, '');
      if (settings.smartName && activeLut) {
        outName += `_${activeLut.name.replace(/\s+/g, '-').toLowerCase()}`;
      }
      outName += '.webp';
      zip.file(outName, file.convertedBlob!);
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wildsaura_export_${Date.now()}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${doneFiles.length} files as zip`, 'success');
  }, [files, settings.smartName, activeLut, showToast]);

  // ── Remove file ──
  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    if (selectedId === id) {
      setSelectedId((prev) => {
        const remaining = files.filter((f) => f.id !== id);
        return remaining.length > 0 ? remaining[0].id : null;
      });
    }
    imageCache.current.delete(id);
  }, [files, selectedId]);

  // ── Reset all statuses ──
  const resetAll = useCallback(() => {
    setFiles((prev) => prev.map((f) => ({
      ...f, status: 'pending' as const, convertedBlob: undefined, convertedSize: undefined, error: undefined,
    })));
    showToast('Reset all files', 'info');
  }, [showToast]);

  // ── Clear all ──
  const clearAll = useCallback(() => {
    setFiles([]);
    setSelectedId(null);
    imageCache.current.clear();
    setPreviewOriginal(null);
    setPreviewProcessed(null);
    showToast('Cleared all files', 'info');
  }, [showToast]);

  // ── Add custom LUT ──
  const addCustomLut = useCallback((preset: LUTPreset) => {
    setPresets((prev) => [...prev, preset]);
    setActiveLutId(preset.id);
    showToast(`Loaded LUT: ${preset.name}`, 'success');
  }, [showToast]);

  // ── Apply preset (NEW) ──
  const handleApplyPreset = useCallback((presetAdj: Partial<EditAdjustments>) => {
    setAdjustments({
      ...DEFAULT_ADJUSTMENTS,
      ...presetAdj,
    });
    // Find which preset was applied (by matching adjustments)
    const preset = BUILT_IN_PRESETS.find(p => {
      return Object.entries(p.adjustments).every(([k, v]) => presetAdj[k as keyof EditAdjustments] === v);
    });
    setActivePresetId(preset?.id || null);
    showToast(`Applied preset: ${preset?.name || 'Custom'}`, 'success');
  }, [showToast]);

  // ── Reset adjustments (NEW) ──
  const resetAdjustments = useCallback(() => {
    setAdjustments({ ...DEFAULT_ADJUSTMENTS });
    setHslState({ ...DEFAULT_HSL_STATE });
    setActivePresetId(null);
    showToast('Reset all adjustments', 'info');
  }, [showToast]);

  // ─── Auth screen ──────────────────────────────────────────
  if (!guestMode && !user && !authLoading) {
    return <Auth onSkip={() => setGuestMode(true)} />;
  }

  // ─── Loading screen ───────────────────────────────────────
  if (authLoading) {
    return (
      <div style={{
        height: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#0f0f1a',
      }}>
        <div className="animate-spin" style={{
          width: 32, height: 32, borderRadius: '50%',
          border: '3px solid rgba(255,255,255,0.1)',
          borderTopColor: 'var(--accent)',
          marginBottom: 12,
        }} />
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading WildSaura…</span>
      </div>
    );
  }

  // ─── Shared File Sidebar renderer (used in Edit + Presets tabs) ──
  const renderFileSidebar = () => (
    <aside className="file-sidebar" style={{
      width: 220, flexShrink: 0,
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '10px 10px 6px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: 1, color: 'var(--text-muted)',
          }}>
            Files ({files.length})
          </span>
          <DropZone onFilesAdded={handleFilesAdded} compact />
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 6 }}>
        <FileList
          files={files}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onRemove={removeFile}
          onDownloadSingle={downloadSingle}
        />
      </div>
    </aside>
  );

  // ─── Main Layout ──────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0f0f1a' }}>

      {/* ═══════════════ TOP HEADER BAR ═══════════════ */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', height: 48,
        background: '#0a0a14',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0, zIndex: 50,
      }}>
        {/* Left: Logo + Mobile menu toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Mobile hamburger */}
          {isMobile && files.length > 0 && (
            <button
              onClick={() => setMobileDrawerOpen(true)}
              style={{
                width: 32, height: 32, borderRadius: 8, border: 'none',
                background: 'rgba(255,255,255,0.05)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          )}

          <img
            src="./assets/logo-w-icon.jpg"
            alt=""
            style={{ width: 28, height: 28, borderRadius: '50%' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Wild</span>
            <span className="brand-gradient" style={{ fontSize: 14, fontWeight: 700 }}>Saura</span>
            {!isMobile && (
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginLeft: 6, letterSpacing: 1 }}>
                PRO STUDIO
              </span>
            )}
          </div>
        </div>

        {/* Center: Tab navigation */}
        <nav style={{ display: 'flex', gap: 2 }}>
          {(['catalog', 'presets', 'edit'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: isMobile ? '6px 10px' : '6px 16px',
                borderRadius: 6,
                fontSize: isMobile ? 11 : 12,
                fontWeight: 600,
                background: activeTab === tab ? 'rgba(99,102,241,0.15)' : 'transparent',
                border: activeTab === tab ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
                color: activeTab === tab ? '#a78bfa' : 'rgba(255,255,255,0.4)',
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all 0.2s',
              }}
            >
              {tab === 'catalog' ? (isMobile ? '📊' : 'Catalog') : tab === 'presets' ? (isMobile ? '🎨' : 'Presets') : (isMobile ? '✏️' : 'Edit')}
            </button>
          ))}
        </nav>

        {/* Right: User menu */}
        <UserMenu user={user} onSignOut={signOut} onNavigate={(tab) => setActiveTab(tab as any)} />
      </header>

      {/* ═══════════════ MAIN CONTENT ═══════════════ */}

      {/* ── CATALOG TAB ── */}
      {activeTab === 'catalog' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {files.length > 0 ? (
            <CatalogView
              files={files}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onRemove={removeFile}
              onFilesAdded={handleFilesAdded}
              onSwitchToEdit={() => setActiveTab('edit')}
            />
          ) : (
            <Dashboard userId={user?.uid || ''} />
          )}
        </div>
      )}

      {/* ── PRESETS TAB ── */}
      {activeTab === 'presets' && (
        <>
          {/* Desktop presets layout */}
          {!isMobile ? (
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              {/* Left sidebar with file list (if files exist) */}
              {files.length > 0 && renderFileSidebar()}

              {/* Center area splits: top=image preview, bottom=presets browser */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Image preview area */}
                {selectedFile && previewOriginal ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, background: '#0a0a12', minHeight: '40%' }}>
                    <ImagePreview
                      originalUrl={previewOriginal}
                      processedUrl={previewProcessed}
                      fileName={selectedFile.name}
                    />
                  </div>
                ) : null}

                {/* Presets panel */}
                <div style={{ flex: selectedFile ? 'none' : 1, height: selectedFile ? '50%' : '100%', overflowY: 'auto', background: 'var(--bg-secondary)' }}>
                  <PresetsPanel
                    onApplyPreset={handleApplyPreset}
                    currentImage={previewOriginal}
                    activePresetId={activePresetId}
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Mobile presets layout */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Mobile file drawer */}
              <MobileFileDrawer
                open={mobileDrawerOpen}
                onClose={() => setMobileDrawerOpen(false)}
                files={files}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onRemove={removeFile}
                onDownloadSingle={downloadSingle}
                onFilesAdded={handleFilesAdded}
              />

              {/* Image preview (if selected) */}
              {selectedFile && previewOriginal && (
                <div style={{ flex: 'none', height: '35%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8, background: '#0a0a12' }}>
                  <ImagePreview
                    originalUrl={previewOriginal}
                    processedUrl={previewProcessed}
                    fileName={selectedFile.name}
                  />
                </div>
              )}

              {/* Presets panel full area */}
              <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-secondary)' }}>
                <PresetsPanel
                  onApplyPreset={handleApplyPreset}
                  currentImage={previewOriginal}
                  activePresetId={activePresetId}
                />
              </div>

              {/* Mobile fixed bottom action bar */}
              {files.length > 0 && (
                <div style={{
                  display: 'flex', gap: 8, padding: '8px 12px',
                  background: 'var(--bg-secondary)',
                  borderTop: '1px solid var(--border)',
                  flexShrink: 0,
                }}>
                  <button
                    className="btn-primary"
                    onClick={processAll}
                    disabled={isProcessingAll || fileStats.pending === 0}
                    style={{ flex: 1, padding: '10px', fontSize: 12, fontWeight: 700 }}
                  >
                    {isProcessingAll ? (
                      <>
                        <span className="animate-spin" style={{
                          display: 'inline-block', width: 12, height: 12, borderRadius: '50%',
                          border: '2px solid transparent', borderTopColor: '#fff',
                          marginRight: 6, verticalAlign: 'middle',
                        }} />
                        Processing…
                      </>
                    ) : (
                      `🎬 Convert (${fileStats.pending})`
                    )}
                  </button>
                  <button
                    className="btn-success"
                    onClick={downloadAllZip}
                    disabled={fileStats.done === 0}
                    style={{ flex: 1, padding: '10px', fontSize: 12, fontWeight: 700 }}
                  >
                    📥 Zip ({fileStats.done})
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── EDIT TAB ── */}
      {activeTab === 'edit' && (
        <>
          {/* Desktop 3-column layout */}
          {!isMobile ? (
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

              {/* ── LEFT SIDEBAR: File List ── */}
              {files.length > 0 && renderFileSidebar()}

              {/* ── CENTER: Image Preview + LUT Strip ── */}
              <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Image Preview */}
                <div style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 12, overflow: 'hidden',
                  background: '#0a0a12',
                }}>
                  {files.length === 0 ? (
                    <DropZone onFilesAdded={handleFilesAdded} />
                  ) : selectedFile && previewOriginal ? (
                    <ImagePreview
                      originalUrl={previewOriginal}
                      processedUrl={previewProcessed}
                      fileName={selectedFile.name}
                    />
                  ) : (
                    <div style={{
                      textAlign: 'center', color: 'var(--text-muted)',
                    }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" style={{ marginBottom: 8 }}>
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      <div style={{ fontSize: 12 }}>Select a file to preview</div>
                    </div>
                  )}
                </div>

                {/* Bottom: LUT Strip */}
                {files.length > 0 && (
                  <div style={{
                    borderTop: '1px solid var(--border)',
                    background: 'var(--bg-secondary)',
                    padding: '6px 12px',
                    flexShrink: 0,
                  }}>
                    <LUTPanel
                      presets={presets}
                      activeLutId={activeLutId}
                      intensity={intensity}
                      onSelectLut={setActiveLutId}
                      onIntensityChange={setIntensity}
                      onAddCustomLut={addCustomLut}
                    />
                  </div>
                )}
              </main>

              {/* ── RIGHT SIDEBAR: Edit Panel (NEW) ── */}
              {files.length > 0 && (
                <aside style={{
                  width: 280, flexShrink: 0,
                  background: 'var(--bg-secondary)',
                  borderLeft: '1px solid var(--border)',
                  overflow: 'hidden',
                  display: 'flex', flexDirection: 'column',
                }}>
                  <EditPanel
                    adjustments={adjustments}
                    onAdjustmentsChange={setAdjustments}
                    hslState={hslState}
                    onHSLChange={setHslState}
                    presets={presets}
                    activeLutId={activeLutId}
                    intensity={intensity}
                    onSelectLut={setActiveLutId}
                    onIntensityChange={setIntensity}
                    onAddCustomLut={addCustomLut}
                    settings={settings}
                    onSettingsChange={setSettings}
                    onConvertAll={processAll}
                    onDownloadZip={downloadAllZip}
                    onReset={resetAll}
                    onClearAll={clearAll}
                    isProcessingAll={isProcessingAll}
                    fileStats={fileStats}
                    onResetAdjustments={resetAdjustments}
                  />
                </aside>
              )}
            </div>
          ) : (
            /* ═══ MOBILE VERTICAL LAYOUT ═══ */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Mobile file drawer */}
              <MobileFileDrawer
                open={mobileDrawerOpen}
                onClose={() => setMobileDrawerOpen(false)}
                files={files}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onRemove={removeFile}
                onDownloadSingle={downloadSingle}
                onFilesAdded={handleFilesAdded}
              />

              {/* Image Preview */}
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 8, overflow: 'hidden',
                background: '#0a0a12', minHeight: 0,
              }}>
                {files.length === 0 ? (
                  <DropZone onFilesAdded={handleFilesAdded} />
                ) : selectedFile && previewOriginal ? (
                  <ImagePreview
                    originalUrl={previewOriginal}
                    processedUrl={previewProcessed}
                    fileName={selectedFile.name}
                  />
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                    Select a file to preview
                  </div>
                )}
              </div>

              {/* LUT Strip */}
              {files.length > 0 && (
                <div style={{
                  borderTop: '1px solid var(--border)',
                  background: 'var(--bg-secondary)',
                  padding: '4px 8px',
                  flexShrink: 0,
                }}>
                  <LUTPanel
                    presets={presets}
                    activeLutId={activeLutId}
                    intensity={intensity}
                    onSelectLut={setActiveLutId}
                    onIntensityChange={setIntensity}
                    onAddCustomLut={addCustomLut}
                  />
                </div>
              )}

              {/* Mobile Edit Controls (scrollable) — EditPanel replaces ConversionSettings */}
              {files.length > 0 && (
                <div className="right-panel-mobile" style={{
                  maxHeight: 280, overflowY: 'auto', flexShrink: 0,
                  background: 'var(--bg-secondary)',
                  borderTop: '1px solid var(--border)',
                }}>
                  <EditPanel
                    adjustments={adjustments}
                    onAdjustmentsChange={setAdjustments}
                    hslState={hslState}
                    onHSLChange={setHslState}
                    presets={presets}
                    activeLutId={activeLutId}
                    intensity={intensity}
                    onSelectLut={setActiveLutId}
                    onIntensityChange={setIntensity}
                    onAddCustomLut={addCustomLut}
                    settings={settings}
                    onSettingsChange={setSettings}
                    onConvertAll={processAll}
                    onDownloadZip={downloadAllZip}
                    onReset={resetAll}
                    onClearAll={clearAll}
                    isProcessingAll={isProcessingAll}
                    fileStats={fileStats}
                    onResetAdjustments={resetAdjustments}
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ─── Root Wrapper ─────────────────────────────────────────

const App: React.FC = () => (
  <AuthProvider>
    <ToastProvider>
      <WildSauraApp />
    </ToastProvider>
  </AuthProvider>
);

createRoot(document.getElementById('root')!).render(<App />);
