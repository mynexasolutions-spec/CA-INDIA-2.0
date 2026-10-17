import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useClientPortal } from '../../components/portal/ClientPortalContext';
import { LoadingBlock } from '../../components/Spinner';
import { buildFyOptions, fyMonthOptions, billingDocPath } from '../billing/billingUtils';

/* ── Helpers ───────────────────────────────────────────────────── */
function money(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

/* ── Export (Excel / Predefined CSV / JSON) ────────────────────── */
function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
function exportTable(format, baseName, headers, rows) {
  if (format === 'JSON') {
    const objs = rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i]])));
    saveBlob(new Blob([JSON.stringify(objs, null, 2)], { type: 'application/json' }), `${baseName}.json`);
  } else if (format === 'Predefined CSV') {
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((r) => r.map(q).join(',')).join('\r\n');
    saveBlob(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }), `${baseName}.csv`);
  } else {
    const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const html = `<html><head><meta charset="utf-8"></head><body><table border="1" cellspacing="0" cellpadding="4"><thead><tr>${headers.map((h) => `<th style="background:#e8f0fe">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;
    saveBlob(new Blob([html], { type: 'application/vnd.ms-excel' }), `${baseName}.xls`);
  }
}

/* ── Table header cell style ────────────────────────────────────── */
const TH = { padding: '11px 14px', textAlign: 'left', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap', background: '#e9f0fb', color: '#0f2a5f', borderBottom: '1px solid #d6e3f7' };
const TD = { padding: '11px 14px', fontSize: 13, color: '#1e293b', whiteSpace: 'nowrap', borderBottom: '1px solid #eef3fa' };
const TDR = { ...TD, textAlign: 'center' };
const TH_R = { ...TH, textAlign: 'center' };

function SectionCard({ icon, title, children, right }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #dfe8f5', overflow: 'hidden', marginBottom: 20, boxShadow: '0 14px 30px -26px rgba(15,42,95,.55)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px 10px', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, fontSize: 14.5, color: '#0f2a5f' }}>
          <span className="cl-sec-ic" style={{ width: 32, height: 32, background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: '#ffffff', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 14px -8px rgba(29,78,216,.8)' }}>
            {icon}
          </span>
          {title}
        </div>
        {right}
      </div>
      <div style={{ padding: '0 14px 14px' }}>{children}</div>
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
                <tr style={{ background: '#e3ecfa' }}>
                  <td style={{ ...TH, color: '#0f2a5f', fontSize: 15, fontWeight: 800, background: '#e3ecfa', padding: '14px' }}>Total</td>
                  <td style={{ ...TH_R, color: '#0f2a5f', fontSize: 15, fontWeight: 800, background: '#e3ecfa', padding: '14px' }}>{Number(docTotals.count || 0).toLocaleString('en-IN')}</td>
                  <td style={{ ...TH_R, color: '#0f2a5f', fontSize: 15, fontWeight: 800, background: '#e3ecfa', padding: '14px' }}>{money(docTotals.taxable)}</td>
                  <td style={{ ...TH_R, color: '#0f2a5f', fontSize: 15, fontWeight: 800, background: '#e3ecfa', padding: '14px' }}>{money(docTotals.igst)}</td>
                  <td style={{ ...TH_R, color: '#0f2a5f', fontSize: 15, fontWeight: 800, background: '#e3ecfa', padding: '14px' }}>{money(docTotals.cgst)}</td>
                  <td style={{ ...TH_R, color: '#0f2a5f', fontSize: 15, fontWeight: 800, background: '#e3ecfa', padding: '14px' }}>{money(docTotals.sgst)}</td>
                  <td style={{ ...TH_R, color: '#0f2a5f', fontSize: 15, fontWeight: 800, background: '#e3ecfa', padding: '14px' }}>{money(docTotals.total)}</td>
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
              onClick={() => exportTable(hsnFormat, 'gstr1_hsn_summary',
                ['HSN/SAC Code', 'Description', 'GST %', 'QTY', 'UQC', 'Taxable Value', 'IGST', 'CGST', 'SGST', 'Total Invoice Value'],
                hsn_summary.map((r) => [r.hsn_sac, r.description, r.gst_rate, r.qty, r.uqc || r.unit || '', r.taxable, r.igst, r.cgst, r.sgst, r.total]))}
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
                <tr style={{ background: '#e3ecfa' }}>
                  <td style={{ ...TH, color: '#0f2a5f', fontSize: 15, fontWeight: 800, background: '#e3ecfa', padding: '14px' }}>Total</td>
                  <td style={TH}>—</td>
                  <td style={TH}>—</td>
                  <td style={{ ...TH_R, color: '#0f2a5f', fontSize: 15, fontWeight: 800, background: '#e3ecfa', padding: '14px' }}>{hsn_summary.reduce((s, r) => s + Number(r.qty), 0).toFixed(2)}</td>
                  <td style={TH}>—</td>
                  <td style={{ ...TH_R, color: '#0f2a5f', fontSize: 15, fontWeight: 800, background: '#e3ecfa', padding: '14px' }}>{money(hsn_summary.reduce((s, r) => s + Number(r.taxable_value), 0))}</td>
                  <td style={{ ...TH_R, color: '#0f2a5f', fontSize: 15, fontWeight: 800, background: '#e3ecfa', padding: '14px' }}>{money(hsn_summary.reduce((s, r) => s + Number(r.igst), 0))}</td>
                  <td style={{ ...TH_R, color: '#0f2a5f', fontSize: 15, fontWeight: 800, background: '#e3ecfa', padding: '14px' }}>{money(hsn_summary.reduce((s, r) => s + Number(r.cgst), 0))}</td>
                  <td style={{ ...TH_R, color: '#0f2a5f', fontSize: 15, fontWeight: 800, background: '#e3ecfa', padding: '14px' }}>{money(hsn_summary.reduce((s, r) => s + Number(r.sgst), 0))}</td>
                  <td style={{ ...TH_R, color: '#0f2a5f', fontSize: 15, fontWeight: 800, background: '#e3ecfa', padding: '14px' }}>{money(hsn_summary.reduce((s, r) => s + Number(r.total), 0))}</td>
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
  const [exporting, setExporting] = useState(false);

  const periodRange = () => {
    const [y, m] = period.split('-');
    const lastDay = new Date(parseInt(y, 10), parseInt(m, 10), 0).getDate();
    return { docFrom: `${y}-${m}-01`, docTo: `${y}-${m}-${String(lastDay).padStart(2, '0')}` };
  };

  const exportAll = async () => {
    if (!period) return;
    setExporting(true);
    try {
      const { docFrom, docTo } = periodRange();
      const qs = new URLSearchParams({ gst_type: gstType, doc_from: docFrom, doc_to: docTo, per_page: '1000', page: '1' });
      if (docType) qs.set('type', docType);
      const d = await api(`/billing/documents?${qs}`);
      const list = d.data || [];
      const withGstin = gstType === 'b2b';
      const headers = ['S. No.', 'Invoice No.', 'Invoice Date', 'Party Name', ...(withGstin ? ['GSTIN'] : []), 'Place of Supply', 'GST %', 'Taxable Value', 'IGST', 'CGST', 'SGST', 'Total Value'];
      const body = list.map((r, i) => [
        i + 1, r.number, r.document_date ? String(r.document_date).slice(0, 10) : '', r.customer?.name || '',
        ...(withGstin ? [r.customer?.gstin || ''] : []), r.place_of_supply || '', (() => { const rs = [...new Set((r.line_items || []).map((l) => Number(l.gst_rate)))]; return rs.length === 1 ? rs[0] : rs.length ? 'Mixed' : ''; })(),
        Number(r.taxable_amount || 0).toFixed(2), Number(r.igst_amount || 0).toFixed(2), Number(r.cgst_amount || 0).toFixed(2),
        Number(r.sgst_amount || 0).toFixed(2), Number(r.grand_total || r.total_amount || 0).toFixed(2),
      ]);
      exportTable(fmt, `gstr1_${gstType}_${period}`, headers, body);
    } catch { /* the table above already shows load errors */ } finally { setExporting(false); }
  };

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
      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="13" y2="17" /></svg>}
      title="Document List"
      right={
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11.5, color: '#334155', fontWeight: 700 }}>Document Type</span>
            <select value={docType} onChange={(e) => setDocType(e.target.value)}
              style={{ height: 36, padding: '0 10px', borderRadius: 9, border: '1px solid #cfdcf0', fontSize: 12.5, background: '#fff', color: '#1e293b', minWidth: 150 }}>
              {DOC_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11.5, color: '#334155', fontWeight: 700 }}>Format</span>
            <select value={fmt} onChange={(e) => setFmt(e.target.value)}
              style={{ height: 36, padding: '0 10px', borderRadius: 9, border: '1px solid #cfdcf0', fontSize: 12.5, background: '#fff', color: '#1e293b', minWidth: 130 }}>
              {EXPORT_FORMATS.map((f) => <option key={f}>{f}</option>)}
            </select>
          </div>
          <button type="button" onClick={exportAll} disabled={exporting}
            style={{ height: 40, padding: '0 22px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: '#fff', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, cursor: exporting ? 'wait' : 'pointer', alignSelf: 'flex-end', opacity: exporting ? 0.7 : 1, boxShadow: '0 10px 16px -10px rgba(29,78,216,.85)' }}>
            <DownloadIcon /> {exporting ? 'Exporting…' : 'Export'}
          </button>
        </div>
      }
    >
      {loading ? <LoadingBlock minHeight={120} /> : (
        <div style={{ overflowX: 'auto' }}>
          <table className="gl-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...TH, width: 40 }}>S. No.</th>
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
                const rates = [...new Set((d.line_items || []).map((l) => Number(l.gst_rate)))];
                const gstPct = rates.length === 0 ? '—' : rates.length === 1 ? rates[0] : 'Mixed';
                return (
                  <tr key={d.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ ...TD, color: '#94a3b8' }}>{rowNum}</td>
                    <td style={TD}>
                      <Link to={billingDocPath(d.type, d.id)} style={{ color: '#1d4ed8', fontWeight: 700, textDecoration: 'underline' }}>
                        {d.number}
                      </Link>
                    </td>
                    <td style={TD}>{fmtDate(d.document_date)}</td>
                    <td style={TD}>{d.customer?.name || '—'}</td>
                    {isB2B && <td style={{ ...TD, fontFamily: 'monospace', fontSize: 12 }}>{d.customer?.gstin || '—'}</td>}
                    <td style={TD}>{d.place_of_supply || '—'}</td>
                    <td style={TDR}>{typeof gstPct === 'number' ? `${gstPct}%` : gstPct}</td>
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
                <tr style={{ background: '#e3ecfa' }}>
                  <td colSpan={isB2B ? 7 : 6} style={{ ...TH, color: '#0f2a5f', fontSize: 15, fontWeight: 800, background: '#e3ecfa', padding: '14px' }}>Total</td>
                  <td style={{ ...TH_R, color: '#0f2a5f', fontSize: 15, fontWeight: 800, background: '#e3ecfa', padding: '14px' }}>{money(totTaxable)}</td>
                  <td style={{ ...TH_R, color: '#0f2a5f', fontSize: 15, fontWeight: 800, background: '#e3ecfa', padding: '14px' }}>{money(totIgst)}</td>
                  <td style={{ ...TH_R, color: '#0f2a5f', fontSize: 15, fontWeight: 800, background: '#e3ecfa', padding: '14px' }}>{money(totCgst)}</td>
                  <td style={{ ...TH_R, color: '#0f2a5f', fontSize: 15, fontWeight: 800, background: '#e3ecfa', padding: '14px' }}>{money(totSgst)}</td>
                  <td style={{ ...TH_R, color: '#0f2a5f', fontSize: 15, fontWeight: 800, background: '#e3ecfa', padding: '14px' }}>{money(totTotal)}</td>
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
            Showing {(meta.current_page - 1) * perPage + 1} to {(meta.current_page - 1) * perPage + rows.length} of {meta.total} records
          </span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button type="button" onClick={() => { const p = Math.max(1, page - 1); setPage(p); load(p); }}
              disabled={page <= 1}
              style={{ width: 34, height: 34, borderRadius: 9, border: '1.5px solid #e2e8f0', background: '#fff', cursor: page <= 1 ? 'default' : 'pointer', color: '#64748b', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              ‹
            </button>
            {Array.from({ length: meta.last_page }, (_, i) => i + 1).slice(0, 5).map((p) => (
              <button key={p} type="button" onClick={() => { setPage(p); load(p); }}
                style={{ width: 34, height: 34, borderRadius: 9, border: '1.5px solid', borderColor: p === page ? '#2563eb' : '#e2e8f0', background: p === page ? '#2563eb' : '#fff', color: p === page ? '#fff' : '#64748b', fontSize: 13, fontWeight: p === page ? 700 : 400, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {p}
              </button>
            ))}
            <button type="button" onClick={() => { const p = Math.min(meta.last_page, page + 1); setPage(p); load(p); }}
              disabled={page >= meta.last_page}
              style={{ width: 34, height: 34, borderRadius: 9, border: '1.5px solid #e2e8f0', background: '#fff', cursor: page >= meta.last_page ? 'default' : 'pointer', color: '#64748b', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
  const navigate = useNavigate();
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
                <span style={{ fontSize: 13, color: '#475569', fontWeight: 700, minWidth: 74 }}>Status</span>
                <span style={{ color: '#94a3b8' }}>:</span>
                <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '3px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>Submitted for CA Verification</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, color: '#475569', fontWeight: 700, minWidth: 74 }}>Next Step</span>
                <span style={{ color: '#94a3b8' }}>:</span>
                <span style={{ fontSize: 13, color: '#1e293b', fontWeight: 600 }}>CA Review &amp; Verification</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => navigate(`/portal/gst-filing?request=${result.id}`)}
                style={{ height: 38, padding: '0 22px', borderRadius: 9, border: '1px solid #bfd3f6', background: '#fff', color: '#1d4ed8', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                View Request
              </button>
              <button type="button" onClick={onClose}
                style={{ height: 38, padding: '0 26px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', boxShadow: '0 8px 14px -8px rgba(37,99,235,.8)' }}>
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

/* ── Filing Periods overview (the GSTR-1 landing screen) ─────────── */
function periodStatusStyle(status) {
  const t = String(status || '').toLowerCase();
  if (t.includes('filed') && !t.includes('not')) return { label: 'Filed', bg: '#dcfce7', fg: '#15803d' };
  if (t.includes('request not raised')) return { label: 'Request Not Raised', bg: '#eef1f6', fg: '#475569' };
  if (t.includes('pending') || t.includes('request raised') || t.includes('approved')) return { label: 'Pending', bg: '#ffe8d6', fg: '#c2410c' };
  return { label: 'Upcoming', bg: '#e6ebf3', fg: '#64748b' };
}

function InfoRow({ k, children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '116px 10px 1fr', alignItems: 'center', fontSize: 12.5, lineHeight: 1.9, marginBottom: 5 }}>
      <span style={{ color: '#64748b', fontWeight: 600 }}>{k}</span>
      <span style={{ color: '#94a3b8' }}>:</span>
      <span style={{ color: '#0f2a5f', fontWeight: 700 }}>{children}</span>
    </div>
  );
}
const Pill = ({ bg, fg, children }) => (
  <span style={{ display: 'inline-block', padding: '2px 12px', borderRadius: 999, background: bg, color: fg, fontSize: 11.5, fontWeight: 800 }}>{children}</span>
);

function Gstr1PeriodsView({ fy, onRequestFiling }) {
  const { user } = useAuth();
  const profile = user?.client_profile || {};
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let live = true;
    setLoading(true); setErr('');
    api(`/client/gst-filing/periods?${new URLSearchParams({ financial_year: fy, return_type: 'GSTR-1' })}`)
      .then((d) => { if (live) setData(d); })
      .catch((e) => { if (live) setErr(e.message); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [fy]);

  const periods = data?.periods || [];
  const summary = data?.summary || {};
  const last = summary.last_filed;
  const cur = summary.next_due;
  const curIdx = cur ? periods.findIndex((x) => x.period === cur.period) : -1;
  const nextRow = curIdx >= 0 ? periods[curIdx + 1] : null;
  const freq = profile.gstr1_filing_frequency === 'quarterly' ? 'Quarterly' : 'Monthly';
  const regType = profile.registration_type || (profile.dealer_type === 'composition' ? 'Composition' : 'Regular');
  const card = { background: '#fff', border: '1px solid #e3ebf6', borderRadius: 16, padding: '16px 20px', display: 'flex', gap: 14, alignItems: 'flex-start', boxShadow: '0 10px 24px -22px rgba(15,42,95,.6)' };
  const ico = (path) => (
    <span style={{ width: 40, height: 40, borderRadius: 12, background: '#e6eeff', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{path}</svg>
    </span>
  );

  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
        <Link to="/portal" style={{ color: '#2563eb', textDecoration: 'none' }}>Home</Link><span>›</span>
        <span>GST Compliance</span><span>›</span><span style={{ color: '#1e293b' }}>GSTR-1</span>
      </div>

      <div className="cl-gst-head" style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#0f2a5f', letterSpacing: '-0.01em' }}>GSTR-1 – Outward Supplies</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>View filing status, due dates and request for filing. Your billing documents will be automatically fetched for the selected period.</p>
      </div>

      <div className="cl-info3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16, marginBottom: 16 }}>
        <div style={card}>
          {ico(<><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M9 21v-4h6v4M9 7h.01M9 11h.01M15 7h.01M15 11h.01" /></>)}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, color: '#0f2a5f', marginBottom: 4 }}>Client Details</div>
            <InfoRow k="Client Name">{profile.business_name || user?.name || '—'}</InfoRow>
            <InfoRow k="GSTIN">{profile.gstin || '—'}</InfoRow>
            <InfoRow k="Registration Type"><Pill bg="#dcfce7" fg="#15803d">{regType}</Pill></InfoRow>
            <InfoRow k="Filing Frequency"><Pill bg="#dbeafe" fg="#1d4ed8">{freq}</Pill></InfoRow>
          </div>
        </div>

        <div style={card}>
          {ico(<><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>)}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, color: '#0f2a5f', marginBottom: 4 }}>Last GSTR-1 Filed</div>
            <InfoRow k="Return Period">{last ? (last.period_label || last.period) : '—'}</InfoRow>
            <InfoRow k="Filed On">{last?.filed_on ? fmtDate(last.filed_on) : '—'}</InfoRow>
            <InfoRow k="ARN">{last?.ack_no || last?.arn || '—'}</InfoRow>
            <InfoRow k="Status">{last ? <Pill bg="#dcfce7" fg="#15803d">Filed</Pill> : '—'}</InfoRow>
          </div>
        </div>

        <div style={card}>
          {ico(<><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>)}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, color: '#0f2a5f', marginBottom: 4 }}>Upcoming Due Dates</div>
            <InfoRow k="Current Due Date">{cur?.date ? fmtDate(cur.date) : '—'}</InfoRow>
            <InfoRow k="Next Due Date">{nextRow?.due_date ? fmtDate(nextRow.due_date) : '—'}</InfoRow>
          </div>
        </div>
      </div>

      <div className="cl-gst-note" style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#eaf3ff', border: '1px solid #cfe2ff', borderRadius: 12, padding: '12px 18px', marginBottom: 18, fontSize: 13, color: '#1e3a8a' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#2563eb"><circle cx="12" cy="12" r="10" /><line x1="12" y1="11" x2="12" y2="16" stroke="white" strokeWidth="2.2" strokeLinecap="round" /><line x1="12" y1="7.5" x2="12.01" y2="7.5" stroke="white" strokeWidth="2.4" strokeLinecap="round" /></svg>
        <span>Your GST registration is <b>{regType}</b> and the filing frequency is <b>{freq}</b>. Your billing documents will be automatically fetched when you request for filing.</span>
      </div>

      <div className="il-card cl-gst-periods" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f2a5f' }}>Filing Periods (FY {fy})</h3>
        </div>
        {err && <p className="bp-alert bp-alert-error" style={{ margin: '0 20px 14px' }}>{err}</p>}
        {loading ? <div style={{ padding: 28 }}><LoadingBlock /></div> : (
          <div style={{ overflowX: 'auto', padding: '0 20px 6px' }}>
            <table className="bp-table bd-table fp-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  {['Tax Period', 'Due Date', 'Status', 'Filed On', 'ARN', 'Action'].map((h) => (
                    <th key={h} style={{ background: '#0f3a8a', color: '#fff', textAlign: 'center' }}>{h.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map((raw) => {
                  const nowYm = new Date().toISOString().slice(0, 7);
                  const isFuture = raw.period > nowYm && String(raw.status || '').toLowerCase().includes('not raised');
                  const row = isFuture ? { ...raw, status: 'Upcoming', action: null } : raw;
                  const st = periodStatusStyle(row.status);
                  return (
                    <tr key={row.period}>
                      <td style={{ fontWeight: 800, color: '#0f2a5f', whiteSpace: 'nowrap' }}>{row.period_label}</td>
                      <td style={{ whiteSpace: 'nowrap', color: '#334155' }}>{fmtDate(row.due_date)}</td>
                      <td><span style={{ display: 'inline-block', minWidth: 118, padding: '5px 14px', borderRadius: 999, background: st.bg, color: st.fg, fontSize: 11.5, fontWeight: 800 }}>{st.label}</span></td>
                      <td style={{ color: row.filed_on ? '#334155' : '#94a3b8' }}>{row.filed_on ? fmtDate(row.filed_on) : '—'}</td>
                      <td style={{ color: row.ack_no ? '#1d4ed8' : '#94a3b8', fontFamily: row.ack_no ? 'monospace' : undefined, fontWeight: row.ack_no ? 700 : 400 }}>{row.ack_no || '—'}</td>
                      <td>
                        {row.action === 'request_filing' ? (
                          <button type="button" onClick={() => onRequestFiling(row.period)}
                            style={{ height: 34, padding: '0 18px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: '#fff', fontWeight: 700, fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', boxShadow: '0 8px 14px -8px rgba(29,78,216,.8)' }}>
                            <SendIcon /> Request Filing
                          </button>
                        ) : row.action === 'view_details' && row.filing_request_id ? (
                          <Link to={`/portal/gst-filing?request=${row.filing_request_id}`}
                            style={{ display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 18px', borderRadius: 9, border: '1px solid #bfd3f6', background: '#fff', color: '#1d4ed8', fontWeight: 700, fontSize: 12.5, textDecoration: 'none' }}>
                            View Request
                          </Link>
                        ) : <span style={{ color: '#94a3b8' }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
                {!periods.length && <tr><td colSpan={6} style={{ padding: '40px 16px', color: '#94a3b8' }}>No filing periods found for FY {fy}.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ margin: '14px 20px 18px', padding: '11px 16px', background: '#eaf3ff', border: '1px solid #cfe2ff', borderRadius: 12, fontSize: 12.5, color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#2563eb"><circle cx="12" cy="12" r="10" /><line x1="12" y1="11" x2="12" y2="16" stroke="white" strokeWidth="2.2" strokeLinecap="round" /><line x1="12" y1="7.5" x2="12.01" y2="7.5" stroke="white" strokeWidth="2.4" strokeLinecap="round" /></svg>
          All dates are in format: DD:MM:YYYY <span style={{ opacity: 0.4 }}>|</span> Future months are shown for your reference.
        </div>
      </div>
    </div>
  );
}

export default function Gstr1Page() {

  const portal = useClientPortal();
  const fyOptions = buildFyOptions();
  const [fy, setFy] = useState(portal?.fy || fyOptions[0] || '2026-27');
  const [view, setView] = useState('periods'); // 'periods' (landing) | 'detail' (one period's summary + request)
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

  const selectedMonthLabel = monthOptions.find((m) => m.value === period)?.label || period;

  if (view === 'periods') {
    return (
      <Gstr1PeriodsView
        fy={portal?.fy || fy}
        onRequestFiling={(p) => {
          const startYear = Number(p.slice(0, 4)) - (Number(p.slice(5, 7)) < 4 ? 1 : 0);
          const f = `${startYear}-${String(startYear + 1).slice(-2)}`;
          setFy(f);
          setPeriod(p);
          setView('detail');
        }}
      />
    );
  }

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
          <button type="button" onClick={() => setView('periods')} style={{ background: 'none', border: 'none', padding: 0, marginBottom: 8, color: '#2563eb', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>‹ Back to Filing Periods</button>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#1e3a5f' }}>GSTR-1</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>Outward supplies details for the selected period</p>
          <span style={{ display: 'inline-block', marginTop: 8, padding: '3px 12px', borderRadius: 999, background: '#e6eeff', color: '#1d4ed8', fontSize: 12, fontWeight: 800 }}>{selectedMonthLabel} · FY {fy}</span>
        </div>
        <button type="button" className="cl-req-btn"
          onClick={() => setRequestModal(true)}
          style={{ height: 50, padding: '0 28px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: '#fff', fontWeight: 800, fontSize: 14.5, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', boxShadow: '0 14px 22px -12px rgba(29,78,216,.85)' }}>
          <SendIcon /> Request for Filing
        </button>
      </div>

      {/* Tab bar — three equal segments, selected one filled blue */}
      <div className="cl-gtabs" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', border: '1px solid #cfe0fa', borderRadius: 14, overflow: 'hidden', marginBottom: 20, background: '#fff' }}>
        {TABS.map((t, i) => {
          const active = activeTab === t.key;
          const [main, ...rest] = t.label.split(' (');
          const sub = rest.length ? `(${rest.join(' (')}` : '';
          return (
            <button key={t.key} type="button" className="cl-gtab" onClick={() => setActiveTab(t.key)}
              style={{
                height: 54, border: 'none', borderLeft: i ? '1px solid #cfe0fa' : 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                background: active ? 'linear-gradient(135deg,#2563eb,#1d4ed8)' : '#fff',
                color: active ? '#fff' : '#0f2a5f', fontSize: 14, fontWeight: 800, transition: 'background .15s',
              }}>
              <t.Icon />
              <span>{main}{sub && <span style={{ fontWeight: 500, fontSize: 12.5, opacity: 0.85 }}> {sub}</span>}</span>
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
