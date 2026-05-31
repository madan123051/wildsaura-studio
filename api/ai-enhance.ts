// Vercel Serverless Function — completely self-contained (no ../utils imports)
// This avoids bundler issues with relative imports in /api/ folder

// ─── Inline helpers (no external imports needed) ────────────────────────────

function safeJsonParse(text: string, fallback: any = null): any {
  try { return JSON.parse(text); } catch { return fallback; }
}

// ─── Cinematic Presets (inlined to avoid import issues) ─────────────────────

interface AdjustmentPreset {
  [key: string]: number;
}

const CINEMATIC_PRESETS: Record<string, { name: string; adjustments: AdjustmentPreset }> = {
  STREET_NIGHT: {
    name: 'Street Night',
    adjustments: {
      exposure: -15, contrast: 45, highlights: -20, shadows: 15, blacks: -20,
      temperature: 20, vibrance: 35, saturation: 15, clarity: 25, sharpness: 30,
      vignette: 60, grain: 10, whites: 0, tint: 0, denoise: 0, fog: 0,
    },
  },
  NATURE_WILDLIFE: {
    name: 'Nature Wildlife',
    adjustments: {
      exposure: 5, contrast: 20, highlights: 0, shadows: 15, blacks: 0,
      temperature: -10, vibrance: 45, saturation: 15, clarity: 40, sharpness: 55,
      vignette: 15, grain: 0, whites: 0, tint: 0, denoise: 0, fog: 0,
    },
  },
  PORTRAIT_PEOPLE: {
    name: 'Portrait People',
    adjustments: {
      exposure: 10, contrast: 15, highlights: -25, shadows: 20, blacks: 0,
      temperature: 20, vibrance: 25, saturation: 0, clarity: 10, sharpness: 20,
      vignette: 20, grain: 0, whites: 0, tint: 0, denoise: 0, fog: 0,
    },
  },
  LANDSCAPE_DAY: {
    name: 'Landscape Day',
    adjustments: {
      exposure: 10, contrast: 35, highlights: -40, shadows: 35, blacks: 0,
      temperature: -15, vibrance: 55, saturation: 20, clarity: 55, sharpness: 40,
      vignette: 30, grain: 0, whites: 15, tint: 0, denoise: 0, fog: 0,
    },
  },
  MINIMAL_MOODY: {
    name: 'Minimal Moody',
    adjustments: {
      exposure: -20, contrast: 40, highlights: -15, shadows: 0, blacks: 0,
      temperature: -35, vibrance: -15, saturation: -40, clarity: 20, sharpness: 0,
      vignette: 45, grain: 20, whites: 0, tint: 0, denoise: 0, fog: 10,
    },
  },
  MACRO_DETAIL: {
    name: 'Macro Detail',
    adjustments: {
      exposure: 5, contrast: 25, highlights: -10, shadows: 20, blacks: 0,
      temperature: -5, vibrance: 40, saturation: 10, clarity: 60, sharpness: 65,
      vignette: 35, grain: 0, whites: 0, tint: 0, denoise: 5, fog: 0,
    },
  },
  GOLDEN_HOUR: {
    name: 'Golden Hour',
    adjustments: {
      exposure: 10, contrast: 20, highlights: -30, shadows: 25, blacks: 0,
      temperature: 35, vibrance: 40, saturation: 15, clarity: 15, sharpness: 25,
      vignette: 20, grain: 5, whites: 10, tint: 10, denoise: 0, fog: 5,
    },
  },
  BLUE_HOUR: {
    name: 'Blue Hour',
    adjustments: {
      exposure: -5, contrast: 30, highlights: -20, shadows: 20, blacks: -10,
      temperature: -30, vibrance: 35, saturation: 10, clarity: 30, sharpness: 30,
      vignette: 35, grain: 8, whites: 0, tint: -10, denoise: 5, fog: 5,
    },
  },
};

const FALLBACK_PRESET: { name: string; adjustments: AdjustmentPreset } = {
  name: 'Cinematic',
  adjustments: {
    exposure: 0, contrast: 25, highlights: -15, shadows: 15, blacks: 0,
    temperature: 0, vibrance: 20, saturation: 0, clarity: 20, sharpness: 20,
    vignette: 25, grain: 8, whites: 0, tint: 0, denoise: 0, fog: 0,
  },
};

