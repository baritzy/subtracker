import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Upload } from 'lucide-react';
import type { Subscription, CreateSubscriptionPayload } from '@/types';
import { api } from '@/lib/api';
import { lookupLogoUrl, toFaviconUrl } from '@/lib/logos';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (payload: CreateSubscriptionPayload) => Promise<void>;
  initial?: Subscription | null;
}

/** If name contains Hebrew, translate to English via free MyMemory API. */
async function translateToEnglish(text: string): Promise<string> {
  if (!/[\u05D0-\u05EA]/.test(text)) return text; // not Hebrew
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=he|en`
    );
    const data = await res.json();
    const translated: string = data?.responseData?.translatedText ?? text;
    // MyMemory sometimes returns ALL CAPS — normalize to title case
    return translated.charAt(0).toUpperCase() + translated.slice(1).toLowerCase();
  } catch {
    return text;
  }
}

const EMPTY: CreateSubscriptionPayload = {
  company_name: '',
  service_name: '',
  cost: 0,
  billing_cycle: 'monthly',
  cost_per_cycle: 0,
  custom_cycle_months: undefined,
  renewal_date: '',
  start_date: '',
  cancel_url: '',
  logo_url: '',
  notes: '',
  plan_type: 'personal',
  plan_type_custom: '',
  currency: 'USD',
  is_trial: false,
  trial_end_date: '',
};

function toISODate(d: Date) {
  return d.toISOString().split('T')[0];
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

export function SubscriptionForm({ open, onClose, onSave, initial }: Props) {
  const [form, setForm] = useState<CreateSubscriptionPayload>(() => {
    if (!initial) {
      const saved = sessionStorage.getItem('formDraft');
      if (saved) { try { return JSON.parse(saved); } catch {} }
    }
    return EMPTY;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [lookingUpUrl, setLookingUpUrl] = useState(false);
  const [logoStage, setLogoStage] = useState(0); // 0=clearbit, 1=favicon, 2=failed
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Tracks which company name the current cancel_url / logo was looked up for
  const cancelUrlForRef = useRef<string>('');
  const logoForRef = useRef<string>('');

  // Save draft to sessionStorage whenever form changes (only for new subscriptions)
  useEffect(() => {
    if (!initial && open) {
      sessionStorage.setItem('formDraft', JSON.stringify(form));
    }
  }, [form, initial, open]);

  useEffect(() => {
    if (initial) {
      setForm({
        company_name: initial.company_name,
        service_name: initial.service_name,
        cost: initial.cost,
        billing_cycle: initial.billing_cycle,
        cost_per_cycle: initial.cost_per_cycle,
        custom_cycle_months: initial.custom_cycle_months ?? undefined,
        renewal_date: initial.renewal_date,
        start_date: initial.start_date ?? '',
        cancel_url: initial.cancel_url ?? '',
        logo_url: initial.logo_url ?? '',
        notes: initial.notes ?? '',
        plan_type: initial.plan_type ?? 'personal',
        plan_type_custom: initial.plan_type_custom ?? '',
        currency: initial.currency ?? 'USD',
        is_trial: !!initial.is_trial,
        trial_end_date: initial.trial_end_date ?? '',
      });
    } else {
      const next = new Date();
      next.setMonth(next.getMonth() + 1);
      setForm({ ...EMPTY, renewal_date: toISODate(next) });
    }
    setError('');
    setLogoStage(0);
    cancelUrlForRef.current = initial?.company_name ?? '';
    logoForRef.current = initial?.company_name ?? '';
  }, [initial, open]);

  function handleCostChange(value: number, cycle?: 'monthly' | 'yearly' | 'custom', customMonths?: number) {
    const bc = cycle ?? form.billing_cycle;
    const months = bc === 'yearly' ? 12 : bc === 'custom' ? (customMonths ?? form.custom_cycle_months ?? 1) : 1;
    const monthly = parseFloat((value / months).toFixed(2));
    setForm(f => ({ ...f, cost_per_cycle: value, cost: monthly, billing_cycle: bc }));
  }

  async function handleCompanyBlur() {
    const name = form.company_name.trim();
    if (!name) return;

    const nameChanged = name.toLowerCase() !== cancelUrlForRef.current.toLowerCase();
    const logoNameChanged = name.toLowerCase() !== logoForRef.current.toLowerCase();

    // Translate Hebrew to English for lookups (uses hardcoded map first, then API)
    const lookupName = await translateToEnglish(name);

    // Auto-fetch logo if not already set OR if name changed
    if (!form.logo_url || logoNameChanged) {
      logoForRef.current = name;
      // 1. Try local lookup (handles both Hebrew & English names)
      const localLogo = lookupLogoUrl(name) ?? lookupLogoUrl(lookupName);
      if (localLogo) {
        setLogoStage(0);
        setForm(f => ({ ...f, logo_url: localLogo }));
      } else {
        // 2. Search via Clearbit Autocomplete using English name
        try {
          const { logo } = await api.logoSearch(lookupName);
          setLogoStage(0);
          setForm(f => ({ ...f, logo_url: logo ?? '' }));
        } catch {}
      }
    }

    // Re-fetch cancel URL if name changed or not yet set
    if (!form.cancel_url || nameChanged) {
      setLookingUpUrl(true);
      if (nameChanged) setForm(f => ({ ...f, cancel_url: '' }));
      try {
        // Try original name first (handles Hebrew in server map), then English translation
        const { url } = await api.cancelUrl(name);
        cancelUrlForRef.current = name;
        if (url) {
          setForm(f => ({ ...f, cancel_url: url }));
        } else if (lookupName !== name) {
          const { url: urlEn } = await api.cancelUrl(lookupName);
          cancelUrlForRef.current = name;
          setForm(f => ({ ...f, cancel_url: urlEn ?? '' }));
        } else {
          cancelUrlForRef.current = name;
          setForm(f => ({ ...f, cancel_url: '' }));
        }
      } catch {
        cancelUrlForRef.current = name;
      }
      setLookingUpUrl(false);
    }
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setLogoStage(0);
      setForm(f => ({ ...f, logo_url: dataUrl }));
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.company_name.trim() || !form.service_name.trim() || !form.renewal_date) {
      setError('חברה, שירות ותאריך חידוש הם שדות חובה.');
      return;
    }
    setSaving(true);
    try {
      await onSave(form);
      sessionStorage.removeItem('formDraft');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  }

  const planTypeLabel = form.plan_type === 'personal' ? 'פרטי' : form.plan_type === 'family' ? 'משפחתי' : 'אחר';

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0, zIndex: 100,
              background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
            }}
          />

          <motion.div
            key="sheet"
            initial={{ y: '100%', opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 101,
              background: '#0d1526',
              borderRadius: '24px 24px 0 0',
              border: '1px solid rgba(255,255,255,0.1)',
              borderBottom: 'none',
              padding: '24px 20px 0',
              height: '90vh',
              overflowY: 'scroll',
              WebkitOverflowScrolling: 'touch',
              boxShadow: '0 -24px 80px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{
              width: '36px', height: '4px', background: 'rgba(255,255,255,0.15)',
              borderRadius: '2px', margin: '0 auto 20px',
            }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <button onClick={onClose} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#475569', padding: '8px', display: 'flex', borderRadius: '8px',
              }}>
                <X size={20} />
              </button>
              <h2 style={{
                margin: 0, fontSize: '18px', fontWeight: '800', color: '#f1f5f9',
                fontFamily: "'Heebo', sans-serif",
              }}>
                {initial ? 'עריכת מנוי' : 'הוספת מנוי'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* Logo preview + upload */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: '56px', height: '56px', borderRadius: '14px', flexShrink: 0,
                    background: 'rgba(255,255,255,0.06)', border: '2px dashed rgba(255,255,255,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', overflow: 'hidden', position: 'relative',
                    transition: 'border-color 0.15s',
                  }}
                  title="לחץ להעלאת לוגו"
                >
                  {form.logo_url && logoStage < 2 ? (() => {
                    const isClearbit = form.logo_url.startsWith('https://logo.clearbit.com/');
                    const domain = isClearbit ? form.logo_url.replace('https://logo.clearbit.com/', '') : null;
                    const src = logoStage === 1 && domain ? toFaviconUrl(domain) : form.logo_url;
                    return (
                      <img
                        src={src}
                        alt=""
                        onError={() => {
                          if (logoStage === 0 && isClearbit) setLogoStage(1);
                          else setLogoStage(2);
                        }}
                        style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '6px' }}
                      />
                    );
                  })() : (
                    <Upload size={18} style={{ color: '#475569' }} />
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleLogoUpload}
                />
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '3px' }}>
                    {form.logo_url && logoStage < 2 ? 'לוגו נמצא — לחץ לשינוי' : 'לוגו ימולא אוטומטית לאחר הזנת שם החברה'}
                  </div>
                  {form.logo_url && logoStage < 2 && (
                    <button
                      type="button"
                      onClick={() => { setForm(f => ({ ...f, logo_url: '' })); setLogoStage(0); }}
                      style={{ fontSize: '11px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: "'Heebo', sans-serif" }}
                    >
                      הסר לוגו
                    </button>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <Field label="חברה">
                  <input
                    style={fieldStyle}
                    value={form.company_name}
                    onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                    onBlur={handleCompanyBlur}
                    placeholder="Netflix"
                    required
                    onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.6)')}
                  />
                </Field>
                <Field label="שם השירות">
                  <input
                    style={fieldStyle}
                    value={form.service_name}
                    onChange={e => setForm(f => ({ ...f, service_name: e.target.value }))}
                    placeholder="סטרימינג"
                    required
                    onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.6)')}
                    onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
                  />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <Field label="מחיר">
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      style={{ ...fieldStyle, flex: 1, minWidth: 0 }}
                      type="number" min="0" step="0.01"
                      value={form.cost_per_cycle || ''}
                      onChange={e => handleCostChange(parseFloat(e.target.value) || 0)}
                      placeholder="9.99"
                      required
                      onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.6)')}
                      onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
                    />
                    <div style={{
                      display: 'flex', flexDirection: 'column', gap: '3px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
                      padding: '3px', flexShrink: 0,
                    }}>
                      {(['USD', 'ILS'] as const).map(c => (
                        <button key={c} type="button"
                          onClick={() => setForm(f => ({ ...f, currency: c }))}
                          style={{
                            padding: '4px 7px', borderRadius: '7px', border: 'none',
                            cursor: 'pointer', fontSize: '11px', fontWeight: '700',
                            fontFamily: "'Heebo', sans-serif",
                            background: form.currency === c ? 'rgba(99,102,241,0.3)' : 'transparent',
                            color: form.currency === c ? '#a5b4fc' : '#475569',
                            transition: 'all 0.15s',
                          }}>
                          {c === 'USD' ? '$' : '₪'}
                        </button>
                      ))}
                    </div>
                  </div>
                </Field>
                <Field label="מחזור חיוב">
                  <div style={{ display: 'flex', gap: '4px', marginBottom: form.billing_cycle === 'custom' ? '6px' : 0 }}>
                    {(['monthly', 'yearly', 'custom'] as const).map(cyc => (
                      <button
                        key={cyc}
                        type="button"
                        onClick={() => handleCostChange(form.cost_per_cycle, cyc)}
                        style={{
                          flex: 1, padding: '10px 4px', borderRadius: '10px', border: 'none',
                          cursor: 'pointer', fontSize: '12px', fontWeight: '700',
                          fontFamily: "'Heebo', sans-serif",
                          background: form.billing_cycle === cyc ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)',
                          color: form.billing_cycle === cyc ? '#a5b4fc' : '#475569',
                          border: `1px solid ${form.billing_cycle === cyc ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'}`,
                          transition: 'all 0.15s',
                        }}
                      >
                        {cyc === 'monthly' ? 'חודשי' : cyc === 'yearly' ? 'שנתי' : 'מותאם'}
                      </button>
                    ))}
                  </div>
                  {form.billing_cycle === 'custom' && (
                    <input
                      style={fieldStyle}
                      type="number"
                      min="2"
                      max="120"
                      value={form.custom_cycle_months ?? ''}
                      onChange={e => {
                        const months = parseInt(e.target.value) || undefined;
                        setForm(f => ({ ...f, custom_cycle_months: months }));
                        if (months) handleCostChange(form.cost_per_cycle, 'custom', months);
                      }}
                      placeholder="מספר חודשים (למשל 24 = שנתיים)"
                      onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.6)')}
                      onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
                    />
                  )}
                </Field>
              </div>

              {form.billing_cycle === 'yearly' && form.cost_per_cycle > 0 && (
                <div style={{
                  fontSize: '13px', color: '#64748b',
                  background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '10px',
                }}>
                  ≈ {form.currency === 'ILS'
                    ? new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(form.cost_per_cycle / 12)
                    : `$${(form.cost_per_cycle / 12).toFixed(2)}`} לחודש
                </div>
              )}

              {/* Plan type */}
              <Field label="סוג מנוי">
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['personal', 'family', 'other'] as const).map(pt => (
                    <button
                      key={pt}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, plan_type: pt }))}
                      style={{
                        flex: 1, padding: '10px 6px', borderRadius: '10px', border: 'none',
                        cursor: 'pointer', fontSize: '13px', fontWeight: '700',
                        fontFamily: "'Heebo', sans-serif",
                        background: form.plan_type === pt ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)',
                        color: form.plan_type === pt ? '#a5b4fc' : '#475569',
                        border: `1px solid ${form.plan_type === pt ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'}`,
                        transition: 'all 0.15s',
                      }}
                    >
                      {pt === 'personal' ? 'פרטי' : pt === 'family' ? 'משפחתי' : 'אחר'}
                    </button>
                  ))}
                </div>
                {form.plan_type === 'other' && (
                  <input
                    style={{ ...fieldStyle, marginTop: '8px' }}
                    value={form.plan_type_custom ?? ''}
                    onChange={e => setForm(f => ({ ...f, plan_type_custom: e.target.value }))}
                    placeholder="תאר את סוג המנוי..."
                    onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.6)')}
                    onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
                  />
                )}
              </Field>

              {/* Free Trial toggle */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: form.is_trial ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${form.is_trial ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: '12px', padding: '14px',
                transition: 'all 0.2s',
              }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: form.is_trial ? '#fbbf24' : '#94a3b8' }}>
                    ניסיון חינם (Trial)
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    סמן אם זה מנוי ניסיון שעוד לא מחויב
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, is_trial: !f.is_trial }))}
                  style={{
                    width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                    background: form.is_trial ? '#fbbf24' : 'rgba(255,255,255,0.1)',
                    position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                  }}
                >
                  <span style={{
                    position: 'absolute', top: '3px',
                    left: form.is_trial ? 'calc(100% - 21px)' : '3px',
                    width: '18px', height: '18px', borderRadius: '50%',
                    background: '#fff', transition: 'left 0.2s',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                  }} />
                </button>
              </div>

              {form.is_trial && (
                <Field label="תאריך סיום הניסיון">
                  <input
                    style={fieldStyle}
                    type="date"
                    value={form.trial_end_date ?? ''}
                    onChange={e => setForm(f => ({ ...f, trial_end_date: e.target.value }))}
                    onFocus={e => (e.target.style.borderColor = 'rgba(251,191,36,0.6)')}
                    onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
                  />
                </Field>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <Field label="תאריך חידוש הבא">
                  <input
                    style={fieldStyle}
                    type="date"
                    value={form.renewal_date}
                    onChange={e => setForm(f => ({ ...f, renewal_date: e.target.value }))}
                    required
                    onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.6)')}
                    onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
                  />
                </Field>
                <Field label="תאריך התחלה (אופציונלי)">
                  <input
                    style={fieldStyle}
                    type="date"
                    value={form.start_date ?? ''}
                    onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                    onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.6)')}
                    onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
                  />
                </Field>
              </div>

              {/* Cancel URL with auto-lookup */}
              <Field label={lookingUpUrl ? 'מחפש קישור ביטול...' : 'קישור לביטול'}>
                <div style={{ position: 'relative' }}>
                  <input
                    style={{ ...fieldStyle, paddingInlineEnd: lookingUpUrl ? '40px' : '14px' }}
                    type="url"
                    value={form.cancel_url ?? ''}
                    onChange={e => setForm(f => ({ ...f, cancel_url: e.target.value }))}
                    placeholder="https://..."
                    onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.6)')}
                    onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
                  />
                  {lookingUpUrl && (
                    <Search size={14} style={{
                      position: 'absolute', insetInlineEnd: '14px', top: '50%',
                      transform: 'translateY(-50%)', color: '#6366f1', animation: 'pulse 1s infinite',
                    }} />
                  )}
                </div>
                {!form.cancel_url && !lookingUpUrl && form.company_name && (
                  <button
                    type="button"
                    onClick={handleCompanyBlur}
                    style={{
                      marginTop: '6px', fontSize: '12px', color: '#6366f1',
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      fontFamily: "'Heebo', sans-serif",
                    }}
                  >
                    🔍 חפש קישור ביטול ל-{form.company_name}
                  </button>
                )}
              </Field>

              <Field label="הערות (אופציונלי)">
                <input
                  style={fieldStyle}
                  value={form.notes ?? ''}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="שיתוף עם..."
                  onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.6)')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
                />
              </Field>

              {error && (
                <div style={{
                  fontSize: '13px', color: '#ef4444',
                  background: 'rgba(239,68,68,0.1)', padding: '12px 14px', borderRadius: '10px',
                }}>
                  {error}
                </div>
              )}

              <div style={{
                position: 'sticky', bottom: 0,
                background: '#0d1526',
                paddingTop: '12px',
                paddingBottom: `max(16px, env(safe-area-inset-bottom, 16px))`,
                display: 'flex', gap: '10px', marginTop: '4px',
              }}>
                <button
                  type="button" onClick={() => { sessionStorage.removeItem('formDraft'); onClose(); }}
                  style={{
                    flex: 1, padding: '14px', borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(255,255,255,0.04)', color: '#64748b',
                    cursor: 'pointer', fontSize: '15px', fontWeight: '600',
                    fontFamily: "'Heebo', sans-serif",
                  }}
                >
                  ביטול
                </button>
                <button
                  type="submit" disabled={saving}
                  style={{
                    flex: 2, padding: '14px', borderRadius: '12px', border: 'none',
                    background: saving ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: '#fff', cursor: saving ? 'wait' : 'pointer',
                    fontSize: '15px', fontWeight: '700',
                    boxShadow: '0 4px 16px rgba(99,102,241,0.3)',
                    fontFamily: "'Heebo', sans-serif",
                    transition: 'opacity 0.15s',
                  }}
                >
                  {saving ? 'שומר...' : initial ? 'שמור שינויים' : 'הוסף מנוי'}
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{
        display: 'block', fontSize: '12px', fontWeight: '600',
        color: '#64748b', marginBottom: '6px', letterSpacing: '0.03em',
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}
