import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, MoreVertical, Edit2, Trash2, Receipt, ChevronDown, ArrowUpDown } from 'lucide-react';
import type { Subscription, UpdateSubscriptionPayload } from '@/types';
import { formatRenewalDate, formatDaysLabel, daysUntilRenewal, renewalUrgency } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';
import { lookupLogoUrl, toClearbitUrl, toFaviconUrl } from '@/lib/logos';
import { InvoiceModal } from './InvoiceModal';
import { PlanChangeModal } from './PlanChangeModal';
import { api } from '@/lib/api';

interface Props {
  sub: Subscription;
  onEdit: (sub: Subscription) => void;
  onCancel?: (id: number) => void;
  onUpdate?: (id: number, updates: UpdateSubscriptionPayload) => Promise<void>;
  index?: number;
}

const COMPANY_COLORS: Record<string, string> = {
  Netflix: '#E50914',
  Spotify: '#1DB954',
  Adobe: '#FF0000',
  Apple: '#555',
  Amazon: '#FF9900',
  Hulu: '#1CE783',
  GitHub: '#333',
  OpenAI: '#10a37f',
  Canva: '#00C4CC',
  Dropbox: '#0061FF',
  Notion: '#000',
  Figma: '#F24E1E',
  Zoom: '#2D8CFF',
  Slack: '#4A154B',
  Microsoft: '#00A4EF',
  Google: '#4285F4',
  YouTube: '#FF0000',
  'Disney+': '#113CCF',
  Max: '#002BE7',
  'Paramount+': '#0064FF',
};

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function getColor(name: string) {
  return COMPANY_COLORS[name] ?? '#6366f1';
}

const PLAN_TYPE_LABEL: Record<string, string> = { personal: 'פרטי', family: 'משפחתי', other: 'אחר' };

/** Extract a company homepage URL from a logo URL (clearbit or favicon). */
function getCompanyWebsite(logoUrl: string | null, companyName: string): string | null {
  const src = logoUrl || lookupLogoUrl(companyName);
  if (!src) return null;
  if (src.startsWith('https://logo.clearbit.com/')) {
    return `https://${src.replace('https://logo.clearbit.com/', '')}`;
  }
  const match = src.match(/[?&]domain=([^&]+)/);
  if (match) return `https://${match[1]}`;
  return null;
}

