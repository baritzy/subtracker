import { motion } from 'framer-motion';
import type { Subscription } from '@/types';
import { formatCurrency, formatDaysLabel, formatRenewalDate, daysUntilRenewal, renewalUrgency } from '@/lib/utils';

interface Props {
  subscriptions: Subscription[];
}

export function RenewalTimeline({ subscriptions }: Props) {
  const upcoming = subscriptions
    .filter(s => {
      if (s.status !== 'active') return false;
      const days = daysUntilRenewal(s.renewal_date);
      return days >= 0 && days <= 7;
    })
    .sort((a, b) => new Date(a.renewal_date).getTime() - new Date(b.renewal_date).getTime());

  if (upcoming.length === 0) return null;

  return (
    <div style={{
      background: 'rgba(234,179,8,0.06)',
      border: '1px solid rgba(234,179,8,0.2)',
      borderRadius: '12px', padding: '10px 12px', marginBottom: '16px',
    }}>
      <div style={{
        fontSize: '10px', color: '#475569',
        textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '700',
        marginBottom: '6px',
      }}>
        חידושים ב-7 ימים הקרובים
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
        {upcoming.map((sub, i) => {
          const days = daysUntilRenewal(sub.renewal_date);
          const urgency = renewalUrgency(sub.renewal_date);
          const urgencyColor = { overdue: '#ef4444', urgent: '#f97316', soon: '#eab308', normal: '#94a3b8' }[urgency];
          const daysLabel = formatDaysLabel(days);

          return (
            <motion.div
              key={sub.id}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 4px', gap: '8px',
              }}
            >
              {/* Left: dot + name + date */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: urgencyColor, flexShrink: 0 }} />
                <span style={{
                  fontSize: '12px', color: '#e2e8f0', fontWeight: '600',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {sub.company_name}
                </span>
                <span style={{ fontSize: '10px', color: '#475569', whiteSpace: 'nowrap' }}>
                  {formatRenewalDate(sub.renewal_date)}
                </span>
              </div>

              {/* Right: days + amount */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <span style={{
                  fontSize: '11px', fontWeight: '700', color: urgencyColor, fontFamily: 'monospace',
                }}>
                  {daysLabel}
                </span>
                <span style={{
                  fontSize: '12px', fontWeight: '700', color: '#f1f5f9',
                  fontFamily: '"JetBrains Mono", monospace',
                }}>
                  {formatCurrency(sub.cost_per_cycle, sub.currency as 'USD' | 'ILS')}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
