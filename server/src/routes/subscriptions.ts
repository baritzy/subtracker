import { Router, Response } from 'express';
import {
  getAllSubscriptions,
  getSubscriptionById,
  createSubscription,
  updateSubscription,
  cancelSubscription,
  confirmPendingSubscription,
  deleteSubscription,
  deleteAllSubscriptions,
} from '../services/subscriptionService';
import { getInvoicesForSubscription } from '../services/invoiceService';
import { lookupCancelUrl } from '../services/cancelUrlService';
import { lookupPlansUrl } from '../services/plansUrlService';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { scheduleNotifications, cancelNotifications } from '../services/pushScheduler';

const router = Router();

// All subscription routes require auth
router.use(requireAuth);

// GET /api/subscriptions?status=active|cancelled|pending
router.get('/', async (req: AuthRequest, res: Response) => {
  const { status } = req.query;
  const subs = await getAllSubscriptions(req.userId!, status as string | undefined);
  res.json(subs);
});

// ====== COMPANY LOGO DATABASE ======
// Maps company names (lowercase) and aliases to domains
const COMPANY_DB: Record<string, string> = {
  // === ISRAEL TOP 100 ===
  'נטפליקס': 'netflix.com', 'netflix': 'netflix.com',
  'ספוטיפיי': 'spotify.com', 'spotify': 'spotify.com',
  'אפל': 'apple.com', 'apple': 'apple.com', 'apple tv': 'apple.com', 'apple music': 'apple.com', 'icloud': 'apple.com',
  'גוגל': 'google.com', 'google': 'google.com', 'google one': 'one.google.com', 'youtube': 'youtube.com', 'youtube premium': 'youtube.com',
  'אמזון': 'amazon.com', 'amazon': 'amazon.com', 'amazon prime': 'amazon.com', 'prime video': 'primevideo.com',
  'דיסני': 'disneyplus.com', 'disney': 'disneyplus.com', 'disney+': 'disneyplus.com',
  'hbo': 'hbomax.com', 'hbo max': 'hbomax.com', 'max': 'max.com',
  'סלקום': 'cellcom.co.il', 'cellcom': 'cellcom.co.il',
  'פרטנר': 'partner.co.il', 'partner': 'partner.co.il',
  'פלאפון': 'pelephone.co.il', 'pelephone': 'pelephone.co.il',
  'הוט': 'hot.net.il', 'hot': 'hot.net.il',
  'yes': 'yes.co.il', 'יס': 'yes.co.il',
  'בזק': 'bezeq.co.il', 'bezeq': 'bezeq.co.il',
  'סלקום tv': 'cellcomtv.co.il',
  'wolt': 'wolt.com', 'וולט': 'wolt.com',
  'bolt': 'bolt.eu', 'בולט': 'bolt.eu',
  'gett': 'gett.com', 'גט': 'gett.com',
  'yango': 'yango.com',
  'מכבי': 'maccabi4u.co.il', 'maccabi': 'maccabi4u.co.il',
  'כללית': 'clalit.co.il', 'clalit': 'clalit.co.il',
  'לאומית': 'leumit.co.il', 'leumit': 'leumit.co.il',
  'מאוחדת': 'meuhedet.co.il', 'meuhedet': 'meuhedet.co.il',
  'ביטוח לאומי': 'btl.gov.il',
  'כאן': 'kan.org.il',
  'חינוכית': 'iba.org.il',
  'ווינדס': 'winds.co.il',
  '012': '012.net.il',
  '013': '013netvision.net.il',
  'אקספרס vpn': 'expressvpn.com', 'expressvpn': 'expressvpn.com',
  'nordvpn': 'nordvpn.com',
  'surfshark': 'surfshark.com',
  'wix': 'wix.com', 'וויקס': 'wix.com',
  'monday': 'monday.com', 'מאנדיי': 'monday.com',
  'fiverr': 'fiverr.com', 'פייבר': 'fiverr.com',
  'elementor': 'elementor.com',
  'canva': 'canva.com', 'קנבה': 'canva.com',
  'adobe': 'adobe.com', 'אדובי': 'adobe.com', 'photoshop': 'adobe.com', 'illustrator': 'adobe.com', 'premiere': 'adobe.com',
  'figma': 'figma.com',
  'notion': 'notion.so',
  'dropbox': 'dropbox.com', 'דרופבוקס': 'dropbox.com',
  'microsoft': 'microsoft.com', 'מייקרוסופט': 'microsoft.com', 'office': 'microsoft.com', 'microsoft 365': 'microsoft.com', 'onedrive': 'microsoft.com',
  'zoom': 'zoom.us',
  'slack': 'slack.com',
  'github': 'github.com',
  'openai': 'openai.com', 'chatgpt': 'openai.com',
  'claude': 'anthropic.com', 'anthropic': 'anthropic.com',
  'midjourney': 'midjourney.com',
  'grammarly': 'grammarly.com',
  'duolingo': 'duolingo.com',
  'headspace': 'headspace.com',
  'calm': 'calm.com',
  'strava': 'strava.com',
  'peloton': 'onepeloton.com',
  // === US / GLOBAL TOP 100 ===
  'hulu': 'hulu.com',
  'peacock': 'peacocktv.com',
  'paramount': 'paramountplus.com', 'paramount+': 'paramountplus.com',
  'crunchyroll': 'crunchyroll.com',
  'tidal': 'tidal.com',
  'deezer': 'deezer.com',
  'audible': 'audible.com',
  'kindle': 'amazon.com',
  'xbox': 'xbox.com', 'xbox game pass': 'xbox.com',
  'playstation': 'playstation.com', 'ps plus': 'playstation.com',
  'nintendo': 'nintendo.com', 'nintendo switch online': 'nintendo.com',
  'steam': 'steampowered.com',
  'ea play': 'ea.com', 'ea': 'ea.com',
  'twitch': 'twitch.tv',
  'linkedin': 'linkedin.com', 'linkedin premium': 'linkedin.com',
  'twitter': 'x.com', 'x premium': 'x.com',
  'reddit': 'reddit.com',
  'medium': 'medium.com',
  'substack': 'substack.com',
  'patreon': 'patreon.com',
  'onlyfans': 'onlyfans.com',
  'tinder': 'tinder.com',
  'bumble': 'bumble.com',
  'doordash': 'doordash.com',
  'uber eats': 'ubereats.com', 'uber': 'uber.com',
  'instacart': 'instacart.com',
  'walmart+': 'walmart.com', 'walmart': 'walmart.com',
  'costco': 'costco.com',
  'blue apron': 'blueapron.com',
  'hellofresh': 'hellofresh.com',
  'noom': 'noom.com',
  'weight watchers': 'weightwatchers.com', 'ww': 'weightwatchers.com',
  'planet fitness': 'planetfitness.com',
  'aaa': 'aaa.com',
  'geico': 'geico.com',
  'progressive': 'progressive.com',
  'state farm': 'statefarm.com',
  'evernote': 'evernote.com',
  'todoist': 'todoist.com',
  'trello': 'trello.com',
  'asana': 'asana.com',
  'jira': 'atlassian.com', 'atlassian': 'atlassian.com',
  'confluence': 'atlassian.com',
  'bitbucket': 'bitbucket.org',
  'gitlab': 'gitlab.com',
  'vercel': 'vercel.com',
  'netlify': 'netlify.com',
  'aws': 'aws.amazon.com',
  'heroku': 'heroku.com',
  'digitalocean': 'digitalocean.com',
  'cloudflare': 'cloudflare.com',
  'godaddy': 'godaddy.com',
  'namecheap': 'namecheap.com',
  'squarespace': 'squarespace.com',
  'shopify': 'shopify.com',
  'wordpress': 'wordpress.com',
  'mailchimp': 'mailchimp.com',
  'hubspot': 'hubspot.com',
  'salesforce': 'salesforce.com',
  'zendesk': 'zendesk.com',
  'intercom': 'intercom.com',
  'stripe': 'stripe.com',
  'paypal': 'paypal.com', 'פייפאל': 'paypal.com',
  'revolut': 'revolut.com',
  'wise': 'wise.com',
  '1password': '1password.com',
  'lastpass': 'lastpass.com',
  'bitwarden': 'bitwarden.com',
  'norton': 'norton.com',
  'mcafee': 'mcafee.com',
  'kaspersky': 'kaspersky.com',
  'malwarebytes': 'malwarebytes.com',
  'ipvanish': 'ipvanish.com',
  'protonvpn': 'protonvpn.com', 'proton': 'proton.me',
  'nytimes': 'nytimes.com', 'new york times': 'nytimes.com',
  'washington post': 'washingtonpost.com',
  'wall street journal': 'wsj.com', 'wsj': 'wsj.com',
  'the economist': 'economist.com',
  'haaretz': 'haaretz.co.il', 'הארץ': 'haaretz.co.il',
  'ynet': 'ynet.co.il', 'וויינט': 'ynet.co.il',
  'the marker': 'themarker.com', 'דה מרקר': 'themarker.com',
  'calcalist': 'calcalist.co.il', 'כלכליסט': 'calcalist.co.il',
  'globes': 'globes.co.il', 'גלובס': 'globes.co.il',
};

