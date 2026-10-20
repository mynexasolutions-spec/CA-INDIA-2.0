import { useState } from 'react';
import { api } from '../../api/client';
import { localISODate, docTypeLabel, money } from './billingUtils';

/**
 * Payment workflow modals shared by Reports -> Outstanding and Billing -> Document View, so both places
 * collect the same payment details (Mark as Paid) and the same reason (Unmark as Paid) before the status changes.
 */
const CheckIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const DocIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
export const CoinIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="800" stroke="none" fill="currentColor">₹</text></svg>;

/* ── Helpers ───────────────────────────────────────────────── */
export function fmtDate(v) {
  if (!v) return '—';
  const s = String(v).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${m[3]} ${months[Number(m[2]) - 1]} ${m[1]}`;
}
const today = () => localISODate();
const PAGE_SIZES = [10, 25, 50];

const PAYMENT_MODES = ['UPI', 'Bank Transfer', 'Cheque', 'Cash', 'Others'];
const NEEDS_REF = ['UPI', 'Bank Transfer', 'Cheque'];
const REF_LABEL = { UPI: 'UPI Transaction ID', 'Bank Transfer': 'UTR Number', Cheque: 'Cheque Number' };

/* ── Info row helper ───────────────────────────────────────── */
function InfoRow({ label, value, bold }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 8, marginBottom: 2 }}>
      <span style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 13, color: '#0f172a', fontWeight: bold ? 800 : 600 }}>{value || '—'}</span>
    </div>
  );
}

/* ── Document Details panel ────────────────────────────────── */
function Stack({ label, value, bold }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 500, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#0f172a', fontWeight: bold ? 800 : 700 }}>{value || '—'}</div>
    </div>
  );
}

export function DocPanel({ doc, total }) {
  const amt = Number(doc.grand_total || doc.total_amount || 0);
  return (
    <div className="om-panel" style={{ background: '#fff', border: '1px solid #d9e5f6', borderRadius: 10, padding: 0, marginBottom: 14, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#eaf2fd', color: '#0f2a5f', fontWeight: 800, fontSize: 13 }}>
        <DocIcon /> Document Details
      </div>
      {total ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px 20px', padding: '12px 16px' }}>
          <Stack label="Document No." value={doc.number} bold />
          <Stack label="Document Type" value={docTypeLabel(doc.type)} />
          <div style={{ gridColumn: '1 / 3', display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 20 }}>
            <Stack label="Party Name" value={doc.customer?.name} bold />
            <Stack label="Invoice Date" value={fmtDate(doc.document_date)} />
            <Stack label="Total Amount" value={money(amt)} bold />
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px 20px', padding: '12px 16px' }}>
          <Stack label="Document No." value={doc.number} bold />
          <Stack label="Document Type" value={docTypeLabel(doc.type)} />
          <Stack label="Party Name" value={doc.customer?.name} bold />
          <Stack label="Invoice Date" value={fmtDate(doc.document_date)} />
          <Stack label="Outstanding Amount" value={money(amt)} bold />
        </div>
      )}
    </div>
  );
}

/* Recorded payment: left column details, right column time / amount / status. */
export function RecordedGrid({ log }) {
  const row = (k, v, bold) => (
    <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 8, marginBottom: 7, fontSize: 12.5 }}>
      <span style={{ color: '#64748b' }}>{k}</span>
      <span style={{ color: '#0f172a', fontWeight: bold ? 800 : 600 }}>{v || '—'}</span>
    </div>
  );
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '0 24px', padding: '12px 16px 6px' }}>
      <div>
        {row('Payment Date', fmtDate(log.paid_on))}
        {row('Payment Mode', log.payment_mode)}
        {row('Transaction ID', log.reference_number)}
        {row('Received By', log.received_by)}
        {row('Remarks', log.remarks)}
      </div>
      <div>
        {row('Payment Time', log.payment_time)}
        {row('Paid Amount', money(log.paid_amount), true)}
        {row('Status', <span style={{ background: '#d9f6e3', color: '#15803d', padding: '2px 14px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>Paid</span>)}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MARK AS PAID MODAL
   ══════════════════════════════════════════════════════════════ */
export function MarkAsPaidModal({ doc, onClose, onSuccess }) {
  const [paidOn,    setPaidOn]    = useState(today());
  const [mode,      setMode]      = useState('');
  const [ref,       setRef]       = useState('');
  const [receivedBy,setReceivedBy]= useState('');
  const [remarks,   setRemarks]   = useState('');
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState('');

  const needsRef = NEEDS_REF.includes(mode);
  const needsCash = mode === 'Cash';
  const canSubmit = paidOn && mode && (!needsRef || ref.trim()) && (!needsCash || receivedBy.trim());

  const submit = async () => {
    setSaving(true); setErr('');
    try {
      await api(`/billing/documents/${doc.id}/payment-status`, {
        method: 'POST',
        body: {
          status: 'paid',
          paid_on: paidOn,
          payment_mode: mode,
          reference_number: ref.trim() || undefined,
          received_by: receivedBy.trim() || undefined,
          paid_amount: Number(doc.grand_total || doc.total_amount || 0),
          remarks: remarks.trim() || undefined,
        },
      });
      onSuccess();
    } catch (e) {
      setErr(e.message || 'Failed to save'); setSaving(false);
    }
  };

  return (
    <ModalShell onClose={onClose} accentColor="#16a34a">
      {/* Header */}
      <div className="om-head" style={{ padding: '18px 22px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0f172a' }}>Mark as Paid</h3>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Enter payment details to mark this document as paid.</p>
        </div>
        <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#334155', lineHeight: 1, display: 'flex' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>

      <div style={{ padding: '8px 22px 16px', overflowY: 'auto', maxHeight: '65vh' }}>
        <DocPanel doc={doc} />

        {/* Payment Details form */}
        <div className="om-panel" style={{ background: '#fff', border: '1px solid #d9e5f6', borderRadius: 10, padding: 0, marginBottom: 12, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#eaf2fd', color: '#0f2a5f', fontWeight: 800, fontSize: 13 }}>
            <CoinIcon /> Payment Details
          </div>

          <div style={{ padding: '14px 16px 4px' }}>
          <FieldRow label="Paid On *">
            <input type="date" className="bp-input" style={{ height: 38 }} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
          </FieldRow>

          <FieldRow label="Payment Mode *">
            <select className="bp-select" style={{ height: 38 }} value={mode} onChange={(e) => { setMode(e.target.value); setRef(''); }}>
              <option value="">Select Payment Mode</option>
              {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </FieldRow>

          {needsRef && (
            <FieldRow label={`${REF_LABEL[mode]} *`} hint="Enter Transaction ID / Reference No.">
              <input className="bp-input" style={{ height: 38 }} value={ref} onChange={(e) => setRef(e.target.value)} placeholder={`Enter ${REF_LABEL[mode]}`} />
            </FieldRow>
          )}

          {needsCash && (
            <FieldRow label="Received By *" hint="Person who received the payment.">
              <input className="bp-input" style={{ height: 38 }} value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} placeholder="Enter receiver name" />
            </FieldRow>
          )}

          {!needsCash && (
            <FieldRow label="Received By" hint="Person who received the payment.">
              <input className="bp-input" style={{ height: 38 }} value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} placeholder="Enter receiver name" />
            </FieldRow>
          )}

          <FieldRow label="Reason / Remarks">
            <textarea className="bp-input" style={{ minHeight: 72, resize: 'vertical', padding: '8px 12px' }} value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={500} placeholder="Optional remarks..." />
            <div style={{ textAlign: 'right', fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{remarks.length}/500</div>
          </FieldRow>
          </div>
        </div>

        {/* Info block */}
        <div style={{ background: '#eaf2fd', border: '1px solid #cfe0f8', borderRadius: 10, padding: '12px 14px', fontSize: 12, color: '#1e293b', display: 'flex', gap: 10 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="11" fill="#1d5fe0"/><line x1="12" y1="11" x2="12" y2="17" stroke="#fff" strokeWidth="2.6" strokeLinecap="round"/><line x1="12" y1="7.3" x2="12.01" y2="7.3" stroke="#fff" strokeWidth="2.8" strokeLinecap="round"/></svg>
          <div>
            <div style={{ fontWeight: 600 }}>Fields marked with * are mandatory.</div>
            <ul style={{ margin: '4px 0 0', paddingLeft: 16, lineHeight: 1.7 }}>
              <li>Reference number is mandatory for UPI, Bank Transfer and Cheque.</li>
              <li>For Cash payments, 'Received By' is mandatory.</li>
            </ul>
          </div>
        </div>

        {err && <p style={{ color: '#ef4444', fontSize: 13, marginTop: 10 }}>{err}</p>}
      </div>

      {/* Footer */}
      <div className="om-foot" style={{ padding: '12px 22px 18px', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <button type="button" onClick={onClose} style={{ height: 40, padding: '0 28px', borderRadius: 9, border: '1.5px solid #dbe3ef', background: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
        <button type="button" disabled={!canSubmit || saving} onClick={submit}
          style={{ height: 40, padding: '0 24px', borderRadius: 9, border: 'none', background: canSubmit && !saving ? '#1d5fe0' : '#94a3b8', color: '#fff', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: canSubmit && !saving ? 'pointer' : 'not-allowed' }}>
          <CheckIcon /> {saving ? 'Saving…' : 'Mark as Paid'}
        </button>
      </div>
    </ModalShell>
  );
}


/* ══════════════════════════════════════════════════════════════
   UNMARK AS PAID MODAL
   ══════════════════════════════════════════════════════════════ */
export function UnmarkAsPaidModal({ doc, log, onClose, onSuccess }) {
  const [reason,  setReason]  = useState('');
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState('');

  const submit = async () => {
    if (!reason.trim()) { setErr('Reason for unmarking is required.'); return; }
    setSaving(true); setErr('');
    try {
      await api(`/billing/documents/${doc.id}/payment-status`, {
        method: 'POST',
        body: { status: 'unpaid', unmark_reason: reason.trim() },
      });
      onSuccess();
    } catch (e) {
      setErr(e.message || 'Failed'); setSaving(false);
    }
  };

  return (
    <ModalShell onClose={onClose} accentColor="#ef4444">
      {/* Header */}
      <div className="om-head" style={{ padding: '18px 22px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#e5302f', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0f172a' }}>Unmark as Paid</h3>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Provide reason to unmark this document as unpaid.</p>
        </div>
        <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#334155', lineHeight: 1, display: 'flex' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>

      <div style={{ padding: '8px 22px 16px', overflowY: 'auto', maxHeight: '65vh' }}>
        <DocPanel doc={doc} total />

        {/* Recorded payment (readonly) */}
        {log && (
          <div style={{ background: '#fff', border: '1px solid #d9e5f6', borderRadius: 10, padding: 0, marginBottom: 14, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#eaf2fd', color: '#0f2a5f', fontWeight: 800, fontSize: 13 }}>
              <CoinIcon /> Payment Details (Recorded)
            </div>
            <RecordedGrid log={log} />
          </div>
        )}

        {/* Reason for unmarking */}
        <div style={{ border: '1px solid #f5c6c6', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#fdeeee', color: '#b91c1c', fontWeight: 800, fontSize: 13 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Reason for Unmarking *
          </div>
          <div style={{ padding: 12 }}>
            <textarea
              className="bp-input"
              style={{ minHeight: 90, resize: 'vertical', padding: '10px 12px', width: '100%', boxSizing: 'border-box' }}
              placeholder="Please enter the reason for unmarking this document as unpaid."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
            />
            <div style={{ textAlign: 'right', fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{reason.length}/500</div>
          </div>
        </div>

        {/* Warning */}
        <div style={{ background: '#fff6ea', border: '1px solid #fbd9a8', borderRadius: 10, padding: '12px 14px', fontSize: 12.5, color: '#7c3a06', display: 'flex', gap: 10, alignItems: 'center' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="11" fill="#f59e0b"/><line x1="12" y1="6.5" x2="12" y2="13" stroke="#fff" strokeWidth="2.8" strokeLinecap="round"/><line x1="12" y1="17" x2="12.01" y2="17" stroke="#fff" strokeWidth="3" strokeLinecap="round"/></svg>
          <div>
            <strong>This will change the document status to Unpaid.</strong>
            <br />This action will be recorded in the activity log with the reason.
          </div>
        </div>

        {err && <p style={{ color: '#ef4444', fontSize: 13, marginTop: 10 }}>{err}</p>}
      </div>

      {/* Footer */}
      <div className="om-foot" style={{ padding: '12px 22px 18px', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <button type="button" onClick={onClose} style={{ height: 40, padding: '0 28px', borderRadius: 9, border: '1.5px solid #dbe3ef', background: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
        <button type="button" disabled={!reason.trim() || saving} onClick={submit}
          style={{ height: 40, padding: '0 24px', borderRadius: 9, border: 'none', background: reason.trim() && !saving ? '#ef4444' : '#94a3b8', color: '#fff', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: reason.trim() && !saving ? 'pointer' : 'not-allowed' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
          {saving ? 'Saving…' : 'Unmark as Paid'}
        </button>
      </div>
    </ModalShell>
  );
}

/* ── Shared modal shell ────────────────────────────────────── */
export function ModalShell({ children, onClose }) {
  return (
    <div className="om-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="om-card" style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 500, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

/* ── Form row helper ───────────────────────────────────────── */
function FieldRow({ label, hint, children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '4px 14px', alignItems: 'start', marginBottom: 12 }}>
      <label style={{ fontSize: 12.5, fontWeight: 600, color: '#1e293b', paddingTop: 10 }}>{label}</label>
      <div>
        {children}
        {hint && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>{hint}</div>}
      </div>
    </div>
  );
}

