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
import { smartCompanySearch, saveUserLogo, getQuotaStatus } from '../services/companySearchService';

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
let COMPANY_DB: Record<string, string> = {};
try {
  COMPANY_DB = require('./companyDbInline').COMPANY_DB;
  console.log('[LogoDB] Loaded', Object.keys(COMPANY_DB).length, 'companies. Sample:', Object.keys(COMPANY_DB).slice(0, 3));
} catch (err) {
  console.error('[LogoDB] FAILED to load companyDbInline:', err);
}

// Legacy inline DB (unused, kept as backup reference)
const _UNUSED = {
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
  'freetv': 'freetv.co.il', 'free tv': 'freetv.co.il', 'פריטיוי': 'freetv.co.il', 'פרי טיוי': 'freetv.co.il', 'פרי טי וי': 'freetv.co.il', 'freeTV': 'freetv.co.il',
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
// Hardcoded logo overrides for companies with broken favicons
const LOGO_OVERRIDES: Record<string, string> = {
  'freetv.co.il': 'https://subtracker-api.fly.dev/logos/freetv.png',
  'web.freetv.tv': 'https://subtracker-api.fly.dev/logos/freetv.png',
};

async function findBestLogo(domain: string): Promise<string> {
  // Check overrides first
  if (LOGO_OVERRIDES[domain]) return LOGO_OVERRIDES[domain];
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
  // Try 3: Google favicons (128px, very reliable)
  try {
    const gUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    const gRes = await fetch(gUrl, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(3000) });
    if (gRes.ok && gRes.headers.get('content-type')?.includes('image')) {
      // Google returns a default globe icon for unknown domains — check size to filter it out
      const contentLength = parseInt(gRes.headers.get('content-length') ?? '0');
      if (contentLength > 500) {
        return gUrl;
      }
    }
  } catch {}
  // Try 4: DuckDuckGo icon
  return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
}

// Lookup domain from the local database (supports Hebrew + English + fuzzy match)
function lookupDomain(query: string): string | null {
  // Normalize: lowercase, trim, collapse whitespace
  const q = query.toLowerCase().trim().replace(/\s+/g, ' ');
  // Exact match
  if (COMPANY_DB[q]) return COMPANY_DB[q];
  // Normalized match (remove all spaces)
  const qNoSpaces = q.replace(/\s+/g, '');
  for (const [key, domain] of Object.entries(COMPANY_DB)) {
    if (key.replace(/\s+/g, '') === qNoSpaces) return domain;
  }
  // Partial match — find key that starts with query or query starts with key
  for (const [key, domain] of Object.entries(COMPANY_DB)) {
    if (key.startsWith(q) || q.startsWith(key)) return domain;
  }
  // Word match — any word in the query matches a key
  const words = q.split(/\s+/);
  for (const word of words) {
    if (word.length >= 3 && COMPANY_DB[word]) return COMPANY_DB[word];
  }
  // Contains match
  for (const [key, domain] of Object.entries(COMPANY_DB)) {
    if (key.length >= 3 && (q.includes(key) || key.includes(q))) return domain;
  }
  return null;
}

// DEBUG: check company DB status
router.get('/logo-db-status', (req: AuthRequest, res: Response) => {
  const q = ((req.query.q as string) ?? '').trim();
  const qLower = q.toLowerCase();
  const exactMatch = COMPANY_DB[qLower] ?? null;
  const qNorm = qLower.normalize('NFC');
  const exactMatchNorm = COMPANY_DB[qNorm] ?? null;
  // Check char codes
  const qCodes = [...qLower].map(c => c.charCodeAt(0));
  let firstKeyMatch = null;
  for (const [key, domain] of Object.entries(COMPANY_DB)) {
    const keyCodes = [...key].map(c => c.charCodeAt(0));
    if (keyCodes.length === qCodes.length && keyCodes.every((c, i) => c === qCodes[i])) {
      firstKeyMatch = { key, domain };
      break;
    }
  }
  res.json({
    count: Object.keys(COMPANY_DB).length,
    query: q,
    queryLower: qLower,
    queryNormalized: qNorm,
    queryCodes: qCodes,
    exactMatch,
    exactMatchNorm,
    charCodeMatch: firstKeyMatch,
    sample: Object.keys(COMPANY_DB).slice(0, 3).map(k => ({ key: k, codes: [...k].map(c => c.charCodeAt(0)) })),
  });
});

function normalizeCompanyForLogo(name: string): string {
  return name
    .replace(/(inc.?|llc.?|ltd.?|corp.?|gmbh|s.a.|b.v.)/gi, "")
    .replace(/s+/g, " ")
    .trim();
}

