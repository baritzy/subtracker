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

// GET /api/subscriptions/logo-search?q=Anthropic  (must be before /:id)
router.get('/logo-search', async (req: AuthRequest, res: Response) => {
  const q = (req.query.q as string ?? '').trim();
  if (!q) return res.json({ logo: null });
  try {
    const url = `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(q)}`;
    const r = await fetch(url);
    const results = await r.json() as { name: string; domain: string; logo: string }[];
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
router.get('/cancel-url', async (req: AuthRequest, res: Response) => {
  const service = (req.query.service as string) ?? '';
  const url = lookupCancelUrl(service);
  if (!url) return res.json({ url: null });
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
