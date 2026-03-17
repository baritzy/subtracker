CREATE TABLE IF NOT EXISTS subscriptions (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    company_name     TEXT NOT NULL,
    service_name     TEXT NOT NULL,
    cost             REAL NOT NULL,
    billing_cycle    TEXT NOT NULL CHECK(billing_cycle IN ('monthly', 'yearly')),
    cost_per_cycle   REAL NOT NULL,
    renewal_date     TEXT NOT NULL,
    cancel_url       TEXT,
    status           TEXT NOT NULL DEFAULT 'active'
                     CHECK(status IN ('active', 'cancelled', 'pending')),
    cancelled_at     TEXT,
    source           TEXT NOT NULL DEFAULT 'manual'
                     CHECK(source IN ('manual', 'gmail')),
    gmail_message_id TEXT,
    notes            TEXT,
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS gmail_sync_state (
    id             INTEGER PRIMARY KEY CHECK(id = 1),
    last_synced_at TEXT,
    history_id     TEXT,
    access_token   TEXT,
    refresh_token  TEXT,
    token_expiry   TEXT
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status  ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_renewal ON subscriptions(renewal_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_gmail   ON subscriptions(gmail_message_id);
