CREATE TABLE IF NOT EXISTS push_notifications_sent (
  subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  offset_key TEXT NOT NULL,
  notification_date DATE NOT NULL DEFAULT CURRENT_DATE,
  PRIMARY KEY (subscription_id, offset_key, notification_date)
);
