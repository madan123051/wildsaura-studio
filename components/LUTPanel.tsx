import React, { useRef } from 'react';
import { Upload } from 'lucide-react';
import { ActiveLUT, LUTPreset, CubeLUT } from '../types';
import { LUT_PRESETS } from '../utils/lutData';

interface Props {
  activeLut: ActiveLUT;
  intensity: number;
  previewUrl: string | null;
  onSelectPreset: (preset: LUTPreset | null) => void;
  onLoadCube: (lut: CubeLUT, name: string) => void;
  onClearLut: () => void;
  onIntensityChange: (val: number) => void;
}

function parseCubeFile(text: string): CubeLUT | null {
  const lines = text.split('\n');
  let size = 0;
  let title = 'Custom LUT';
  const rawData: number[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('LUT_3D_SIZE')) {
      size = parseInt(trimmed.split(/\s+/)[1]);
    } else if (trimmed.startsWith('TITLE')) {
      title = trimmed.replace(/^TITLE\s*"?/, '').replace(/"?\s*$/, '') || title;
    } else if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('DOMAIN')) {
      const parts = trimmed.split(/\s+/).map(Number);
      if (parts.length >= 3 && !isNaN(parts[0])) {
        rawData.push(parts[0], parts[1], parts[2]);
      }
    }
  }
  if (size > 0 && rawData.length === size * size * size * 3) {
    return { title, size, data: new Float32Array(rawData) };
  }
  return null;
}

// Short display names for each LUT — 2 lines max
const SHORT_NAMES: Record<string, [string, string]> = {
  'midnight-teal':   ['Midnight', 'Teal'],
  'vintage-soul':    ['Vintage', 'Soul'],
  'wild-aura-gold':  ['Wild Aura', 'Gold'],
  'deep-forest':     ['Deep', 'Forest'],
  'kodak-250d':      ['Kodak', '250D'],
  'shadow-whisper':  ['Shadow', 'Whisper'],
  'tungsten-night':  ['Tungsten', 'Night'],
  'ethereal-mist':   ['Ethereal', 'Mist'],
  'bw-noir':         ['B&W', 'Noir'],
  'safari-earth':    ['Safari', 'Earth'],
  'nordic-blue':     ['Nordic', 'Blue'],
  'cinematic-punch': ['Cinematic', 'Punch'],
};

export const LUTPanel: React.FC<Props> = ({
  activeLut, intensity, previewUrl, onSelectPreset, onLoadCube, onClearLut, onIntensityChange,
}) => {
  const cubeInputRef = useRef<HTMLInputElement>(null);
  const activePresetId = activeLut?.type === 'preset' ? activeLut.presetId : null;

  const handleCubeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const lut = parseCubeFile(reader.result as string);
      if (lut) onLoadCube(lut, file.name);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div>
      {/* Section title */}
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-xs font-semibold tracking-wider uppercase" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Filters
        </span>
        <button
          onClick={() => cubeInputRef.current?.click()}
          className="flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-full"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <Upload size={10} /> .cube
        </button>
        <input ref={cubeInputRef} type="file" accept=".cube" className="hidden" onChange={handleCubeUpload} />
      </div>

      {/* Horizontal LUT strip — names on circles */}
      <div className="lut-strip">
        {/* None / Original */}
        <div
          className={`lut-thumb ${!activeLut ? 'active' : ''}`}
          onClick={() => onClearLut()}
        >
          <div className="lut-circle lut-name-circle" style={{ background: 'rgba(255,255,255,0.04)', border: !activeLut ? '2px solid rgba(255,255,255,0.5)' : undefined }}>
            <span className="lut-name-text">OFF</span>
          </div>
          <div className="lut-label">Original</div>
        </div>

        {LUT_PRESETS.map(preset => {
          const isActive = activePresetId === preset.id;
          const names = SHORT_NAMES[preset.id] || [preset.name, ''];
          return (
            <div
              key={preset.id}
              className={`lut-thumb ${isActive ? 'active' : ''}`}
              onClick={() => onSelectPreset(isActive ? null : preset)}
            >
              <div
                className="lut-circle lut-name-circle"
                style={{
                  background: isActive ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                  border: isActive ? '2px solid rgba(168,85,247,0.7)' : undefined,
                }}
              >
                <span className="lut-name-line1">{names[0]}</span>
                <span className="lut-name-line2">{names[1]}</span>
              </div>
              <div className="lut-label">{preset.name}</div>
            </div>
          );
        })}

        {/* Cube LUT if loaded */}
        {activeLut?.type === 'cube' && (
          <div className="lut-thumb active">
            <div className="lut-circle lut-name-circle" style={{ background: 'rgba(99,102,241,0.2)', border: '2px solid rgba(168,85,247,0.7)' }}>
              <span className="lut-name-line1">.cube</span>
              <span className="lut-name-line2">Custom</span>
            </div>
            <div className="lut-label">{activeLut.name.slice(0, 12)}</div>
          </div>
        )}
      </div>

      {/* Intensity slider — only show when a LUT is active */}
      {activeLut && (
        <div className="mt-3 px-1">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Intensity
            </span>
            <span className="text-xs font-semibold" style={{ color: '#a78bfa' }}>
              {Math.round(intensity * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(intensity * 100)}
            onChange={e => onIntensityChange(parseInt(e.target.value) / 100)}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
};
