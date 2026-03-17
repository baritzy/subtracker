import { getDb } from '../db/database';

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

export function getInvoicesForSubscription(subscriptionId: number): Invoice[] {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM invoices WHERE subscription_id = ? ORDER BY invoice_date DESC'
  ).all(subscriptionId) as Invoice[];
}

export function createInvoice(input: {
  subscription_id: number;
  amount: number;
  billing_cycle: 'monthly' | 'yearly';
  invoice_date: string;
  currency?: 'USD' | 'ILS';
  gmail_message_id?: string;
  notes?: string;
}): Invoice {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO invoices (subscription_id, amount, billing_cycle, invoice_date, currency, gmail_message_id, notes)
    VALUES (@subscription_id, @amount, @billing_cycle, @invoice_date, @currency, @gmail_message_id, @notes)
  `).run({
    subscription_id: input.subscription_id,
    amount: input.amount,
    billing_cycle: input.billing_cycle,
    invoice_date: input.invoice_date,
    currency: input.currency ?? 'USD',
    gmail_message_id: input.gmail_message_id ?? null,
    notes: input.notes ?? null,
  });
  return db.prepare('SELECT * FROM invoices WHERE id = ?').get(result.lastInsertRowid) as Invoice;
}

export function isGmailMessageAlreadyInvoiced(gmailMessageId: string): boolean {
  const db = getDb();
  return !!db.prepare('SELECT id FROM invoices WHERE gmail_message_id = ?').get(gmailMessageId);
}
