import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
function InfoIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  );
}
function EyeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

/* ── KPI icon components ───────────────────────────────────── */
const PartiesIcon = () => (
  <svg width="26" height="26" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="10" r="5" stroke="white" strokeWidth="1.8" fill="none"/>
    <circle cx="22" cy="10" r="4" stroke="white" strokeWidth="1.5" fill="none"/>
    <path d="M2 26c0-5.5 4.5-9 10-9s10 3.5 10 9" stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
    <path d="M22 17c3 .5 6 2.5 6 7" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
  </svg>
);
const DocsIcon = () => (
  <svg width="26" height="26" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="3" width="17" height="22" rx="2" stroke="white" strokeWidth="1.7" fill="none"/>
    <rect x="9" y="6" width="13" height="22" rx="2" stroke="white" strokeWidth="1.5" fill="none" strokeDasharray="2 2"/>
    <line x1="9" y1="11" x2="17" y2="11" stroke="white" strokeWidth="1.3"/>
    <line x1="9" y1="15" x2="17" y2="15" stroke="white" strokeWidth="1.3"/>
    <line x1="9" y1="19" x2="14" y2="19" stroke="white" strokeWidth="1.3"/>
  </svg>
);
const RupeeCircleIcon = () => (
  <svg width="26" height="26" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="12" stroke="white" strokeWidth="1.8" fill="none"/>
    <text x="16" y="21" textAnchor="middle" fontSize="14" fontWeight="800" fill="white" stroke="none">₹</text>
  </svg>
);
const WalletIcon = () => (
  <svg width="26" height="26" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="8" width="28" height="20" rx="3" stroke="white" strokeWidth="1.7" fill="none"/>
    <path d="M2 14h28" stroke="white" strokeWidth="1.5"/>
    <circle cx="23" cy="21" r="3" fill="white" fillOpacity="0.4" stroke="white" strokeWidth="1"/>
    <path d="M8 4h16a2 2 0 0 1 2 2v2H6V6a2 2 0 0 1 2-2z" stroke="white" strokeWidth="1.3" fill="none"/>
  </svg>
);

