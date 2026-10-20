import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useClientPortal } from '../../components/portal/ClientPortalContext';
import { isDocTypeDisabled, isRetail, docTypeLock } from './billingProfile';
import BillingDateFilters from './BillingDateFilters';
import NumberedPagination from './NumberedPagination';
import {
  billingDocPath, createButtonLabel, currentFyRange,
  docTypeLabel, formatDMY, money,
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
  if (type === 'b2b') return <span className="il-badge il-b2b">B2B</span>;
  if (type === 'b2c') return <span className="il-badge il-b2c">B2C</span>;
  return <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>;
}

function gstTypeOf(row) {
  const s = row.customer?.gst_status;
  if (s === 'registered') return 'b2b';
  if (s === 'unregistered') return 'b2c';
  return null;
}

/* ── Summary tiles (Total / B2B / B2C) — same for every document type ──────── */
function SummaryTiles({ total, b2b, b2c, noun }) {
  const pct = (n) => (total ? Math.round((n / total) * 100) : 0);
  const tile = (cls, icon, label, count, pctVal, sub) => (
    <div className={`il-tile ${cls}`}>
      <span className="il-tile-ico">{icon}</span>
      <div className="il-tile-body">
        <span className="il-tile-label">{label}</span>
        <span className="il-tile-num">{count}{pctVal !== null && <small>({pctVal}%)</small>}</span>
        <span className="il-tile-sub">{sub}</span>
      </div>
    </div>
  );
  const docIc = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="14" y2="17" /></svg>;
  const peopleIc = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
  return (
    <div className="il-tiles">
      {tile('is-total', docIc, `Total ${noun}`, total, null, `All ${noun} in the selected period`)}
      {tile('is-b2b', peopleIc, `B2B ${noun}`, b2b, pct(b2b), 'Issued to GST registered customers')}
      {tile('is-b2c', peopleIc, `B2C ${noun}`, b2c, pct(b2c), 'Issued to unregistered customers')}
    </div>
  );
}

/* ── Tab bar ─────────────────────────────────────────────────────── */
/** Same five tabs for every document type: All | B2B | B2C | Cancelled | Deleted. */
const tabsFor = (plural) => [
  { key: '', label: `All ${plural}` },
  { key: 'b2b', label: `B2B ${plural}` },
  { key: 'b2c', label: `B2C ${plural}` },
  { key: 'cancelled', label: `Cancelled ${plural}` },
  { key: 'deleted', label: `Deleted ${plural}` },
];

function TabBar({ tabs, active, onTab, counts, onExcelExport, onPdfExport, exporting }) {
  return (
    <div className="il-tabbar">
      <div className="il-tabs">
        {tabs.map((t) => {
          const cnt = counts?.[t.key] ?? null;
          return (
            <button key={t.key} type="button" onClick={() => onTab(t.key)} className={`il-tab${active === t.key ? ' is-active' : ''}`}>
              {t.label}{cnt !== null ? ` (${cnt})` : ''}
            </button>
          );
        })}
      </div>
      <div className="il-export">
        <button type="button" onClick={onExcelExport} disabled={exporting} className="il-exp il-exp-xls"><ExcelIcon /> Export Excel</button>
        <button type="button" onClick={onPdfExport} disabled={exporting} className="il-exp il-exp-pdf"><PdfIcon /> Export PDF</button>
      </div>
    </div>
  );
}

/* ── Totals footer row — one cell under each money column, like the Tax Invoices reference ── */
function TotalsRow({ totals, rows, leadSpan, cols }) {
  const sum = (k) => rows.reduce((n, r) => n + Number(r[k] || 0), 0);
  const val = {
    taxable: totals?.taxable_amount ?? sum('taxable_amount'),
    igst: totals?.igst_amount ?? sum('igst_amount'),
    cgst: totals?.cgst_amount ?? sum('cgst_amount'),
    sgst: totals?.sgst_amount ?? sum('sgst_amount'),
    gst: totals?.gst_amount ?? (sum('igst_amount') + sum('cgst_amount') + sum('sgst_amount')),
    total: totals?.grand_total ?? rows.reduce((n, r) => n + Number(r.grand_total || r.total_amount || 0), 0),
  };
  const label = { taxable: 'Taxable Value', igst: 'IGST', cgst: 'CGST', sgst: 'SGST', gst: 'GST', total: 'Total Amount' };
  return (
    <tr className="il-totals-row">
      <td colSpan={leadSpan} className="il-totals-lead"><span className="il-totals-ico">₹</span> Total (Filtered Results)</td>
      {cols.map((c) => <td key={c}><b>{money(val[c])}</b><small>{label[c]}</small></td>)}
    </tr>
  );
}