// Try to find a high-res logo for a domain
async function findBestLogo(domain: string): Promise<string> {
  // Try 1: apple-touch-icon (always 180px+, best quality)
  try {
    const atiUrl = `https://${domain}/apple-touch-icon.png`;
    const atiRes = await fetch(atiUrl, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(3000) });
    if (atiRes.ok && atiRes.headers.get('content-type')?.includes('image')) {
      return atiUrl;
    }
  } catch {}
  // Try 2: apple-touch-icon-precomposed
  try {
    const atiUrl = `https://${domain}/apple-touch-icon-precomposed.png`;
    const atiRes = await fetch(atiUrl, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(3000) });
    if (atiRes.ok && atiRes.headers.get('content-type')?.includes('image')) {
      return atiUrl;
    }
  } catch {}
  // Try 3: DuckDuckGo icon
  return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
}

// Lookup domain from the local database (supports Hebrew + English + partial match)
function lookupDomain(query: string): string | null {
  const q = query.toLowerCase().trim();
  // Exact match
  if (COMPANY_DB[q]) return COMPANY_DB[q];
  // Partial match — find key that starts with query or query starts with key
  for (const [key, domain] of Object.entries(COMPANY_DB)) {
    if (key.startsWith(q) || q.startsWith(key)) return domain;
  }
  // Word match — any word in the query matches a key
  const words = q.split(/\s+/);
  for (const word of words) {
    if (word.length >= 3 && COMPANY_DB[word]) return COMPANY_DB[word];
  }
  return null;
}

