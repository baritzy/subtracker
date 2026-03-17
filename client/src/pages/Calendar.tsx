import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { lookupLogoUrl, toFaviconUrl } from '@/lib/logos';
import { formatCurrency } from '@/lib/utils';
import type { Subscription } from '@/types';

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];
const HEBREW_DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

/** Two-stage logo with Clearbit → favicon fallback, exactly like SubscriptionCard. */
function CalendarLogo({ sub, size = 12 }: { sub: Subscription; size?: number }) {
  const [stage, setStage] = useState(0); // 0=primary, 1=favicon, 2=initials
  const primarySrc = sub.logo_url || lookupLogoUrl(sub.company_name);

  function getSrc() {
    if (!primarySrc || stage >= 2) return null;
    if (stage === 0) return primarySrc;
    const domain = primarySrc.replace('https://logo.clearbit.com/', '');
    return toFaviconUrl(domain);
  }

  function handleError() {
    if (stage === 0 && primarySrc?.startsWith('https://logo.clearbit.com/')) setStage(1);
    else setStage(2);
  }

  const src = getSrc();
  const borderRadius = size <= 14 ? '3px' : '8px';

  if (!src) {
    return (
      <div style={{
        width: size, height: size, borderRadius, flexShrink: 0,
        background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: Math.floor(size * 0.55) + 'px', fontWeight: '700', color: '#fff',
      }}>
        {sub.company_name[0]}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      onError={handleError}
      style={{ width: size, height: size, borderRadius, objectFit: 'contain', flexShrink: 0 }}
    />
  );
}

interface DayCell {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
}

export function Calendar() {
  const { subscriptions, loading } = useSubscriptions();
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // Build calendar grid (Sun=0 … Sat=6, starting Sunday)
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells: DayCell[] = [];

  // Prev month padding
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, daysInPrevMonth - i);
    cells.push({ date: d, isCurrentMonth: false, isToday: false });
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const isToday = date.toDateString() === today.toDateString();
    cells.push({ date, isCurrentMonth: true, isToday });
  }
  // Next month padding — fill to complete 6 rows
  let next = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ date: new Date(year, month + 1, next++), isCurrentMonth: false, isToday: false });
  }

  // Map renewal dates to subscriptions
  const renewalsByDay: Record<string, typeof subscriptions> = {};
  for (const sub of subscriptions) {
    if (sub.status !== 'active') continue;
    const dateKey = sub.renewal_date.slice(0, 10);
    if (!renewalsByDay[dateKey]) renewalsByDay[dateKey] = [];
    renewalsByDay[dateKey].push(sub);
  }

  // Total cost this month
  const thisMonthRenewals = Object.entries(renewalsByDay).filter(([key]) => {
    const d = new Date(key);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  function prevMonth() {
    setViewDate(new Date(year, month - 1, 1));
  }
  function nextMonth() {
    setViewDate(new Date(year, month + 1, 1));
  }
  function goToday() {
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px', color: '#475569' }}>
        טוען...
      </div>
    );
  }

  const monthlyRenewalCount = thisMonthRenewals.reduce((acc, [, subs]) => acc + subs.length, 0);

  return (
    <div>
      {/* Month navigation */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '20px',
      }}>
        <button
          onClick={prevMonth}
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px', padding: '8px 12px', cursor: 'pointer',
            color: '#94a3b8', display: 'flex', alignItems: 'center',
          }}
        >
          <ChevronRight size={18} />
        </button>

        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '18px', fontWeight: '800', color: '#f1f5f9',
            fontFamily: "'Heebo', sans-serif",
          }}>
            {HEBREW_MONTHS[month]} {year}
          </div>
          {monthlyRenewalCount > 0 && (
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              {monthlyRenewalCount} חידוש{monthlyRenewalCount !== 1 ? 'ים' : ''} החודש
            </div>
          )}
        </div>

        <button
          onClick={nextMonth}
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px', padding: '8px 12px', cursor: 'pointer',
            color: '#94a3b8', display: 'flex', alignItems: 'center',
          }}
        >
          <ChevronLeft size={18} />
        </button>
      </div>

      {/* Today button */}
      {(year !== today.getFullYear() || month !== today.getMonth()) && (
        <div style={{ textAlign: 'center', marginBottom: '14px' }}>
          <button
            onClick={goToday}
            style={{
              background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)',
              borderRadius: '8px', padding: '6px 16px', cursor: 'pointer',
              color: '#818cf8', fontSize: '13px', fontWeight: '600',
              fontFamily: "'Heebo', sans-serif",
            }}
          >
            חזרה לחודש הנוכחי
          </button>
        </div>
      )}

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
        {HEBREW_DAYS.map(d => (
          <div key={d} style={{
            textAlign: 'center', fontSize: '11px', fontWeight: '700',
            color: '#475569', padding: '6px 0',
            fontFamily: "'Heebo', sans-serif",
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {cells.map((cell, i) => {
          const key = cell.date.toISOString().slice(0, 10);
          const daySubs = renewalsByDay[key] ?? [];

          return (
            <div
              key={i}
              style={{
                minHeight: '68px',
                borderRadius: '10px',
                padding: '6px 5px',
                background: cell.isToday
                  ? 'rgba(99,102,241,0.12)'
                  : cell.isCurrentMonth
                    ? daySubs.length > 0 ? 'rgba(255,255,255,0.04)' : 'transparent'
                    : 'transparent',
                border: cell.isToday
                  ? '1px solid rgba(99,102,241,0.4)'
                  : daySubs.length > 0
                    ? '1px solid rgba(255,255,255,0.08)'
                    : '1px solid transparent',
                transition: 'border-color 0.15s',
              }}
            >
              {/* Day number */}
              <div style={{
                fontSize: '12px', fontWeight: cell.isToday ? '800' : '500',
                color: cell.isToday ? '#818cf8' : cell.isCurrentMonth ? '#94a3b8' : '#334155',
                textAlign: 'center', marginBottom: daySubs.length ? '5px' : 0,
                fontFamily: "'Heebo', sans-serif",
              }}>
                {cell.date.getDate()}
              </div>

              {/* Subscription chips */}
              {daySubs.slice(0, 3).map(sub => (
                <div key={sub.id} title={`${sub.company_name} · ${formatCurrency(sub.cost_per_cycle, sub.currency as 'USD' | 'ILS')}`} style={{
                  display: 'flex', alignItems: 'center', gap: '3px',
                  background: 'rgba(99,102,241,0.12)',
                  borderRadius: '5px', padding: '2px 4px',
                  marginBottom: '2px', overflow: 'hidden',
                }}>
                  <CalendarLogo sub={sub} size={12} />
                  <span style={{
                    fontSize: '9px', color: '#a5b4fc', fontWeight: '600',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    maxWidth: '40px', fontFamily: "'Heebo', sans-serif",
                  }}>
                    {sub.company_name}
                  </span>
                </div>
              ))}
              {daySubs.length > 3 && (
                <div style={{ fontSize: '9px', color: '#475569', textAlign: 'center' }}>
                  +{daySubs.length - 3}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Monthly summary */}
      {thisMonthRenewals.length > 0 && (
        <div style={{
          marginTop: '24px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px', padding: '16px',
        }}>
          <h3 style={{
            margin: '0 0 12px', fontSize: '14px', fontWeight: '700',
            color: '#94a3b8', fontFamily: "'Heebo', sans-serif",
          }}>
            חידושים החודש
          </h3>
          {thisMonthRenewals
            .sort(([a], [b]) => a.localeCompare(b))
            .flatMap(([, subs]) => subs)
            .map(sub => (
              <div key={sub.id} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 0',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
              }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
                  background: '#fff', border: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden',
                }}>
                  <CalendarLogo sub={sub} size={28} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#e2e8f0', fontFamily: "'Heebo', sans-serif" }}>
                    {sub.company_name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    {new Date(sub.renewal_date).toLocaleDateString('he-IL')}
                  </div>
                </div>
                <div style={{
                  fontSize: '13px', fontWeight: '700', color: '#f1f5f9',
                  fontFamily: '"JetBrains Mono", monospace', flexShrink: 0,
                }}>
                  {formatCurrency(sub.cost_per_cycle, sub.currency as 'USD' | 'ILS')}
                </div>
              </div>
            ))}
        </div>
      )}

      {monthlyRenewalCount === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>📅</div>
          <p style={{ color: '#475569', fontSize: '14px', margin: 0, fontFamily: "'Heebo', sans-serif" }}>
            אין חידושי מנויים בחודש זה
          </p>
        </div>
      )}
    </div>
  );
}
