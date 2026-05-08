import { Router, Response } from 'express';
import multer from 'multer';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

router.use(requireAuth);

router.post('/scan', upload.single('file'), async (req: AuthRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'No file provided' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ success: false, error: 'Gemini not configured' });

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `Analyze this receipt or invoice image/PDF and extract recurring subscription details.
Return ONLY valid JSON (no markdown, no code blocks, no extra text):
{
  "success": true,
  "service_name": "name of the service",
  "company_name": "company name",
  "cost": 9.99,
  "currency": "ILS",
  "billing_cycle": "monthly",
  "renewal_date": "2024-06-15",
  "cancel_url": "https://...",
  "notes": null
}
Rules:
- billing_cycle: one of monthly / yearly / quarterly. Default to monthly if unclear.
- currency: one of ILS / USD / EUR / GBP
- renewal_date: YYYY-MM-DD format. Read ONLY dates that appear as literal text in the image â€” do not calculate, infer, or add time periods to any date. If the image shows "27.4.26" or "April 27, 2026", return "2026-04-27". If no date text is visible in the image, return null.
- cancel_url: use your knowledge of the service to provide the direct URL where users can cancel or manage their subscription (account/billing settings page). Examples: Netflix → "https://www.netflix.com/cancel", Spotify → "https://www.spotify.com/account/subscription", CapCut → "https://www.capcut.com/account/membership", ChatGPT/OpenAI → "https://platform.openai.com/account/billing", ElevenLabs → "https://elevenlabs.io/subscription". For any service you know, provide the URL. Return null only if you truly have no idea.
- company_name: return the well-known BRAND name as consumers know it, NOT the legal company name. The receipt may show legal names â€” translate them to the recognizable brand. Examples: "Netflix Operations LLC" â†’ "Netflix", "Eleven Labs Inc." â†’ "ElevenLabs", "Google Ireland Limited" â†’ "Google", "Apple Distribution International" â†’ "Apple", "Spotify AB" â†’ "Spotify", "Meta Platforms Inc." â†’ "Meta", "Microsoft Corporation" â†’ "Microsoft", "Adobe Inc." â†’ "Adobe". If you cannot identify the brand, return null.
- Set any other unknown fields to null
- If this is NOT a receipt or you cannot find subscription payment details, return ONLY: {"success":false}`;

  try {
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: req.file.mimetype as 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf',
          data: req.file.buffer.toString('base64'),
        },
      },
      prompt,
    ]);

    const raw = result.response.text().trim()
      .replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const parsed = JSON.parse(raw);
    return res.json(parsed);
  } catch (err) {
    console.error('[receipt scan]', err);
    return res.json({ success: false });
  }
});

export default router;