// GET /api/subscriptions/logo-search?q=Anthropic  (must be before /:id)
router.get('/logo-search', async (req: AuthRequest, res: Response) => {
  const q = (req.query.q as string ?? '').trim();
  if (!q) return res.json({ logo: null });

  // Step 1: Check local database first (instant, supports Hebrew)
  const localDomain = lookupDomain(q);
  if (localDomain) {
    const logo = await findBestLogo(localDomain);
    return res.json({ logo, domain: localDomain });
  }

  // Step 2: Clearbit autocomplete
  try {
    const url = `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(q)}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
    const results = await r.json() as { name: string; domain: string; logo: string }[];
    const queryWords = q.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const match = results.find(r => {
      const d = r.domain.toLowerCase();
      const n = r.name.toLowerCase();
      return queryWords.some(word => d.includes(word) || n.includes(word));
    }) ?? (results.length > 0 ? results[0] : null);
    if (match?.domain) {
      const logo = await findBestLogo(match.domain);
      return res.json({ logo, domain: match.domain });
    }
  } catch {}

  // Step 3: Try guessing domain
  const guess = q.toLowerCase().replace(/\s+/g, '');
  const guesses = [`${guess}.com`, `${guess}.co.il`, `${guess}.io`];
  for (const g of guesses) {
    try {
      const r = await fetch(`https://${g}/apple-touch-icon.png`, { method: 'HEAD', signal: AbortSignal.timeout(2000) });
      if (r.ok) return res.json({ logo: `https://${g}/apple-touch-icon.png`, domain: g });
    } catch {}
  }

  return res.json({ logo: null });
});

