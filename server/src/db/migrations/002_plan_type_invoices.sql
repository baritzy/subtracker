-- Add plan_type to subscriptions
ALTER TABLE subscriptions ADD COLUMN plan_type TEXT NOT NULL DEFAULT 'personal'
  CHECK(plan_type IN ('personal', 'family', 'other'));
ALTER TABLE subscriptions ADD COLUMN plan_type_custom TEXT;

-- Invoices table: one row per billing event detected from Gmail
CREATE TABLE IF NOT EXISTS invoices (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id   INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    amount            REAL NOT NULL DEFAULT 0,
    billing_cycle     TEXT NOT NULL DEFAULT 'monthly',
    invoice_date      TEXT NOT NULL,
    gmail_message_id  TEXT,
    notes             TEXT,
    created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date         ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_gmail        ON invoices(gmail_message_id);
