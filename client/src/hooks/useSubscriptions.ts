import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { Subscription, CreateSubscriptionPayload, UpdateSubscriptionPayload } from '@/types';

function sortByRenewal(subs: Subscription[]): Subscription[] {
  return [...subs].sort((a, b) => a.renewal_date.localeCompare(b.renewal_date));
}

export function useSubscriptions(status?: string, enabled = true) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.subscriptions.list(status);
      setSubscriptions(sortByRenewal(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { if (enabled) void fetch(); }, [fetch, enabled]);

  const create = async (payload: CreateSubscriptionPayload) => {
    const sub = await api.subscriptions.create(payload);
    setSubscriptions(prev => sortByRenewal([...prev, sub]));
    return sub;
  };

  const update = async (id: number, payload: UpdateSubscriptionPayload) => {
    const sub = await api.subscriptions.update(id, payload);
    setSubscriptions(prev => sortByRenewal(prev.map(s => s.id === id ? sub : s)));
    return sub;
  };

  const cancel = async (id: number) => {
    const sub = await api.subscriptions.cancel(id);
    setSubscriptions(prev => prev.filter(s => s.id !== id));
    return sub;
  };

  const confirm = async (id: number) => {
    const sub = await api.subscriptions.confirm(id);
    setSubscriptions(prev => sortByRenewal(prev.map(s => s.id === id ? sub : s)));
    return sub;
  };

  const dismiss = async (id: number) => {
    await api.subscriptions.delete(id);
    setSubscriptions(prev => prev.filter(s => s.id !== id));
  };

  return { subscriptions, loading, error, refetch: fetch, create, update, cancel, confirm, dismiss };
}
