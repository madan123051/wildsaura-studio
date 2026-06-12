import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { BUILT_IN_PRESETS, PRESET_CATEGORIES, type PresetDefinition } from '../utils/presetData';
import type { EditAdjustments } from '../types';
import { DEFAULT_ADJUSTMENTS } from '../types';
import { applyAdjustmentsToImageData, detectSceneType, adaptWildsauraLook } from '../utils/presetEngine';

interface PresetsPanelProps {
  onApplyPreset: (adjustments: EditAdjustments) => void;
  currentImage: string | null;
  activePresetId: string | null;
  currentAdjustments?: EditAdjustments;
}

const previewCache = new Map<string, string>();

function presetToAdjustments(preset: PresetDefinition): EditAdjustments {
  return { ...DEFAULT_ADJUSTMENTS, ...preset.adjustments };
}

const PresetCard: React.FC<{ preset: PresetDefinition; currentImage: string | null; isActive: boolean; onApply: () => void; }> = ({ preset, currentImage, isActive, onApply }) => {
  const [thumb, setThumb] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin: '180px' });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!currentImage || !inView) return;
    const cacheKey = `${currentImage}:${preset.id}`;
    if (previewCache.has(cacheKey)) {
      setThumb(previewCache.get(cacheKey)!);
      return;
    }
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 100;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let adj = presetToAdjustments(preset);
      if (preset.id === 'wildsaura_look') {
        adj = adaptWildsauraLook(adj, detectSceneType(canvas));
      }
      applyAdjustmentsToImageData(frame.data, canvas.width, canvas.height, adj);
      ctx.putImageData(frame, 0, 0);
      const url = canvas.toDataURL('image/jpeg', 0.75);
      previewCache.set(cacheKey, url);
      setThumb(url);
    };
    img.src = currentImage;
  }, [currentImage, preset, inView]);

  return (
    <div
      ref={ref}
      onClick={onApply}
      style={{
        borderRadius: 14,
        overflow: 'hidden',
        border: isActive ? '2px solid #8ea9ff' : '1px solid rgba(255,255,255,0.10)',
        background: isActive ? 'rgba(126,157,255,0.08)' : 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(12px)',
        boxShadow: isActive ? '0 0 20px rgba(126,157,255,0.35)' : '0 6px 16px rgba(0,0,0,0.25)',
        cursor: 'pointer',
        transition: 'all .22s ease',
      }}
    >
      {/* Thumbnail */}
      <div style={{ height: 90, background: '#1a1d27', overflow: 'hidden' }}>
        {thumb
          ? <img src={thumb} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.03)' }} />}
      </div>
      {/* Label */}
      <div style={{ padding: '7px 9px' }}>
        <div style={{ color: '#f2f5ff', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{preset.name}</div>
        <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 9, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{preset.description}</div>
      </div>
    </div>
  );
};

const PresetsPanel: React.FC<PresetsPanelProps> = ({ onApplyPreset, currentImage, activePresetId }) => {
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [intensity, setIntensity] = useState(100);
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

  const categories = useMemo(() => ['All', ...PRESET_CATEGORIES], []);
  const filteredPresets = useMemo(() =>
    BUILT_IN_PRESETS.filter((p) =>
      (activeCategory === 'All' || p.category === activeCategory) &&
      (!searchQuery.trim() || `${p.name} ${p.description} ${p.category}`.toLowerCase().includes(searchQuery.toLowerCase()))
    ), [activeCategory, searchQuery]);

  const applyWithIntensity = useCallback((preset: PresetDefinition) => {
    const raw = presetToAdjustments(preset);
    const ratio = intensity / 100;
    const blended: EditAdjustments = { ...DEFAULT_ADJUSTMENTS };
    (Object.keys(blended) as Array<keyof EditAdjustments>).forEach((key) => {
      blended[key] = Math.round(raw[key] * ratio);
    });
    onApplyPreset(blended);
    if (navigator.vibrate) navigator.vibrate(8);
  }, [onApplyPreset, intensity]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'radial-gradient(circle at top, #1b2238 0%, #0b0f18 65%)' }}>
      {/* Search + filters */}
      <div style={{ padding: 12, borderBottom: '1px solid rgba(255,255,255,.08)', flexShrink: 0 }}>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search cinematic presets…"
          style={{ width: '100%', padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.15)', color: '#fff', fontSize: 12, boxSizing: 'border-box' as const }}
        />
        <div style={{ marginTop: 8, display: 'flex', gap: 6, overflowX: 'auto', scrollSnapType: 'x mandatory', paddingBottom: 2 }}>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                scrollSnapAlign: 'start', border: 0, borderRadius: 14, padding: '4px 10px',
                background: activeCategory === cat ? 'linear-gradient(135deg,#5f7cff,#8f6fff)' : 'rgba(255,255,255,.08)',
                color: '#fff', fontSize: 11, whiteSpace: 'nowrap' as const, cursor: 'pointer',
              }}
            >{cat}</button>
          ))}
        </div>
        <div style={{ marginTop: 8 }}>
          <label style={{ color: 'rgba(255,255,255,.6)', fontSize: 10 }}>Preset Strength {intensity}</label>
          <input type="range" min={0} max={100} value={intensity} onChange={(e) => setIntensity(Number(e.target.value))} style={{ width: '100%' }} />
        </div>
      </div>

      {/* ── 2-column compact grid ── */}
      <div style={{ padding: 10, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, overflowY: 'auto' }}>
        {filteredPresets.map((preset) => (
          <div
            key={preset.id}
            onDoubleClick={() => setFavorites((f) => ({ ...f, [preset.id]: !f[preset.id] }))}
          >
            <PresetCard
              preset={preset}
              currentImage={currentImage}
              isActive={activePresetId === preset.id}
              onApply={() => applyWithIntensity(preset)}
            />
            {favorites[preset.id] && (
              <div style={{ color: '#ffcc77', fontSize: 9, marginTop: 3, textAlign: 'center' as const }}>★ Favorite</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PresetsPanel;
