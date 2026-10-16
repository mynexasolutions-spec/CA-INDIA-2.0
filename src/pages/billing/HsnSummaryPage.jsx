import { useEffect, useState } from 'react';
import { api, getAuthToken } from '../../api/client';
import { LoadingBlock } from '../../components/Spinner';
import { buildFyOptions, currentFyRange, money } from './billingUtils';
import { useReportsEnv } from './ReportsContext';

/* ── Icons ─────────────────────────────────────────────────── */
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
function CalendarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}
function FunnelIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4h14l-5.5 6.5V16l-3 1.5v-7L3 4Z"/>
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  );
}
function ResetIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
    </svg>
  );
}

function formatDateDisplay(isoStr) {
  if (!isoStr) return '—';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const [y, m, d] = isoStr.split('-');
  return `${d} ${months[Number(m) - 1]} ${y}`;
}

function numFmt(v, dec = 2) {
  return Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

const PAGE_SIZES = [25, 50, 100];

const CODE_TYPE_OPTIONS = [
  { value: '', label: 'All (HSN + SAC)' },
  { value: 'H', label: 'HSN only' },
  { value: 'S', label: 'SAC only' },
];

function isSac(code) {
  return String(code || '').startsWith('99');
}

export default function HsnSummaryPage({
  title = 'HSN / SAC Summary',
  apiPath: apiPathProp,
  exportPath: exportPathProp,
}) {
  const env = useReportsEnv();
  const apiPath = apiPathProp ?? env.reportsApi;
  const exportPath = exportPathProp ?? env.exportUrl;
  const fyDefault = currentFyRange();
  const fyOptions = buildFyOptions();

  const [fy, setFy]         = useState(fyDefault.fy);
  const [from, setFrom]     = useState(fyDefault.from);
  const [to, setTo]         = useState(fyDefault.to);
  const [activeQuick, setActiveQuick] = useState('fy');
  const [codeType, setCodeType]       = useState('');
  const [search, setSearch]           = useState('');
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr]     = useState('');
  const [page, setPage]   = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const run = () => {
    setErr('');
    setLoading(true);
    const qs = new URLSearchParams({ type: 'hsn_summary', from, to });
    api(`${apiPath}?${qs}`)
      .then(setData)
      .catch((e) => setErr(e.message || 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { run(); }, []);

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
    setCodeType(''); setSearch('');
  };

  const download = async (format) => {
    const token = getAuthToken();
    const qs = new URLSearchParams({ type: 'hsn_summary', from, to, format });
    const res = await fetch(`${exportPath}?${qs}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: '*/*' },
    });
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    // Export is legacy SpreadsheetML XML, not real OOXML — must be named .xls, not
    // .xlsx, or Excel refuses to open it ("file format or extension is not valid").
    a.download = `hsn_summary_${from}_to_${to}.${format === 'xlsx' ? 'xls' : 'pdf'}`;
    a.click();
  };

  // Normalize rows from API
  const rawRows = (() => {
    if (!data) return [];
    const d = data?.data ?? data;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.rows)) return d.rows;
    return [];
  })();

  // Apply filters
  const filtered = rawRows.filter((r) => {
    const type = isSac(r.hsn_sac) ? 'S' : 'H';
    if (codeType && type !== codeType) return false;
    if (search && !String(r.hsn_sac || '').includes(search)) return false;
    return true;
  });

  // Pagination
  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  // KPI stats
  const hsnCount = rawRows.filter((r) => !isSac(r.hsn_sac)).length;
  const sacCount = rawRows.filter((r) => isSac(r.hsn_sac)).length;
  const totalQty = rawRows.reduce((s, r) => s + Number(r.qty || 0), 0);
  const totalTaxable = rawRows.reduce((s, r) => s + Number(r.taxable || r.taxable_value || 0), 0);
  const totalGst = rawRows.reduce((s, r) => s + Number(r.igst || 0) + Number(r.cgst || 0) + Number(r.sgst || 0), 0);

  // Table totals
  const totQty     = filtered.reduce((s, r) => s + Number(r.qty || 0), 0);
  const totTaxable = filtered.reduce((s, r) => s + Number(r.taxable || r.taxable_value || 0), 0);
  const totIgst    = filtered.reduce((s, r) => s + Number(r.igst || 0), 0);
  const totCgst    = filtered.reduce((s, r) => s + Number(r.cgst || 0), 0);
  const totSgst    = filtered.reduce((s, r) => s + Number(r.sgst || 0), 0);

  return (
    <div style={{ maxWidth: '100%' }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/>
            </svg>
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--bp-navy)' }}>{title}</h2>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--bp-muted)' }}>
              Detailed summary of HSN and SAC wise quantity, taxable value and GST breakup.
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
      <div className="bp-card" style={{ marginBottom: 20, padding: '14px 18px' }}>
        {/* Row 1 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          {/* Quick pills */}
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

          {/* FY */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--bp-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Financial Year</span>
            <select className="bp-select" style={{ height: 36, minWidth: 130 }} value={fy} onChange={(e) => applyFy(e.target.value)}>
              {fyOptions.map((opt) => <option key={opt} value={opt}>FY {opt}</option>)}
            </select>
          </div>

          {/* From */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--bp-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>From Date</span>
            <input type="date" className="bp-input" style={{ height: 36, minWidth: 148 }} value={from}
              onChange={(e) => { setFrom(e.target.value); setActiveQuick(''); setFy(''); }} />
          </div>

          {/* To */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--bp-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>To Date</span>
            <input type="date" className="bp-input" style={{ height: 36, minWidth: 148 }} value={to}
              onChange={(e) => { setTo(e.target.value); setActiveQuick(''); setFy(''); }} />
          </div>

          {/* Actions */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <button type="button" disabled={loading} onClick={run}
              style={{ height: 36, padding: '0 18px', borderRadius: 8, background: '#0052cc', border: 'none', color: '#fff', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 7, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, whiteSpace: 'nowrap' }}>
              <FunnelIcon /> Apply Filters
            </button>
            <button type="button" onClick={handleClear}
              style={{ height: 36, padding: '0 14px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', color: 'var(--bp-text)', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Clear
            </button>
          </div>
        </div>

        {/* Row 2 — Search + Code Type + Reset */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginTop: 12 }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '0 0 260px' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <SearchIcon />
            </span>
            <input
              type="text"
              className="bp-input"
              style={{ height: 36, paddingLeft: 34, width: '100%' }}
              placeholder="Search HSN or SAC Code"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          {/* Code Type */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--bp-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Code Type</span>
            <select className="bp-select" style={{ height: 36, minWidth: 160 }} value={codeType}
              onChange={(e) => { setCodeType(e.target.value); setPage(1); }}>
              {CODE_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Reset */}
          <button type="button"
            onClick={() => { setCodeType(''); setSearch(''); setPage(1); }}
            style={{ height: 36, padding: '0 14px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', color: '#2563eb', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
            <ResetIcon /> Reset
          </button>
        </div>
        {err && <p style={{ color: '#ef4444', margin: '10px 0 0', fontSize: 13 }}>{err}</p>}
      </div>

      {/* ── KPI Cards ──────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 20 }}>
        {/* Total HSN Codes */}
        <div style={{ padding: '16px 18px', background: 'linear-gradient(145deg,#eff6ff,#dbeafe)', borderRadius: 14, border: '1.5px solid rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: 10 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Total HSN Codes</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--bp-navy)', lineHeight: 1.2 }}>{hsnCount}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>HSN Codes</div>
          </div>
        </div>

        {/* Total SAC Codes */}
        <div style={{ padding: '16px 18px', background: 'linear-gradient(145deg,#f0fdf4,#dcfce7)', borderRadius: 14, border: '1.5px solid rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: 10 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
              <path d="M14 17h3m0 0h3m-3 0v-3m0 3v3"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Total SAC Codes</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--bp-navy)', lineHeight: 1.2 }}>{sacCount}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>SAC Codes</div>
          </div>
        </div>

        {/* Total Quantity */}
        <div style={{ padding: '16px 18px', background: 'linear-gradient(145deg,#fff7ed,#fed7aa)', borderRadius: 14, border: '1.5px solid rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: 10 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Total Quantity</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--bp-navy)', lineHeight: 1.2 }}>{numFmt(totalQty, 2)}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Total Units</div>
          </div>
        </div>

        {/* Total Taxable Value */}
        <div style={{ padding: '16px 18px', background: 'linear-gradient(145deg,#faf5ff,#e9d5ff)', borderRadius: 14, border: '1.5px solid rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: 10 }}>
            <svg width="22" height="22" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="12" stroke="white" strokeWidth="1.8" fill="none"/>
              <text x="16" y="21" textAnchor="middle" fontSize="14" fontWeight="800" fill="white" stroke="none">₹</text>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Total Taxable Value</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--bp-navy)', lineHeight: 1.2 }}>{money(totalTaxable)}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Sum of taxable value</div>
          </div>
        </div>

        {/* Total GST Amount */}
        <div style={{ padding: '16px 18px', background: 'linear-gradient(145deg,#eff6ff,#dbeafe)', borderRadius: 14, border: '1.5px solid rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: 10 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Total GST Amount</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--bp-navy)', lineHeight: 1.2 }}>{money(totalGst)}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>IGST + CGST + SGST</div>
          </div>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────── */}
      <div className="bp-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
        {/* Report period bar */}
        <div style={{ padding: '11px 18px', borderBottom: '1px solid var(--bp-border)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: '#f8fafc' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--bp-navy)' }}>
            Report Period:&nbsp;
            <span style={{ fontWeight: 500, color: 'var(--bp-text)' }}>{formatDateDisplay(from)} to {formatDateDisplay(to)}</span>
          </span>
          {/* Legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 12, fontWeight: 600 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 22, height: 22, borderRadius: 4, boxSizing: 'border-box', background: '#eff6ff', border: '1.5px solid #2563eb', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, lineHeight: 1 }}>H</span>
              = HSN Code
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 22, height: 22, borderRadius: 4, boxSizing: 'border-box', background: '#f0fdf4', border: '1.5px solid #16a34a', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, lineHeight: 1 }}>S</span>
              = SAC Code
            </div>
          </div>
        </div>

        {loading ? (
          <LoadingBlock />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--bp-border)' }}>
                  {['Code Type', 'HSN / SAC Code', 'GST Rate (%)', 'QTY', 'UQC', 'Taxable Value (₹)', 'IGST (₹)', 'CGST (₹)', 'SGST (₹)'].map((h) => (
                    <th key={h} style={{
                      padding: '13px 14px',
                      textAlign: 'center',
                      fontSize: 12, fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap',
                      verticalAlign: 'middle', lineHeight: 1.3,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr><td colSpan={9} style={{ padding: '32px', textAlign: 'center', color: 'var(--bp-muted)' }}>No data for this period</td></tr>
                ) : (
                  pageRows.map((r, i) => {
                    const type = isSac(r.hsn_sac) ? 'S' : 'H';
                    const isSacRow = type === 'S';
                    return (
                      <tr key={`${r.hsn_sac}-${i}`} style={{ borderBottom: '1px solid var(--bp-border)', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ padding: '14px', textAlign: 'center', verticalAlign: 'middle' }}>
                          <span style={{
                            width: 24, height: 24, borderRadius: 5, boxSizing: 'border-box',
                            background: isSacRow ? '#f0fdf4' : '#eff6ff',
                            border: `1.5px solid ${isSacRow ? '#16a34a' : '#2563eb'}`,
                            color: isSacRow ? '#16a34a' : '#2563eb',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 800, lineHeight: 1, verticalAlign: 'middle',
                          }}>{type}</span>
                        </td>
                        <td style={{ padding: '14px', textAlign: 'center', fontSize: 13, fontWeight: 500, color: 'var(--bp-navy)', verticalAlign: 'middle', lineHeight: 1.4, whiteSpace: 'nowrap' }}>{r.hsn_sac || '—'}</td>
                        <td style={{ padding: '14px', textAlign: 'center', fontSize: 13, verticalAlign: 'middle', lineHeight: 1.4 }}>
                          {r.gst_rate != null ? `${Number(r.gst_rate).toFixed(0)}%` : '—'}
                        </td>
                        <td style={{ padding: '14px', textAlign: 'center', fontSize: 13, verticalAlign: 'middle', lineHeight: 1.4 }}>{numFmt(r.qty, 2)}</td>
                        <td style={{ padding: '14px', textAlign: 'center', fontSize: 13, color: '#64748b', verticalAlign: 'middle', lineHeight: 1.4 }}>{r.unit || r.uqc || 'NOS'}</td>
                        <td style={{ padding: '14px', textAlign: 'center', fontSize: 13, verticalAlign: 'middle', lineHeight: 1.4 }}>{numFmt(r.taxable || r.taxable_value, 2)}</td>
                        <td style={{ padding: '14px', textAlign: 'center', fontSize: 13, verticalAlign: 'middle', lineHeight: 1.4 }}>{numFmt(r.igst, 2)}</td>
                        <td style={{ padding: '14px', textAlign: 'center', fontSize: 13, verticalAlign: 'middle', lineHeight: 1.4 }}>{numFmt(r.cgst, 2)}</td>
                        <td style={{ padding: '14px', textAlign: 'center', fontSize: 13, verticalAlign: 'middle', lineHeight: 1.4 }}>{numFmt(r.sgst, 2)}</td>
                      </tr>
                    );
                  })
                )}
                {/* Total row */}
                {filtered.length > 0 && (
                  <tr style={{ borderTop: '2px solid #bfdbfe', background: '#f0f9ff' }}>
                    <td colSpan={3} style={{ padding: '14px', fontSize: 13, fontWeight: 800, color: '#2563eb', verticalAlign: 'middle' }}>Total</td>
                    <td style={{ padding: '14px', textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#2563eb', verticalAlign: 'middle' }}>{numFmt(totQty, 2)}</td>
                    <td />
                    <td style={{ padding: '14px', textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#2563eb', verticalAlign: 'middle' }}>{numFmt(totTaxable, 2)}</td>
                    <td style={{ padding: '14px', textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#2563eb', verticalAlign: 'middle' }}>{numFmt(totIgst, 2)}</td>
                    <td style={{ padding: '14px', textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#2563eb', verticalAlign: 'middle' }}>{numFmt(totCgst, 2)}</td>
                    <td style={{ padding: '14px', textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#2563eb', verticalAlign: 'middle' }}>{numFmt(totSgst, 2)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Pagination ─────────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 13, color: '#64748b' }}>
        <span>Showing {total === 0 ? 0 : (safePage - 1) * pageSize + 1} to {Math.min(safePage * pageSize, total)} of {total} entries</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* First */}
          <PagBtn onClick={() => setPage(1)} disabled={safePage === 1}>«</PagBtn>
          <PagBtn onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}>‹</PagBtn>
          <span style={{ width: 32, height: 32, borderRadius: 8, background: '#0052cc', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>{safePage}</span>
          <PagBtn onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={safePage === pageCount}>›</PagBtn>
          <PagBtn onClick={() => setPage(pageCount)} disabled={safePage === pageCount}>»</PagBtn>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>Rows per page</span>
          <select className="bp-select" style={{ height: 32, width: 72 }} value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
            {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
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
