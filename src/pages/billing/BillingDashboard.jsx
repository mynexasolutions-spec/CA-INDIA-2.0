import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useClientPortal } from '../../components/portal/PortalShell';
import { api, getAuthToken } from '../../api/client';
import { LoadingBlock } from '../../components/Spinner';
import NumberedPagination from './NumberedPagination';
import { isDocTypeDisabled } from './billingProfile';
import {
  billingDocPath, currentFyRange, docTypeLabel,
  formatDMY, formatDMYTime, money, paymentStatusBadge, paymentStatusLabel,
} from './billingUtils';

/* ═══ ICON SVGs ═══ */
const I = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
function IcLayers() { return <svg {...I}><path d="M12 3 3 7.5 12 12l9-4.5L12 3Z" /><path d="M3 12l9 4.5L21 12" /><path d="M3 16.5l9 4.5 9-4.5" /></svg>; }
function IcDoc()    { return <svg {...I}><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></svg>; }
function IcGrid()   { return <svg {...I}><rect x="4" y="4" width="16" height="16" rx="1.5" /><path d="M4 10h16M4 15h16M10 4v16" /></svg>; }
function IcDocPlus(){ return <svg {...I}><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4" /><path d="M12 12v5M9.5 14.5h5" /></svg>; }
function IcDocMin() { return <svg {...I}><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4" /><path d="M9.5 14.5h5" /></svg>; }
function IcClip()   { return <svg {...I}><path d="M16 3H5v18h14V6l-3-3Z" /><path d="M16 3v3h3M8 12h8M8 16h5" /></svg>; }
function IcTruck()  { return <svg {...I}><rect x="1" y="7" width="14" height="10" rx="1" /><path d="M15 13h5l2 2v3h-7" /><circle cx="6" cy="19" r="2" /><circle cx="18" cy="19" r="2" /></svg>; }
function IcPeople() { return <svg {...I}><circle cx="7.5" cy="6" r="3" /><path d="M2 17c.7-3 2.7-4.7 5.5-4.7S12.8 14 13.5 17" /><circle cx="16.5" cy="7" r="2.3" /><path d="M14 12.6c2.4.2 3.9 1.8 4.5 4.4" /></svg>; }
function IcGear()   { return <svg {...I}><circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>; }
function IcPlus()   { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>; }
function IcChevD()  { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 8 }}><polyline points="6 9 12 15 18 9" /></svg>; }
function IcChevU()  { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 8 }}><polyline points="18 15 12 9 6 15" /></svg>; }
function IcExcel()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" /><line x1="10" y1="9" x2="14" y2="9" /></svg>; }
function IcPdf()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>; }

/* ═══ CONFIG ═══ */
const CREATE_OPTIONS = [
  { type: 'quotation',       label: 'Quotation',        to: '/portal/billing/quotation/new' },
  { type: 'tax_invoice',     label: 'Tax Invoice',      to: '/portal/billing/invoices/new' },
  { type: 'bill_of_supply',  label: 'Bill of Supply',   to: '/portal/billing/bill-of-supply/new' },
  { type: 'debit_note',      label: 'Debit Note',       to: '/portal/billing/debit-notes/new' },
  { type: 'credit_note',     label: 'Credit Note',      to: '/portal/billing/credit-notes/new' },
  { type: 'delivery_challan', label: 'Delivery Challan', to: '/portal/billing/delivery-challan/new' },
];

const CARDS = [
  { key: 'total',            label: 'Total Documents',    Ic: IcLayers,  color: '#1e3a5f', bg: '#e8f0fe', viewLabel: 'View All Documents',    viewTo: null },
  { key: 'tax_invoice',      label: 'Tax Invoices',       Ic: IcDoc,     color: '#2563eb', bg: '#eff6ff', viewLabel: 'View Tax Invoices',     viewTo: '/portal/billing/invoices' },
  { key: 'bill_of_supply',   label: 'Bills of Supply',    Ic: IcGrid,    color: '#15803d', bg: '#f0fdf4', viewLabel: 'View Bills of Supply',  viewTo: '/portal/billing/bill-of-supply' },
  { key: 'debit_note',       label: 'Debit Notes',        Ic: IcDocPlus, color: '#7c3aed', bg: '#f5f3ff', viewLabel: 'View Debit Notes',      viewTo: '/portal/billing/debit-notes' },
  { key: 'credit_note',      label: 'Credit Notes',       Ic: IcDocMin,  color: '#dc2626', bg: '#fef2f2', viewLabel: 'View Credit Notes',     viewTo: '/portal/billing/credit-notes' },
  { key: 'quotation',        label: 'Quotations',         Ic: IcClip,    color: '#d97706', bg: '#fffbeb', viewLabel: 'View Quotations',       viewTo: '/portal/billing/quotation' },
  { key: 'delivery_challan', label: 'Delivery Challans',  Ic: IcTruck,   color: '#0891b2', bg: '#ecfeff', viewLabel: 'View Delivery Challans', viewTo: '/portal/billing/delivery-challan' },
];

