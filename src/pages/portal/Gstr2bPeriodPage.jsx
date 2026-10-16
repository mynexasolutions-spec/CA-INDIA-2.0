import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { LoadingBlock } from '../../components/Spinner';
import NumberedPagination from '../billing/NumberedPagination';

function money(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}
function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN');
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
  if (status === 'unmatched') return <Pill label="Unmatched" tone="red" />;
  return <Pill label="Pending" tone="grey" />;
}

/** ITC Eligibility is decided by the Admin only — read-only here ("Select" = not reviewed yet). */
function EligibilityBadge({ value }) {
  if (value === 'eligible') return <Pill label="Yes" tone="green" />;
  if (value === 'ineligible') return <Pill label="No" tone="red" />;
  return <Pill label="Select" tone="grey" />;
}

function KpiCard({ label, value, color, bg, border, icon }) {
  return (
    <div style={{ background: bg, border: `1.5px solid ${border}`, borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ width: 34, height: 34, borderRadius: 8, background: '#fff', border: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
        {icon}
      </span>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 16, fontWeight: 850, color, lineHeight: 1.1 }}>{value}</div>
      </div>
    </div>
  );
}

// ── Tax-aware Invoice Form (shared by Add + Edit) ────────────────────────────

function InvoiceForm({ initial = {}, period, onClose, onSaved, title, submitUrl, method = 'POST' }) {
  const [base, setBase] = useState({
    invoice_date:   initial.invoice_date   || '',
    invoice_number: initial.invoice_number || '',
    party_name:     initial.party_name     || '',
    gstin:          initial.gstin          || '',
    taxable_value:  initial.taxable_value  || '',
  });

  // Tax fields tracked separately for business rules
  const [igst, setIgstRaw]   = useState(String(initial.igst        || ''));
  const [cgst, setCgstRaw]   = useState(String(initial.cgst        || ''));
  const [sgst, setSgstRaw]   = useState(String(initial.sgst_utgst  || ''));

  // 'igst' | 'cgst_sgst' | null
  const [taxMode, setTaxMode] = useState(() => {
    const ig = parseFloat(initial.igst || 0);
    const cg = parseFloat(initial.cgst || 0);
    if (ig > 0) return 'igst';
    if (cg > 0) return 'cgst_sgst';
    return null;
  });

  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');
  const [scanning, setScanning] = useState(false);
  const fileRef = useRef(null);

  const igstVal = parseFloat(igst) || 0;
  const cgstVal = parseFloat(cgst) || 0;
  const sgstVal = parseFloat(sgst) || 0;
  const itcAmount = (igstVal + cgstVal + sgstVal).toFixed(2);

  // ── Rule handlers ──────────────────────────────────────────────────────
  const handleIgst = (v) => {
    setIgstRaw(v);
    const n = parseFloat(v) || 0;
    if (n > 0) {
      setTaxMode('igst');
      setCgstRaw('');
      setSgstRaw('');
    } else if (v === '' || v === '0') {
      setTaxMode(null);
    }
  };

  const handleCgst = (v) => {
    setCgstRaw(v);
    const n = parseFloat(v) || 0;
    if (n > 0) {
      setTaxMode('cgst_sgst');
      setSgstRaw(v);   // mirror SGST = CGST
      setIgstRaw('');
    } else if (v === '' || v === '0') {
      if (sgstVal === 0) setTaxMode(null);
      setSgstRaw(v);
    }
  };

  const handleSgst = (v) => {
    setSgstRaw(v);
    const n = parseFloat(v) || 0;
    if (n > 0) {
      setTaxMode('cgst_sgst');
      setCgstRaw(v);   // mirror CGST = SGST
      setIgstRaw('');
    } else if (v === '' || v === '0') {
      if (cgstVal === 0) setTaxMode(null);
      setCgstRaw(v);
    }
  };

  // ── OCR upload ─────────────────────────────────────────────────────────
  const handleScan = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    setErr('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api(`/client/gstr2b/period/${period}/projected/extract`, {
        method: 'POST',
        body: fd,
      });
      setBase({
        invoice_date:   res.invoice_date   || base.invoice_date,
        invoice_number: res.invoice_number || base.invoice_number,
        party_name:     res.party_name     || base.party_name,
        gstin:          res.gstin          || base.gstin,
        taxable_value:  res.taxable_value  || base.taxable_value,
      });
      if (parseFloat(res.igst || 0) > 0) {
        handleIgst(String(res.igst));
      } else if (parseFloat(res.cgst || 0) > 0) {
        handleCgst(String(res.cgst));
      } else if (parseFloat(res.sgst_utgst || 0) > 0) {
        handleSgst(String(res.sgst_utgst));
      }
    } catch (ex) {
      setErr('OCR extraction failed: ' + ex.message);
    } finally {
      setScanning(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

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

  const igstDisabled = taxMode === 'cgst_sgst';
  const cgstDisabled = taxMode === 'igst';
  const sgstDisabled = taxMode === 'igst' || taxMode === 'cgst_sgst'; // always locked when cgst_sgst (auto-filled)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={onClose} />
      <div style={{ position: 'relative', background: '#fff', borderRadius: 14, padding: '26px 28px 22px', width: '100%', maxWidth: 560, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--bp-navy)' }}>{title}</h3>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--bp-muted)' }}>Projected ITC — not for GST filing.</p>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* OCR Scan Button */}
        <div style={{ marginBottom: 16 }}>
          <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleScan} />
          <button
            type="button"
            disabled={scanning}
            onClick={() => fileRef.current?.click()}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              background: scanning ? '#f8fafc' : 'linear-gradient(135deg,#eff6ff 0%,#f0fdf4 100%)',
              border: '1.5px dashed #2563eb', borderRadius: 10, padding: '10px 16px',
              cursor: scanning ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, color: '#1d4ed8',
            }}
          >
            {scanning ? (
              <svg className="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h.01M15 9h.01M9 15h6"/></svg>
            )}
            <span>{scanning ? 'Extracting invoice data with AI…' : 'Scan Invoice with AI (Upload Image or PDF)'}</span>
            {!scanning && <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#6d28d9', background: '#ede9fe', padding: '2px 8px', borderRadius: 6 }}>AI / OCR</span>}
          </button>
        </div>

        {err && <p className="bp-alert bp-alert-error" style={{ marginBottom: 12 }}>{err}</p>}

        <form onSubmit={handleSave}>
          {/* Basic fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', marginBottom: 16 }}>
            {[
              { k: 'invoice_date',   label: 'Invoice Date',   type: 'date',   span: 1 },
              { k: 'invoice_number', label: 'Invoice No.',    type: 'text',   span: 1 },
              { k: 'party_name',     label: 'Party Name',     type: 'text',   span: 2 },
              { k: 'gstin',          label: 'GSTIN',          type: 'text',   span: 2 },
              { k: 'taxable_value',  label: 'Taxable Value (₹)', type: 'number', span: 2 },
            ].map((f) => (
              <div key={f.k} style={{ gridColumn: `span ${f.span}`, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--bp-navy)' }}>{f.label}</label>
                <input
                  className="bp-input"
                  type={f.type}
                  step={f.type === 'number' ? '0.01' : undefined}
                  min={f.type === 'number' ? '0' : undefined}
                  value={base[f.k]}
                  onChange={(e) => setBase((b) => ({ ...b, [f.k]: e.target.value }))}
                  style={{ height: 36 }}
                />
              </div>
            ))}
          </div>

          {/* Tax fields with business rules */}
          <div style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--bp-navy)', marginBottom: 10 }}>
              Tax Amounts
              <span style={{ marginLeft: 8, fontWeight: 500, color: '#64748b', fontSize: 11 }}>
                Enter either IGST (inter-state) or CGST (intra-state). The other will be disabled automatically.
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px 12px' }}>
              {/* IGST */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: igstDisabled ? '#94a3b8' : 'var(--bp-navy)' }}>
                  IGST (₹)
                  {igstDisabled && <span style={{ marginLeft: 4, fontSize: 10, color: '#94a3b8' }}>(disabled)</span>}
                </label>
                <input
                  className="bp-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={igst}
                  disabled={igstDisabled}
                  onChange={(e) => handleIgst(e.target.value)}
                  style={{ height: 36, background: igstDisabled ? '#f1f5f9' : undefined, color: igstDisabled ? '#94a3b8' : undefined }}
                />
              </div>
              {/* CGST */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: cgstDisabled ? '#94a3b8' : 'var(--bp-navy)' }}>
                  CGST (₹)
                  {cgstDisabled && <span style={{ marginLeft: 4, fontSize: 10, color: '#94a3b8' }}>(disabled)</span>}
                </label>
                <input
                  className="bp-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={cgst}
                  disabled={cgstDisabled}
                  onChange={(e) => handleCgst(e.target.value)}
                  style={{ height: 36, background: cgstDisabled ? '#f1f5f9' : undefined, color: cgstDisabled ? '#94a3b8' : undefined }}
                />
              </div>
              {/* SGST */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: sgstDisabled ? '#94a3b8' : 'var(--bp-navy)' }}>
                  SGST/UTGST (₹)
                  {taxMode === 'cgst_sgst' && <span style={{ marginLeft: 4, fontSize: 10, color: '#2563eb' }}>(auto)</span>}
                  {taxMode === 'igst' && <span style={{ marginLeft: 4, fontSize: 10, color: '#94a3b8' }}>(disabled)</span>}
                </label>
                <input
                  className="bp-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={sgst}
                  readOnly={taxMode === 'cgst_sgst'}
                  disabled={taxMode === 'igst'}
                  onChange={(e) => taxMode !== 'cgst_sgst' && handleSgst(e.target.value)}
                  style={{
                    height: 36,
                    background: (taxMode === 'igst' || taxMode === 'cgst_sgst') ? '#f1f5f9' : undefined,
                    color: taxMode === 'igst' ? '#94a3b8' : taxMode === 'cgst_sgst' ? '#2563eb' : undefined,
                    fontWeight: taxMode === 'cgst_sgst' ? 600 : undefined,
                  }}
                />
              </div>
            </div>

            {/* ITC Amount (auto, read-only) */}
            <div style={{ marginTop: 12, padding: '10px 14px', background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>
                ITC Amount (Auto-calculated)
                <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 500, color: '#3b82f6' }}>= IGST + CGST + SGST</span>
              </span>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#1d4ed8' }}>₹{Number(itcAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
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

