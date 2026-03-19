import webpush from 'web-push';
import { pool } from '../db/database';

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  ?? '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? '';
const VAPID_EMAIL   = process.env.VAPID_EMAIL       ?? 'mailto:admin@subtracker.app';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
}

export async function savePushSubscription(
  userId: number,
  endpoint: string,
  p256dh: string,
  auth: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (endpoint) DO UPDATE SET p256dh = $3, auth = $4, user_id = $1`,
    [userId, endpoint, p256dh, auth],
  );
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
}

interface PushSub { endpoint: string; p256dh: string; auth: string; }

export async function getPushSubscriptionsForUser(userId: number): Promise<PushSub[]> {
  const res = await pool.query<PushSub>(
    'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1',
    [userId],
  );
  return res.rows;
}

export async function sendPushToUser(
  userId: number,
  title: string,
  body: string,
): Promise<void> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.warn('[Push] VAPID keys not configured — skipping push');
    return;
  }

  const subs = await getPushSubscriptionsForUser(userId);
  const payload = JSON.stringify({ title, body });

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      );
    } catch (err: unknown) {
      // 410 Gone = subscription expired — clean it up
      if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 410) {
        await deletePushSubscription(sub.endpoint);
      } else {
        console.error('[Push] Send error:', err);
      }
    }
  }
}
