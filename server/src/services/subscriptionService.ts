import { getDb } from '../db/database';

export interface Subscription {
  id: number;
  company_name: string;
  service_name: string;
  cost: number;
  billing_cycle: 'monthly' | 'yearly' | 'custom';
  cost_per_cycle: number;
  custom_cycle_months: number | null;
  renewal_date: string;
  start_date: string | null;
  cancel_url: string | null;
  status: 'active' | 'cancelled' | 'pending';
  cancelled_at: string | null;
  source: 'manual' | 'gmail';
  gmail_message_id: string | null;
  notes: string | null;
  plan_type: 'personal' | 'family' | 'other';
  plan_type_custom: string | null;
  currency: 'USD' | 'ILS';
  logo_url: string | null;
  is_trial: number; // 0 | 1
  trial_end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSubscriptionInput {
  company_name: string;
  service_name: string;
  cost: number;
  billing_cycle: 'monthly' | 'yearly' | 'custom';
  cost_per_cycle: number;
  custom_cycle_months?: number;
  renewal_date: string;
  start_date?: string;
  cancel_url?: string;
  status?: 'active' | 'cancelled' | 'pending';
  source?: 'manual' | 'gmail';
  gmail_message_id?: string;
  notes?: string;
  plan_type?: 'personal' | 'family' | 'other';
  plan_type_custom?: string;
  currency?: 'USD' | 'ILS';
  logo_url?: string;
  is_trial?: boolean;
  trial_end_date?: string;
}

export interface UpdateSubscriptionInput {
  company_name?: string;
  service_name?: string;
  cost?: number;
  billing_cycle?: 'monthly' | 'yearly' | 'custom';
  cost_per_cycle?: number;
  custom_cycle_months?: number | null;
  renewal_date?: string;
  start_date?: string | null;
  cancel_url?: string | null;
  notes?: string | null;
  plan_type?: 'personal' | 'family' | 'other';
  plan_type_custom?: string | null;
  is_trial?: boolean;
  trial_end_date?: string | null;
}

export function getAllSubscriptions(status?: string): Subscription[] {
  const db = getDb();
  if (status) {
    return db.prepare('SELECT * FROM subscriptions WHERE status = ? ORDER BY renewal_date ASC').all(status) as Subscription[];
  }
  return db.prepare('SELECT * FROM subscriptions ORDER BY renewal_date ASC').all() as Subscription[];
}

export function getSubscriptionById(id: number): Subscription | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(id) as Subscription | undefined;
}

export function createSubscription(input: CreateSubscriptionInput): Subscription {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO subscriptions
      (company_name, service_name, cost, billing_cycle, cost_per_cycle, custom_cycle_months,
       renewal_date, start_date, cancel_url, status, source, gmail_message_id, notes,
       plan_type, plan_type_custom, currency, logo_url, is_trial, trial_end_date)
    VALUES
      (@company_name, @service_name, @cost, @billing_cycle, @cost_per_cycle, @custom_cycle_months,
       @renewal_date, @start_date, @cancel_url, @status, @source, @gmail_message_id, @notes,
       @plan_type, @plan_type_custom, @currency, @logo_url, @is_trial, @trial_end_date)
  `);
  const result = stmt.run({
    company_name: input.company_name,
    service_name: input.service_name,
    cost: input.cost,
    billing_cycle: input.billing_cycle,
    cost_per_cycle: input.cost_per_cycle,
    custom_cycle_months: input.custom_cycle_months ?? null,
    renewal_date: input.renewal_date,
    start_date: input.start_date ?? null,
    cancel_url: input.cancel_url ?? null,
    status: input.status ?? 'active',
    source: input.source ?? 'manual',
    gmail_message_id: input.gmail_message_id ?? null,
    notes: input.notes ?? null,
    plan_type: input.plan_type ?? 'personal',
    plan_type_custom: input.plan_type_custom ?? null,
    currency: input.currency ?? 'USD',
    logo_url: input.logo_url ?? null,
    is_trial: input.is_trial ? 1 : 0,
    trial_end_date: input.trial_end_date ?? null,
  });
  return getSubscriptionById(result.lastInsertRowid as number)!;
}

export function updateSubscription(id: number, input: UpdateSubscriptionInput): Subscription | undefined {
  const db = getDb();
  const params: Record<string, unknown> = { ...input };
  // Convert boolean is_trial to 0/1 for SQLite
  if (typeof params.is_trial === 'boolean') {
    params.is_trial = params.is_trial ? 1 : 0;
  }
  const fields = Object.keys(params)
    .filter(k => params[k] !== undefined)
    .map(k => `${k} = @${k}`)
    .join(', ');
  if (!fields) return getSubscriptionById(id);
  db.prepare(`UPDATE subscriptions SET ${fields}, updated_at = datetime('now') WHERE id = @id`).run({ ...params, id });
  return getSubscriptionById(id);
}

export function cancelSubscription(id: number): Subscription | undefined {
  const db = getDb();
  db.prepare(`
    UPDATE subscriptions
    SET status = 'cancelled', cancelled_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `).run(id);
  return getSubscriptionById(id);
}

export function confirmPendingSubscription(id: number): Subscription | undefined {
  const db = getDb();
  db.prepare(`
    UPDATE subscriptions
    SET status = 'active', updated_at = datetime('now')
    WHERE id = ? AND status = 'pending'
  `).run(id);
  return getSubscriptionById(id);
}

export function deleteSubscription(id: number): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM subscriptions WHERE id = ?').run(id);
  return result.changes > 0;
}

export function deleteAllSubscriptions(): number {
  const db = getDb();
  const result = db.prepare('DELETE FROM subscriptions').run();
  return result.changes;
}

export function isGmailMessageAlreadyImported(gmailMessageId: string): boolean {
  const db = getDb();
  const row = db.prepare('SELECT id FROM subscriptions WHERE gmail_message_id = ?').get(gmailMessageId);
  return !!row;
}
