import { GoogleGenAI } from "@google/genai";
import { safeJsonParse } from "../utils/inputSafety";

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/tiff', 'image/webp', 'image/bmp',
  'image/x-canon-cr2', 'image/x-canon-cr3', 'image/x-nikon-nef',
  'image/x-sony-arw', 'image/x-adobe-dng', 'image/x-fuji-raf',
]);

const FALLBACK_SETTINGS = {
  exposure: 0, highlights: -15, shadows: 10, contrast: 12,
  temperature: 0, tint: 0, vibrance: 10, saturation: 0,
  clarity: 15, sharpness: 20, denoise: 10,
  vignette: 15, grain: 5, fog: 0, whites: 0, blacks: 0,
  detected_scene: 'NATURE_WILDLIFE',
};

const AI_ENHANCE_PROMPT = `You are an expert AI Cinematic Colorist for WildSaura Studio.

Analyze this image and return ONLY a strict JSON object (no markdown, no backticks) with these keys:

{
  "exposure":    (-100 to 100),
  "highlights":  (-100 to 100, negative=recover blown highlights),
  "shadows":     (-100 to 100, positive=lift dark shadows),
  "contrast":    (-100 to 100),
  "temperature": (-100 to 100, negative=cool/blue, positive=warm/yellow),
  "tint":        (-100 to 100, negative=green, positive=magenta),
  "vibrance":    (-100 to 100),
  "saturation":  (-100 to 100),
  "clarity":     (0 to 100),
  "sharpness":   (0 to 100),
  "denoise":     (0 to 100),
  "vignette":    (0 to 100),
  "grain":       (0 to 100),
  "fog":         (0 to 100),
  "whites":      (-100 to 100),
  "blacks":      (-100 to 100),
  "detected_scene": "STREET_NIGHT|NATURE_WILDLIFE|PORTRAIT_PEOPLE|LANDSCAPE_DAY|MINIMAL_MOODY|MACRO_DETAIL|GOLDEN_HOUR|BLUE_HOUR"
}

Scene guidance:
- Flowers/nature: highlights -20 to -35 (protect petals), lift shadows, add vibrance
- Street night: boost shadows, high contrast, teal temperature, subtle grain
- Portraits: gentle exposure, recover highlights, low grain, neutral color
- Landscape: recover highlights, vibrance, clarity
- Golden hour: warm temperature +20-40, rich vibrance, crush blacks
- Blue hour: cool temperature -15-25, lift shadows, high clarity
- Macro: high sharpness 30-50, clarity, protect highlights

Return ONLY raw JSON. No markdown. No extra text.`;

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = typeof req.body === 'string' ? safeJsonParse(req.body, {}) : (req.body || {});
  const imageData = typeof body.imageData === 'string' ? body.imageData.trim() : '';
  const mimeType  = typeof body.mimeType  === 'string' ? body.mimeType.toLowerCase().trim() : '';

  if (!imageData) return res.status(400).json({ error: 'Invalid imageData payload' });
  if (!mimeType)  return res.status(400).json({ error: 'mimeType is required' });
  if (!ALLOWED_MIME_TYPES.has(mimeType) && !mimeType.startsWith('image/')) {
    return res.status(400).json({ error: 'Unsupported image format.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured.' });

  try {
    const ai = new GoogleGenAI({ apiKey });
    console.info('[AI_ENHANCE_REQUEST]', { mimeType, imageLength: imageData.length });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ inlineData: { data: imageData, mimeType } }, AI_ENHANCE_PROMPT],
    });

    const rawText = (response.text || '').trim();
    const cleaned = rawText
      .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

    const parsed = safeJsonParse(cleaned, null);
    if (!parsed || typeof parsed !== 'object') throw new Error('Non-JSON response from Gemini');

    const clamp = (v: any, min: number, max: number, def: number): number => {
      const n = typeof v === 'number' ? v : parseFloat(v);
      return isNaN(n) ? def : Math.max(min, Math.min(max, Math.round(n)));
    };

    const settings = {
      exposure:     clamp(parsed.exposure,    -100, 100,  0),
      highlights:   clamp(parsed.highlights,  -100, 100, -15),
      shadows:      clamp(parsed.shadows,     -100, 100,  10),
      contrast:     clamp(parsed.contrast,    -100, 100,  12),
      temperature:  clamp(parsed.temperature, -100, 100,   0),
      tint:         clamp(parsed.tint,        -100, 100,   0),
      vibrance:     clamp(parsed.vibrance,    -100, 100,  10),
      saturation:   clamp(parsed.saturation,  -100, 100,   0),
      clarity:      clamp(parsed.clarity,        0, 100,  15),
      sharpness:    clamp(parsed.sharpness,      0, 100,  20),
      denoise:      clamp(parsed.denoise,        0, 100,  10),
      vignette:     clamp(parsed.vignette,       0, 100,  15),
      grain:        clamp(parsed.grain,          0, 100,   5),
      fog:          clamp(parsed.fog,            0, 100,   0),
      whites:       clamp(parsed.whites,      -100, 100,   0),
      blacks:       clamp(parsed.blacks,      -100, 100,   0),
      detected_scene: typeof parsed.detected_scene === 'string'
        ? parsed.detected_scene.toUpperCase().replace(/[^A-Z_]/g, '').slice(0, 30)
        : 'NATURE_WILDLIFE',
    };

    console.info('[AI_ENHANCE_SUCCESS]', { detected_scene: settings.detected_scene });
    return res.status(200).json({ success: true, settings });

  } catch (error: any) {
    console.error('[AI_ENHANCE_ERROR]', { message: error?.message || 'Unknown error', mimeType });
    return res.status(200).json({ success: true, settings: FALLBACK_SETTINGS, recovery: true });
  }
}
