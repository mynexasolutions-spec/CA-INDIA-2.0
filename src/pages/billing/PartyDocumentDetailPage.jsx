import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, getAuthToken } from '../../api/client';
import { LoadingBlock } from '../../components/Spinner';
import { partyDocumentSections } from './billingProfile';
import { filterDocsByPeriod, formatDMY } from './billingUtils';
import { useReportsEnv } from './ReportsContext';

/* ── Icons ─────────────────────────────────────────────────── */
function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
    </svg>
  );
}
function ExcelIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
      <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><line x1="10" y1="9" x2="14" y2="9"/>
    </svg>
  );
}
function PdfIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
    </svg>
  );
}
function CalIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}
function DocBadgeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

/* ── Helpers ────────────────────────────────────────────────── */
const TYPE_LABEL = {
  tax_invoice: 'Tax Invoice',
  bill_of_supply: 'Bill of Supply',
  debit_note: 'Debit Note',
  credit_note: 'Credit Note',
};

const fmtDate = formatDMY;

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

function PagBtn({ onClick, disabled, children }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid #e2e8f0', background: disabled ? '#f8fafc' : '#fff', color: disabled ? '#cbd5e1' : 'var(--bp-text)', cursor: disabled ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700 }}>
      {children}
    </button>
  );
}

const PAGE_SIZES = [10, 25, 50];

