import type { CropState, EditAdjustments, HSLState, TransformState } from '../types';
import * as editing from './imageEditing';
import { applyLUT } from './imageProcessor';

export type ExportFormat = 'webp' | 'jpeg' | 'png';
export type ExportProfile = 'original' | 'high' | 'web';

export interface RenderLut {
  data: Float32Array | null;
  size: number;
  name?: string;
}

export interface RenderOptions {
  adjustments: EditAdjustments;
  hslState: HSLState;
  cropState: CropState;
  transformState: TransformState;
  activeLut: RenderLut | null;
  intensity: number;
  resizeTo4K?: boolean;
  maxEdge?: number;
  exportProfile?: ExportProfile;
}

export interface ExportSettings {
  quality: number;
  lossless: boolean;
  resize4k: boolean;
  exportFormat: ExportFormat;
  exportProfile: ExportProfile;
}

export interface EncodedImage {
  blob: Blob;
  extension: string;
  format: ExportFormat;
  mimeType: string;
}

const MAX_HIGH_PROFILE_EDGE = 6000;
const MAX_WEB_PROFILE_EDGE = 2048;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const getSourceSize = (source: HTMLImageElement | HTMLCanvasElement) => {
  if (source instanceof HTMLImageElement) {
    return { width: source.naturalWidth, height: source.naturalHeight };
  }

  return { width: source.width, height: source.height };
};

const createCanvas = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
};

const drawToCanvas = (
  source: HTMLImageElement | HTMLCanvasElement,
  width: number,
  height: number,
): HTMLCanvasElement => {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
};

export function hasAdjustmentChanges(adjustments: EditAdjustments): boolean {
  return Object.values(adjustments).some((value) => value !== 0);
}

export function hasHslChanges(hslState: HSLState): boolean {
  return Object.values(hslState).some(
    (channel) => channel.hue !== 0 || channel.saturation !== 0 || channel.luminance !== 0,
  );
}

export function hasCropChanges(cropState: CropState): boolean {
  return (
    cropState.rect.x !== 0 ||
    cropState.rect.y !== 0 ||
    cropState.rect.width !== 1 ||
    cropState.rect.height !== 1
  );
}

export function hasTransformChanges(transformState: TransformState): boolean {
  return transformState.rotation !== 0 || transformState.flipH || transformState.flipV;
}

export function hasLutChanges(activeLut: RenderLut | null, intensity: number): boolean {
  return !!activeLut?.data && activeLut.size > 0 && intensity > 0;
}

export function hasRenderableChanges(options: RenderOptions): boolean {
  return (
    hasAdjustmentChanges(options.adjustments) ||
    hasHslChanges(options.hslState) ||
    hasCropChanges(options.cropState) ||
    hasTransformChanges(options.transformState) ||
    hasLutChanges(options.activeLut, options.intensity)
  );
}

export function applyTransform(
  source: HTMLImageElement | HTMLCanvasElement,
  transformState: TransformState,
): HTMLCanvasElement {
  const { width: sourceWidth, height: sourceHeight } = getSourceSize(source);
  const rotated = transformState.rotation === 90 || transformState.rotation === 270;
  const canvas = createCanvas(rotated ? sourceHeight : sourceWidth, rotated ? sourceWidth : sourceHeight);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((transformState.rotation * Math.PI) / 180);
  if (transformState.flipH) ctx.scale(-1, 1);
  if (transformState.flipV) ctx.scale(1, -1);
  ctx.drawImage(source, -sourceWidth / 2, -sourceHeight / 2);

  return canvas;
}

export function applyCrop(
  source: HTMLImageElement | HTMLCanvasElement,
  cropState: CropState,
): HTMLCanvasElement {
  const { width, height } = getSourceSize(source);
  const left = clamp01(cropState.rect.x);
  const top = clamp01(cropState.rect.y);
  const right = clamp01(cropState.rect.x + cropState.rect.width);
  const bottom = clamp01(cropState.rect.y + cropState.rect.height);
  const cropX = Math.round(left * width);
  const cropY = Math.round(top * height);
  const cropW = Math.max(1, Math.round((right - left) * width));
  const cropH = Math.max(1, Math.round((bottom - top) * height));
  const canvas = createCanvas(cropW, cropH);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

  return canvas;
}

