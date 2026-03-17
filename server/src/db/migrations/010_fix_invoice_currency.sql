UPDATE invoices SET currency = (
  SELECT currency FROM subscriptions WHERE subscriptions.id = invoices.subscription_id
);
