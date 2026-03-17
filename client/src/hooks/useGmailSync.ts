import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import type { GmailStatus } from '@/types';

export function useGmailSync(onSyncComplete?: () => void, onAuthSuccess?: () => void) {
  const [status, setStatus] = useState<GmailStatus>({ connected: false, email: null, last_synced_at: null });
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<number | null>(null);

  const refreshStatus = () => {
    void api.gmail.status().then(setStatus).catch(() => {});
  };

  useEffect(() => {
    refreshStatus();
    // Poll every 30 s so phone detects if connected from computer
    const interval = setInterval(refreshStatus, 30_000);
    return () => clearInterval(interval);
  }, []);

  const connectGmail = async () => {
    // Open popup SYNCHRONOUSLY first (browser requires direct user-gesture for popups)
    const popup = window.open('', 'gmail-auth', 'width=520,height=640');
    if (!popup) {
      // Popup blocked — fall back to full redirect
      try {
        const { url } = await api.gmail.authUrl();
        window.location.href = url;
      } catch { /* ignore */ }
      return;
    }

    try {
      const { url } = await api.gmail.authUrl();
      popup.location.href = url;
    } catch {
      popup.close();
      return;
    }

    // Listen for success message posted by the callback page
    const handler = (e: MessageEvent) => {
      if (e.data === 'gmail-auth-success') {
        window.removeEventListener('message', handler);
        refreshStatus();
        onAuthSuccess?.(); // new callback
      }
    };
    window.addEventListener('message', handler);

    // Clean up listener if popup closed without completing
    const poll = setInterval(() => {
      if (popup.closed) {
        clearInterval(poll);
        window.removeEventListener('message', handler);
        refreshStatus(); // Check in case it completed just before closing
      }
    }, 1000);
  };

  const disconnectGmail = async () => {
    await api.gmail.disconnect();
    setStatus({ connected: false, email: null, last_synced_at: null });
  };

  const syncNow = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await api.gmail.sync();
      setSyncResult(result.new_subscriptions_found);
      const newStatus = await api.gmail.status();
      setStatus(newStatus);
      if (result.new_subscriptions_found > 0) onSyncComplete?.();
    } finally {
      setSyncing(false);
    }
  };

  return { status, syncing, syncResult, connectGmail, disconnectGmail, syncNow };
}
