import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from "@google/genai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageData, mimeType } = req.body;

  if (!imageData || !mimeType) {
    return res.status(400).json({ error: 'imageData and mimeType are required' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ 
      error: 'GEMINI_API_KEY not configured in Vercel environment variables' 
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            data: imageData,
            mimeType: mimeType,
          }
        },
        "You are an image classifier for a photo editing app. Analyze the uploaded image and classify it into exactly ONE of these categories based on its subject and lighting. Return ONLY the category name as a single string. Do not write explanations.\n\nCategories:\n- STREET_NIGHT\n- NATURE_WILDLIFE\n- PORTRAIT_PEOPLE\n- LANDSCAPE_DAY\n- MINIMAL_MOODY"
      ],
    });

    const category = response.text.trim();
    
    // Validate category
    const validCategories = ['STREET_NIGHT', 'NATURE_WILDLIFE', 'PORTRAIT_PEOPLE', 'LANDSCAPE_DAY', 'MINIMAL_MOODY'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: 'Invalid category returned from AI' });
    }

    return res.status(200).json({ category });
  } catch (error: any) {
    console.error('Gemini API error:', error);
    return res.status(500).json({ 
      error: error.message || 'AI classification failed' 
    });
  }
}
