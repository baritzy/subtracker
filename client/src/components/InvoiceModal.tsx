import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Receipt } from 'lucide-react';
import type { Invoice, Subscription } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';

interface Props {
  sub: Subscription;
  onClose: () => void;
}

export function InvoiceModal({ sub, onClose }: Props) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/subscriptions/${sub.id}/invoices`)
      .then(r => r.json())
      .then(data => { setInvoices(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [sub.id]);

  const total = invoices.reduce((sum, inv) => sum + inv.amount, 0);
  const since = invoices.length > 0
    ? format(parseISO(invoices[invoices.length - 1].invoice_date), 'd MMM yyyy', { locale: he })
    : null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: '480px',
            background: '#0d1526', borderRadius: '24px 24px 0 0',
            border: '1px solid rgba(255,255,255,0.1)', borderBottom: 'none',
            padding: '24px 20px', maxHeight: '80dvh', overflowY: 'auto',
            paddingBottom: `calc(24px + max(0px, env(safe-area-inset-bottom)))`,
          }}
        >
          <div style={{ width: '36px', height: '4px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px', margin: '0 auto 20px' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: '8px', display: 'flex', borderRadius: '8px' }}>
              <X size={20} />
            </button>
            <div style={{ textAlign: 'right' }}>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#f1f5f9', fontFamily: "'Heebo', sans-serif" }}>
                חשבוניות — {sub.company_name}
              </h2>
              {since && (
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b', fontFamily: "'Heebo', sans-serif" }}>
                  סה"כ {formatCurrency(total, sub.currency)} מאז {since}
                </p>
              )}
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#475569', fontFamily: "'Heebo', sans-serif" }}>טוען...</div>
          ) : invoices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Receipt size={32} style={{ color: '#334155', marginBottom: '12px' }} />
              <p style={{ color: '#475569', fontSize: '14px', margin: 0, fontFamily: "'Heebo', sans-serif" }}>
                אין חשבוניות מזוהות עדיין
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {invoices.map(inv => (
                <div key={inv.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '14px 16px', background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px',
                }}>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#f1f5f9', fontFamily: '"JetBrains Mono", monospace' }}>
                    {formatCurrency(inv.amount, sub.currency)}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '13px', color: '#94a3b8', fontFamily: "'Heebo', sans-serif" }}>
                      {format(parseISO(inv.invoice_date), 'd MMM yyyy', { locale: he })}
                    </div>
                    <div style={{ fontSize: '11px', color: '#475569', fontFamily: "'Heebo', sans-serif" }}>
                      {inv.billing_cycle === 'yearly' ? 'שנתי' : 'חודשי'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
