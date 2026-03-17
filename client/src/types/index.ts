export interface Subscription {
  id: number;
  company_name: string;
  service_name: string;
  cost: number;
  billing_cycle: 'monthly' | 'yearly' | 'custom';
  cost_per_cycle: number;
  custom_cycle_months: number | null;
  renewal_date: string;
  start_date: string | null;
  cancel_url: string | null;
  status: 'active' | 'cancelled' | 'pending';
  cancelled_at: string | null;
  source: 'manual' | 'gmail';
  gmail_message_id: string | null;
  notes: string | null;
  plan_type: 'personal' | 'family' | 'other';
  plan_type_custom: string | null;
  currency: 'USD' | 'ILS';
  logo_url: string | null;
  is_trial: number; // 0 | 1
  trial_end_date: string | null;
  created_at: string;
  updated_at: string;
}

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

export interface CreateSubscriptionPayload {
  company_name: string;
  service_name: string;
  cost: number;
  billing_cycle: 'monthly' | 'yearly' | 'custom';
  cost_per_cycle: number;
  custom_cycle_months?: number;
  renewal_date: string;
  start_date?: string;
  cancel_url?: string;
  notes?: string;
  plan_type?: 'personal' | 'family' | 'other';
  plan_type_custom?: string;
  currency?: 'USD' | 'ILS';
  logo_url?: string;
  is_trial?: boolean;
  trial_end_date?: string;
}

export interface UpdateSubscriptionPayload {
  company_name?: string;
  service_name?: string;
  cost?: number;
  billing_cycle?: 'monthly' | 'yearly' | 'custom';
  cost_per_cycle?: number;
  custom_cycle_months?: number | null;
  renewal_date?: string;
  start_date?: string | null;
  cancel_url?: string | null;
  notes?: string | null;
  plan_type?: 'personal' | 'family' | 'other';
  plan_type_custom?: string | null;
  currency?: 'USD' | 'ILS';
  is_trial?: boolean;
  trial_end_date?: string | null;
}

export interface GmailStatus {
  connected: boolean;
  email: string | null;
  last_synced_at: string | null;
}
