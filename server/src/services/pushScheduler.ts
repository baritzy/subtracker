import { pool } from '../db/database';
import { sendPushToUser } from './pushService';

const OFFSETS = [
  { key: '7d',  hours: 7 * 24, label: 'בעוד 7 ימים' },
  { key: '24h', hours: 24,     label: 'מחר' },
  { key: '3h',  hours: 3,      label: 'בעוד 3 שעות' },
] as const;

// Parse "YYYY-MM-DD" as midnight Israel time (UTC+2)
function parseRenewalDate(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d) - 2 * 60 * 60 * 1000;
}

// Schedule notifications for a subscription — call on create or update
export async function scheduleNotifications(
  subscriptionId: number,
  userId: number,
  renewalDate: string,
): Promise<void> {
  const renewalMs = parseRenewalDate(renewalDate);
  const now = Date.now();

  // Remove existing unsent notifications for this subscription
  await pool.query(
    'DELETE FROM scheduled_notifications WHERE subscription_id = $1 AND NOT sent',
    [subscriptionId],
  );

  // Insert future notification times
  for (const offset of OFFSETS) {
    const scheduledAt = renewalMs - offset.hours * 60 * 60 * 1000;
    if (scheduledAt > now) {
      await pool.query(
        `INSERT INTO scheduled_notifications (subscription_id, user_id, offset_key, scheduled_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (subscription_id, offset_key)
         DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at, sent = FALSE`,
        [subscriptionId, userId, offset.key, new Date(scheduledAt)],
      );
    }
  }
}

// Remove all unsent notifications for a subscription — call on delete or cancel
export async function cancelNotifications(subscriptionId: number): Promise<void> {
  await pool.query(
    'DELETE FROM scheduled_notifications WHERE subscription_id = $1 AND NOT sent',
    [subscriptionId],
  );
}

// Throttle backfill: only run once per 24h. Without this guard the scan ran on
// every cold start (Render free tier spins up frequently) and was burning
// ~30% of Neon's free compute budget re-checking subs that already had rows.
const BACKFILL_KEY = 'last_backfill_at';
const BACKFILL_MIN_INTERVAL_MS = 24 * 60 * 60 * 1000;

async function shouldRunBackfill(): Promise<boolean> {
  const { rows } = await pool.query<{ value: string }>(
    'SELECT value FROM app_state WHERE key = $1',
    [BACKFILL_KEY],
  );
  if (rows.length === 0) return true;
  const lastMs = Number(rows[0].value);
  if (!Number.isFinite(lastMs)) return true;
  return Date.now() - lastMs >= BACKFILL_MIN_INTERVAL_MS;
}

async function markBackfillRan(): Promise<void> {
  await pool.query(
    `INSERT INTO app_state (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [BACKFILL_KEY, String(Date.now())],
  );
}

// On startup: schedule notifications for active subscriptions that have none yet.
// Guarded by app_state so we only do this scan once every 24h, not on every
// cold start (was eating ~30% of Neon CU before the guard was added).
async function backfillScheduledNotifications(): Promise<void> {
  if (!(await shouldRunBackfill())) {
    console.log('[Push] Skipping backfill — last run <24h ago.');
    return;
  }

  const { rows } = await pool.query<{ id: number; user_id: number; renewal_date: string }>(`
    SELECT s.id, s.user_id, s.renewal_date
    FROM subscriptions s
    WHERE s.status = 'active'
      AND s.renewal_date IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM scheduled_notifications sn
        WHERE sn.subscription_id = s.id AND NOT sn.sent
      )
  `);

  for (const row of rows) {
    await scheduleNotifications(row.id, row.user_id, row.renewal_date);
  }

  await markBackfillRan();

  if (rows.length > 0) {
    console.log(`[Push] Backfilled notifications for ${rows.length} subscriptions.`);
  } else {
    console.log('[Push] Backfill ran — no subscriptions needed scheduling.');
  }
}

async function sendDueNotifications(): Promise<void> {
  // IMPORTANT: must use `<=`, not `=`. With a 30-min poll interval, an exact
  // match would silently drop every notification whose `scheduled_at` falls
  // between ticks. `<=` catches anything that became due since we last ran.
  const { rows } = await pool.query<{
    id: number;
    user_id: number;
    offset_key: string;
    company_name: string;
  }>(`
    SELECT sn.id, sn.user_id, sn.offset_key, s.company_name
    FROM scheduled_notifications sn
    JOIN subscriptions s ON s.id = sn.subscription_id
    WHERE sn.scheduled_at <= NOW()
      AND NOT sn.sent
      AND s.status = 'active'
  `);

  for (const row of rows) {
    const label = OFFSETS.find(o => o.key === row.offset_key)?.label ?? '';
    try {
      await sendPushToUser(row.user_id, 'SubTracker', `${row.company_name} מתחדש ${label}`);
      console.log(`[Push] Sent "${row.offset_key}" for "${row.company_name}" → user ${row.user_id}`);
    } catch (err) {
      console.error(`[Push] Failed to send notification id=${row.id}:`, err);
    }
    await pool.query('UPDATE scheduled_notifications SET sent = TRUE WHERE id = $1', [row.id]);
  }
}

export function startPushScheduler(): void {
  // Poll every 30 minutes. Tradeoff: a renewal reminder targeted at e.g. 09:00
  // can fire as late as 09:30 in the worst case (just missed a tick).
  // For 7d / 24h / 3h reminders this is fine — users don't notice 30 min delay
  // on a "renews tomorrow" toast. We pay this in exchange for letting the DB
  // (Supabase / Neon) auto-suspend between checks, which keeps us on free tier.
  // If we ever need minute-level precision (e.g. a "renews in 5 minutes" alert),
  // this constant must shrink and we must accept the higher compute cost.
  const INTERVAL_MS = 30 * 60 * 1000;

  backfillScheduledNotifications()
    .then(() => sendDueNotifications())
    .catch(err => console.error('[Push] Startup error:', err));

  setInterval(() => {
    sendDueNotifications().catch(err => console.error('[Push] Scheduler error:', err));
  }, INTERVAL_MS);

  console.log('[Push] Scheduler started — running every 30 minutes.');
}