import { pool } from '../db/database';

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
  is_trial: number;
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

const NOW_EXPR = `to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')`;

export async function getAllSubscriptions(status?: string): Promise<Subscription[]> {
  if (status) {
    const { rows } = await pool.query(
      'SELECT * FROM subscriptions WHERE status = $1 ORDER BY renewal_date ASC',
      [status]
    );
    return rows;
  }
  const { rows } = await pool.query('SELECT * FROM subscriptions ORDER BY renewal_date ASC');
  return rows;
}

export async function getSubscriptionById(id: number): Promise<Subscription | undefined> {
  const { rows } = await pool.query('SELECT * FROM subscriptions WHERE id = $1', [id]);
  return rows[0];
}

export async function createSubscription(input: CreateSubscriptionInput): Promise<Subscription> {
  const { rows } = await pool.query(
    `INSERT INTO subscriptions
      (company_name, service_name, cost, billing_cycle, cost_per_cycle, custom_cycle_months,
       renewal_date, start_date, cancel_url, status, source, gmail_message_id, notes,
       plan_type, plan_type_custom, currency, logo_url, is_trial, trial_end_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
     RETURNING id`,
    [
      input.company_name, input.service_name, input.cost, input.billing_cycle,
      input.cost_per_cycle, input.custom_cycle_months ?? null, input.renewal_date,
      input.start_date ?? null, input.cancel_url ?? null, input.status ?? 'active',
      input.source ?? 'manual', input.gmail_message_id ?? null, input.notes ?? null,
      input.plan_type ?? 'personal', input.plan_type_custom ?? null, input.currency ?? 'USD',
      input.logo_url ?? null, input.is_trial ? 1 : 0, input.trial_end_date ?? null,
    ]
  );
  return (await getSubscriptionById(rows[0].id))!;
}

export async function updateSubscription(id: number, input: UpdateSubscriptionInput): Promise<Subscription | undefined> {
  const params: Record<string, unknown> = { ...input };
  if (typeof params.is_trial === 'boolean') params.is_trial = params.is_trial ? 1 : 0;

  const keys = Object.keys(params).filter(k => params[k] !== undefined);
  if (!keys.length) return getSubscriptionById(id);

  const values: unknown[] = keys.map(k => params[k]);
  const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  values.push(id);

  await pool.query(
    `UPDATE subscriptions SET ${setClause}, updated_at = ${NOW_EXPR} WHERE id = $${values.length}`,
    values
  );
  return getSubscriptionById(id);
}

export async function cancelSubscription(id: number): Promise<Subscription | undefined> {
  await pool.query(
    `UPDATE subscriptions SET status = 'cancelled', cancelled_at = ${NOW_EXPR}, updated_at = ${NOW_EXPR} WHERE id = $1`,
    [id]
  );
  return getSubscriptionById(id);
}

export async function confirmPendingSubscription(id: number): Promise<Subscription | undefined> {
  await pool.query(
    `UPDATE subscriptions SET status = 'active', updated_at = ${NOW_EXPR} WHERE id = $1 AND status = 'pending'`,
    [id]
  );
  return getSubscriptionById(id);
}

export async function deleteSubscription(id: number): Promise<boolean> {
  const { rowCount } = await pool.query('DELETE FROM subscriptions WHERE id = $1', [id]);
  return (rowCount ?? 0) > 0;
}

export async function deleteAllSubscriptions(): Promise<number> {
  const { rowCount } = await pool.query('DELETE FROM subscriptions');
  return rowCount ?? 0;
}

export async function isGmailMessageAlreadyImported(gmailMessageId: string): Promise<boolean> {
  const { rows } = await pool.query(
    'SELECT id FROM subscriptions WHERE gmail_message_id = $1',
    [gmailMessageId]
  );
  return rows.length > 0;
}
