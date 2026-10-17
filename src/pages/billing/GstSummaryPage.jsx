import { useEffect, useState } from 'react';
import { api, getAuthToken } from '../../api/client';
import { useReportsEnv } from './ReportsContext';
import { LoadingBlock } from '../../components/Spinner';
import { buildFyOptions, currentFyRange, moneyFixed as money } from './billingUtils';
import { resolveGstMatrix, GST_MATRIX_ROWS, GST_MATRIX_COLS } from './GstSummaryMatrix';

/* ── Icon helpers ─────────────────────────────────────────── */
function ExcelIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" /><line x1="10" y1="9" x2="14" y2="9" />
    </svg>
  );
}
function PdfIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function FunnelIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4h14l-5.5 6.5V16l-3 1.5v-7L3 4Z" />
    </svg>
  );
}

/* ── KPI cards meta ───────────────────────────────────────── */
// Clean white line icons for the KPI tiles (24 grid, 2px stroke) so they stay crisp at any size.
const KPI_SVG = { width: 30, height: 30, viewBox: '0 0 24 24', fill: 'none', stroke: 'white', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };

// Stack of coins — used by the CGST, SGST and IGST cards
const StackedCoinsIcon = () => (
  <svg {...KPI_SVG}>
    <ellipse cx="12" cy="6" rx="8" ry="3" />
    <path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6" />
    <path d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
  </svg>
);

// Rupee in a ring — the gross value card
const RupeeRingIcon = () => (
  <svg {...KPI_SVG}>
    <circle cx="12" cy="12" r="10" />
    <path d="M8 8h8M8 11.5h8M9.5 8c2.6 0 4 1.1 4 3.5s-1.4 3.5-4 3.5H8.5l5.5 3.5" />
  </svg>
);

// Document with bar chart — the taxable value card
const DocChartIcon = () => (
  <svg {...KPI_SVG}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="9" y1="18" x2="9" y2="14" />
    <line x1="12" y1="18" x2="12" y2="11" />
    <line x1="15" y1="18" x2="15" y2="15" />
  </svg>
);

const KPI_CARDS = [
  {
    key: 'taxable',
    label: 'Total Taxable Value',
    sub: 'Total taxable value',
    icon: <DocChartIcon />,
    bg: 'linear-gradient(145deg, #eff6ff 0%, #dbeafe 100%)',
    iconBg: '#2563eb',
  },
  {
    key: 'cgst',
    label: 'Total CGST',
    sub: 'Total CGST amount',
    icon: <StackedCoinsIcon />,
    bg: 'linear-gradient(145deg, #f0fdf4 0%, #dcfce7 100%)',
    iconBg: '#16a34a',
  },
  {
    key: 'sgst',
    label: 'Total SGST / UTGST',
    sub: 'Total SGST / UTGST amount',
    icon: <StackedCoinsIcon />,
    bg: 'linear-gradient(145deg, #fff7ed 0%, #fed7aa 100%)',
    iconBg: '#ea580c',
  },
  {
    key: 'igst',
    label: 'Total IGST',
    sub: 'Total IGST amount',
    icon: <StackedCoinsIcon />,
    bg: 'linear-gradient(145deg, #faf5ff 0%, #e9d5ff 100%)',
    iconBg: '#7c3aed',
  },
  {
    key: 'gross',
    label: 'Total Gross Value',
    sub: 'Total gross value',
    icon: <RupeeRingIcon />,
    bg: 'linear-gradient(145deg, #fefce8 0%, #fef3c7 100%)',
    iconBg: '#d97706',
  },
];

/* ── Column header icons ──────────────────────────────────── */
const COL_ICONS = {
  tax_invoice: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  ),
  bill_of_supply: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
    </svg>
  ),
  debit_note: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
    </svg>
  ),
  credit_note: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
    </svg>
  ),
};
const COL_COLORS = {
  tax_invoice: '#16a34a',
  bill_of_supply: '#2563eb',
  debit_note: '#7c3aed',
  credit_note: '#dc2626',
};
const PARTICULARS_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
    <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
);
const TOTAL_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 7l4-4 4 4M8 3v14"/><path d="M20 17l-4 4-4-4m4 4V7"/>
  </svg>
);