const DIST_SEGS = [
  { key: 'tax_invoice',      label: 'Tax Invoices',       color: '#2563eb' },
  { key: 'bill_of_supply',   label: 'Bills of Supply',    color: '#16a34a' },
  { key: 'debit_note',       label: 'Debit Notes',        color: '#7c3aed' },
  { key: 'credit_note',      label: 'Credit Notes',       color: '#dc2626' },
  { key: 'quotation',        label: 'Quotations',         color: '#d97706' },
  { key: 'delivery_challan', label: 'Delivery Challans',  color: '#0891b2' },
];

const QUICK = [
  { label: 'Create Tax Invoice',      to: '/portal/billing/invoices/new',        Ic: IcDoc,    color: '#2563eb', bg: '#eff6ff' },
  { label: 'Create Quotation',        to: '/portal/billing/quotation/new',       Ic: IcClip,   color: '#d97706', bg: '#fffbeb' },
  { label: 'Create Bill of Supply',   to: '/portal/billing/bill-of-supply/new',  Ic: IcGrid,   color: '#15803d', bg: '#f0fdf4' },
  { label: 'Create Delivery Challan', to: '/portal/billing/delivery-challan/new', Ic: IcTruck, color: '#0891b2', bg: '#ecfeff' },
  { label: 'Create Debit Note',       to: '/portal/billing/debit-notes/new',     Ic: IcDocPlus, color: '#7c3aed', bg: '#f5f3ff' },
  { label: 'Manage Parties',          to: '/portal/billing/parties',             Ic: IcPeople, color: '#64748b', bg: '#f8fafc' },
  { label: 'Create Credit Note',      to: '/portal/billing/credit-notes/new',    Ic: IcDocMin, color: '#dc2626', bg: '#fef2f2' },
  { label: 'Invoice Settings',        to: '/portal/billing/settings',            Ic: IcGear,   color: '#475569', bg: '#f1f5f9' },
];

/* ═══ CREATE DOCUMENT DROPDOWN ═══ */
function CreateDocumentDropdown({ profile }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const options = CREATE_OPTIONS.filter((o) => !isDocTypeDisabled(profile, o.type));
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  if (!options.length) return null;
  return (
    <div className="bp-dropdown-wrap" ref={ref}>
      <button type="button" className="bp-btn bp-btn-primary" onClick={() => setOpen((v) => !v)}>
        <IcPlus /> Create Document {open ? <IcChevU /> : <IcChevD />}
      </button>
      {open && (
        <div className="bp-dropdown-panel">
          <div className="bp-dropdown-panel-head">Create Document</div>
          {options.map((o) => <Link key={o.type} className="bp-dropdown-item" to={o.to} onClick={() => setOpen(false)}>{o.label}</Link>)}
        </div>
      )}
    </div>
  );
}