// ── GSTR-2B Invoices Tab ─────────────────────────────────────────────────────

function InvoicesTab({ period }) {
  const [result, setResult]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState('');
  const [page, setPage]         = useState(1);
  const [perPage, setPerPage]   = useState(10);
  const [matchStatus, setMatchStatus] = useState('');
  const [q, setQ]               = useState('');
  const [selected, setSelected] = useState([]);
  const [action, setAction] = useState('');
  const [applying, setApplying] = useState(false);

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

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setSelected([]); }, [page, perPage, matchStatus, q, period]);

  // Select invoices -> choose Matched / Unmatched -> Apply (one or many).
  const handleApply = async () => {
    if (!selected.length || !action) return;
    setApplying(true);
    setErr('');
    try {
      await api('/client/gstr2b/invoices/bulk-match-status', { method: 'POST', body: { ids: selected, match_status: action } });
      setSelected([]);
      setAction('');
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setApplying(false);
    }
  };

  const toggleOne = (id) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const toggleAllRows = (ids) => setSelected((cur) => (ids.length > 0 && ids.every((id) => cur.includes(id)) ? [] : ids));
  const actionLabel = (verb) => (selected.length > 1 ? `Mark Selected as ${verb}` : `Mark as ${verb}`);

  const summary = result?.summary || {};
  const rows    = result?.data    || [];

  const kpis = [
    { label: 'Total Invoices',    value: summary.total_invoices    ?? 0,  color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', icon: <InvIcon /> },
    { label: 'Matched Invoices',  value: summary.matched_invoices  ?? 0,  color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', icon: <MatchIcon /> },
    { label: 'Unmatched Invoices',value: summary.unmatched_invoices ?? 0, color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: <UnmatchIcon /> },
    { label: 'Matched ITC',       value: money(summary.matched_itc),      color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', icon: <ChartIcon /> },
    { label: 'Unmatched ITC',     value: money(summary.unmatched_itc),    color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: <ChartIcon /> },
    { label: 'Total ITC',         value: money(summary.total_itc),        color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', icon: <ChartIcon /> },
  ];

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 16 }}>
        {kpis.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>
      <div className="bp-card no-print" style={{ padding: '12px 16px', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--bp-navy)' }}>Search</span>
            <input className="bp-input" style={{ height: 36, width: 220 }} placeholder="Supplier, GSTIN or Invoice #"
              value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--bp-navy)' }}>Match Status</span>
            <select className="bp-select" style={{ height: 36, minWidth: 120 }} value={matchStatus}
              onChange={(e) => { setMatchStatus(e.target.value); setPage(1); }}>
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="matched">Matched</option>
              <option value="unmatched">Unmatched</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--bp-navy)' }}>
              Reconciliation{selected.length > 0 ? ` · ${selected.length} selected` : ''}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <select className="bp-select" style={{ height: 36, minWidth: 190 }} value={action}
                disabled={!selected.length || applying} onChange={(e) => setAction(e.target.value)}>
                <option value="">Select Action</option>
                <option value="matched">{actionLabel('Matched')}</option>
                <option value="unmatched">{actionLabel('Unmatched')}</option>
              </select>
              <button type="button" className="bp-btn bp-btn-primary" style={{ height: 36, borderRadius: 8 }}
                disabled={!selected.length || !action || applying} onClick={handleApply}>
                {applying ? 'Applying…' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      </div>
      {err && <p className="bp-alert bp-alert-error" style={{ marginBottom: 10 }}>{err}</p>}
      {loading ? <div className="bp-card"><LoadingBlock /></div> : (
        <>
          <div className="bp-table-wrapper" style={{ overflowX: 'auto' }}>
            <table className="bp-table bp-doc-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input type="checkbox" aria-label="Select all invoices"
                      checked={rows.length > 0 && rows.every((r) => selected.includes(r.id))}
                      onChange={() => toggleAllRows(rows.map((r) => r.id))} />
                  </th>
                  <th>S.No</th><th>Invoice Date</th><th>Invoice No.</th><th>Supplier Name</th>
                  <th>Supplier GSTIN</th><th style={{ textAlign: 'right' }}>Taxable Value</th>
                  <th style={{ textAlign: 'right' }}>IGST</th><th style={{ textAlign: 'right' }}>CGST</th>
                  <th style={{ textAlign: 'right' }}>SGST</th><th style={{ textAlign: 'right' }}>ITC Amount</th>
                  <th>ITC Eligibility</th><th>Reconciliation Status</th><th>Source</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} style={selected.includes(r.id) ? { background: '#eff6ff' } : undefined}>
                    <td>
                      <input type="checkbox" aria-label={`Select invoice ${r.invoice_number || r.id}`}
                        checked={selected.includes(r.id)} onChange={() => toggleOne(r.id)} />
                    </td>
                    <td style={{ color: '#94a3b8', fontSize: 12 }}>{(page - 1) * perPage + i + 1}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmt(r.invoice_date)}</td>
                    <td style={{ fontWeight: 600 }}>{r.invoice_number || '—'}</td>
                    <td>{r.supplier_name || '—'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.supplier_gstin || '—'}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{money(r.taxable_value)}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{money(r.igst)}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{money(r.cgst)}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{money(r.sgst)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#2563eb', whiteSpace: 'nowrap' }}>{money(r.total_gst)}</td>
                    <td><EligibilityBadge value={r.itc_eligibility} /></td>
                    <td><MatchBadge status={r.match_status} /></td>
                    <td>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>
                        GST Portal
                      </span>
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr><td colSpan={14} style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--bp-muted)' }}>No invoices found for this period.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <NumberedPagination meta={result} perPage={perPage}
            onPerPage={(v) => { setPerPage(v); setPage(1); }}
            onPage={setPage} itemLabel="invoices" perPageOptions={[10, 25, 50]} />
        </>
      )}
    </div>
  );
}