/* ── Main Component ─────────────────────────────────────────── */
export default function PartyDocumentDetailPage() {
  const { partyId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const env = useReportsEnv();
  const profile = env.profile;

  const from      = searchParams.get('from') || '';
  const to        = searchParams.get('to')   || '';
  const fy        = searchParams.get('fy')   || '';
  const partyName = searchParams.get('name') || 'Party';

  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState('');
  const [page, setPage]       = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (!partyId) return;
    setLoading(true); setErr('');
    // No `status` filter here — the backend defaults to "not cancelled", and we then
    // narrow to the exact "issued family" client-side below. Explicitly passing
    // status=issued (the old behavior) silently excluded paid/partially-paid documents,
    // making this page show 0 results for a party whose invoices had been marked Paid
    // even though the Party-wise Summary total (which counts issued+partial+paid) still
    // showed them.
    const qs = new URLSearchParams({ party_id: partyId, per_page: '500' });
    if (from) qs.set('from', from);
    if (to)   qs.set('to', to);
    if (!from && !to && fy) qs.set('fy', fy);

    api(`${env.docsApi}?${qs}`)
      .then((d) => setRows(d.data || d || []))
      .catch((e) => setErr(e.message || 'Failed to load documents'))
      .finally(() => setLoading(false));
  }, [partyId, from, to, fy]);

  const periodDocs   = useMemo(() => filterDocsByPeriod(rows, { from, to }), [rows, from, to]);
  const allowedTypes = useMemo(() => new Set(partyDocumentSections(profile).map((s) => s.type)), [profile]);
  // Matches the Party-wise Summary total's own status set (issued/partial/paid) — a
  // document's payment status must never change whether it counts here.
  const ISSUED_STATUSES = useMemo(() => new Set(['issued', 'partial', 'paid']), []);
  const flatDocs     = useMemo(
    () => sortDocs(periodDocs.filter((d) => allowedTypes.has(d.type) && ISSUED_STATUSES.has(d.status))),
    [periodDocs, allowedTypes, ISSUED_STATUSES]
  );

  // Pagination
  const total     = flatDocs.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage  = Math.min(page, pageCount);
  const pageRows  = flatDocs.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Totals — Credit Notes reduce this party's business value, so they're subtracted
  // rather than added when combining across the mixed document types shown here.
  const sign = (r) => (r.type === 'credit_note' ? -1 : 1);
  const totTaxable = flatDocs.reduce((s, r) => s + sign(r) * Number(r.taxable_amount  || 0), 0);
  const totCgst    = flatDocs.reduce((s, r) => s + sign(r) * Number(r.cgst_amount     || 0), 0);
  const totSgst    = flatDocs.reduce((s, r) => s + sign(r) * Number(r.sgst_amount     || 0), 0);
  const totIgst    = flatDocs.reduce((s, r) => s + sign(r) * Number(r.igst_amount     || 0), 0);
  const totTotal   = flatDocs.reduce((s, r) => s + sign(r) * Number(r.grand_total || r.total_amount || 0), 0);

  const fyLabel = fy ? `FY ${fy}` : (from ? `FY ${from.slice(0, 4)}-${String(Number(from.slice(0, 4)) + 1).slice(2)}` : '');

  const download = async (format) => {
    const token = getAuthToken();
    const qs = new URLSearchParams({ type: 'party_documents', party_id: partyId, from, to, format });
    const res = await fetch(`${env.exportUrl}?${qs}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: '*/*' },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    // Export is legacy SpreadsheetML XML, not real OOXML — must be named .xls, not
    // .xlsx, or Excel refuses to open it ("file format or extension is not valid").
    a.download = `party_docs_${partyName}.${format === 'xlsx' ? 'xls' : 'pdf'}`;
    a.click();
  };

  return (
    <div style={{ maxWidth: '100%' }}>

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="gs-head pd-head" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12 }}>
        <div>
          {/* Back button */}
          <button type="button" onClick={() => navigate(-1)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 10, background: 'none', border: 'none', color: '#2563eb', fontWeight: 700, fontSize: 13, cursor: 'pointer', padding: 0 }}>
            <ArrowLeftIcon /> Back to Party-wise Report
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="gl-head-ic" style={{ width: 48, height: 48, borderRadius: 13, background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 14px #2563eb44' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>
              </svg>
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--bp-navy)' }}>
                Party Document Details — {partyName}
              </h2>
              {/* Info chips */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 5, flexWrap: 'wrap' }}>
                {fyLabel && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#64748b' }}>
                    <CalIcon /> {fyLabel}
                  </span>
                )}
                {(from || to) && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#64748b' }}>
                    <CalIcon /> {fmtDate(from)} to {fmtDate(to)}
                  </span>
                )}
                {!loading && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#2563eb', fontWeight: 700 }}>
                    <DocBadgeIcon /> {total} Document{total !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Export buttons */}
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          <button type="button" onClick={() => download('xlsx')}
            style={{ height: 36, padding: '0 14px', borderRadius: 8, border: '1.5px solid #16a34a', background: '#fff', color: '#16a34a', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <ExcelIcon /> Export Excel
          </button>
          <button type="button" onClick={() => download('pdf')}
            style={{ height: 36, padding: '0 14px', borderRadius: 8, border: '1.5px solid #ef4444', background: '#fff', color: '#ef4444', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <PdfIcon /> Export PDF
          </button>
        </div>
      </div>

      {/* ── Filter pills info bar ────────────────────────────── */}
      {(fyLabel || from || to || partyName) && (
        <div className="pd-filter" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, marginBottom: 20, fontSize: 13, flexWrap: 'wrap' }}>
          <InfoIcon />
          <span style={{ color: '#475569', fontWeight: 600 }}>Filtered By:</span>
          {fyLabel && <span style={{ color: '#475569' }}>• Financial Year: <strong style={{ color: '#1e293b' }}>{fyLabel}</strong></span>}
          {from   && <span style={{ color: '#475569' }}>• From Date: <strong style={{ color: '#1e293b' }}>{fmtDate(from)}</strong></span>}
          {to     && <span style={{ color: '#475569' }}>• To Date: <strong style={{ color: '#1e293b' }}>{fmtDate(to)}</strong></span>}
          {partyName && <span style={{ color: '#475569' }}>• Party Name: <strong style={{ color: '#2563eb' }}>{partyName}</strong></span>}
        </div>
      )}

      {/* ── Table Card ──────────────────────────────────────── */}
      <div className="bp-card pd-table" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
        {loading ? (
          <LoadingBlock label="Loading documents…" minHeight={180} />
        ) : err ? (
          <div style={{ padding: 24, color: '#ef4444', fontSize: 13 }}>{err}</div>
        ) : flatDocs.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--bp-muted)', fontSize: 13 }}>
            No documents found for this period.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--bp-border)' }}>
                  {['Sr. No.','Document Type','Document No.','Date','Taxable Value (₹)','CGST (₹)','SGST (₹)','IGST (₹)','Total (₹)'].map((h, i) => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: i >= 4 ? 'right' : i === 0 ? 'center' : 'left', fontSize: 12, fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r, i) => {
                  const srNo = (safePage - 1) * pageSize + i + 1;
                  const path = env.docLink(r.type, r.id);
                  return (
                    <tr key={r.id || `${r.type}-${r.number}`}
                      style={{ borderBottom: '1px solid var(--bp-border)', background: '#fff', transition: 'background .12s' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                    >
                      <td style={{ padding: '13px 16px', textAlign: 'center', fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>{srNo}</td>
                      <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--bp-text)' }}>{TYPE_LABEL[r.type] || r.type}</td>
                      <td style={{ padding: '13px 16px', fontSize: 13 }}>
                        {r.id ? (
                          <Link to={path}
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
                <tr style={{ borderTop: '2px solid #bfdbfe', background: '#f0f9ff' }}>
                  <td colSpan={4} style={{ padding: '13px 16px', fontSize: 13, fontWeight: 800, color: '#2563eb' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><TableIcon /> Total</span>
                  </td>
                  <td style={{ padding: '13px 16px', textAlign: 'right', fontSize: 13, fontWeight: 800, color: '#2563eb' }}>{numFmt(totTaxable)}</td>
                  <td style={{ padding: '13px 16px', textAlign: 'right', fontSize: 13, fontWeight: 800, color: '#2563eb' }}>{numFmt(totCgst)}</td>
                  <td style={{ padding: '13px 16px', textAlign: 'right', fontSize: 13, fontWeight: 800, color: '#2563eb' }}>{numFmt(totSgst)}</td>
                  <td style={{ padding: '13px 16px', textAlign: 'right', fontSize: 13, fontWeight: 800, color: '#2563eb' }}>{numFmt(totIgst)}</td>
                  <td style={{ padding: '13px 16px', textAlign: 'right', fontSize: 13, fontWeight: 800, color: '#2563eb' }}>{numFmt(totTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Pagination ──────────────────────────────────────── */}
      {flatDocs.length > 0 && (
        <div className="hs-pager" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 13, color: '#64748b' }}>
          <span>Showing {total === 0 ? 0 : (safePage - 1) * pageSize + 1} to {Math.min(safePage * pageSize, total)} of {total} documents</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <PagBtn onClick={() => setPage(1)} disabled={safePage === 1}>«</PagBtn>
            <PagBtn onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}>‹</PagBtn>
            <span style={{ width: 32, height: 32, borderRadius: 8, background: '#0052cc', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>{safePage}</span>
            <PagBtn onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={safePage === pageCount}>›</PagBtn>
            <PagBtn onClick={() => setPage(pageCount)} disabled={safePage === pageCount}>»</PagBtn>
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
  );
}
