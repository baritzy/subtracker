CREATE TABLE IF NOT EXISTS subscriptions (
    id                  SERIAL PRIMARY KEY,
    company_name        TEXT NOT NULL,
    service_name        TEXT NOT NULL,
    cost                DECIMAL NOT NULL,
    billing_cycle       TEXT NOT NULL CHECK(billing_cycle IN ('monthly', 'yearly', 'custom')),
    cost_per_cycle      DECIMAL NOT NULL,
    custom_cycle_months INTEGER,
    renewal_date        TEXT NOT NULL,
    start_date          TEXT,
    cancel_url          TEXT,
    status              TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'cancelled', 'pending')),
    cancelled_at        TEXT,
    source              TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('manual', 'gmail')),
    gmail_message_id    TEXT,
    notes               TEXT,
    plan_type           TEXT NOT NULL DEFAULT 'personal' CHECK(plan_type IN ('personal', 'family', 'other')),
    plan_type_custom    TEXT,
    currency            TEXT NOT NULL DEFAULT 'USD' CHECK(currency IN ('USD', 'ILS')),
    logo_url            TEXT,
    is_trial            INTEGER NOT NULL DEFAULT 0,
    trial_end_date      TEXT,
    created_at          TEXT NOT NULL DEFAULT to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
    updated_at          TEXT NOT NULL DEFAULT to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS gmail_sync_state (
    id             INTEGER PRIMARY KEY CHECK(id = 1),
    last_synced_at TEXT,
    history_id     TEXT,
    access_token   TEXT,
    refresh_token  TEXT,
    token_expiry   TEXT,
    email          TEXT
);

CREATE TABLE IF NOT EXISTS invoices (
    id               SERIAL PRIMARY KEY,
    subscription_id  INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    amount           DECIMAL NOT NULL DEFAULT 0,
    billing_cycle    TEXT NOT NULL DEFAULT 'monthly',
    invoice_date     TEXT NOT NULL,
    currency         TEXT NOT NULL DEFAULT 'USD',
    gmail_message_id TEXT,
    notes            TEXT,
    created_at       TEXT NOT NULL DEFAULT to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status  ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_renewal ON subscriptions(renewal_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_gmail   ON subscriptions(gmail_message_id);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date         ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_gmail        ON invoices(gmail_message_id)
