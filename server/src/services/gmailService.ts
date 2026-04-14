import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { pool } from '../db/database';
import { createSubscription, isGmailMessageAlreadyImported } from './subscriptionService';

interface GmailSyncState {
  id: number;
  last_synced_at: string | null;
  history_id: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expiry: string | null;
  email: string | null;
}

interface ParsedSubscription {
  company_name: string;
  service_name: string;
  cost: number;
  billing_cycle: 'monthly' | 'yearly';
  cost_per_cycle: number;
  renewal_date: string;
  cancel_url?: string;
}

// Known senders map
const KNOWN_SENDERS: Record<string, { company: string; cancelUrl: string }> = {
  'netflix.com':    { company: 'Netflix',    cancelUrl: 'https://www.netflix.com/cancelplan' },
  'spotify.com':    { company: 'Spotify',    cancelUrl: 'https://www.spotify.com/account/subscription/cancel' },
  'adobe.com':      { company: 'Adobe',      cancelUrl: 'https://account.adobe.com/plans' },
  'apple.com':      { company: 'Apple',      cancelUrl: 'https://appleid.apple.com/account/manage' },
  'amazon.com':     { company: 'Amazon',     cancelUrl: 'https://www.amazon.com/mc/pipelines/payments' },
  'hulu.com':       { company: 'Hulu',       cancelUrl: 'https://secure.hulu.com/account' },
  'github.com':     { company: 'GitHub',     cancelUrl: 'https://github.com/settings/billing' },
  'openai.com':     { company: 'OpenAI',     cancelUrl: 'https://platform.openai.com/account/billing' },
  'canva.com':      { company: 'Canva',      cancelUrl: 'https://www.canva.com/settings/billing' },
  'dropbox.com':    { company: 'Dropbox',    cancelUrl: 'https://www.dropbox.com/account/plan' },
  'notion.so':      { company: 'Notion',     cancelUrl: 'https://www.notion.so/my-account' },
  'figma.com':      { company: 'Figma',      cancelUrl: 'https://www.figma.com/settings' },
  'zoom.us':        { company: 'Zoom',       cancelUrl: 'https://zoom.us/billing' },
  'slack.com':      { company: 'Slack',      cancelUrl: 'https://slack.com/billing' },
  'microsoft.com':  { company: 'Microsoft',  cancelUrl: 'https://account.microsoft.com/services' },
  'google.com':     { company: 'Google',     cancelUrl: 'https://myaccount.google.com/subscriptions' },
  'youtube.com':    { company: 'YouTube',    cancelUrl: 'https://www.youtube.com/paid_memberships' },
  'disney.com':     { company: 'Disney+',    cancelUrl: 'https://www.disneyplus.com/account/subscription' },
  'hbomax.com':     { company: 'Max',        cancelUrl: 'https://www.max.com/account' },
  'paramount.com':  { company: 'Paramount+', cancelUrl: 'https://www.paramountplus.com/account/membership' },
};

const SUBSCRIPTION_SUBJECT_PATTERNS = [
  /your (.*?) subscription/i,
  /receipt for your (.*?) (subscription|membership|plan)/i,
  /welcome to (.*?)(\.| -|,|\s*$)/i,
  /payment (received|confirmed).*(subscription|membership)/i,
  /you('ve| have) been charged/i,
  /invoice from (.*)/i,
  /your (.*?) (plan|membership) is now active/i,
  /thanks for (subscribing|joining) (.*)/i,
  /subscription (confirmation|receipt)/i,
  /billing (confirmation|receipt)/i,
];

const COST_PATTERNS = [
  /\$(\d+\.?\d*)\s*\/\s*(month|mo)\b/i,
  /\$(\d+\.?\d*)\s*\/\s*(year|yr|annual)\b/i,
  /\$(\d+\.?\d*)\s*per\s*(month|year)\b/i,
  /charged\s+\$(\d+\.?\d*)/i,
  /total[:\s]+\$(\d+\.?\d*)/i,
  /amount[:\s]+\$(\d+\.?\d*)/i,
  /\$(\d+\.?\d*)\s*(?:USD|usd)/,
];

const DATE_PATTERNS = [
  /next billing date[:\s]+([\w\s,]+\d{4})/i,
  /renews? on[:\s]+([\w\s,]+\d{4})/i,
  /next charge[:\s]+([\w\s,]+\d{4})/i,
  /subscription renews[:\s]+([\w\s,]+\d{4})/i,
  /next payment[:\s]+([\w\s,]+\d{4})/i,
  /billed on[:\s]+([\w\s,]+\d{4})/i,
];

const CANCEL_LINK_PATTERN = /<a[^>]+href="([^"]+)"[^>]*>\s*(cancel|unsubscribe|manage subscription|manage plan)[^<]*/gi;

