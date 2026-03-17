import { useState } from 'react';

export interface NotifPrefs {
  d7: boolean;
  h24: boolean;
  h3: boolean;
}

const STORAGE_KEY = 'notif-prefs';
const DEFAULT_PREFS: NotifPrefs = { d7: true, h24: true, h3: true };

function loadPrefs(): NotifPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<NotifPrefs>;
    return {
      d7: parsed.d7 ?? true,
      h24: parsed.h24 ?? true,
      h3: parsed.h3 ?? true,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function useNotificationPrefs(): [NotifPrefs, (p: NotifPrefs) => void] {
  const [prefs, setPrefsState] = useState<NotifPrefs>(loadPrefs);

  function setPrefs(p: NotifPrefs) {
    setPrefsState(p);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  }

  return [prefs, setPrefs];
}
