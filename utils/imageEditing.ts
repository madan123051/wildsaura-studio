// ============================================================
// WildSaura Pro Studio — Canvas-based Image Editing Engine
// All adjustment functions operate on Uint8ClampedArray (ImageData.data)
// ============================================================

// --------------- Helpers ---------------

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) {
    h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  } else if (max === g) {
    h = ((b - r) / d + 2) / 6;
  } else {
    h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, s, l];
}

function hueToRgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  h /= 360;
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hueToRgb(p, q, h + 1 / 3) * 255),
    Math.round(hueToRgb(p, q, h) * 255),
    Math.round(hueToRgb(p, q, h - 1 / 3) * 255),
  ];
}

export function getLuminance(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

// --------------- LIGHT ---------------

export function adjustExposure(
  data: Uint8ClampedArray,
  _w: number,
  _h: number,
  value: number,
): void {
  if (value === 0) return;
  const factor = Math.pow(2, value / 50);
  for (let i = 0, len = data.length; i < len; i += 4) {
    data[i] = clamp(data[i] * factor, 0, 255);
    data[i + 1] = clamp(data[i + 1] * factor, 0, 255);
    data[i + 2] = clamp(data[i + 2] * factor, 0, 255);
  }
}

export function adjustContrast(
  data: Uint8ClampedArray,
  _w: number,
  _h: number,
  value: number,
): void {
  if (value === 0) return;
  const factor = (259 * (value * 2.55 + 255)) / (255 * (259 - value * 2.55));
  for (let i = 0, len = data.length; i < len; i += 4) {
    data[i] = clamp(factor * (data[i] - 128) + 128, 0, 255);
    data[i + 1] = clamp(factor * (data[i + 1] - 128) + 128, 0, 255);
    data[i + 2] = clamp(factor * (data[i + 2] - 128) + 128, 0, 255);
  }
}

export function adjustHighlights(
  data: Uint8ClampedArray,
  _w: number,
  _h: number,
  value: number,
): void {
  if (value === 0) return;
  const amount = value / 100;
  for (let i = 0, len = data.length; i < len; i += 4) {
    const lum = getLuminance(data[i], data[i + 1], data[i + 2]);
    if (lum > 0.5) {
      const weight = (lum - 0.5) * 2; // 0..1 smooth ramp
      const shift = amount * weight * 80;
      data[i] = clamp(data[i] + shift, 0, 255);
      data[i + 1] = clamp(data[i + 1] + shift, 0, 255);
      data[i + 2] = clamp(data[i + 2] + shift, 0, 255);
    }
  }
}

export function adjustShadows(
  data: Uint8ClampedArray,
  _w: number,
  _h: number,
  value: number,
): void {
  if (value === 0) return;
  const amount = value / 100;
  for (let i = 0, len = data.length; i < len; i += 4) {
    const lum = getLuminance(data[i], data[i + 1], data[i + 2]);
    if (lum < 0.5) {
      const weight = 1 - lum * 2; // strongest in deep shadows
      const shift = amount * weight * 80;
      data[i] = clamp(data[i] + shift, 0, 255);
      data[i + 1] = clamp(data[i + 1] + shift, 0, 255);
      data[i + 2] = clamp(data[i + 2] + shift, 0, 255);
    }
  }
}

export function adjustWhites(
  data: Uint8ClampedArray,
  _w: number,
  _h: number,
  value: number,
): void {
  if (value === 0) return;
  const amount = value / 100;
  for (let i = 0, len = data.length; i < len; i += 4) {
    const lum = getLuminance(data[i], data[i + 1], data[i + 2]);
    if (lum > 0.8) {
      const weight = (lum - 0.8) / 0.2; // 0..1 ramp in top 20%
      const shift = amount * weight * 60;
      data[i] = clamp(data[i] + shift, 0, 255);
      data[i + 1] = clamp(data[i + 1] + shift, 0, 255);
      data[i + 2] = clamp(data[i + 2] + shift, 0, 255);
    }
  }
}

export function adjustBlacks(
  data: Uint8ClampedArray,
  _w: number,
  _h: number,
  value: number,
): void {
  if (value === 0) return;
  const amount = value / 100;
  for (let i = 0, len = data.length; i < len; i += 4) {
    const lum = getLuminance(data[i], data[i + 1], data[i + 2]);
    if (lum < 0.2) {
      const weight = 1 - lum / 0.2; // strongest at pure black
      const shift = amount * weight * 60;
      data[i] = clamp(data[i] + shift, 0, 255);
      data[i + 1] = clamp(data[i + 1] + shift, 0, 255);
      data[i + 2] = clamp(data[i + 2] + shift, 0, 255);
    }
  }
}

// --------------- COLOR ---------------

export function adjustTemperature(
  data: Uint8ClampedArray,
  _w: number,
  _h: number,
  value: number,
): void {
  if (value === 0) return;
  const amount = value / 100;
  const rShift = amount * 30;
  const bShift = -amount * 30;
  for (let i = 0, len = data.length; i < len; i += 4) {
    data[i] = clamp(data[i] + rShift, 0, 255);
    data[i + 2] = clamp(data[i + 2] + bShift, 0, 255);
  }
}

export function adjustTint(
  data: Uint8ClampedArray,
  _w: number,
  _h: number,
  value: number,
): void {
  if (value === 0) return;
  const amount = value / 100;
  // positive = magenta (add R+B, sub G), negative = green (add G, sub R+B)
  const gShift = -amount * 25;
  const rmShift = amount * 10;
  for (let i = 0, len = data.length; i < len; i += 4) {
    data[i] = clamp(data[i] + rmShift, 0, 255);
    data[i + 1] = clamp(data[i + 1] + gShift, 0, 255);
    data[i + 2] = clamp(data[i + 2] + rmShift, 0, 255);
  }
}

export function adjustVibrance(
  data: Uint8ClampedArray,
  _w: number,
  _h: number,
  value: number,
): void {
  if (value === 0) return;
  const amount = value / 100;
  for (let i = 0, len = data.length; i < len; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const sat = maxC === 0 ? 0 : (maxC - minC) / maxC;
    // Boost less-saturated pixels more
    const boost = amount * (1 - sat) * 0.5;
    const avg = (r + g + b) / 3;
    data[i] = clamp(r + (r - avg) * boost, 0, 255);
    data[i + 1] = clamp(g + (g - avg) * boost, 0, 255);
    data[i + 2] = clamp(b + (b - avg) * boost, 0, 255);
  }
}

export function adjustSaturation(
  data: Uint8ClampedArray,
  _w: number,
  _h: number,
  value: number,
): void {
  if (value === 0) return;
  const amount = 1 + value / 100;
  for (let i = 0, len = data.length; i < len; i += 4) {
    const gray = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    data[i] = clamp(gray + (data[i] - gray) * amount, 0, 255);
    data[i + 1] = clamp(gray + (data[i + 1] - gray) * amount, 0, 255);
    data[i + 2] = clamp(gray + (data[i + 2] - gray) * amount, 0, 255);
  }
}

// --------------- DETAILS ---------------

export function adjustClarity(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  value: number,
): void {
  if (value === 0) return;
  const amount = value / 100;
  const radius = 4;

  // Build luminance channel
  const lumArr = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      lumArr[y * w + x] = 0.2126 * data[idx] + 0.7152 * data[idx + 1] + 0.0722 * data[idx + 2];
    }
  }

  // Box blur the luminance (horizontal then vertical)
  const blurH = new Float32Array(w * h);
  const blurred = new Float32Array(w * h);

  // Horizontal pass
  for (let y = 0; y < h; y++) {
    let sum = 0;
    const rowOff = y * w;
    for (let x = 0; x < radius; x++) sum += lumArr[rowOff + x];
    for (let x = 0; x < w; x++) {
      const right = Math.min(x + radius, w - 1);
      const left = x - radius - 1;
      sum += lumArr[rowOff + right];
      if (left >= 0) sum -= lumArr[rowOff + left];
      const count = right - (left >= 0 ? left : -1);
      blurH[rowOff + x] = sum / count;
    }
  }

  // Vertical pass
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = 0; y < radius; y++) sum += blurH[y * w + x];
    for (let y = 0; y < h; y++) {
      const bottom = Math.min(y + radius, h - 1);
      const top = y - radius - 1;
      sum += blurH[bottom * w + x];
      if (top >= 0) sum -= blurH[top * w + x];
      const count = bottom - (top >= 0 ? top : -1);
      blurred[y * w + x] = sum / count;
    }
  }

  // Unsharp mask: add back the high-frequency detail
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const pi = y * w + x;
      const idx = pi * 4;
      const diff = (lumArr[pi] - blurred[pi]) * amount * 1.5;
      data[idx] = clamp(data[idx] + diff, 0, 255);
      data[idx + 1] = clamp(data[idx + 1] + diff, 0, 255);
      data[idx + 2] = clamp(data[idx + 2] + diff, 0, 255);
    }
  }
}

