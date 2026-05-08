import { pool } from '../db/database';
import admin from 'firebase-admin';

// ─── Types ───────────────────────────────────────────────────────────
interface CompanyResult {
  logo: string | null;
  domain: string | null;
  cancelUrl: string | null;
  plansUrl: string | null;
  source: string; // 'cache' | 'hardcoded' | 'google' | 'clearbit' | 'guess'
}

// ─── Hardcoded overrides for companies with broken favicons ──────────
const LOGO_OVERRIDES: Record<string, string> = {
  'freetv.co.il': 'https://subtracker-nm4n.onrender.com/logos/freetv.png',
  'web.freetv.tv': 'https://subtracker-nm4n.onrender.com/logos/freetv.png',
};

// ─── Quota tracking ──────────────────────────────────────────────────
async function getQuotaToday(): Promise<{ count: number; alertSent: boolean }> {
  const today = new Date().toISOString().slice(0, 10);
  const res = await pool.query(
    `INSERT INTO api_quota (date, google_searches, alert_sent)
     VALUES ($1, 0, false)
     ON CONFLICT (date) DO NOTHING
     RETURNING google_searches, alert_sent`,
    [today]
  );
  if (res.rows.length > 0) return { count: res.rows[0].google_searches, alertSent: res.rows[0].alert_sent };
  const existing = await pool.query('SELECT google_searches, alert_sent FROM api_quota WHERE date = $1', [today]);
  return existing.rows.length > 0
    ? { count: existing.rows[0].google_searches, alertSent: existing.rows[0].alert_sent }
    : { count: 0, alertSent: false };
}

async function incrementQuota(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const res = await pool.query(
    `INSERT INTO api_quota (date, google_searches)
     VALUES ($1, 1)
     ON CONFLICT (date) DO UPDATE SET google_searches = api_quota.google_searches + 1
     RETURNING google_searches`,
    [today]
  );
  return res.rows[0].google_searches;
}

async function markAlertSent(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await pool.query('UPDATE api_quota SET alert_sent = true WHERE date = $1', [today]);
}

// ─── Cache operations ────────────────────────────────────────────────
function normalizeKey(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

async function getFromCache(query: string): Promise<CompanyResult | null> {
  const key = normalizeKey(query);
  // Exact match
  let res = await pool.query(
    'SELECT * FROM company_cache WHERE name_key = $1', [key]
  );
  if (res.rows.length === 0) {
    // Try no-spaces match
    const keyNoSpaces = key.replace(/\s+/g, '');
    res = await pool.query(
      `SELECT * FROM company_cache WHERE REPLACE(name_key, ' ', '') = $1`, [keyNoSpaces]
    );
  }
  if (res.rows.length === 0) return null;

  const row = res.rows[0];
  // Bump search count
  await pool.query('UPDATE company_cache SET search_count = search_count + 1, updated_at = NOW() WHERE id = $1', [row.id]);

  return {
    logo: row.logo_url,
    domain: row.domain,
    cancelUrl: row.cancel_url,
    plansUrl: row.plans_url,
    source: 'cache',
  };
}

async function saveToCache(
  query: string,
  companyName: string,
  domain: string | null,
  logoUrl: string | null,
  logoSource: string,
  cancelUrl: string | null,
  plansUrl: string | null,
  verified: boolean
): Promise<void> {
  const key = normalizeKey(query);
  await pool.query(
    `INSERT INTO company_cache (name_key, company_name, domain, logo_url, logo_source, cancel_url, plans_url, verified)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (name_key) DO UPDATE SET
       logo_url = COALESCE(EXCLUDED.logo_url, company_cache.logo_url),
       logo_source = CASE WHEN EXCLUDED.logo_url IS NOT NULL THEN EXCLUDED.logo_source ELSE company_cache.logo_source END,
       cancel_url = COALESCE(EXCLUDED.cancel_url, company_cache.cancel_url),
       plans_url = COALESCE(EXCLUDED.plans_url, company_cache.plans_url),
       domain = COALESCE(EXCLUDED.domain, company_cache.domain),
       verified = EXCLUDED.verified OR company_cache.verified,
       updated_at = NOW()`,
    [key, companyName, domain, logoUrl, logoSource, cancelUrl, plansUrl, verified]
  );
}

// ─── Website verification ────────────────────────────────────────────
async function verifyWebsite(url: string, companyName: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'SubTracker/1.0' },
    });
    if (!res.ok) return false;

    const html = await res.text();
    const lower = html.toLowerCase();

    // Check title or meta for company name
    const nameWords = companyName.toLowerCase().split(/\s+/).filter(w => w.length >= 3);
    const titleMatch = lower.match(/<title[^>]*>([^<]*)<\/title>/);
    const title = titleMatch ? titleMatch[1] : '';

    // At least one significant word from company name in title or page content (first 5000 chars)
    const snippet = lower.slice(0, 5000);
    return nameWords.some(w => title.includes(w) || snippet.includes(w));
  } catch {
    return false;
  }
}

