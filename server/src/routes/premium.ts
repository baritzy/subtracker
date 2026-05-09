import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { pool } from '../db/database';

const router = Router();
router.use(requireAuth);

const FREE_LIMIT = 4;

// GET /api/premium/status
router.get('/status', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const [userRes, countRes] = await Promise.all([
    pool.query<{ is_premium: boolean }>('SELECT is_premium FROM users WHERE id = $1', [userId]),
    pool.query<{ count: string }>("SELECT COUNT(*) FROM subscriptions WHERE user_id = $1 AND status = 'active'", [userId]),
  ]);
  const isPremium = userRes.rows[0]?.is_premium ?? false;
  const count = parseInt(countRes.rows[0]?.count ?? '0');
  res.json({ isPremium, subscriptionCount: count, freeLimit: FREE_LIMIT });
});

// POST /api/premium/verify — called after Google Play purchase
router.post('/verify', async (req: AuthRequest, res: Response) => {
  const { purchaseToken } = req.body;
  if (!purchaseToken) return res.status(400).json({ error: 'purchaseToken required' });

  // TODO: verify with Google Play Developer API
  // For now: trust the client (will add server-side verification later)
  await pool.query(
    'UPDATE users SET is_premium = TRUE, premium_purchase_token = $1, premium_purchased_at = NOW() WHERE id = $2',
    [purchaseToken, req.userId]
  );
  res.json({ ok: true, isPremium: true });
});

export default router;