/* Document No. / Date wording for each billing document (the filters and table follow it). */
const DOC_WORDS = {
  tax_invoice:      { plural: 'Invoices', no: 'Invoice No.',        date: 'Invoice Date',        item: 'invoice no.' },
  bill_of_supply:   { plural: 'Bills', no: 'Bill No.',           date: 'Bill Date',           item: 'bill no.' },
  debit_note:       { plural: 'Debit Notes', no: 'Debit Note No.',     date: 'Debit Note Date',     item: 'debit note no.' },
  credit_note:      { plural: 'Credit Notes', no: 'Credit Note No.',    date: 'Credit Note Date',    item: 'credit note no.' },
  quotation:        { plural: 'Quotations', no: 'Quotation No.',      date: 'Quotation Date',      item: 'quotation no.' },
  delivery_challan: { plural: 'Delivery Challans', no: 'Challan No.',        date: 'Challan Date',        item: 'challan no.' },
};

/* ── Main component ──────────────────────────────────────────────── */
export default function InvoiceList({ type = 'tax_invoice', title = 'Tax Invoices', newPath, createLabel }) {
  const { user } = useAuth();
  const profile = user?.client_profile;
  const portal = useClientPortal();

  const disabled = isDocTypeDisabled(profile, type);
  const displayTitle = (isRetail(profile) && type === 'tax_invoice') ? 'Invoice' : title;
  const words = DOC_WORDS[type] || DOC_WORDS.tax_invoice;
  const showGst = type !== 'bill_of_supply';
  // Tax columns: Taxable Value -> IGST -> CGST -> SGST -> Total Amount for every tax document. A Bill of Supply
  // carries no tax, and a Delivery Challan shows one combined GST figure.
  const splitTax = ['tax_invoice', 'debit_note', 'credit_note', 'quotation'].includes(type);

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

  /* per-tab record counts + totals from the server (counts don't change with the active tab) */
  const [tabCounts, setTabCounts] = useState({ all: 0, b2b: 0, b2c: 0, cancelled: 0, deleted: 0 });
  const [totals, setTotals] = useState(null);

  const [err, setErr] = useState('');

  /* tab definitions */
  const tabs = tabsFor(words.plural);

  const buildQs = useCallback((targetPage, tabOverride) => {
    const qs = new URLSearchParams({ type });
    if (q) qs.set('q', q);
    if (docFrom) qs.set('doc_from', docFrom);
    if (docTo) qs.set('doc_to', docTo);
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    const tab = tabOverride !== undefined ? tabOverride : activeTab;
    // The B2B / B2C tabs and the Customer Type dropdown both narrow by customer type.
    const customerType = (tab === 'b2b' || tab === 'b2c') ? tab : gstType;
    if (customerType) qs.set('gst_type', customerType);
    if (tab === 'cancelled') qs.set('status', 'cancelled');
    else if (tab === 'deleted') qs.set('deleted', '1');
    qs.set('per_page', perPage);
    qs.set('page', targetPage);
    return qs.toString();
  }, [type, q, docFrom, docTo, from, to, gstType, activeTab, perPage]);

  const load = useCallback((targetPage = page, tabOverride) => {
    api(`/billing/documents?${buildQs(targetPage, tabOverride)}`).then((d) => {
      setRows(d.data || []);
      setMeta({ current_page: d.current_page || 1, last_page: d.last_page || 1, total: d.total || 0, per_page: d.per_page || perPage });
      if (d.tab_counts) setTabCounts(d.tab_counts);
      setTotals(d.totals || null);
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
  const tabLabelCounts = {
    '': tabCounts.all, b2b: tabCounts.b2b, b2c: tabCounts.b2c, cancelled: tabCounts.cancelled, deleted: tabCounts.deleted,
  };

  const buttonText = String(createLabel || createButtonLabel(type, profile)).replace(/^\+\s*/, '');

  /* Export: every row matching the current filters/tab (all pages), not just the visible page. */
  const [exporting, setExporting] = useState(false);
  const exportRows = async (format) => {
    setExporting(true); setErr('');
    try {
      const qs = new URLSearchParams(buildQs(1));
      qs.set('per_page', '1000'); qs.set('page', '1');
      const d = await api(`/billing/documents?${qs.toString()}`);
      const list = d.data || [];
      if (!list.length) { setErr('There are no documents to export for the current filters.'); return; }
      const head = ['Document No.', 'Date', 'Created On', 'Party', 'GSTIN', 'Taxable Value', 'IGST', 'CGST', 'SGST', 'Total Amount', 'Status'];
      const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const body = list.map((r) => [
        r.number, formatDMY(r.document_date), formatDMY(r.created_at), r.customer?.name || '', r.customer?.gstin || '',
        Number(r.taxable_amount || 0).toFixed(2), Number(r.igst_amount || 0).toFixed(2), Number(r.cgst_amount || 0).toFixed(2),
        Number(r.sgst_amount || 0).toFixed(2), Number(r.grand_total || r.total_amount || 0).toFixed(2), r.status,
      ]);
      const table = `<table border="1" cellspacing="0" cellpadding="5" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px"><thead><tr>${head.map((h) => `<th style="background:#e8f0fe">${esc(h)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      const title = `${docTypeLabel(type)} Register`;
      if (format === 'xlsx') {
        const blob = new Blob([`<html><head><meta charset="utf-8"></head><body><h3>${esc(title)}</h3>${table}</body></html>`], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${type}_register.xls`; a.click();
        URL.revokeObjectURL(url);
      } else {
        const w = window.open('', '_blank');
        if (!w) { setErr('Please allow pop-ups to export the PDF.'); return; }
        w.document.write(`<html><head><title>${esc(title)}</title></head><body style="margin:24px"><h3 style="font-family:Arial">${esc(title)}</h3>${table}</body></html>`);
        w.document.close(); w.focus(); w.print();
      }
    } catch (e) { setErr(e.message || 'Export failed.'); }
    finally { setExporting(false); }
  };
  const doExcelExport = () => exportRows('xlsx');
  const doPdfExport = () => exportRows('pdf');

  /* money columns, in order: Taxable Value -> IGST -> CGST -> SGST -> Total Amount */
  const totalCols = splitTax
    ? ['taxable', 'igst', 'cgst', 'sgst', 'total']
    : showGst ? ['taxable', 'gst', 'total'] : ['taxable', 'total'];

  return (
    <div>
      {/* toolbar */}
      <div className="il-crumb"><Link to="/portal/billing">Billing</Link><span>›</span><b>{displayTitle}</b></div>
      <div className="il-head">
        <span className="il-head-ico">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="13" y2="17" /></svg>
        </span>
        <div className="il-head-text">
          <h2>{displayTitle}</h2>
          <p>View and manage all {displayTitle} issued to your customers.</p>
        </div>
        {!disabled && (
          <Link className="il-create" to={newPath || '/portal/billing/invoices/new'}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            {buttonText}
          </Link>
        )}
      </div>

      {disabled && (
        <div className="bp-card" style={{ marginBottom: 14, borderColor: '#f0c36d', background: '#fff8e8' }}>
          <p style={{ margin: 0, color: '#8a5a00', fontSize: 14 }}>{docTypeLock(profile, type) || 'This document type is locked for your GST dealer type.'}</p>
        </div>
      )}

      {err && <p style={{ margin: '0 0 10px', color: '#dc2626', fontSize: 13 }}>{err}</p>}

      {/* Total / B2B / B2C summary tiles */}
      <SummaryTiles total={tabCounts.all} b2b={tabCounts.b2b} b2c={tabCounts.b2c} noun={words.plural} />

      <div className="il-card">
        {/* tab bar + export buttons */}
        <TabBar
          tabs={tabs}
          active={activeTab}
          onTab={handleTab}
          counts={tabLabelCounts}
          onExcelExport={doExcelExport}
          onPdfExport={doPdfExport}
          exporting={exporting}
        />

        {/* filter bar */}
        <BillingDateFilters
          q={q} setQ={setQ}
          docFrom={docFrom} setDocFrom={setDocFrom}
          docTo={docTo} setDocTo={setDocTo}
          from={from} setFrom={setFrom}
          to={to} setTo={setTo}
          gstType={gstType} setGstType={setGstType}
          showGstType
          dateLabel={words.date}
          searchHint={`Search by ${words.item}, party name, GSTIN`}
          onApply={applyFilters}
          onClear={applyFilters}
        />

        {/* table — open a document by clicking its number */}
        <div style={{ overflowX: 'auto' }}>
          <table className="bp-table bp-doc-table bd-table il-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th>{words.no}</th>
                <th>{words.date}</th>
                <th>Creation Date</th>
                <th>Party Name</th>
                <th>Customer Type</th>
                <th>GSTIN</th>
                <th>Taxable Value (₹)</th>
                {splitTax && <><th>IGST (₹)</th><th>CGST (₹)</th><th>SGST (₹)</th></>}
                {!splitTax && showGst && <th>GST (₹)</th>}
                <th>Total Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d, idx) => {
                const rowNum = (meta.current_page - 1) * perPage + idx + 1;
                const gt = gstTypeOf(d);
                return (
                  <tr key={d.id}>
                    <td style={{ color: '#94a3b8', fontSize: 12 }}>{rowNum}</td>
                    <td>
                      {activeTab === 'deleted'
                        ? <span style={{ fontWeight: 700 }}>{d.number}</span>
                        : <Link className="bp-doc-num-link" to={billingDocPath(type, d.id)}>{d.number}</Link>}
                    </td>
                    <td>{formatDMY(d.document_date)}</td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>{formatDMY(d.created_at)}</td>
                    <td className="il-left">{d.customer?.name || '—'}</td>
                    <td><GstBadge type={gt} /></td>
                    <td style={{ fontSize: 12 }}>{d.customer?.gstin || (gt === 'b2c' ? '-' : '—')}</td>
                    <td>{money(d.taxable_amount)}</td>
                    {splitTax && (
                      <>
                        <td>{money(d.igst_amount)}</td>
                        <td>{money(d.cgst_amount)}</td>
                        <td>{money(d.sgst_amount)}</td>
                      </>
                    )}
                    {!splitTax && showGst && <td>{money(Number(d.cgst_amount) + Number(d.sgst_amount) + Number(d.igst_amount))}</td>}
                    <td className="bp-doc-total">{money(d.grand_total || d.total_amount)}</td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr><td colSpan={20} className="bp-table-empty">No documents found</td></tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <TotalsRow totals={totals} rows={rows} leadSpan={7} cols={totalCols} />
              </tfoot>
            )}
          </table>
        </div>

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
    </div>
  );
}