export async function getOAuth2Client(): Promise<OAuth2Client> {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3001/api/gmail/callback'
  );
  const state = await getSyncState();
  if (state?.access_token) {
    client.setCredentials({
      access_token: state.access_token,
      refresh_token: state.refresh_token ?? undefined,
      expiry_date: state.token_expiry ? Number(state.token_expiry) : undefined,
    });
    // Auto-save refreshed tokens (fire-and-forget is fine here)
    client.on('tokens', (tokens) => {
      pool.query(
        'UPDATE gmail_sync_state SET access_token = $1, token_expiry = $2 WHERE id = 1',
        [tokens.access_token, tokens.expiry_date?.toString() ?? null]
      ).catch((err: unknown) => console.error('[Gmail] Token refresh save error:', err));
    });
  }
  return client as any;
}

export function getAuthUrl(): string {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3001/api/gmail/callback'
  );
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.readonly'],
    prompt: 'consent',
  });
}

export async function exchangeCodeForTokens(code: string): Promise<void> {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3001/api/gmail/callback'
  );
  const { tokens } = await client.getToken(code);
  await pool.query(
    `INSERT INTO gmail_sync_state (id, access_token, refresh_token, token_expiry)
     VALUES (1, $1, $2, $3)
     ON CONFLICT(id) DO UPDATE SET
       access_token = EXCLUDED.access_token,
       refresh_token = COALESCE(EXCLUDED.refresh_token, gmail_sync_state.refresh_token),
       token_expiry = EXCLUDED.token_expiry`,
    [tokens.access_token ?? null, tokens.refresh_token ?? null, tokens.expiry_date?.toString() ?? null]
  );

  // Fetch and store the user's email
  try {
    const tempClient = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3001/api/gmail/callback'
    );
    tempClient.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: tempClient });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const email = profile.data.emailAddress ?? null;
    if (email) {
      await pool.query('UPDATE gmail_sync_state SET email = $1 WHERE id = 1', [email]);
    }
  } catch { /* non-critical */ }
}

export async function getSyncState(): Promise<GmailSyncState | null> {
  const { rows } = await pool.query('SELECT * FROM gmail_sync_state WHERE id = 1');
  return rows[0] ?? null;
}

export async function isGmailConnected(): Promise<boolean> {
  const state = await getSyncState();
  return !!(state?.access_token);
}

export async function disconnectGmail(): Promise<void> {
  await pool.query(
    'UPDATE gmail_sync_state SET access_token = NULL, refresh_token = NULL, token_expiry = NULL, email = NULL WHERE id = 1'
  );
}

export async function syncNewEmails(): Promise<number> {
  const auth = await getOAuth2Client();
  const gmail = google.gmail({ version: 'v1', auth: auth as any });
  const state = await getSyncState();
  let newSubscriptionsFound = 0;

  try {
    let messageIds: string[] = [];

    if (state?.history_id) {
      // Incremental sync using historyId
      try {
        const historyRes = await gmail.users.history.list({
          userId: 'me',
          startHistoryId: state.history_id,
          historyTypes: ['messageAdded'],
          labelId: 'INBOX',
        });
        const history = historyRes.data.history ?? [];
        for (const h of history) {
          for (const msg of h.messagesAdded ?? []) {
            if (msg.message?.id) messageIds.push(msg.message.id);
          }
        }
      } catch {
        // historyId expired, fall back to recent search
        messageIds = await getRecentSubscriptionMessageIds(gmail);
      }
    } else {
      messageIds = await getRecentSubscriptionMessageIds(gmail);
    }

    // Get new historyId
    const profileRes = await gmail.users.getProfile({ userId: 'me' });
    const newHistoryId = profileRes.data.historyId ?? null;

    for (const msgId of messageIds) {
      if (await isGmailMessageAlreadyImported(msgId)) continue;
      const parsed = await fetchAndParseMessage(gmail, msgId);
      if (parsed) {
        await createSubscription({
          ...parsed,
          status: 'pending',
          source: 'gmail',
          gmail_message_id: msgId,
        });
        newSubscriptionsFound++;
      }
    }

    // Update sync state
    const NOW_EXPR = `to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')`;
    await pool.query(
      `UPDATE gmail_sync_state SET last_synced_at = ${NOW_EXPR}, history_id = $1 WHERE id = 1`,
      [newHistoryId]
    );

    return newSubscriptionsFound;
  } catch (err) {
    console.error('Gmail sync error:', err);
    throw err;
  }
}

