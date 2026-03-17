import { pool } from '../db/database';

export interface Invoice {
  id: number;
  subscription_id: number;
  amount: number;
  billing_cycle: 'monthly' | 'yearly';
  invoice_date: string;
  currency: 'USD' | 'ILS';
  gmail_message_id: string | null;
  notes: string | null;
  created_at: string;
}

export async function getInvoicesForSubscription(subscriptionId: number): Promise<Invoice[]> {
  const { rows } = await pool.query(
    'SELECT * FROM invoices WHERE subscription_id = $1 ORDER BY invoice_date DESC',
    [subscriptionId]
  );
  return rows;
}

export async function createInvoice(input: {
  subscription_id: number;
  amount: number;
  billing_cycle: 'monthly' | 'yearly';
  invoice_date: string;
  currency?: 'USD' | 'ILS';
  gmail_message_id?: string;
  notes?: string;
}): Promise<Invoice> {
  const { rows } = await pool.query(
    `INSERT INTO invoices (subscription_id, amount, billing_cycle, invoice_date, currency, gmail_message_id, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      input.subscription_id, input.amount, input.billing_cycle, input.invoice_date,
      input.currency ?? 'USD', input.gmail_message_id ?? null, input.notes ?? null,
    ]
  );
  const { rows: invoice } = await pool.query('SELECT * FROM invoices WHERE id = $1', [rows[0].id]);
  return invoice[0];
}

export async function isGmailMessageAlreadyInvoiced(gmailMessageId: string): Promise<boolean> {
  const { rows } = await pool.query(
    'SELECT id FROM invoices WHERE gmail_message_id = $1',
    [gmailMessageId]
  );
  return rows.length > 0;
}

export async function invoiceAlreadyExists(subscriptionId: number, date: string): Promise<boolean> {
  const { rows } = await pool.query(
    'SELECT id FROM invoices WHERE subscription_id = $1 AND invoice_date = $2',
    [subscriptionId, date]
  );
  return rows.length > 0;
}
