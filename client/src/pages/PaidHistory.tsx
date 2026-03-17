import { motion } from 'framer-motion';
import type { Subscription } from '@/types';
import { useCurrency } from '@/hooks/useCurrency';
import { formatCurrency } from '@/lib/utils';

interface Props {
  subscriptions: Subscription[];
}

interface YearData {
  year: number;
  total: number;
  rows: { name: string; service: string; amount: number; currency: 'USD' | 'ILS'; payments: number }[];
}

function buildYearData(subscriptions: Subscription[], ilsRate: number): YearData[] {
  const now = new Date();
  // year → subscription id → { usdAmount, payments }
  const byYear: Record<number, Record<number, { name: string; service: string; usdAmount: number; currency: 'USD' | 'ILS'; costPerCycle: number; payments: number }>> = {};

  for (const s of subscriptions) {
    if (s.status !== 'active' || !s.start_date) continue;
    const start = new Date(s.start_date);
    if (isNaN(start.getTime()) || start > now) continue;

    const usdPerPayment = s.currency === 'ILS' ? s.cost_per_cycle / ilsRate : s.cost_per_cycle;

    let paymentDate = new Date(start);
    while (paymentDate <= now) {
      const yr = paymentDate.getFullYear();
      if (!byYear[yr]) byYear[yr] = {};
      if (!byYear[yr][s.id]) {
        byYear[yr][s.id] = {
          name: s.company_name,
          service: s.service_name,
          usdAmount: 0,
          currency: s.currency,
          costPerCycle: s.cost_per_cycle,
          payments: 0,
        };
      }
      byYear[yr][s.id].usdAmount += usdPerPayment;
      byYear[yr][s.id].payments += 1;

      const monthsToAdd = s.billing_cycle === 'monthly' ? 1
        : s.billing_cycle === 'custom' ? (s.custom_cycle_months ?? 1)
        : 12;
      paymentDate = new Date(paymentDate.getFullYear(), paymentDate.getMonth() + monthsToAdd, paymentDate.getDate());
    }
  }

  return Object.entries(byYear)
    .map(([year, subs]) => {
      const rows = Object.values(subs);
      const total = rows.reduce((s, r) => s + r.usdAmount, 0);
      return {
        year: Number(year),
        total,
        rows: rows.map(r => ({
          name: r.name,
          service: r.service,
          amount: r.usdAmount,
          currency: r.currency,
          payments: r.payments,
        })),
      };
    })
    .sort((a, b) => b.year - a.year); // newest first
}

export function PaidHistory({ subscriptions }: Props) {
  const { formatAmount, ilsRate } = useCurrency();
  const years = buildYearData(subscriptions, ilsRate);
  const grandTotal = years.reduce((s, y) => s + y.total, 0);

  if (years.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: '40px', marginBottom: '14px' }}>📂</div>
        <p style={{ color: '#475569', fontSize: '15px' }}>
          אין נתוני תשלום עדיין
        </p>
        <p style={{ color: '#334155', fontSize: '13px', marginTop: '8px' }}>
          הוסף תאריך התחלה למנויים שלך כדי לראות כאן את ההיסטוריה
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Grand total */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))',
        border: '1px solid rgba(99,102,241,0.25)',
        borderRadius: '16px', padding: '20px',
      }}>
        <div style={{ fontSize: '12px', color: '#818cf8', fontWeight: '700', marginBottom: '6px', letterSpacing: '0.05em' }}>
          סה"כ שולם (כל הזמנים)
        </div>
        <div style={{
          fontSize: '32px', fontWeight: '800', color: '#f8fafc',
          fontFamily: '"JetBrains Mono", monospace', letterSpacing: '-1px',
        }}>
          {formatAmount(grandTotal)}
        </div>
        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
          על פני {years.length} שנה{years.length > 1 ? 'ים' : ''}
        </div>
      </div>

      {/* Yearly cards */}
      {years.map((yr, i) => (
        <motion.div
          key={yr.year}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07 }}
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px', overflow: 'hidden',
          }}
        >
          {/* Year header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.02)',
          }}>
            <span style={{ fontSize: '16px', fontWeight: '800', color: '#f1f5f9', fontFamily: "'Heebo', sans-serif" }}>
              {yr.year}
            </span>
            <span style={{
              fontSize: '16px', fontWeight: '800', color: '#a5b4fc',
              fontFamily: '"JetBrains Mono", monospace',
            }}>
              {formatAmount(yr.total)}
            </span>
          </div>

          {/* Rows per subscription */}
          <div style={{ padding: '8px 0' }}>
            {yr.rows.map((row, j) => (
              <div
                key={`${row.name}-${j}`}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 16px', gap: '12px',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: '13px', fontWeight: '600', color: '#e2e8f0',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {row.name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#475569' }}>
                    {row.payments} תשלום{row.payments > 1 ? 'ים' : ''}
                  </div>
                </div>
                <span style={{
                  fontSize: '13px', fontWeight: '700', color: '#94a3b8',
                  fontFamily: '"JetBrains Mono", monospace', flexShrink: 0,
                }}>
                  {formatAmount(row.amount)}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