export function SubscriptionCard({ sub, onEdit, onCancel, onUpdate, index = 0 }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showInvoices, setShowInvoices] = useState(false);
  const [showPlanChange, setShowPlanChange] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [noCancelUrl, setNoCancelUrl] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  // 0 = try primary, 1 = try favicon fallback, 2 = show initials
  const [logoStage, setLogoStage] = useState(0);

  // Reset when subscription changes (e.g. after edit)
  useEffect(() => setLogoStage(0), [sub.id, sub.company_name, sub.logo_url]);

  const primarySrc = sub.logo_url || lookupLogoUrl(sub.company_name);

  function getLogoSrc(): string | null {
    if (logoStage === 2 || !primarySrc) return null;
    if (logoStage === 0) return primarySrc;
    // stage 1: derive domain from Clearbit URL and use Google favicon
    const domain = primarySrc.replace('https://logo.clearbit.com/', '');
    return toFaviconUrl(domain);
  }

  function handleLogoError() {
    if (logoStage === 0 && primarySrc?.startsWith('https://logo.clearbit.com/')) {
      setLogoStage(1); // try Google favicon
    } else {
      setLogoStage(2); // give up, show initials
    }
  }

  const logoSrc = getLogoSrc();
  const showLogo = logoSrc !== null;

  const days = daysUntilRenewal(sub.renewal_date);
  const urgency = renewalUrgency(sub.renewal_date);
  const color = getColor(sub.company_name);

  const urgencyColor = {
    overdue: '#ef4444',
    urgent: '#f97316',
    soon: '#eab308',
    normal: '#22c55e',
  }[urgency];

  const daysLabel = formatDaysLabel(days);

  const cycleDays = sub.billing_cycle === 'yearly' ? 365 : sub.billing_cycle === 'custom' ? (sub.custom_cycle_months ?? 1) * 30 : 30;
  const progressPct = Math.max(0, Math.min(100, 100 - (days / cycleDays) * 100));

  const formattedCost = formatCurrency(sub.cost_per_cycle, sub.currency as 'USD' | 'ILS');

  return (
    <motion.div
      className="subscription-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.22 }}
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${expanded ? 'rgba(99,102,241,0.25)' : 'var(--border)'}`,
        borderRadius: '16px',
        overflow: 'hidden',
        transition: 'border-color 0.2s',
      }}
    >
      {/* Collapsed row — always visible */}
      <div
        onClick={() => { setExpanded(e => !e); setCancelConfirm(false); setNoCancelUrl(false); }}
        style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '14px 16px', cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        {/* Logo */}
        <div className={showLogo ? 'logo-bg' : undefined} style={{
          width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
          background: showLogo ? '#fff' : `${color}22`,
          border: showLogo ? '1px solid rgba(255,255,255,0.1)' : `1px solid ${color}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '12px', fontWeight: '800', color, overflow: 'hidden',
        }}>
          {showLogo ? (
            <img src={logoSrc!} alt="" onError={handleLogoError}
              style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }} />
          ) : getInitials(sub.company_name)}
        </div>

        {/* Name + service */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-1)', lineHeight: 1.2 }}>
              {sub.company_name}
            </span>
            {!!sub.is_trial && (
              <span style={{
                fontSize: '10px', fontWeight: '700', color: '#fbbf24',
                background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)',
                borderRadius: '6px', padding: '1px 6px', flexShrink: 0,
                fontFamily: "'Heebo', sans-serif",
              }}>
                Trial
              </span>
            )}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {sub.service_name}
          </div>
        </div>

        {/* Cost */}
        <div style={{
          fontSize: '15px', fontWeight: '800', color: '#3730a3',
          fontFamily: '"JetBrains Mono", monospace', flexShrink: 0,
        }}>
          {formattedCost}
        </div>

        {/* Days badge */}
        <div style={{
          fontSize: '11px', fontWeight: '700', color: urgencyColor,
          background: `${urgencyColor}18`, border: `1px solid ${urgencyColor}33`,
          borderRadius: '8px', padding: '3px 8px', flexShrink: 0,
          fontFamily: 'monospace',
        }}>
          {daysLabel}
        </div>

        {/* Chevron */}
        <ChevronDown size={16} style={{
          color: '#475569', flexShrink: 0,
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s',
        }} />
      </div>

      {/* Expanded content */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              padding: '0 16px 16px',
              borderTop: '1px solid var(--border-faint)',
              paddingTop: '14px',
            }}>
              {/* Top color accent */}
              <div style={{
                height: '2px', marginBottom: '14px',
                background: `linear-gradient(90deg, ${color}, transparent)`,
                borderRadius: '2px',
              }} />

              {/* Header: plan badge + menu */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                {sub.plan_type && sub.plan_type !== 'personal' ? (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center',
                    padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700',
                    background: sub.plan_type === 'family' ? 'rgba(34,197,94,0.1)' : 'rgba(148,163,184,0.1)',
                    color: sub.plan_type === 'family' ? '#22c55e' : '#94a3b8',
                    border: `1px solid ${sub.plan_type === 'family' ? 'rgba(34,197,94,0.2)' : 'rgba(148,163,184,0.15)'}`,
                    fontFamily: "'Heebo', sans-serif",
                  }}>
                    {sub.plan_type === 'other' && sub.plan_type_custom ? sub.plan_type_custom : PLAN_TYPE_LABEL[sub.plan_type]}
                  </div>
                ) : <div />}

                {/* Menu */}
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={e => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#475569', padding: '6px', borderRadius: '8px', display: 'flex',
                    }}
                  >
                    <MoreVertical size={16} />
                  </button>
                  {menuOpen && (
                    <div
                      style={{
                        position: 'absolute', insetInlineEnd: 0, top: '36px', zIndex: 50,
                        background: '#fff', border: '1px solid var(--border)',
                        borderRadius: '12px', padding: '6px', minWidth: '150px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                      }}
                      onMouseLeave={() => setMenuOpen(false)}
                    >
                      <MenuBtn onClick={() => { onEdit(sub); setMenuOpen(false); setExpanded(false); }}>
                        <Edit2 size={14} /> עריכה
                      </MenuBtn>
                      {onUpdate && (
                        <MenuBtn onClick={() => { setShowPlanChange(true); setMenuOpen(false); }}>
                          <ArrowUpDown size={14} /> שנה מסלול
                        </MenuBtn>
                      )}
                      <MenuBtn danger onClick={() => { onCancel?.(sub.id); setMenuOpen(false); }}>
                        <Trash2 size={14} /> ביטלתי את המנוי
                      </MenuBtn>
                    </div>
                  )}
                </div>
              </div>

              {/* Trial info */}
              {!!sub.is_trial && (
                <div style={{
                  marginBottom: '12px', padding: '10px 14px', borderRadius: '10px',
                  background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)',
                  fontSize: '12px', color: '#fbbf24', fontFamily: "'Heebo', sans-serif",
                }}>
                  🎯 ניסיון חינם
                  {sub.trial_end_date && (
                    <span style={{ color: '#94a3b8', marginRight: '6px' }}>
                      · מסתיים {new Date(sub.trial_end_date).toLocaleDateString('he-IL')}
                    </span>
                  )}
                </div>
              )}

              {/* Cycle breakdown */}
              {sub.billing_cycle === 'yearly' && (
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '12px' }}>
                  שווה ערך ל-{formatCurrency(sub.cost, sub.currency as 'USD' | 'ILS')}/חודש
                </div>
              )}
              {sub.billing_cycle === 'custom' && (
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '12px' }}>
                  כל {sub.custom_cycle_months} חודשים · שווה ערך ל-{formatCurrency(sub.cost, sub.currency as 'USD' | 'ILS')}/חודש
                </div>
              )}

              {/* Renewal progress */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#475569' }}>מתחדש {formatRenewalDate(sub.renewal_date)}</span>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: urgencyColor }}>{daysLabel}</span>
                </div>
                <div style={{ height: '3px', background: 'rgba(99,102,241,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                  <motion.div
                    style={{ height: '100%', background: urgencyColor, borderRadius: '2px' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPct}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                </div>
              </div>

              {/* Invoices button */}
              <button
                onClick={e => { e.stopPropagation(); setShowInvoices(true); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  marginBottom: '12px',
                  background: 'rgba(99,102,241,0.08)',
                  border: '1px solid rgba(99,102,241,0.2)',
                  borderRadius: '9px',
                  cursor: 'pointer', color: '#818cf8', fontSize: '13px',
                  fontWeight: 600,
                  padding: '8px 14px', fontFamily: "'Heebo', sans-serif",
                  transition: 'background 0.15s',
                  width: '100%', justifyContent: 'center',
                }}
                onPointerEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.15)')}
                onPointerLeave={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.08)')}
              >
                <Receipt size={14} /> חשבוניות
              </button>

              {/* Cancel action */}
              {cancelConfirm ? (
                <div style={{
                  padding: '12px', borderRadius: '10px',
                  background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
                }}>
                  <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#fca5a5', fontFamily: "'Heebo', sans-serif" }}>
                    ביטלת את המנוי?
                  </p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={e => { e.stopPropagation(); onCancel?.(sub.id); setCancelConfirm(false); setExpanded(false); }}
                      style={{
                        flex: 1, padding: '8px', borderRadius: '8px', border: 'none',
                        background: 'rgba(239,68,68,0.2)', color: '#f87171',
                        cursor: 'pointer', fontSize: '13px', fontWeight: '700',
                        fontFamily: "'Heebo', sans-serif",
                      }}
                    >
                      כן, ביטלתי
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setCancelConfirm(false); }}
                      style={{
                        flex: 1, padding: '8px', borderRadius: '8px', border: 'none',
                        background: 'rgba(255,255,255,0.07)', color: '#94a3b8',
                        cursor: 'pointer', fontSize: '13px', fontWeight: '600',
                        fontFamily: "'Heebo', sans-serif",
                      }}
                    >
                      לא, עדיין פעיל
                    </button>
                  </div>
                </div>
              ) : noCancelUrl ? (
                <div style={{
                  padding: '11px', borderRadius: '10px', textAlign: 'center',
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  fontSize: '12px', color: '#475569', fontFamily: "'Heebo', sans-serif",
                }}>
                  לא הוגדר עמוד ביטול מנוי
                </div>
              ) : (
                <button
                  disabled={cancelLoading}
                  onClick={async e => {
                    e.stopPropagation();
                    setCancelLoading(true);
                    try {
                      // Always validate via server (catches stale/broken stored URLs)
                      const { url: validatedUrl } = await api.cancelUrl(sub.company_name);
                      const target = validatedUrl ?? getCompanyWebsite(sub.logo_url, sub.company_name);
                      if (target) {
                        window.open(target, '_blank', 'noopener,noreferrer');
                        setCancelConfirm(true);
                      } else {
                        setNoCancelUrl(true);
                      }
                    } catch {
                      // Fallback to stored URL if server unreachable
                      const fallback = sub.cancel_url ?? getCompanyWebsite(sub.logo_url, sub.company_name);
                      if (fallback) {
                        window.open(fallback, '_blank', 'noopener,noreferrer');
                        setCancelConfirm(true);
                      } else {
                        setNoCancelUrl(true);
                      }
                    } finally {
                      setCancelLoading(false);
                    }
                  }}
                  style={{
                    width: '100%', padding: '11px', borderRadius: '10px', fontSize: '13px', fontWeight: '600',
                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                    color: cancelLoading ? '#7f1d1d' : '#ef4444',
                    cursor: cancelLoading ? 'wait' : 'pointer',
                    fontFamily: "'Heebo', sans-serif",
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    transition: 'color 0.15s',
                  }}
                >
                  {cancelLoading ? 'בודק...' : <><ExternalLink size={13} /> בטל מנוי</>}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showInvoices && <InvoiceModal sub={sub} onClose={() => setShowInvoices(false)} />}
      {showPlanChange && onUpdate && (
        <PlanChangeModal
          sub={sub}
          onClose={() => setShowPlanChange(false)}
          onSave={async (updates) => {
            await onUpdate(sub.id, updates as Partial<Subscription>);
            setShowPlanChange(false);
          }}
        />
      )}
    </motion.div>
  );
}

function MenuBtn({ children, onClick, danger }: {
  children: React.ReactNode; onClick: () => void; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        width: '100%', padding: '10px 12px', background: 'none', border: 'none',
        cursor: 'pointer', color: danger ? '#ef4444' : 'var(--text-2)',
        fontSize: '14px', borderRadius: '8px', fontFamily: "'Heebo', sans-serif",
      }}
      onPointerEnter={e => (e.currentTarget.style.background = danger ? 'rgba(239,68,68,0.1)' : 'rgba(99,102,241,0.08)')}
      onPointerLeave={e => (e.currentTarget.style.background = 'none')}
    >
      {children}
    </button>
  );
}