// ─── Logo extraction from website ────────────────────────────────────
async function extractLogoFromSite(domain: string): Promise<string | null> {
  // Check hardcoded overrides first
  if (LOGO_OVERRIDES[domain]) return LOGO_OVERRIDES[domain];

  // Try apple-touch-icon (best quality, 180px+)
  for (const path of ['/apple-touch-icon.png', '/apple-touch-icon-precomposed.png']) {
    try {
      const url = `https://${domain}${path}`;
      const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(3000) });
      if (res.ok && res.headers.get('content-type')?.includes('image')) return url;
    } catch {}
  }

  // Try OG image from HTML
  try {
    const res = await fetch(`https://${domain}`, {
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'SubTracker/1.0' },
    });
    if (res.ok) {
      const html = await res.text();
      // og:image
      const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
        ?? html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
      if (ogMatch?.[1]) {
        const ogUrl = ogMatch[1].startsWith('http') ? ogMatch[1] : `https://${domain}${ogMatch[1]}`;
        // Verify it's actually an image
        try {
          const imgRes = await fetch(ogUrl, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
          if (imgRes.ok && imgRes.headers.get('content-type')?.includes('image')) return ogUrl;
        } catch {}
      }
    }
  } catch {}

  // Try Google favicons (128px, very reliable)
  try {
    const gUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    const res = await fetch(gUrl, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(3000) });
    if (res.ok && res.headers.get('content-type')?.includes('image')) {
      const size = parseInt(res.headers.get('content-length') ?? '0');
      if (size > 500) return gUrl; // Filter out Google's default globe icon
    }
  } catch {}

  return null;
}

// ─── Google Custom Search ────────────────────────────────────────────
interface GoogleSearchResult {
  title: string;
  link: string;
  displayLink: string;
}

async function googleSearch(query: string): Promise<GoogleSearchResult[]> {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_CX;
  if (!apiKey || !cx) return [];

  const count = await incrementQuota();

  // Check if we need to send alert
  if (count >= 80) {
    const { alertSent } = await getQuotaToday();
    if (!alertSent) {
      await sendQuotaAlert(count);
      await markAlertSent();
    }
  }

  // Hard stop at 100 to avoid charges
  if (count > 100) return [];

  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query + ' official site')}&num=3`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = await res.json() as { items?: GoogleSearchResult[] };
    return data.items ?? [];
  } catch {
    return [];
  }
}

// ─── Clearbit fallback ───────────────────────────────────────────────
async function clearbitSearch(query: string): Promise<{ domain: string; logo: string } | null> {
  try {
    const url = `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(query)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    const results = await res.json() as { name: string; domain: string; logo: string }[];
    if (results.length === 0) return null;

    // Smart match: prefer result where query words appear in name or domain
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const match = results.find(r => {
      const d = r.domain.toLowerCase();
      const n = r.name.toLowerCase();
      return queryWords.some(w => d.includes(w) || n.includes(w));
    }) ?? results[0];

    return { domain: match.domain, logo: match.logo };
  } catch {
    return null;
  }
}

