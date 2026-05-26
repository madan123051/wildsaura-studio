import type { EditAdjustments, HSLState, HSLAdjustment } from '../types';
import { DEFAULT_HSL_STATE, DEFAULT_HSL_ADJUSTMENT } from '../types';

/**
 * AI Cinematic Presets
 * Each preset maps to a category detected by Gemini AI
 * and applies a complete cinematic look using adjustments + HSL
 */

export interface CinematicPreset {
  name: string;
  emoji: string;
  description: string;
  adjustments: Partial<EditAdjustments>;
  hslOverrides: Partial<HSLState>;
}

const createHslOverride = (overrides: Record<string, Partial<HSLAdjustment>>): Partial<HSLState> => {
  const result: any = { ...DEFAULT_HSL_STATE };
  Object.entries(overrides).forEach(([channel, values]) => {
    result[channel] = { ...DEFAULT_HSL_ADJUSTMENT, ...values };
  });
  return result;
};

/**
 * STREET_NIGHT: Teal-orange cinematic look
 * - Moody, high contrast
 * - Cool shadows (teal), warm highlights (orange)
 * - Heavy vignette, grain
 * - Deep blacks
 */
export const STREET_NIGHT_PRESET: CinematicPreset = {
  name: 'Street Night',
  emoji: '🌆',
  description: 'Teal-orange cinematic night look',
  adjustments: {
    exposure: -15,
    contrast: 45,
    highlights: -20,
    shadows: 15,
    blacks: -20,
    temperature: 20,
    vibrance: 35,
    saturation: 15,
    clarity: 25,
    sharpness: 30,
    vignette: 60,
    grain: 10,
  },
  hslOverrides: createHslOverride({
    cyan: { saturation: 50 },
    orange: { saturation: 40, luminance: 10 },
    blue: { hue: -10, saturation: 30, luminance: -10 },
  }),
};

/**
 * NATURE_WILDLIFE: Organic, sharp, natural
 * - Vibrant greens
 * - High sharpness and clarity
 * - Cool but not too much
 * - Subtle vignette
 */
export const NATURE_WILDLIFE_PRESET: CinematicPreset = {
  name: 'Nature Wildlife',
  emoji: '🌿',
  description: 'Sharp organic greens, vivid nature',
  adjustments: {
    exposure: 5,
    contrast: 20,
    shadows: 15,
    temperature: -10,
    vibrance: 45,
    saturation: 15,
    clarity: 40,
    sharpness: 55,
    vignette: 15,
  },
  hslOverrides: createHslOverride({
    green: { hue: 5, saturation: 35, luminance: 10 },
    yellow: { hue: -5, saturation: 20, luminance: 5 },
    cyan: { saturation: 15 },
  }),
};

/**
 * PORTRAIT_PEOPLE: Soft, warm, flattering
 * - Warm skin tones
 * - Reduced highlights (no blown highlights)
 * - Soft shadows
 * - Low clarity for smooth skin
 * - Light vignette
 */
export const PORTRAIT_PEOPLE_PRESET: CinematicPreset = {
  name: 'Portrait People',
  emoji: '👤',
  description: 'Warm, soft, flattering portrait',
  adjustments: {
    exposure: 10,
    contrast: 15,
    highlights: -25,
    shadows: 20,
    temperature: 20,
    vibrance: 25,
    clarity: 10,
    sharpness: 20,
    vignette: 20,
  },
  hslOverrides: createHslOverride({
    orange: { hue: 0, saturation: 15, luminance: 8 },
    red: { hue: 5, saturation: 10, luminance: 5 },
  }),
};

/**
 * LANDSCAPE_DAY: Epic, dramatic, dynamic
 * - High contrast
 * - Crushed blacks, pulled down highlights for HDR look
 * - Vivid blues and greens
 * - High clarity
 * - Moderate vignette
 */
export const LANDSCAPE_DAY_PRESET: CinematicPreset = {
  name: 'Landscape Day',
  emoji: '🏔️',
  description: 'Epic dramatic landscape',
  adjustments: {
    exposure: 10,
    contrast: 35,
    highlights: -40,
    shadows: 35,
    whites: 15,
    temperature: -15,
    vibrance: 55,
    saturation: 20,
    clarity: 55,
    sharpness: 40,
    vignette: 30,
  },
  hslOverrides: createHslOverride({
    blue: { hue: 0, saturation: 40, luminance: -10 },
    cyan: { hue: 0, saturation: 30, luminance: -5 },
    green: { hue: 0, saturation: 25, luminance: 5 },
  }),
};

/**
 * MINIMAL_MOODY: Desaturated, cool, atmospheric
 * - Low exposure for moody feel
 * - Desaturated (-40 saturation)
 * - Very cool temperature (-35)
 * - Grain and fog for atmosphere
 * - Heavy vignette
 */
export const MINIMAL_MOODY_PRESET: CinematicPreset = {
  name: 'Minimal Moody',
  emoji: '🌫️',
  description: 'Desaturated cool atmospheric mood',
  adjustments: {
    exposure: -20,
    contrast: 40,
    highlights: -15,
    temperature: -35,
    saturation: -40,
    vibrance: -15,
    clarity: 20,
    grain: 20,
    vignette: 45,
    fog: 10,
  },
  hslOverrides: createHslOverride({}),
};

export const CINEMATIC_PRESETS: Record<string, CinematicPreset> = {
  STREET_NIGHT: STREET_NIGHT_PRESET,
  NATURE_WILDLIFE: NATURE_WILDLIFE_PRESET,
  PORTRAIT_PEOPLE: PORTRAIT_PEOPLE_PRESET,
  LANDSCAPE_DAY: LANDSCAPE_DAY_PRESET,
  MINIMAL_MOODY: MINIMAL_MOODY_PRESET,
};

/**
 * Get a cinematic preset by category
 * Returns a fallback preset if category not found
 */
export function getCinematicPreset(category: string): CinematicPreset {
  return CINEMATIC_PRESETS[category] || {
    name: 'Cinematic',
    emoji: '🎬',
    description: 'Standard cinematic look',
    adjustments: {
      contrast: 25,
      highlights: -15,
      shadows: 15,
      vibrance: 20,
      clarity: 20,
      vignette: 25,
      grain: 8,
    },
    hslOverrides: { ...DEFAULT_HSL_STATE },
  };
}

/**
 * Get emoji for a category
 */
export function getCategoryEmoji(category: string): string {
  return CINEMATIC_PRESETS[category]?.emoji || '🎬';
}

/**
 * Get display name for a category
 */
export function getCategoryName(category: string): string {
  return CINEMATIC_PRESETS[category]?.name || category.replace(/_/g, ' ');
}
