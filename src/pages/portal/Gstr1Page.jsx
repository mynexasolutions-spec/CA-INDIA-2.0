import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { LoadingBlock } from '../../components/Spinner';
import { buildFyOptions, fyMonthOptions, billingDocPath } from '../billing/billingUtils';

/* ── Helpers ───────────────────────────────────────────────────── */
function money(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/* ── Icons ─────────────────────────────────────────────────────── */
const SVI = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' };
function SendIcon()      { return <svg {...SVI}><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>; }
function DownloadIcon()  { return <svg {...SVI}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>; }
function CheckCircleIcon() { return <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>; }
function SummaryTabIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>; }
function B2BTabIcon()    { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 21v-4h6v4M9 7h.01M9 11h.01M15 7h.01M15 11h.01"/></svg>; }
function B2CTabIcon()    { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4"/><circle cx="17" cy="17" r="4"/><path d="M17 14v3l2 1"/></svg>; }
function XIcon()         { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }

/* ── Table header cell style ────────────────────────────────────── */
const TH = { padding: '10px 14px', textAlign: 'left', fontWeight: 700, fontSize: 12, letterSpacing: 0.4, whiteSpace: 'nowrap', background: '#1e3a5f', color: '#fff' };
const TD = { padding: '11px 14px', fontSize: 13, color: '#1e293b', whiteSpace: 'nowrap' };
const TDR = { ...TD, textAlign: 'right' };
const TH_R = { ...TH, textAlign: 'right' };

function SectionCard({ icon, title, children, right }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #e2e8f0', overflow: 'hidden', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 18px', borderBottom: '1.5px solid #f1f5f9', background: '#f8fafc' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 14, color: '#1e3a5f' }}>
          <span style={{ width: 30, height: 30, background: '#1e3a5f', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {icon}
          </span>
          {title}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

/* ── Summary Tab ────────────────────────────────────────────────── */
function SummaryTab({ summary, loading }) {
  const [hsnFormat, setHsnFormat] = useState('Excel');

  if (loading) return <LoadingBlock label="Loading summary…" minHeight={200} />;
  if (!summary) return null;

  const { doc_type_summary = [], doc_type_totals = {}, hsn_summary = [] } = summary;

  const docTotals = doc_type_totals;

  return (
    <>
      {/* Document Type Summary */}
      <SectionCard
        icon={<DownloadIcon />}
        title="Document Type Summary – Outward Supplies (B2B and B2C)"
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TH}>Document Type</th>
                <th style={TH_R}>No. of Documents</th>
                <th style={TH_R}>Taxable Value (₹)</th>
                <th style={TH_R}>IGST (₹)</th>
                <th style={TH_R}>CGST (₹)</th>
                <th style={TH_R}>SGST (₹)</th>
                <th style={TH_R}>Total Invoice Value (₹)</th>
              </tr>
            </thead>
            <tbody>
              {doc_type_summary.map((row, i) => (
                <tr key={row.type} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
                  <td style={TD}>{row.label}</td>
                  <td style={TDR}>{Number(row.count).toLocaleString('en-IN')}</td>
                  <td style={TDR}>{money(row.taxable_value)}</td>
                  <td style={TDR}>{money(row.igst)}</td>
                  <td style={TDR}>{money(row.cgst)}</td>
                  <td style={TDR}>{money(row.sgst)}</td>
                  <td style={TDR}>{money(row.total)}</td>
                </tr>
              ))}
              {!doc_type_summary.length && (
                <tr><td colSpan={7} style={{ ...TD, textAlign: 'center', color: '#94a3b8', padding: 28 }}>No documents for this period.</td></tr>
              )}
            </tbody>
            {doc_type_summary.length > 0 && (
              <tfoot>
                <tr style={{ background: '#1e3a5f' }}>
                  <td style={{ ...TH, color: '#7dd3fc' }}>Total</td>
                  <td style={{ ...TH_R, color: '#7dd3fc' }}>{Number(docTotals.count || 0).toLocaleString('en-IN')}</td>
                  <td style={{ ...TH_R, color: '#7dd3fc' }}>{money(docTotals.taxable)}</td>
                  <td style={{ ...TH_R, color: '#7dd3fc' }}>{money(docTotals.igst)}</td>
                  <td style={{ ...TH_R, color: '#7dd3fc' }}>{money(docTotals.cgst)}</td>
                  <td style={{ ...TH_R, color: '#7dd3fc' }}>{money(docTotals.sgst)}</td>
                  <td style={{ ...TH_R, color: '#7dd3fc' }}>{money(docTotals.total)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </SectionCard>

      {/* HSN/SAC Summary */}
      <SectionCard
        icon={<DownloadIcon />}
        title="HSN/SAC Summary – Outward Supplies (B2B and B2C)"
        right={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Format</span>
            <select
              value={hsnFormat}
              onChange={(e) => setHsnFormat(e.target.value)}
              style={{ height: 30, padding: '0 8px', borderRadius: 7, border: '1.5px solid #e2e8f0', fontSize: 12, background: '#fff', color: '#1e293b' }}
            >
              <option>Excel</option>
              <option>Predefined CSV</option>
              <option>JSON</option>
            </select>
            <button type="button"
              style={{ height: 30, padding: '0 12px', borderRadius: 7, border: 'none', background: '#2563eb', color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
              <DownloadIcon /> Export
            </button>
          </div>
        }
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TH}>HSN/SAC Code</th>
                <th style={TH}>Description (Short)</th>
                <th style={TH_R}>GST (%)</th>
                <th style={TH_R}>QTY</th>
                <th style={TH}>UQC</th>
                <th style={TH_R}>Taxable Value (₹)</th>
                <th style={TH_R}>IGST (₹)</th>
                <th style={TH_R}>CGST (₹)</th>
                <th style={TH_R}>SGST (₹)</th>
                <th style={TH_R}>Total Invoice Value (₹)</th>
              </tr>
            </thead>
            <tbody>
              {hsn_summary.map((row, i) => (
                <tr key={`${row.hsn_sac}-${i}`} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ ...TD, color: '#2563eb', fontWeight: 600 }}>{row.hsn_sac || '—'}</td>
                  <td style={TD}>{row.description || '—'}</td>
                  <td style={TDR}>{row.gst_rate}%</td>
                  <td style={TDR}>{Number(row.qty).toFixed(2)}</td>
                  <td style={TD}>{row.uqc || 'NOS'}</td>
                  <td style={TDR}>{money(row.taxable_value)}</td>
                  <td style={TDR}>{money(row.igst)}</td>
                  <td style={TDR}>{money(row.cgst)}</td>
                  <td style={TDR}>{money(row.sgst)}</td>
                  <td style={TDR}>{money(row.total)}</td>
                </tr>
              ))}
              {!hsn_summary.length && (
                <tr><td colSpan={10} style={{ ...TD, textAlign: 'center', color: '#94a3b8', padding: 28 }}>No HSN/SAC data for this period.</td></tr>
              )}
            </tbody>
            {hsn_summary.length > 0 && (
              <tfoot>
                <tr style={{ background: '#1e3a5f' }}>
                  <td style={{ ...TH, color: '#7dd3fc' }}>Total</td>
                  <td style={TH}>—</td>
                  <td style={TH}>—</td>
                  <td style={{ ...TH_R, color: '#7dd3fc' }}>{hsn_summary.reduce((s, r) => s + Number(r.qty), 0).toFixed(2)}</td>
                  <td style={TH}>—</td>
                  <td style={{ ...TH_R, color: '#7dd3fc' }}>{money(hsn_summary.reduce((s, r) => s + Number(r.taxable_value), 0))}</td>
                  <td style={{ ...TH_R, color: '#7dd3fc' }}>{money(hsn_summary.reduce((s, r) => s + Number(r.igst), 0))}</td>
                  <td style={{ ...TH_R, color: '#7dd3fc' }}>{money(hsn_summary.reduce((s, r) => s + Number(r.cgst), 0))}</td>
                  <td style={{ ...TH_R, color: '#7dd3fc' }}>{money(hsn_summary.reduce((s, r) => s + Number(r.sgst), 0))}</td>
                  <td style={{ ...TH_R, color: '#7dd3fc' }}>{money(hsn_summary.reduce((s, r) => s + Number(r.total), 0))}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </SectionCard>
    </>
  );
}

/* ── Document List Tab (B2B / B2C) ─────────────────────────────── */
const DOC_TYPE_OPTIONS = [
  { value: '', label: 'Select' },
  { value: 'tax_invoice', label: 'Tax Invoice' },
  { value: 'bill_of_supply', label: 'Bill of Supply' },
  { value: 'debit_note', label: 'Debit Note' },
  { value: 'credit_note', label: 'Credit Note' },
];
const EXPORT_FORMATS = ['Excel', 'Predefined CSV', 'JSON'];

function DocumentListTab({ gstType, period }) {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 10 });
  const [page, setPage] = useState(1);
  const [perPage] = useState(10);
  const [docType, setDocType] = useState('');
  const [fmt, setFmt] = useState('Excel');
  const [loading, setLoading] = useState(false);

  const load = useCallback((p = 1) => {
    if (!period) return;
    setLoading(true);
    // Build date range for the period (YYYY-MM → first/last of month)
    const [y, m] = period.split('-');
    const docFrom = `${y}-${m}-01`;
    const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
    const docTo = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
    const qs = new URLSearchParams({
      gst_type: gstType,
      doc_from: docFrom,
      doc_to: docTo,
      per_page: perPage,
      page: p,
    });
    if (docType) qs.set('type', docType);
    api(`/billing/documents?${qs}`)
      .then((d) => {
        setRows(d.data || []);
        setMeta({ current_page: d.current_page || 1, last_page: d.last_page || 1, total: d.total || 0, per_page: d.per_page || perPage });
      })
      .finally(() => setLoading(false));
  }, [period, gstType, docType, perPage]);

  useEffect(() => { setPage(1); load(1); }, [period, gstType, docType]); // eslint-disable-line

  const isB2B = gstType === 'b2b';

  // Column totals
  const totTaxable = rows.reduce((s, r) => s + Number(r.taxable_amount || 0), 0);
  const totIgst = rows.reduce((s, r) => s + Number(r.igst_amount || 0), 0);
  const totCgst = rows.reduce((s, r) => s + Number(r.cgst_amount || 0), 0);
  const totSgst = rows.reduce((s, r) => s + Number(r.sgst_amount || 0), 0);
  const totTotal = rows.reduce((s, r) => s + Number(r.grand_total || r.total_amount || 0), 0);

  return (
    <SectionCard
      icon={<B2BTabIcon />}
      title="Document List"
      right={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Document Type</span>
            <select value={docType} onChange={(e) => setDocType(e.target.value)}
              style={{ height: 30, padding: '0 8px', borderRadius: 7, border: '1.5px solid #e2e8f0', fontSize: 12, background: '#fff', color: '#1e293b', minWidth: 130 }}>
              {DOC_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Format</span>
            <select value={fmt} onChange={(e) => setFmt(e.target.value)}
              style={{ height: 30, padding: '0 8px', borderRadius: 7, border: '1.5px solid #e2e8f0', fontSize: 12, background: '#fff', color: '#1e293b', minWidth: 120 }}>
              {EXPORT_FORMATS.map((f) => <option key={f}>{f}</option>)}
            </select>
          </div>
          <button type="button" style={{ height: 30, padding: '0 12px', borderRadius: 7, border: 'none', background: '#2563eb', color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', alignSelf: 'flex-end' }}>
            <DownloadIcon /> Export
          </button>
        </div>
      }
    >
      {loading ? <LoadingBlock minHeight={120} /> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...TH, width: 40 }}>S.No.</th>
                <th style={TH}>Invoice No.</th>
                <th style={TH}>Invoice Date</th>
                <th style={TH}>Party Name</th>
                {isB2B && <th style={TH}>GSTIN</th>}
                <th style={TH}>Place of Supply</th>
                <th style={TH_R}>GST %</th>
                <th style={TH_R}>Taxable Value (₹)</th>
                <th style={TH_R}>IGST (₹)</th>
                <th style={TH_R}>CGST (₹)</th>
                <th style={TH_R}>SGST (₹)</th>
                <th style={TH_R}>Total Value (₹)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d, i) => {
                const rowNum = (meta.current_page - 1) * perPage + i + 1;
                const gstPct = d.line_items?.[0]?.gst_rate ?? '—';
                return (
                  <tr key={d.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ ...TD, color: '#94a3b8' }}>{rowNum}</td>
                    <td style={TD}>
                      <Link to={billingDocPath(d.type, d.id)} style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
                        {d.number}
                      </Link>
                    </td>
                    <td style={TD}>{fmtDate(d.document_date)}</td>
                    <td style={TD}>{d.customer?.name || '—'}</td>
                    {isB2B && <td style={{ ...TD, fontFamily: 'monospace', fontSize: 12 }}>{d.customer?.gstin || '—'}</td>}
                    <td style={TD}>{d.place_of_supply || '—'}</td>
                    <td style={TDR}>{gstPct !== '—' ? `${gstPct}%` : '—'}</td>
                    <td style={TDR}>{money(d.taxable_amount)}</td>
                    <td style={TDR}>{money(d.igst_amount)}</td>
                    <td style={TDR}>{money(d.cgst_amount)}</td>
                    <td style={TDR}>{money(d.sgst_amount)}</td>
                    <td style={TDR}>{money(d.grand_total || d.total_amount)}</td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr><td colSpan={isB2B ? 12 : 11} style={{ ...TD, textAlign: 'center', color: '#94a3b8', padding: 28 }}>No {isB2B ? 'B2B' : 'B2C'} documents for this period.</td></tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr style={{ background: '#1e3a5f' }}>
                  <td colSpan={isB2B ? 7 : 6} style={{ ...TH, color: '#7dd3fc' }}>Total</td>
                  <td style={{ ...TH_R, color: '#7dd3fc' }}>{money(totTaxable)}</td>
                  <td style={{ ...TH_R, color: '#7dd3fc' }}>{money(totIgst)}</td>
                  <td style={{ ...TH_R, color: '#7dd3fc' }}>{money(totCgst)}</td>
                  <td style={{ ...TH_R, color: '#7dd3fc' }}>{money(totSgst)}</td>
                  <td style={{ ...TH_R, color: '#7dd3fc' }}>{money(totTotal)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
      {/* Pagination footer */}
      {meta.total > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>
            Showing 1 to {rows.length} of {meta.total} records
          </span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button type="button" onClick={() => { const p = Math.max(1, page - 1); setPage(p); load(p); }}
              disabled={page <= 1}
              style={{ width: 28, height: 28, borderRadius: 6, border: '1.5px solid #e2e8f0', background: '#fff', cursor: page <= 1 ? 'default' : 'pointer', color: '#64748b', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              ‹
            </button>
            {Array.from({ length: meta.last_page }, (_, i) => i + 1).slice(0, 5).map((p) => (
              <button key={p} type="button" onClick={() => { setPage(p); load(p); }}
                style={{ width: 28, height: 28, borderRadius: 6, border: '1.5px solid', borderColor: p === page ? '#2563eb' : '#e2e8f0', background: p === page ? '#2563eb' : '#fff', color: p === page ? '#fff' : '#64748b', fontSize: 13, fontWeight: p === page ? 700 : 400, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {p}
              </button>
            ))}
            <button type="button" onClick={() => { const p = Math.min(meta.last_page, page + 1); setPage(p); load(p); }}
              disabled={page >= meta.last_page}
              style={{ width: 28, height: 28, borderRadius: 6, border: '1.5px solid #e2e8f0', background: '#fff', cursor: page >= meta.last_page ? 'default' : 'pointer', color: '#64748b', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              ›
            </button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

/* ── Request Filing Modal ────────────────────────────────────────── */
function RequestFilingModal({ period, periodLabel, financialYear, onClose, onSuccess }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState(null); // { id, number } after success

  const submit = async () => {
    setBusy(true); setErr('');
    try {
      const r = await api('/client/gst-filing/request', {
        method: 'POST',
        body: {
          financial_year: financialYear,
          filing_period: period,
          return_type: 'GSTR-1',
          client_declaration: true,
        },
      });
      setResult(r.request);
      onSuccess?.();
    } catch (e) {
      setErr(e.message || 'Failed to submit filing request.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 480, boxShadow: '0 24px 48px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
        {result ? (
          /* Success state */
          <div style={{ padding: '32px 28px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' }}><XIcon /></button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircleIcon />
              </div>
            </div>
            <h2 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 800, color: '#1e3a5f' }}>GSTR-1 Filing Request Submitted Successfully</h2>
            <p style={{ margin: '0 0 22px', fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
              Your GSTR-1 filing request for the selected period has been successfully submitted to the CA for verification. The CA will review the billing documents, B2B and B2C summaries, and GST details before proceeding with the filing.
            </p>
            <div style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 18px', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600, minWidth: 80 }}>Status</span>
                <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>Submitted for CA Verification</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600, minWidth: 80 }}>Next Step</span>
                <span style={{ fontSize: 13, color: '#1e293b', fontWeight: 600 }}>CA Review &amp; Verification</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button type="button" onClick={onClose}
                style={{ height: 38, padding: '0 20px', borderRadius: 9, border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                Close
              </button>
            </div>
          </div>
        ) : (
          /* Confirm state */
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1e3a5f', display: 'flex', alignItems: 'center', gap: 8 }}>
                <SendIcon /> Request GSTR-1 Filing
              </h2>
              <button type="button" onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' }}><XIcon /></button>
            </div>
            <div style={{ padding: '20px 22px' }}>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
                You are requesting GSTR-1 filing for <strong style={{ color: '#1e293b' }}>{periodLabel}</strong> (FY {financialYear}).
                The CA will be notified to review your billing documents and proceed with filing.
              </p>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 16px', marginBottom: 18, fontSize: 13, color: '#1e40af', lineHeight: 1.6 }}>
                <strong>I hereby declare</strong> that the information furnished above is correct and complete to the best of my knowledge and belief.
              </div>
              {err && <p style={{ margin: '0 0 12px', color: '#dc2626', fontSize: 13 }}>{err}</p>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={onClose}
                  style={{ height: 38, padding: '0 18px', borderRadius: 9, border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="button" onClick={submit} disabled={busy}
                  style={{ height: 38, padding: '0 20px', borderRadius: 9, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 7, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1 }}>
                  <SendIcon /> {busy ? 'Submitting…' : 'Confirm & Submit'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main page ─────────────────────────────────────────────────── */
const TABS = [
  { key: 'summary', label: 'Summary', Icon: SummaryTabIcon },
  { key: 'b2b', label: 'B2B Supplies (Registered Persons)', Icon: B2BTabIcon },
  { key: 'b2c', label: 'B2C Supplies (Unregistered Persons)', Icon: B2CTabIcon },
];

export default function Gstr1Page() {
  const { user } = useAuth();
  const profile = user?.client_profile;

  const fyOptions = buildFyOptions();
  const [fy, setFy] = useState(fyOptions[0] || '2026-27');
  const monthOptions = fyMonthOptions(fy);

  // default to current month within FY, or first month
  const defaultPeriod = () => {
    const today = new Date().toISOString().slice(0, 7);
    return monthOptions.find((m) => m.value === today)?.value || monthOptions[0]?.value || '';
  };
  const [period, setPeriod] = useState(defaultPeriod);

  const [activeTab, setActiveTab] = useState('summary');
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [requestModal, setRequestModal] = useState(false);

  const loadSummary = useCallback(() => {
    if (!period) return;
    setSummaryLoading(true);
    api(`/client/gst-filing/gstr1-summary?filing_period=${period}`)
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setSummaryLoading(false));
  }, [period]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  // When FY changes, reset period to first month of new FY
  const handleFyChange = (newFy) => {
    setFy(newFy);
    const opts = fyMonthOptions(newFy);
    setPeriod(opts[0]?.value || '');
  };

  const selectedMonthLabel = monthOptions.find((m) => m.value === period)?.label || period;

  const CTL = { height: 34, padding: '0 10px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 13, fontWeight: 600, color: '#1e293b', background: '#fff' };

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
        <Link to="/portal" style={{ color: '#2563eb', textDecoration: 'none' }}>Home</Link>
        <span>›</span>
        <span style={{ color: '#64748b' }}>GST Compliance</span>
        <span>›</span>
        <span style={{ color: '#1e293b' }}>GSTR-1</span>
      </div>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#1e3a5f' }}>GSTR-1</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>Outward supplies details for the selected period</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select style={CTL} value={fy} onChange={(e) => handleFyChange(e.target.value)}>
            {fyOptions.map((f) => <option key={f} value={f}>FY {f}</option>)}
          </select>
          <select style={CTL} value={period} onChange={(e) => setPeriod(e.target.value)}>
            {monthOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <button type="button"
            onClick={() => setRequestModal(true)}
            style={{ height: 36, padding: '0 18px', borderRadius: 9, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', boxShadow: '0 2px 10px rgba(37,99,235,0.3)' }}>
            <SendIcon /> Request for Filing
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: 20, gap: 0 }}>
        {TABS.map((t) => {
          const active = activeTab === t.key;
          return (
            <button key={t.key} type="button" onClick={() => setActiveTab(t.key)}
              style={{
                padding: '11px 20px', border: 'none', cursor: 'pointer', fontWeight: active ? 700 : 500,
                fontSize: 13, display: 'flex', alignItems: 'center', gap: 7,
                background: active ? '#2563eb' : '#fff',
                color: active ? '#fff' : '#64748b',
                borderRadius: active ? '8px 8px 0 0' : 0,
                borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
                marginBottom: -2, whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}>
              <t.Icon /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'summary' && (
        <SummaryTab summary={summary} loading={summaryLoading} />
      )}
      {activeTab === 'b2b' && <DocumentListTab gstType="b2b" period={period} />}
      {activeTab === 'b2c' && <DocumentListTab gstType="b2c" period={period} />}

      {/* Request Filing modal */}
      {requestModal && (
        <RequestFilingModal
          period={period}
          periodLabel={selectedMonthLabel}
          financialYear={fy}
          onClose={() => setRequestModal(false)}
          onSuccess={() => { /* reload summary after filing */ loadSummary(); }}
        />
      )}
    </div>
  );
}
