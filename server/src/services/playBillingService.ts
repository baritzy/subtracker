import { google } from 'googleapis';

// NOTE: intentionally NOT importing `google-auth-library` directly. `firebase-admin`
// hoists a different major version of that package at the top level, which conflicts
// with the version `googleapis` bundles internally. Using `google.auth.JWT` (exposed
// by the `googleapis` package itself) keeps this on the version googleapis expects.
type PlayJwtClient = InstanceType<typeof google.auth.JWT>;

// SHADOW MODE (see routes/premium.ts): this service calls the Google Play
// Developer API purely to OBSERVE and LOG whether a purchase token looks
// real. The route does not gate the premium grant on the result yet — we
// need real data on promo-code / License-Tester tokens before enforcing.
//
// Deliberately does NOT acknowledge the purchase. `BillingManager.kt` on the
// client already acknowledges before it ever calls this endpoint — a second,
// server-side acknowledge would just return an error from Google for an
// already-acknowledged purchase, for no benefit.

const PACKAGE_NAME = 'com.baritzy.subtracker';
const PRODUCT_ID = 'premium_unlock';
const SCOPES = ['https://www.googleapis.com/auth/androidpublisher'];

// Google Play purchaseState values (androidpublisher v3)
const PURCHASE_STATE_PURCHASED = 0;

export type PlayVerifyResult =
  | { status: 'valid' }
  | { status: 'invalid'; reason: string }
  | { status: 'not_configured' }
  | { status: 'error'; message: string };

let authClient: PlayJwtClient | null = null;
let initAttempted = false;

/**
 * Lazily builds the service-account auth client from GOOGLE_PLAY_SERVICE_ACCOUNT
 * (same pattern as FIREBASE_SERVICE_ACCOUNT in pushService.ts — a full service
 * account JSON key, stored as a single-line env var string).
 *
 * Fails CLOSED: if the env var is missing or unparsable, this returns null and
 * every check resolves to 'not_configured' rather than fabricating a 'valid'
 * result. What the caller does with that (currently: grants anyway, in shadow
 * mode — see routes/premium.ts) is the caller's decision, not this module's.
 */
function getAuthClient(): PlayJwtClient | null {
  if (authClient) return authClient;
  if (initAttempted) return null; // already logged the failure once, don't spam
  initAttempted = true;

  const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT;
  if (!raw) {
    console.error(
      '[PlayBilling] GOOGLE_PLAY_SERVICE_ACCOUNT is not set — Google Play purchase verification is UNAVAILABLE. ' +
      'This resolves to "not_configured" for every call. In the current shadow-mode rollout, routes/premium.ts ' +
      'grants premium regardless of this result, so purchases are being accepted UNVERIFIED, not rejected, ' +
      'until this env var is configured AND enforcement is turned on.'
    );
    return null;
  }

  try {
    const credentials = JSON.parse(raw);
    authClient = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: SCOPES,
    });
    console.log('[PlayBilling] Google Play Developer API auth initialized');
    return authClient;
  } catch (err) {
    console.error('[PlayBilling] Failed to parse GOOGLE_PLAY_SERVICE_ACCOUNT — check it is valid JSON:', err);
    return null;
  }
}

/**
 * Checks a purchase token against the Google Play Developer API.
 *
 * This function NEVER throws — every failure mode (missing config, JSON
 * parse error, network/API error, non-purchased state) resolves to a
 * structured non-"valid" result instead. It also never mutates anything —
 * no acknowledge call, read-only. Callers decide what to do with the result;
 * as of the current shadow-mode rollout, the caller (routes/premium.ts)
 * grants premium regardless of what this returns, and only logs it.
 */
export async function verifyPlayPurchase(purchaseToken: string): Promise<PlayVerifyResult> {
  const auth = getAuthClient();
  if (!auth) return { status: 'not_configured' };

  try {
    const androidpublisher = google.androidpublisher({ version: 'v3', auth });
    const res = await androidpublisher.purchases.products.get({
      packageName: PACKAGE_NAME,
      productId: PRODUCT_ID,
      token: purchaseToken,
    });
    const purchase = res.data;

    if (purchase.purchaseState !== PURCHASE_STATE_PURCHASED) {
      return { status: 'invalid', reason: `purchaseState=${purchase.purchaseState}` };
    }
    return { status: 'valid' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[PlayBilling] purchases.products.get failed:', message);
    return { status: 'error', message };
  }
}
