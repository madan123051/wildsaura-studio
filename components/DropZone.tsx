import React, { useState, useCallback, useRef, useMemo } from 'react';

interface DropZoneProps {
  onFilesAdded: (files: File[]) => void;
  compact?: boolean;
}

type ShowcasePreset = {
  name: string;
  subtitle: string;
  mood: string;
  heroHeading: string;
  afterFilter: string;
  toneOverlay: string;
  ambientGlow: string;
  knobGlow: string;
  cardGlow: string;
};

const ACCEPTED_TYPES = [
  'image/jpeg', 'image/png', 'image/tiff', 'image/webp', 'image/bmp',
  'image/x-canon-cr2', 'image/x-canon-cr3', 'image/x-nikon-nef', 'image/x-sony-arw', 'image/x-adobe-dng', 'image/x-fuji-raf',
];
const ACCEPTED_EXT = '.jpg,.jpeg,.png,.tiff,.tif,.webp,.bmp,.cr2,.cr3,.nef,.arw,.dng,.raf';

const SHOWCASE_PRESETS: ShowcasePreset[] = [
  {
    name: 'WILDSAURA LOOK',
    subtitle: 'Cinematic Nature',
    mood: 'Balanced cinematic wildlife realism.',
    heroHeading: 'Wildlife Stories, Reimagined in Motion Picture Color',
    afterFilter: 'saturate(1.1) contrast(1.14) brightness(.97) hue-rotate(-7deg)',
    toneOverlay: 'linear-gradient(130deg, rgba(5,16,11,.22), rgba(16,43,26,.08) 35%, rgba(227,166,98,.16) 74%, rgba(8,14,12,.22))',
    ambientGlow: 'radial-gradient(circle at 24% 24%, rgba(140,92,246,.28), transparent 52%), radial-gradient(circle at 78% 76%, rgba(224,169,96,.22), transparent 48%)',
    knobGlow: '0 0 0 4px rgba(154,214,182,.2), 0 8px 30px rgba(0,0,0,.45)',
    cardGlow: 'rgba(212,162,76,.45)',
  },
  {
    name: 'Deep Forest',
    subtitle: 'Moody Jungle',
    mood: 'Darker greens, deeper shadows, misty rainforest atmosphere.',
    heroHeading: 'Dense jungle tonality with cinematic rain-forest depth',
    afterFilter: 'saturate(1.18) contrast(1.22) brightness(.82) hue-rotate(-16deg)',
    toneOverlay: 'linear-gradient(130deg, rgba(4,16,9,.38), rgba(8,52,28,.2) 42%, rgba(134,198,158,.14) 70%, rgba(6,12,8,.35))',
    ambientGlow: 'radial-gradient(circle at 18% 26%, rgba(45,140,91,.36), transparent 54%), radial-gradient(circle at 82% 70%, rgba(21,83,45,.4), transparent 46%)',
    knobGlow: '0 0 0 4px rgba(86,191,132,.32), 0 8px 30px rgba(0,0,0,.5)',
    cardGlow: 'rgba(86,191,132,.5)',
  },
  {
    name: 'Savanna Gold',
    subtitle: 'Golden Wildlife',
    mood: 'Golden hour warmth with amber safari documentary tones.',
    heroHeading: 'Golden-hour wildlife grading with warm cinematic dust',
    afterFilter: 'saturate(1.16) contrast(1.11) brightness(1.01) hue-rotate(-18deg) sepia(.18)',
    toneOverlay: 'linear-gradient(126deg, rgba(55,28,8,.26), rgba(168,108,32,.24) 45%, rgba(240,188,98,.28) 78%, rgba(40,20,5,.22))',
    ambientGlow: 'radial-gradient(circle at 18% 24%, rgba(221,156,64,.33), transparent 54%), radial-gradient(circle at 86% 76%, rgba(176,98,22,.28), transparent 50%)',
    knobGlow: '0 0 0 4px rgba(230,170,92,.3), 0 8px 30px rgba(0,0,0,.46)',
    cardGlow: 'rgba(230,170,92,.55)',
  },
  {
    name: 'Arctic Silence',
    subtitle: 'Frozen Atmosphere',
    mood: 'Cold cinematic blues, soft whites, and icy shadows.',
    heroHeading: 'Frozen blue mood with soft highlights and clear air',
    afterFilter: 'saturate(.96) contrast(1.08) brightness(1.02) hue-rotate(18deg)',
    toneOverlay: 'linear-gradient(130deg, rgba(13,30,51,.3), rgba(46,92,133,.24) 40%, rgba(205,232,255,.2) 78%, rgba(16,24,40,.3))',
    ambientGlow: 'radial-gradient(circle at 24% 22%, rgba(88,154,224,.35), transparent 56%), radial-gradient(circle at 78% 74%, rgba(190,229,255,.22), transparent 52%)',
    knobGlow: '0 0 0 4px rgba(119,191,255,.3), 0 8px 30px rgba(0,0,0,.46)',
    cardGlow: 'rgba(119,191,255,.52)',
  },
  {
    name: 'Rain Earth',
    subtitle: 'Monsoon Mood',
    mood: 'Wet earthy contrast, muted greens, and foggy rain feel.',
    heroHeading: 'Rain-soaked cinematic grade with earthy monsoon contrast',
    afterFilter: 'saturate(.92) contrast(1.18) brightness(.91) hue-rotate(-10deg)',
    toneOverlay: 'linear-gradient(132deg, rgba(18,20,15,.36), rgba(70,92,72,.22) 35%, rgba(126,150,134,.18) 70%, rgba(26,26,20,.38))',
    ambientGlow: 'radial-gradient(circle at 22% 24%, rgba(110,136,123,.32), transparent 56%), radial-gradient(circle at 80% 74%, rgba(64,96,82,.3), transparent 54%)',
    knobGlow: '0 0 0 4px rgba(146,171,154,.28), 0 8px 30px rgba(0,0,0,.48)',
    cardGlow: 'rgba(146,171,154,.5)',
  },
];

