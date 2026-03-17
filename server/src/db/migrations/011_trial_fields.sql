ALTER TABLE subscriptions ADD COLUMN is_trial INTEGER NOT NULL DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN trial_end_date TEXT;
