import type { EditAdjustments, HSLState, CropState, TransformState } from '../types';
import * as editing from './imageEditing';

// ─── Canvas utilities ──────────────────────────────────────────────────────

const createCanvas = (w: number, h: number): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

// ─── Render pipeline ──────────────────────────────────────────────────────

export interface RenderOptions {
  adjustments: EditAdjustments;
  hslState: HSLState;
  cropState: CropState;
  transformState: TransformState;
  activeLut: any;
  intensity: number;
  maxEdge?: number;
  resizeTo4K?: boolean;
}

export function renderEditedCanvas(
  source: HTMLImageElement,
  options: RenderOptions,
): HTMLCanvasElement {
  const {
    adjustments,
    hslState,
    cropState,
    transformState,
    activeLut,
    intensity,
    maxEdge = 2048,
    resizeTo4K = false,
  } = options;

  // Get source dimensions
  let sw = source.naturalWidth || source.width;
  let sh = source.naturalHeight || source.height;

  // Apply crop
  const { rect } = cropState;
  const cropX = rect.x * sw;
  const cropY = rect.y * sh;
  const cropW = rect.width * sw;
  const cropH = rect.height * sh;

  // Apply transform (rotation + flip)
  let tw = cropW;
  let th = cropH;
  if (transformState.rotation === 90 || transformState.rotation === 270) {
    [tw, th] = [th, tw];
  }

  // Handle 4K resize if requested
  const effectiveMaxEdge = resizeTo4K ? 3840 : maxEdge;

  // Scale down if exceeds maxEdge
  const scale = Math.min(1, effectiveMaxEdge / Math.max(tw, th));
  tw = Math.round(tw * scale);
  th = Math.round(th * scale);

  // Create output canvas
  const canvas = createCanvas(tw, th);
  const ctx = canvas.getContext('2d')!;

  // Apply transforms
  ctx.save();
  ctx.translate(tw / 2, th / 2);
  if (transformState.flipH) ctx.scale(-1, 1);
  if (transformState.flipV) ctx.scale(1, -1);
  if (transformState.rotation !== 0) {
    ctx.rotate((transformState.rotation * Math.PI) / 180);
  }
  ctx.translate(-tw / 2, -th / 2);

  // Draw cropped + transformed source
  ctx.drawImage(
    source,
    cropX,
    cropY,
    cropW,
    cropH,
    0,
    0,
    tw,
    th,
  );
  ctx.restore();

  // Apply adjustments
  const imageData = ctx.getImageData(0, 0, tw, th);
  
  // Light
  if (adjustments.exposure !== 0) editing.adjustExposure(imageData.data, tw, th, adjustments.exposure);
  if (adjustments.contrast !== 0) editing.adjustContrast(imageData.data, tw, th, adjustments.contrast);
  if (adjustments.highlights !== 0) editing.adjustHighlights(imageData.data, tw, th, adjustments.highlights);
  if (adjustments.shadows !== 0) editing.adjustShadows(imageData.data, tw, th, adjustments.shadows);
  if (adjustments.whites !== 0) editing.adjustWhites(imageData.data, tw, th, adjustments.whites);
  if (adjustments.blacks !== 0) editing.adjustBlacks(imageData.data, tw, th, adjustments.blacks);
  
  // Color
  if (adjustments.temperature !== 0) editing.adjustTemperature(imageData.data, tw, th, adjustments.temperature);
  if (adjustments.tint !== 0) editing.adjustTint(imageData.data, tw, th, adjustments.tint);
  if (adjustments.vibrance !== 0) editing.adjustVibrance(imageData.data, tw, th, adjustments.vibrance);
  if (adjustments.saturation !== 0) editing.adjustSaturation(imageData.data, tw, th, adjustments.saturation);
  
  // Details
  if (adjustments.clarity !== 0) editing.adjustClarity(imageData.data, tw, th, adjustments.clarity);
  if (adjustments.sharpness !== 0) editing.adjustSharpness(imageData.data, tw, th, adjustments.sharpness);
  if (adjustments.denoise !== 0) editing.adjustDenoise(imageData.data, tw, th, adjustments.denoise);
  
  // Creative
  if (adjustments.vignette !== 0) editing.applyVignette(imageData.data, tw, th, adjustments.vignette);
  if (adjustments.grain !== 0) editing.applyFilmGrain(imageData.data, tw, th, adjustments.grain);
  if (adjustments.fog !== 0) editing.applyFog(imageData.data, tw, th, adjustments.fog);

  // Apply HSL
  for (const [channel, state] of Object.entries(hslState)) {
    if (state.hue !== 0 || state.saturation !== 0 || state.luminance !== 0) {
      editing.adjustHSL(imageData.data, tw, th, channel, state.hue, state.saturation, state.luminance);
    }
  }

  // Apply LUT if active
  if (activeLut && activeLut.data) {
    applyLUT(imageData, activeLut.data, activeLut.size || 64, intensity);
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

// ─── LUT application ──────────────────────────────────────────────────────

function applyLUT(
  imageData: ImageData,
  lutData: Uint8Array,
  size: number,
  intensity: number,
): void {
  const data = imageData.data;
  const i100 = intensity / 100;

  for (let i = 0; i < data.length; i += 4) {
    const r = Math.round((data[i] / 255) * (size - 1));
    const g = Math.round((data[i + 1] / 255) * (size - 1));
    const b = Math.round((data[i + 2] / 255) * (size - 1));

    const idx = (r * size * size + g * size + b) * 3;
    const lutR = lutData[idx];
    const lutG = lutData[idx + 1];
    const lutB = lutData[idx + 2];

    data[i] = Math.round(data[i] * (1 - i100) + lutR * i100);
    data[i + 1] = Math.round(data[i + 1] * (1 - i100) + lutG * i100);
    data[i + 2] = Math.round(data[i + 2] * (1 - i100) + lutB * i100);
  }
}

// ─── Export encoding ──────────────────────────────────────────────────────

export async function encodeCanvas(
  canvas: HTMLCanvasElement,
  settings: any,
): Promise<{ blob: Blob; extension: string; format: string }> {
  const format = settings.exportFormat || 'webp';
  const quality = (settings.quality || 82) / 100;

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        resolve({
          blob: blob!,
          extension: format,
          format: format,
        });
      },
      `image/${format}`,
      quality,
    );
  });
}

