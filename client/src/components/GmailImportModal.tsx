import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import type { Subscription } from '@/types';

interface Props {
  open: boolean;
  subscriptions: Subscription[]; // pending subscriptions found
  onClose: () => void;
  onImported: () => void; // refresh after import
}

export function GmailImportModal({ open, subscriptions, onClose, onImported }: Props) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set(subscriptions.map(s => s.id)));
  const [importing, setImporting] = useState(false);

  // Reset selection when subscriptions change
  // (use key on parent to remount instead)

  const toggle = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      // Confirm selected, delete unselected
      const toConfirm = subscriptions.filter(s => selected.has(s.id));
      const toDelete = subscriptions.filter(s => !selected.has(s.id));
      await Promise.all([
        ...toConfirm.map(s => api.subscriptions.confirm(s.id)),
        ...toDelete.map(s => api.subscriptions.delete(s.id)),
      ]);
      onImported();
      onClose();
    } finally {
      setImporting(false);
    }
  };

  const handleClose = async () => {
    // Delete all pending (user dismissed)
    try {
      await Promise.all(subscriptions.map(s => api.subscriptions.delete(s.id)));
    } catch { /* ignore */ }
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={handleClose}
            style={{ position: 'fixed', inset: 0, zIndex: 110, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
          />
          <motion.div
            key="sheet"
            initial={{ y: '100%', opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 111,
              background: '#0d1526',
              borderRadius: '24px 24px 0 0',
              border: '1px solid rgba(255,255,255,0.1)',
              borderBottom: 'none',
              maxHeight: '85vh',
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 -24px 80px rgba(0,0,0,0.6)',
            }}
          >
            {/* Handle */}
            <div style={{ padding: '16px 20px 0', flexShrink: 0 }}>
              <div style={{ width: '36px', height: '4px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px', margin: '0 auto 16px' }} />

              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: '4px' }}>
                  <X size={20} />
                </button>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '17px', fontWeight: 800, color: '#f1f5f9', fontFamily: "'Heebo', sans-serif" }}>
                    מנויים שנמצאו
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontFamily: "'Heebo', sans-serif" }}>
                    {subscriptions.length > 0 ? `נמצאו ${subscriptions.length} מנויים ב-Gmail` : ''}
                  </div>
                </div>
                <div style={{ width: 28 }} />
              </div>

              {/* Select all toggle */}
              {subscriptions.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-start', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <button
                    onClick={() => {
                      if (selected.size === subscriptions.length) setSelected(new Set());
                      else setSelected(new Set(subscriptions.map(s => s.id)));
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#6366f1', fontFamily: "'Heebo', sans-serif", fontWeight: 600, padding: 0 }}
                  >
                    {selected.size === subscriptions.length ? 'בטל הכל' : 'בחר הכל'}
                  </button>
                </div>
              )}
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px' }}>
              {subscriptions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
                  <p style={{ color: '#64748b', fontSize: '15px', margin: '0 0 20px', fontFamily: "'Heebo', sans-serif" }}>
                    לא נמצאו מנויים ב-Gmail
                  </p>
                  <button
                    onClick={onClose}
                    style={{
                      padding: '10px 24px', borderRadius: '10px', border: 'none',
                      background: 'rgba(255,255,255,0.08)', color: '#94a3b8',
                      fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                      fontFamily: "'Heebo', sans-serif",
                    }}
                  >
                    סגור
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '8px' }}>
                  {subscriptions.map(sub => {
                    const isSelected = selected.has(sub.id);
                    return (
                      <div
                        key={sub.id}
                        onClick={() => toggle(sub.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          padding: '12px 14px',
                          borderRadius: '12px',
                          border: `1px solid ${isSelected ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.07)'}`,
                          background: isSelected ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          direction: 'rtl',
                        }}
                      >
                        {/* Checkbox */}
                        <div style={{
                          width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0,
                          border: `2px solid ${isSelected ? '#6366f1' : 'rgba(255,255,255,0.2)'}`,
                          background: isSelected ? '#6366f1' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s',
                        }}>
                          {isSelected && <Check size={13} color="#fff" strokeWidth={3} />}
                        </div>

                        {/* Logo */}
                        {sub.logo_url ? (
                          <img src={sub.logo_url} alt="" style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'contain', background: '#fff', padding: '3px', flexShrink: 0 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>
                            {sub.company_name[0]}
                          </div>
                        )}

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', fontFamily: "'Heebo', sans-serif" }}>{sub.company_name}</div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px', fontFamily: "'Heebo', sans-serif" }}>
                            חידוש: {sub.renewal_date ? format(parseISO(sub.renewal_date), 'd MMM yyyy', { locale: he }) : '—'}
                          </div>
                        </div>

                        {/* Cost */}
                        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '14px', fontWeight: 700, color: '#94a3b8', flexShrink: 0 }}>
                          {sub.cost > 0 ? formatCurrency(sub.cost) : '—'}/חו׳
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bottom actions */}
            {subscriptions.length > 0 && (
              <div style={{
                padding: '12px 20px',
                paddingBottom: `max(16px, env(safe-area-inset-bottom, 16px))`,
                borderTop: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', gap: '10px', flexShrink: 0,
                background: '#0d1526',
              }}>
                <button
                  onClick={handleClose}
                  disabled={importing}
                  style={{
                    flex: 1, padding: '13px', borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(255,255,255,0.04)', color: '#64748b',
                    cursor: 'pointer', fontSize: '14px', fontWeight: 600,
                    fontFamily: "'Heebo', sans-serif",
                  }}
                >
                  ביטול
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing || selected.size === 0}
                  style={{
                    flex: 2, padding: '13px', borderRadius: '12px', border: 'none',
                    background: selected.size === 0 ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: '#fff', cursor: selected.size === 0 ? 'default' : 'pointer',
                    fontSize: '14px', fontWeight: 700,
                    boxShadow: '0 4px 16px rgba(99,102,241,0.3)',
                    fontFamily: "'Heebo', sans-serif",
                    opacity: importing ? 0.7 : 1,
                  }}
                >
                  {importing ? 'מייבא...' : selected.size === subscriptions.length ? 'ייבא את כולם' : `ייבא ${selected.size} נבחרים`}
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