export function adjustSharpness(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  value: number,
): void {
  if (value === 0) return;
  const amount = value / 100;
  // Sharpen kernel:  0 -1  0
  //                 -1  5 -1
  //                  0 -1  0
  // We blend the sharpened result with the original based on amount
  const copy = new Uint8ClampedArray(data);

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      const top = ((y - 1) * w + x) * 4;
      const bot = ((y + 1) * w + x) * 4;
      const lft = (y * w + x - 1) * 4;
      const rgt = (y * w + x + 1) * 4;

      for (let c = 0; c < 3; c++) {
        const sharp =
          5 * copy[idx + c] -
          copy[top + c] -
          copy[bot + c] -
          copy[lft + c] -
          copy[rgt + c];
        data[idx + c] = clamp(copy[idx + c] + (sharp - copy[idx + c]) * amount, 0, 255);
      }
    }
  }
}

export function adjustDenoise(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  value: number,
): void {
  if (value === 0) return;
  const radius = Math.max(1, Math.round((value / 100) * 3));
  const threshold = (value / 100) * 30;
  const copy = new Uint8ClampedArray(data);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const origR = copy[idx];
      const origG = copy[idx + 1];
      const origB = copy[idx + 2];

      let sumR = 0, sumG = 0, sumB = 0, count = 0;

      const yStart = Math.max(0, y - radius);
      const yEnd = Math.min(h - 1, y + radius);
      const xStart = Math.max(0, x - radius);
      const xEnd = Math.min(w - 1, x + radius);

      for (let ny = yStart; ny <= yEnd; ny++) {
        for (let nx = xStart; nx <= xEnd; nx++) {
          const nIdx = (ny * w + nx) * 4;
          const dr = copy[nIdx] - origR;
          const dg = copy[nIdx + 1] - origG;
          const db = copy[nIdx + 2] - origB;
          const dist = Math.sqrt(dr * dr + dg * dg + db * db);
          if (dist < threshold) {
            sumR += copy[nIdx];
            sumG += copy[nIdx + 1];
            sumB += copy[nIdx + 2];
            count++;
          }
        }
      }

      if (count > 0) {
        data[idx] = sumR / count;
        data[idx + 1] = sumG / count;
        data[idx + 2] = sumB / count;
      }
    }
  }
}