async function getRecentSubscriptionMessageIds(gmail: gmail_v1.Gmail): Promise<string[]> {
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: 'newer_than:180d (subject:subscription OR subject:receipt OR subject:invoice OR subject:billing OR subject:"your plan" OR subject:מנוי OR subject:חשבונית OR subject:קבלה OR subject:"חיוב חודשי" OR subject:"חיוב שנתי")',
    maxResults: 100,
  });
  return (res.data.messages ?? []).map(m => m.id!).filter(Boolean);
}

async function fetchAndParseMessage(gmail: gmail_v1.Gmail, messageId: string): Promise<ParsedSubscription | null> {
  const res = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });
  const msg = res.data;
  const headers = msg.payload?.headers ?? [];
  const subject = headers.find(h => h.name === 'Subject')?.value ?? '';
  const from = headers.find(h => h.name === 'From')?.value ?? '';

  // Extract domain early for known-sender check
  const fromDomain = extractDomain(from);
  const isKnownSender = fromDomain ? !!KNOWN_SENDERS[fromDomain] : false;

  // Subject must match subscription patterns regardless of sender
  // (known sender improves company name/cancel URL extraction, but doesn't bypass subject filter)
  const isSubscriptionEmail = SUBSCRIPTION_SUBJECT_PATTERNS.some(p => p.test(subject));
  if (!isSubscriptionEmail) return null;

  // Extract body text
  const bodyText = extractBodyText(msg.payload);
  const bodyHtml = extractBodyHtml(msg.payload);

  // Determine company from known senders
  let company_name = '';
  let cancel_url: string | undefined;
  const knownSender = fromDomain ? KNOWN_SENDERS[fromDomain] : null;
  if (knownSender) {
    company_name = knownSender.company;
    cancel_url = knownSender.cancelUrl;
  } else {
    // Extract company from subject
    company_name = extractCompanyFromSubject(subject) ?? extractCompanyFromFrom(from) ?? 'Unknown';
  }

  // Try to find cancel link in HTML body
  if (!cancel_url && bodyHtml) {
    const match = CANCEL_LINK_PATTERN.exec(bodyHtml);
    if (match) cancel_url = match[1];
  }

  // Extract cost (optional — if not found, add as pending with $0 for user to fill in)
  const costInfo = extractCost(bodyText) ?? { monthly_cost: 0, cost_per_cycle: 0, billing_cycle: 'monthly' as const };

  // Extract renewal date
  const renewal_date = extractRenewalDate(bodyText) ?? getDefaultRenewalDate(costInfo.billing_cycle);

  return {
    company_name,
    service_name: company_name,
    cost: costInfo.monthly_cost,
    billing_cycle: costInfo.billing_cycle,
    cost_per_cycle: costInfo.cost_per_cycle,
    renewal_date,
    cancel_url,
  };
}

function extractBodyText(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf-8');
  }
  for (const part of payload.parts ?? []) {
    const text = extractBodyText(part);
    if (text) return text;
  }
  return '';
}

function extractBodyHtml(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return '';
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf-8');
  }
  for (const part of payload.parts ?? []) {
    const html = extractBodyHtml(part);
    if (html) return html;
  }
  return '';
}

function extractDomain(from: string): string | null {
  const match = from.match(/@([\w.-]+)/);
  if (!match) return null;
  const parts = match[1].split('.');
  if (parts.length >= 2) return `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
  return match[1];
}

function extractCost(text: string): { monthly_cost: number; cost_per_cycle: number; billing_cycle: 'monthly' | 'yearly' } | null {
  for (const pattern of COST_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const amount = parseFloat(match[1]);
      const period = match[2]?.toLowerCase();
      if (period && (period.includes('year') || period.includes('yr') || period.includes('annual'))) {
        return { monthly_cost: amount / 12, cost_per_cycle: amount, billing_cycle: 'yearly' };
      }
      return { monthly_cost: amount, cost_per_cycle: amount, billing_cycle: 'monthly' };
    }
  }
  return null;
}

function extractRenewalDate(text: string): string | null {
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const parsed = new Date(match[1].trim());
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
    }
  }
  return null;
}

function getDefaultRenewalDate(cycle: 'monthly' | 'yearly'): string {
  const d = new Date();
  if (cycle === 'yearly') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString().split('T')[0];
}

function extractCompanyFromSubject(subject: string): string | null {
  const match = subject.match(/(?:from|by|to)\s+([A-Z][A-Za-z0-9\s]+?)(?:\s*[-,]|\s*$)/);
  return match ? match[1].trim() : null;
}

function extractCompanyFromFrom(from: string): string | null {
  const nameMatch = from.match(/^"?([^"<]+)"?\s*</);
  if (nameMatch) return nameMatch[1].trim();
  const domainMatch = from.match(/@([\w-]+)\./);
  if (domainMatch) return domainMatch[1].charAt(0).toUpperCase() + domainMatch[1].slice(1);
  return null;
}