// GET /api/subscriptions/logo-search?q=Anthropic  (must be before /:id)
router.get('/logo-search', async (req: AuthRequest, res: Response) => {
  const q = (req.query.q as string ?? '').trim();
  if (!q) return res.json({ logo: null });

  // Step 1: Check hardcoded DB first (instant, supports Hebrew)
  const localDomain = lookupDomain(q);
  console.log(`[logo-search] q="${q}" → localDomain=${localDomain}`);
  if (localDomain) {
    const logo = await findBestLogo(localDomain);
    console.log(`[logo-search] findBestLogo("${localDomain}") → ${logo?.slice(0, 80)}`);
    return res.json({ logo, domain: localDomain });
  }

  // Step 2: Smart search — cache → Google → Clearbit → guess (with verification)
  try {
    const result = await smartCompanySearch(q);
    return res.json({ logo: result.logo, domain: result.domain });
  } catch (e) {
    console.error('[logo-search] Smart search failed, falling back:', e);
    return res.json({ logo: null });
  }
});

// POST /api/subscriptions/logo-upload — user uploads a logo for a company
router.post('/logo-upload', async (req: AuthRequest, res: Response) => {
  const { companyName, logoUrl } = req.body;
  if (!companyName || !logoUrl) return res.status(400).json({ error: 'companyName and logoUrl required' });
  try {
    await saveUserLogo(companyName, logoUrl);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to save logo' });
  }
});

// GET /api/subscriptions/search-quota — admin: check today's quota usage
router.get('/search-quota', async (req: AuthRequest, res: Response) => {
  const status = await getQuotaStatus();
  res.json(status);
});

// GET /api/subscriptions/cancel-url?service=CapCut  (must be before /:id)
router.get('/cancel-url', async (req: AuthRequest, res: Response) => {
  const service = (req.query.service as string) ?? '';
  console.log(`[cancel-url] Looking up: "${service}"`);

  // Step 1: Check hardcoded DB
  let url = lookupCancelUrl(service);
  if (url) {
    console.log(`[cancel-url] Found in DB: ${url}`);
    return res.json({ url });
  }

  // Step 2: Find the company's domain (via logo search cache or COMPANY_DB)
  const localDomain = lookupDomain(service);
  let domain = localDomain;

  // Step 3: If no local domain, try Google Custom Search
  if (!domain) {
    const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const cx = process.env.GOOGLE_SEARCH_CX;
    if (apiKey && cx) {
      try {
        const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(service + ' cancel subscription')}&num=3`;
        const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(5000) });
        if (searchRes.ok) {
          const data = await searchRes.json() as { items?: { link: string; displayLink: string }[] };
          if (data.items?.length) {
            // Check each result — find first one that looks like it belongs to this company
            const serviceWords = service.toLowerCase().split(/\s+/).filter(w => w.length >= 2);
            for (const item of data.items) {
              const itemDomain = item.displayLink.replace(/^www\./, '');
              const matchesService = serviceWords.some(w => itemDomain.includes(w) || item.link.toLowerCase().includes(w));
              if (matchesService) {
                // Found a cancel-related page for this company
                console.log(`[cancel-url] Google found cancel page: ${item.link}`);
                return res.json({ url: item.link });
              }
            }
            // No cancel-specific match — use first result's domain as fallback
            domain = data.items[0].displayLink.replace(/^www\./, '');
          }
        }
      } catch {}
    }
  }

  // Step 4: If no domain from Google, try Clearbit
  if (!domain) {
    try {
      const suggest = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(service)}`, { signal: AbortSignal.timeout(3000) });
      const results = await suggest.json() as { domain: string; name: string }[];
      if (results.length > 0) {
        const serviceWords = service.toLowerCase().split(/\s+/).filter(w => w.length >= 2);
        const match = results.find(r => serviceWords.some(w => r.domain.includes(w) || r.name.toLowerCase().includes(w)));
        domain = match?.domain ?? results[0].domain;
      }
    } catch {}
  }

  if (!domain) {
    console.log(`[cancel-url] No domain found for "${service}"`);
    return res.json({ url: null });
  }

  // Step 5: Try common cancel/account paths on the domain
  const cancelPaths = ['/cancel', '/account/cancel', '/account', '/settings/subscription', '/settings/billing', '/my-account'];
  for (const path of cancelPaths) {
    const testUrl = `https://www.${domain}${path}`;
    try {
      const testRes = await fetch(testUrl, {
        method: 'HEAD',
        redirect: 'follow',
        signal: AbortSignal.timeout(3000),
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (testRes.ok) {
        console.log(`[cancel-url] Found working cancel path: ${testUrl}`);
        return res.json({ url: testUrl });
      }
    } catch {}
  }

  // Step 6: Fallback — return company homepage
  const homepage = `https://www.${domain}`;
  console.log(`[cancel-url] Fallback to homepage: ${homepage}`);
  return res.json({ url: homepage });
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
    if (updated.notifications_enabled === 1) {
      await scheduleNotifications(updated.id, req.userId!, updated.renewal_date);
    } else {
      await cancelNotifications(updated.id);
    }
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
