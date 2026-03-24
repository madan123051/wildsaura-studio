import React, { useState, useCallback, useMemo } from 'react';
import type { EditAdjustments, HSLState, HSLAdjustment } from '../types';
import type { LUTPreset } from './LUTPanel';

interface ConversionSettingsData {
  quality: number;
  resize4k: boolean;
  lossless: boolean;
  smartName: boolean;
  keepExif: boolean;
  autoConvert: boolean;
}

interface EditPanelProps {
  adjustments: EditAdjustments;
  onAdjustmentsChange: (adj: EditAdjustments) => void;
  hslState: HSLState;
  onHSLChange: (hsl: HSLState) => void;
  presets: LUTPreset[];
  activeLutId: string | null;
  intensity: number;
  onSelectLut: (id: string | null) => void;
  onIntensityChange: (v: number) => void;
  onAddCustomLut: (preset: LUTPreset) => void;
  settings: ConversionSettingsData;
  onSettingsChange: (s: ConversionSettingsData) => void;
  onConvertAll: () => void;
  onDownloadZip: () => void;
  onReset: () => void;
  onClearAll: () => void;
  isProcessingAll: boolean;
  fileStats: { total: number; done: number; pending: number; totalBefore: number; totalAfter: number };
  onResetAdjustments: () => void;
}

// ─── Internal Slider ────────────────────────────────────────────────────────

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  gradient?: string;
  centered?: boolean;
}

const Slider: React.FC<SliderProps> = ({ label, value, min, max, onChange, gradient, centered }) => {
  const [hovering, setHovering] = useState(false);
  const range = max - min;
  const pct = ((value - min) / range) * 100;
  const centerPct = ((0 - min) / range) * 100;
  const isCentered = centered !== undefined ? centered : min < 0;

  let fillStyle: string;
  if (isCentered) {
    const left = Math.min(centerPct, pct);
    const width = Math.abs(pct - centerPct);
    fillStyle = `position:absolute;top:0;left:${left}%;width:${width}%;height:100%;border-radius:2px;background:linear-gradient(90deg,#6366f1,#a78bfa);`;
  } else {
    fillStyle = `position:absolute;top:0;left:0;width:${pct}%;height:100%;border-radius:2px;background:linear-gradient(90deg,#6366f1,#a78bfa);`;
  }

  const trackBg = gradient || 'rgba(255,255,255,0.08)';

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '3px 0' }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span
          style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.6)',
            cursor: 'pointer',
            userSelect: 'none',
          }}
          onDoubleClick={() => onChange(isCentered ? 0 : min)}
          title="Double-click to reset"
        >
          {label}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: value !== 0 && value !== min ? '#a78bfa' : 'rgba(255,255,255,0.3)',
            fontVariantNumeric: 'tabular-nums',
            minWidth: 28,
            textAlign: 'right',
          }}
        >
          {value > 0 && isCentered ? `+${value}` : value}
        </span>
      </div>
      <div
        style={{
          position: 'relative',
          height: 14,
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
        }}
        onMouseDown={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const update = (clientX: number) => {
            const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            const raw = min + ratio * range;
            onChange(Math.round(raw));
          };
          update(e.clientX);
          const onMove = (ev: MouseEvent) => update(ev.clientX);
          const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
          };
          window.addEventListener('mousemove', onMove);
          window.addEventListener('mouseup', onUp);
        }}
      >
        {/* Track */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            height: 3,
            borderRadius: 2,
            transform: 'translateY(-50%)',
            background: trackBg,
            overflow: 'hidden',
          }}
        >
          {/* Fill */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: isCentered ? `${Math.min(centerPct, pct)}%` : '0%',
              width: isCentered ? `${Math.abs(pct - centerPct)}%` : `${pct}%`,
              height: '100%',
              borderRadius: 2,
              background: 'linear-gradient(90deg,#6366f1,#a78bfa)',
            }}
          />
        </div>
        {/* Center tick for centered sliders */}
        {isCentered && (
          <div
            style={{
              position: 'absolute',
              left: `${centerPct}%`,
              top: '50%',
              transform: 'translate(-50%,-50%)',
              width: 1,
              height: 7,
              background: 'rgba(255,255,255,0.15)',
              borderRadius: 1,
            }}
          />
        )}
        {/* Knob */}
        <div
          style={{
            position: 'absolute',
            left: `${pct}%`,
            top: '50%',
            transform: 'translate(-50%,-50%)',
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: '#f0f0f5',
            border: '2px solid #6366f1',
            boxShadow:
              value !== 0 && value !== min
                ? '0 0 6px rgba(99,102,241,0.5)'
                : '0 1px 3px rgba(0,0,0,0.4)',
            transition: 'box-shadow 0.15s',
          }}
        />
      </div>
    </div>
  );
};

