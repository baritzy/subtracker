import { Router, Request, Response } from 'express';
import {
  getAuthUrl,
  exchangeCodeForTokens,
  getSyncState,
  isGmailConnected,
  disconnectGmail,
  syncNewEmails,
} from '../services/gmailService';
import { handleAuthCallback } from '../services/authService';

const router = Router();
const APP_URL = process.env.APP_URL ?? 'https://subtracker-nm4n.onrender.com';

// GET /api/gmail/auth  →  returns OAuth URL for frontend to redirect to
router.get('/auth', (_req: Request, res: Response) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({ error: 'Gmail integration not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env' });
  }
  return res.json({ url: getAuthUrl() });
});

// GET /api/gmail/callback  →  handles both user-auth and Gmail-integration OAuth callbacks
router.get('/callback', async (req: Request, res: Response) => {
  const { code, state } = req.query;

  // User login flow — state='user-auth' is set by authService.getAuthUrl()
  if (state === 'user-auth') {
    if (!code || typeof code !== 'string') {
      return res.redirect(`${APP_URL}/?auth_error=1`);
    }
    try {
      const token = await handleAuthCallback(code as string);
      const dest = `${APP_URL}/?token=${encodeURIComponent(token)}`;
      // Invisible instant redirect — no visible screen
      return res.send(
        `<!DOCTYPE html><html><head><meta charset="UTF-8">` +
        `<meta http-equiv="refresh" content="0;url=${dest}">` +
        `<style>html,body{margin:0;background:#060b14}</style></head>` +
        `<body><script>window.location.replace(${JSON.stringify(dest)})</script></body></html>`
      );
    } catch (err) {
      console.error('Auth callback error:', err);
      return res.redirect(`${APP_URL}/?auth_error=1`);
    }
  }

  // Gmail integration flow (existing behavior)
  if (!code || typeof code !== 'string') {
    return res.status(400).send(callbackPage('שגיאה', 'קוד אימות חסר.', false));
  }
  try {
    await exchangeCodeForTokens(code);
    return res.send(callbackPage('Gmail מחובר!', 'החיבור הצליח. אפשר לסגור חלון זה ולחזור לאפליקציה.', true));
  } catch (err) {
    console.error('Gmail OAuth error:', err);
    return res.send(callbackPage('שגיאה', 'החיבור נכשל. נסה שוב.', false));
  }
});

function callbackPage(title: string, body: string, success: boolean): string {
  const color = success ? '#22c55e' : '#ef4444';
  const icon = success ? '✓' : '✗';
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
  <script>
    try { window.opener && window.opener.postMessage('gmail-auth-success', '*'); } catch(e){}
    if (window.opener) { setTimeout(function(){ try { window.close(); } catch(e){} }, 1500); }
  </script>
</body>
</html>`;
}

// GET /api/gmail/status  →  connection state + last sync time
router.get('/status', async (_req: Request, res: Response) => {
  const connected = await isGmailConnected();
  const state = await getSyncState();
  return res.json({
    connected,
    email: state?.email ?? null,
    last_synced_at: state?.last_synced_at ?? null,
  });
});

// POST /api/gmail/disconnect  →  clear stored tokens
router.post('/disconnect', async (_req: Request, res: Response) => {
  await disconnectGmail();
  return res.status(204).send();
});

// POST /api/gmail/sync  →  trigger manual sync
router.post('/sync', async (_req: Request, res: Response) => {
  if (!(await isGmailConnected())) {
    return res.status(401).json({ error: 'Gmail not connected' });
  }
  try {
    const count = await syncNewEmails();
    return res.json({ new_subscriptions_found: count });
  } catch (err) {
    console.error('Gmail sync error:', err);
    return res.status(500).json({ error: 'Sync failed' });
  }
});

export default router;
