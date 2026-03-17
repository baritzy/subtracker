import { useState } from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { SubscriptionForm } from '@/components/SubscriptionForm';
import { lookupLogoUrl } from '@/lib/logos';
import { formatCurrency } from '@/lib/utils';
import type { Subscription, CreateSubscriptionPayload } from '@/types';

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86400000);
}

function urgencyColor(days: number): string {
  if (days < 0) return '#ef4444';
  if (days <= 3) return '#f97316';
  if (days <= 7) return '#eab308';
  return '#22c55e';
}

function urgencyBg(days: number): string {
  if (days < 0) return 'rgba(239,68,68,0.08)';
  if (days <= 3) return 'rgba(249,115,22,0.08)';
  if (days <= 7) return 'rgba(234,179,8,0.08)';
  return 'rgba(34,197,94,0.08)';
}

function daysLabel(days: number): string {
  if (days < 0) return `פג לפני ${Math.abs(days)} ימים`;
  if (days === 0) return 'מסתיים היום!';
  if (days === 1) return 'מסתיים מחר';
  return `${days} ימים נותרו`;
}

function LogoCell({ sub }: { sub: Subscription }) {
  const [stage, setStage] = useState(0);
  const src = sub.logo_url || lookupLogoUrl(sub.company_name);
  if (!src || stage >= 2) {
    return (
      <div style={{
        width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
        background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '16px', fontWeight: '800', color: '#fbbf24',
      }}>
        {sub.company_name[0]}
      </div>
    );
  }
  return (
    <div style={{
      width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
      background: '#fff', border: '1px solid rgba(255,255,255,0.1)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      <img
        src={src}
        alt=""
        onError={() => setStage(s => s + 1)}
        style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '5px' }}
      />
    </div>
  );
}

export function Trials() {
  const { subscriptions, loading, update, cancel } = useSubscriptions();
  const [editTarget, setEditTarget] = useState<Subscription | null>(null);

  const trials = subscriptions
    .filter(s => s.is_trial === 1 && s.status === 'active')
    .sort((a, b) => {
      if (!a.trial_end_date && !b.trial_end_date) return 0;
      if (!a.trial_end_date) return 1;
      if (!b.trial_end_date) return -1;
      return a.trial_end_date.localeCompare(b.trial_end_date);
    });

  async function handleSave(payload: CreateSubscriptionPayload) {
    if (editTarget) await update(editTarget.id, payload);
    setEditTarget(null);
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '60px', color: '#475569' }}>טוען...</div>;
  }

  if (trials.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: '48px', marginBottom: '14px' }}>🎯</div>
        <p style={{ color: '#94a3b8', fontSize: '15px', margin: 0, fontFamily: "'Heebo', sans-serif" }}>
          אין ניסיונות חינם פעילים
        </p>
        <p style={{ color: '#475569', fontSize: '13px', marginTop: '8px', fontFamily: "'Heebo', sans-serif" }}>
          בהוספת מנוי — סמן "ניסיון חינם" כדי לעקוב
        </p>
      </div>
    );
  }

  return (
    <div>
      <div style={{
        marginBottom: '20px', padding: '14px 16px', borderRadius: '14px',
        background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)',
      }}>
        <div style={{ fontSize: '13px', color: '#fbbf24', fontWeight: '700', fontFamily: "'Heebo', sans-serif" }}>
          🎯 {trials.length} ניסיון{trials.length !== 1 ? 'ות' : ''} פעיל{trials.length !== 1 ? 'ים' : ''}
        </div>
        <div style={{ fontSize: '12px', color: '#92400e', marginTop: '4px', fontFamily: "'Heebo', sans-serif" }}>
          עקוב אחרי מתי כל אחד מסתיים — לפני שמחייבים אותך
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {trials.map(sub => {
          const days = sub.trial_end_date ? daysUntil(sub.trial_end_date) : null;
          const color = days !== null ? urgencyColor(days) : '#94a3b8';
          const bg = days !== null ? urgencyBg(days) : 'rgba(255,255,255,0.03)';

          return (
            <div key={sub.id} style={{
              borderRadius: '16px', overflow: 'hidden',
              border: `1px solid ${days !== null && days <= 3 ? 'rgba(249,115,22,0.3)' : 'rgba(255,255,255,0.08)'}`,
              background: bg,
              transition: 'border-color 0.2s',
            }}>
              <div style={{ padding: '16px' }}>
                {/* Top row: logo + name + actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <LogoCell sub={sub} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '15px', fontWeight: '800', color: '#f1f5f9', fontFamily: "'Heebo', sans-serif" }}>
                      {sub.company_name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                      {sub.service_name}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => setEditTarget(sub)}
                      title="ערוך"
                      style={{
                        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px', padding: '7px', cursor: 'pointer',
                        color: '#94a3b8', display: 'flex', alignItems: 'center',
                      }}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => void cancel(sub.id)}
                      title="ביטל ניסיון"
                      style={{
                        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                        borderRadius: '8px', padding: '7px', cursor: 'pointer',
                        color: '#ef4444', display: 'flex', alignItems: 'center',
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Trial end info */}
                <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <div>
                    {sub.trial_end_date ? (
                      <>
                        <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '2px', fontFamily: "'Heebo', sans-serif" }}>
                          סיום הניסיון
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: '#e2e8f0', fontFamily: "'Heebo', sans-serif" }}>
                          {new Date(sub.trial_end_date).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: '12px', color: '#475569', fontFamily: "'Heebo', sans-serif" }}>
                        לא הוגדר תאריך סיום
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: 'left' }}>
                    {days !== null && (
                      <div style={{
                        fontSize: '13px', fontWeight: '700',
                        color, background: `${color}18`,
                        border: `1px solid ${color}33`,
                        borderRadius: '8px', padding: '4px 10px',
                        fontFamily: "'Heebo', sans-serif",
                      }}>
                        {daysLabel(days)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Price when trial ends */}
                <div style={{
                  marginTop: '12px', paddingTop: '12px',
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{ fontSize: '12px', color: '#64748b', fontFamily: "'Heebo', sans-serif" }}>
                    מחיר אחרי הניסיון
                  </span>
                  <span style={{
                    fontSize: '15px', fontWeight: '800', color: '#f1f5f9',
                    fontFamily: '"JetBrains Mono", monospace',
                  }}>
                    {formatCurrency(sub.cost_per_cycle, sub.currency as 'USD' | 'ILS')}
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '400', marginRight: '3px' }}>
                      /{sub.billing_cycle === 'monthly' ? 'חודש' : sub.billing_cycle === 'yearly' ? 'שנה' : `${sub.custom_cycle_months} חודשים`}
                    </span>
                  </span>
                </div>

                {/* Convert button — mark as paid subscription */}
                <button
                  onClick={() => {
                    // Open edit form — user will uncheck "Trial" and save
                    setEditTarget(sub);
                  }}
                  style={{
                    marginTop: '12px', width: '100%', padding: '10px',
                    borderRadius: '10px', border: 'none',
                    background: 'rgba(99,102,241,0.12)', color: '#818cf8',
                    cursor: 'pointer', fontSize: '13px', fontWeight: '700',
                    fontFamily: "'Heebo', sans-serif",
                    transition: 'background 0.15s',
                  }}
                  onPointerEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.2)')}
                  onPointerLeave={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.12)')}
                >
                  עברתי למנוי בתשלום
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <SubscriptionForm
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        onSave={handleSave}
        initial={editTarget}
      />
    </div>
  );
}
