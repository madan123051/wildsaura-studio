import { LUTPreset, CubeLUT } from '../types';

export const LUT_PRESETS: LUTPreset[] = [
  {
    id: 'midnight-teal',
    name: 'Midnight Teal',
    description: 'Deep blues & warm skin tones',
    gradient: 'from-cyan-900 via-teal-800 to-amber-900',
    adjust: {
      temperature: -30,
      saturation: 10,
      contrast: 15,
      shadows: [0, 15, 30],
      midtones: [0, 5, 10],
      highlights: [15, 5, -5],
      crushShadows: 20,
    },
  },
  {
    id: 'vintage-soul',
    name: 'Vintage Soul',
    description: 'Faded blacks, warm greens',
    gradient: 'from-amber-800 via-yellow-900 to-emerald-950',
    adjust: {
      fadeBlacks: 25,
      saturation: -15,
      temperature: 15,
      contrast: -10,
      shadows: [10, 8, 0],
      midtones: [5, 8, 0],
      highlights: [10, 5, -5],
      grain: 15,
    },
  },
  {
    id: 'wild-aura-gold',
    name: 'Wild Aura Gold',
    description: 'Enhanced golden hour, soft highlights',
    gradient: 'from-orange-500 via-amber-600 to-yellow-800',
    adjust: {
      temperature: 35,
      saturation: 15,
      brightness: 5,
      shadows: [5, 0, -10],
      midtones: [10, 5, -5],
      highlights: [20, 10, -5],
    },
  },
  {
    id: 'deep-forest',
    name: 'Deep Forest',
    description: 'Moody dark greens, high contrast',
    gradient: 'from-green-950 via-emerald-900 to-stone-950',
    adjust: {
      contrast: 30,
      saturation: 5,
      temperature: -10,
      shadows: [-5, 10, -5],
      midtones: [-10, 5, -10],
      highlights: [-5, 5, 0],
      crushShadows: 30,
    },
  },
  {
    id: 'kodak-250d',
    name: 'Kodak 250D',
    description: 'Authentic film, balanced colors',
    gradient: 'from-orange-800 via-amber-700 to-sky-900',
    adjust: {
      temperature: 10,
      saturation: -5,
      contrast: 10,
      fadeBlacks: 8,
      shadows: [8, 3, 0],
      midtones: [3, 2, 0],
      highlights: [5, 0, -3],
      grain: 10,
    },
  },
  {
    id: 'shadow-whisper',
    name: 'Shadow Whisper',
    description: 'Crushed shadows, cool desaturated',
    gradient: 'from-slate-900 via-blue-950 to-zinc-900',
    adjust: {
      saturation: -30,
      contrast: 20,
      temperature: -20,
      crushShadows: 40,
      shadows: [0, 0, 15],
      midtones: [-5, 0, 5],
      highlights: [0, -3, 5],
    },
  },
  {
    id: 'tungsten-night',
    name: 'Tungsten Night',
    description: 'Blue/Orange contrast, neon pop',
    gradient: 'from-blue-800 via-indigo-900 to-orange-700',
    adjust: {
      contrast: 25,
      saturation: 20,
      temperature: -15,
      shadows: [0, 0, 30],
      midtones: [0, -5, 10],
      highlights: [25, 10, -10],
    },
  },
  {
    id: 'ethereal-mist',
    name: 'Ethereal Mist',
    description: 'High dynamic range, soft glow',
    gradient: 'from-purple-200/30 via-pink-100/20 to-sky-200/30',
    adjust: {
      brightness: 10,
      contrast: -15,
      saturation: -10,
      fadeBlacks: 15,
      shadows: [5, 5, 10],
      midtones: [5, 3, 8],
      highlights: [10, 5, 15],
    },
  },
  {
    id: 'bw-noir',
    name: 'B&W Noir',
    description: 'Harsh contrast, silver highlights',
    gradient: 'from-zinc-950 via-zinc-600 to-zinc-300',
    adjust: {
      saturation: -100,
      contrast: 40,
      crushShadows: 25,
      highlights: [10, 10, 10],
    },
  },
  {
    id: 'safari-earth',
    name: 'Safari Earth',
    description: 'Warm browns, muted yellows',
    gradient: 'from-amber-900 via-orange-800 to-stone-800',
    adjust: {
      temperature: 25,
      saturation: -10,
      contrast: 10,
      shadows: [10, 5, -5],
      midtones: [8, 3, -8],
      highlights: [5, 0, -10],
    },
  },
  {
    id: 'nordic-blue',
    name: 'Nordic Blue',
    description: 'Cold, clean, minimal',
    gradient: 'from-sky-300/30 via-blue-200/20 to-slate-400/30',
    adjust: {
      temperature: -35,
      saturation: -20,
      brightness: 5,
      contrast: 5,
      shadows: [-5, 0, 10],
      midtones: [-3, 0, 8],
      highlights: [0, 3, 15],
    },
  },
  {
    id: 'cinematic-punch',
    name: 'Cinematic Punch',
    description: 'High saturation reds, deep blacks',
    gradient: 'from-red-800 via-rose-700 to-zinc-950',
    adjust: {
      saturation: 25,
      contrast: 30,
      crushShadows: 20,
      shadows: [10, -5, -5],
      midtones: [8, -3, -3],
      highlights: [5, 0, 0],
    },
  },
];

