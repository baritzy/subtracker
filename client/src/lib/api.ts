import type { Subscription, CreateSubscriptionPayload, UpdateSubscriptionPayload } from '@/types';

const BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  if (!res.ok) {
    if (res.status === 401) {
      // Only reload if a token existed (session expired). If no token, just throw.
      if (localStorage.getItem('auth_token')) {
        localStorage.removeItem('auth_token');
        window.location.reload();
      }
    }
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'Request failed');
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  auth: {
    googleUrl: (mode: 'popup' | 'redirect' = 'popup') =>
      request<{ url: string }>(`/auth/google?mode=${mode}`),

    me: () =>
      request<{ id: number; email: string; name: string | null; is_premium: boolean }>('/auth/me'),
  },

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

    invoices: (id: number) =>
      request<import('@/types').Invoice[]>(`/subscriptions/${id}/invoices`),
  },

  push: {
    vapidKey: () => request<{ key: string }>('/push/vapid-public'),
    subscribe: (sub: { endpoint: string; p256dh: string; auth: string }) =>
      request<{ ok: boolean }>('/push/subscribe', { method: 'POST', body: JSON.stringify(sub) }),
    unsubscribe: (endpoint: string) =>
      request<{ ok: boolean }>('/push/subscribe', { method: 'DELETE', body: JSON.stringify({ endpoint }) }),
    test: () =>
      request<{ ok: boolean }>('/push/test', { method: 'POST' }),
  },

  cancelUrl: (service: string) =>
    request<{ url: string | null }>(`/subscriptions/cancel-url?service=${encodeURIComponent(service)}`),

  plansUrl: (service: string) =>
    request<{ url: string | null }>(`/subscriptions/plans-url?service=${encodeURIComponent(service)}`),

  logoSearch: (q: string) =>
    request<{ logo: string | null; domain: string | null }>(`/subscriptions/logo-search?q=${encodeURIComponent(q)}`),
};
