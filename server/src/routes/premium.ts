import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { pool } from '../db/database';
import { verifyPlayPurchase } from '../services/playBillingService';

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

// POST /api/premium/verify — called after Google Play purchase.
//
// SHADOW MODE (temporary, intentional): this endpoint currently grants
// premium on any well-formed request, same as before. What changed:
//   1. The whole body is wrapped in try/catch so a thrown error (e.g. a
//      Postgres type-mismatch) can never become an unhandled promise
//      rejection — Express 4 does not catch those, and an unhandled
//      rejection crashes the whole Node process (this WAS happening: the
//      old `is_premium = TRUE` write against an INTEGER column threw on
//      every single call, taking the server down for all users).
//   2. `is_premium` is written as the integer 1, matching the actual
//      column type (see migration 002_users.sql), instead of the boolean
//      TRUE that caused the crash above.
//   3. The token is checked against Google Play (see playBillingService.ts)
//      purely to LOG what real vs. fake tokens look like. The result does
//      NOT gate the grant yet — we don't have enough real-world data on
//      promo-code / License-Tester tokens to enforce safely. This is a
//      known, temporary gap: enforcement is the next step once shadow-mode
//      logs show it's safe to flip on.
//   4. The one guard that DOES enforce right now, independent of Google:
//      a purchaseToken already bound to a different user is refused. This
//      stops the "share one receipt token across many accounts" case
//      without depending on Google at all.
//
// Never revokes existing premium — this endpoint only ever writes
// is_premium forward, so it cannot break anyone already premium.
router.post('/verify', async (req: AuthRequest, res: Response) => {
  try {
    const { purchaseToken } = req.body;
    if (!purchaseToken || typeof purchaseToken !== 'string') {
      return res.status(400).json({ error: 'purchaseToken required' });
    }

    // Application-level guard (no Google dependency): refuse if this exact
    // token is already bound to a DIFFERENT user. Closes token sharing/replay.
    const { rows: existing } = await pool.query<{ id: number }>(
      'SELECT id FROM users WHERE premium_purchase_token = $1 AND id != $2 LIMIT 1',
      [purchaseToken, req.userId]
    );
    if (existing.length > 0) {
      console.error(`[premium] REJECTED — purchaseToken already bound to user ${existing[0].id}, refusing grant for user ${req.userId}`);
      return res.json({ ok: true, verified: false, reason: 'token_already_used' });
    }

    // Shadow-mode Google check — logged in full detail for later analysis,
    // does not gate the grant below (see comment block above).
    const result = await verifyPlayPurchase(purchaseToken);
    console.log(`[premium] Shadow-mode Play verification — user ${req.userId}, token ${purchaseToken}, result ${JSON.stringify(result)}`);

    // is_premium is INTEGER (0/1) in Postgres, not BOOLEAN — write 1, not TRUE.
    await pool.query(
      'UPDATE users SET is_premium = 1, premium_purchase_token = $1, premium_purchased_at = NOW() WHERE id = $2',
      [purchaseToken, req.userId]
    );
    res.json({ ok: true, verified: result.status === 'valid' });
  } catch (err) {
    // Safety net: never let this handler reject unhandled. Express 4 + async
    // handlers + no catch = crashed process (see comment block above).
    console.error('[premium] /verify handler error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;
