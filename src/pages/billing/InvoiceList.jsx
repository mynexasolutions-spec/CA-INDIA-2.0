import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useClientPortal } from '../../components/portal/PortalShell';
import { isDocTypeDisabled, isRetail, docTypeLock } from './billingProfile';
import BillingDateFilters from './BillingDateFilters';
import DocActionMenu from './DocActionMenu';
import NumberedPagination from './NumberedPagination';
import CancelDocumentModal from './CancelDocumentModal';
import {
  billingDocEditPath, billingDocPath, createButtonLabel, currentFyRange,
  docTypeLabel, formatDMY, formatDMYTime, money,
} from './billingUtils';

/* ── Icons ─────────────────────────────────────────────────────── */
function ExcelIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" /><path d="m8 8 8 8M16 8l-8 8" />
    </svg>
  );
}
function PdfIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

/* ── GST badges ─────────────────────────────────────────────────── */
function GstBadge({ type }) {
  if (type === 'b2b') {
    return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#e7f6ec', color: '#1d7a3c' }}>B2B</span>;
  }
  if (type === 'b2c') {
    return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#fef9ec', color: '#b45309' }}>B2C</span>;
  }
  return <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>;
}

function gstTypeOf(row) {
  const s = row.customer?.gst_status;
  if (s === 'registered') return 'b2b';
  if (s === 'unregistered') return 'b2c';
  return null;
}

/* ── action helpers (moved out of component for clarity) ─────── */
function buildActions(d, { onConvert, onDuplicate, onSend, onMarkPaid, onCancel }) {
  const editPath = billingDocEditPath(d.type, d.id);
  const isIssuedFamily = ['issued', 'partial', 'paid'].includes(d.status);
  const canEditDraft = d.status === 'draft' && editPath;
  const canDirectEdit = isIssuedFamily && !d.direct_edit_locked && editPath;
  const canAdminUnlockedEdit = isIssuedFamily && d.edit_allowed && editPath;
  const cancellable = d.status !== 'cancelled' && d.status !== 'draft' && !(d.type === 'quotation' && d.converted_document_id);
  const editOrRequest = canEditDraft
    ? { label: 'Edit', to: editPath }
    : canAdminUnlockedEdit
      ? { label: 'Edit Allowed', to: editPath }
      : canDirectEdit
        ? { label: 'Edit', to: editPath }
        : isIssuedFamily
          ? (d.gst_return_filed
            ? { label: 'Request Edit', disabled: true, disabledReason: 'GST Return for this period has already been filed.' }
            : { label: 'Request Edit', to: '/portal/edit-requests' })
          : null;

  const view = { label: `View ${docTypeLabel(d.type)}`, to: billingDocPath(d.type, d.id) };
  const downloadPdf = { label: 'Download PDF', onClick: () => api(`/billing/documents/${d.id}/pdf`).then((r) => window.open(r.url, '_blank')).catch((e) => alert(e.message || 'Failed to download PDF.')) };
  const send = { label: 'Send', onClick: () => onSend(d) };
  const duplicate = { label: 'Duplicate', onClick: () => onDuplicate(d) };
  const markPaid = ['issued', 'partial'].includes(d.status) ? { label: 'Mark as Paid', onClick: () => onMarkPaid(d) } : null;
  const cancel = cancellable ? { label: 'Cancel', danger: true, onClick: () => onCancel(d) } : null;

  if (d.type === 'quotation') {
    const convert = !d.converted_document_id && d.status !== 'cancelled' ? { label: 'Convert', onClick: () => onConvert(d) } : null;
    return [view, editOrRequest, downloadPdf, send, duplicate, convert, cancel];
  }
  if (d.type === 'bill_of_supply') return [view, downloadPdf, editOrRequest, send, cancel];
  if (d.type === 'debit_note') return [view, downloadPdf, editOrRequest, markPaid, cancel];
  if (d.type === 'credit_note') return [view, downloadPdf, editOrRequest, cancel];
  if (d.type === 'delivery_challan') return [view, downloadPdf, editOrRequest, duplicate, send, cancel];
  return [view, downloadPdf, editOrRequest, duplicate, send, markPaid, cancel];
}

