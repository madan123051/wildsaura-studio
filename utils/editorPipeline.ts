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
