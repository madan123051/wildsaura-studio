import React, { useState, useMemo, useCallback } from 'react';
import { BUILT_IN_PRESETS, PRESET_CATEGORIES, type PresetDefinition } from '../utils/presetData';
import type { EditAdjustments } from '../types';

interface PresetsPanelProps {
  onApplyPreset: (adjustments: EditAdjustments) => void;
  currentImage: string | null;
  activePresetId: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function presetToGradient(preset: PresetDefinition): string {
  const adj = preset.adjustments;

  const temp = (adj as any).temperature ?? 0;
  const sat = (adj as any).saturation ?? 0;
  const vib = (adj as any).vibrance ?? 0;
  const exp = (adj as any).exposure ?? 0;
  const contrast = (adj as any).contrast ?? 0;
  const tint = (adj as any).tint ?? 0;

  // Determine category-based defaults
  const cat = (preset.category || '').toLowerCase();

  if (cat === 'b&w' || cat === 'bw' || cat === 'black & white' || cat === 'monochrome') {
    const base = Math.max(20, Math.min(80, 50 + exp * 0.3));
    return `linear-gradient(135deg, hsl(0,0%,${base - 15}%), hsl(0,0%,${base + 10}%), hsl(0,0%,${base - 5}%))`;
  }

  // Hue from temperature: negative = cool (blue ~210), positive = warm (orange ~30)
  let hue1: number;
  let hue2: number;

  if (temp < -30) {
    hue1 = 210 + temp * 0.3;
    hue2 = 240 - temp * 0.2;
  } else if (temp > 30) {
    hue1 = 30 + temp * 0.2;
    hue2 = 15 + temp * 0.15;
  } else {
    hue1 = 260 + temp;
    hue2 = 220 + temp * 0.5;
  }

  // Add tint influence
  if (tint > 20) {
    hue2 = 320 + tint * 0.3;
  } else if (tint < -20) {
    hue1 = 160 + tint * 0.5;
  }

  // Saturation from vibrance + saturation
  const satLevel = Math.max(15, Math.min(85, 40 + (sat + vib) * 0.35));

  // Lightness from exposure
  const light1 = Math.max(10, Math.min(55, 30 + exp * 0.25));
  const light2 = Math.max(15, Math.min(65, 40 + exp * 0.2));

  // Contrast affects the spread
  const spread = Math.max(5, 15 + contrast * 0.1);

  // Category-based overrides
  if (cat === 'cinematic' || cat === 'film') {
    return `linear-gradient(135deg, hsl(${hue1},${satLevel * 0.7}%,${light1}%), hsl(${(hue1 + 40) % 360},${satLevel * 0.5}%,${light2}%), hsl(${hue2},${satLevel * 0.6}%,${light1 + spread}%))`;
  }

  if (cat === 'vintage' || cat === 'retro') {
    return `linear-gradient(135deg, hsl(35,${satLevel * 0.6}%,${light1 + 5}%), hsl(25,${satLevel * 0.4}%,${light2 + 8}%), hsl(45,${satLevel * 0.5}%,${light1 + 12}%))`;
  }

  if (cat === 'landscape' || cat === 'nature') {
    return `linear-gradient(135deg, hsl(200,${satLevel}%,${light1}%), hsl(140,${satLevel * 0.8}%,${light2}%), hsl(180,${satLevel * 0.6}%,${light1 + spread}%))`;
  }

  if (cat === 'portrait') {
    return `linear-gradient(135deg, hsl(20,${satLevel * 0.7}%,${light1 + 10}%), hsl(350,${satLevel * 0.5}%,${light2 + 5}%), hsl(30,${satLevel * 0.6}%,${light1 + 15}%))`;
  }

  return `linear-gradient(135deg, hsl(${hue1},${satLevel}%,${light1}%), hsl(${(hue1 + hue2) / 2},${satLevel * 0.8}%,${light2}%), hsl(${hue2},${satLevel * 0.7}%,${light1 + spread}%))`;
}

function presetToAdjustments(preset: PresetDefinition): EditAdjustments {
  const adj = preset.adjustments || {};
  return {
    exposure: (adj as any).exposure ?? 0,
    contrast: (adj as any).contrast ?? 0,
    highlights: (adj as any).highlights ?? 0,
    shadows: (adj as any).shadows ?? 0,
    whites: (adj as any).whites ?? 0,
    blacks: (adj as any).blacks ?? 0,
    temperature: (adj as any).temperature ?? 0,
    tint: (adj as any).tint ?? 0,
    vibrance: (adj as any).vibrance ?? 0,
    saturation: (adj as any).saturation ?? 0,
    clarity: (adj as any).clarity ?? 0,
    sharpness: (adj as any).sharpness ?? 0,
    denoise: (adj as any).denoise ?? 0,
    vignette: (adj as any).vignette ?? 0,
    grain: (adj as any).grain ?? 0,
    fog: (adj as any).fog ?? 0,
  } as EditAdjustments;
}

// ─── Main Component ─────────────────────────────────────────────────────────

const PresetsPanel: React.FC<PresetsPanelProps> = ({
  onApplyPreset,
  currentImage,
  activePresetId,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const categories = useMemo(() => ['All', ...PRESET_CATEGORIES], []);

  const filteredPresets = useMemo(() => {
    let list = BUILT_IN_PRESETS;
    if (activeCategory !== 'All') {
      list = list.filter((p) => p.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [activeCategory, searchQuery]);

  const handleApply = useCallback(
    (preset: PresetDefinition) => {
      onApplyPreset(presetToAdjustments(preset));
    },
    [onApplyPreset]
  );

  const handleReset = useCallback(() => {
    onApplyPreset({
      exposure: 0,
      contrast: 0,
      highlights: 0,
      shadows: 0,
      whites: 0,
      blacks: 0,
      temperature: 0,
      tint: 0,
      vibrance: 0,
      saturation: 0,
      clarity: 0,
      sharpness: 0,
      denoise: 0,
      vignette: 0,
      grain: 0,
      fog: 0,
    } as EditAdjustments);
  }, [onApplyPreset]);

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-primary, #0f0f1a)',
        color: 'var(--text-primary, #f0f0f5)',
      }}
    >
      {/* ── Top bar ──────────────────────────────────────────── */}
      <div
        style={{
          padding: '12px 16px 0',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}
      >
        {/* Search */}
        <div
          style={{
            position: 'relative',
            marginBottom: 10,
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
          >
            <circle cx="11" cy="11" r="7" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
            <path d="M16 16L21 21" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Search presets…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '7px 10px 7px 32px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 6,
              color: '#f0f0f5',
              fontSize: 12,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Category tabs */}
        <div
          style={{
            display: 'flex',
            gap: 4,
            overflowX: 'auto',
            paddingBottom: 10,
            scrollbarWidth: 'none',
          }}
        >
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                flexShrink: 0,
                padding: '4px 12px',
                borderRadius: 20,
                border: 'none',
                fontSize: 11,
                fontWeight: activeCategory === cat ? 600 : 400,
                cursor: 'pointer',
                background:
                  activeCategory === cat
                    ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                    : 'rgba(255,255,255,0.04)',
                color:
                  activeCategory === cat ? '#fff' : 'rgba(255,255,255,0.5)',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ── Preset grid ──────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 12,
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.06) transparent',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 10,
          }}
        >
          {/* Reset card */}
          <div
            onClick={handleReset}
            onMouseEnter={() => setHoveredId('__reset__')}
            onMouseLeave={() => setHoveredId(null)}
            style={{
              borderRadius: 8,
              overflow: 'hidden',
              cursor: 'pointer',
              border:
                activePresetId === null
                  ? '2px solid #6366f1'
                  : '2px solid rgba(255,255,255,0.06)',
              background: 'var(--bg-panel, #1a1a2e)',
              transition: 'all 0.2s',
              transform: hoveredId === '__reset__' ? 'scale(1.02)' : 'scale(1)',
            }}
          >
            {/* Gradient area */}
            <div
              style={{
                height: 80,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #1a1a2e, #2a2a4e)',
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path
                  d="M3 12a9 9 0 1 1 9 9"
                  stroke="rgba(255,255,255,0.25)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M3 21V12H12"
                  stroke="rgba(255,255,255,0.25)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            {/* Info */}
            <div style={{ padding: '8px 10px' }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#f0f0f5',
                  marginBottom: 2,
                }}
              >
                None / Reset
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                Reset all adjustments to default
              </div>
            </div>
          </div>

          {/* Preset cards */}
          {filteredPresets.map((preset) => {
            const isActive = activePresetId === preset.id;
            const isHovered = hoveredId === preset.id;
            return (
              <div
                key={preset.id}
                onClick={() => handleApply(preset)}
                onMouseEnter={() => setHoveredId(preset.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  borderRadius: 8,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  border: isActive
                    ? '2px solid #6366f1'
                    : '2px solid rgba(255,255,255,0.06)',
                  background: 'var(--bg-panel, #1a1a2e)',
                  transition: 'all 0.2s',
                  transform: isHovered ? 'scale(1.02)' : 'scale(1)',
                  boxShadow: isHovered
                    ? '0 4px 20px rgba(0,0,0,0.4)'
                    : '0 1px 4px rgba(0,0,0,0.2)',
                  position: 'relative',
                }}
              >
                {/* Gradient preview */}
                <div
                  style={{
                    height: 80,
                    background: presetToGradient(preset),
                    position: 'relative',
                  }}
                >
                  {/* Active checkmark */}
                  {isActive && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: '#6366f1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}

                  {/* Hover overlay */}
                  {isHovered && !isActive && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(0,0,0,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <span
                        style={{
                          padding: '4px 14px',
                          borderRadius: 4,
                          background: 'rgba(99,102,241,0.85)',
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        Apply
                      </span>
                    </div>
                  )}
                </div>

                {/* Info area */}
                <div style={{ padding: '8px 10px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      marginBottom: 3,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#f0f0f5',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                      }}
                    >
                      {preset.name}
                    </span>
                    <span
                      style={{
                        flexShrink: 0,
                        fontSize: 9,
                        padding: '1px 6px',
                        borderRadius: 10,
                        background: 'rgba(99,102,241,0.15)',
                        color: '#a78bfa',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {preset.category}
                    </span>
                  </div>
                  {preset.description && (
                    <div
                      style={{
                        fontSize: 10,
                        color: 'rgba(255,255,255,0.35)',
                        lineHeight: 1.3,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {preset.description}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty state */}
        {filteredPresets.length === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 20px',
              color: 'rgba(255,255,255,0.25)',
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" style={{ marginBottom: 12 }}>
              <circle cx="11" cy="11" r="7" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
              <path d="M16 16L21 21" stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <div style={{ fontSize: 13, fontWeight: 500 }}>No presets found</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>Try a different search or category</div>
          </div>
        )}
      </div>

      {/* ── Bottom info ──────────────────────────────────────── */}
      <div
        style={{
          padding: '8px 16px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
          fontSize: 10,
          color: 'rgba(255,255,255,0.3)',
        }}
      >
        <span>
          {filteredPresets.length} preset{filteredPresets.length !== 1 ? 's' : ''}
          {activeCategory !== 'All' ? ` in ${activeCategory}` : ''}
        </span>
        {activePresetId && (
          <span style={{ color: '#a78bfa' }}>
            Active: {BUILT_IN_PRESETS.find((p) => p.id === activePresetId)?.name || 'Custom'}
          </span>
        )}
      </div>
    </div>
  );
};

export default PresetsPanel;