// --------------- CREATIVE ---------------

export function applyVignette(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  amount: number,
): void {
  if (amount === 0) return;
  const strength = amount / 100;
  const cx = w / 2;
  const cy = h / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) / maxDist;
      // Smooth power curve: ramp starts at ~0.3 radius
      const vignette = 1 - strength * Math.pow(dist, 2) * 1.2;
      const factor = Math.max(0, vignette);
      const idx = (y * w + x) * 4;
      data[idx] = data[idx] * factor;
      data[idx + 1] = data[idx + 1] * factor;
      data[idx + 2] = data[idx + 2] * factor;
    }
  }
}

export function applyFilmGrain(
  data: Uint8ClampedArray,
  _w: number,
  _h: number,
  amount: number,
): void {
  if (amount === 0) return;
  const strength = (amount / 100) * 50; // max noise amplitude ~50
  for (let i = 0, len = data.length; i < len; i += 4) {
    const noise = (Math.random() - 0.5) * 2 * strength;
    data[i] = clamp(data[i] + noise, 0, 255);
    data[i + 1] = clamp(data[i + 1] + noise, 0, 255);
    data[i + 2] = clamp(data[i + 2] + noise, 0, 255);
  }
}

export function applyFog(
  data: Uint8ClampedArray,
  _w: number,
  _h: number,
  amount: number,
): void {
  if (amount === 0) return;
  const strength = amount / 100;
  // Fog: blend toward light gray, reduce contrast
  const fogR = 220;
  const fogG = 220;
  const fogB = 225;

  for (let i = 0, len = data.length; i < len; i += 4) {
    // Lighten + desaturate toward fog color
    data[i] = clamp(data[i] + (fogR - data[i]) * strength * 0.6, 0, 255);
    data[i + 1] = clamp(data[i + 1] + (fogG - data[i + 1]) * strength * 0.6, 0, 255);
    data[i + 2] = clamp(data[i + 2] + (fogB - data[i + 2]) * strength * 0.6, 0, 255);
  }
}