const DropZone: React.FC<DropZoneProps> = ({ onFilesAdded, compact = false }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(58);
  const [activePresetName, setActivePresetName] = useState<string>('WILDSAURA LOOK');
  const inputRef = useRef<HTMLInputElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const dragCounter = useRef(0);

  const activePreset = useMemo(
    () => SHOWCASE_PRESETS.find((preset) => preset.name === activePresetName) ?? SHOWCASE_PRESETS[0],
    [activePresetName],
  );

  const handleFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    const valid = Array.from(fileList).filter(
      (f) => ACCEPTED_TYPES.includes(f.type) || /\.(jpe?g|png|tiff?|webp|bmp|cr2|cr3|nef|arw|dng|raf)$/i.test(f.name)
    );
    if (valid.length > 0) onFilesAdded(valid);
  }, [onFilesAdded]);

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragCounter.current++;
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current <= 0) { dragCounter.current = 0; setIsDragging(false); }
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const onClick = useCallback(() => { inputRef.current?.click(); }, []);

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    if (inputRef.current) inputRef.current.value = '';
  }, [handleFiles]);

  const moveSlider = useCallback((clientX: number) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const next = ((clientX - rect.left) / rect.width) * 100;
    setSliderPosition(Math.max(8, Math.min(92, next)));
  }, []);

  const onSliderPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    moveSlider(e.clientX);
  }, [moveSlider]);

  const onSliderPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons === 0) return;
    moveSlider(e.clientX);
  }, [moveSlider]);

  if (compact) {
    return (
      <>
        <input ref={inputRef} type="file" accept={ACCEPTED_EXT} multiple onChange={onInputChange}
          style={{ display: 'none' }} />
        <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#a78bfa', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add
        </button>
      </>
    );
  }

  return (
    <div className="cinematic-upload-shell" onDragEnter={onDragEnter} onDragLeave={onDragLeave} onDragOver={onDragOver} onDrop={onDrop}>
      <input ref={inputRef} type="file" accept={ACCEPTED_EXT} multiple onChange={onInputChange} style={{ display: 'none' }} />
      <div className="cinematic-hero" style={{ ['--hero-ambient' as string]: activePreset.ambientGlow }}>
        <div className="cinematic-background" />
        <div className="cinematic-particles" />
        <div className="cinematic-content">
          <p className="cinematic-kicker">{activePreset.name} — {activePreset.subtitle} Color Science</p>
          <h2>{activePreset.heroHeading}</h2>
          <div className="before-after-stage" ref={sliderRef} onPointerDown={onSliderPointerDown} onPointerMove={onSliderPointerMove} style={{ ['--preset-tone-overlay' as string]: activePreset.toneOverlay }}>
            <img className="stage-source-image" src="https://images.pexels.com/photos/247502/pexels-photo-247502.jpeg?auto=compress&cs=tinysrgb&w=1920&dpr=2" alt="Cinematic tiger in natural forest light" loading="lazy" decoding="async" />
            <div className="stage-before" />
            <div className="stage-after" style={{ clipPath: `inset(0 0 0 ${sliderPosition}%)`, filter: activePreset.afterFilter }} />
            <div className="stage-labels"><span>BEFORE</span><span>AFTER</span></div>
            <div className="stage-overlay-copy">
              <h3>{activePreset.name}</h3>
              <p>{activePreset.subtitle}</p>
              <p>{activePreset.mood}</p>
            </div>
            <div className="stage-divider" style={{ left: `${sliderPosition}%` }}>
              <div className="stage-knob" style={{ boxShadow: activePreset.knobGlow }} />
            </div>
          </div>
          <button onClick={onClick} className={`cinematic-upload-cta ${isDragging ? 'dragging' : ''}`}>
            <span className="upload-icon">⬆</span>
            <span>
              <strong>{isDragging ? 'Drop your wildlife story here' : 'Upload Your Image'}</strong>
              <small>JPEG • PNG • RAW • TIFF • WebP</small>
            </span>
          </button>
          <div className="preset-card-row">
            {SHOWCASE_PRESETS.map((preset) => (
              <button
                type="button"
                key={preset.name}
                className={`preset-mini-card ${activePreset.name === preset.name ? 'active' : ''}`}
                onClick={() => setActivePresetName(preset.name)}
                style={{ ['--preset-card-glow' as string]: preset.cardGlow }}
              >
                <b>{preset.name}</b>
                <span>{preset.subtitle}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DropZone;
