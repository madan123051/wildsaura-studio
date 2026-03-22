// ============================================================
// WildSaura Pro Studio — Built-in Preset Definitions
// ============================================================

export interface PresetDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  adjustments: {
    exposure?: number;
    contrast?: number;
    highlights?: number;
    shadows?: number;
    whites?: number;
    blacks?: number;
    temperature?: number;
    tint?: number;
    vibrance?: number;
    saturation?: number;
    clarity?: number;
    sharpness?: number;
    denoise?: number;
    vignette?: number;
    grain?: number;
    fog?: number;
  };
}

export const PRESET_CATEGORIES = [
  'Essentials',
  'Portrait',
  'Landscape',
  'Cinematic',
  'Street',
  'Film',
  'B&W',
] as const;

export type PresetCategory = (typeof PRESET_CATEGORIES)[number];

export const BUILT_IN_PRESETS: PresetDefinition[] = [
  // ======================== Essentials ========================
  {
    id: 'auto_enhance',
    name: 'Auto Enhance',
    category: 'Essentials',
    description: 'Balanced auto improvement',
    adjustments: { exposure: 10, contrast: 15, vibrance: 20, clarity: 15, sharpness: 10 },
  },
  {
    id: 'vivid',
    name: 'Vivid',
    category: 'Essentials',
    description: 'Rich vibrant colors',
    adjustments: { contrast: 20, vibrance: 40, saturation: 15, clarity: 10 },
  },
  {
    id: 'natural',
    name: 'Natural Light',
    category: 'Essentials',
    description: 'Soft natural look',
    adjustments: { exposure: 5, highlights: -10, shadows: 20, vibrance: 10, temperature: 5 },
  },
  {
    id: 'dramatic',
    name: 'Dramatic',
    category: 'Essentials',
    description: 'High impact dramatic look',
    adjustments: { contrast: 35, highlights: -20, blacks: -15, clarity: 30, vibrance: 15, vignette: 25 },
  },
  {
    id: 'clean',
    name: 'Clean & Bright',
    category: 'Essentials',
    description: 'Clean bright aesthetic',
    adjustments: { exposure: 15, contrast: -5, highlights: -15, shadows: 30, whites: 10, vibrance: 10 },
  },

  // ======================== Portrait ========================
  {
    id: 'soft_glow',
    name: 'Soft Glow',
    category: 'Portrait',
    description: 'Dreamy portrait glow',
    adjustments: { exposure: 8, contrast: -10, highlights: -20, shadows: 25, temperature: 8, vibrance: -5, clarity: -15, fog: 10 },
  },
  {
    id: 'warm_portrait',
    name: 'Warm Portrait',
    category: 'Portrait',
    description: 'Warm golden tones',
    adjustments: { exposure: 5, temperature: 25, tint: 5, vibrance: 10, vignette: 15 },
  },
  {
    id: 'cool_beauty',
    name: 'Cool Beauty',
    category: 'Portrait',
    description: 'Cool editorial look',
    adjustments: { temperature: -15, tint: -5, contrast: 10, vibrance: -10, clarity: 10 },
  },
  {
    id: 'fashion',
    name: 'Fashion',
    category: 'Portrait',
    description: 'High contrast fashion',
    adjustments: { contrast: 25, highlights: 10, shadows: -15, saturation: -10, clarity: 20, sharpness: 15, vignette: 20 },
  },
  {
    id: 'vintage_port',
    name: 'Vintage Portrait',
    category: 'Portrait',
    description: 'Retro portrait feel',
    adjustments: { exposure: 5, contrast: -5, temperature: 15, saturation: -20, vibrance: -10, fog: 15, grain: 20, vignette: 15 },
  },

  // ======================== Landscape ========================
  {
    id: 'golden_hour',
    name: 'Golden Hour',
    category: 'Landscape',
    description: 'Warm sunset glow',
    adjustments: { exposure: 5, contrast: 15, temperature: 30, vibrance: 25, clarity: 20, vignette: 10 },
  },
  {
    id: 'misty_morning',
    name: 'Misty Morning',
    category: 'Landscape',
    description: 'Soft misty atmosphere',
    adjustments: { exposure: 10, contrast: -15, shadows: 20, temperature: -5, fog: 30, vibrance: -15 },
  },
  {
    id: 'deep_forest',
    name: 'Deep Forest',
    category: 'Landscape',
    description: 'Rich greens and depth',
    adjustments: { contrast: 20, shadows: 15, blacks: -10, vibrance: 30, clarity: 25, vignette: 20 },
  },
  {
    id: 'ocean_blue',
    name: 'Ocean Blue',
    category: 'Landscape',
    description: 'Cool blue tones',
    adjustments: { temperature: -20, tint: -5, contrast: 15, vibrance: 20, clarity: 15 },
  },
  {
    id: 'hdr_landscape',
    name: 'HDR Landscape',
    category: 'Landscape',
    description: 'HDR-like detail',
    adjustments: { contrast: 10, highlights: -30, shadows: 40, clarity: 40, vibrance: 20, sharpness: 15 },
  },

  // ======================== Cinematic ========================
  {
    id: 'teal_orange',
    name: 'Teal & Orange',
    category: 'Cinematic',
    description: 'Hollywood color grade',
    adjustments: { temperature: 15, tint: -5, contrast: 20, vibrance: -10, saturation: -5, vignette: 25 },
  },
  {
    id: 'dark_cinema',
    name: 'Dark Cinema',
    category: 'Cinematic',
    description: 'Moody dark grade',
    adjustments: { exposure: -10, contrast: 25, highlights: -15, shadows: -20, blacks: -15, vignette: 35, grain: 10 },
  },
  {
    id: 'blade_runner',
    name: 'Neon Noir',
    category: 'Cinematic',
    description: 'Cyberpunk neon look',
    adjustments: { contrast: 30, temperature: -10, tint: 15, saturation: 15, vibrance: 20, vignette: 30, clarity: 15 },
  },
  {
    id: 'wes_anderson',
    name: 'Pastel Pop',
    category: 'Cinematic',
    description: 'Wes Anderson pastel tones',
    adjustments: { exposure: 10, contrast: -10, temperature: 10, saturation: -15, vibrance: 20, fog: 8 },
  },
  {
    id: 'desaturated',
    name: 'Bleach Bypass',
    category: 'Cinematic',
    description: 'Desaturated film look',
    adjustments: { contrast: 30, saturation: -40, clarity: 20, grain: 15, vignette: 20 },
  },

  // ======================== Street ========================
  {
    id: 'urban_grit',
    name: 'Urban Grit',
    category: 'Street',
    description: 'Gritty urban feel',
    adjustments: { contrast: 25, clarity: 30, sharpness: 20, vibrance: -10, grain: 15, vignette: 15 },
  },
  {
    id: 'night_city',
    name: 'Night City',
    category: 'Street',
    description: 'Night photography look',
    adjustments: { exposure: 10, contrast: 20, highlights: -15, temperature: -10, vibrance: 15, vignette: 20, denoise: 20 },
  },
  {
    id: 'documentary',
    name: 'Documentary',
    category: 'Street',
    description: 'Clean documentary style',
    adjustments: { contrast: 15, clarity: 20, sharpness: 10, vibrance: -5, grain: 5 },
  },
  {
    id: 'faded_street',
    name: 'Faded Street',
    category: 'Street',
    description: 'Faded hipster look',
    adjustments: { contrast: -10, blacks: 15, saturation: -25, fog: 15, grain: 20, vibrance: -5 },
  },

  // ======================== Film ========================
  {
    id: 'kodak_portra',
    name: 'Portra 400',
    category: 'Film',
    description: 'Kodak Portra emulation',
    adjustments: { contrast: -5, temperature: 8, saturation: -10, vibrance: 10, grain: 20, highlights: -10, shadows: 15 },
  },
  {
    id: 'fuji_velvia',
    name: 'Velvia 50',
    category: 'Film',
    description: 'Fuji Velvia vivid film',
    adjustments: { contrast: 20, saturation: 25, vibrance: 15, clarity: 10, grain: 10 },
  },
  {
    id: 'ilford_hp5',
    name: 'HP5 Plus',
    category: 'Film',
    description: 'Classic B&W film grain',
    adjustments: { saturation: -100, contrast: 20, clarity: 15, grain: 25, sharpness: 5 },
  },
  {
    id: 'cinestill',
    name: 'CineStill 800T',
    category: 'Film',
    description: 'Tungsten cinema film',
    adjustments: { temperature: -15, tint: 10, contrast: 10, saturation: -5, grain: 20, vignette: 10 },
  },

  // ======================== B&W ========================
  {
    id: 'classic_bw',
    name: 'Classic B&W',
    category: 'B&W',
    description: 'Timeless black and white',
    adjustments: { saturation: -100, contrast: 15, clarity: 10 },
  },
  {
    id: 'high_contrast_bw',
    name: 'High Contrast B&W',
    category: 'B&W',
    description: 'Punchy monochrome',
    adjustments: { saturation: -100, contrast: 40, blacks: -15, whites: 10, clarity: 20, vignette: 15 },
  },
  {
    id: 'noir',
    name: 'Film Noir',
    category: 'B&W',
    description: 'Dark dramatic noir',
    adjustments: { saturation: -100, contrast: 30, exposure: -10, shadows: -20, vignette: 35, grain: 15 },
  },
  {
    id: 'soft_bw',
    name: 'Soft B&W',
    category: 'B&W',
    description: 'Gentle monochrome',
    adjustments: { saturation: -100, contrast: -10, fog: 15, grain: 10 },
  },
];
