import { Router, Request, Response } from 'express';
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

const router = Router();

// GET /api/subscriptions?status=active|cancelled|pending
router.get('/', (req: Request, res: Response) => {
  const { status } = req.query;
  const subs = getAllSubscriptions(status as string | undefined);
  res.json(subs);
});

// GET /api/subscriptions/logo-search?q=Anthropic  (must be before /:id)
router.get('/logo-search', async (req: Request, res: Response) => {
  const q = (req.query.q as string ?? '').trim();
  if (!q) return res.json({ logo: null });
  try {
    const url = `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(q)}`;
    const r = await fetch(url);
    const results = await r.json() as { name: string; domain: string; logo: string }[];
    // Validate: domain must roughly match the query to avoid wrong logos
    const queryWords = q.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const match = results.find(r => {
      const d = r.domain.toLowerCase();
      return queryWords.some(word => d.includes(word));
    }) ?? null;
    const domain = match?.domain ?? null;
    const logo = domain ? `https://logo.clearbit.com/${domain}` : null;
    return res.json({ logo, domain });
  } catch {
    return res.json({ logo: null });
  }
});

// GET /api/subscriptions/cancel-url?service=CapCut  (must be before /:id)
router.get('/cancel-url', async (req: Request, res: Response) => {
  const service = (req.query.service as string) ?? '';
  const url = lookupCancelUrl(service);
  if (!url) return res.json({ url: null });

  // Validate: HEAD request with 3s timeout — only discard on clear 404
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
  } catch {
    // Timeout / network error / CORS — assume URL might still be valid
  }

  return res.json({ url });
});

// GET /api/subscriptions/plans-url?service=Netflix  (must be before /:id)
router.get('/plans-url', (req: Request, res: Response) => {
  const service = (req.query.service as string) ?? '';
  const url = lookupPlansUrl(service);
  return res.json({ url });
});

// DELETE /api/subscriptions/all  →  delete every subscription
router.delete('/all', (_req: Request, res: Response) => {
  deleteAllSubscriptions();
  return res.status(204).send();
});

// GET /api/subscriptions/:id
router.get('/:id', (req: Request, res: Response) => {
  const sub = getSubscriptionById(Number(req.params.id));
  if (!sub) return res.status(404).json({ error: 'Subscription not found' });
  return res.json(sub);
});

// GET /api/subscriptions/:id/invoices
router.get('/:id/invoices', (req: Request, res: Response) => {
  const sub = getSubscriptionById(Number(req.params.id));
  if (!sub) return res.status(404).json({ error: 'Subscription not found' });
  const invoices = getInvoicesForSubscription(Number(req.params.id));
  return res.json(invoices);
});

// POST /api/subscriptions
router.post('/', (req: Request, res: Response) => {
  const { company_name, service_name, cost, billing_cycle, cost_per_cycle, custom_cycle_months,
    renewal_date, start_date, cancel_url, notes, plan_type, plan_type_custom, currency, logo_url,
    is_trial, trial_end_date } = req.body;
  if (!company_name || !service_name || cost == null || !billing_cycle || cost_per_cycle == null || !renewal_date) {
    return res.status(400).json({ error: 'Missing required fields: company_name, service_name, cost, billing_cycle, cost_per_cycle, renewal_date' });
  }
  const sub = createSubscription({ company_name, service_name, cost, billing_cycle, cost_per_cycle,
    custom_cycle_months, renewal_date, start_date, cancel_url, notes, plan_type, plan_type_custom, currency, logo_url,
    is_trial: !!is_trial, trial_end_date });
  return res.status(201).json(sub);
});

// PUT /api/subscriptions/:id
router.put('/:id', (req: Request, res: Response) => {
  const sub = getSubscriptionById(Number(req.params.id));
  if (!sub) return res.status(404).json({ error: 'Subscription not found' });
  const updated = updateSubscription(Number(req.params.id), req.body);
  return res.json(updated);
});

// POST /api/subscriptions/:id/cancel
router.post('/:id/cancel', (req: Request, res: Response) => {
  const sub = getSubscriptionById(Number(req.params.id));
  if (!sub) return res.status(404).json({ error: 'Subscription not found' });
  const updated = cancelSubscription(Number(req.params.id));
  return res.json(updated);
});

// POST /api/subscriptions/:id/confirm
router.post('/:id/confirm', (req: Request, res: Response) => {
  const sub = getSubscriptionById(Number(req.params.id));
  if (!sub) return res.status(404).json({ error: 'Subscription not found' });
  const updated = confirmPendingSubscription(Number(req.params.id));
  return res.json(updated);
});

// DELETE /api/subscriptions/:id
router.delete('/:id', (req: Request, res: Response) => {
  const deleted = deleteSubscription(Number(req.params.id));
  if (!deleted) return res.status(404).json({ error: 'Subscription not found' });
  return res.status(204).send();
});

export default router;