// ── Projected ITC Tab ─────────────────────────────────────────────────────────

function ProjectedTab({ period }) {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

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
    } catch (e) {
      setErr(e.message);
    } finally {
      setDeleting(null);
    }
  };

  // Summary totals
  const totals = rows.reduce((acc, r) => ({
    count:         acc.count + 1,
    taxable_value: acc.taxable_value + Number(r.taxable_value || 0),
    igst:          acc.igst          + Number(r.igst          || 0),
    cgst:          acc.cgst          + Number(r.cgst          || 0),
    sgst:          acc.sgst          + Number(r.sgst_utgst    || 0),
    itc:           acc.itc           + Number(r.itc_amount    || 0),
  }), { count: 0, taxable_value: 0, igst: 0, cgst: 0, sgst: 0, itc: 0 });

  const summaryKpis = [
    { label: 'Total Projected Invoices',   value: totals.count,         color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', icon: <InvIcon /> },
    { label: 'Projected Taxable Value',    value: money(totals.taxable_value), color: '#0369a1', bg: '#f0f9ff', border: '#bae6fd', icon: <ChartIcon /> },
    { label: 'Projected IGST',             value: money(totals.igst),   color: '#0369a1', bg: '#f0f9ff', border: '#bae6fd', icon: <ChartIcon /> },
    { label: 'Projected CGST',             value: money(totals.cgst),   color: '#0369a1', bg: '#f0f9ff', border: '#bae6fd', icon: <ChartIcon /> },
    { label: 'Projected SGST',             value: money(totals.sgst),   color: '#0369a1', bg: '#f0f9ff', border: '#bae6fd', icon: <ChartIcon /> },
    { label: 'Total Projected ITC',        value: money(totals.itc),    color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', icon: <ChartIcon /> },
  ];

  return (
    <div>
      {/* Summary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 16 }}>
        {summaryKpis.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      {/* Info Banner */}
      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#92400e', marginBottom: 2 }}>Projected ITC — Not for Filing</div>
          <div style={{ fontSize: 12, color: '#78350f' }}>
            Invoices added here are for internal planning and estimation purposes only. They are not part of the official GSTR-2B data from the GST portal and cannot be used for GST return filing.
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="bp-btn bp-btn-outline"
          style={{ height: 38, gap: 8, display: 'flex', alignItems: 'center', borderRadius: 8, fontWeight: 600 }}
          onClick={() => {
            const a = document.createElement('a');
            a.href = `/api/client/gstr2b/period/${period}/projected/template`;
            a.download = 'gstr2b_projected_template.xlsx';
            a.click();
          }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Download Format (Excel Template)
        </button>
        <button type="button" className="bp-btn bp-btn-outline"
          style={{ height: 38, gap: 8, display: 'flex', alignItems: 'center', borderRadius: 8, fontWeight: 600 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Upload Excel
        </button>
        <button type="button" className="bp-btn bp-btn-primary"
          style={{ height: 38, gap: 8, display: 'flex', alignItems: 'center', borderRadius: 8, fontWeight: 600, marginLeft: 'auto' }}
          onClick={() => setShowAdd(true)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
          Add Invoice Manually
        </button>
      </div>

      {err && <p className="bp-alert bp-alert-error" style={{ marginBottom: 10 }}>{err}</p>}

      {loading ? <div className="bp-card"><LoadingBlock /></div> : (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--bp-navy)', marginBottom: 8 }}>
            Projected Invoices (Uploaded by Client)
          </div>
          <div className="bp-table-wrapper" style={{ overflowX: 'auto' }}>
            <table className="bp-table bp-doc-table">
              <thead>
                <tr>
                  <th>S.No</th><th>Invoice Date</th><th>Invoice No.</th>
                  <th>Supplier Name</th><th>Supplier GSTIN</th>
                  <th style={{ textAlign: 'right' }}>Taxable Value</th>
                  <th style={{ textAlign: 'right' }}>IGST</th>
                  <th style={{ textAlign: 'right' }}>CGST</th>
                  <th style={{ textAlign: 'right' }}>SGST</th>
                  <th style={{ textAlign: 'right' }}>ITC Amount</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id}>
                    <td style={{ color: '#94a3b8', fontSize: 12 }}>{i + 1}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmt(r.invoice_date)}</td>
                    <td style={{ fontWeight: 600 }}>{r.invoice_number || '—'}</td>
                    <td>{r.party_name || '—'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.gstin || '—'}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{money(r.taxable_value)}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{money(r.igst)}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{money(r.cgst)}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{money(r.sgst_utgst)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#2563eb', whiteSpace: 'nowrap' }}>{money(r.itc_amount)}</td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <button type="button"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', padding: 4 }}
                        onClick={() => setEditing(r)} title="Edit">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button type="button"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 4 }}
                        disabled={deleting === r.id}
                        onClick={() => handleDelete(r.id)} title="Delete">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                          <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr><td colSpan={11} style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--bp-muted)' }}>
                    No projected invoices added yet. Click "Add Invoice Manually" or use OCR scan to get started.
                  </td></tr>
                )}
                {rows.length > 0 && (
                  <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                    <td colSpan={5} style={{ textAlign: 'right', fontSize: 12, color: 'var(--bp-navy)' }}>Totals</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{money(totals.taxable_value)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{money(totals.igst)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{money(totals.cgst)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{money(totals.sgst)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: '#2563eb', fontSize: 14, whiteSpace: 'nowrap' }}>{money(totals.itc)}</td>
                    <td />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div style={{ marginTop: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#991b1b', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
        </svg>
        Projected ITC is for estimation only. It does not affect your actual GSTR-2B or GSTR-3B filing calculations.
      </div>

      {showAdd && (
        <InvoiceForm
          period={period}
          title="Add Invoice Manually"
          submitUrl={`/client/gstr2b/period/${period}/projected`}
          method="POST"
          onClose={() => setShowAdd(false)}
          onSaved={load}
        />
      )}
      {editing && (
        <InvoiceForm
          period={period}
          title="Edit Projected Invoice"
          initial={editing}
          submitUrl={`/client/gstr2b/period/${period}/projected/${editing.id}`}
          method="PUT"
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

// ── SVG icon helpers ──────────────────────────────────────────────────────────
function InvIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>;
}
function MatchIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="9 15 11 17 15 13"/></svg>;
}
function UnmatchIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><line x1="9" y1="13" x2="15" y2="19"/><line x1="15" y1="13" x2="9" y2="19"/></svg>;
}
function ChartIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'invoices',  label: 'GSTR-2B Invoices' },
  { key: 'projected', label: 'Projected ITC' },
];

function periodLabel(period) {
  if (!period) return '';
  if (/Q\d/.test(period)) return period;
  try {
    const [year, month] = period.split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  } catch { return period; }
}

export default function Gstr2bPeriodPage() {
  const { period }    = useParams();
  const navigate      = useNavigate();
  const [activeTab, setActiveTab] = useState('invoices');

  return (
    <div>
      <div className="bp-toolbar no-print" style={{ marginBottom: 20 }}>
        <button type="button"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, padding: '4px 0' }}
          onClick={() => navigate('/portal/gstr-2b')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back to GSTR-2B
        </button>
        <div style={{ flex: 1, marginLeft: 16 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--bp-navy)' }}>GSTR-2B — {periodLabel(period)}</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--bp-muted)' }}>Tax Period: {period}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e2e8f0', marginBottom: 20 }}>
        {TABS.map((tab) => (
          <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '10px 20px',
              fontSize: 14, fontWeight: activeTab === tab.key ? 700 : 500,
              color: activeTab === tab.key ? '#2563eb' : '#64748b',
              borderBottom: `2px solid ${activeTab === tab.key ? '#2563eb' : 'transparent'}`,
              marginBottom: -2, transition: 'all 0.15s',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'invoices'  && <InvoicesTab  period={period} />}
      {activeTab === 'projected' && <ProjectedTab period={period} />}
    </div>
  );
}
