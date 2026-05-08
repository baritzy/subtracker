import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { savePushSubscription, deletePushSubscription, sendPushToUser, getPushSubscriptionsForUser } from '../services/pushService';
import { pool } from '../db/database';

const router = Router();

// GET /api/push/diag — public diagnostic (counts only, no user data)
router.get('/diag', async (_req, res) => {
  try {
    const tableCheck = await pool.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scheduled_notifications') AS exists`,
    );
    const tableExists = tableCheck.rows[0].exists;

    if (!tableExists) {
      return res.json({ table: false, scheduled: 0, push_subs: 0, due_unsent: 0, now: new Date().toISOString() });
    }

    const [sched, due, sent, subs, next] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM scheduled_notifications'),
      pool.query(`SELECT COUNT(*) FROM scheduled_notifications WHERE scheduled_at <= NOW() AND NOT sent`),
      pool.query(`SELECT COUNT(*) FROM scheduled_notifications WHERE sent = TRUE`),
      pool.query('SELECT COUNT(*) FROM push_subscriptions'),
      pool.query(`SELECT scheduled_at, offset_key FROM scheduled_notifications WHERE NOT sent ORDER BY scheduled_at LIMIT 3`),
    ]);

    return res.json({
      table: true,
      scheduled: Number(sched.rows[0].count),
      due_unsent: Number(due.rows[0].count),
      already_sent: Number(sent.rows[0].count),
      push_subs: Number(subs.rows[0].count),
      next_upcoming: next.rows,
      now: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

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

// GET /api/push/status — debug: show scheduled notifications and push subscriptions
router.get('/status', requireAuth, async (req: AuthRequest, res) => {
  const { pool } = await import('../db/database');
  const subs = await getPushSubscriptionsForUser(req.userId!);
  const { rows: scheduled } = await pool.query(
    `SELECT sn.id, s.company_name, sn.offset_key, sn.scheduled_at, sn.sent
     FROM scheduled_notifications sn
     JOIN subscriptions s ON s.id = sn.subscription_id
     WHERE sn.user_id = $1
     ORDER BY sn.scheduled_at`,
    [req.userId!],
  );
  res.json({
    push_subscriptions: subs.length,
    scheduled_notifications: scheduled,
    now: new Date().toISOString(),
  });
});

// GET /api/push/ping — send test push to first FCM user (no auth)
// Supports ?title=X&body=Y query params for custom message
router.get('/ping', async (_req, res) => {
  const { rows } = await pool.query('SELECT DISTINCT user_id FROM fcm_tokens LIMIT 1');
  if (rows.length === 0) return res.json({ error: 'no_fcm_tokens' });
  const title = (_req.query.title as string) || '\u05DE\u05E0\u05D4\u05DC \u05DE\u05E0\u05D5\u05D9\u05D9\u05DD';
  const body = (_req.query.body as string) || '\u05D1\u05D3\u05D9\u05E7\u05D4: \u05D4\u05D4\u05EA\u05E8\u05D0\u05D5\u05EA \u05E2\u05D5\u05D1\u05D3\u05D5\u05EA! \uD83C\uDF89';
  const results = await sendPushToUser(rows[0].user_id, title, body);
  return res.json({ userId: rows[0].user_id, results });
});

// GET /api/push/cleanup-web — remove all web push subscriptions (native app only now)
router.get('/cleanup-web', async (_req, res) => {
  const { rowCount } = await pool.query('DELETE FROM push_subscriptions');
  return res.json({ ok: true, deleted: rowCount });
});

// POST /api/push/test — send a test notification to the logged-in user
router.post('/test', requireAuth, async (req: AuthRequest, res) => {
  const subs = await getPushSubscriptionsForUser(req.userId!);
  const { rows: fcmRows } = await pool.query('SELECT token FROM fcm_tokens WHERE user_id = $1', [req.userId!]);
  if (subs.length === 0 && fcmRows.length === 0) {
    return res.status(404).json({ error: 'no_subscription' });
  }
  const results = await sendPushToUser(req.userId!, '\u05DE\u05E0\u05D4\u05DC \u05DE\u05E0\u05D5\u05D9\u05D9\u05DD', '\u05D4\u05D4\u05EA\u05E8\u05D0\u05D5\u05EA \u05E2\u05D5\u05D1\u05D3\u05D5\u05EA! \uD83C\uDF89');
  res.json({ ok: true, results });
});

// GET /api/push/test-scheduled — insert a test notification due in 5 minutes (uses the real scheduler)
router.get('/test-scheduled', async (_req, res) => {
  try {
    // Find first user with an FCM token
    const { rows: users } = await pool.query('SELECT DISTINCT user_id FROM fcm_tokens LIMIT 1');
    if (users.length === 0) return res.json({ error: 'no_fcm_tokens' });

    const userId = users[0].user_id;
    const minutes = parseInt((_req.query.minutes as string) || '4', 10);
    const fiveMinFromNow = new Date(Date.now() + minutes * 60 * 1000);

    // Find any active subscription for this user (we need a real subscription_id)
    const { rows: subs } = await pool.query(
      "SELECT id, company_name FROM subscriptions WHERE user_id = $1 AND status = 'active' LIMIT 1",
      [userId],
    );
    if (subs.length === 0) return res.json({ error: 'no_active_subscriptions' });

    // Remove old test notifications, then insert a fresh one
    await pool.query(
      `DELETE FROM scheduled_notifications WHERE user_id = $1 AND offset_key LIKE 'test%'`,
      [userId],
    );
    const testKey = `test-${Date.now()}`;
    await pool.query(
      `INSERT INTO scheduled_notifications (subscription_id, user_id, offset_key, scheduled_at)
       VALUES ($1, $2, $3, $4)`,
      [subs[0].id, userId, testKey, fiveMinFromNow],
    );

    return res.json({
      ok: true,
      userId,
      subscription: subs[0].company_name,
      scheduled_at: fiveMinFromNow.toISOString(),
      message: `Test notification scheduled for ${fiveMinFromNow.toISOString()} (~5 minutes)`,
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// POST /api/push/register-device — register FCM token from native Android app
router.post('/register-device', requireAuth, async (req: AuthRequest, res) => {
  const { token, device_type } = req.body as { token?: string; device_type?: string };
  if (!token) {
    return res.status(400).json({ error: 'Missing FCM token' });
  }
  try {
    // Remove old tokens for this user
    await pool.query('DELETE FROM fcm_tokens WHERE user_id = $1', [req.userId!]);
    // Insert new token
    await pool.query(
      `INSERT INTO fcm_tokens (user_id, token, device_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (token) DO UPDATE SET user_id = $1, device_type = $3, updated_at = NOW()`,
      [req.userId!, token, device_type ?? 'android'],
    );
    console.log(`[FCM] Registered token for user ${req.userId!} (${device_type ?? 'android'})`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[FCM] Registration error:', err);
    res.status(500).json({ error: 'Failed to register device' });
  }
});

export default router;