function fmt(n) { return money(Number(n) || 0); }
function numFmt(v, dec = 2) {
  return Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export default function PartyWisePage({
  title = 'Party-wise Detail',
  apiPath: apiPathProp,
  exportPath: exportPathProp,
}) {
  const navigate = useNavigate();
  const env = useReportsEnv();
  const apiPath = apiPathProp ?? env.reportsApi;
  const exportPath = exportPathProp ?? env.exportUrl;
  const fyDefault = currentFyRange();
  const fyOptions = buildFyOptions();

  const [fy, setFy]         = useState(fyDefault.fy);
  const [from, setFrom]     = useState(fyDefault.from);
  const [to, setTo]         = useState(fyDefault.to);
  const [activeQuick, setActiveQuick] = useState('fy');
  const [search, setSearch] = useState('');
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr]       = useState('');

  const run = () => {
    setErr('');
    setLoading(true);
    const qs = new URLSearchParams({ type: 'party_wise_sales', from, to });
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
    setFrom(next.from); setTo(next.to); setFy(next.fy); setActiveQuick('fy'); setSearch('');
  };

  const download = async (format) => {
    const token = getAuthToken();
    const qs = new URLSearchParams({ type: 'party_wise_sales', from, to, format });
    const res = await fetch(`${exportPath}?${qs}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: '*/*' },
    });
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    // Export is legacy SpreadsheetML XML, not real OOXML — must be named .xls, not
    // .xlsx, or Excel refuses to open it ("file format or extension is not valid").
    a.download = `party_wise_${from}_to_${to}.${format === 'xlsx' ? 'xls' : 'pdf'}`;
    a.click();
  };

  const openParty = (row) => {
    const id = row.customer_id;
    const name = row.customer?.name || row.party_name || 'Party';
    const count = Number(row.Documents ?? row.documents ?? row.invoices ?? row.count ?? 0);
    if (!id || count <= 0) return;
    const qs = new URLSearchParams({ name });
    if (from) qs.set('from', from);
    if (to)   qs.set('to', to);
    if (!from && !to && fy) qs.set('fy', fy);
    navigate(`${env.basePath}/party-wise/${id}?${qs}`);
  };

  // Normalize rows
  const rawRows = (() => {
    if (!data) return [];
    const d = data?.data ?? data;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.rows)) return d.rows;
    return [];
  })();

  const filtered = rawRows.filter((r) => {
    if (!search) return true;
    const name = (r.customer?.name || r.party_name || '').toLowerCase();
    return name.includes(search.toLowerCase());
  });

  // KPI totals
  const totalParties   = rawRows.length;
  const totalDocuments = rawRows.reduce((s, r) => s + Number(r.Documents ?? r.documents ?? r.invoices ?? r.count ?? 0), 0);
  const totalTaxable   = rawRows.reduce((s, r) => s + Number(r.taxable ?? 0), 0);
  const totalGross     = rawRows.reduce((s, r) => s + Number(r.total ?? 0), 0);

  // Table totals
  const totDocs    = filtered.reduce((s, r) => s + Number(r.Documents ?? r.documents ?? r.invoices ?? r.count ?? 0), 0);
  const totTaxable = filtered.reduce((s, r) => s + Number(r.taxable ?? 0), 0);
  const totGst     = filtered.reduce((s, r) => s + Number((r.total ?? 0) - (r.taxable ?? 0)), 0);
  const totTotal   = filtered.reduce((s, r) => s + Number(r.total ?? 0), 0);

  return (
    <div style={{ maxWidth: '100%' }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--bp-navy)' }}>{title}</h2>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--bp-muted)' }}>
            Summary of invoices, taxable value and total billing party-wise for the selected period.
          </p>
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
        {err && <p style={{ color: '#ef4444', margin: '10px 0 0', fontSize: 13 }}>{err}</p>}
      </div>

      {/* ── KPI Cards ──────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {/* Total Parties */}
        <div style={{ padding: '16px 20px', background: 'linear-gradient(145deg,#eff6ff,#dbeafe)', borderRadius: 14, border: '1.5px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px #2563eb44' }}>
            <PartiesIcon />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>Total Parties</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--bp-navy)', lineHeight: 1.1 }}>{totalParties}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Active parties in period</div>
          </div>
        </div>

        {/* Total Documents */}
        <div style={{ padding: '16px 20px', background: 'linear-gradient(145deg,#f0fdf4,#dcfce7)', borderRadius: 14, border: '1.5px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px #16a34a44' }}>
            <DocsIcon />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>Total Documents</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--bp-navy)', lineHeight: 1.1 }}>{totalDocuments}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Total invoices &amp; documents</div>
          </div>
        </div>

        {/* Total Taxable Value */}
        <div style={{ padding: '16px 20px', background: 'linear-gradient(145deg,#fff7ed,#fed7aa)', borderRadius: 14, border: '1.5px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px #ea580c44' }}>
            <RupeeCircleIcon />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>Total Taxable Value</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--bp-navy)', lineHeight: 1.1 }}>{fmt(totalTaxable)}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Sum of taxable value</div>
          </div>
        </div>

        {/* Total Billing (Gross) */}
        <div style={{ padding: '16px 20px', background: 'linear-gradient(145deg,#faf5ff,#e9d5ff)', borderRadius: 14, border: '1.5px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px #7c3aed44' }}>
            <WalletIcon />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>Total Billing (Gross)</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--bp-navy)', lineHeight: 1.1 }}>{fmt(totalGross)}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Total gross billing value</div>
          </div>
        </div>
      </div>

      {/* ── Table section ──────────────────────────────────── */}
      <div className="bp-card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Table toolbar */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--bp-border)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#2563eb', flex: 1 }}>Party-wise Summary</span>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><SearchIcon /></span>
            <input
              type="text"
              className="bp-input"
              style={{ height: 36, paddingLeft: 34, minWidth: 220 }}
              placeholder="Search party name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Export buttons in table toolbar */}
          <button type="button" onClick={() => download('xlsx')}
            style={{ height: 36, padding: '0 13px', borderRadius: 8, border: '1.5px solid #16a34a', background: '#fff', color: '#16a34a', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <ExcelIcon /> Export Excel
          </button>
          <button type="button" onClick={() => download('pdf')}
            style={{ height: 36, padding: '0 13px', borderRadius: 8, border: '1.5px solid #ef4444', background: '#fff', color: '#ef4444', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <PdfIcon /> Export PDF
          </button>
        </div>

        {loading ? (
          <LoadingBlock />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--bp-border)' }}>
                  <th style={{ padding: '11px 20px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#64748b', width: 48, whiteSpace: 'nowrap' }}>Sr. No.</th>
                  <th style={{ padding: '11px 16px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#64748b' }}>Party Name</th>
                  <th style={{ padding: '11px 16px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#64748b' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Documents <InfoIcon /></span>
                  </th>
                  <th style={{ padding: '11px 16px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#64748b' }}>Taxable Value (₹)</th>
                  <th style={{ padding: '11px 16px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#64748b' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>Total GST (₹) <InfoIcon /></span>
                  </th>
                  <th style={{ padding: '11px 16px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#64748b' }}>Total Amount (₹)</th>
                  <th style={{ padding: '11px 20px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#64748b' }}>View Details</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--bp-muted)' }}>No data for this period</td></tr>
                ) : (
                  filtered.map((r, i) => {
                    const count = Number(r.Documents ?? r.documents ?? r.invoices ?? r.count ?? 0);
                    const taxable = Number(r.taxable ?? 0);
                    const total   = Number(r.total ?? 0);
                    const gst     = total - taxable;
                    const name    = r.customer?.name || r.party_name || '—';
                    const canOpen = r.customer_id && count > 0;
                    return (
                      <tr key={r.customer_id || i} style={{ borderBottom: '1px solid var(--bp-border)', background: '#fff', transition: 'background .15s' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}>
                        <td style={{ padding: '13px 20px', textAlign: 'center', fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>{i + 1}</td>
                        <td style={{ padding: '13px 16px', textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--bp-navy)' }}>{name}</td>
                        <td style={{ padding: '13px 16px', textAlign: 'center', fontSize: 13 }}>
                          {canOpen ? (
                            <button type="button" onClick={() => openParty(r)}
                              style={{ background: 'none', border: 'none', padding: 0, color: 'var(--bp-navy)', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', fontSize: 13 }}>
                              {count}
                            </button>
                          ) : count || '—'}
                        </td>
                        <td style={{ padding: '13px 16px', textAlign: 'center', fontSize: 13 }}>{fmt(taxable)}</td>
                        <td style={{ padding: '13px 16px', textAlign: 'center', fontSize: 13 }}>{fmt(gst)}</td>
                        <td style={{ padding: '13px 16px', textAlign: 'center', fontSize: 13, fontWeight: 600 }}>{fmt(total)}</td>
                        <td style={{ padding: '13px 20px', textAlign: 'center' }}>
                          <button type="button" onClick={() => openParty(r)}
                            style={{ height: 32, padding: '0 14px', borderRadius: 8, border: '1.5px solid #2563eb', background: '#fff', color: '#2563eb', fontWeight: 600, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5, cursor: canOpen ? 'pointer' : 'default', opacity: canOpen ? 1 : 0.4 }}
                            disabled={!canOpen}>
                            <EyeIcon /> View Details
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
                {/* Total row */}
                {filtered.length > 0 && (
                  <tr style={{ borderTop: '2px solid #bfdbfe', background: '#f0f9ff' }}>
                    <td colSpan={2} style={{ padding: '13px 20px', fontSize: 13, fontWeight: 800, color: '#2563eb' }}>Total</td>
                    <td style={{ padding: '13px 16px', textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#2563eb' }}>{totDocs}</td>
                    <td style={{ padding: '13px 16px', textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#2563eb' }}>{fmt(totTaxable)}</td>
                    <td style={{ padding: '13px 16px', textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#2563eb' }}>{fmt(totGst)}</td>
                    <td style={{ padding: '13px 16px', textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#2563eb' }}>{fmt(totTotal)}</td>
                    <td style={{ padding: '13px 20px', textAlign: 'center', fontSize: 13, color: '#94a3b8' }}>—</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
