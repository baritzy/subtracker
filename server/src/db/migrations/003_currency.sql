ALTER TABLE subscriptions ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD'
  CHECK(currency IN ('USD', 'ILS'));
