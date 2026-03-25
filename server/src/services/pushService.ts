import webpush from 'web-push';
import admin from 'firebase-admin';
import { pool } from '../db/database';

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  ?? '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? '';
const VAPID_EMAIL   = process.env.VAPID_EMAIL       ?? 'mailto:admin@subtracker.app';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
}

// Initialize Firebase Admin SDK
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    console.log('[FCM] Firebase Admin SDK initialized');
  } catch (err) {
    console.warn('[FCM] Failed to initialize Firebase Admin:', err);
  }
} else if (process.env.FIREBASE_PROJECT_ID) {
  // Use Application Default Credentials with project ID
  admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
  console.log('[FCM] Firebase Admin SDK initialized with project ID');
} else {
  console.warn('[FCM] No Firebase credentials — native push disabled');
}

export async function savePushSubscription(
  userId: number,
  endpoint: string,
  p256dh: string,
  auth: string,
): Promise<void> {
  // Remove ALL old subscriptions for this user — only keep the latest device
  await pool.query('DELETE FROM push_subscriptions WHERE user_id = $1', [userId]);
  await pool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (endpoint) DO UPDATE SET p256dh = $3, auth = $4, user_id = $1`,
    [userId, endpoint, p256dh, auth],
  );
  console.log(`[Push] Saved fresh subscription for user ${userId}, endpoint ...${endpoint.slice(-30)}`);
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

export interface PushResult {
  endpoint: string;
  status: 'sent' | 'expired' | 'error';
  statusCode?: number;
  error?: string;
}

export async function sendPushToUser(
  userId: number,
  title: string,
  body: string,
): Promise<PushResult[]> {
  const results: PushResult[] = [];

  // 1) Send via Web Push (for PWA/TWA clients)
  if (VAPID_PUBLIC && VAPID_PRIVATE) {
    const subs = await getPushSubscriptionsForUser(userId);
    const payload = JSON.stringify({ title, body });

    for (const sub of subs) {
      try {
        const res = await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        console.log(`[Push] Web Push sent to user ${userId} — status ${res.statusCode}`);
        results.push({ endpoint: sub.endpoint.slice(-30), status: 'sent', statusCode: res.statusCode });
      } catch (err: unknown) {
        const statusCode = err && typeof err === 'object' && 'statusCode' in err ? (err as { statusCode: number }).statusCode : 0;
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[Push] Web Push error for user ${userId} — status ${statusCode}: ${errMsg}`);

        if (statusCode === 410 || statusCode === 404) {
          await deletePushSubscription(sub.endpoint);
          results.push({ endpoint: sub.endpoint.slice(-30), status: 'expired', statusCode });
        } else {
          results.push({ endpoint: sub.endpoint.slice(-30), status: 'error', statusCode, error: errMsg });
        }
      }
    }
  }

  // 2) Send via FCM (for native Android clients)
  await sendFcmToUser(userId, title, body, results);

  if (results.length === 0) {
    console.warn(`[Push] No push subscriptions or FCM tokens for user ${userId}`);
  }

  return results;
}

async function sendFcmToUser(
  userId: number,
  title: string,
  body: string,
  results: PushResult[],
): Promise<void> {
  if (!admin.apps.length) return; // Firebase not initialized

  const { rows } = await pool.query<{ token: string }>(
    'SELECT token FROM fcm_tokens WHERE user_id = $1',
    [userId],
  );

  for (const row of rows) {
    try {
      await admin.messaging().send({
        token: row.token,
        notification: { title, body },
        data: { title, body },
        android: {
          priority: 'high',
          notification: {
            channelId: 'renewal_reminders',
            color: '#6366F1',
            sound: 'default',
          },
        },
      });
      console.log(`[FCM] Sent to user ${userId}, token ...${row.token.slice(-20)}`);
      results.push({ endpoint: `fcm:${row.token.slice(-20)}`, status: 'sent' });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[FCM] Error for user ${userId}: ${errMsg}`);

      // Remove invalid tokens
      if (errMsg.includes('not-registered') || errMsg.includes('invalid-registration-token')) {
        await pool.query('DELETE FROM fcm_tokens WHERE token = $1', [row.token]);
        results.push({ endpoint: `fcm:${row.token.slice(-20)}`, status: 'expired' });
      } else {
        results.push({ endpoint: `fcm:${row.token.slice(-20)}`, status: 'error', error: errMsg });
      }
    }
  }
}
