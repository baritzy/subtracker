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
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-05-20' });

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
  "notes": null
}
Rules:
- billing_cycle: one of monthly / yearly / quarterly. Default to monthly if unclear.
- currency: one of ILS / USD / EUR / GBP
- renewal_date: YYYY-MM-DD format, use next expected billing date if visible, otherwise null
- Set any unknown fields to null
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
