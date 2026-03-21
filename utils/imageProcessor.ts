import { ColorAdjustment, CubeLUT, LUTPreset } from '../types';
import { LUT_PRESETS, applyCubeLUT } from './lutData';

function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

function applyColorAdjustment(
  r: number, g: number, b: number,
  adj: ColorAdjustment,
  intensity: number
): [number, number, number] {
  let rr = r, gg = g, bb = b;

  // Brightness
  if (adj.brightness) {
    const br = adj.brightness * 2.55 * intensity;
    rr += br; gg += br; bb += br;
  }

  // Contrast
  if (adj.contrast) {
    const factor = (259 * (adj.contrast * intensity + 255)) / (255 * (259 - adj.contrast * intensity));
    rr = factor * (rr - 128) + 128;
    gg = factor * (gg - 128) + 128;
    bb = factor * (bb - 128) + 128;
  }

  // Temperature
  if (adj.temperature) {
    const t = adj.temperature * intensity * 0.5;
    rr += t;
    bb -= t;
  }

  // Tint
  if (adj.tint) {
    const t = adj.tint * intensity * 0.3;
    gg -= t;
  }

  // Saturation
  if (adj.saturation) {
    const gray = 0.2126 * rr + 0.7152 * gg + 0.0722 * bb;
    const s = 1 + (adj.saturation / 100) * intensity;
    rr = gray + s * (rr - gray);
    gg = gray + s * (gg - gray);
    bb = gray + s * (bb - gray);
  }

  // Shadows / Midtones / Highlights
  const lum = (rr + gg + bb) / 3 / 255;
  if (adj.shadows) {
    const w = Math.max(0, 1 - lum * 3);
    rr += adj.shadows[0] * w * intensity;
    gg += adj.shadows[1] * w * intensity;
    bb += adj.shadows[2] * w * intensity;
  }
  if (adj.midtones) {
    const w = 1 - Math.abs(lum - 0.5) * 2;
    rr += adj.midtones[0] * w * intensity;
    gg += adj.midtones[1] * w * intensity;
    bb += adj.midtones[2] * w * intensity;
  }
  if (adj.highlights) {
    const w = Math.max(0, lum * 3 - 2);
    rr += adj.highlights[0] * w * intensity;
    gg += adj.highlights[1] * w * intensity;
    bb += adj.highlights[2] * w * intensity;
  }

  // Fade blacks
  if (adj.fadeBlacks) {
    const lift = adj.fadeBlacks * 2.55 * intensity * 0.5;
    rr = rr + (lift - rr) * (1 - rr / 255) * (lift / 255) + lift * 0.15;
    gg = gg + (lift - gg) * (1 - gg / 255) * (lift / 255) + lift * 0.15;
    bb = bb + (lift - bb) * (1 - bb / 255) * (lift / 255) + lift * 0.15;
  }

  // Crush shadows
  if (adj.crushShadows) {
    const crush = adj.crushShadows * intensity / 100;
    const lumNorm = (rr + gg + bb) / 3 / 255;
    if (lumNorm < 0.4) {
      const factor = 1 - crush * (1 - lumNorm / 0.4);
      rr *= factor;
      gg *= factor;
      bb *= factor;
    }
  }

  return [clamp(rr), clamp(gg), clamp(bb)];
}

export interface ProcessOptions {
  preset: LUTPreset | null;
  cubeLut: CubeLUT | null;
  intensity: number;
  quality: number;
  lossless: boolean;
  resizeTo4K: boolean;
}

const MAX_DIMENSION = 8000;

/**
 * Load image from file. If the image is >8000px on any side,
 * resize it down during loading to prevent browser crashes.
 */
export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;

      // If image is within limits, return as-is
      if (w <= MAX_DIMENSION && h <= MAX_DIMENSION) {
        resolve(img);
        return;
      }

      // Resize down to max dimension to avoid memory issues
      const ratio = Math.min(MAX_DIMENSION / w, MAX_DIMENSION / h);
      const newW = Math.round(w * ratio);
      const newH = Math.round(h * ratio);

      const canvas = document.createElement('canvas');
      canvas.width = newW;
      canvas.height = newH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(img); // fallback to original
        return;
      }
      ctx.drawImage(img, 0, 0, newW, newH);

      const resizedImg = new Image();
      resizedImg.onload = () => {
        URL.revokeObjectURL(url);
        resolve(resizedImg);
      };
      resizedImg.onerror = () => resolve(img); // fallback
      resizedImg.src = canvas.toDataURL('image/jpeg', 0.95);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

