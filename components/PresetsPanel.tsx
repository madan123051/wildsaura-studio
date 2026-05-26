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
      canvas.width = 220;
      canvas.height = 130;
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
      const url = canvas.toDataURL('image/jpeg', 0.7);
      previewCache.set(cacheKey, url);
      setThumb(url);
    };
    img.src = currentImage;
  }, [currentImage, preset, inView]);

  return (
    <div ref={ref} onClick={onApply} style={{ minWidth: 170, borderRadius: 20, overflow: 'hidden', border: isActive ? '1px solid #8ea9ff' : '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)', boxShadow: isActive ? '0 0 28px rgba(126,157,255,0.45)' : '0 14px 28px rgba(0,0,0,0.28)', cursor: 'pointer', transition: 'all .28s ease' }}>
      <div style={{ height: 108, background: '#1a1d27' }}>{thumb ? <img src={thumb} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}</div>
      <div style={{ padding: 10 }}>
        <div style={{ color: '#f2f5ff', fontSize: 12, fontWeight: 700 }}>{preset.name}</div>
        <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 10, marginTop: 2 }}>{preset.description}</div>
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
  const filteredPresets = useMemo(() => BUILT_IN_PRESETS.filter((p) => (activeCategory === 'All' || p.category === activeCategory) && (!searchQuery.trim() || `${p.name} ${p.description} ${p.category}`.toLowerCase().includes(searchQuery.toLowerCase()))), [activeCategory, searchQuery]);

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

  return <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'radial-gradient(circle at top, #1b2238 0%, #0b0f18 65%)' }}>
    <div style={{ padding: 12, borderBottom: '1px solid rgba(255,255,255,.08)' }}>
      <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder='Search cinematic presets…' style={{ width: '100%', padding: 8, borderRadius: 10, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.15)', color: '#fff' }} />
      <div style={{ marginTop: 10, display: 'flex', gap: 8, overflowX: 'auto', scrollSnapType: 'x mandatory' }}>{categories.map((cat) => <button key={cat} onClick={() => setActiveCategory(cat)} style={{ scrollSnapAlign: 'start', border: 0, borderRadius: 16, padding: '5px 11px', background: activeCategory === cat ? 'linear-gradient(135deg,#5f7cff,#8f6fff)' : 'rgba(255,255,255,.08)', color: '#fff' }}>{cat}</button>)}</div>
      <div style={{ marginTop: 10 }}><label style={{ color: 'rgba(255,255,255,.7)', fontSize: 11 }}>Preset Strength {intensity}</label><input type='range' min={0} max={100} value={intensity} onChange={(e) => setIntensity(Number(e.target.value))} style={{ width: '100%' }} /></div>
    </div>
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
      {filteredPresets.map((preset) => <div key={preset.id} onDoubleClick={() => setFavorites((f) => ({ ...f, [preset.id]: !f[preset.id] }))} onMouseDown={(e) => { if (e.detail === 1) return; }}>
        <PresetCard preset={preset} currentImage={currentImage} isActive={activePresetId === preset.id} onApply={() => applyWithIntensity(preset)} />
        {favorites[preset.id] ? <div style={{ color: '#ffcc77', fontSize: 10, marginTop: 4 }}>★ Favorite</div> : null}
      </div>)}
    </div>
  </div>;
};

export default PresetsPanel;
