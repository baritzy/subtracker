import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { savePushSubscription, deletePushSubscription, sendPushToUser } from '../services/pushService';

const router = Router();

// GET /api/push/vapid-public — return VAPID public key to client
router.get('/vapid-public', (_req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY ?? '';
  if (!key) return res.status(503).json({ error: 'Push not configured' });
  res.json({ key });
});

// POST /api/push/subscribe — save a push subscription for the logged-in user
router.post('/subscribe', requireAuth, async (req: AuthRequest, res) => {
  const { endpoint, p256dh, auth } = req.body as { endpoint?: string; p256dh?: string; auth?: string };
  if (!endpoint || !p256dh || !auth) {
    return res.status(400).json({ error: 'Missing push subscription fields' });
  }
  await savePushSubscription(req.userId!, endpoint, p256dh, auth);
  res.json({ ok: true });
});

// DELETE /api/push/subscribe — remove a push subscription
router.delete('/subscribe', requireAuth, async (req: AuthRequest, res) => {
  const { endpoint } = req.body as { endpoint?: string };
  if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });
  await deletePushSubscription(endpoint);
  res.json({ ok: true });
});

// POST /api/push/test — send a test notification to the logged-in user
router.post('/test', requireAuth, async (req: AuthRequest, res) => {
  await sendPushToUser(req.userId!, 'SubTracker', 'ההתראות עובדות! 🎉');
  res.json({ ok: true });
});

export default router;