function formatDateDisplay(isoStr) {
  if (!isoStr) return '';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const [y, m, d] = isoStr.split('-');
  return `${d} ${months[Number(m) - 1]} ${y}`;
}

export default function GstSummaryPage({
  title = 'GST Summary',
  apiPath: apiPathProp,
  exportPath: exportPathProp,
}) {
  const env = useReportsEnv();
  const profile = env.profile;
  const apiPath = apiPathProp ?? env.reportsApi;
  const exportPath = exportPathProp ?? env.exportUrl;
  const fyDefault = currentFyRange();
  const fyOptions = buildFyOptions();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fy, setFy] = useState(fyDefault.fy);
  const [from, setFrom] = useState(fyDefault.from);
  const [to, setTo] = useState(fyDefault.to);
  const [activeQuick, setActiveQuick] = useState('fy'); // 'current' | 'prev' | 'fy'
  const [err, setErr] = useState('');

  const run = () => {
    if (!from || !to) { setErr('Please select both From date and To date.'); return; }
    if (from > to)  { setErr('From date cannot be after To date.'); return; }
    setErr('');
    setLoading(true);
    const qs = new URLSearchParams({ type: 'gst_summary', from, to });
    api(`${apiPath}?${qs}`)
      .then(setData)
      .catch((e) => setErr(e.message || 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { run(); }, []);

  const applyCurrentMonth = () => {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth() + 1;
    const last = new Date(y, m, 0).getDate();
    const mStr = String(m).padStart(2, '0');
    setFrom(`${y}-${mStr}-01`);
    setTo(`${y}-${mStr}-${String(last).padStart(2, '0')}`);
    setFy('');
    setActiveQuick('current');
  };

  const applyPreviousMonth = () => {
    const now = new Date();
    now.setMonth(now.getMonth() - 1);
    const y = now.getFullYear(), m = now.getMonth() + 1;
    const last = new Date(y, m, 0).getDate();
    const mStr = String(m).padStart(2, '0');
    setFrom(`${y}-${mStr}-01`);
    setTo(`${y}-${mStr}-${String(last).padStart(2, '0')}`);
    setFy('');
    setActiveQuick('prev');
  };

  const applyFy = (val) => {
    setFy(val);
    setActiveQuick('fy');
    if (val) {
      const year = parseInt(val.split('-')[0], 10);
      if (year) { setFrom(`${year}-04-01`); setTo(`${year + 1}-03-31`); }
    }
  };

  const handleClear = () => {
    const next = currentFyRange();
    setFrom(next.from); setTo(next.to); setFy(next.fy); setActiveQuick('fy');
  };

  const handleApply = () => run();

  const download = async (format) => {
    if (!from || !to) { setErr('Please select From and To dates before export.'); return; }
    const token = getAuthToken();
    const qs = new URLSearchParams({ type: 'gst_summary', from, to, format });
    const res = await fetch(`${exportPath}?${qs}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: '*/*' },
    });
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    // Export is legacy SpreadsheetML XML, not real OOXML — must be named .xls, not
    // .xlsx, or Excel refuses to open it ("file format or extension is not valid").
    a.download = `gst_summary_${from}_to_${to}.${format === 'xlsx' ? 'xls' : 'pdf'}`;
    a.click();
  };

  const [bifTab, setBifTab] = useState('value'); // 'value' | 'document'

  const matrix = resolveGstMatrix(data, profile);
  const bifurcation = data?.data?.bifurcation || null;

  // Net across all doc-type columns — Credit Notes reduce the value (subtracted),
  // every other column (Tax Invoices, Bills of Supply, Debit Notes) adds to it.
  const netAcrossCols = (key) => GST_MATRIX_COLS.reduce(
    (s, [col]) => s + (col === 'credit_note' ? -1 : 1) * (matrix[col]?.[key] ?? 0),
    0
  );

  // KPI totals across all columns
  const kpiValues = {
    taxable: netAcrossCols('taxable_value'),
    cgst:    netAcrossCols('cgst'),
    sgst:    netAcrossCols('sgst'),
    igst:    netAcrossCols('igst'),
    gross:   netAcrossCols('total_invoice_value'),
  };

  // Row totals (across all doc-type columns)
  const rowTotal = (rowKey) => netAcrossCols(rowKey);

  return (
    <div style={{ maxWidth: '100%' }}>
      {/* ── Header ───────────────────────────────────────── */}
      <div className="gs-head" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="gl-head-ic" style={{ width: 44, height: 44, background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--bp-navy)' }}>{title}</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--bp-muted)' }}>
              View taxable value, taxes and gross value summary by document type for the selected period.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => download('xlsx')}
            style={{ height: 36, padding: '0 14px', borderRadius: 8, border: '1.5px solid #16a34a', background: '#fff', color: '#16a34a', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
          >
            <ExcelIcon /> Export Excel
          </button>
          <button
            type="button"
            onClick={() => download('pdf')}
            style={{ height: 36, padding: '0 14px', borderRadius: 8, border: '1.5px solid #ef4444', background: '#fff', color: '#ef4444', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
          >
            <PdfIcon /> Export PDF
          </button>
        </div>
      </div>

      {/* ── Filter Bar ───────────────────────────────────── */}
      <div className="bp-card gs-filter" style={{ marginBottom: 20, padding: '14px 18px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>

          {/* Quick pills – no label above, vertically centred with rest */}
          <button
            type="button"
            onClick={applyCurrentMonth}
            style={{
              height: 36, padding: '0 14px', borderRadius: 8,
              border: '1.5px solid ' + (activeQuick === 'current' ? '#2563eb' : '#e2e8f0'),
              background: activeQuick === 'current' ? '#eff6ff' : '#fff',
              color: activeQuick === 'current' ? '#2563eb' : 'var(--bp-text)',
              fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            Current Month
          </button>
          <button
            type="button"
            onClick={applyPreviousMonth}
            style={{
              height: 36, padding: '0 14px', borderRadius: 8,
              border: '1.5px solid ' + (activeQuick === 'prev' ? '#2563eb' : '#e2e8f0'),
              background: activeQuick === 'prev' ? '#eff6ff' : '#fff',
              color: activeQuick === 'prev' ? '#2563eb' : 'var(--bp-text)',
              fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            Previous Month
          </button>
          <button
            type="button"
            onClick={() => setActiveQuick('fy')}
            style={{
              height: 36, padding: '0 14px', borderRadius: 8,
              border: '1.5px solid ' + (activeQuick === 'fy' ? '#2563eb' : '#e2e8f0'),
              background: activeQuick === 'fy' ? '#eff6ff' : '#fff',
              color: activeQuick === 'fy' ? '#2563eb' : 'var(--bp-text)',
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
            }}
          >
            <CalendarIcon /> Financial Year
          </button>

          {/* Divider */}
          <div style={{ width: 1, height: 28, background: '#e2e8f0', alignSelf: 'center' }} />

          {/* FY Select */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--bp-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Financial Year</span>
            <select
              className="bp-select"
              style={{ height: 36, minWidth: 130 }}
              value={fy}
              onChange={(e) => applyFy(e.target.value)}
            >
              {fyOptions.map((opt) => (
                <option key={opt} value={opt}>FY {opt}</option>
              ))}
            </select>
          </div>

          {/* From Date */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--bp-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>From Date</span>
            <div style={{ position: 'relative' }}>
              <input
                type="date"
                className="bp-input"
                style={{ height: 36, minWidth: 148 }}
                value={from}
                onChange={(e) => { setFrom(e.target.value); setActiveQuick(''); setFy(''); }}
              />
            </div>
          </div>

          {/* To Date */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--bp-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>To Date</span>
            <div style={{ position: 'relative' }}>
              <input
                type="date"
                className="bp-input"
                style={{ height: 36, minWidth: 148 }}
                value={to}
                onChange={(e) => { setTo(e.target.value); setActiveQuick(''); setFy(''); }}
              />
            </div>
          </div>

          {/* Apply Filters + Clear – pushed to right */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <button
              type="button"
              style={{
                height: 36, padding: '0 18px', borderRadius: 8,
                background: '#0052cc', border: 'none',
                color: '#fff', fontWeight: 700, fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 7,
                cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
                whiteSpace: 'nowrap',
              }}
              onClick={handleApply}
              disabled={loading}
            >
              <FunnelIcon /> Apply Filters
            </button>
            <button
              type="button"
              style={{
                height: 36, padding: '0 14px', borderRadius: 8,
                border: '1.5px solid #e2e8f0', background: '#fff',
                color: 'var(--bp-text)', fontWeight: 600, fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 5,
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
              onClick={handleClear}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Clear
            </button>
          </div>

        </div>
        {err && <p style={{ color: '#ef4444', margin: '10px 0 0', fontSize: 13 }}>{err}</p>}
      </div>

      {/* ── KPI Cards ────────────────────────────────────── */}
      <div className="gs-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 20 }}>
        {KPI_CARDS.map((card) => (
          <div
            key={card.key}
            className="gs-kpi"
            style={{
              padding: '20px 18px 18px',
              background: card.bg,
              borderRadius: 14,
              border: '1.5px solid rgba(0,0,0,0.06)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
            }}
          >
            <div
              className="gs-kpi-ic"
              style={{
                width: 52, height: 52, borderRadius: 14,
                background: card.iconBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 14,
                boxShadow: `0 4px 12px ${card.iconBg}55`,
              }}
            >
              {card.icon}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 6 }}>{card.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--bp-navy)', letterSpacing: '-0.5px', lineHeight: 1.2 }}>
              {loading ? '…' : money(kpiValues[card.key])}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6, fontWeight: 500 }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Summary Table ────────────────────────────────── */}
      <div className="bp-card gs-table" style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
        {/* Report Period Bar */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--bp-border)', display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--bp-navy)' }}>
            Report Period:&nbsp;
            <span style={{ fontWeight: 500, color: 'var(--bp-text)' }}>
              {formatDateDisplay(from)} to {formatDateDisplay(to)}
            </span>
          </span>
        </div>

        {loading ? (
          <LoadingBlock />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--bp-border)' }}>
                  {/* Particulars header */}
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 13, fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {PARTICULARS_ICON} Particulars
                    </div>
                  </th>
                  {/* Column headers */}
                  {GST_MATRIX_COLS.map(([colKey, colLabel]) => (
                    <th key={colKey} style={{ padding: '12px 16px', textAlign: 'center', fontSize: 13, fontWeight: 700, color: COL_COLORS[colKey], whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center' }}>
                        {COL_ICONS[colKey]} {colLabel}
                      </div>
                    </th>
                  ))}
                  {/* Total header */}
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center' }}>
                      {TOTAL_ICON} Total
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {GST_MATRIX_ROWS.map(([rowKey, rowLabel], idx) => {
                  const isGross = rowKey === 'total_invoice_value';
                  return (
                    <tr
                      key={rowKey}
                      style={{
                        borderBottom: '1px solid var(--bp-border)',
                        background: isGross ? '#f0f9ff' : idx % 2 === 0 ? '#fff' : '#fafafa',
                      }}
                    >
                      <td style={{
                        padding: '13px 20px', fontSize: 13,
                        fontWeight: isGross ? 800 : 600,
                        color: isGross ? '#2563eb' : 'var(--bp-navy)',
                        whiteSpace: 'nowrap',
                      }}>
                        {rowLabel}
                      </td>
                      {GST_MATRIX_COLS.map(([colKey]) => (
                        <td key={colKey} style={{ padding: '13px 16px', textAlign: 'center', fontSize: 13, fontWeight: isGross ? 800 : 500, color: isGross ? '#2563eb' : 'var(--bp-text)' }}>
                          {money(matrix[colKey]?.[rowKey] ?? 0)}
                        </td>
                      ))}
                      <td style={{ padding: '13px 16px', textAlign: 'center', fontSize: 13, fontWeight: isGross ? 800 : 700, color: isGross ? '#2563eb' : 'var(--bp-navy)' }}>
                        {money(rowTotal(rowKey))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* ── B2B & B2C Bifurcation ────────────────────────── */}
      <B2bBifurcationSection
        bifurcation={bifurcation}
        loading={loading}
        activeTab={bifTab}
        onTabChange={setBifTab}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   B2B & B2C Bifurcation Section
   ───────────────────────────────────────────────────────────── */
const BIF_DOC_TYPES = [
  { key: 'tax_invoice',    label: 'Tax Invoices',   color: '#16a34a', bg: '#f1fbf4', border: '#cdeed8', iconBg: '#16a34a', head: '#e3f6ea' },
  { key: 'bill_of_supply', label: 'Bill of Supply', color: '#1d4ed8', bg: '#f1f6ff', border: '#d0e0fa', iconBg: '#1d5fe0', head: '#e2ecfd' },
  { key: 'debit_note',     label: 'Debit Notes',    color: '#7c3aed', bg: '#f8f3ff', border: '#e2d4fa', iconBg: '#7c3aed', head: '#eee3fd' },
  { key: 'credit_note',    label: 'Credit Notes',   color: '#dc2626', bg: '#fff3f3', border: '#f8d3d3', iconBg: '#dc2626', head: '#fde3e3' },
];

const DocIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>
);

const VALUE_ROWS = [
  { key: 'taxable_value',      label: 'Total Taxable Value',    bold: false },
  { key: 'igst',               label: 'IGST Amount',            bold: false },
  { key: 'cgst',               label: 'CGST Amount',            bold: false },
  { key: 'sgst',               label: 'SGST / UTGST Amount',    bold: false },
  { key: 'total_invoice_value',label: 'Total Gross Value',      bold: true  },
];

function zeroSums() {
  return { taxable_value:0, igst:0, cgst:0, sgst:0, total_invoice_value:0, count:0 };
}

function sumB(a, b) {
  const keys = ['taxable_value','igst','cgst','sgst','total_invoice_value','count'];
  const r = {};
  keys.forEach((k) => { r[k] = (a[k] || 0) + (b[k] || 0); });
  return r;
}

function B2bBifurcationSection({ bifurcation, loading, activeTab, onTabChange }) {
  if (!bifurcation && !loading) return null;

  // Totals across all doc types
  const totalB2b = BIF_DOC_TYPES.reduce((acc, dt) => sumB(acc, bifurcation?.[dt.key]?.b2b || zeroSums()), zeroSums());
  const totalB2c = BIF_DOC_TYPES.reduce((acc, dt) => sumB(acc, bifurcation?.[dt.key]?.b2c || zeroSums()), zeroSums());
  const totalAll = sumB(totalB2b, totalB2c);

  const thB = { padding: '8px 12px', textAlign: 'center', fontWeight: 700, fontSize: 12, color: '#0f172a', border: '1px solid #dbe5f3' };
  const tdB = { padding: '7px 12px', border: '1px solid #e3ebf6', fontSize: 12.5 };

  return (
    <div className="bf-wrap" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', marginTop: 18 }}>
      {/* Section Header */}
      <div className="bf-head" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="bf-ic bf-ic-main" style={{ width: 38, height: 38, borderRadius: 10, background: '#1d5fe0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><DocIcon /></div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>B2B &amp; B2C Bifurcation</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Value-wise and document-wise summary for each document type.</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { id: 'value',    label: 'Value-wise Summary' },
            { id: 'document', label: 'Document-wise Summary' },
          ].map(({ id, label }) => (
            <button key={id} type="button" className="bf-tab" onClick={() => onTabChange(id)}
              style={{
                height: 38, padding: '0 22px', borderRadius: 9, cursor: 'pointer',
                fontSize: 13, fontWeight: 700, transition: 'all 0.15s',
                border: activeTab === id ? '1px solid #1d5fe0' : '1px solid #cfd8e6',
                background: activeTab === id ? '#1d5fe0' : '#fff',
                color: activeTab === id ? '#fff' : '#1e293b',
                boxShadow: activeTab === id ? '0 6px 14px -6px rgba(29,95,224,0.7)' : 'none',
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
      ) : activeTab === 'value' ? (
        /* ── Value-wise grid ── */
        <div style={{ padding: '4px 20px 18px', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
          {BIF_DOC_TYPES.map((dt) => {
            const b2b = bifurcation?.[dt.key]?.b2b || zeroSums();
            const b2c = bifurcation?.[dt.key]?.b2c || zeroSums();
            return (
              <div key={dt.key} className="bf-card" style={{ background: dt.bg, border: `1px solid ${dt.border}`, borderRadius: 14, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div className="bf-ic" style={{ width: 34, height: 34, borderRadius: 10, background: dt.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><DocIcon /></div>
                  <span style={{ fontSize: 14, fontWeight: 800, color: dt.color }}>{dt.label} <span style={{ color: '#0f172a' }}>- B2B &amp; B2C Summary</span></span>
                </div>
                <div className="bf-tbl" style={{ background: '#fff', borderRadius: 8, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ ...thB, textAlign: 'left', background: '#f8fafc' }}>Particulars</th>
                        <th style={{ ...thB, background: '#e3edfc' }}>B2B</th>
                        <th style={{ ...thB, background: '#e3f6ea' }}>B2C</th>
                        <th style={{ ...thB, background: '#f1f5f9' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {VALUE_ROWS.map((row) => {
                        const total = (b2b[row.key] || 0) + (b2c[row.key] || 0);
                        const bg = row.bold ? '#e7f0fd' : '#fff';
                        const c = row.bold ? '#1d4ed8' : '#1e293b';
                        const w = row.bold ? 800 : 500;
                        return (
                          <tr key={row.key} style={{ background: bg }}>
                            <td style={{ ...tdB, color: c, fontWeight: row.bold ? 800 : 600 }}>{row.label}</td>
                            <td style={{ ...tdB, textAlign: 'right', color: c, fontWeight: w }}>{money(b2b[row.key] || 0)}</td>
                            <td style={{ ...tdB, textAlign: 'right', color: c, fontWeight: w }}>{money(b2c[row.key] || 0)}</td>
                            <td style={{ ...tdB, textAlign: 'right', color: row.bold ? '#1d4ed8' : '#0f172a', fontWeight: 800 }}>{money(total)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Document-wise table ── */
        <div className="bf-tbl bf-docs" style={{ padding: '4px 20px 18px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #dbe5f3' }}>
            <thead>
              <tr>
                <th style={{ ...thB, textAlign: 'left', background: '#f1f5f9', padding: '11px 16px' }}>Document Type</th>
                <th style={{ ...thB, background: '#e3edfc', padding: '11px 16px' }}>B2B</th>
                <th style={{ ...thB, background: '#e3f6ea', padding: '11px 16px' }}>B2C</th>
                <th style={{ ...thB, background: '#f1f5f9', padding: '11px 16px' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {BIF_DOC_TYPES.map((dt) => {
                const b2b = bifurcation?.[dt.key]?.b2b || zeroSums();
                const b2c = bifurcation?.[dt.key]?.b2c || zeroSums();
                const tot = (b2b.count || 0) + (b2c.count || 0);
                return (
                  <tr key={dt.key} style={{ background: '#fff' }}>
                    <td style={{ ...tdB, padding: '11px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: dt.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        </div>
                        <span style={{ fontWeight: 700, color: dt.color }}>{dt.label}</span>
                      </div>
                    </td>
                    <td style={{ ...tdB, textAlign: 'center', fontWeight: 600 }}>{b2b.count || 0}</td>
                    <td style={{ ...tdB, textAlign: 'center', fontWeight: 600 }}>{b2c.count || 0}</td>
                    <td style={{ ...tdB, textAlign: 'center', fontWeight: 800, color: '#1d4ed8' }}>{tot}</td>
                  </tr>
                );
              })}
              <tr style={{ background: '#e7f0fd' }}>
                <td style={{ ...tdB, padding: '11px 16px', fontWeight: 800, color: '#1d4ed8' }}>Total Documents</td>
                <td style={{ ...tdB, textAlign: 'center', fontWeight: 800, color: '#1d4ed8' }}>{totalB2b.count}</td>
                <td style={{ ...tdB, textAlign: 'center', fontWeight: 800, color: '#1d4ed8' }}>{totalB2c.count}</td>
                <td style={{ ...tdB, textAlign: 'center', fontWeight: 800, color: '#1d4ed8' }}>{totalAll.count}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Note */}
      <div className="bf-note" style={{ margin: '0 20px 20px', padding: '14px 20px', background: 'linear-gradient(135deg,#f3f8ff,#e8f1fd)', border: '1px solid #d3e3f8', borderRadius: 12, fontSize: 12.5, color: '#1e293b' }}>
        <div style={{ fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="11" fill="#1d5fe0" stroke="none"/><line x1="12" y1="11" x2="12" y2="17" stroke="#fff"/><line x1="12" y1="7.5" x2="12.01" y2="7.5" stroke="#fff"/></svg>
          Note:
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
          <li>B2B and B2C classification is based on the document party type and GSTIN availability.</li>
          <li>Values include only active documents. Cancelled documents are excluded.</li>
          <li>Data is shown for the selected period.</li>
        </ul>
      </div>
    </div>
  );
}
