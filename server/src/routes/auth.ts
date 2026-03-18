import { Router, Request, Response } from 'express';
import { getAuthUrl, handleAuthCallback, getUserById, createAnonymousUser } from '../services/authService';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

const APP_URL = process.env.APP_URL ?? 'https://subtracker-nm4n.onrender.com';

// GET /api/auth/start?mode=popup|redirect  →  server-side redirect to Google
// Used by mobile to avoid Gmail app intercepting direct navigation to accounts.google.com
router.get('/start', (req: Request, res: Response) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).send('Google auth not configured');
  }
  const mode = req.query.mode === 'redirect' ? 'redirect' : 'popup';
  return res.redirect(getAuthUrl(mode));
});

// GET /api/auth/google?mode=popup|redirect  →  redirect URL for frontend
router.get('/google', (req: Request, res: Response) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({ error: 'Google auth not configured' });
  }
  const mode = req.query.mode === 'redirect' ? 'redirect' : 'popup';
  return res.json({ url: getAuthUrl(mode) });
});

// GET /api/auth/callback  →  exchange code for JWT, return to frontend
router.get('/callback', async (req: Request, res: Response) => {
  const { code, state } = req.query;
  const mode = state === 'redirect' ? 'redirect' : 'popup';

  if (!code || typeof code !== 'string') {
    if (mode === 'redirect') return res.redirect(`${APP_URL}/?auth_error=1`);
    return res.status(400).send(callbackPage('שגיאה', 'קוד אימות חסר.', null));
  }
  try {
    const token = await handleAuthCallback(code);
    // Mobile (redirect mode): HTTP redirect directly to the app — no JS needed
    if (mode === 'redirect') {
      return res.redirect(`${APP_URL}/?token=${token}`);
    }
    return res.send(callbackPage('התחברת בהצלחה!', 'אפשר לסגור חלון זה.', token));
  } catch (err) {
    console.error('Auth callback error:', err);
    if (mode === 'redirect') return res.redirect(`${APP_URL}/?auth_error=1`);
    return res.status(500).send(callbackPage('שגיאה', 'ההתחברות נכשלה. נסה שוב.', null));
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

// callbackPage is only used for desktop popup mode
function callbackPage(title: string, body: string, token: string | null): string {
  const success = !!token;
  const color = success ? '#22c55e' : '#ef4444';
  const icon = success ? '✓' : '✗';
  const script = token
    ? `try { window.opener && window.opener.postMessage({ type: 'auth-success', token: '${token}' }, '*'); } catch(e){}
       setTimeout(function(){ try { window.close(); } catch(e){} }, 1000);`
    : `try { window.opener && window.opener.postMessage({ type: 'auth-error' }, '*'); } catch(e){}`;

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body { font-family: 'Segoe UI', sans-serif; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; margin: 0;
           background: #060b14; color: #e2e8f0; flex-direction: column;
           gap: 14px; text-align: center; padding: 20px; box-sizing: border-box; }
    .icon { font-size: 52px; color: ${color}; }
    .title { font-size: 20px; font-weight: 700; color: ${color}; }
    .sub { font-size: 14px; color: #64748b; max-width: 280px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="icon">${icon}</div>
  <div class="title">${title}</div>
  <div class="sub">${body}</div>
  <script>${script}</script>
</body>
</html>`;
}

export default router;