// --------------- HSL (per-channel) ---------------

interface HueRange {
  center: number;
  width: number;
}

const HSL_CHANNEL_RANGES: Record<string, HueRange> = {
  red: { center: 0, width: 30 },
  orange: { center: 30, width: 15 },
  yellow: { center: 55, width: 15 },
  green: { center: 120, width: 40 },
  cyan: { center: 180, width: 30 },
  blue: { center: 240, width: 30 },
  purple: { center: 280, width: 20 },
  magenta: { center: 320, width: 20 },
};

function hueDistance(h1: number, h2: number): number {
  let d = Math.abs(h1 - h2);
  if (d > 180) d = 360 - d;
  return d;
}

export function adjustHSL(
  data: Uint8ClampedArray,
  _w: number,
  _h: number,
  channel: string,
  hueShift: number,
  satShift: number,
  lumShift: number,
): void {
  if (hueShift === 0 && satShift === 0 && lumShift === 0) return;
  const range = HSL_CHANNEL_RANGES[channel];
  if (!range) return;

  const { center, width } = range;
  // Soft falloff zone extends 50% beyond the hard width
  const softWidth = width * 1.5;

  for (let i = 0, len = data.length; i < len; i += 4) {
    const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    const dist = hueDistance(h, center);

    if (dist > softWidth) continue;

    // Calculate weight with smooth falloff
    let weight: number;
    if (dist <= width) {
      weight = 1;
    } else {
      weight = 1 - (dist - width) / (softWidth - width);
      weight = weight * weight * (3 - 2 * weight); // smoothstep
    }

    // Also weight by saturation – very desaturated pixels shouldn't be affected much
    weight *= Math.min(1, s * 4);

    const newH = h + hueShift * weight;
    const newS = clamp(s + (satShift / 100) * weight, 0, 1);
    const newL = clamp(l + (lumShift / 100) * weight * 0.5, 0, 1);

    const [r, g, b] = hslToRgb(newH, newS, newL);
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
}

// --------------- CROP HELPERS ---------------

export function cropImage(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  w: number,
  h: number,
): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d')!;
  ctx.drawImage(canvas, x, y, w, h, 0, 0, w, h);
  return out;
}

export function rotateImage(
  canvas: HTMLCanvasElement,
  degrees: number,
): HTMLCanvasElement {
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const newW = Math.round(canvas.width * cos + canvas.height * sin);
  const newH = Math.round(canvas.width * sin + canvas.height * cos);

  const out = document.createElement('canvas');
  out.width = newW;
  out.height = newH;
  const ctx = out.getContext('2d')!;
  ctx.translate(newW / 2, newH / 2);
  ctx.rotate(rad);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return out;
}

export function flipImage(
  canvas: HTMLCanvasElement,
  horizontal: boolean,
): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext('2d')!;
  if (horizontal) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  } else {
    ctx.translate(0, canvas.height);
    ctx.scale(1, -1);
  }
  ctx.drawImage(canvas, 0, 0);
  return out;
}
