import { useState } from 'react';
import { Search, History as HistoryIcon, CalendarDays, FlaskConical } from 'lucide-react';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { SubscriptionCard } from '@/components/SubscriptionCard';
import { SubscriptionForm } from '@/components/SubscriptionForm';
import { CostSummary } from '@/components/CostSummary';
import { RenewalTimeline } from '@/components/RenewalTimeline';
import { PendingReviewPanel } from '@/components/PendingReviewPanel';
import type { Subscription, CreateSubscriptionPayload } from '@/types';

interface Props {
  onOpenAdd: () => void;
  fabOpen: boolean;
  onFabClose: () => void;
  onNavigate: (page: 'history' | 'calendar' | 'trials') => void;
}

export function Dashboard({ fabOpen, onFabClose, onNavigate }: Props) {
  const { subscriptions, loading, error, create, update, cancel, confirm, dismiss } = useSubscriptions();

  const [editTarget, setEditTarget] = useState<Subscription | null>(null);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<'all' | 'personal' | 'family'>('all');

  const pending = subscriptions.filter(s => s.status === 'pending');

  const active = subscriptions.filter(s => {
    if (s.status !== 'active') return false;
    if (planFilter !== 'all') return s.plan_type === planFilter;
    return true;
  });

  const filtered = active.filter(s =>
    s.company_name.toLowerCase().includes(search.toLowerCase()) ||
    s.service_name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleSave(payload: CreateSubscriptionPayload) {
    if (editTarget) {
      await update(editTarget.id, payload);
    } else {
      await create(payload);
    }
    setEditTarget(null);
  }

  function handleEdit(sub: Subscription) {
    setEditTarget(sub);
  }

  function handleCancel(id: number) {
    void cancel(id);
  }

  if (error) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>
        <p>שגיאה: {error}</p>
        <p style={{ fontSize: '13px', color: '#64748b' }}>ודא שהשרת רץ על פורט 3001.</p>
      </div>
    );
  }

  const navBtnStyle: React.CSSProperties = {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
    padding: '10px 0',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    cursor: 'pointer',
    color: 'var(--text-3)',
    fontSize: '14px',
    fontWeight: 600,
    fontFamily: "'Heebo', sans-serif",
    transition: 'background 0.15s, color 0.15s',
  };

  return (
    <div>
      {/* Nav buttons row */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          style={navBtnStyle}
          onClick={() => onNavigate('history')}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-card-hover)'; e.currentTarget.style.color = 'var(--text-2)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.color = 'var(--text-3)'; }}
        >
          <HistoryIcon size={14} /> היסטוריה
        </button>
        <button
          style={navBtnStyle}
          onClick={() => onNavigate('calendar')}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-card-hover)'; e.currentTarget.style.color = 'var(--text-2)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.color = 'var(--text-3)'; }}
        >
          <CalendarDays size={14} /> יומן
        </button>
        <button
          style={navBtnStyle}
          onClick={() => onNavigate('trials')}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-card-hover)'; e.currentTarget.style.color = 'var(--text-2)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.color = 'var(--text-3)'; }}
        >
          <FlaskConical size={14} /> Trials
        </button>
      </div>

      {/* Pending Gmail subscriptions */}
      <PendingReviewPanel pending={pending} onConfirm={confirm} onDismiss={dismiss} />

      {/* Stats */}
      <CostSummary subscriptions={subscriptions} planFilter={planFilter} onPlanFilter={setPlanFilter} />

      {/* Upcoming renewals */}
      <RenewalTimeline subscriptions={subscriptions} />

      {/* Search row — between timeline and cards */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{
            position: 'absolute', insetInlineStart: '12px', top: '50%',
            transform: 'translateY(-50%)', color: '#475569', pointerEvents: 'none',
          }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="חיפוש..."
            style={{
              paddingInlineStart: '34px', paddingInlineEnd: '12px',
              paddingTop: '9px', paddingBottom: '9px',
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: '10px', color: 'var(--text-1)', fontSize: '14px', outline: 'none',
              width: '100%', fontFamily: "'Heebo', sans-serif",
            }}
          />
        </div>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              height: '200px', borderRadius: '18px',
              background: 'var(--bg-card)', border: '1px solid var(--border-faint)',
              animation: 'pulse 1.5s ease infinite',
            }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '44px', marginBottom: '14px' }}>📭</div>
          <p style={{ color: '#475569', fontSize: '15px', margin: 0 }}>
            {search ? 'לא נמצאו מנויים תואמים.' : 'אין מנויים פעילים עדיין.'}
          </p>
          {!search && (
            <p style={{ color: '#334155', fontSize: '13px', marginTop: '8px' }}>
              לחץ על כפתור ה-+ להוספת מנוי ראשון
            </p>
          )}
        </div>
      ) : (
        <div className="cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
          {filtered.map((sub, i) => (
            <SubscriptionCard
              key={sub.id}
              sub={sub}
              index={i}
              onEdit={handleEdit}
              onCancel={handleCancel}
              onUpdate={async (id, updates) => { await update(id, updates); }}
            />
          ))}
        </div>
      )}

      {/* Form — opens from FAB or edit */}
      <SubscriptionForm
        open={fabOpen || editTarget !== null}
        onClose={() => { onFabClose(); setEditTarget(null); }}
        onSave={handleSave}
        initial={editTarget}
      />
    </div>
  );
}
