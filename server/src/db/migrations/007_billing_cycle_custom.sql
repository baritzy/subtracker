-- Recreate subscriptions table to allow billing_cycle = 'custom'
PRAGMA foreign_keys=OFF;

CREATE TABLE IF NOT EXISTS subscriptions_new (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    company_name     TEXT NOT NULL,
    service_name     TEXT NOT NULL,
    cost             REAL NOT NULL,
    billing_cycle    TEXT NOT NULL CHECK(billing_cycle IN ('monthly', 'yearly', 'custom')),
    cost_per_cycle   REAL NOT NULL,
    custom_cycle_months INTEGER,
    renewal_date     TEXT NOT NULL,
    start_date       TEXT,
    cancel_url       TEXT,
    status           TEXT NOT NULL DEFAULT 'active'
                     CHECK(status IN ('active', 'cancelled', 'pending')),
    cancelled_at     TEXT,
    source           TEXT NOT NULL DEFAULT 'manual'
                     CHECK(source IN ('manual', 'gmail')),
    gmail_message_id TEXT,
    notes            TEXT,
    plan_type        TEXT NOT NULL DEFAULT 'personal'
                     CHECK(plan_type IN ('personal', 'family', 'other')),
    plan_type_custom TEXT,
    currency         TEXT NOT NULL DEFAULT 'USD'
                     CHECK(currency IN ('USD', 'ILS')),
    logo_url         TEXT,
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO subscriptions_new SELECT
    id, company_name, service_name, cost, billing_cycle, cost_per_cycle,
    custom_cycle_months, renewal_date, start_date, cancel_url, status,
    cancelled_at, source, gmail_message_id, notes, plan_type, plan_type_custom,
    currency, logo_url, created_at, updated_at
FROM subscriptions;

DROP TABLE subscriptions;
ALTER TABLE subscriptions_new RENAME TO subscriptions;

CREATE INDEX IF NOT EXISTS idx_subscriptions_status  ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_renewal ON subscriptions(renewal_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_gmail   ON subscriptions(gmail_message_id);

PRAGMA foreign_keys=ON;
