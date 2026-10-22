import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getAuthToken } from '../../api/client';
import { useReportsEnv } from './ReportsContext';
import { LoadingBlock } from '../../components/Spinner';
import {
  buildFyOptions, currentFyRange, docTypeLabel, money,
  paymentStatusLabel,
} from './billingUtils';
import {
  MarkAsPaidModal, UnmarkAsPaidModal, DocPanel, RecordedGrid, ModalShell, CoinIcon, fmtDate,
} from './PaymentModals';

/* ── Icons ─────────────────────────────────────────────────── */
const ExcelIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><line x1="10" y1="9" x2="14" y2="9"/></svg>;
const PdfIcon  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
const CalendarIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const FunnelIcon = () => <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4h14l-5.5 6.5V16l-3 1.5v-7L3 4Z"/></svg>;
const SearchIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const RefreshIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>;
const EyeIcon  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const CheckIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const AlertIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;

const PAGE_SIZES = [10, 25, 50];

const AlertDocIcon  =() => <svg width="26" height="26" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 3h10l6 6v18a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" stroke="white" strokeWidth="1.8" fill="none"/><path d="M19 3v6h6" stroke="white" strokeWidth="1.6" fill="none"/><line x1="16" y1="14" x2="16" y2="20" stroke="white" strokeWidth="2" strokeLinecap="round"/><circle cx="16" cy="24" r="1.3" fill="white"/></svg>;
const CheckCircleIcon = () => <svg width="26" height="26" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="12" stroke="white" strokeWidth="1.8" fill="none"/><path d="M10.5 16.5l3.5 3.5 7.5-7.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>;

/* ══════════════════════════════════════════════════════════════
   VIEW PAID MODAL (shows payment details + Unmark as Paid)
   ══════════════════════════════════════════════════════════════ */
