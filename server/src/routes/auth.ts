import { Router, Request, Response } from 'express';
import { getAuthUrl, handleAuthCallback, getUserById, createAnonymousUser } from '../services/authService';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

const APP_URL = process.env.APP_URL ?? 'https://subtracker-nm4n.onrender.com';

// GET /api/auth/start  →  server-side redirect to Google (mobile)
router.get('/start', (_req: Request, res: Response) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).send('Google auth not configured');
  }
  return res.redirect(getAuthUrl());
});

// GET /api/auth/google  →  return Google OAuth URL (desktop popup)
router.get('/google', (_req: Request, res: Response) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({ error: 'Google auth not configured' });
  }
  return res.json({ url: getAuthUrl() });
});

// GET /api/auth/callback  →  exchange code, deliver token to the app
// We use an invisible HTML page (not HTTP 302) because Android Chrome sometimes
// doesn't follow server-side redirects from OAuth callbacks reliably.
router.get('/callback', async (req: Request, res: Response) => {
  const { code } = req.query;
  if (!code || typeof code !== 'string') {
    return res.redirect(`${APP_URL}/?auth_error=1`);
  }
  try {
    const token = await handleAuthCallback(code);
    // Instant invisible redirect — no visible screen, just JS + meta refresh
    return res.send(invisibleRedirect(token));
  } catch (err) {
    console.error('Auth callback error:', err);
    return res.redirect(`${APP_URL}/?auth_error=1`);
  }
});

// POST /api/auth/anonymous  →  create guest user, return JWT
router.post('/anonymous', async (_req: Request, res: Response) => {
  try {
    const token = await createAnonymousUser();
    return res.json({ token });
  } catch (err) {
    console.error('Anonymous auth error:', err);
    return res.status(500).json({ error: 'Failed to create guest session' });
  }
});

// GET /api/auth/me  →  return current user info
router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  const user = await getUserById(req.userId!);
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json(user);
});

// Invisible instant redirect — no loading screen, no visible content.
// Uses both JS and meta-refresh so it works in any browser/WebView.
function invisibleRedirect(token: string): string {
  const dest = `${APP_URL}/?token=${encodeURIComponent(token)}`;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="refresh" content="0;url=${dest}"><style>html,body{margin:0;background:#060b14}</style></head><body><script>window.location.replace(${JSON.stringify(dest)})</script></body></html>`;
}

export default router;
