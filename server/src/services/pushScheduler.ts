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

// On startup: schedule notifications for active subscriptions that have none yet
async function backfillScheduledNotifications(): Promise<void> {
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

  if (rows.length > 0) {
    console.log(`[Push] Backfilled notifications for ${rows.length} subscriptions.`);
  }
}

async function sendDueNotifications(): Promise<void> {
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
  // Check every 15 minutes — allows Neon compute to auto-suspend between checks
  const INTERVAL_MS = 15 * 60 * 1000;

  backfillScheduledNotifications()
    .then(() => sendDueNotifications())
    .catch(err => console.error('[Push] Startup error:', err));

  setInterval(() => {
    sendDueNotifications().catch(err => console.error('[Push] Scheduler error:', err));
  }, INTERVAL_MS);

  console.log('[Push] Scheduler started — running every 15 minutes.');
}