// ─── Output filename generation ────────────────────────────────────────────

export function createOutputFileName(
  original: string,
  smartName: boolean,
  lutName?: string,
  format: string = 'webp',
  suffix: string = '',
): string {
  const base = original.replace(/\.[^.]+$/, '');
  const parts = [base];

  if (smartName && lutName) {
    parts.push(lutName.toLowerCase().replace(/\s+/g, '_'));
  }

  if (suffix) {
    parts.push(suffix);
  }

  return `${parts.join('_')}.${format}`;
}

// ─── Subject detection (saliency-based) ────────────────────────────────────

export interface SubjectRect {
  x: number;  // 0–1 normalized x
  y: number;  // 0–1 normalized y
  width: number;  // 0–1 normalized width
  height: number; // 0–1 normalized height
}

export function detectSubjectBounds(
  source: HTMLImageElement | HTMLCanvasElement,
): SubjectRect {
  const SAMPLE = 128;   // analysis canvas size
  const BLOCK = 8;      // variance block size
  const BLOCKS = SAMPLE / BLOCK; // 16 blocks per axis

  // Draw source to small analysis canvas
  const canvas = createCanvas(SAMPLE, SAMPLE);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, SAMPLE, SAMPLE);
  const { data } = ctx.getImageData(0, 0, SAMPLE, SAMPLE);

  // Luminance helper
  const lum = (i: number) => data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;

  // ── Step 1: Compute luminance variance per block ──
  const saliency: number[] = new Array(BLOCKS * BLOCKS).fill(0);
  let maxSal = 0;
  let totalSal = 0;

  for (let by = 0; by < BLOCKS; by++) {
    for (let bx = 0; bx < BLOCKS; bx++) {
      let sum = 0, sum2 = 0, count = 0;
      for (let dy = 0; dy < BLOCK; dy++) {
        for (let dx = 0; dx < BLOCK; dx++) {
          const i = ((by * BLOCK + dy) * SAMPLE + (bx * BLOCK + dx)) * 4;
          const l = lum(i);
          sum += l;
          sum2 += l * l;
          count++;
        }
      }
      const mean = sum / count;
      const v = Math.max(0, sum2 / count - mean * mean);
      saliency[by * BLOCKS + bx] = v;
      totalSal += v;
      if (v > maxSal) maxSal = v;
    }
  }

  // FIX 1: Use adaptive threshold instead of fixed 0.12
  // If average saliency is very low, image is uniform → no crop needed
  const avgSal = totalSal / (BLOCKS * BLOCKS);
  if (maxSal < 0.5 && avgSal < 0.1) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }

  // FIX 2: Use adaptive threshold based on distribution
  // Instead of 12% of max, use a percentile-based approach
  const sortedSal = [...saliency].sort((a, b) => b - a);
  const p75 = sortedSal[Math.floor(sortedSal.length * 0.25)];
  const THRESH = Math.max(maxSal * 0.08, p75 * 0.5); // 8% of max OR 50% of 75th percentile

  // ── Step 2: Find bounding box of high-saliency blocks ──
  let minBX = BLOCKS, maxBX = -1, minBY = BLOCKS, maxBY = -1;
  let totalW = 0, wCX = 0, wCY = 0;

  for (let by = 0; by < BLOCKS; by++) {
    for (let bx = 0; bx < BLOCKS; bx++) {
      const sal = saliency[by * BLOCKS + bx];
      if (sal >= THRESH) {
        if (bx < minBX) minBX = bx;
        if (bx > maxBX) maxBX = bx;
        if (by < minBY) minBY = by;
        if (by > maxBY) maxBY = by;
        totalW += sal;
        wCX += (bx + 0.5) * sal;
        wCY += (by + 0.5) * sal;
      }
    }
  }

  // FIX 3: If no subject detected, try a more lenient threshold
  if (maxBX < minBX || maxBY < minBY) {
    // Fallback: use 5% of max saliency
    const LENIENT_THRESH = maxSal * 0.05;
    minBX = BLOCKS; maxBX = -1; minBY = BLOCKS; maxBY = -1;
    totalW = 0; wCX = 0; wCY = 0;

    for (let by = 0; by < BLOCKS; by++) {
      for (let bx = 0; bx < BLOCKS; bx++) {
        const sal = saliency[by * BLOCKS + bx];
        if (sal >= LENIENT_THRESH) {
          if (bx < minBX) minBX = bx;
          if (bx > maxBX) maxBX = bx;
          if (by < minBY) minBY = by;
          if (by > maxBY) maxBY = by;
          totalW += sal;
          wCX += (bx + 0.5) * sal;
          wCY += (by + 0.5) * sal;
        }
      }
    }

    // Still no subject found
    if (maxBX < minBX || maxBY < minBY) {
      return { x: 0, y: 0, width: 1, height: 1 };
    }
  }

  // ── Step 3: Compute weighted center of mass ──
  const cxB = totalW > 0 ? wCX / totalW : BLOCKS / 2;
  const cyB = totalW > 0 ? wCY / totalW : BLOCKS / 2;

  // Expand bounding box to include center of mass
  const halfW = (maxBX - minBX + 1) * 0.5;
  const halfH = (maxBY - minBY + 1) * 0.5;
  const fMinBX = Math.min(minBX, Math.floor(cxB - halfW));
  const fMaxBX = Math.max(maxBX, Math.ceil(cxB + halfW));
  const fMinBY = Math.min(minBY, Math.floor(cyB - halfH));
  const fMaxBY = Math.max(maxBY, Math.ceil(cyB + halfH));

  // ── Step 4: Convert to [0,1] with padding ──
  const PAD = 1.5; // padding in blocks
  const x1 = Math.max(0, (fMinBX - PAD) / BLOCKS);
  const y1 = Math.max(0, (fMinBY - PAD) / BLOCKS);
  const x2 = Math.min(1, (fMaxBX + 1 + PAD) / BLOCKS);
  const y2 = Math.min(1, (fMaxBY + 1 + PAD) / BLOCKS);

  const w = x2 - x1;
  const h = y2 - y1;

  // FIX 4: Increase threshold from 85% to 92% (more lenient)
  // and reduce minimum crop size from 25% to 15%
  if (w > 0.92 && h > 0.92) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }

  const MIN = 0.15; // Changed from 0.25
  if (w < MIN || h < MIN) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }

  return {
    x: x1,
    y: y1,
    width: Math.min(1 - x1, w),
    height: Math.min(1 - y1, h),
  };
}