export function getTargetSize(
  width: number,
  height: number,
  options: Pick<RenderOptions, 'resizeTo4K' | 'maxEdge' | 'exportProfile'>,
): { width: number; height: number } {
  const profile = options.exportProfile ?? 'original';
  const edgeLimit =
    profile === 'web'
      ? MAX_WEB_PROFILE_EDGE
      : profile === 'high'
        ? MAX_HIGH_PROFILE_EDGE
        : Number.POSITIVE_INFINITY;
  const maxWidth = Math.min(
    edgeLimit,
    options.maxEdge ?? Number.POSITIVE_INFINITY,
    options.resizeTo4K ? 3840 : Number.POSITIVE_INFINITY,
  );
  const maxHeight = Math.min(
    edgeLimit,
    options.maxEdge ?? Number.POSITIVE_INFINITY,
    options.resizeTo4K ? 2160 : Number.POSITIVE_INFINITY,
  );
  const scale = Math.min(1, maxWidth / width, maxHeight / height);

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function applyEditorAdjustments(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options: Pick<RenderOptions, 'adjustments' | 'hslState' | 'activeLut' | 'intensity'>,
): void {
  const { adjustments, hslState, activeLut, intensity } = options;

  if (adjustments.exposure !== 0) editing.adjustExposure(data, width, height, adjustments.exposure);
  if (adjustments.contrast !== 0) editing.adjustContrast(data, width, height, adjustments.contrast);
  if (adjustments.highlights !== 0) editing.adjustHighlights(data, width, height, adjustments.highlights);
  if (adjustments.shadows !== 0) editing.adjustShadows(data, width, height, adjustments.shadows);
  if (adjustments.whites !== 0) editing.adjustWhites(data, width, height, adjustments.whites);
  if (adjustments.blacks !== 0) editing.adjustBlacks(data, width, height, adjustments.blacks);
  if (adjustments.temperature !== 0) editing.adjustTemperature(data, width, height, adjustments.temperature);
  if (adjustments.tint !== 0) editing.adjustTint(data, width, height, adjustments.tint);
  if (adjustments.vibrance !== 0) editing.adjustVibrance(data, width, height, adjustments.vibrance);
  if (adjustments.saturation !== 0) editing.adjustSaturation(data, width, height, adjustments.saturation);
  if (adjustments.clarity !== 0) editing.adjustClarity(data, width, height, adjustments.clarity);
  if (adjustments.sharpness !== 0) editing.adjustSharpness(data, width, height, adjustments.sharpness);
  if (adjustments.denoise !== 0) editing.adjustDenoise(data, width, height, adjustments.denoise);
  if (adjustments.vignette !== 0) editing.applyVignette(data, width, height, adjustments.vignette);
  if (adjustments.grain !== 0) editing.applyFilmGrain(data, width, height, adjustments.grain);
  if (adjustments.fog !== 0) editing.applyFog(data, width, height, adjustments.fog);

  for (const [channel, adjustment] of Object.entries(hslState)) {
    if (adjustment.hue !== 0 || adjustment.saturation !== 0 || adjustment.luminance !== 0) {
      editing.adjustHSL(
        data,
        width,
        height,
        channel,
        adjustment.hue,
        adjustment.saturation,
        adjustment.luminance,
      );
    }
  }

  if (hasLutChanges(activeLut, intensity) && activeLut?.data) {
    applyLUT(data, activeLut.data, activeLut.size, intensity / 100);
  }
}

export function renderEditedCanvas(
  source: HTMLImageElement | HTMLCanvasElement,
  options: RenderOptions,
): HTMLCanvasElement {
  let workingSource: HTMLImageElement | HTMLCanvasElement = source;

  if (hasTransformChanges(options.transformState)) {
    workingSource = applyTransform(workingSource, options.transformState);
  }

  if (hasCropChanges(options.cropState)) {
    workingSource = applyCrop(workingSource, options.cropState);
  }

  const sourceSize = getSourceSize(workingSource);
  const targetSize = getTargetSize(sourceSize.width, sourceSize.height, options);
  const canvas = drawToCanvas(workingSource, targetSize.width, targetSize.height);

  if (
    hasAdjustmentChanges(options.adjustments) ||
    hasHslChanges(options.hslState) ||
    hasLutChanges(options.activeLut, options.intensity)
  ) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    applyEditorAdjustments(imageData.data, canvas.width, canvas.height, options);
    ctx.putImageData(imageData, 0, 0);
  }

  return canvas;
}

