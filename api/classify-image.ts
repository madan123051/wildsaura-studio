import { GoogleGenAI } from "@google/genai";
import { safeJsonParse } from "../utils/inputSafety";

const VALID_CATEGORIES = ['STREET_NIGHT', 'NATURE_WILDLIFE', 'PORTRAIT_PEOPLE', 'LANDSCAPE_DAY', 'MINIMAL_MOODY'] as const;
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/tiff', 'image/webp', 'image/bmp',
  'image/x-canon-cr2', 'image/x-canon-cr3', 'image/x-nikon-nef', 'image/x-sony-arw', 'image/x-adobe-dng', 'image/x-fuji-raf',
]);

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = typeof req.body === 'string' ? safeJsonParse(req.body, {}) : (req.body || {});
  const imageData = typeof body.imageData === 'string' ? body.imageData.trim() : '';
  const mimeType = typeof body.mimeType === 'string' ? body.mimeType.toLowerCase().trim() : '';

  if (!imageData) return res.status(400).json({ error: 'Invalid imageData payload' });
  if (!mimeType) return res.status(400).json({ error: 'mimeType is required' });
  if (!ALLOWED_MIME_TYPES.has(mimeType) && !mimeType.startsWith('image/')) {
    return res.status(400).json({ error: 'This image format needs optimization before cinematic grading.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured in Vercel environment variables' });

  try {
    const ai = new GoogleGenAI({ apiKey });
    console.info('[AI_CLASSIFY_REQUEST]', { mimeType, imageLength: imageData.length, stage: 'classify-image' });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ inlineData: { data: imageData, mimeType } },
        'Classify image into one category only: STREET_NIGHT, NATURE_WILDLIFE, PORTRAIT_PEOPLE, LANDSCAPE_DAY, MINIMAL_MOODY. Return only the category token.'
      ],
    });

    const categoryText = (response.text || '').trim().toUpperCase().replace(/[^A-Z_]/g, '');
    const category = VALID_CATEGORIES.includes(categoryText as any) ? categoryText : 'NATURE_WILDLIFE';
    console.info('[AI_CLASSIFY_SUCCESS]', { category, stage: 'classify-image' });

    return res.status(200).json({ category });
  } catch (error: any) {
    console.error('[AI_CLASSIFY_ERROR]', { message: error?.message || 'Unknown classification error', mimeType, stage: 'classify-image' });
    return res.status(200).json({ category: 'NATURE_WILDLIFE', recovery: true, message: 'Unable to process this image preset. Trying recovery mode...' });
  }
}