function ViewPaidModal({ doc, onClose, onUnmark }) {
  const env = useReportsEnv();
  const [log,     setLog]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api(env.paymentLogApi(doc.id))
      .then((d) => setLog(d.latest || null))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [doc.id]);

  return (
    <ModalShell onClose={onClose} accentColor="#ef4444">
      {/* Header */}
      <div className="om-head" style={{ padding: '18px 22px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0f172a' }}>Paid Document Details</h3>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Document and recorded payment details.</p>
        </div>
        <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#334155', lineHeight: 1, display: 'flex' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>

      <div style={{ padding: '8px 22px 16px', overflowY: 'auto', maxHeight: '65vh' }}>
        <DocPanel doc={doc} />

        {/* Recorded Payment Details */}
        {loading ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>Loading payment details…</div>
        ) : log ? (
          <div className="om-panel" style={{ background: '#fff', border: '1px solid #d9e5f6', borderRadius: 10, padding: 0, marginBottom: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#eaf2fd', color: '#0f2a5f', fontWeight: 800, fontSize: 13 }}>
              <CoinIcon /> Payment Details (Recorded)
            </div>
            <RecordedGrid log={log} />
          </div>
        ) : (
          <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>No payment details recorded.</div>
        )}
      </div>

      {/* Footer: Unmark action button */}
      <div className="om-foot" style={{ padding: '12px 22px 18px', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <button type="button" onClick={onClose} style={{ height: 40, padding: '0 28px', borderRadius: 9, border: '1.5px solid #dbe3ef', background: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Close</button>
        {env.canMarkPayment && (
          <button type="button" onClick={() => onUnmark(doc, log)}
            style={{ height: 40, padding: '0 24px', borderRadius: 9, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            Unmark as Paid
          </button>
        )}
      </div>
    </ModalShell>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */
export default function OutstandingPage() {
  const fyDefault = currentFyRange();
  const fyOptions = buildFyOptions();

  const [fy, setFy]         = useState(fyDefault.fy);
  const [from, setFrom]     = useState(fyDefault.from);
  const [to, setTo]         = useState(fyDefault.to);
  const [activeQuick, setActiveQuick] = useState('fy');

  const [tab,           setTab]           = useState('all');
  const [search,        setSearch]        = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState('');
  const [filterOpen,    setFilterOpen]    = useState(false);

  const env = useReportsEnv();
  const [unpaidRows, setUnpaidRows] = useState([]);
  const [paidRows,   setPaidRows]   = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [err,        setErr]        = useState('');

  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal state
  const [markDoc,   setMarkDoc]   = useState(null); // doc to mark paid
  const [viewDoc,   setViewDoc]   = useState(null); // doc to view (paid)
  const [unmarkDoc, setUnmarkDoc] = useState(null); // { doc, log } for unmark confirmation

  const load = () => {
    setErr(''); setLoading(true);
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to)   qs.set('to', to);
    Promise.all([
      api(`${env.reportsApi}?type=outstanding_report&${qs}`),
      api(`${env.reportsApi}?type=paid_invoices&${qs}`),
    ])
      .then(([u, p]) => {
        setUnpaidRows(Array.isArray(u?.data) ? u.data : []);
        setPaidRows(Array.isArray(p?.data) ? p.data : []);
      })
      .catch((e) => setErr(e.message || 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { setPage(1); }, [tab, search, docTypeFilter, unpaidRows, paidRows]);

  const applyCurrentMonth = () => {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth() + 1;
    const mStr = String(m).padStart(2, '0');
    const last = new Date(y, m, 0).getDate();
    setFrom(`${y}-${mStr}-01`); setTo(`${y}-${mStr}-${String(last).padStart(2, '0')}`);
    setFy(''); setActiveQuick('current');
  };
  const applyPreviousMonth = () => {
    const now = new Date(); now.setMonth(now.getMonth() - 1);
    const y = now.getFullYear(), m = now.getMonth() + 1;
    const mStr = String(m).padStart(2, '0');
    const last = new Date(y, m, 0).getDate();
    setFrom(`${y}-${mStr}-01`); setTo(`${y}-${mStr}-${String(last).padStart(2, '0')}`);
    setFy(''); setActiveQuick('prev');
  };
  const applyFy = (val) => {
    setFy(val); setActiveQuick('fy');
    if (val) {
      const year = parseInt(val.split('-')[0], 10);
      if (year) { setFrom(`${year}-04-01`); setTo(`${year + 1}-03-31`); }
    }
  };
  const handleClear = () => {
    const next = currentFyRange();
    setFrom(next.from); setTo(next.to); setFy(next.fy); setActiveQuick('fy');
    setSearch(''); setDocTypeFilter('');
    setTimeout(load, 0);
  };

  const download = async (format) => {
    const token = getAuthToken();
    const type = tab === 'paid' ? 'paid_invoices' : 'outstanding_report';
    const qs = new URLSearchParams({ type, from, to, format });
    const res = await fetch(`${env.exportUrl}?${qs}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: '*/*' },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `outstanding_${from}_to_${to}.${format === 'xlsx' ? 'xls' : 'pdf'}`;
    a.click();
  };

  /* ── Derived ── */
  const allRows = useMemo(
    () => [...unpaidRows, ...paidRows].sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || ''))),
    [unpaidRows, paidRows]
  );

  const amt = (r) => {
    const v = Number(r.grand_total || r.total_amount || 0);
    return r.type === 'credit_note' ? -v : v;
  };

  const kpiOutstanding = { count: unpaidRows.length, total: unpaidRows.reduce((s, r) => s + amt(r), 0) };
  const kpiPaid        = { count: paidRows.length,   total: paidRows.reduce((s, r) => s + amt(r), 0) };

  const tabRows = tab === 'unpaid' ? unpaidRows : tab === 'paid' ? paidRows : allRows;

  const filtered = tabRows.filter((r) => {
    if (docTypeFilter && r.type !== docTypeFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.customer?.name || '').toLowerCase().includes(q) || String(r.number || '').toLowerCase().includes(q);
  });

  const total     = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage  = Math.min(page, pageCount);
  const pageRows  = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const pageNums = (() => {
    const nums = [];
    for (let p = 1; p <= pageCount; p++) {
      if (p === 1 || p === pageCount || (p >= safePage - 1 && p <= safePage + 1)) nums.push(p);
      else if (nums[nums.length - 1] !== '…') nums.push('…');
    }
    return nums;
  })();

  const isPaid = (r) => r.status === 'paid';

  return (
    <div style={{ maxWidth: '100%' }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="gs-head ot-head" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="gl-head-ic ot-head-ic" style={{ width: 46, height: 46, borderRadius: 12, background: 'linear-gradient(135deg,#fb923c,#f97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 18px -8px rgba(249,115,22,0.8)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>Outstanding</h2>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b' }}>
              View all invoices, debit notes, credit notes and other documents with payment status.
            </p>
          </div>
        </div>
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

      {/* ── Filter Bar ─────────────────────────────────────── */}
      <div className="bp-card gs-filter" style={{ marginBottom: 20, padding: '14px 18px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          {[
            { id: 'current', label: 'Current Month', action: applyCurrentMonth },
            { id: 'prev',    label: 'Previous Month', action: applyPreviousMonth },
          ].map(({ id, label, action }) => (
            <button key={id} type="button" onClick={action} style={{
              height: 36, padding: '0 14px', borderRadius: 8, whiteSpace: 'nowrap',
              border: '1.5px solid ' + (activeQuick === id ? '#2563eb' : '#e2e8f0'),
              background: activeQuick === id ? '#eff6ff' : '#fff',
              color: activeQuick === id ? '#2563eb' : 'var(--bp-text)',
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}>{label}</button>
          ))}
          <button type="button" onClick={() => setActiveQuick('fy')} style={{
            height: 36, padding: '0 14px', borderRadius: 8, whiteSpace: 'nowrap',
            border: '1.5px solid ' + (activeQuick === 'fy' ? '#2563eb' : '#e2e8f0'),
            background: activeQuick === 'fy' ? '#eff6ff' : '#fff',
            color: activeQuick === 'fy' ? '#2563eb' : 'var(--bp-text)',
            fontWeight: 600, fontSize: 13, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}><CalendarIcon /> Financial Year</button>

          <div style={{ width: 1, height: 28, background: '#e2e8f0', alignSelf: 'center' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--bp-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Financial Year</span>
            <select className="bp-select" style={{ height: 36, minWidth: 130 }} value={fy} onChange={(e) => applyFy(e.target.value)}>
              {fyOptions.map((opt) => <option key={opt} value={opt}>FY {opt}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--bp-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>From Date</span>
            <input type="date" className="bp-input" style={{ height: 36, minWidth: 148 }} value={from}
              onChange={(e) => { setFrom(e.target.value); setActiveQuick(''); setFy(''); }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--bp-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>To Date</span>
            <input type="date" className="bp-input" style={{ height: 36, minWidth: 148 }} value={to}
              onChange={(e) => { setTo(e.target.value); setActiveQuick(''); setFy(''); }} />
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <button type="button" disabled={loading} onClick={load}
              style={{ height: 36, padding: '0 18px', borderRadius: 8, background: '#0052cc', border: 'none', color: '#fff', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 7, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, whiteSpace: 'nowrap' }}>
              <FunnelIcon /> Apply Filters
            </button>
            <button type="button" onClick={handleClear}
              style={{ height: 36, padding: '0 14px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', color: 'var(--bp-text)', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Clear
            </button>
          </div>
        </div>
        {err && <p style={{ color: '#ef4444', margin: '10px 0 0', fontSize: 13 }}>{err}</p>}
      </div>

      {/* ── KPI Cards ──────────────────────────────────────── */}
      <div className="gl-kpis ot-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        <div className="gl-kpi" style={{ padding: '16px 20px', background: 'linear-gradient(145deg,#fef2f2,#fee2e2)', borderRadius: 14, border: '1.5px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="gl-kpi-ic" style={{ width: 52, height: 52, borderRadius: 14, background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px #ef444444' }}>
            <AlertDocIcon />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>Total Outstanding (Unpaid)</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--bp-navy)', lineHeight: 1.1 }}>{money(kpiOutstanding.total)}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{kpiOutstanding.count} Invoices</div>
          </div>
        </div>
        <div className="gl-kpi" style={{ padding: '16px 20px', background: 'linear-gradient(145deg,#f0fdf4,#dcfce7)', borderRadius: 14, border: '1.5px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="gl-kpi-ic" style={{ width: 52, height: 52, borderRadius: 14, background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px #16a34a44' }}>
            <CheckCircleIcon />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>Paid (In Selected Period)</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#16a34a', lineHeight: 1.1 }}>{money(kpiPaid.total)}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{kpiPaid.count} Invoices</div>
          </div>
        </div>
      </div>

      {/* ── Table section ──────────────────────────────────── */}
      <div className="ot-table" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 0, overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8, flex: 1 }}>
            {[
              { id: 'all',    label: 'All',    count: allRows.length },
              { id: 'unpaid', label: 'Unpaid', count: unpaidRows.length },
              { id: 'paid',   label: 'Paid',   count: paidRows.length },
            ].map(({ id, label, count }) => (
              <button key={id} type="button" onClick={() => setTab(id)}
                style={{
                  height: 36, padding: '0 18px', borderRadius: 10,
                  border: '1.5px solid ' + (tab === id ? '#1d5fe0' : '#dbe3ef'),
                  background: tab === id ? '#1d5fe0' : '#fff', color: tab === id ? '#fff' : 'var(--bp-text)',
                  fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
                }}>
                {label} {count}
              </button>
            ))}
          </div>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><SearchIcon /></span>
            <input type="text" className="bp-input" style={{ height: 36, paddingLeft: 34, minWidth: 220 }}
              placeholder="Search invoice or party..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          {/* Filter */}
          <div style={{ position: 'relative' }}>
            <button type="button" onClick={() => setFilterOpen((v) => !v)}
              style={{ height: 36, padding: '0 14px', borderRadius: 8, border: '1.5px solid ' + (docTypeFilter ? '#2563eb' : '#e2e8f0'), background: docTypeFilter ? '#eff6ff' : '#fff', color: docTypeFilter ? '#2563eb' : 'var(--bp-text)', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <FunnelIcon /> Filter
            </button>
            {filterOpen && (
              <div style={{ position: 'absolute', right: 0, top: 42, zIndex: 5, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 14, minWidth: 200 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--bp-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Document Type</div>
                <select className="bp-select" style={{ height: 34, width: '100%' }} value={docTypeFilter} onChange={(e) => setDocTypeFilter(e.target.value)}>
                  <option value="">All Types</option>
                  <option value="tax_invoice">Tax Invoice</option>
                  <option value="bill_of_supply">Bill of Supply</option>
                  <option value="debit_note">Debit Note</option>
                  <option value="credit_note">Credit Note</option>
                </select>
                {docTypeFilter && (
                  <button type="button" onClick={() => setDocTypeFilter('')}
                    style={{ marginTop: 8, background: 'none', border: 'none', color: '#2563eb', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                    Clear filter
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Refresh */}
          <button type="button" onClick={load} title="Refresh"
            style={{ height: 36, width: 36, borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', color: 'var(--bp-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <RefreshIcon />
          </button>
        </div>

        {/* Table */}
        {loading ? <LoadingBlock /> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', color: '#0f172a' }}>
                  {['Invoice No.','Date','Party Name','Document Type','Total (₹)','Status','Actions'].map((h) => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: ['Total (₹)'].includes(h) ? 'right' : ['Status','Actions'].includes(h) ? 'center' : 'left', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--bp-muted)' }}>
                    {tab === 'unpaid' ? 'No unpaid invoices — outstanding is clear.' : tab === 'paid' ? 'No paid invoices in this period.' : 'No data for this period.'}
                  </td></tr>
                ) : pageRows.map((r, i) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #e8eef6', background: '#fff' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f5f9ff'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}>
                    <td style={{ padding: '12px 16px', fontSize: 13 }}>
                      <Link to={env.docLink(r.type, r.id)} style={{ fontWeight: 700, color: '#2563eb', textDecoration: 'none' }}>{r.number}</Link>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#475569' }}>{fmtDate(r.document_date)}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: 'var(--bp-navy)' }}>{r.customer?.name || '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#475569' }}>{docTypeLabel(r.type)}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, textAlign: 'right', fontWeight: 700, color: r.type === 'credit_note' ? '#dc2626' : '#0f172a' }}>
                      {amt(r) < 0 ? `-${money(Math.abs(amt(r)))}` : money(amt(r))}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{ display: 'inline-block', minWidth: 64, padding: '3px 12px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: isPaid(r) ? '#d9f6e3' : '#fde2e2', color: isPaid(r) ? '#15803d' : '#dc2626' }}>{paymentStatusLabel(r.status)}</span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      {isPaid(r) ? (
                        /* Paid → View only */
                        <button type="button" onClick={() => setViewDoc(r)}
                          style={{ height: 32, padding: '0 20px', borderRadius: 8, border: '1.5px solid #1d5fe0', background: '#fff', color: '#2563eb', fontWeight: 600, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                          <EyeIcon /> View
                        </button>
                      ) : !env.canMarkPayment ? (
                        /* Admin views the same report; recording a payment stays a client action */
                        <span style={{ color: '#94a3b8' }}>—</span>
                      ) : (
                        /* Unpaid → Mark as Paid only */
                        <button type="button" onClick={() => setMarkDoc(r)}
                          style={{ height: 32, padding: '0 16px', borderRadius: 8, border: 'none', background: '#16a34a', boxShadow: '0 4px 10px -4px rgba(22,163,74,0.7)', color: '#fff', fontWeight: 600, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                          <CheckIcon /> Mark as Paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Record count */}
        {total > 0 && (
          <div style={{ padding: '10px 20px', borderTop: '1px solid #f1f5f9', fontSize: 12, color: '#64748b' }}>
            Showing {(safePage - 1) * pageSize + 1} to {Math.min(safePage * pageSize, total)} of {total} records
          </div>
        )}
      </div>

      {/* ── Pagination ──────────────────────────────────────── */}
      {total > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, color: '#64748b', marginTop: 14, flexWrap: 'wrap', gap: 10 }}>
          <span>Showing {(safePage - 1) * pageSize + 1} to {Math.min(safePage * pageSize, total)} of {total} entries</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <button type="button" onClick={() => setPage(1)} disabled={safePage === 1} className="bp-page-btn">«</button>
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1} className="bp-page-btn">‹</button>
            {pageNums.map((p, i) => p === '…'
              ? <span key={`e${i}`} style={{ padding: '0 4px', color: '#94a3b8' }}>…</span>
              : <button key={p} type="button" onClick={() => setPage(p)} className={`bp-page-btn${p === safePage ? ' active' : ''}`}>{p}</button>
            )}
            <button type="button" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={safePage === pageCount} className="bp-page-btn">›</button>
            <button type="button" onClick={() => setPage(pageCount)} disabled={safePage === pageCount} className="bp-page-btn">»</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Rows per page:</span>
            <select className="bp-select pg-rows" style={{ height: 32, width: 70 }} value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
              {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────── */}
      {markDoc && (
        <MarkAsPaidModal
          doc={markDoc}
          onClose={() => setMarkDoc(null)}
          onSuccess={() => { setMarkDoc(null); load(); }}
        />
      )}
      {viewDoc && !unmarkDoc && (
        <ViewPaidModal
          doc={viewDoc}
          onClose={() => setViewDoc(null)}
          onUnmark={(doc, log) => { setUnmarkDoc({ doc, log }); setViewDoc(null); }}
        />
      )}
      {unmarkDoc && (
        <UnmarkAsPaidModal
          doc={unmarkDoc.doc}
          log={unmarkDoc.log}
          onClose={() => setUnmarkDoc(null)}
          onSuccess={() => { setUnmarkDoc(null); load(); }}
        />
      )}
    </div>
  );
}