// GET /api/subscriptions/cancel-url?service=CapCut  (must be before /:id)
router.get('/cancel-url', async (req: AuthRequest, res: Response) => {
  const service = (req.query.service as string) ?? '';
  let url = lookupCancelUrl(service);
  if (!url) {
    // Fallback: try to find the company domain and return its account/settings page
    try {
      const suggest = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(service)}`);
      const results = await suggest.json() as { domain: string }[];
      if (results.length > 0) {
        url = `https://${results[0].domain}/account`;
      }
    } catch {}
    if (!url) return res.json({ url: null });
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    clearTimeout(timeout);
    if (response.status === 404) return res.json({ url: null });
  } catch { /* timeout / network — assume URL might still be valid */ }
  return res.json({ url });
});

// GET /api/subscriptions/plans-url?service=Netflix  (must be before /:id)
router.get('/plans-url', (req: AuthRequest, res: Response) => {
  const service = (req.query.service as string) ?? '';
  const url = lookupPlansUrl(service);
  return res.json({ url });
});

// DELETE /api/subscriptions/all  →  delete every subscription for this user
router.delete('/all', async (req: AuthRequest, res: Response) => {
  await deleteAllSubscriptions(req.userId!);
  return res.status(204).send();
});

// GET /api/subscriptions/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const sub = await getSubscriptionById(Number(req.params.id), req.userId!);
  if (!sub) return res.status(404).json({ error: 'Subscription not found' });
  return res.json(sub);
});

// GET /api/subscriptions/:id/invoices
router.get('/:id/invoices', async (req: AuthRequest, res: Response) => {
  const sub = await getSubscriptionById(Number(req.params.id), req.userId!);
  if (!sub) return res.status(404).json({ error: 'Subscription not found' });
  const invoices = await getInvoicesForSubscription(Number(req.params.id));
  return res.json(invoices);
});

// POST /api/subscriptions
router.post('/', async (req: AuthRequest, res: Response) => {
  const { company_name, service_name, cost, billing_cycle, cost_per_cycle, custom_cycle_months,
    renewal_date, start_date, cancel_url, notes, plan_type, plan_type_custom, currency, logo_url,
    is_trial, trial_end_date } = req.body;
  if (!company_name || !service_name || cost == null || !billing_cycle || cost_per_cycle == null || !renewal_date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const sub = await createSubscription({
    company_name, service_name, cost, billing_cycle, cost_per_cycle,
    custom_cycle_months, renewal_date, start_date, cancel_url, notes,
    plan_type, plan_type_custom, currency, logo_url,
    is_trial: !!is_trial, trial_end_date,
  }, req.userId!);
  await scheduleNotifications(sub.id, req.userId!, renewal_date);
  return res.status(201).json(sub);
});

// PUT /api/subscriptions/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const sub = await getSubscriptionById(Number(req.params.id), req.userId!);
  if (!sub) return res.status(404).json({ error: 'Subscription not found' });
  const updated = await updateSubscription(Number(req.params.id), req.body);
  if (updated && updated.status === 'active' && updated.renewal_date) {
    await scheduleNotifications(updated.id, req.userId!, updated.renewal_date);
  }
  return res.json(updated);
});

// POST /api/subscriptions/:id/cancel
router.post('/:id/cancel', async (req: AuthRequest, res: Response) => {
  const sub = await getSubscriptionById(Number(req.params.id), req.userId!);
  if (!sub) return res.status(404).json({ error: 'Subscription not found' });
  await cancelNotifications(Number(req.params.id));
  const updated = await cancelSubscription(Number(req.params.id));
  return res.json(updated);
});

// POST /api/subscriptions/:id/confirm
router.post('/:id/confirm', async (req: AuthRequest, res: Response) => {
  const sub = await getSubscriptionById(Number(req.params.id), req.userId!);
  if (!sub) return res.status(404).json({ error: 'Subscription not found' });
  const updated = await confirmPendingSubscription(Number(req.params.id));
  return res.json(updated);
});

// DELETE /api/subscriptions/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const sub = await getSubscriptionById(Number(req.params.id), req.userId!);
  if (!sub) return res.status(404).json({ error: 'Subscription not found' });
  await cancelNotifications(Number(req.params.id));
  await deleteSubscription(Number(req.params.id));
  return res.status(204).send();
});

export default router;
