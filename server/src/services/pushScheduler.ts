import { pool } from '../db/database';
import { getAllActiveSubscriptionsAllUsers } from './subscriptionService';
import { sendPushToUser } from './pushService';

const OFFSETS = [
  { key: '7d',  hours: 168, label: 'בעוד 7 ימים' },
  { key: '24h', hours: 24,  label: 'מחר' },
  { key: '3h',  hours: 3,   label: 'בעוד 3 שעות' },
] as const;

// Window: ±15 minutes around the exact offset
const WINDOW_MS = 15 * 60 * 1000;

async function alreadySent(subscriptionId: number, offsetKey: string): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0];
  const { rowCount } = await pool.query(
    'SELECT 1 FROM push_notifications_sent WHERE subscription_id = $1 AND offset_key = $2 AND notification_date = $3',
    [subscriptionId, offsetKey, today],
  );
  return (rowCount ?? 0) > 0;
}

async function markSent(subscriptionId: number, offsetKey: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  await pool.query(
    'INSERT INTO push_notifications_sent (subscription_id, offset_key, notification_date) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
    [subscriptionId, offsetKey, today],
  );
}

async function checkAndSendPushNotifications(): Promise<void> {
  const subs = await getAllActiveSubscriptionsAllUsers();
  const now = Date.now();

  for (const sub of subs) {
    if (!sub.renewal_date) continue;
    const renewalTs = new Date(sub.renewal_date).getTime();

    for (const offset of OFFSETS) {
      const targetMs = offset.hours * 60 * 60 * 1000;
      const diff = renewalTs - now;

      // Check if we're within ±15 minutes of the target offset
      if (Math.abs(diff - targetMs) > WINDOW_MS) continue;

      // Skip if already sent today
      if (await alreadySent(sub.id, offset.key)) continue;

      // Get user_id from subscription
      const userRes = await pool.query<{ user_id: number }>(
        'SELECT user_id FROM subscriptions WHERE id = $1',
        [sub.id],
      );
      const userId = userRes.rows[0]?.user_id;
      if (!userId) continue;

      await markSent(sub.id, offset.key);
      await sendPushToUser(
        userId,
        'SubTracker',
        `${sub.company_name} מתחדש ${offset.label}`,
      );
      console.log(`[Push] Sent "${offset.key}" notification for "${sub.company_name}" to user ${userId}`);
    }
  }
}

export function startPushScheduler(): void {
  // Run every 10 minutes
  const INTERVAL_MS = 10 * 60 * 1000;
  checkAndSendPushNotifications().catch(err => console.error('[Push] Scheduler error:', err));
  setInterval(() => {
    checkAndSendPushNotifications().catch(err => console.error('[Push] Scheduler error:', err));
  }, INTERVAL_MS);
  console.log('[Push] Scheduler started — running every 10 minutes.');
}
