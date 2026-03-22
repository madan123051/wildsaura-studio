import React, { useCallback, useRef } from 'react';

export interface LUTPreset {
  id: string;
  name: string;
  data: Float32Array | null;  // null = "OFF"
  size: number;
  isCustom?: boolean;
}

// Short display names for built-in presets (two lines)
const SHORT_NAMES: Record<string, [string, string]> = {
  'Midnight Teal':   ['Midnight',  'Teal'],
  'Vintage Soul':    ['Vintage',   'Soul'],
  'Wild Aura':       ['Wild',      'Aura'],
  'Deep Forest':     ['Deep',      'Forest'],
  'Golden Hour':     ['Golden',    'Hour'],
  'Arctic Breeze':   ['Arctic',    'Breeze'],
  'Desert Ember':    ['Desert',    'Ember'],
  'Ocean Mist':      ['Ocean',     'Mist'],
  'Neon Dusk':       ['Neon',      'Dusk'],
  'Shadow Bloom':    ['Shadow',    'Bloom'],
  'Ember Frost':     ['Ember',     'Frost'],
  'Velvet Night':    ['Velvet',    'Night'],
  'Solar Flare':     ['Solar',     'Flare'],
  'Mossy Stone':     ['Mossy',     'Stone'],
  'Crimson Tide':    ['Crimson',   'Tide'],
  'Lavender Haze':   ['Lavender',  'Haze'],
  'Rustic Charm':    ['Rustic',    'Charm'],
  'Boreal Light':    ['Boreal',    'Light'],
  'Copper Patina':   ['Copper',    'Patina'],
  'Silent Storm':    ['Silent',    'Storm'],
};

// Gradient colors for preset circles
const PRESET_GRADIENTS: string[] = [
  'linear-gradient(135deg, #0d9488, #134e4a)',
  'linear-gradient(135deg, #d4a574, #8b6914)',
  'linear-gradient(135deg, #a855f7, #6d28d9)',
  'linear-gradient(135deg, #166534, #052e16)',
  'linear-gradient(135deg, #f59e0b, #d97706)',
  'linear-gradient(135deg, #67e8f9, #0891b2)',
  'linear-gradient(135deg, #f97316, #b45309)',
  'linear-gradient(135deg, #06b6d4, #155e75)',
  'linear-gradient(135deg, #ec4899, #7c3aed)',
  'linear-gradient(135deg, #8b5cf6, #3b0764)',
  'linear-gradient(135deg, #ef4444, #60a5fa)',
  'linear-gradient(135deg, #312e81, #1e1b4b)',
  'linear-gradient(135deg, #fbbf24, #dc2626)',
  'linear-gradient(135deg, #4ade80, #365314)',
  'linear-gradient(135deg, #dc2626, #7f1d1d)',
  'linear-gradient(135deg, #c084fc, #7e22ce)',
  'linear-gradient(135deg, #a16207, #713f12)',
  'linear-gradient(135deg, #22d3ee, #0e7490)',
  'linear-gradient(135deg, #c2956a, #78350f)',
  'linear-gradient(135deg, #6b7280, #1f2937)',
];

function parseCubeFile(text: string): { data: Float32Array; size: number; name: string } | null {
  const lines = text.split('\n');
  let size = 0;
  let title = 'Custom LUT';
  const values: number[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('TITLE')) {
      title = trimmed.replace(/^TITLE\s+"?/, '').replace(/"?\s*$/, '');
      continue;
    }
    if (trimmed.startsWith('LUT_3D_SIZE')) {
      size = parseInt(trimmed.split(/\s+/)[1], 10);
      continue;
    }
    if (trimmed.startsWith('DOMAIN_MIN') || trimmed.startsWith('DOMAIN_MAX')) continue;

    const parts = trimmed.split(/\s+/).map(Number);
    if (parts.length >= 3 && !parts.some(isNaN)) {
      values.push(parts[0], parts[1], parts[2]);
    }
  }

  if (size === 0 || values.length < size * size * size * 3) return null;

  return { data: new Float32Array(values), size, name: title };
}

interface LUTPanelProps {
  presets: LUTPreset[];
  activeLutId: string | null;
  intensity: number;
  onSelectLut: (id: string | null) => void;
  onIntensityChange: (v: number) => void;
  onAddCustomLut: (preset: LUTPreset) => void;
}

const LUTPanel: React.FC<LUTPanelProps> = ({
  presets,
  activeLutId,
  intensity,
  onSelectLut,
  onIntensityChange,
  onAddCustomLut,
}) => {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUploadCube = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const parsed = parseCubeFile(text);
      if (parsed) {
        onAddCustomLut({
          id: 'custom_' + Date.now(),
          name: parsed.name || file.name.replace('.cube', ''),
          data: parsed.data,
          size: parsed.size,
          isCustom: true,
        });
      }
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = '';
  }, [onAddCustomLut]);

  return (
    <div>
      <div className="lut-strip">
        {/* OFF preset */}
        <div
          className={`lut-thumb${activeLutId === null ? ' active' : ''}`}
          onClick={() => onSelectLut(null)}
        >
          <div className="lut-circle" style={{
            background: activeLutId === null ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
          }}>
            <span className="lut-name-text" style={{
              color: activeLutId === null ? 'var(--accent)' : 'var(--text-muted)',
              fontSize: 11,
              fontWeight: 800,
            }}>OFF</span>
          </div>
          <div className="lut-label">Original</div>
        </div>

        {/* Preset items */}
        {presets.map((preset, i) => {
          const isActive = activeLutId === preset.id;
          const shortName = SHORT_NAMES[preset.name];
          const gradient = PRESET_GRADIENTS[i % PRESET_GRADIENTS.length];

          return (
            <div
              key={preset.id}
              className={`lut-thumb${isActive ? ' active' : ''}`}
              onClick={() => onSelectLut(preset.id)}
            >
              <div className="lut-circle" style={{
                background: isActive ? undefined : gradient,
              }}>
                {shortName ? (
                  <>
                    <span className="lut-name-line1">{shortName[0]}</span>
                    <span className="lut-name-line2">{shortName[1]}</span>
                  </>
                ) : (
                  <span className="lut-name-text" style={{ fontSize: 8, padding: '0 2px', textAlign: 'center', lineHeight: 1.1 }}>
                    {preset.name.length > 10 ? preset.name.slice(0, 10) : preset.name}
                  </span>
                )}
              </div>
              <div className="lut-label">
                {preset.name.length > 12 ? preset.name.slice(0, 11) + '…' : preset.name}
              </div>
            </div>
          );
        })}

        {/* Upload .cube button */}
        <div className="lut-thumb" onClick={() => fileRef.current?.click()}>
          <div className="lut-circle" style={{
            background: 'transparent',
            border: '2px dashed rgba(255,255,255,0.1)',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
          <div className="lut-label">.cube</div>
        </div>
        <input ref={fileRef} type="file" accept=".cube" onChange={handleUploadCube} style={{ display: 'none' }} />
      </div>

      {/* Intensity slider (inline, shown when a preset is selected) */}
      {activeLutId !== null && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '6px 12px 4px',
        }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', fontWeight: 600 }}>
            Intensity
          </span>
          <input
            type="range"
            min={0} max={100} value={intensity}
            onChange={(e) => onIntensityChange(Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <span style={{
            fontSize: 11, fontWeight: 700, color: 'var(--accent)',
            minWidth: 32, textAlign: 'right',
          }}>
            {intensity}%
          </span>
        </div>
      )}
    </div>
  );
};

export { parseCubeFile, SHORT_NAMES };
export default LUTPanel;
