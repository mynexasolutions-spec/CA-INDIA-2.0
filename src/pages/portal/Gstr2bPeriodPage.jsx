import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, getAuthToken } from '../../api/client';
import { LoadingBlock } from '../../components/Spinner';
import NumberedPagination from '../billing/NumberedPagination';

/** "2026-08-01…" -> "01-08-2026" */
function fmt(d) {
  if (!d) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d));
  return m ? `${m[3]}-${m[2]}-${m[1]}` : new Date(d).toLocaleDateString('en-GB').replace(/\//g, '-');
}
const inr = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
/** Excel-readable file from rows (header + body), no extra library. */
function exportXls(name, headers, rows) {
  const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = `<html><head><meta charset="utf-8"></head><body><table border="1"><thead><tr>${headers.map((h) => `<th style="background:#e8f0fe">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;
  saveBlob(new Blob([html], { type: 'application/vnd.ms-excel' }), `${name}.xls`);
}
/** Authenticated file download (a plain link can't send the login token). */
async function downloadWithAuth(url, filename) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${getAuthToken()}`, Accept: '*/*' } });
  if (!res.ok) throw new Error('Download failed. Please try again.');
  saveBlob(await res.blob(), filename);
}

const BADGE = {
  green: { background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' },
  red: { background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' },
  grey: { background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' },
};

function Pill({ label, tone }) {
  return (
    <span style={{ display: 'inline-block', minWidth: 78, textAlign: 'center', padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700, ...BADGE[tone] }}>
      {label}
    </span>
  );
}

/** Reconciliation status — new documents are Pending until marked Matched / Unmatched. */
function MatchBadge({ status }) {
  if (status === 'matched') return <Pill label="Matched" tone="green" />;
  return <Pill label="Unmatched" tone="red" />;
}

// ── Tax-aware Invoice Form (shared by Add + Edit) ────────────────────────────

function InvoiceForm({ initial = {}, period, onClose, onSaved, title, submitUrl, method = 'POST' }) {
  const [base, setBase] = useState({
    invoice_date:   initial.invoice_date   ? String(initial.invoice_date).slice(0, 10) : '',
    invoice_number: initial.invoice_number || '',
    party_name:     initial.party_name     || '',
    gstin:          initial.gstin          || '',
    taxable_value:  initial.taxable_value  || '',
  });

  // Tax fields tracked separately for business rules
  const [igst, setIgstRaw]   = useState(String(initial.igst        || ''));
  const [cgst, setCgstRaw]   = useState(String(initial.cgst        || ''));
  const [sgst, setSgstRaw]   = useState(String(initial.sgst_utgst  || ''));

  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  const igstVal = parseFloat(igst) || 0;
  const cgstVal = parseFloat(cgst) || 0;
  const sgstVal = parseFloat(sgst) || 0;
  const itcAmount = (igstVal + cgstVal + sgstVal).toFixed(2);

  // ── Tax rules ──────────────────────────────────────────────────────────
  // IGST entered  -> CGST and SGST/UTGST are disabled (and empty).
  // CGST entered  -> IGST disabled; SGST/UTGST = same amount, locked.
  // SGST entered  -> IGST disabled; CGST = same amount, locked.
  // The field the user typed in stays editable; ITC = IGST + CGST + SGST/UTGST.
  const [driver, setDriver] = useState(() => {
    if (parseFloat(initial.igst || 0) > 0) return 'igst';
    if (parseFloat(initial.cgst || 0) > 0) return 'cgst';
    if (parseFloat(initial.sgst_utgst || 0) > 0) return 'sgst';
    return null;
  });
  const apply = (field, v) => {
    const n = parseFloat(v) || 0;
    if (field === 'igst') {
      setIgstRaw(v);
      if (n > 0) { setDriver('igst'); setCgstRaw(''); setSgstRaw(''); } else if (driver === 'igst') setDriver(null);
    } else if (field === 'cgst') {
      setCgstRaw(v);
      if (n > 0) { setDriver('cgst'); setIgstRaw(''); setSgstRaw(v); } else if (driver === 'cgst') { setDriver(null); setSgstRaw(''); }
    } else {
      setSgstRaw(v);
      if (n > 0) { setDriver('sgst'); setIgstRaw(''); setCgstRaw(v); } else if (driver === 'sgst') { setDriver(null); setCgstRaw(''); }
    }
  };
  const handleIgst = (v) => apply('igst', v);
  const handleCgst = (v) => apply('cgst', v);
  const handleSgst = (v) => apply('sgst', v);
  const igstLocked = driver === 'cgst' || driver === 'sgst';
  const cgstLocked = driver === 'igst' || driver === 'sgst';
  const sgstLocked = driver === 'igst' || driver === 'cgst';

  const handleSave = async (ev) => {
    ev.preventDefault();
    setSaving(true);
    setErr('');
    try {
      await api(submitUrl, {
        method,
        body: {
          ...base,
          igst:       igst  || '0',
          cgst:       cgst  || '0',
          sgst_utgst: sgst  || '0',
          itc_amount: itcAmount,
        },
      });
      onSaved();
      onClose();
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setSaving(false);
    }
  };


  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={onClose} />
      <div style={{ position: 'relative', background: '#fff', borderRadius: 14, padding: '26px 28px 22px', width: '100%', maxWidth: 560, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--bp-navy)' }}>{title}</h3>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--bp-muted)' }}>Projected ITC is for internal planning only — it is not final and is not used for GST filing.</p>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {err && <p className="bp-alert bp-alert-error" style={{ marginBottom: 12 }}>{err}</p>}

        <form onSubmit={handleSave}>
          {/* Basic fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', marginBottom: 16 }}>
            {[
              { k: 'invoice_date',   label: 'Invoice Date *',   type: 'date',   span: 1 },
              { k: 'invoice_number', label: 'Invoice No. *',    type: 'text',   span: 1 },
              { k: 'party_name',     label: 'Party Name *',     type: 'text',   span: 2 },
              { k: 'gstin',          label: 'GSTIN *',          type: 'text',   span: 2 },
              { k: 'taxable_value',  label: 'Taxable Value (₹) *', type: 'number', span: 2 },
            ].map((f) => (
              <div key={f.k} style={{ gridColumn: `span ${f.span}`, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--bp-navy)' }}>{f.label}</label>
                <input
                  className="bp-input"
                  type={f.type}
                  step={f.type === 'number' ? '0.01' : undefined}
                  min={f.type === 'number' ? '0' : undefined}
                  value={base[f.k]}
                  required
                  maxLength={f.k === 'gstin' ? 15 : undefined}
                  onChange={(e) => setBase((b) => ({ ...b, [f.k]: f.k === 'gstin' ? e.target.value.toUpperCase() : e.target.value }))}
                  style={{ height: 36 }}
                />
              </div>
            ))}
          </div>

          {/* Tax fields: strict business rules (see apply()) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '6px 14px', marginBottom: 14 }}>
            {[
              { key: 'igst', label: 'IGST (₹)', val: igst, locked: igstLocked, on: handleIgst, note: 'When IGST is entered, CGST and SGST/UTGST will be disabled.', tone: 'blue' },
              { key: 'cgst', label: 'CGST (₹)', val: cgst, locked: cgstLocked, on: handleCgst, note: 'SGST/UTGST will be auto-filled with the same amount as CGST.', tone: 'green' },
              { key: 'sgst', label: 'SGST / UTGST (₹)', val: sgst, locked: sgstLocked, on: handleSgst, note: null, tone: 'green' },
            ].map((f) => (
              <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: f.locked ? '#94a3b8' : 'var(--bp-navy)' }}>{f.label}</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="bp-input" type="number" step="0.01" min="0"
                    value={f.val} readOnly={f.locked} disabled={f.locked && driver === 'igst'}
                    onChange={(e) => !f.locked && f.on(e.target.value)}
                    style={{ height: 38, width: '100%', paddingRight: f.locked ? 34 : undefined, background: f.locked ? '#eef2f7' : undefined, color: f.locked ? '#64748b' : undefined, fontWeight: f.locked && driver !== 'igst' ? 700 : undefined }}
                  />
                  {f.locked && driver !== 'igst' && (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', right: 11, top: 12 }} aria-label="Locked (auto-filled)"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
                  )}
                </div>
              </div>
            ))}
            {[
              { note: 'When IGST is entered, CGST and SGST/UTGST will be disabled.', bg: '#eaf3ff', fg: '#1e40af', dot: '#2563eb' },
              { note: 'SGST/UTGST will be auto-filled with the same amount as CGST.', bg: '#e8f8ee', fg: '#166534', dot: '#16a34a' },
              { note: 'CGST will be auto-filled when you enter SGST/UTGST.', bg: '#e8f8ee', fg: '#166534', dot: '#16a34a' },
            ].map((n) => (
              <div key={n.note} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', background: n.bg, color: n.fg, borderRadius: 9, padding: '7px 9px', fontSize: 11, lineHeight: 1.35 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill={n.dot} style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10" /><line x1="12" y1="11" x2="12" y2="16" stroke="white" strokeWidth="2.4" strokeLinecap="round" /><line x1="12" y1="7.5" x2="12.01" y2="7.5" stroke="white" strokeWidth="2.6" strokeLinecap="round" /></svg>
                {n.note}
              </div>
            ))}
          </div>

          {/* ITC Amount — never editable, always IGST + CGST + SGST/UTGST */}
          <div style={{ marginBottom: 16, padding: '12px 16px', background: '#eaf3ff', borderRadius: 12, border: '1px solid #cfe2ff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#1e40af' }}>ITC Amount (₹) <span style={{ fontWeight: 600, color: '#3b82f6' }}>(Auto-calculated)</span></div>
              <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 2 }}>ITC Amount = IGST + CGST + SGST/UTGST</div>
            </div>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#1d4ed8' }}>{Number(itcAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="bp-btn bp-btn-outline" style={{ height: 38, borderRadius: 8 }} onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="bp-btn bp-btn-primary" style={{ height: 38, borderRadius: 8 }} disabled={saving}>
              {saving ? 'Saving…' : 'Save Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── shared pieces ────────────────────────────────────────────────────────────

const SVG = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
const IcDoc = () => <svg {...SVG}><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="13" y2="17" /></svg>;
const IcCheckDoc = () => <svg {...SVG}><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="9 15 11 17 15 13" /></svg>;
const IcCrossDoc = () => <svg {...SVG}><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><line x1="9" y1="13" x2="15" y2="19" /><line x1="15" y1="13" x2="9" y2="19" /></svg>;
const IcRupee = () => <svg {...SVG}><path d="M6 4h12M6 9h12M9 4c6 0 6 9 0 9H6l8 7" /></svg>;
const IcSearch = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
const IcFilter = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>;
const IcDownload = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>;
const IcUpload = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>;
const IcPlus = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>;

/** Summary tile: icon box, label, big value and a small sub-line. */
function Tile({ label, value, sub, tone, icon }) {
  const T = {
    blue:   { bg: 'linear-gradient(135deg,#eef5ff,#e2edff)', bd: '#d2e2fb', ic: '#cfe0ff', fg: '#1d4ed8' },
    green:  { bg: 'linear-gradient(135deg,#f0fbf4,#e0f6e8)', bd: '#cdeed9', ic: '#c9efd7', fg: '#15803d' },
    red:    { bg: 'linear-gradient(135deg,#fff3f3,#fde6e6)', bd: '#f8d2d2', ic: '#fbd5d5', fg: '#dc2626' },
    purple: { bg: 'linear-gradient(135deg,#f6f2ff,#ece5fd)', bd: '#e0d4fa', ic: '#e4d9fb', fg: '#7c3aed' },
    orange: { bg: 'linear-gradient(135deg,#fff8ec,#fef0d6)', bd: '#f9e3bc', ic: '#fde4b8', fg: '#d97706' },
  }[tone];
  return (
    <div style={{ background: T.bg, border: `1px solid ${T.bd}`, borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
      <span style={{ width: 44, height: 44, borderRadius: 12, background: T.ic, color: T.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</span>
      <div style={{ minWidth: 0, lineHeight: 1.25 }}>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: '#334155' }}>{label}</div>
        <div style={{ fontSize: 21, fontWeight: 800, color: T.fg, whiteSpace: 'nowrap' }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: '#64748b' }}>{sub}</div>}
      </div>
    </div>
  );
}

const CARD = { background: '#fff', border: '1px solid #e3ebf6', borderRadius: 16, padding: '18px 20px', boxShadow: '0 12px 28px -24px rgba(15,42,95,.55)' };
const CTRL = { height: 38, borderRadius: 10, border: '1px solid #d7e1ef', background: '#fff', padding: '0 12px', fontSize: 13, color: '#1e293b' };
const BTN_OUT = { height: 38, padding: '0 16px', borderRadius: 10, border: '1px solid #bfd3f6', background: '#fff', color: '#1d4ed8', fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' };
const BTN_SOLID = { ...BTN_OUT, border: 'none', background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: '#fff', boxShadow: '0 10px 16px -10px rgba(29,78,216,.85)' };

/** Search box + Filter + Export controls shared by both tables. */
function Toolbar({ q, setQ, filterOpen, setFilterOpen, onExport, exporting, children }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}><IcSearch /></span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by invoice no., supplier name or GSTIN…" style={{ ...CTRL, width: 300, paddingLeft: 34 }} />
      </div>
      <div style={{ position: 'relative' }}>
        <button type="button" style={BTN_OUT} onClick={() => setFilterOpen((v) => !v)}><IcFilter /> Filter</button>
        {filterOpen && (
          <div style={{ position: 'absolute', right: 0, top: 44, zIndex: 20, width: 220, background: '#fff', border: '1px solid #dfe8f5', borderRadius: 12, padding: 14, boxShadow: '0 20px 40px -18px rgba(15,42,95,.45)' }}>
            {children}
          </div>
        )}
      </div>
      <button type="button" style={BTN_SOLID} onClick={onExport} disabled={exporting}><IcDownload /> {exporting ? 'Exporting…' : 'Export'}</button>
    </div>
  );
}

const TH = { background: '#e9f0fb', color: '#0f2a5f', fontWeight: 800, fontSize: 11.5, padding: '11px 10px', textAlign: 'center', borderBottom: '1px solid #d6e3f7', whiteSpace: 'nowrap' };
const TD = { padding: '11px 10px', textAlign: 'center', fontSize: 12.5, color: '#1e293b', borderBottom: '1px solid #eef3fa', whiteSpace: 'nowrap' };

// ── GSTR-2B Invoices Tab ─────────────────────────────────────────────────────

function InvoicesTab({ period, label }) {
  const [result, setResult]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState('');
  const [page, setPage]         = useState(1);
  const [perPage, setPerPage]   = useState(10);
  const [matchStatus, setMatchStatus] = useState('');
  const [q, setQ]               = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState([]);
  const [action, setAction]     = useState('');
  const [applying, setApplying] = useState(false);
  const [detail, setDetail] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    const qs = new URLSearchParams({ page, per_page: perPage });
    if (matchStatus) qs.set('match_status', matchStatus);
    if (q) qs.set('q', q);
    return api(`/client/gstr2b/period/${period}/invoices?${qs}`)
      .then(setResult)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [period, page, perPage, matchStatus, q]);

  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);
  useEffect(() => { setSelected([]); }, [page, perPage, matchStatus, q, period]);

  const handleApply = async () => {
    if (!selected.length || !action) return;
    setApplying(true); setErr('');
    try {
      await api('/client/gstr2b/invoices/bulk-match-status', { method: 'POST', body: { ids: selected, match_status: action } });
      setSelected([]); setAction('');
      await load();
    } catch (e) { setErr(e.message); } finally { setApplying(false); }
  };

  const doExport = async () => {
    setExporting(true);
    try {
      const qs = new URLSearchParams({ page: 1, per_page: 100 });
      if (matchStatus) qs.set('match_status', matchStatus);
      if (q) qs.set('q', q);
      let all = [];
      let pg = 1;
      let last = 1;
      do {
        qs.set('page', pg);
        // eslint-disable-next-line no-await-in-loop
        const d = await api(`/client/gstr2b/period/${period}/invoices?${qs}`);
        all = all.concat(d.data || []);
        last = d.last_page || 1;
        pg += 1;
      } while (pg <= last);
      exportXls(`gstr2b_${period}_invoices`,
        ['S. No.', 'Invoice Date', 'Invoice No.', 'Supplier Name', 'Supplier GSTIN', 'Taxable Value', 'IGST', 'CGST', 'SGST', 'ITC Amount', 'Match Status', 'Source'],
        all.map((r, i) => [i + 1, fmt(r.invoice_date), r.invoice_number, r.supplier_name, r.supplier_gstin, r.taxable_value, r.igst, r.cgst, r.sgst, r.total_gst, r.match_status === 'matched' ? 'Matched' : 'Unmatched', 'GST Portal']));
    } catch (e) { setErr(e.message); } finally { setExporting(false); }
  };

  const sm   = result?.summary || {};
  const rows = result?.data || [];
  const total = sm.total_invoices ?? 0;
  const matched = sm.matched_invoices ?? 0;
  const unmatched = total - matched;
  const totalItc = sm.total_itc ?? 0;
  const matchedItc = sm.matched_itc ?? 0;
  const unmatchedItc = totalItc - matchedItc;
  const pct = (n, d) => (d > 0 ? `${((n / d) * 100).toFixed(2)}% of total${d === totalItc && d !== total ? ' ITC' : ''}` : '0% of total');

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 12, marginBottom: 18 }} className="g2b-tiles">
        <Tile tone="blue"   icon={<IcDoc />}      label="Total Invoices"     value={total}     sub="All documents" />
        <Tile tone="green"  icon={<IcCheckDoc />} label="Matched Invoices"   value={matched}   sub={pct(matched, total)} />
        <Tile tone="red"    icon={<IcCrossDoc />} label="Unmatched Invoices" value={unmatched} sub={pct(unmatched, total)} />
        <Tile tone="purple" icon={<IcRupee />}     label="Matched ITC Amount" value={`₹ ${inr(matchedItc)}`}   sub={totalItc ? `${((matchedItc / totalItc) * 100).toFixed(2)}% of total ITC` : '0% of total ITC'} />
        <Tile tone="orange" icon={<IcRupee />}     label="Unmatched ITC Amount" value={`₹ ${inr(unmatchedItc)}`} sub={totalItc ? `${((unmatchedItc / totalItc) * 100).toFixed(2)}% of total ITC` : '0% of total ITC'} />
        <Tile tone="blue"   icon={<IcRupee />}     label="Total ITC as per GSTR-2B" value={`₹ ${inr(totalItc)}`} />
      </div>

      <div style={CARD}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, fontSize: 15, color: '#0f2a5f' }}>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IcDoc /></span>
              Invoices / Documents (Uploaded by Admin)
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>Below are the invoices/documents available for {label}. These are uploaded by the Admin user from GSTR-2B or other sources.</div>
          </div>
          <Toolbar q={q} setQ={(v) => { setQ(v); setPage(1); }} filterOpen={filterOpen} setFilterOpen={setFilterOpen} onExport={doExport} exporting={exporting}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>Match Status</label>
            <select style={{ ...CTRL, width: '100%' }} value={matchStatus} onChange={(e) => { setMatchStatus(e.target.value); setPage(1); setFilterOpen(false); }}>
              <option value="">All</option>
              <option value="matched">Matched</option>
              <option value="unmatched">Unmatched</option>
            </select>
          </Toolbar>
        </div>

        {selected.length > 0 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#eef4ff', border: '1px solid #d6e3fa', borderRadius: 10, padding: '8px 12px', marginBottom: 12, flexWrap: 'wrap' }}>
            <b style={{ fontSize: 12.5, color: '#0f2a5f' }}>{selected.length} selected</b>
            <select style={{ ...CTRL, height: 34 }} value={action} onChange={(e) => setAction(e.target.value)} disabled={applying}>
              <option value="">Select Action</option>
              <option value="matched">Mark as Matched</option>
              <option value="unmatched">Mark as Unmatched</option>
            </select>
            <button type="button" style={{ ...BTN_SOLID, height: 34 }} disabled={!action || applying} onClick={handleApply}>{applying ? 'Applying…' : 'Apply'}</button>
          </div>
        )}

        {err && <p className="bp-alert bp-alert-error" style={{ marginBottom: 10 }}>{err}</p>}
        {loading && !rows.length ? <LoadingBlock /> : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...TH, width: 34 }}>
                      <input type="checkbox" aria-label="Select all invoices" checked={rows.length > 0 && rows.every((r) => selected.includes(r.id))}
                        onChange={() => setSelected((cur) => (rows.length > 0 && rows.every((r) => cur.includes(r.id)) ? [] : rows.map((r) => r.id)))} />
                    </th>
                    {['S. No.', 'Invoice Date', 'Invoice No.', 'Supplier Name', 'Supplier GSTIN', 'Taxable Value (₹)', 'IGST (₹)', 'CGST (₹)', 'SGST (₹)', 'ITC Amount (₹)', 'Match Status', 'Source'].map((h) => <th key={h} style={TH}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.id} style={selected.includes(r.id) ? { background: '#eff6ff' } : (i % 2 ? { background: '#f9fbff' } : undefined)}>
                      <td style={TD}><input type="checkbox" aria-label={`Select invoice ${r.invoice_number || r.id}`} checked={selected.includes(r.id)} onChange={() => setSelected((cur) => (cur.includes(r.id) ? cur.filter((x) => x !== r.id) : [...cur, r.id]))} /></td>
                      <td style={{ ...TD, color: '#64748b' }}>{(page - 1) * perPage + i + 1}</td>
                      <td style={TD}>{fmt(r.invoice_date)}</td>
                      <td style={TD}><button type="button" onClick={() => setDetail(r)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#1d4ed8', fontWeight: 700, textDecoration: 'underline', font: 'inherit' }}>{r.invoice_number || '—'}</button></td>
                      <td style={TD}>{r.supplier_name || '—'}</td>
                      <td style={{ ...TD, fontFamily: 'monospace', fontSize: 12 }}>{r.supplier_gstin || '—'}</td>
                      <td style={TD}>{inr(r.taxable_value)}</td>
                      <td style={TD}>{inr(r.igst)}</td>
                      <td style={TD}>{inr(r.cgst)}</td>
                      <td style={TD}>{inr(r.sgst)}</td>
                      <td style={{ ...TD, fontWeight: 800, color: '#0f2a5f' }}>{inr(r.total_gst)}</td>
                      <td style={TD}><MatchBadge status={r.match_status} /></td>
                      <td style={TD}>GST Portal</td>
                    </tr>
                  ))}
                  {!rows.length && <tr><td colSpan={13} style={{ ...TD, padding: '40px 16px', color: '#94a3b8' }}>No invoices found for this period.</td></tr>}
                </tbody>
              </table>
            </div>
            <NumberedPagination meta={result} perPage={perPage} onPerPage={(v) => { setPerPage(v); setPage(1); }} onPage={setPage} itemLabel="documents" perPageOptions={[10, 25, 50]} />
          </>
        )}
      </div>

      {detail && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,.45)' }} onClick={() => setDetail(null)} />
          <div style={{ position: 'relative', background: '#fff', borderRadius: 18, width: '100%', maxWidth: 460, padding: '22px 24px', boxShadow: '0 30px 60px -20px rgba(15,42,95,.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f2a5f' }}>Invoice {detail.invoice_number}</h3>
              <button type="button" onClick={() => setDetail(null)} aria-label="Close" style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: '#eef2f8', cursor: 'pointer', color: '#475569' }}>×</button>
            </div>
            {[['Invoice Date', fmt(detail.invoice_date)], ['Supplier Name', detail.supplier_name], ['Supplier GSTIN', detail.supplier_gstin], ['Taxable Value (₹)', inr(detail.taxable_value)], ['IGST (₹)', inr(detail.igst)], ['CGST (₹)', inr(detail.cgst)], ['SGST (₹)', inr(detail.sgst)], ['ITC Amount (₹)', inr(detail.total_gst)], ['Match Status', detail.match_status === 'matched' ? 'Matched' : 'Unmatched'], ['Source', 'GST Portal']].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderBottom: '1px solid #eef3fa', fontSize: 13 }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>{k}</span>
                <b style={{ color: '#0f2a5f', textAlign: 'right' }}>{v || '—'}</b>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Projected ITC Tab ─────────────────────────────────────────────────────────

function ProjectedTab({ period }) {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState('');
  const [ok, setOk]           = useState('');
  const [importErrors, setImportErrors] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [q, setQ]             = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [taxFilter, setTaxFilter] = useState('');
  const [page, setPage]       = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(() => {
    setLoading(true);
    return api(`/client/gstr2b/period/${period}/projected`)
      .then((d) => setRows(d.data || []))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this projected invoice?')) return;
    setDeleting(id);
    try {
      await api(`/client/gstr2b/period/${period}/projected/${id}`, { method: 'DELETE' });
      setRows((r) => r.filter((x) => x.id !== id));
    } catch (e) { setErr(e.message); } finally { setDeleting(null); }
  };

  const downloadTemplate = async () => {
    setErr('');
    try { await downloadWithAuth(`/api/client/gstr2b/period/${period}/projected/template`, 'gstr2b_projected_itc_template.xlsx'); }
    catch (e) { setErr(e.message); }
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    setUploading(true); setErr(''); setOk(''); setImportErrors([]);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api(`/client/gstr2b/period/${period}/projected/import`, { method: 'POST', body: fd });
      setOk(res.message || 'Invoices imported.');
      await load();
    } catch (ex) {
      setErr(ex.message);
      setImportErrors(ex.data?.errors || []);
    } finally { setUploading(false); }
  };

  const shown = rows.filter((r) => {
    const t = q.trim().toLowerCase();
    if (t && ![r.invoice_number, r.party_name, r.gstin].some((v) => String(v || '').toLowerCase().includes(t))) return false;
    if (taxFilter === 'igst' && !(Number(r.igst) > 0)) return false;
    if (taxFilter === 'cgst' && !(Number(r.cgst) > 0 || Number(r.sgst_utgst) > 0)) return false;
    return true;
  });
  const lastPage = Math.max(1, Math.ceil(shown.length / perPage));
  const curPage = Math.min(page, lastPage);
  const pageRows = shown.slice((curPage - 1) * perPage, curPage * perPage);

  const totals = rows.reduce((acc, r) => ({
    count: acc.count + 1,
    taxable: acc.taxable + Number(r.taxable_value || 0),
    igst: acc.igst + Number(r.igst || 0),
    cgst: acc.cgst + Number(r.cgst || 0),
    sgst: acc.sgst + Number(r.sgst_utgst || 0),
    itc: acc.itc + Number(r.itc_amount || 0),
  }), { count: 0, taxable: 0, igst: 0, cgst: 0, sgst: 0, itc: 0 });

  const doExport = () => exportXls(`gstr2b_${period}_projected_itc`,
    ['S. No.', 'Invoice Date', 'Invoice No.', 'Supplier Name', 'Supplier GSTIN', 'Taxable Value', 'IGST', 'CGST', 'SGST', 'ITC Amount'],
    shown.map((r, i) => [i + 1, fmt(r.invoice_date), r.invoice_number, r.party_name, r.gstin, r.taxable_value, r.igst, r.cgst, r.sgst_utgst, r.itc_amount]));

  return (
    <div>
      <div style={{ ...CARD, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16, background: '#f5f9ff' }}>
        <span style={{ width: 40, height: 40, borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><line x1="12" y1="11" x2="12" y2="17" /><line x1="12" y1="7" x2="12.01" y2="7" /></svg>
        </span>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#0f2a5f' }}>Projected ITC (Client Upload)</div>
          <div style={{ fontSize: 12.5, color: '#475569', marginTop: 2 }}>
            Upload your expected purchase invoices for the tax period to estimate your potential ITC. This is for your internal planning purposes only.{' '}
            <b style={{ color: '#dc2626' }}>This is NOT FINAL</b> and will not be considered for filing. Once the actual GSTR-2B is available, the Admin user can delete the projected ITC data.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" style={BTN_OUT} onClick={downloadTemplate}>
            <IcDownload /> <span style={{ lineHeight: 1.1 }}>Download Format<br /><small style={{ fontWeight: 500 }}>(Excel Template)</small></span>
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={onFile} />
          <button type="button" style={{ ...BTN_SOLID, height: 'auto', minHeight: 38 }} onClick={() => fileRef.current?.click()} disabled={uploading}>
            <IcUpload /> <span style={{ lineHeight: 1.1 }}>{uploading ? 'Uploading…' : 'Upload Excel'}<br /><small style={{ fontWeight: 500 }}>(Use our template)</small></span>
          </button>
          <button type="button" style={BTN_OUT} onClick={() => setShowAdd(true)}><IcPlus /> Add Invoice Manually</button>
        </div>
      </div>

      {ok && <p className="bp-alert bp-alert-success" style={{ marginBottom: 10 }}>{ok}</p>}
      {err && (
        <div className="bp-alert bp-alert-error" style={{ marginBottom: 10 }}>
          <div>{err}</div>
          {importErrors.length > 0 && <ul style={{ margin: '6px 0 0', paddingLeft: 18, listStyle: 'disc' }}>{importErrors.map((m) => <li key={m}>{m}</li>)}</ul>}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 12, marginBottom: 18 }} className="g2b-tiles">
        <Tile tone="blue"   icon={<IcDoc />}  label="Total Projected Invoices" value={totals.count} sub="Uploaded by Client" />
        <Tile tone="green"  icon={<IcRupee />} label="Projected Taxable Value" value={`₹ ${inr(totals.taxable)}`} />
        <Tile tone="blue"   icon={<IcRupee />} label="Projected IGST" value={`₹ ${inr(totals.igst)}`} />
        <Tile tone="purple" icon={<IcRupee />} label="Projected CGST" value={`₹ ${inr(totals.cgst)}`} />
        <Tile tone="purple" icon={<IcRupee />} label="Projected SGST" value={`₹ ${inr(totals.sgst)}`} />
        <Tile tone="purple" icon={<IcRupee />} label="Total Projected ITC" value={`₹ ${inr(totals.itc)}`} />
      </div>

      <div style={CARD}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#0f2a5f' }}>Projected Invoices (Uploaded by Client)</div>
          <Toolbar q={q} setQ={(v) => { setQ(v); setPage(1); }} filterOpen={filterOpen} setFilterOpen={setFilterOpen} onExport={doExport} exporting={false}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>Tax Type</label>
            <select style={{ ...CTRL, width: '100%' }} value={taxFilter} onChange={(e) => { setTaxFilter(e.target.value); setPage(1); setFilterOpen(false); }}>
              <option value="">All</option>
              <option value="igst">IGST (inter-state)</option>
              <option value="cgst">CGST + SGST (intra-state)</option>
            </select>
          </Toolbar>
        </div>

        {loading ? <LoadingBlock /> : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{['S. No.', 'Invoice Date', 'Invoice No.', 'Supplier Name', 'Supplier GSTIN', 'Taxable Value (₹)', 'IGST (₹)', 'CGST (₹)', 'SGST (₹)', 'ITC Amount (₹)', 'Action'].map((h) => <th key={h} style={TH}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {pageRows.map((r, i) => (
                    <tr key={r.id} style={i % 2 ? { background: '#f9fbff' } : undefined}>
                      <td style={{ ...TD, color: '#64748b' }}>{(curPage - 1) * perPage + i + 1}</td>
                      <td style={TD}>{fmt(r.invoice_date)}</td>
                      <td style={TD}><span style={{ color: '#1d4ed8', fontWeight: 700, textDecoration: 'underline' }}>{r.invoice_number || '—'}</span></td>
                      <td style={TD}>{r.party_name || '—'}</td>
                      <td style={{ ...TD, fontFamily: 'monospace', fontSize: 12 }}>{r.gstin || '—'}</td>
                      <td style={TD}>{inr(r.taxable_value)}</td>
                      <td style={TD}>{inr(r.igst)}</td>
                      <td style={TD}>{inr(r.cgst)}</td>
                      <td style={TD}>{inr(r.sgst_utgst)}</td>
                      <td style={{ ...TD, fontWeight: 800, color: '#0f2a5f' }}>{inr(r.itc_amount)}</td>
                      <td style={TD}>
                        <button type="button" title="Edit" onClick={() => setEditing(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', padding: 4 }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                        </button>
                        <button type="button" title="Delete" disabled={deleting === r.id} onClick={() => handleDelete(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 4 }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!pageRows.length && <tr><td colSpan={11} style={{ ...TD, padding: '40px 16px', color: '#94a3b8' }}>No projected invoices yet. Download the Excel template and upload it, or use "Add Invoice Manually".</td></tr>}
                </tbody>
              </table>
            </div>
            <NumberedPagination
              meta={{ current_page: curPage, last_page: lastPage, total: shown.length, per_page: perPage }}
              perPage={perPage} onPerPage={(v) => { setPerPage(v); setPage(1); }} onPage={setPage}
              itemLabel="documents" perPageOptions={[10, 25, 50]}
            />
          </>
        )}
      </div>

      <div style={{ marginTop: 14, background: '#fff8e8', border: '1px solid #f6dd9b', borderRadius: 12, padding: '12px 16px', color: '#7a4a00', fontSize: 12.5, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#d97706" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10" /><line x1="12" y1="11" x2="12" y2="16" stroke="white" strokeWidth="2.2" strokeLinecap="round" /><line x1="12" y1="7.5" x2="12.01" y2="7.5" stroke="white" strokeWidth="2.4" strokeLinecap="round" /></svg>
        <div>
          <b>Note:</b> Projected ITC is for your internal planning purposes only. Once the actual GSTR-2B is available, the Admin user can delete the projected ITC data.
          <div style={{ color: '#dc2626', fontWeight: 700, marginTop: 2 }}>This data will not be considered for filing.</div>
        </div>
      </div>

      {showAdd && (
        <InvoiceForm period={period} title="Add Projected Invoice (Manually)" submitUrl={`/client/gstr2b/period/${period}/projected`} method="POST" onClose={() => setShowAdd(false)} onSaved={load} />
      )}
      {editing && (
        <InvoiceForm period={period} title="Edit Projected Invoice" initial={editing} submitUrl={`/client/gstr2b/period/${period}/projected/${editing.id}`} method="PUT" onClose={() => setEditing(null)} onSaved={load} />
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'invoices',  label: 'GSTR-2B Invoices' },
  { key: 'projected', label: 'Projected ITC' },
];

function periodLabel(period) {
  if (!period) return '';
  if (/Q\d/.test(period)) {
    const m = /^(\d{4})-Q(\d)$/.exec(period);
    if (!m) return period;
    const y = Number(m[1]);
    return [`Q1 Apr–Jun ${y}`, `Q2 Jul–Sep ${y}`, `Q3 Oct–Dec ${y}`, `Q4 Jan–Mar ${y + 1}`][Number(m[2]) - 1] || period;
  }
  const [year, month] = period.split('-').map(Number);
  return month ? `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][month - 1]} ${year}` : period;
}

export default function Gstr2bPeriodPage() {
  const { period }    = useParams();
  const navigate      = useNavigate();
  const [activeTab, setActiveTab] = useState('invoices');
  const label = periodLabel(period);

  return (
    <div style={{ maxWidth: 1250 }}>
      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
        <Link to="/portal" style={{ color: '#2563eb', textDecoration: 'none' }}>Home</Link><span>›</span>
        <span>GST Compliance</span><span>›</span>
        <Link to="/portal/gstr-2b" style={{ color: '#2563eb', textDecoration: 'none' }}>GSTR-2B</Link><span>›</span>
        <span style={{ color: '#1e293b', fontWeight: 800 }}>{activeTab === 'projected' ? 'Projected ITC' : 'View GSTR-2B'}</span>
      </div>

      <div style={{ marginBottom: 16 }}>
        <button type="button" onClick={() => navigate('/portal/gstr-2b')} style={{ background: 'none', border: 'none', padding: 0, marginBottom: 6, color: '#2563eb', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>‹ Back to GSTR-2B</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#0f2a5f', letterSpacing: '-0.01em' }}>GSTR-2B – {label}</h1>
          <span style={{ padding: '4px 14px', borderRadius: 999, background: '#d9f3e3', color: '#15803d', fontSize: 12, fontWeight: 800 }}>Available</span>
        </div>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>Detailed view of inward supplies, ITC summary and reconciliation.</p>
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #dbe5f3', marginBottom: 18 }}>
        {TABS.map((tab) => {
          const on = activeTab === tab.key;
          return (
            <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
              style={{
                background: on ? '#fff' : 'transparent', border: '1px solid', borderColor: on ? '#dbe5f3' : 'transparent', borderBottom: on ? '2px solid #2563eb' : '1px solid transparent',
                borderRadius: '10px 10px 0 0', cursor: 'pointer', padding: '10px 24px', fontSize: 13.5, fontWeight: on ? 800 : 600,
                color: on ? '#1d4ed8' : '#475569', marginBottom: -1,
              }}>
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'invoices'  && <InvoicesTab  period={period} label={label} />}
      {activeTab === 'projected' && <ProjectedTab period={period} />}
    </div>
  );
}