export function processImageToCanvas(
  img: HTMLImageElement,
  preset: LUTPreset | null,
  cubeLut: CubeLUT | null,
  intensity: number,
  resizeTo4K: boolean,
): HTMLCanvasElement {
  let w = img.naturalWidth;
  let h = img.naturalHeight;

  if (resizeTo4K && (w > 3840 || h > 2160)) {
    const ratio = Math.min(3840 / w, 2160 / h);
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
  }

  // Even without resize-to-4K, cap at MAX_DIMENSION for processing safety
  if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
    const ratio = Math.min(MAX_DIMENSION / w, MAX_DIMENSION / h);
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, w, h);

  if ((preset || cubeLut) && intensity > 0) {
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i], g = data[i + 1], b = data[i + 2];

      if (cubeLut) {
        const [nr, ng, nb] = applyCubeLUT(r, g, b, cubeLut, intensity);
        r = nr; g = ng; b = nb;
      } else if (preset) {
        const [nr, ng, nb] = applyColorAdjustment(r, g, b, preset.adjust, intensity);
        r = nr; g = ng; b = nb;
      }

      data[i] = clamp(r);
      data[i + 1] = clamp(g);
      data[i + 2] = clamp(b);
    }

    // Apply grain if preset has it
    if (preset?.adjust.grain && preset.adjust.grain > 0) {
      const grainAmount = preset.adjust.grain * intensity * 0.8;
      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * grainAmount;
        data[i] = clamp(data[i] + noise);
        data[i + 1] = clamp(data[i + 1] + noise);
        data[i + 2] = clamp(data[i + 2] + noise);
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  return canvas;
}

function canvasToBlobPromise(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to convert'));
      },
      mimeType,
      quality
    );
  });
}

/**
 * Smart WebP conversion with aggressive optimization.
 * Starts quality lower and reduces more aggressively to ensure smaller output.
 * Falls back to JPEG if WebP is still too large.
 */
export async function canvasToWebPBlob(
  canvas: HTMLCanvasElement,
  quality: number,
  lossless: boolean,
  originalSize?: number,
): Promise<Blob> {
  if (lossless) {
    return canvasToBlobPromise(canvas, 'image/webp', 1.0);
  }

  let blob = await canvasToBlobPromise(canvas, 'image/webp', quality);

  // Smart optimization: if output is bigger than original, reduce quality aggressively
  if (originalSize && blob.size > originalSize) {
    // Start with a bigger step down
    let tryQuality = Math.min(quality - 0.1, 0.78);

    while (tryQuality >= 0.35 && blob.size > originalSize) {
      blob = await canvasToBlobPromise(canvas, 'image/webp', tryQuality);
      tryQuality -= 0.08;
    }

    // If still bigger, try JPEG as fallback for better compression
    if (blob.size > originalSize) {
      const jpegBlob = await canvasToBlobPromise(canvas, 'image/jpeg', Math.min(quality, 0.78));
      if (jpegBlob.size < blob.size) {
        return jpegBlob;
      }
    }
  }

  return blob;
}

export function generatePreview(
  img: HTMLImageElement,
  preset: LUTPreset | null,
  cubeLut: CubeLUT | null,
  intensity: number,
): string {
  // Cap preview at 800px for faster generation
  const maxDim = 800;
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  if (w > maxDim || h > maxDim) {
    const ratio = Math.min(maxDim / w, maxDim / h);
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, w, h);

  if ((preset || cubeLut) && intensity > 0) {
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i], g = data[i + 1], b = data[i + 2];
      if (cubeLut) {
        const [nr, ng, nb] = applyCubeLUT(r, g, b, cubeLut, intensity);
        r = nr; g = ng; b = nb;
      } else if (preset) {
        const [nr, ng, nb] = applyColorAdjustment(r, g, b, preset.adjust, intensity);
        r = nr; g = ng; b = nb;
      }
      data[i] = clamp(r); data[i + 1] = clamp(g); data[i + 2] = clamp(b);
    }
    if (preset?.adjust.grain && preset.adjust.grain > 0) {
      const grainAmount = preset.adjust.grain * intensity * 0.8;
      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * grainAmount;
        data[i] = clamp(data[i] + noise);
        data[i + 1] = clamp(data[i + 1] + noise);
        data[i + 2] = clamp(data[i + 2] + noise);
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }

  return canvas.toDataURL('image/jpeg', 0.85);
}
