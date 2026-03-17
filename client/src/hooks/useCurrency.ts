import { useState, useEffect } from 'react';

export type Currency = 'USD' | 'ILS';

const RATE_CACHE_KEY = 'subtracker_ils_rate';
const RATE_CACHE_TTL = 60 * 60 * 1000; // 1 hour

export function useCurrency() {
  const [currency, setCurrencyState] = useState<Currency>(
    () => (localStorage.getItem('subtracker_currency') as Currency) ?? 'USD'
  );
  const [ilsRate, setIlsRate] = useState<number>(() => {
    const cached = localStorage.getItem(RATE_CACHE_KEY);
    if (cached) {
      const { rate, ts } = JSON.parse(cached);
      if (Date.now() - ts < RATE_CACHE_TTL) return rate;
    }
    return 3.7; // fallback
  });

  useEffect(() => {
    const cached = localStorage.getItem(RATE_CACHE_KEY);
    if (cached) {
      const { ts } = JSON.parse(cached);
      if (Date.now() - ts < RATE_CACHE_TTL) return;
    }
    fetch('https://api.frankfurter.app/latest?from=USD&to=ILS')
      .then(r => r.json())
      .then(data => {
        const rate = data?.rates?.ILS;
        if (rate) {
          setIlsRate(rate);
          localStorage.setItem(RATE_CACHE_KEY, JSON.stringify({ rate, ts: Date.now() }));
        }
      })
      .catch(() => {}); // fallback silently
  }, []);

  function setCurrency(c: Currency) {
    setCurrencyState(c);
    localStorage.setItem('subtracker_currency', c);
  }

  function formatAmount(usdAmount: number): string {
    if (currency === 'ILS') {
      return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(usdAmount * ilsRate);
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(usdAmount);
  }

  return { currency, setCurrency, ilsRate, formatAmount };
}
