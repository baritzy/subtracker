import { getAllActiveSubscriptionsAllUsers, updateSubscription } from './subscriptionService';
import { createInvoice, invoiceAlreadyExists } from './invoiceService';

/**
 * Advances a date string by the subscription's billing cycle.
 * e.g. 2024-03-16 + monthly → 2024-04-16
 */
function nextRenewalDate(current: string, cycle: 'monthly' | 'yearly' | 'custom', customMonths?: number | null): string {
  const d = new Date(current);
  if (cycle === 'yearly') {
    d.setFullYear(d.getFullYear() + 1);
  } else if (cycle === 'custom' && customMonths) {
    d.setMonth(d.getMonth() + customMonths);
  } else {
    // monthly (default)
    d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString().split('T')[0];
}

/**
 * Process all subscriptions whose renewal_date is today or in the past.
 * For each one:
 *  1. Create an invoice for the amount paid.
 *  2. Advance the renewal_date to the next cycle.
 */
export async function processRenewals(): Promise<void> {
  const today = new Date().toISOString().split('T')[0]; // e.g. "2026-03-16"
  const active = await getAllActiveSubscriptionsAllUsers();

  let processed = 0;

  for (const sub of active) {
    if (sub.renewal_date > today) continue; // not due yet

    // Keep advancing until renewal_date is in the future
    // (handles the case where the server was offline for multiple cycles)
    let currentDate = sub.renewal_date;

    while (currentDate <= today) {
      if (!(await invoiceAlreadyExists(sub.id, currentDate))) {
        await createInvoice({
          subscription_id: sub.id,
          amount: sub.cost_per_cycle,
          billing_cycle: sub.billing_cycle === 'custom' ? 'monthly' : sub.billing_cycle,
          invoice_date: currentDate,
          currency: sub.currency,
        });
        console.log(`[Renewal] Invoice created for "${sub.company_name}" on ${currentDate} (${sub.cost_per_cycle} ${sub.currency})`);
      }
      currentDate = nextRenewalDate(currentDate, sub.billing_cycle, sub.custom_cycle_months);
    }

    // Update the subscription's renewal_date to the next upcoming date
    await updateSubscription(sub.id, { renewal_date: currentDate });
    console.log(`[Renewal] "${sub.company_name}" next renewal → ${currentDate}`);
    processed++;
  }

  if (processed > 0) {
    console.log(`[Renewal] Processed ${processed} subscription(s).`);
  }
}

/**
 * Runs processRenewals once on startup, then every day at midnight.
 */
export function startRenewalScheduler(): void {
  // Run immediately on startup to catch any renewals missed while server was off
  processRenewals().catch(err => console.error('[Renewal] Error:', err));

  // Calculate ms until next midnight
  function msUntilMidnight(): number {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0); // next midnight
    return midnight.getTime() - now.getTime();
  }

  // First tick at next midnight, then every 24 h
  setTimeout(() => {
    processRenewals().catch(err => console.error('[Renewal] Error:', err));
    setInterval(() => {
      processRenewals().catch(err => console.error('[Renewal] Error:', err));
    }, 24 * 60 * 60 * 1000);
  }, msUntilMidnight());

  console.log(`[Renewal] Scheduler started — next run at midnight (in ${Math.round(msUntilMidnight() / 60000)} min).`);
}
