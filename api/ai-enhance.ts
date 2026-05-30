import { GoogleGenAI } from "@google/genai";
import { safeJsonParse } from "../utils/inputSafety";
import { getCinematicPreset } from "../utils/cinematicPresets";
import type { EditAdjustments } from "../types";

// ─── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/tiff', 'image/webp', 'image/bmp',
  'image/x-canon-cr2', 'image/x-canon-cr3', 'image/x-nikon-nef',
  'image/x-sony-arw', 'image/x-adobe-dng', 'image/x-fuji-raf',
]);

const FALLBACK_GENRE = 'NATURE_WILDLIFE';

const CANDIDATE_MODELS = [
  process.env.GEMINI_MODEL,
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
].filter(Boolean) as string[];

// ─── Gemini Prompt ────────────────────────────────────────────────────────────

const CLASSIFY_PROMPT = `Analyze this image and classify it into one of the following cinematic categories:
STREET_NIGHT, NATURE_WILDLIFE, PORTRAIT_PEOPLE, LANDSCAPE_DAY, MINIMAL_MOODY, MACRO_DETAIL, GOLDEN_HOUR, BLUE_HOUR.

Return ONLY the category name. No other text.`;

// ─── Helper: try models in order ─────────────────────────────────────────────

async function generateWithAutoModel(
  ai: GoogleGenAI,
  contents: any[],
): Promise<{ response: any; modelUsed: string }> {
  let lastError: any;
  for (const model of CANDIDATE_MODELS) {
    try {
      console.info(`[AI_ENHANCE] Trying model: ${model}`);
      const response = await ai.models.generateContent({ model, contents });
      return { response, modelUsed: model };
    } catch (err: any) {
      const msg: string = err?.message || '';
      const status: number = err?.status || err?.code || 0;
      const isModelError =
        status === 404 ||
        msg.includes('not found') ||
        msg.includes('404') ||
        msg.includes('is not supported') ||
        msg.includes('MODEL_NOT_FOUND') ||
        msg.includes('permission') ||
        msg.includes('PERMISSION_DENIED');
      if (isModelError) {
        console.warn(`[AI_ENHANCE] Model ${model} unavailable (${status}), trying next...`);
        lastError = err;
        continue;
      }
      throw err;
    }
  }
  throw lastError || new Error('All models failed');
}

// ─── Main Handler ────────────────────────────────────────────────────────────

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = typeof req.body === 'string' ? safeJsonParse(req.body, {}) : (req.body || {});
  const imageData = body.imageBuffer || body.imageData || '';
  const mimeType = (body.mimeType || 'image/jpeg').toLowerCase();

  if (!imageData) return res.status(400).json({ error: 'Missing image data' });
  if (!ALLOWED_MIME_TYPES.has(mimeType) && !mimeType.startsWith('image/')) {
    return res.status(400).json({ error: 'Unsupported image format' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  try {
    const ai = new GoogleGenAI({ apiKey });
    const contents = [{
      role: 'user',
      parts: [
        { inlineData: { data: imageData, mimeType } },
        { text: CLASSIFY_PROMPT },
      ],
    }];

    const { response, modelUsed } = await generateWithAutoModel(ai, contents);
    const category = (response.text || '').trim().toUpperCase().replace(/[^A-Z_]/g, '');
    const genreDetected = category || FALLBACK_GENRE;

    // Apply specific cinematic logic based on category
    const preset = getCinematicPreset(genreDetected);
    const appliedSettings = preset.adjustments as EditAdjustments;

    console.info('[AI_ENHANCE] Success', { genreDetected, modelUsed });
    return res.status(200).json({
      success: true,
      genreDetected,
      appliedSettings,
      modelUsed,
      settings: { ...appliedSettings, detected_scene: genreDetected },
    });

  } catch (error: any) {
    console.error('[AI_ENHANCE] Error', { message: error?.message || 'Unknown', mimeType });
    const fallbackPreset = getCinematicPreset(FALLBACK_GENRE);
    return res.status(200).json({
      success: true,
      genreDetected: FALLBACK_GENRE,
      appliedSettings: fallbackPreset.adjustments,
      settings: { ...fallbackPreset.adjustments, detected_scene: FALLBACK_GENRE },
      error: error?.message,
    });
  }
}
