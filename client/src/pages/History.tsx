import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO, differenceInDays } from 'date-fns';
import { he } from 'date-fns/locale';
import { Trash2 } from 'lucide-react';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { formatCurrency } from '@/lib/utils';
import { api } from '@/lib/api';
import type { Subscription } from '@/types';

function formatDuration(startDate: string, endDate: string): string {
  const days = differenceInDays(parseISO(endDate), parseISO(startDate));
  if (days < 0) return '';
  const months = Math.floor(days / 30);
  const remainingDays = days % 30;
  if (months === 0) return `${days} ימים`;
  const monthsStr = months === 1 ? 'חודש' : `${months} חודשים`;
  if (remainingDays === 0) return monthsStr;
  return `${monthsStr} ו-${remainingDays} ימים`;
}

function calcTotalPaid(sub: Subscription): number | null {
  if (!sub.start_date) return null;
  const start = parseISO(sub.start_date);
  const end = sub.cancelled_at ? parseISO(sub.cancelled_at) : new Date();
  const totalDays = differenceInDays(end, start);
  if (totalDays <= 0) return null;
  const cycleMonths = sub.billing_cycle === 'yearly' ? 12
    : sub.billing_cycle === 'custom' ? (sub.custom_cycle_months ?? 1)
    : 1;
  const cycleDays = cycleMonths * 30;
  const cycles = Math.ceil(totalDays / cycleDays);
  return cycles * sub.cost_per_cycle;
}

export function History() {
  const { subscriptions, loading, dismiss } = useSubscriptions('cancelled');
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [loadingPlansId, setLoadingPlansId] = useState<number | null>(null);

  const sorted = [...subscriptions].sort((a, b) =>
    new Date(b.cancelled_at ?? b.updated_at).getTime() - new Date(a.cancelled_at ?? a.updated_at).getTime()
  );

  async function handleRenew(id: number, companyName: string) {
    setLoadingPlansId(id);
    try {
      const { url } = await api.plansUrl(companyName);
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        const query = encodeURIComponent(`${companyName} pricing plans`);
        window.open(`https://www.google.com/search?q=${query}`, '_blank', 'noopener,noreferrer');
      }
    } catch {
      const query = encodeURIComponent(`${companyName} pricing plans`);
      window.open(`https://www.google.com/search?q=${query}`, '_blank', 'noopener,noreferrer');
    } finally {
      setLoadingPlansId(null);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '8px' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            height: '72px', borderRadius: '14px',
            background: 'rgba(255,255,255,0.02)', animation: 'pulse 1.5s ease infinite',
          }} />
        ))}
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: '44px', marginBottom: '14px' }}>🗂️</div>
        <p style={{ color: '#475569', fontSize: '15px', margin: 0 }}>אין מנויים מבוטלים עדיין.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <AnimatePresence>
        {sorted.map((sub, i) => (
          <motion.div
            key={sub.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}
            transition={{ delay: i * 0.05 }}
            style={{
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '14px', padding: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#e2e8f0' }}>{sub.company_name}</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{sub.service_name}</div>
              {sub.start_date && sub.cancelled_at && (
                <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>
                  {formatDuration(sub.start_date, sub.cancelled_at)}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'left', flexShrink: 0 }}>
              {(() => {
                const total = calcTotalPaid(sub);
                return total != null ? (
                  <div style={{
                    fontSize: '14px', fontWeight: '700', color: '#64748b',
                    fontFamily: '"JetBrains Mono", monospace',
                  }}>
                    {formatCurrency(total, sub.currency)}
                  </div>
                ) : (
                  <div style={{
                    fontSize: '14px', fontWeight: '700', color: '#64748b',
                    fontFamily: '"JetBrains Mono", monospace', textDecoration: 'line-through',
                  }}>
                    {formatCurrency(sub.cost, sub.currency)}/חו׳
                  </div>
                );
              })()}
              <div style={{ fontSize: '11px', color: '#334155', marginTop: '2px', textAlign: 'left' }}>
                {sub.cancelled_at ? format(parseISO(sub.cancelled_at), 'd MMM yyyy', { locale: he }) : '—'}
              </div>
            </div>

            {/* Actions */}
            {confirmId === sub.id ? (
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <button
                  onClick={() => { void dismiss(sub.id); setConfirmId(null); }}
                  style={{
                    padding: '6px 12px', borderRadius: '8px', border: 'none',
                    background: 'rgba(239,68,68,0.2)', color: '#ef4444',
                    cursor: 'pointer', fontSize: '12px', fontWeight: '700',
                    fontFamily: "'Heebo', sans-serif",
                  }}
                >
                  מחק
                </button>
                <button
                  onClick={() => setConfirmId(null)}
                  style={{
                    padding: '6px 12px', borderRadius: '8px', border: 'none',
                    background: 'rgba(255,255,255,0.06)', color: '#64748b',
                    cursor: 'pointer', fontSize: '12px', fontWeight: '700',
                    fontFamily: "'Heebo', sans-serif",
                  }}
                >
                  ביטול
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                {/* Renew button */}
                <button
                  onClick={() => { void handleRenew(sub.id, sub.company_name); }}
                  disabled={loadingPlansId === sub.id}
                  style={{
                    padding: '6px 10px', borderRadius: '8px', border: 'none',
                    background: loadingPlansId === sub.id ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.15)',
                    color: '#22c55e',
                    cursor: loadingPlansId === sub.id ? 'default' : 'pointer',
                    fontSize: '12px', fontWeight: '700',
                    fontFamily: "'Heebo', sans-serif",
                    transition: 'background 0.15s',
                    opacity: loadingPlansId === sub.id ? 0.7 : 1,
                  }}
                  onMouseEnter={e => {
                    if (loadingPlansId !== sub.id)
                      e.currentTarget.style.background = 'rgba(34,197,94,0.25)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(34,197,94,0.15)';
                  }}
                >
                  {loadingPlansId === sub.id ? '...' : 'חדש מנוי'}
                </button>
                {/* Delete button */}
                <button
                  onClick={() => setConfirmId(sub.id)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#334155', padding: '6px',
                    borderRadius: '8px', transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#334155')}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