const canvasToBlob = (canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error(`Failed to encode ${mimeType}`));
      },
      mimeType,
      quality,
    );
  });

const getMimeType = (format: ExportFormat): string => {
  if (format === 'jpeg') return 'image/jpeg';
  if (format === 'png') return 'image/png';
  return 'image/webp';
};

const getFormatFromMime = (mimeType: string, fallback: ExportFormat): ExportFormat => {
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpeg';
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  return fallback;
};

export const getExportExtension = (format: ExportFormat): string => (format === 'jpeg' ? 'jpg' : format);

export async function encodeCanvas(
  canvas: HTMLCanvasElement,
  settings: ExportSettings,
): Promise<EncodedImage> {
  const mimeType = getMimeType(settings.exportFormat);
  const quality = Math.max(1, Math.min(100, settings.quality)) / 100;
  let sourceCanvas = canvas;

  if (settings.exportFormat === 'jpeg') {
    sourceCanvas = createCanvas(canvas.width, canvas.height);
    const ctx = sourceCanvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, sourceCanvas.width, sourceCanvas.height);
    ctx.drawImage(canvas, 0, 0);
  }

  const encodeQuality = settings.exportFormat === 'png'
    ? undefined
    : settings.lossless && settings.exportFormat === 'webp'
      ? 1
      : quality;
  const blob = await canvasToBlob(sourceCanvas, mimeType, encodeQuality);
  const actualFormat = getFormatFromMime(blob.type || mimeType, settings.exportFormat);

  return {
    blob,
    extension: getExportExtension(actualFormat),
    format: actualFormat,
    mimeType: blob.type || mimeType,
  };
}

export function createOutputFileName(
  sourceName: string,
  smartName: boolean,
  lutName: string | null | undefined,
  extension: string,
  suffix?: string,
): string {
  let outputName = sourceName.replace(/\.[^.]+$/, '');
  if (smartName && lutName) {
    outputName += `_${lutName.replace(/\s+/g, '-').toLowerCase()}`;
  }
  if (suffix) outputName += suffix;
  return `${outputName}.${extension}`;
}

// ─── Auto Crop: Saliency-based Subject Detection ──────────────────────────────
//
// Analyzes image variance across 8×8 blocks to find the "most interesting"
// region (high texture/edge content = subject). Works well for wildlife,
// portraits, flowers, products against soft/uniform backgrounds.

export interface SubjectRect {
  x: number;      // 0–1 normalized left
  y: number;      // 0–1 normalized top
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
      if (v > maxSal) maxSal = v;
    }
  }

  // Fallback: return full image if no variance
  if (maxSal < 1) return { x: 0, y: 0, width: 1, height: 1 };

  // ── Step 2: Find bounding box of high-saliency blocks ──
  const THRESH = maxSal * 0.12; // 12% of max saliency
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

  // No clear subject found
  if (maxBX < minBX || maxBY < minBY) return { x: 0, y: 0, width: 1, height: 1 };

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

  // If subject fills 85%+ of frame, skip crop (nothing to do)
  if (w > 0.85 && h > 0.85) return { x: 0, y: 0, width: 1, height: 1 };

  // Minimum crop dimensions to avoid tiny unrealistic crops
  const MIN = 0.25;
  if (w < MIN || h < MIN) return { x: 0, y: 0, width: 1, height: 1 };

  return {
    x: x1,
    y: y1,
    width: Math.min(1 - x1, w),
    height: Math.min(1 - y1, h),
  };
}