/* ── Summary tiles (B2B/B2C) — shown only for tax_invoice ──────── */
function SummaryTiles({ total, b2b, b2c }) {
  const pct = (n) => (total ? Math.round((n / total) * 100) : 0);
  const tile = (label, count, pctVal, color, bg) => (
    <div style={{ flex: 1, minWidth: 160, background: bg, border: `1.5px solid ${color}22`, borderRadius: 12, padding: '14px 20px' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{count}</div>
      {pctVal !== null && <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{pctVal}% of total</div>}
    </div>
  );
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
      {tile('Total Tax Invoices', total, null, '#1e3a5f', '#f0f4fa')}
      {tile('B2B Invoices', b2b, pct(b2b), '#15803d', '#f0faf4')}
      {tile('B2C Invoices', b2c, pct(b2c), '#d97706', '#fffbeb')}
    </div>
  );
}

/* ── Tab bar ─────────────────────────────────────────────────────── */
const TAB_DEFS = [
  { key: '', label: 'All Invoices' },
  { key: 'b2b', label: 'B2B Invoices' },
  { key: 'b2c', label: 'B2C Invoices' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'deleted', label: 'Deleted' },
];
const NON_GST_TABS = [
  { key: '', label: 'All' },
  { key: 'cancelled', label: 'Cancelled' },
];

function TabBar({ tabs, active, onTab, counts, onExcelExport, onPdfExport }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, borderBottom: '2px solid #e2e8f0', marginBottom: 16, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', flex: 1, gap: 0, overflowX: 'auto' }}>
        {tabs.map((t) => {
          const cnt = counts?.[t.key] ?? null;
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onTab(t.key)}
              style={{
                padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer',
                fontWeight: isActive ? 700 : 500, fontSize: 13,
                color: isActive ? '#1e3a5f' : '#64748b',
                borderBottom: isActive ? '2.5px solid #1e3a5f' : '2.5px solid transparent',
                marginBottom: -2, whiteSpace: 'nowrap',
              }}
            >
              {t.label}{cnt !== null ? ` (${cnt})` : ''}
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '6px 0 6px 12px', flexShrink: 0 }}>
        <button type="button" onClick={onExcelExport}
          style={{ height: 32, padding: '0 12px', borderRadius: 7, border: '1.5px solid #e2e8f0', background: '#fff', color: '#15803d', fontWeight: 600, fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
          <ExcelIcon /> Export Excel
        </button>
        <button type="button" onClick={onPdfExport}
          style={{ height: 32, padding: '0 12px', borderRadius: 7, border: '1.5px solid #e2e8f0', background: '#fff', color: '#dc2626', fontWeight: 600, fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
          <PdfIcon /> Export PDF
        </button>
      </div>
    </div>
  );
}

/* ── Totals bar ──────────────────────────────────────────────────── */
function TotalsBar({ rows, showGst }) {
  const taxable = rows.reduce((s, r) => s + Number(r.taxable_amount || 0), 0);
  const igst = rows.reduce((s, r) => s + Number(r.igst_amount || 0), 0);
  const cgst = rows.reduce((s, r) => s + Number(r.cgst_amount || 0), 0);
  const sgst = rows.reduce((s, r) => s + Number(r.sgst_amount || 0), 0);
  const gst = igst + cgst + sgst;
  const total = rows.reduce((s, r) => s + Number(r.grand_total || r.total_amount || 0), 0);
  if (!rows.length) return null;
  return (
    <div style={{ display: 'flex', gap: 0, background: '#f8fafc', borderTop: '2px solid #e2e8f0', padding: '10px 14px', fontSize: 13, fontWeight: 600, color: '#1e3a5f', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginTop: 2 }}>
      <span style={{ color: '#64748b', fontWeight: 700 }}>Total (Filtered Results)</span>
      <span>Taxable: <b>{money(taxable)}</b></span>
      {showGst && <span>GST: <b>{money(gst)}</b></span>}
      <span>Total: <b style={{ color: '#1e3a5f', fontSize: 14 }}>{money(total)}</b></span>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────── */
export default function InvoiceList({ type = 'tax_invoice', title = 'Tax Invoices', newPath, createLabel }) {
  const { user } = useAuth();
  const profile = user?.client_profile;
  const portal = useClientPortal();

  const disabled = isDocTypeDisabled(profile, type);
  const displayTitle = (isRetail(profile) && type === 'tax_invoice') ? 'Invoice' : title;
  const isTaxInvoice = type === 'tax_invoice';
  const showGst = type !== 'bill_of_supply';

  const fyDefault = currentFyRange();
  const initFrom = portal?.range?.from || fyDefault.from;
  const initTo = portal?.range?.to || fyDefault.to;

  /* filter state */
  const [q, setQ] = useState('');
  const [docFrom, setDocFrom] = useState(initFrom);
  const [docTo, setDocTo] = useState(initTo);
  const [from, setFrom] = useState(initFrom);
  const [to, setTo] = useState(initTo);
  const [gstType, setGstType] = useState('');   // '' | 'b2b' | 'b2c'
  const [activeTab, setActiveTab] = useState(''); // '' | 'b2b' | 'b2c' | 'cancelled' | 'deleted'

  /* pagination */
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 10 });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  /* summary tiles — fetched independently so tab/filter doesn't change them */
  const [summary, setSummary] = useState({ total: 0, b2b: 0, b2c: 0 });

  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelBusy, setCancelBusy] = useState(false);

  /* tab definitions */
  const tabs = isTaxInvoice ? TAB_DEFS : NON_GST_TABS;

  const buildQs = useCallback((targetPage, tabOverride) => {
    const qs = new URLSearchParams({ type });
    if (q) qs.set('q', q);
    if (docFrom) qs.set('doc_from', docFrom);
    if (docTo) qs.set('doc_to', docTo);
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    const tab = tabOverride !== undefined ? tabOverride : activeTab;
    if (tab === 'b2b' || tab === 'b2c') qs.set('gst_type', tab);
    else if (tab === 'cancelled') qs.set('status', 'cancelled');
    else if (tab === 'deleted') qs.set('deleted', '1');
    qs.set('per_page', perPage);
    qs.set('page', targetPage);
    return qs.toString();
  }, [type, q, docFrom, docTo, from, to, activeTab, perPage]);

  const load = useCallback((targetPage = page, tabOverride) => {
    api(`/billing/documents?${buildQs(targetPage, tabOverride)}`).then((d) => {
      setRows(d.data || []);
      setMeta({ current_page: d.current_page || 1, last_page: d.last_page || 1, total: d.total || 0, per_page: d.per_page || perPage });
      /* use type_counts from the response to keep summary tiles stable */
      if (d.type_counts) {
        setSummary({
          total: d.type_counts.tax_invoice || 0,
          b2b: d.type_counts.tax_invoice_b2b || 0,
          b2c: d.type_counts.tax_invoice_b2c || 0,
        });
      }
    });
  }, [buildQs, page, perPage]);

  useEffect(() => { load(page); }, [type, page, perPage]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyFilters = () => { setPage(1); load(1); };

  const handleTab = (key) => {
    setActiveTab(key);
    setPage(1);
    load(1, key);
  };

  /* tab counts for tab labels */
  const tabCounts = isTaxInvoice ? {
    '': summary.total,
    b2b: summary.b2b,
    b2c: summary.b2c,
  } : {};

  const buttonText = createLabel || createButtonLabel(type, profile);

  /* action handlers */
  const isComposition = profile?.dealer_type === 'composition';
  const doConvert = async (d) => {
    setMsg(''); setErr('');
    try {
      const inv = await api(`/billing/documents/${d.id}/convert`, { method: 'POST', body: {} });
      const dest = isComposition ? `/portal/billing/bill-of-supply/${inv.id}` : `/portal/billing/invoices/${inv.id}`;
      window.location.href = dest;
    } catch (e) { setErr(e.message || 'Failed to convert document.'); }
  };
  const doDuplicate = async (d) => {
    setMsg(''); setErr('');
    try {
      const copy = await api(`/billing/documents/${d.id}/duplicate`, { method: 'POST', body: {} });
      window.location.href = billingDocEditPath(copy.type, copy.id) || billingDocPath(copy.type, copy.id);
    } catch (e) { setErr(e.message || 'Failed to duplicate document.'); }
  };
  const doSend = async (d) => {
    setMsg(''); setErr('');
    try {
      const r = await api(`/billing/documents/${d.id}/email`, { method: 'POST', body: {} });
      setMsg(r.message || 'Email sent successfully.');
    } catch (e) { setErr(e.message || 'Failed to send email.'); }
  };
  const doMarkPaid = async (d) => {
    setMsg(''); setErr('');
    try {
      await api(`/billing/documents/${d.id}/payment-status`, { method: 'POST', body: { status: 'paid' } });
      setMsg('Marked as Paid.'); load();
    } catch (e) { setErr(e.message || 'Failed to mark as paid.'); }
  };
  const confirmCancel = async (reason) => {
    setCancelBusy(true); setMsg(''); setErr('');
    try {
      await api(`/billing/documents/${cancelTarget.id}/cancel`, { method: 'POST', body: { reason } });
      setCancelTarget(null);
      setMsg(`${docTypeLabel(cancelTarget.type)} ${cancelTarget.number} cancelled.`);
      load();
    } catch (e) { setErr(e.message || 'Failed to cancel document.'); }
    finally { setCancelBusy(false); }
  };

  const doExcelExport = () => alert('Excel export coming soon.');
  const doPdfExport = () => alert('PDF export coming soon.');

  /* column definitions per doc type */
  const isTaxInvOrDN = ['tax_invoice', 'debit_note', 'credit_note'].includes(type);

  return (
    <div>
      {/* toolbar */}
      <div className="bp-toolbar">
        <h2 style={{ margin: 0, flex: 1 }}>{displayTitle}</h2>
        {!disabled && (
          <Link className="bp-btn bp-btn-primary" to={newPath || '/portal/billing/invoices/new'}>{buttonText}</Link>
        )}
      </div>

      {disabled && (
        <div className="bp-card" style={{ marginBottom: 14, borderColor: '#f0c36d', background: '#fff8e8' }}>
          <p style={{ margin: 0, color: '#8a5a00', fontSize: 14 }}>{docTypeLock(profile, type) || 'This document type is locked for your GST dealer type.'}</p>
        </div>
      )}

      {msg && <p style={{ margin: '0 0 10px', color: '#15803d', fontSize: 13 }}>{msg}</p>}
      {err && <p style={{ margin: '0 0 10px', color: '#dc2626', fontSize: 13 }}>{err}</p>}

      {/* B2B/B2C summary tiles — only for tax_invoice */}
      {isTaxInvoice && <SummaryTiles total={summary.total} b2b={summary.b2b} b2c={summary.b2c} />}

      <div className="bp-card" style={{ padding: '16px 20px' }}>
        {/* tab bar + export buttons */}
        <TabBar
          tabs={tabs}
          active={activeTab}
          onTab={handleTab}
          counts={tabCounts}
          onExcelExport={doExcelExport}
          onPdfExport={doPdfExport}
        />

        {/* filter bar */}
        <BillingDateFilters
          q={q} setQ={setQ}
          docFrom={docFrom} setDocFrom={setDocFrom}
          docTo={docTo} setDocTo={setDocTo}
          from={from} setFrom={setFrom}
          to={to} setTo={setTo}
          gstType={gstType} setGstType={setGstType}
          showGstType={isTaxInvoice}
          onApply={applyFilters}
          onClear={applyFilters}
        />

        {/* table */}
        <div style={{ overflowX: 'auto' }}>
          <table className="bp-table bp-doc-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th>Invoice No.</th>
                <th>Invoice Date</th>
                <th>Creation Date</th>
                <th>Party Name</th>
                {isTaxInvoice && <th>Customer Type</th>}
                <th>GSTIN</th>
                <th>Taxable Value</th>
                {isTaxInvOrDN && <><th>IGST (₹)</th><th>CGST (₹)</th><th>SGST (₹)</th></>}
                {showGst && !isTaxInvOrDN && <th>GST</th>}
                <th>Total Amount</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d, idx) => {
                const rowNum = (meta.current_page - 1) * perPage + idx + 1;
                const gt = gstTypeOf(d);
                return (
                  <tr key={d.id}>
                    <td style={{ color: '#94a3b8', fontSize: 12 }}>{rowNum}</td>
                    <td><Link className="bp-doc-num-link" to={billingDocPath(type, d.id)}>{d.number}</Link></td>
                    <td>{formatDMY(d.document_date)}</td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>{formatDMY(d.created_at)}</td>
                    <td>{d.customer?.name || '—'}</td>
                    {isTaxInvoice && <td><GstBadge type={gt} /></td>}
                    <td style={{ fontSize: 12 }}>{d.customer?.gstin || (gt === 'b2c' ? 'Unregistered' : '—')}</td>
                    <td>{money(d.taxable_amount)}</td>
                    {isTaxInvOrDN && (
                      <>
                        <td>{money(d.igst_amount)}</td>
                        <td>{money(d.cgst_amount)}</td>
                        <td>{money(d.sgst_amount)}</td>
                      </>
                    )}
                    {showGst && !isTaxInvOrDN && <td>{money(Number(d.cgst_amount) + Number(d.sgst_amount) + Number(d.igst_amount))}</td>}
                    <td className="bp-doc-total">{money(d.grand_total || d.total_amount)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
                        <Link className="bp-btn bp-btn-outline" style={{ padding: '4px 10px', fontSize: 12 }} to={billingDocPath(type, d.id)}>View</Link>
                        <DocActionMenu
                          actions={buildActions(d, { onConvert: doConvert, onDuplicate: doDuplicate, onSend: doSend, onMarkPaid: doMarkPaid, onCancel: setCancelTarget })}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr><td colSpan={20} className="bp-table-empty">No documents found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* totals bar */}
        <TotalsBar rows={rows} showGst={showGst} />

        {/* pagination */}
        <NumberedPagination
          meta={meta}
          perPage={perPage}
          onPerPage={(v) => { setPerPage(v); setPage(1); }}
          onPage={setPage}
          itemLabel="documents"
          perPageOptions={[5, 10, 25, 50]}
        />
      </div>

      {cancelTarget && (
        <CancelDocumentModal
          docLabel={`${docTypeLabel(cancelTarget.type)} ${cancelTarget.number}`}
          busy={cancelBusy}
          onCancel={() => setCancelTarget(null)}
          onConfirm={confirmCancel}
        />
      )}
    </div>
  );
}