function getPreset(category: string) {
  return CINEMATIC_PRESETS[category] || FALLBACK_PRESET;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/tiff', 'image/webp', 'image/bmp',
  'image/x-canon-cr2', 'image/x-canon-cr3', 'image/x-nikon-nef',
  'image/x-sony-arw', 'image/x-adobe-dng', 'image/x-fuji-raf',
]);

const FALLBACK_GENRE = 'NATURE_WILDLIFE';

const CLASSIFY_PROMPT = `Analyze this image and classify it into one of the following cinematic categories:
STREET_NIGHT, NATURE_WILDLIFE, PORTRAIT_PEOPLE, LANDSCAPE_DAY, MINIMAL_MOODY, MACRO_DETAIL, GOLDEN_HOUR, BLUE_HOUR.

Return ONLY the category name. No other text.`;

// ─── Resolve API key (supports both naming conventions) ─────────────────────

function getApiKey(): string | undefined {
  // Check both: user may have set GEMINI_API_KEY or VITE_GEMINI_API_KEY
  return process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
}

// ─── Main Handler ───────────────────────────────────────────────────────────

export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Parse body
  const body = typeof req.body === 'string' ? safeJsonParse(req.body, {}) : (req.body || {});
  const imageData = body.imageBuffer || body.imageData || '';
  const mimeType = (body.mimeType || 'image/jpeg').toLowerCase();

  if (!imageData) return res.status(400).json({ error: 'Missing image data' });
  if (!ALLOWED_MIME_TYPES.has(mimeType) && !mimeType.startsWith('image/')) {
    return res.status(400).json({ error: 'Unsupported image format' });
  }

  // ── ALWAYS return 200 — try Gemini, fallback to preset if anything fails ──
  try {
    const apiKey = getApiKey();
    if (!apiKey) {
      console.warn('[AI_ENHANCE] No API key found (checked GEMINI_API_KEY and VITE_GEMINI_API_KEY)');
      throw new Error('API key not configured');
    }

    // Dynamic import to avoid build-time crashes if package is missing
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    // Try models in order of preference
    const models = [
      process.env.GEMINI_MODEL,
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
    ].filter(Boolean) as string[];

    let response: any = null;
    let modelUsed = '';

    for (const model of models) {
      try {
        console.info(`[AI_ENHANCE] Trying model: ${model}`);
        response = await ai.models.generateContent({
          model,
          contents: [{
            role: 'user',
            parts: [
              { inlineData: { data: imageData, mimeType } },
              { text: CLASSIFY_PROMPT },
            ],
          }],
        });
        modelUsed = model;
        break;
      } catch (err: any) {
        const msg = err?.message || '';
        const status = err?.status || err?.code || 0;
        const isModelError = status === 404 || msg.includes('not found') || msg.includes('404') ||
          msg.includes('not supported') || msg.includes('MODEL_NOT_FOUND') || msg.includes('PERMISSION_DENIED');
        if (isModelError) {
          console.warn(`[AI_ENHANCE] Model ${model} unavailable, trying next...`);
          continue;
        }
        throw err; // non-model error → go to fallback
      }
    }

    if (!response) throw new Error('All models failed');

    const rawText = typeof response.text === 'function' ? response.text() : (response.text || '');
    const category = rawText.trim().toUpperCase().replace(/[^A-Z_]/g, '');
    const genreDetected = category || FALLBACK_GENRE;
    const preset = getPreset(genreDetected);

    console.info('[AI_ENHANCE] Success', { genreDetected, modelUsed });
    return res.status(200).json({
      success: true,
      genreDetected,
      appliedSettings: preset.adjustments,
      modelUsed,
      settings: { ...preset.adjustments, detected_scene: genreDetected },
    });

  } catch (error: any) {
    // ── Fallback: ALWAYS 200 with a good preset — UI never shows error ──
    console.error('[AI_ENHANCE] Falling back to preset:', error?.message || 'Unknown');
    const fallback = getPreset(FALLBACK_GENRE);
    return res.status(200).json({
      success: true,
      genreDetected: FALLBACK_GENRE,
      appliedSettings: fallback.adjustments,
      settings: { ...fallback.adjustments, detected_scene: FALLBACK_GENRE },
      _fallback: true,
      _reason: error?.message,
    });
  }
}
