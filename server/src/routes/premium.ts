import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { pool } from '../db/database';
import { verifyPlayPurchase } from '../services/playBillingService';

const router = Router();
router.use(requireAuth);

const FREE_LIMIT = 4;

// GET /api/premium/status
router.get('/status', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const [userRes, countRes] = await Promise.all([
      // is_premium is INTEGER (0/1) in Postgres — node-postgres returns it as a
      // JS number, not a boolean. Coerce below so this matches /api/auth/me,
      // which already does the same via authService.getUserById(). The Android
      // client deserialises this field into a Kotlin Boolean with Gson; a JSON
      // number there throws and is swallowed by an empty catch client-side.
      pool.query<{ is_premium: number | boolean }>('SELECT is_premium FROM users WHERE id = $1', [userId]),
      pool.query<{ count: string }>("SELECT COUNT(*) FROM subscriptions WHERE user_id = $1 AND status = 'active'", [userId]),
    ]);
    const isPremium = Boolean(userRes.rows[0]?.is_premium ?? false);
    const count = parseInt(countRes.rows[0]?.count ?? '0');
    res.json({ isPremium, subscriptionCount: count, freeLimit: FREE_LIMIT });
  } catch (err) {
    // Same safety net as /verify below — an unhandled rejection here would
    // otherwise hang the request until the client's 60s OkHttp timeout.
    console.error('[premium] /status handler error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
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
//      a purchaseToken already bound to a different REAL account is refused.
//      This stops the "share one receipt token across many accounts" case
//      without depending on Google at all. If the different account holding
//      the token is itself anonymous (`google_id` starts with `anon_`), this
//      is not sharing — it's the same person moving from a pre-login guest
//      session to their real account (or reinstalling as a fresh guest), and
//      the token is transferred instead of refused (see below).
//
// Never revokes existing premium for a REAL account — the only revocation
// this endpoint ever performs is clearing the orphaned anon row during a
// transfer, which by definition never had a human looking at that account.
router.post('/verify', async (req: AuthRequest, res: Response) => {
  try {
    const { purchaseToken } = req.body;
    if (!purchaseToken || typeof purchaseToken !== 'string') {
      return res.status(400).json({ error: 'purchaseToken required' });
    }

    // Application-level guard (no Google dependency): look up whether this
    // exact token is already bound to a DIFFERENT user.
    //
    // NOTE (pre-existing, not fixed here): premium_purchase_token is plain
    // TEXT with no unique index, so this is read-then-write, not an atomic
    // check-and-set. Two /verify calls racing with the same brand-new token
    // could both pass this SELECT before either UPDATE lands. Out of scope
    // per instructions (no migrations) — flagging for a future fix.
    const { rows: existing } = await pool.query<{ id: number; google_id: string }>(
      'SELECT id, google_id FROM users WHERE premium_purchase_token = $1 AND id != $2 LIMIT 1',
      [purchaseToken, req.userId]
    );
    const priorHolder = existing[0];
    if (priorHolder && !priorHolder.google_id.startsWith('anon_')) {
      // A real account already owns this token — refuse. Two different
      // people sharing one receipt.
      console.error(`[premium] REJECTED — purchaseToken already bound to real user ${priorHolder.id}, refusing grant for user ${req.userId}`);
      return res.json({ ok: true, verified: false, reason: 'token_already_used' });
    }

    // Shadow-mode Google check — logged in full detail for later analysis,
    // does not gate the grant below (see comment block above).
    const result = await verifyPlayPurchase(purchaseToken);
    console.log(`[premium] Shadow-mode Play verification — user ${req.userId}, token ${purchaseToken}, result ${JSON.stringify(result)}`);

    // is_premium is INTEGER (0/1) in Postgres, not BOOLEAN — write 1, not TRUE.
    // If priorHolder is set here, it's guaranteed anonymous (real accounts
    // returned above) — same person, two identities (guest-before-login or a
    // reinstalled guest). Clear the orphaned anon row and grant the caller in
    // ONE transaction, so a crash between the two writes can never leave the
    // token owned by nobody, or worse, both rows premium at once.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (priorHolder) {
        await client.query(
          'UPDATE users SET is_premium = 0, premium_purchase_token = NULL WHERE id = $1',
          [priorHolder.id]
        );
        console.log(`[premium] TRANSFER — purchaseToken moved from anon user ${priorHolder.id} to user ${req.userId}`);
      }
      await client.query(
        'UPDATE users SET is_premium = 1, premium_purchase_token = $1, premium_purchased_at = NOW() WHERE id = $2',
        [purchaseToken, req.userId]
      );
      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
    res.json({ ok: true, verified: result.status === 'valid' });
  } catch (err) {
    // Safety net: never let this handler reject unhandled. Express 4 + async
    // handlers + no catch = crashed process (see comment block above).
    console.error('[premium] /verify handler error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;
