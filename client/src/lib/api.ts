import type { Subscription, CreateSubscriptionPayload, UpdateSubscriptionPayload, GmailStatus } from '@/types';

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'Request failed');
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Subscriptions
export const api = {
  subscriptions: {
    list: (status?: string) =>
      request<Subscription[]>(`/subscriptions${status ? `?status=${status}` : ''}`),

    create: (payload: CreateSubscriptionPayload) =>
      request<Subscription>('/subscriptions', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    update: (id: number, payload: UpdateSubscriptionPayload) =>
      request<Subscription>(`/subscriptions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),

    cancel: (id: number) =>
      request<Subscription>(`/subscriptions/${id}/cancel`, { method: 'POST' }),

    confirm: (id: number) =>
      request<Subscription>(`/subscriptions/${id}/confirm`, { method: 'POST' }),

    delete: (id: number) =>
      request<void>(`/subscriptions/${id}`, { method: 'DELETE' }),

    deleteAll: () =>
      request<void>('/subscriptions/all', { method: 'DELETE' }),
  },

  cancelUrl: (service: string) =>
    request<{ url: string | null }>(`/subscriptions/cancel-url?service=${encodeURIComponent(service)}`),

  plansUrl: (service: string) =>
    request<{ url: string | null }>(`/subscriptions/plans-url?service=${encodeURIComponent(service)}`),

  logoSearch: (q: string) =>
    request<{ logo: string | null; domain: string | null }>(`/subscriptions/logo-search?q=${encodeURIComponent(q)}`),

  gmail: {
    status: () =>
      request<GmailStatus>('/gmail/status'),

    authUrl: () =>
      request<{ url: string }>('/gmail/auth'),

    sync: () =>
      request<{ new_subscriptions_found: number }>('/gmail/sync', { method: 'POST' }),

    disconnect: () =>
      request<void>('/gmail/disconnect', { method: 'POST' }),
  },
};