// ─── Internal Toggle ────────────────────────────────────────────────────────

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

const Toggle: React.FC<ToggleProps> = ({ label, checked, onChange }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '4px 0',
      cursor: 'pointer',
    }}
    onClick={() => onChange(!checked)}
  >
    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{label}</span>
    <div
      style={{
        width: 28,
        height: 14,
        borderRadius: 7,
        background: checked
          ? 'linear-gradient(90deg,#6366f1,#a78bfa)'
          : 'rgba(255,255,255,0.1)',
        position: 'relative',
        transition: 'background 0.2s',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 14 : 2,
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: '#f0f0f5',
          transition: 'left 0.2s',
          boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
        }}
      />
    </div>
  </div>
);

// ─── Collapsible Section ────────────────────────────────────────────────────

interface SectionProps {
  title: string;
  icon: string;
  children: React.ReactNode;
  hasNonZero: boolean;
  onReset?: () => void;
  defaultOpen?: boolean;
}

const Section: React.FC<SectionProps> = ({
  title,
  icon,
  children,
  hasNonZero,
  onReset,
  defaultOpen = true,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 8px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setOpen(!open)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12 }}>{icon}</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: '#f0f0f5',
            }}
          >
            {title}
          </span>
          {hasNonZero && (
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: '#a78bfa',
                boxShadow: '0 0 4px rgba(167,139,250,0.6)',
              }}
            />
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {onReset && hovered && hasNonZero && (
            <span
              style={{
                fontSize: 13,
                color: 'rgba(255,255,255,0.4)',
                cursor: 'pointer',
                lineHeight: 1,
                padding: '0 4px',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onReset();
              }}
              title="Reset section"
            >
              ↺
            </span>
          )}
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            style={{
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
            }}
          >
            <path d="M3 4.5L6 7.5L9 4.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      <div
        style={{
          maxHeight: open ? 1000 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.3s ease',
          padding: open ? '0 8px 8px' : '0 8px 0',
        }}
      >
        {children}
      </div>
    </div>
  );
};

// ─── HSL Color Channels ─────────────────────────────────────────────────────

const HSL_CHANNELS: { key: string; label: string; color: string }[] = [
  { key: 'red', label: 'Red', color: '#ef4444' },
  { key: 'orange', label: 'Orange', color: '#f97316' },
  { key: 'yellow', label: 'Yellow', color: '#eab308' },
  { key: 'green', label: 'Green', color: '#22c55e' },
  { key: 'cyan', label: 'Cyan', color: '#06b6d4' },
  { key: 'blue', label: 'Blue', color: '#3b82f6' },
  { key: 'purple', label: 'Purple', color: '#a855f7' },
  { key: 'magenta', label: 'Magenta', color: '#ec4899' },
];

// ─── Main Component ─────────────────────────────────────────────────────────