// ─── Crop application ──────────────────────────────────────────────────────

export function applyCrop(
  canvas: HTMLCanvasElement,
  cropState: CropState,
): HTMLCanvasElement {
  const { rect } = cropState;
  const w = canvas.width * rect.width;
  const h = canvas.height * rect.height;
  const x = canvas.width * rect.x;
  const y = canvas.height * rect.y;

  const cropped = createCanvas(Math.round(w), Math.round(h));
  const ctx = cropped.getContext('2d')!;
  ctx.drawImage(canvas, x, y, w, h, 0, 0, w, h);
  return cropped;
}

// ─── Check if there are renderable changes ────────────────────────────────

export function hasRenderableChanges(
  adjustments: EditAdjustments,
  hslState: HSLState,
  cropState: CropState,
  transformState: TransformState,
  activeLut: any,
): boolean {
  // Check adjustments
  if (
    adjustments.exposure !== 0 ||
    adjustments.highlights !== 0 ||
    adjustments.shadows !== 0 ||
    adjustments.contrast !== 0 ||
    adjustments.temperature !== 0 ||
    adjustments.tint !== 0 ||
    adjustments.vibrance !== 0 ||
    adjustments.saturation !== 0 ||
    adjustments.clarity !== 0 ||
    adjustments.sharpness !== 0 ||
    adjustments.denoise !== 0 ||
    adjustments.vignette !== 0 ||
    adjustments.grain !== 0 ||
    adjustments.fog !== 0 ||
    adjustments.whites !== 0 ||
    adjustments.blacks !== 0
  ) {
    return true;
  }

  // Check HSL
  for (const ch of Object.values(hslState)) {
    if (ch.hue !== 0 || ch.saturation !== 0 || ch.luminance !== 0) {
      return true;
    }
  }

  // Check crop
  if (
    cropState.rect.x !== 0 ||
    cropState.rect.y !== 0 ||
    cropState.rect.width !== 1 ||
    cropState.rect.height !== 1
  ) {
    return true;
  }

  // Check transform
  if (
    transformState.rotation !== 0 ||
    transformState.flipH ||
    transformState.flipV
  ) {
    return true;
  }

  // Check LUT
  if (activeLut) {
    return true;
  }

  return false;
}
