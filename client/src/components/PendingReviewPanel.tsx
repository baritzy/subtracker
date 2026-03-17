import { Mail, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Subscription } from '@/types';
import { useCurrency } from '@/hooks/useCurrency';

interface Props {
  pending: Subscription[];
  onConfirm: (id: number) => void;
  onDismiss: (id: number) => void;
}

export function PendingReviewPanel({ pending, onConfirm, onDismiss }: Props) {
  const [expanded, setExpanded] = useState(true);
  const { formatAmount } = useCurrency();
  if (pending.length === 0) return null;

  return (
    <div style={{
      background: 'rgba(99,102,241,0.06)',
      border: '1px solid rgba(99,102,241,0.2)',
      borderRadius: '16px', marginBottom: '24px',
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
          padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'right',
        }}
      >
        <div style={{ background: 'rgba(99,102,241,0.2)', borderRadius: '8px', padding: '6px', display: 'flex' }}>
          <Mail size={14} style={{ color: '#818cf8' }} />
        </div>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: '14px', fontWeight: '700', color: '#a5b4fc' }}>
            {pending.length} מנוי{pending.length !== 1 ? 'ים' : ''} זוהו מ-Gmail
          </span>
          <span style={{ fontSize: '12px', color: '#6366f1', marginInlineStart: '8px' }}>לחץ לאישור</span>
        </div>
        {expanded ? <ChevronUp size={16} style={{ color: '#6366f1' }} /> : <ChevronDown size={16} style={{ color: '#6366f1' }} />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {pending.map(sub => (
                <div key={sub.id} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px', background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#e2e8f0' }}>{sub.company_name}</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                      {formatAmount(sub.cost_per_cycle)}/{sub.billing_cycle === 'yearly' ? 'שנה' : 'חודש'}
                      {' · '}זוהה מאימייל
                    </div>
                  </div>
                  <button
                    onClick={() => onDismiss(sub.id)}
                    title="דחה"
                    style={{
                      display: 'flex', padding: '8px', borderRadius: '8px', background: 'none',
                      border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer', color: '#ef4444',
                      minWidth: '36px', minHeight: '36px', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <X size={15} />
                  </button>
                  <button
                    onClick={() => onConfirm(sub.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      padding: '8px 14px', borderRadius: '8px',
                      background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)',
                      cursor: 'pointer', color: '#22c55e', fontSize: '13px', fontWeight: '700',
                      fontFamily: "'Heebo', sans-serif", minHeight: '36px',
                    }}
                  >
                    <Check size={14} /> אישור
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
