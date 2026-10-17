import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getAuthToken } from '../../api/client';
import { LoadingBlock } from '../../components/Spinner';
import { partyDocumentSections } from './billingProfile';
import { filterDocsByPeriod, money } from './billingUtils';
import { useReportsEnv } from './ReportsContext';

const TYPE_LABEL = {
  tax_invoice: 'Tax Invoice',
  bill_of_supply: 'Bill of Supply',
  debit_note: 'Debit Note',
  credit_note: 'Credit Note',
};

function fmtDate(v) {
  if (!v) return '—';
  const s = String(v).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${m[3]}-${months[Number(m[2]) - 1]}-${m[1]}`;
}

function fmtDateShort(v) {
  // "01-Apr-2026" style
  if (!v) return '—';
  const s = String(v).slice(0, 10);
  const mm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!mm) return s;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${mm[3]}-${months[Number(mm[2]) - 1]}-${mm[1]}`;
}

function numFmt(v) {
  return Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function sortDocs(list) {
  return [...list].sort((a, b) => {
    const da = String(a.created_at || '');
    const db = String(b.created_at || '');
    if (da !== db) return da.localeCompare(db);
    return String(a.number || '').localeCompare(String(b.number || ''));
  });
}

// ── Icons ─────────────────────────────────────────────────────
function ExcelIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
      <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><line x1="10" y1="9" x2="14" y2="9"/>
    </svg>
  );
}
function PdfIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
    </svg>
  );
}
function CalIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}
function DocIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  );
}
function ExternalLinkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  );
}
function InfoIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  );
}
function TableIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/>
      <line x1="9" y1="9" x2="9" y2="21"/><line x1="15" y1="9" x2="15" y2="21"/>
    </svg>
  );
}

const PAGE_SIZES = [10, 25, 50];

