import { useState } from 'react';
import { motion } from 'framer-motion';
import { CreditCard } from 'lucide-react';
import type { Subscription } from '@/types';
import { useCurrency } from '@/hooks/useCurrency';

interface Props {
  subscriptions: Subscription[];
  planFilter: 'all' | 'personal' | 'family';
  onPlanFilter: (f: 'all' | 'personal' | 'family') => void;
}

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#3b82f6', '#ef4444', '#14b8a6',
  '#f97316', '#a855f7',
];

function DonutChart({ subscriptions, ilsRate, formatAmount }: {
  subscriptions: Subscription[];
  ilsRate: number;
  formatAmount: (n: number) => string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  const items = subscriptions.map((s, i) => ({
    sub: s,
    monthly: s.currency === 'ILS' ? s.cost / ilsRate : s.cost,
    color: COLORS[i % COLORS.length],
  }));

  const total = items.reduce((sum, i) => sum + i.monthly, 0);
  if (total === 0) return null;

  const SIZE = 180;
  const R = 70;
  const INNER_R = 44;
  const cx = SIZE / 2;
  const cy = SIZE / 2;

  // Build arc paths
  let angle = -Math.PI / 2;
  const arcs = items.map(item => {
    const slice = (item.monthly / total) * 2 * Math.PI;
    const startAngle = angle;
    const endAngle = angle + slice;
    angle = endAngle;

    const x1 = cx + R * Math.cos(startAngle);
    const y1 = cy + R * Math.sin(startAngle);
    const x2 = cx + R * Math.cos(endAngle);
    const y2 = cy + R * Math.sin(endAngle);
    const ix1 = cx + INNER_R * Math.cos(startAngle);
    const iy1 = cy + INNER_R * Math.sin(startAngle);
    const ix2 = cx + INNER_R * Math.cos(endAngle);
    const iy2 = cy + INNER_R * Math.sin(endAngle);
    const large = slice > Math.PI ? 1 : 0;

    const d = [
      `M ${x1} ${y1}`,
      `A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`,
      `L ${ix2} ${iy2}`,
      `A ${INNER_R} ${INNER_R} 0 ${large} 0 ${ix1} ${iy1}`,
      'Z',
    ].join(' ');

    return { ...item, d, midAngle: startAngle + slice / 2 };
  });

  const hoveredItem = hovered !== null ? arcs[hovered] : null;

  // helper: lighten/darken hex color
  function adjustColor(hex: string, amount: number) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.max(0, (n >> 16) + amount));
    const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amount));
    const b = Math.min(255, Math.max(0, (n & 0xff) + amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
      <div style={{ position: 'relative', width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} style={{ filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.5))' }}>
          <defs>
            {arcs.map((arc, i) => (
              <radialGradient key={i} id={`grad-${i}`} cx="35%" cy="30%" r="70%">
                <stop offset="0%" stopColor={adjustColor(arc.color, 70)} />
                <stop offset="50%" stopColor={arc.color} />
                <stop offset="100%" stopColor={adjustColor(arc.color, -60)} />
              </radialGradient>
            ))}
            {/* inner shadow ring */}
            <radialGradient id="inner-shadow" cx="50%" cy="50%" r="50%">
              <stop offset="70%" stopColor="transparent" />
              <stop offset="100%" stopColor="rgba(0,0,0,0.4)" />
            </radialGradient>
            {/* top highlight */}
            <radialGradient id="top-shine" cx="40%" cy="25%" r="55%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>

          {arcs.map((arc, i) => {
            const isHovered = hovered === i;
            const scale = isHovered ? 1.06 : 1;
            const tx = cx * (1 - scale);
            const ty = cy * (1 - scale);
            return (
              <path
                key={arc.sub.id}
                d={arc.d}
                fill={`url(#grad-${i})`}
                opacity={hovered !== null && !isHovered ? 0.35 : 1}
                transform={`translate(${tx}, ${ty}) scale(${scale})`}
                style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                onTouchStart={() => setHovered(i)}
                onTouchEnd={() => setTimeout(() => setHovered(null), 1200)}
              />
            );
          })}

          {/* shine overlay */}
          <circle cx={cx} cy={cy} r={R} fill="url(#top-shine)" pointerEvents="none" />
          {/* inner shadow */}
          <circle cx={cx} cy={cy} r={INNER_R + 4} fill="url(#inner-shadow)" pointerEvents="none" />
          {/* gap between slices */}
          <circle cx={cx} cy={cy} r={INNER_R} fill="#0f172a" pointerEvents="none" />
          {/* inner ring highlight */}
          <circle cx={cx} cy={cy} r={INNER_R} fill="none"
            stroke="rgba(255,255,255,0.08)" strokeWidth="1" pointerEvents="none" />
        </svg>

        {/* Center label */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center', pointerEvents: 'none',
          width: INNER_R * 2 - 8,
        }}>
          {hoveredItem ? (
            <>
              <div style={{ fontSize: '9px', color: hoveredItem.color, fontWeight: '700', lineHeight: 1.2, wordBreak: 'break-word' }}>
                {hoveredItem.sub.company_name}
              </div>
              <div style={{ fontSize: '11px', color: '#f8fafc', fontWeight: '800', fontFamily: '"JetBrains Mono", monospace', marginTop: '2px' }}>
                {formatAmount(hoveredItem.monthly)}
              </div>
              <div style={{ fontSize: '9px', color: '#64748b', marginTop: '1px' }}>
                {Math.round((hoveredItem.monthly / total) * 100)}%
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: '9px', color: '#64748b', fontWeight: '600' }}>חודשי</div>
              <div style={{ fontSize: '13px', color: '#f8fafc', fontWeight: '800', fontFamily: '"JetBrains Mono", monospace' }}>
                {formatAmount(total)}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '6px 10px',
        justifyContent: 'center', maxWidth: '260px',
      }}>
        {arcs.map((arc, i) => (
          <div
            key={arc.sub.id}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            onTouchStart={() => setHovered(i)}
            onTouchEnd={() => setTimeout(() => setHovered(null), 1200)}
          >
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: arc.color, flexShrink: 0,
              opacity: hovered !== null && hovered !== i ? 0.35 : 1,
              transition: 'opacity 0.15s',
            }} />
            <span style={{
              fontSize: '10px', color: hovered === i ? '#f8fafc' : '#94a3b8',
              fontWeight: hovered === i ? '700' : '400',
              transition: 'all 0.15s', whiteSpace: 'nowrap',
            }}>
              {arc.sub.company_name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CostSummary({ subscriptions, planFilter, onPlanFilter }: Props) {
  const { currency, setCurrency, formatAmount, ilsRate } = useCurrency();
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');

  const active = subscriptions.filter(s => {
    if (s.status !== 'active') return false;
    if (planFilter === 'all') return true;
    return s.plan_type === planFilter;
  });
  const monthly = active.reduce((sum, s) => {
    const usd = s.currency === 'ILS' ? s.cost / ilsRate : s.cost;
    return sum + usd;
  }, 0);
  const yearly = monthly * 12;

  return (
    <div style={{ marginBottom: '20px' }}>
      {/* Currency toggle */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
        <div style={{
          display: 'inline-flex', background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '3px',
        }}>
          {(['USD', 'ILS'] as const).map(c => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              style={{
                padding: '5px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                fontSize: '12px', fontWeight: '700', fontFamily: "'Heebo', sans-serif",
                background: currency === c ? 'rgba(99,102,241,0.3)' : 'transparent',
                color: currency === c ? '#a5b4fc' : '#475569',
                transition: 'all 0.15s',
              }}
            >
              {c === 'USD' ? '$ USD' : '₪ ILS'}
            </button>
          ))}
        </div>
      </div>

      {/* Combined card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px', padding: '16px',
          position: 'relative', overflow: 'hidden',
        }}
      >
        <div style={{
          position: 'absolute', top: '-16px', insetInlineEnd: '-16px',
          width: '80px', height: '80px', borderRadius: '50%',
          background: 'rgba(99,102,241,0.18)', filter: 'blur(20px)',
          pointerEvents: 'none',
        }} />

        {/* Plan filter */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
          {(['all', 'personal', 'family'] as const).map(p => (
            <button key={p} onClick={() => onPlanFilter(p)} style={{
              flex: 1, padding: '6px 4px', borderRadius: '8px', border: 'none',
              cursor: 'pointer', fontSize: '11px', fontWeight: '700',
              fontFamily: "'Heebo', sans-serif",
              background: planFilter === p ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)',
              color: planFilter === p ? '#a5b4fc' : '#475569',
              outline: planFilter === p ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.06)',
              transition: 'all 0.15s',
            }}>
              {p === 'all' ? 'סה"כ' : p === 'personal' ? 'פרטי' : 'משפחתי'}
            </button>
          ))}
        </div>

        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CreditCard size={14} style={{ color: '#6366f1' }} />
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>הוצאה</span>
          </div>
          <div style={{
            display: 'inline-flex', background: 'rgba(255,255,255,0.06)',
            borderRadius: '8px', padding: '2px',
          }}>
            {(['monthly', 'yearly'] as const).map(c => (
              <button key={c} onClick={() => setCycle(c)} style={{
                padding: '4px 12px', borderRadius: '6px', border: 'none',
                cursor: 'pointer', fontSize: '11px', fontWeight: '700',
                fontFamily: "'Heebo', sans-serif",
                background: cycle === c ? 'rgba(99,102,241,0.4)' : 'transparent',
                color: cycle === c ? '#a5b4fc' : '#475569',
                transition: 'all 0.15s',
              }}>
                {c === 'monthly' ? 'חודשי' : 'שנתי (צפי)'}
              </button>
            ))}
          </div>
        </div>

        {/* Amount */}
        <div style={{
          fontSize: '28px', fontWeight: '800', color: '#f8fafc',
          fontFamily: '"JetBrains Mono", monospace', letterSpacing: '-1px', lineHeight: 1,
        }}>
          {formatAmount(cycle === 'monthly' ? monthly : yearly)}
        </div>
        <div style={{ fontSize: '11px', color: '#475569', marginTop: '6px', marginBottom: '16px' }}>
          {cycle === 'monthly'
            ? `${active.length} מנוי${active.length !== 1 ? 'ם' : ''} פעיל${active.length !== 1 ? 'ים' : ''}`
            : 'הוצאה שנתית משוערת'}
        </div>

        {/* Divider */}
        {active.length > 0 && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginBottom: '16px' }} />
        )}

        {/* Donut */}
        {active.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <DonutChart subscriptions={active} ilsRate={ilsRate} formatAmount={formatAmount} />
          </div>
        )}
      </motion.div>
    </div>
  );
}
