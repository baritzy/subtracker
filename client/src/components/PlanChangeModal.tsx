import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight } from 'lucide-react';
import type { Subscription, UpdateSubscriptionPayload } from '@/types';
import { formatCurrency } from '@/lib/utils';

interface Props {
  sub: Subscription;
  onClose: () => void;
  onSave: (updates: UpdateSubscriptionPayload) => Promise<void>;
}

function toISODate(d: Date) {
  return d.toISOString().split('T')[0];
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function cycleDays(cycle: string, customMonths?: number): number {
  if (cycle === 'yearly') return 365;
  if (cycle === 'custom') return (customMonths ?? 1) * 30;
  return 30;
}

const fieldStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px',
  color: '#f1f5f9', fontSize: '15px', outline: 'none',
  boxSizing: 'border-box', transition: 'border-color 0.15s',
  fontFamily: "'Heebo', sans-serif",
  textAlign: 'right',
};

export function PlanChangeModal({ sub, onClose, onSave }: Props) {
  const today = toISODate(new Date());
  const [newPrice, setNewPrice] = useState('');
  const [newCycle, setNewCycle] = useState<'monthly' | 'yearly' | 'custom'>(sub.billing_cycle);
  const [customMonths, setCustomMonths] = useState(sub.custom_cycle_months ?? 3);
  const [switchDate, setSwitchDate] = useState(today);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const currency = sub.currency as 'USD' | 'ILS';
  const oldCycleDays = cycleDays(sub.billing_cycle, sub.custom_cycle_months ?? undefined);
  const newCycleDays = cycleDays(newCycle, customMonths);

  // Calculate proration
  const renewalTs = new Date(sub.renewal_date).getTime();
  const switchTs = new Date(switchDate).getTime();
  const msPerDay = 86400_000;
  const daysRemaining = Math.max(0, Math.round((renewalTs - switchTs) / msPerDay));
  const dailyRateOld = sub.cost_per_cycle / oldCycleDays;
  const credit = parseFloat((dailyRateOld * daysRemaining).toFixed(2));
  const newPriceNum = parseFloat(newPrice) || 0;
  const firstPayment = Math.max(0, parseFloat((newPriceNum - credit).toFixed(2)));
  const newRenewalDate = toISODate(addDays(new Date(switchDate), newCycleDays));
  const newMonthlyCost = newCycle === 'yearly' ? newPriceNum / 12
    : newCycle === 'custom' ? newPriceNum / customMonths
    : newPriceNum;

  async function handleSave() {
    if (!newPriceNum || newPriceNum <= 0) { setError('יש להזין מחיר תקין'); return; }
    setSaving(true);
    setError('');
    try {
      const prorationNote = credit > 0
        ? `שינוי מסלול ${toISODate(new Date(switchDate))}: קרדיט ${formatCurrency(credit, currency)} | תשלום ראשון ${formatCurrency(firstPayment, currency)}`
        : null;
      const existingNotes = sub.notes ? sub.notes.split('\n---\n')[0] : null;
      const notes = [existingNotes, prorationNote].filter(Boolean).join('\n---\n') || null;

      await onSave({
        cost: parseFloat(newMonthlyCost.toFixed(2)),
        cost_per_cycle: newPriceNum,
        billing_cycle: newCycle,
        custom_cycle_months: newCycle === 'custom' ? customMonths : null,
        renewal_date: newRenewalDate,
        notes,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
      />
      <motion.div
        key="sheet"
        initial={{ y: '100%', opacity: 0.5 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 101,
          background: '#0d1526', borderRadius: '24px 24px 0 0',
          border: '1px solid rgba(255,255,255,0.1)', borderBottom: 'none',
          padding: '24px 20px 0',
          paddingBottom: `max(24px, env(safe-area-inset-bottom, 24px))`,
          boxShadow: '0 -24px 80px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ width: '36px', height: '4px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px', margin: '0 auto 20px' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: '8px', display: 'flex', borderRadius: '8px' }}>
            <X size={20} />
          </button>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#f1f5f9', fontFamily: "'Heebo', sans-serif" }}>
            שינוי מסלול — {sub.company_name}
          </h2>
        </div>

        {/* Old plan info */}
        <div style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px', padding: '12px 14px', marginBottom: '16px',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '2px' }}>מסלול נוכחי</div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#94a3b8', fontFamily: 'monospace' }}>
              {formatCurrency(sub.cost_per_cycle, currency)}/{sub.billing_cycle === 'monthly' ? 'חודש' : sub.billing_cycle === 'yearly' ? 'שנה' : `${sub.custom_cycle_months} חודשים`}
            </div>
          </div>
          <ArrowRight size={16} style={{ color: '#475569', flexShrink: 0 }} />
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '2px' }}>מסלול חדש</div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: newPriceNum > 0 ? '#818cf8' : '#475569', fontFamily: 'monospace' }}>
              {newPriceNum > 0 ? `${formatCurrency(newPriceNum, currency)}/${newCycle === 'monthly' ? 'חודש' : newCycle === 'yearly' ? 'שנה' : `${customMonths} חודשים`}` : '—'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* New price */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '6px' }}>
              מחיר מסלול חדש ({currency === 'USD' ? '$' : '₪'})
            </label>
            <input
              style={fieldStyle}
              type="number" min="0" step="0.01"
              value={newPrice}
              onChange={e => setNewPrice(e.target.value)}
              placeholder={`לדוגמה: 100`}
              autoFocus
              onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.6)')}
              onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
            />
          </div>

          {/* New cycle */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '6px' }}>
              מחזור חיוב חדש
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['monthly', 'yearly', 'custom'] as const).map(cyc => (
                <button key={cyc} type="button"
                  onClick={() => setNewCycle(cyc)}
                  style={{
                    flex: 1, padding: '10px 4px', borderRadius: '10px', border: 'none',
                    cursor: 'pointer', fontSize: '12px', fontWeight: '700',
                    fontFamily: "'Heebo', sans-serif",
                    background: newCycle === cyc ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)',
                    color: newCycle === cyc ? '#a5b4fc' : '#475569',
                    border: `1px solid ${newCycle === cyc ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    transition: 'all 0.15s',
                  }}>
                  {cyc === 'monthly' ? 'חודשי' : cyc === 'yearly' ? 'שנתי' : 'מותאם'}
                </button>
              ))}
            </div>
            {newCycle === 'custom' && (
              <input
                style={{ ...fieldStyle, marginTop: '8px' }}
                type="number" min="2" max="120"
                value={customMonths}
                onChange={e => setCustomMonths(parseInt(e.target.value) || 3)}
                placeholder="מספר חודשים"
                onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.6)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
              />
            )}
          </div>

          {/* Switch date */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '6px' }}>
              תאריך המעבר
            </label>
            <input
              style={fieldStyle}
              type="date"
              value={switchDate}
              onChange={e => setSwitchDate(e.target.value)}
              max={sub.renewal_date}
              onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.6)')}
              onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
            />
          </div>

          {/* Proration breakdown */}
          {newPriceNum > 0 && (
            <div style={{
              background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: '12px', padding: '14px',
            }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#818cf8', marginBottom: '10px' }}>
                חישוב תשלום ראשון
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <Row label={`מסלול חדש (${newCycleDays} ימים)`} value={formatCurrency(newPriceNum, currency)} />
                {credit > 0 && (
                  <Row
                    label={`קרדיט על ${daysRemaining} ימים שנותרו במסלול הנוכחי`}
                    value={`− ${formatCurrency(credit, currency)}`}
                    valueColor="#22c55e"
                  />
                )}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '8px', marginTop: '2px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#f1f5f9' }}>תשלום ראשון</span>
                  <span style={{ fontSize: '15px', fontWeight: '800', color: '#a5b4fc', fontFamily: 'monospace' }}>
                    {formatCurrency(firstPayment, currency)}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                  חידוש הבא: {new Date(newRenewalDate).toLocaleDateString('he-IL')} · לאחר מכן: {formatCurrency(newPriceNum, currency)}/{newCycle === 'monthly' ? 'חודש' : newCycle === 'yearly' ? 'שנה' : `${customMonths} חודשים`}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div style={{ fontSize: '13px', color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '12px 14px', borderRadius: '10px' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', paddingBottom: '8px' }}>
            <button type="button" onClick={onClose}
              style={{
                flex: 1, padding: '14px', borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)', color: '#64748b',
                cursor: 'pointer', fontSize: '15px', fontWeight: '600',
                fontFamily: "'Heebo', sans-serif",
              }}>
              ביטול
            </button>
            <button type="button" onClick={handleSave} disabled={saving || !newPriceNum}
              style={{
                flex: 2, padding: '14px', borderRadius: '12px', border: 'none',
                background: saving || !newPriceNum ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: '#fff', cursor: saving || !newPriceNum ? 'not-allowed' : 'pointer',
                fontSize: '15px', fontWeight: '700',
                boxShadow: '0 4px 16px rgba(99,102,241,0.3)',
                fontFamily: "'Heebo', sans-serif",
                transition: 'opacity 0.15s',
              }}>
              {saving ? 'שומר...' : 'אשר שינוי מסלול'}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '12px', color: '#64748b', flex: 1, paddingLeft: '12px' }}>{label}</span>
      <span style={{ fontSize: '13px', fontWeight: '600', color: valueColor ?? '#cbd5e1', fontFamily: 'monospace', flexShrink: 0 }}>{value}</span>
    </div>
  );
}
