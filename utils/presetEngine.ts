import type { EditAdjustments } from '../types';
import * as editing from './imageEditing';

export type SceneType = 'forest' | 'snow' | 'sunset' | 'wildlife' | 'portrait' | 'night' | 'general';

export interface ProcessingLayers {
  exposureLayer: EditAdjustments;
  toneMappingLayer: EditAdjustments;
  colorScienceLayer: EditAdjustments;
  atmosphereLayer: EditAdjustments;
  textureLayer: EditAdjustments;
  sharpeningLayer: EditAdjustments;
  exportLutLayer: EditAdjustments;
}

export function mergeAdjustments(base: EditAdjustments, top: Partial<EditAdjustments>): EditAdjustments {
  return { ...base, ...top };
}

export function detectSceneType(canvas: HTMLCanvasElement): SceneType {
  const ctx = canvas.getContext('2d');
  if (!ctx) return 'general';
  const { width, height } = canvas;
  const sample = ctx.getImageData(0, 0, width, height).data;
  let greenBias = 0, warmBias = 0, coolBias = 0, bright = 0, dark = 0, skinLike = 0;
  const pixels = sample.length / 4;
  for (let i = 0; i < sample.length; i += 16) {
    const r = sample[i], g = sample[i + 1], b = sample[i + 2];
    if (g > r && g > b) greenBias++;
    if (r > g && g > b) warmBias++;
    if (b > r && b > g) coolBias++;
    const l = (r + g + b) / 3;
    if (l > 210) bright++;
    if (l < 55) dark++;
    if (r > 95 && g > 55 && b > 45 && r > g && g > b) skinLike++;
  }
  const denom = Math.max(1, pixels / 4);
  if (bright / denom > 0.45 && coolBias / denom > 0.25) return 'snow';
  if (dark / denom > 0.42) return 'night';
  if (warmBias / denom > 0.36) return 'sunset';
  if (greenBias / denom > 0.34) return 'forest';
  if (skinLike / denom > 0.22) return 'portrait';
  if (greenBias / denom > 0.24 && warmBias / denom > 0.15) return 'wildlife';
  return 'general';
}

export function adaptWildsauraLook(base: EditAdjustments, scene: SceneType): EditAdjustments {
  if (scene === 'forest') return { ...base, vibrance: base.vibrance + 4, shadows: base.shadows - 4 };
  if (scene === 'sunset') return { ...base, temperature: base.temperature + 5, highlights: base.highlights + 5 };
  if (scene === 'snow') return { ...base, temperature: base.temperature - 8, whites: base.whites + 6 };
  if (scene === 'night') return { ...base, shadows: base.shadows - 8, contrast: base.contrast + 4 };
  return base;
}

export function applyAdjustmentsToImageData(data: Uint8ClampedArray, w: number, h: number, adjustments: EditAdjustments): void {
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
}