export default function PartyDocumentsModal({
  open,
  onClose,
  partyName,
  fetchUrl = null,
  documents = null,
  detailBasePath = null,
  profile = null,
  from = '',
  to = '',
  fy = '',
}) {
  const env = useReportsEnv();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (!open) return;
    setErr(''); setPage(1);
    if (Array.isArray(documents)) { setRows(documents); setLoading(false); return; }
    if (!fetchUrl) { setRows([]); return; }
    setLoading(true);
    api(fetchUrl)
      .then((d) => setRows(d.data || d || []))
      .catch((e) => setErr(e.message || 'Failed to load documents'))
      .finally(() => setLoading(false));
  }, [open, fetchUrl, documents]);

  const periodDocs = useMemo(() => filterDocsByPeriod(rows, { from, to }), [rows, from, to]);
  const allowedTypes = useMemo(() => new Set(partyDocumentSections(profile).map((s) => s.type)), [profile]);
  const flatDocs = useMemo(() => sortDocs(periodDocs.filter((d) => allowedTypes.has(d.type))), [periodDocs, allowedTypes]);

  if (!open) return null;

  const viewPath = (doc) => {
    if (detailBasePath) return `${detailBasePath}/${doc.id}`;
    return env.docLink(doc.type, doc.id);
  };

  // FY label
  const fyLabel = fy ? `FY ${fy}` : (from ? `FY ${from.slice(0, 4)}-${String(Number(from.slice(0, 4)) + 1).slice(2)}` : '');

  // Pagination
  const total = flatDocs.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = flatDocs.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Totals — Credit Notes reduce this party's business value, so they're subtracted
  // rather than added when combining across the mixed document types shown here.
  const sign = (r) => (r.type === 'credit_note' ? -1 : 1);
  const totTaxable = flatDocs.reduce((s, r) => s + sign(r) * Number(r.taxable_amount || 0), 0);
  const totCgst    = flatDocs.reduce((s, r) => s + sign(r) * Number(r.cgst_amount || 0), 0);
  const totSgst    = flatDocs.reduce((s, r) => s + sign(r) * Number(r.sgst_amount || 0), 0);
  const totIgst    = flatDocs.reduce((s, r) => s + sign(r) * Number(r.igst_amount || 0), 0);
  const totTotal   = flatDocs.reduce((s, r) => s + sign(r) * Number(r.grand_total || r.total_amount || 0), 0);

  const downloadModal = async (format) => {
    const token = getAuthToken();
    const qs = new URLSearchParams({ type: 'party_documents', from, to, format });
    const res = await fetch(`${env.exportUrl}?${qs}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: '*/*' },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    // Export is legacy SpreadsheetML XML, not real OOXML — must be named .xls, not
    // .xlsx, or Excel refuses to open it ("file format or extension is not valid").
    a.download = `party_docs_${partyName || 'party'}.${format === 'xlsx' ? 'xls' : 'pdf'}`;
    a.click();
  };

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 80,
        background: 'rgba(15,23,42,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, backdropFilter: 'blur(2px)',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(1060px, 100%)',
          maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
          overflow: 'hidden',
        }}
      >
        {/* ── Modal Header ─────────────────────────────── */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #e2e8f0', background: '#fff', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            {/* Title row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <DocIcon />
                {/* replace with styled icon */}
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute' }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>
                </svg>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--bp-navy)' }}>
                  Party Document Details — {partyName || 'Party'}
                </h3>
                {/* Sub-info chips */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 5, flexWrap: 'wrap' }}>
                  {fyLabel && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#64748b' }}>
                      <CalIcon /> {fyLabel}
                    </span>
                  )}
                  {(from || to) && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#64748b' }}>
                      <CalIcon /> {fmtDateShort(from)} to {fmtDateShort(to)}
                    </span>
                  )}
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#2563eb', fontWeight: 700 }}>
                    <DocIcon />
                    {loading ? '…' : `${total} Document${total === 1 ? '' : 's'}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button type="button" onClick={() => downloadModal('xlsx')}
                style={{ height: 36, padding: '0 13px', borderRadius: 8, border: '1.5px solid #16a34a', background: '#fff', color: '#16a34a', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <ExcelIcon /> Export Excel
              </button>
              <button type="button" onClick={() => downloadModal('pdf')}
                style={{ height: 36, padding: '0 13px', borderRadius: 8, border: '1.5px solid #ef4444', background: '#fff', color: '#ef4444', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <PdfIcon /> Export PDF
              </button>
              <button type="button" onClick={onClose}
                style={{ height: 36, padding: '0 13px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', color: 'var(--bp-text)', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
                Close
              </button>
            </div>
          </div>

          {/* Filter pills bar */}
          {(fy || from || to || partyName) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '9px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12, flexWrap: 'wrap' }}>
              <InfoIcon />
              <span style={{ color: '#475569', fontWeight: 600 }}>Filtered By:</span>
              {fyLabel && <span style={{ color: '#475569' }}>• Financial Year: <strong style={{ color: '#1e293b' }}>{fyLabel}</strong></span>}
              {from && <span style={{ color: '#475569' }}>• From Date: <strong style={{ color: '#1e293b' }}>{fmtDateShort(from)}</strong></span>}
              {to   && <span style={{ color: '#475569' }}>• To Date: <strong style={{ color: '#1e293b' }}>{fmtDateShort(to)}</strong></span>}
              {partyName && <span style={{ color: '#475569' }}>• Party Name: <strong style={{ color: '#2563eb' }}>{partyName}</strong></span>}
            </div>
          )}
        </div>

        {/* ── Table ──────────────────────────────────── */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {err && <p style={{ color: '#ef4444', margin: '12px 16px', fontSize: 13 }}>{err}</p>}
          {loading ? (
            <LoadingBlock />
          ) : flatDocs.length === 0 ? (
            <div style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--bp-muted)', fontSize: 13 }}>
              No documents found for this period.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  {['Sr. No.','Document Type','Document No.','Date','Taxable Value (₹)','CGST (₹)','SGST (₹)','IGST (₹)','Total (₹)'].map((h, i) => (
                    <th key={h} style={{ padding: '11px 16px', textAlign: i >= 4 ? 'right' : i === 0 ? 'center' : 'left', fontSize: 12, fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r, i) => {
                  const srNo = (safePage - 1) * pageSize + i + 1;
                  const path = viewPath(r);
                  return (
                    <tr key={r.id || `${r.type}-${r.number}`}
                      style={{ borderBottom: '1px solid #f1f5f9', background: '#fff', transition: 'background .1s' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                    >
                      <td style={{ padding: '13px 16px', textAlign: 'center', fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>{srNo}</td>
                      <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--bp-text)' }}>{TYPE_LABEL[r.type] || r.type}</td>
                      <td style={{ padding: '13px 16px', fontSize: 13 }}>
                        {r.id ? (
                          <Link to={path} onClick={onClose}
                            style={{ fontWeight: 700, color: '#2563eb', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                            {r.number} <ExternalLinkIcon />
                          </Link>
                        ) : (r.number || '—')}
                      </td>
                      <td style={{ padding: '13px 16px', fontSize: 13, color: '#475569' }}>{fmtDate(r.document_date)}</td>
                      <td style={{ padding: '13px 16px', textAlign: 'right', fontSize: 13 }}>{numFmt(r.taxable_amount)}</td>
                      <td style={{ padding: '13px 16px', textAlign: 'right', fontSize: 13 }}>{numFmt(r.cgst_amount)}</td>
                      <td style={{ padding: '13px 16px', textAlign: 'right', fontSize: 13 }}>{numFmt(r.sgst_amount)}</td>
                      <td style={{ padding: '13px 16px', textAlign: 'right', fontSize: 13 }}>{numFmt(r.igst_amount)}</td>
                      <td style={{ padding: '13px 16px', textAlign: 'right', fontSize: 13, fontWeight: 600 }}>{numFmt(r.grand_total || r.total_amount)}</td>
                    </tr>
                  );
                })}
                {/* Total row */}
                <tr style={{ borderTop: '2px solid #bfdbfe', background: '#f0f9ff', position: 'sticky', bottom: 0 }}>
                  <td colSpan={4} style={{ padding: '13px 16px', fontSize: 13, fontWeight: 800, color: '#2563eb', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <TableIcon /> Total
                  </td>
                  <td style={{ padding: '13px 16px', textAlign: 'right', fontSize: 13, fontWeight: 800, color: '#2563eb' }}>{numFmt(totTaxable)}</td>
                  <td style={{ padding: '13px 16px', textAlign: 'right', fontSize: 13, fontWeight: 800, color: '#2563eb' }}>{numFmt(totCgst)}</td>
                  <td style={{ padding: '13px 16px', textAlign: 'right', fontSize: 13, fontWeight: 800, color: '#2563eb' }}>{numFmt(totSgst)}</td>
                  <td style={{ padding: '13px 16px', textAlign: 'right', fontSize: 13, fontWeight: 800, color: '#2563eb' }}>{numFmt(totIgst)}</td>
                  <td style={{ padding: '13px 16px', textAlign: 'right', fontSize: 13, fontWeight: 800, color: '#2563eb' }}>{numFmt(totTotal)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {/* ── Pagination ─────────────────────────────── */}
        {flatDocs.length > 0 && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexShrink: 0, background: '#fff', fontSize: 13, color: '#64748b' }}>
            <span>Showing {total === 0 ? 0 : (safePage - 1) * pageSize + 1} to {Math.min(safePage * pageSize, total)} of {total} documents</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              {[
                { label: '«', action: () => setPage(1), disabled: safePage === 1 },
                { label: '‹', action: () => setPage((p) => Math.max(1, p - 1)), disabled: safePage === 1 },
              ].map(({ label, action, disabled }) => (
                <PagBtn key={label} onClick={action} disabled={disabled}>{label}</PagBtn>
              ))}
              <span style={{ width: 32, height: 32, borderRadius: 8, background: '#0052cc', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>{safePage}</span>
              {[
                { label: '›', action: () => setPage((p) => Math.min(pageCount, p + 1)), disabled: safePage === pageCount },
                { label: '»', action: () => setPage(pageCount), disabled: safePage === pageCount },
              ].map(({ label, action, disabled }) => (
                <PagBtn key={label} onClick={action} disabled={disabled}>{label}</PagBtn>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Rows per page</span>
              <select className="bp-select pg-rows" style={{ height: 32, width: 70 }} value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PagBtn({ onClick, disabled, children }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid #e2e8f0', background: disabled ? '#f8fafc' : '#fff', color: disabled ? '#cbd5e1' : 'var(--bp-text)', cursor: disabled ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700 }}>
      {children}
    </button>
  );
}