export function parseCubeFile(text: string): CubeLUT {
  const lines = text.split('\n');
  let title = 'Custom LUT';
  let size = 0;
  const values: number[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || trimmed === '') continue;
    if (trimmed.startsWith('TITLE')) {
      title = trimmed.replace(/^TITLE\s+"?/, '').replace(/"?\s*$/, '');
    } else if (trimmed.startsWith('LUT_3D_SIZE')) {
      size = parseInt(trimmed.split(/\s+/)[1], 10);
    } else if (trimmed.startsWith('DOMAIN_MIN') || trimmed.startsWith('DOMAIN_MAX')) {
      continue;
    } else {
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 3) {
        values.push(parseFloat(parts[0]), parseFloat(parts[1]), parseFloat(parts[2]));
      }
    }
  }

  if (size === 0 || values.length < size * size * size * 3) {
    throw new Error('Invalid .cube file: insufficient data for declared LUT size');
  }

  return {
    title,
    size,
    data: new Float32Array(values),
  };
}

export function applyCubeLUT(
  r: number, g: number, b: number,
  lut: CubeLUT, intensity: number
): [number, number, number] {
  const s = lut.size - 1;
  const rf = (r / 255) * s;
  const gf = (g / 255) * s;
  const bf = (b / 255) * s;

  const r0 = Math.floor(rf), r1 = Math.min(r0 + 1, s);
  const g0 = Math.floor(gf), g1 = Math.min(g0 + 1, s);
  const b0 = Math.floor(bf), b1 = Math.min(b0 + 1, s);

  const rd = rf - r0, gd = gf - g0, bd = bf - b0;
  const n = lut.size;

  function lookup(ri: number, gi: number, bi: number): [number, number, number] {
    const idx = (bi * n * n + gi * n + ri) * 3;
    return [lut.data[idx], lut.data[idx + 1], lut.data[idx + 2]];
  }

  // Trilinear interpolation
  const c000 = lookup(r0, g0, b0);
  const c100 = lookup(r1, g0, b0);
  const c010 = lookup(r0, g1, b0);
  const c110 = lookup(r1, g1, b0);
  const c001 = lookup(r0, g0, b1);
  const c101 = lookup(r1, g0, b1);
  const c011 = lookup(r0, g1, b1);
  const c111 = lookup(r1, g1, b1);

  const result: [number, number, number] = [0, 0, 0];
  for (let ch = 0; ch < 3; ch++) {
    const c00 = c000[ch] * (1 - rd) + c100[ch] * rd;
    const c01 = c001[ch] * (1 - rd) + c101[ch] * rd;
    const c10 = c010[ch] * (1 - rd) + c110[ch] * rd;
    const c11 = c011[ch] * (1 - rd) + c111[ch] * rd;
    const c0 = c00 * (1 - gd) + c10 * gd;
    const c1 = c01 * (1 - gd) + c11 * gd;
    const val = (c0 * (1 - bd) + c1 * bd) * 255;
    const orig = ch === 0 ? r : ch === 1 ? g : b;
    result[ch] = orig + (val - orig) * intensity;
  }

  return result;
}