const EditPanel: React.FC<EditPanelProps> = ({
  adjustments,
  onAdjustmentsChange,
  hslState,
  onHSLChange,
  presets,
  activeLutId,
  intensity,
  onSelectLut,
  onIntensityChange,
  onAddCustomLut,
  settings,
  onSettingsChange,
  onConvertAll,
  onDownloadZip,
  onReset,
  onClearAll,
  isProcessingAll,
  fileStats,
  onResetAdjustments,
}) => {
  const [selectedHslChannel, setSelectedHslChannel] = useState<string>('red');

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const updateAdj = useCallback(
    (key: keyof EditAdjustments, value: number) => {
      onAdjustmentsChange({ ...adjustments, [key]: value });
    },
    [adjustments, onAdjustmentsChange]
  );

  const updateSettings = useCallback(
    (patch: Partial<ConversionSettingsData>) => {
      onSettingsChange({ ...settings, ...patch });
    },
    [settings, onSettingsChange]
  );

  const updateHsl = useCallback(
    (channel: string, field: keyof HSLAdjustment, value: number) => {
      const current = (hslState as unknown as Record<string, HSLAdjustment>)[channel] || { hue: 0, saturation: 0, luminance: 0 };
      onHSLChange({
        ...hslState,
        [channel]: { ...current, [field]: value },
      });
    },
    [hslState, onHSLChange]
  );

  const lightNonZero = useMemo(
    () =>
      adjustments.exposure !== 0 ||
      adjustments.contrast !== 0 ||
      adjustments.highlights !== 0 ||
      adjustments.shadows !== 0 ||
      adjustments.whites !== 0 ||
      adjustments.blacks !== 0,
    [adjustments]
  );

  const colorNonZero = useMemo(
    () =>
      adjustments.temperature !== 0 ||
      adjustments.tint !== 0 ||
      adjustments.vibrance !== 0 ||
      adjustments.saturation !== 0,
    [adjustments]
  );

  const detailsNonZero = useMemo(
    () =>
      adjustments.clarity !== 0 ||
      adjustments.sharpness !== 0 ||
      adjustments.denoise !== 0,
    [adjustments]
  );

  const creativeNonZero = useMemo(
    () =>
      adjustments.vignette !== 0 ||
      adjustments.grain !== 0 ||
      adjustments.fog !== 0,
    [adjustments]
  );

  const hslNonZero = useMemo(() => {
    return Object.values(hslState).some(
      (ch: HSLAdjustment) => ch.hue !== 0 || ch.saturation !== 0 || ch.luminance !== 0
    );
  }, [hslState]);

  const lutNonZero = activeLutId !== null;

  const exportNonZero = false;

  const currentHsl: HSLAdjustment = (hslState as unknown as Record<string, HSLAdjustment>)[selectedHslChannel] || {
    hue: 0,
    saturation: 0,
    luminance: 0,
  };

  const activeLut = presets.find((p) => p.id === activeLutId);

  const handleCubeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      onAddCustomLut({
        id: `custom-${Date.now()}`,
        name: file.name.replace('.cube', ''),
        data: null,
        size: 0,
        isCustom: true,
      } as LUTPreset);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        background: 'var(--bg-secondary, #151525)',
        color: 'var(--text-primary, #f0f0f5)',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(255,255,255,0.08) transparent',
      }}
    >
      {/* ── Section 1: Light ─────────────────────────────────── */}
      <Section
        title="Light"
        icon="☀️"
        hasNonZero={lightNonZero}
        onReset={() => {
          onAdjustmentsChange({
            ...adjustments,
            exposure: 0,
            contrast: 0,
            highlights: 0,
            shadows: 0,
            whites: 0,
            blacks: 0,
          });
        }}
      >
        <Slider label="Exposure" value={adjustments.exposure} min={-100} max={100} onChange={(v) => updateAdj('exposure', v)} centered />
        <Slider label="Contrast" value={adjustments.contrast} min={-100} max={100} onChange={(v) => updateAdj('contrast', v)} centered />
        <Slider label="Highlights" value={adjustments.highlights} min={-100} max={100} onChange={(v) => updateAdj('highlights', v)} centered />
        <Slider label="Shadows" value={adjustments.shadows} min={-100} max={100} onChange={(v) => updateAdj('shadows', v)} centered />
        <Slider label="Whites" value={adjustments.whites} min={-100} max={100} onChange={(v) => updateAdj('whites', v)} centered />
        <Slider label="Blacks" value={adjustments.blacks} min={-100} max={100} onChange={(v) => updateAdj('blacks', v)} centered />
      </Section>

      {/* ── Section 2: Color ─────────────────────────────────── */}
      <Section
        title="Color"
        icon="🎨"
        hasNonZero={colorNonZero}
        onReset={() => {
          onAdjustmentsChange({
            ...adjustments,
            temperature: 0,
            tint: 0,
            vibrance: 0,
            saturation: 0,
          });
        }}
      >
        <Slider
          label="Temperature"
          value={adjustments.temperature}
          min={-100}
          max={100}
          onChange={(v) => updateAdj('temperature', v)}
          gradient="linear-gradient(90deg, #3b82f6, #fbbf24, #f97316)"
          centered
        />
        <Slider
          label="Tint"
          value={adjustments.tint}
          min={-100}
          max={100}
          onChange={(v) => updateAdj('tint', v)}
          gradient="linear-gradient(90deg, #22c55e, #d4d4d8, #ec4899)"
          centered
        />
        <Slider label="Vibrance" value={adjustments.vibrance} min={-100} max={100} onChange={(v) => updateAdj('vibrance', v)} centered />
        <Slider label="Saturation" value={adjustments.saturation} min={-100} max={100} onChange={(v) => updateAdj('saturation', v)} centered />
      </Section>

      {/* ── Section 3: Details ───────────────────────────────── */}
      <Section
        title="Details"
        icon="🔍"
        hasNonZero={detailsNonZero}
        onReset={() => {
          onAdjustmentsChange({
            ...adjustments,
            clarity: 0,
            sharpness: 0,
            denoise: 0,
          });
        }}
      >
        <Slider label="Clarity" value={adjustments.clarity} min={0} max={100} onChange={(v) => updateAdj('clarity', v)} centered={false} />
        <Slider label="Sharpness" value={adjustments.sharpness} min={0} max={100} onChange={(v) => updateAdj('sharpness', v)} centered={false} />
        <Slider label="Denoise" value={adjustments.denoise} min={0} max={100} onChange={(v) => updateAdj('denoise', v)} centered={false} />
      </Section>

      {/* ── Section 4: Creative ──────────────────────────────── */}
      <Section
        title="Creative"
        icon="✨"
        hasNonZero={creativeNonZero}
        onReset={() => {
          onAdjustmentsChange({
            ...adjustments,
            vignette: 0,
            grain: 0,
            fog: 0,
          });
        }}
      >
        <Slider label="Vignette" value={adjustments.vignette} min={0} max={100} onChange={(v) => updateAdj('vignette', v)} centered={false} />
        <Slider label="Film Grain" value={adjustments.grain} min={0} max={100} onChange={(v) => updateAdj('grain', v)} centered={false} />
        <Slider label="Fog / Atmosphere" value={adjustments.fog} min={0} max={100} onChange={(v) => updateAdj('fog', v)} centered={false} />
      </Section>

      {/* ── Section 5: HSL ───────────────────────────────────── */}
      <Section
        title="HSL"
        icon="🌈"
        hasNonZero={hslNonZero}
        defaultOpen={false}
        onReset={() => {
          const reset: HSLState = {} as HSLState;
          HSL_CHANNELS.forEach((ch) => {
            (reset as any)[ch.key] = { hue: 0, saturation: 0, luminance: 0 };
          });
          onHSLChange(reset);
        }}
      >
        {/* Channel selector */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            justifyContent: 'center',
            padding: '4px 0 8px',
            flexWrap: 'wrap',
          }}
        >
          {HSL_CHANNELS.map((ch) => {
            const isActive = selectedHslChannel === ch.key;
            const chVal = (hslState as unknown as Record<string, HSLAdjustment>)[ch.key] as HSLAdjustment | undefined;
            const hasValue = chVal && (chVal.hue !== 0 || chVal.saturation !== 0 || chVal.luminance !== 0);
            return (
              <div
                key={ch.key}
                title={ch.label}
                onClick={() => setSelectedHslChannel(ch.key)}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: ch.color,
                  cursor: 'pointer',
                  border: isActive ? '2px solid #f0f0f5' : '2px solid transparent',
                  boxShadow: isActive
                    ? `0 0 8px ${ch.color}88`
                    : hasValue
                    ? `0 0 4px ${ch.color}66`
                    : 'none',
                  transition: 'all 0.15s',
                  opacity: isActive ? 1 : 0.65,
                }}
              />
            );
          })}
        </div>
        <div style={{ fontSize: 10, textAlign: 'center', color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
          {HSL_CHANNELS.find((c) => c.key === selectedHslChannel)?.label}
        </div>
        <Slider
          label="Hue"
          value={currentHsl.hue}
          min={-180}
          max={180}
          onChange={(v) => updateHsl(selectedHslChannel, 'hue', v)}
          centered
        />
        <Slider
          label="Saturation"
          value={currentHsl.saturation}
          min={-100}
          max={100}
          onChange={(v) => updateHsl(selectedHslChannel, 'saturation', v)}
          centered
        />
        <Slider
          label="Luminance"
          value={currentHsl.luminance}
          min={-100}
          max={100}
          onChange={(v) => updateHsl(selectedHslChannel, 'luminance', v)}
          centered
        />
      </Section>

      {/* ── Section 6: LUT Color Grading ────────────────────── */}
      <Section
        title="LUT Color Grading"
        icon="🎬"
        hasNonZero={lutNonZero}
        defaultOpen={false}
        onReset={() => onSelectLut(null)}
      >
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
          Active: <span style={{ color: activeLut ? '#a78bfa' : 'rgba(255,255,255,0.3)' }}>{activeLut?.name || 'None'}</span>
        </div>
        <Slider
          label="Intensity"
          value={intensity}
          min={0}
          max={100}
          onChange={onIntensityChange}
          centered={false}
        />
        {/* LUT chips */}
        <div
          style={{
            display: 'flex',
            gap: 4,
            overflowX: 'auto',
            padding: '6px 0',
            scrollbarWidth: 'thin',
          }}
        >
          <div
            onClick={() => onSelectLut(null)}
            style={{
              flexShrink: 0,
              padding: '3px 8px',
              borderRadius: 4,
              fontSize: 10,
              cursor: 'pointer',
              background: activeLutId === null ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.05)',
              border: activeLutId === null ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.06)',
              color: activeLutId === null ? '#a78bfa' : 'rgba(255,255,255,0.5)',
              whiteSpace: 'nowrap',
            }}
          >
            None
          </div>
          {presets.map((p) => (
            <div
              key={p.id}
              onClick={() => onSelectLut(p.id)}
              style={{
                flexShrink: 0,
                padding: '3px 8px',
                borderRadius: 4,
                fontSize: 10,
                cursor: 'pointer',
                background: activeLutId === p.id ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.05)',
                border: activeLutId === p.id ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.06)',
                color: activeLutId === p.id ? '#a78bfa' : 'rgba(255,255,255,0.5)',
                whiteSpace: 'nowrap',
              }}
            >
              {p.name}
            </div>
          ))}
        </div>
        {/* Upload .cube */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".cube"
          style={{ display: 'none' }}
          onChange={handleCubeUpload}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            width: '100%',
            padding: '5px 0',
            background: 'rgba(255,255,255,0.04)',
            border: '1px dashed rgba(255,255,255,0.12)',
            borderRadius: 4,
            color: 'rgba(255,255,255,0.45)',
            fontSize: 10,
            cursor: 'pointer',
            marginTop: 4,
          }}
        >
          + Upload .cube File
        </button>
      </Section>

      {/* ── Section 7: Export ────────────────────────────────── */}
      <Section title="Export" icon="📤" hasNonZero={exportNonZero}>
        <Slider
          label="Quality"
          value={settings.quality}
          min={1}
          max={100}
          onChange={(v) => updateSettings({ quality: v })}
          centered={false}
        />
        <Toggle label="Resize to 4K max" checked={settings.resize4k} onChange={(v) => updateSettings({ resize4k: v })} />
        <Toggle label="Lossless WebP" checked={settings.lossless} onChange={(v) => updateSettings({ lossless: v })} />
        <Toggle label="Smart naming" checked={settings.smartName} onChange={(v) => updateSettings({ smartName: v })} />
        <Toggle label="Keep EXIF" checked={settings.keepExif} onChange={(v) => updateSettings({ keepExif: v })} />
        <Toggle label="Auto-convert on drop" checked={settings.autoConvert} onChange={(v) => updateSettings({ autoConvert: v })} />

        {/* Stats */}
        {fileStats.total > 0 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 10,
              color: 'rgba(255,255,255,0.35)',
              padding: '6px 0 2px',
              borderTop: '1px solid rgba(255,255,255,0.04)',
              marginTop: 6,
            }}
          >
            <span>{fileStats.done}/{fileStats.total} done</span>
            {fileStats.totalBefore > 0 && (
              <span>
                {formatBytes(fileStats.totalBefore)} → {formatBytes(fileStats.totalAfter)}
              </span>
            )}
          </div>
        )}

        {/* Convert All */}
        <button
          onClick={onConvertAll}
          disabled={isProcessingAll || fileStats.pending === 0}
          style={{
            width: '100%',
            padding: '8px 0',
            marginTop: 8,
            borderRadius: 6,
            border: 'none',
            fontWeight: 600,
            fontSize: 12,
            cursor: isProcessingAll || fileStats.pending === 0 ? 'not-allowed' : 'pointer',
            background: isProcessingAll
              ? 'linear-gradient(90deg, #6366f1, #a78bfa)'
              : fileStats.pending === 0
              ? 'rgba(255,255,255,0.06)'
              : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: fileStats.pending === 0 ? 'rgba(255,255,255,0.25)' : '#fff',
            opacity: isProcessingAll ? 0.8 : 1,
            animation: isProcessingAll ? 'pulse 1.5s ease-in-out infinite' : 'none',
          }}
        >
          {isProcessingAll
            ? `Processing… ${fileStats.done}/${fileStats.total}`
            : fileStats.pending > 0
            ? `Convert All (${fileStats.pending})`
            : 'All Converted'}
        </button>

        {/* Download ZIP */}
        <button
          onClick={onDownloadZip}
          disabled={fileStats.done === 0}
          style={{
            width: '100%',
            padding: '7px 0',
            marginTop: 4,
            borderRadius: 6,
            fontWeight: 600,
            fontSize: 11,
            cursor: fileStats.done === 0 ? 'not-allowed' : 'pointer',
            background: fileStats.done > 0 ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.04)',
            color: fileStats.done > 0 ? '#4ade80' : 'rgba(255,255,255,0.2)',
            border: fileStats.done > 0 ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(255,255,255,0.04)',
          }}
        >
          {fileStats.done > 0 ? `Download ZIP (${fileStats.done})` : 'Download ZIP'}
        </button>

        {/* Reset / Clear */}
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button
            onClick={onReset}
            style={{
              flex: 1,
              padding: '5px 0',
              borderRadius: 4,
              border: '1px solid rgba(255,255,255,0.06)',
              background: 'transparent',
              color: 'rgba(255,255,255,0.4)',
              fontSize: 10,
              cursor: 'pointer',
            }}
          >
            Reset Settings
          </button>
          <button
            onClick={onClearAll}
            style={{
              flex: 1,
              padding: '5px 0',
              borderRadius: 4,
              border: '1px solid rgba(239,68,68,0.15)',
              background: 'transparent',
              color: 'rgba(239,68,68,0.6)',
              fontSize: 10,
              cursor: 'pointer',
            }}
          >
            Clear All Files
          </button>
        </div>
      </Section>

      {/* Global Reset Adjustments */}
      <div style={{ padding: 8 }}>
        <button
          onClick={onResetAdjustments}
          style={{
            width: '100%',
            padding: '6px 0',
            borderRadius: 4,
            border: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.02)',
            color: 'rgba(255,255,255,0.35)',
            fontSize: 10,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'rgba(255,255,255,0.6)';
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'rgba(255,255,255,0.35)';
            e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
          }}
        >
          ↺ Reset All Adjustments
        </button>
      </div>
    </div>
  );
};

export default EditPanel;