/* ═══ DONUT CHART ═══ */
function DonutChart({ counts }) {
  const r = 58, C = 2 * Math.PI * r;
  const total = DIST_SEGS.reduce((s, seg) => s + (counts[seg.key] || 0), 0);
  let cum = 0;
  const arcs = DIST_SEGS.map((seg) => {
    const cnt = counts[seg.key] || 0;
    const len = total > 0 ? (cnt / total) * C : 0;
    const off = cum;
    cum += len;
    return { ...seg, cnt, len, off };
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: 140, height: 140, flexShrink: 0 }}>
        <svg width="140" height="140" viewBox="0 0 140 140">
          <circle cx="70" cy="70" r={r} fill="none" stroke="#f1f5f9" strokeWidth="22" />
          {arcs.map((a) => a.cnt > 0 && (
            <circle key={a.key} cx="70" cy="70" r={r} fill="none"
              stroke={a.color} strokeWidth="22"
              strokeDasharray={`${a.len} ${C - a.len}`}
              strokeDashoffset={-a.off}
              style={{ transform: 'rotate(-90deg)', transformOrigin: '70px 70px' }}
            />
          ))}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <span style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', lineHeight: 1 }}>{total}</span>
          <span style={{ fontSize: 9.5, color: '#64748b', marginTop: 3 }}>Total</span>
          <span style={{ fontSize: 9.5, color: '#64748b' }}>Documents</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 140 }}>
        {arcs.map((a) => (
          <div key={a.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: a.color, flexShrink: 0 }} />
            <span style={{ flex: 1, color: '#475569', whiteSpace: 'nowrap' }}>{a.label}</span>
            <span style={{ fontWeight: 600, color: '#1e293b', minWidth: 20, textAlign: 'right' }}>{a.cnt}</span>
            <span style={{ color: '#94a3b8', fontSize: 11, minWidth: 48, textAlign: 'right' }}>({total > 0 ? (a.cnt / total * 100).toFixed(1) : '0.0'}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══ MAIN ═══ */
export default function BillingDashboard() {
  const { user } = useAuth();
  const profile = user?.client_profile;

  const portal = useClientPortal();
  const fyDefault = currentFyRange();
  const fy = portal?.fy || fyDefault.fy;
  const registerRefresh = portal?.registerRefresh;

  const [typeCounts, setTypeCounts] = useState({});
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 5 });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(5);
  const [loading, setLoading] = useState(true);

  const load = useCallback((p = page, pp = perPage) => {
    setLoading(true);
    const qs = new URLSearchParams({ fy, per_page: pp, page: p });
    api(`/billing/documents?${qs}`)
      .then((d) => {
        setTypeCounts(d.type_counts || {});
        setRows(d.data || []);
        setMeta({ current_page: d.current_page || 1, last_page: d.last_page || 1, total: d.total || 0, per_page: d.per_page || pp });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [fy, page, perPage]);

  useEffect(() => { load(page, perPage); }, [fy, page, perPage]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (registerRefresh) return registerRefresh(() => load(1, perPage)); }, [registerRefresh, load, perPage]);

  const totalCount = DIST_SEGS.reduce((s, seg) => s + (typeCounts[seg.key] || 0), 0);
  const allCounts = { ...typeCounts, total: totalCount };
  const tiTotal = typeCounts.tax_invoice || 0;
  const b2b = typeCounts.tax_invoice_b2b || 0;
  const b2c = typeCounts.tax_invoice_b2c || 0;

  const downloadReport = async (format) => {
    const token = getAuthToken();
    const [y1] = fy.split('-');
    const from = `${y1}-04-01`;
    const to = `${parseInt(y1, 10) + 1}-03-31`;
    const qs = new URLSearchParams({ type: 'document_register', from, to, format });
    const res = await fetch(`/api/billing/reports/export?${qs}`, { headers: { Authorization: `Bearer ${token}`, Accept: '*/*' } });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `documents_${fy}.${format === 'xlsx' ? 'xls' : 'pdf'}`; a.click();
    URL.revokeObjectURL(url);
  };

  const ROW = { display: 'grid', gap: 20, marginBottom: 20 };
  const EXPORT_BTN = (border) => ({ height: 38, padding: '0 14px', borderRadius: 10, border: `1.5px solid ${border}`, background: '#fff', color: border, fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: totalCount ? 'pointer' : 'not-allowed', opacity: totalCount ? 1 : 0.5 });

  return (
    <div className="bp-billing-dashboard" style={{ zoom: 0.9 }}>

      {/* ── TOOLBAR ── */}
      <div className="bp-toolbar" style={{ marginBottom: 18, flexWrap: 'wrap', rowGap: 10 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ background: '#e8f0fe', color: '#2563eb', width: 32, height: 32, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <IcDoc />
            </span>
            Billing Dashboard
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#64748b' }}>Manage your invoices, bills of supply, debit notes, credit notes, quotations and delivery challans.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <CreateDocumentDropdown profile={profile} />
          <button type="button" onClick={() => downloadReport('xlsx')} disabled={!totalCount} style={EXPORT_BTN('#16a34a')}><IcExcel /> Export Excel</button>
          <button type="button" onClick={() => downloadReport('pdf')} disabled={!totalCount} style={EXPORT_BTN('#ef4444')}><IcPdf /> Export PDF</button>
        </div>
      </div>

      {loading && !rows.length ? <LoadingBlock /> : (
        <>
          {/* ── ROW 1: SUMMARY CARDS + DISTRIBUTION ── */}
          <div style={{ ...ROW, gridTemplateColumns: '1fr 340px' }}>

            {/* 7 summary cards in 4-col grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {CARDS.map(({ key, label, Ic, color, bg, viewLabel, viewTo }) => (
                <div key={key} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '14px 14px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ background: bg, color, width: 38, height: 38, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Ic /></span>
                    <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 500, lineHeight: 1.3 }}>{label}</span>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1, marginBottom: 6, paddingLeft: 2 }}>{allCounts[key] ?? 0}</div>
                  {viewTo
                    ? <Link to={viewTo} style={{ fontSize: 11.5, color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>{viewLabel} →</Link>
                    : <span style={{ fontSize: 11.5, color: '#2563eb', fontWeight: 500 }}>{viewLabel} →</span>}
                </div>
              ))}
            </div>

            {/* Document Distribution card */}
            <div className="bp-card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontWeight: 700, fontSize: 14.5, color: '#1e3a5f', marginBottom: 14 }}>Document Distribution</div>
              <DonutChart counts={typeCounts} />
            </div>

          </div>

          {/* ── ROW 2: TAX INVOICE B2B/B2C + QUICK LINKS ── */}
          <div style={{ ...ROW, gridTemplateColumns: '1fr 1fr' }}>

            {/* Tax Invoice Summary */}
            <div className="bp-card" style={{ padding: '18px 20px' }}>
              <div style={{ fontWeight: 700, fontSize: 14.5, color: '#1e3a5f', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: '#e8f0fe', color: '#2563eb', width: 28, height: 28, borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><IcDoc /></span>
                Tax Invoice Summary (B2B vs B2C)
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Total Tax Invoices</div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: '#1e3a5f' }}>{tiTotal}</div>
                </div>
                <div style={{ width: 1, background: '#e2e8f0' }} />
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>B2B Invoices</div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: '#15803d' }}>{b2b}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>({tiTotal > 0 ? Math.round(b2b / tiTotal * 100) : 0}%)</div>
                </div>
                <div style={{ width: 1, background: '#e2e8f0' }} />
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>B2C Invoices</div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: '#d97706' }}>{b2c}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>({tiTotal > 0 ? Math.round(b2c / tiTotal * 100) : 0}%)</div>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div className="bp-card" style={{ padding: '18px 20px' }}>
              <div style={{ fontWeight: 700, fontSize: 14.5, color: '#1e3a5f', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: '#f1f5f9', color: '#475569', width: 28, height: 28, borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><IcGear /></span>
                Quick Links
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {QUICK.map(({ label, to, Ic, color, bg }) => (
                  <Link key={to} to={to}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 8, textDecoration: 'none', fontSize: 12.5, fontWeight: 500, color: '#334155', transition: 'background .15s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ background: bg, color, width: 30, height: 30, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Ic /></span>
                    {label}
                  </Link>
                ))}
              </div>
            </div>

          </div>

          {/* ── ROW 3: RECENT DOCUMENTS ── */}
          <div className="bp-card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5, color: '#1e3a5f', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: '#e8f0fe', color: '#2563eb', width: 28, height: 28, borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><IcLayers /></span>
                Recent Documents
              </div>
              <Link to="/portal/billing/invoices" style={{ fontSize: 13, fontWeight: 600, color: '#2563eb', textDecoration: 'none' }}>View All Documents →</Link>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="bp-table bp-doc-table" style={{ width: '100%', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>#</th>
                    <th>DOCUMENT NO.</th>
                    <th>DATE</th>
                    <th>PARTY NAME</th>
                    <th>DOCUMENT TYPE</th>
                    <th>AMOUNT (₹)</th>
                    <th>STATUS</th>
                    <th>CREATED ON</th>
                    <th style={{ textAlign: 'center' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((d, i) => {
                    const card = CARDS.find((c) => c.key === d.type);
                    return (
                      <tr key={d.id}>
                        <td>{(meta.current_page - 1) * meta.per_page + i + 1}</td>
                        <td><Link className="bp-doc-num-link" to={billingDocPath(d.type, d.id)}>{d.number}</Link></td>
                        <td>{formatDMY(d.document_date)}</td>
                        <td>{d.customer?.name || '—'}</td>
                        <td>
                          <span style={{ background: card?.bg || '#f1f5f9', color: card?.color || '#475569', borderRadius: 6, padding: '3px 10px', fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {docTypeLabel(d.type)}
                          </span>
                        </td>
                        <td>{money(d.grand_total || d.total_amount)}</td>
                        <td><span className={`bp-badge ${paymentStatusBadge(d.status)}`}>{paymentStatusLabel(d.status)}</span></td>
                        <td style={{ whiteSpace: 'nowrap' }}>{formatDMYTime(d.created_at)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <Link className="bp-btn bp-btn-outline" style={{ padding: '4px 12px', fontSize: 12 }} to={billingDocPath(d.type, d.id)}>View</Link>
                        </td>
                      </tr>
                    );
                  })}
                  {!rows.length && <tr><td colSpan={9} className="bp-table-empty">No documents for FY {fy}</td></tr>}
                </tbody>
              </table>
            </div>
            <NumberedPagination
              meta={meta}
              perPage={perPage}
              onPerPage={(v) => { setPerPage(v); setPage(1); }}
              onPage={setPage}
              itemLabel="documents"
              perPageOptions={[5, 10, 25, 50]}
            />
          </div>
        </>
      )}
    </div>
  );
}