// ─── Alert system (push notification via FCM) ───────────────────────
async function sendQuotaAlert(count: number): Promise<void> {
  console.warn(`[QUOTA ALERT] ${count}/100 Google searches used today.`);

  // Send push notification to all registered devices (admin = Eytan)
  try {
    const tokens = await pool.query('SELECT token FROM fcm_tokens');
    if (tokens.rows.length === 0) return;

    const title = '⚠️ SubTracker Quota Alert';
    const body = `${count}/100 Google searches today. Fallback active at 100.`;

    for (const row of tokens.rows) {
      try {
        await admin.messaging().send({
          token: row.token,
          notification: { title, body },
          android: { priority: 'high' },
        });
      } catch {}
    }
    console.log(`[QUOTA] Push alert sent to ${tokens.rows.length} devices`);
  } catch (e) {
    console.error('Failed to send quota push alert:', e);
  }
}

// ─── Main search function ────────────────────────────────────────────
export async function smartCompanySearch(query: string): Promise<CompanyResult> {
  // Step 1: Check cache
  const cached = await getFromCache(query);
  if (cached && cached.logo) return cached;

  // Step 2: Google Custom Search (if API key configured)
  const googleResults = await googleSearch(query);
  for (const result of googleResults) {
    const domain = result.displayLink.replace(/^www\./, '');
    const verified = await verifyWebsite(result.link, query);
    if (verified) {
      const logo = await extractLogoFromSite(domain);
      if (logo) {
        await saveToCache(query, query, domain, logo, 'google', null, null, true);
        return { logo, domain, cancelUrl: null, plansUrl: null, source: 'google' };
      }
    }
  }

  // Step 3: Clearbit fallback
  const clearbit = await clearbitSearch(query);
  if (clearbit) {
    const verified = await verifyWebsite(`https://${clearbit.domain}`, query);
    if (verified) {
      const logo = await extractLogoFromSite(clearbit.domain);
      if (logo) {
        await saveToCache(query, query, clearbit.domain, logo, 'clearbit', null, null, true);
        return { logo, domain: clearbit.domain, cancelUrl: null, plansUrl: null, source: 'clearbit' };
      }
    }
  }

  // Step 4: Domain guessing (.com, .co.il, .io)
  const guess = query.toLowerCase().replace(/\s+/g, '');
  for (const tld of ['.com', '.co.il', '.io', '.app']) {
    const domain = `${guess}${tld}`;
    try {
      const verified = await verifyWebsite(`https://${domain}`, query);
      if (verified) {
        const logo = await extractLogoFromSite(domain);
        if (logo) {
          await saveToCache(query, query, domain, logo, 'guess', null, null, true);
          return { logo, domain, cancelUrl: null, plansUrl: null, source: 'guess' };
        }
      }
    } catch {}
  }

  // Nothing found — save empty to avoid re-searching
  await saveToCache(query, query, null, null, 'none', null, null, false);
  return { logo: null, domain: null, cancelUrl: null, plansUrl: null, source: 'none' };
}

// ─── User logo upload ────────────────────────────────────────────────
export async function saveUserLogo(companyName: string, logoUrl: string): Promise<void> {
  await saveToCache(companyName, companyName, null, logoUrl, 'user_upload', null, null, true);
}

// ─── Get quota status (for admin/debug) ──────────────────────────────
export async function getQuotaStatus(): Promise<{ date: string; used: number; limit: number; alertSent: boolean }> {
  const { count, alertSent } = await getQuotaToday();
  return { date: new Date().toISOString().slice(0, 10), used: count, limit: 100, alertSent };
}
