import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/client';
import { billingMode } from './billingProfile';
import { currentFyRange, formatDMYTime } from './billingUtils';
import { resolveGstMatrix, GST_MATRIX_COLS } from './GstSummaryMatrix';
import { useReportsEnv } from './ReportsContext';

/* ── helpers ───────────────────────────────────────────────── */
const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const shiftDays = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number);
  return isoLocal(new Date(y, m - 1, d + n));
};
/** The period of the same length that ends the day before `from`. */
function previousPeriod(from, to) {
  const days = Math.round((new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / 86400000) + 1;
  const pTo = shiftDays(from, -1);
  return { from: shiftDays(pTo, -(days - 1)), to: pTo };
}

/** Real change vs the previous period. Hidden when there is nothing to compare against. */
function TrendChip({ cur, prev, up = ['#16a34a', '#dcfce7'], down = ['#dc2626', '#fee2e2'] }) {
  if (!prev || prev <= 0) return null;
  const pct = Math.round(((cur - prev) / prev) * 100);
  const [color, background] = pct >= 0 ? up : down;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color, background, padding: '1px 7px', borderRadius: 10 }}>
      {pct >= 0 ? '↑' : '↓'} {Math.abs(pct)}%
    </span>
  );
}

export default function ReportsDashboard() {
  const env = useReportsEnv();
  const profile = env.profile;
  const navigate = useNavigate();

  const fyDefault = currentFyRange();
  const [from, setFrom] = useState(fyDefault.from);
  const [to, setTo] = useState(fyDefault.to);
  const [activeQuick, setActiveQuick] = useState('fy');
  const [gstData, setGstData] = useState(null);
  const [outstandingTotal, setOutstandingTotal] = useState(0);
  const [prev, setPrev] = useState(null); // previous-period figures behind the trend chips
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [lastUpdated, setLastUpdated] = useState('');

  // Credit Notes reduce value, so they are subtracted when combining document types
  // (same rule as the GST Summary report).
  const totalsOf = (gst) => {
    const matrix = resolveGstMatrix(gst, profile);
    const sumRow = (key) => GST_MATRIX_COLS.reduce(
      (acc, [col]) => acc + (col === 'credit_note' ? -1 : 1) * (matrix[col]?.[key] ?? 0),
      0
    );
    return { gross: sumRow('total_invoice_value'), taxable: sumRow('taxable_value'), gst: sumRow('cgst') + sumRow('sgst') + sumRow('igst') };
  };
  const outstandingOf = (out) => {
    const rows = Array.isArray(out?.data) ? out.data : [];
    return rows.reduce((t, r) => t + Number(r.grand_total || r.total_amount || 0), 0);
  };

  const run = (f = from, t = to) => {
    setErr('');
    setLoading(true);
    const cur = new URLSearchParams({ from: f, to: t });
    const p = previousPeriod(f, t);
    const before = new URLSearchParams({ from: p.from, to: p.to });
    Promise.all([
      api(`${env.reportsApi}?type=gst_summary&${cur}`),
      api(`${env.reportsApi}?type=outstanding_report&${cur}`),
      api(`${env.reportsApi}?type=gst_summary&${before}`).catch(() => null),
      api(`${env.reportsApi}?type=outstanding_report&${before}`).catch(() => null),
    ])
      .then(([gst, outstanding, prevGst, prevOut]) => {
        setGstData(gst);
        setOutstandingTotal(outstandingOf(outstanding));
        const pt = prevGst ? totalsOf(prevGst) : null;
        setPrev({ gross: pt?.gross, taxable: pt?.taxable, gst: pt?.gst, outstanding: prevOut ? outstandingOf(prevOut) : null });
        setLastUpdated(formatDMYTime(new Date()));
      })
      .catch((e) => setErr(e.message || 'Failed to load reports data'))
      .finally(() => setLoading(false));
  };

  // Loads on open, and again when the Admin switches to another client.
  useEffect(() => { run(); }, [env.reportsApi]);

  const applyCurrentMonth = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const mStr = String(m).padStart(2, '0');
    const last = new Date(y, m, 0).getDate();
    const f = `${y}-${mStr}-01`;
    const t = `${y}-${mStr}-${String(last).padStart(2, '0')}`;
    setFrom(f);
    setTo(t);
    setActiveQuick('current');
    run(f, t); // quick filters apply immediately
  };

  const applyPreviousMonth = () => {
    const now = new Date();
    now.setMonth(now.getMonth() - 1);
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const mStr = String(m).padStart(2, '0');
    const last = new Date(y, m, 0).getDate();
    const f = `${y}-${mStr}-01`;
    const t = `${y}-${mStr}-${String(last).padStart(2, '0')}`;
    setFrom(f);
    setTo(t);
    setActiveQuick('prev');
    run(f, t);
  };

  const applyCurrentFy = () => {
    const next = currentFyRange();
    setFrom(next.from);
    setTo(next.to);
    setActiveQuick('fy');
    run(next.from, next.to);
  };

  const handleClear = () => {
    const next = currentFyRange();
    setFrom(next.from);
    setTo(next.to);
    setActiveQuick('fy');
    run(next.from, next.to);
  };

  const hasGst = Boolean(profile?.has_gst);
  const mode = billingMode(profile);

  const { gross: totalGross, taxable: totalTaxable, gst: gstCollected } = totalsOf(gstData);
  const base = env.basePath;

  const ALL_REPORT_CARDS = [
    {
      key: 'gst-summary',
      show: hasGst,
      to: `${base}/gst-summary`,
      title: 'GST Summary',
      desc: 'View taxable value, CGST, SGST/UTGST, IGST and gross value by document type.',
      icon: 'doc',
      color: '#1d4ed8',
      bg: '#f0f7ff',
      iconBg: '#dbeafe',
      barColor: '#93c5fd',
    },
    {
      key: 'gst-liability',
      show: mode === 'regular',
      to: `${base}/gst-liability`,
      title: 'GST Liability',
      desc: 'Analyse output GST, eligible ITC, net GST liability and GST payable.',
      icon: 'refresh',
      color: '#16a34a',
      bg: '#f0fdf4',
      iconBg: '#dcfce7',
      barColor: '#86efac',
    },
    {
      key: 'hsn-summary',
      show: hasGst,
      to: `${base}/hsn-summary`,
      title: 'HSN / SAC Summary',
      desc: 'View HSN/SAC-wise quantity, taxable value, GST rate and tax breakup.',
      icon: 'tag',
      color: '#ea580c',
      bg: '#fff7ed',
      iconBg: '#fed7aa',
      barColor: '#fdba74',
    },
    {
      key: 'document-numbering',
      show: true,
      to: `${base}/document-numbering`,
      title: 'Document Numbering',
      desc: 'View document-wise numbering, including starting number, ending number and total number of documents generated for the selected period.',
      icon: 'list',
      color: '#7c3aed',
      bg: '#faf5ff',
      iconBg: '#f3e8ff',
      barColor: '#d8b4fe',
    },
    {
      key: 'party-wise',
      show: true,
      to: `${base}/party-wise`,
      title: 'Party-wise Detail',
      desc: 'Analyse party-wise documents, taxable value and total billing.',
      icon: 'people',
      color: '#dc2626',
      bg: '#fef2f2',
      iconBg: '#fee2e2',
      barColor: '#fca5a5',
    },
    {
      key: 'outstanding',
      show: true,
      to: `${base}/outstanding`,
      title: 'Outstanding',
      desc: 'Track unpaid invoices, due dates, overdue amounts and payment status.',
      icon: 'clipboard',
      color: '#0d9488',
      bg: '#f0fdfa',
      iconBg: '#ccfbf1',
      barColor: '#5eead4',
    },
  ].filter(c => c.show);

  const filteredCards = ALL_REPORT_CARDS.filter(c =>
    !searchTerm ||
    c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.desc.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ fontFamily: "'Inter',system-ui,sans-serif", padding: '4px 0 32px', color: '#1e293b' }}>

      {/* Breadcrumb & Header Row */}
      <div className="rp-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 4, display: 'flex', gap: 6, alignItems: 'center' }}>
            <Link to={env.rootCrumbTo} style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>Reports</Link>
            <span>&gt;</span>
            <span style={{ color: '#64748b' }}>Report Dashboard</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span className="bp-parties-head-icon" aria-hidden="true">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /><line x1="3" y1="20" x2="21" y2="20" /></svg>
            </span>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>
                Reports
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                Business, GST &amp; receivables reports – all in one place.
              </p>
            </div>
          </div>
        </div>

        {/* Top-Right Last Updated Card */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: '#fff',
          border: '1.5px solid #bfdbfe',
          borderRadius: 10,
          padding: '8px 16px',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>Last Updated</div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>
              {lastUpdated || 'Today'}
            </div>
          </div>
        </div>
      </div>

      {/* Top 4 KPI Cards */}
      <div className="rp-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))', gap: 14, marginBottom: 18 }}>
        {/* Card 1: Total Sales (Gross) */}
        <div className="rp-kpi" style={{
          background: '#eff6ff',
          border: '1.5px solid #bfdbfe',
          borderRadius: 12,
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}>
          <div className="rp-kpi-ic" style={{ width: 44, height: 44, borderRadius: 10, background: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
              <span className="rp-kpi-label" style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Total Sales (Gross)</span>
              <TrendChip cur={totalGross} prev={prev?.gross} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#1d4ed8', lineHeight: 1.1 }}>
              {loading ? '…' : `₹${Number(totalGross).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>Total gross value of all documents</div>
          </div>
        </div>

        {/* Card 2: Taxable Value */}
        <div className="rp-kpi" style={{
          background: '#f0fdf4',
          border: '1.5px solid #bbf7d0',
          borderRadius: 12,
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}>
          <div className="rp-kpi-ic" style={{ width: 44, height: 44, borderRadius: 10, background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="2" width="16" height="20" rx="2" />
              <line x1="8" y1="6" x2="16" y2="6" />
              <line x1="8" y1="10" x2="16" y2="10" />
              <line x1="8" y1="14" x2="12" y2="14" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
              <span className="rp-kpi-label" style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Taxable Value</span>
              <TrendChip cur={totalTaxable} prev={prev?.taxable} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#16a34a', lineHeight: 1.1 }}>
              {loading ? '…' : `₹${Number(totalTaxable).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>Total taxable value</div>
          </div>
        </div>

        {/* Card 3: GST Collected */}
        <div className="rp-kpi" style={{
          background: '#fff7ed',
          border: '1.5px solid #fed7aa',
          borderRadius: 12,
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}>
          <div className="rp-kpi-ic" style={{ width: 44, height: 44, borderRadius: 10, background: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>₹</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
              <span className="rp-kpi-label" style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>GST Collected</span>
              <TrendChip cur={gstCollected} prev={prev?.gst} up={['#ea580c', '#ffedd5']} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#ea580c', lineHeight: 1.1 }}>
              {loading ? '…' : `₹${Number(gstCollected).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>Total GST (CGST + SGST + IGST) vs. previous period</div>
          </div>
        </div>

        {/* Card 4: Outstanding */}
        <div className="rp-kpi" style={{
          background: '#faf5ff',
          border: '1.5px solid #e9d5ff',
          borderRadius: 12,
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}>
          <div className="rp-kpi-ic" style={{ width: 44, height: 44, borderRadius: 10, background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <path d="M16 12h.01" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
              <span className="rp-kpi-label" style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Outstanding</span>
              <TrendChip cur={outstandingTotal} prev={prev?.outstanding} up={['#7c3aed', '#f3e8ff']} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#7c3aed', lineHeight: 1.1 }}>
              {loading ? '…' : `₹${Number(outstandingTotal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>Total unpaid amount vs. previous period</div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rp-filter" style={{
        background: '#fff',
        border: '1.5px solid #bfdbfe',
        borderRadius: 10,
        padding: '10px 16px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: '#475569' }}>Quick Filters:</span>

        <button
          type="button"
          onClick={applyCurrentMonth}
          style={quickBtn(activeQuick === 'current')}
        >
          Current Month
        </button>

        <button
          type="button"
          onClick={applyPreviousMonth}
          style={quickBtn(activeQuick === 'prev')}
        >
          Previous Month
        </button>

        <button
          type="button"
          onClick={applyCurrentFy}
          style={{
            ...quickBtn(activeQuick === 'fy'),
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Financial Year
        </button>

        {/* Date Inputs */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>From Date</span>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: '1.5px solid #bfdbfe', borderRadius: 7, padding: '3px 8px', background: '#fff' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            <input
              type="date"
              value={from}
              onChange={e => { setFrom(e.target.value); setActiveQuick(''); }}
              style={{ border: 'none', outline: 'none', fontSize: 12.5, color: '#1e293b', background: 'transparent' }}
            />
          </div>
        </div>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>To Date</span>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: '1.5px solid #bfdbfe', borderRadius: 7, padding: '3px 8px', background: '#fff' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            <input
              type="date"
              value={to}
              onChange={e => { setTo(e.target.value); setActiveQuick(''); }}
              style={{ border: 'none', outline: 'none', fontSize: 12.5, color: '#1e293b', background: 'transparent' }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            disabled={loading}
            onClick={() => run(from, to)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 18px',
              background: '#1d4ed8',
              border: 'none',
              borderRadius: 7,
              fontSize: 12.5,
              fontWeight: 600,
              color: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            Apply Filters
          </button>

          <button
            type="button"
            onClick={handleClear}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '6.5px 14px',
              background: '#fff',
              border: '1.5px solid #bfdbfe',
              borderRadius: 7,
              fontSize: 12.5,
              fontWeight: 600,
              color: '#374151',
              cursor: 'pointer',
            }}
          >
            ✕ Clear
          </button>
        </div>
      </div>

      {err && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>
          {err}
        </div>
      )}

      {/* Reports Section Header & Search */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 14,
      }}>
        <div style={{ fontWeight: 800, fontSize: 13, color: '#0f172a', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
          REPORTS
        </div>
        <div className="rp-tools" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="rp-search" style={{ position: 'relative' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}>
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search reports..."
              style={{
                padding: '6px 12px 6px 30px',
                border: '1.5px solid #bfdbfe',
                borderRadius: 7,
                fontSize: 12.5,
                outline: 'none',
                width: 220,
                background: '#fff',
                color: '#1e293b',
              }}
            />
          </div>

          {/* Grid / List toggle */}
          <div className="rp-toggle" style={{ display: 'inline-flex', border: '1.5px solid #bfdbfe', borderRadius: 7, overflow: 'hidden' }}>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                padding: '5px 9px',
                background: viewMode === 'grid' ? '#1d4ed8' : '#fff',
                color: viewMode === 'grid' ? '#fff' : '#64748b',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
              title="Grid View"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              style={{
                padding: '5px 9px',
                background: viewMode === 'list' ? '#1d4ed8' : '#fff',
                color: viewMode === 'list' ? '#fff' : '#64748b',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
              title="List View"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Report Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))' : '1fr',
        gap: 16,
        marginBottom: 36,
      }}>
        {filteredCards.map(card => (
          <div
            key={card.key}
            className="rp-card"
            onClick={() => navigate(card.to)}
            style={{
              background: card.bg,
              border: '1.5px solid rgba(0, 0, 0, 0.05)',
              borderRadius: 12,
              padding: '20px',
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: 150,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 18px rgba(0, 0, 0, 0.06)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div>
              {/* Top Icon */}
              <div className="rp-card-ic" style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: card.iconBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 14,
              }}>
                {renderCardIcon(card.icon, card.color)}
              </div>

              {/* Title & Desc */}
              <div style={{ fontSize: 16, fontWeight: 800, color: card.color, marginBottom: 6 }}>
                {card.title}
              </div>
              <p style={{ margin: 0, fontSize: 12.5, color: '#64748b', lineHeight: 1.5, maxWidth: '80%' }}>
                {card.desc}
              </p>
            </div>

            <div style={{ marginTop: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: card.color, display: 'inline-flex', alignItems: 'center' }}>
                Open Report
              </span>

              {/* Mini Bar Chart graphic on bottom right */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3 }}>
                <span style={{ width: 6, height: 14, background: card.barColor, borderRadius: '2px 2px 0 0', display: 'inline-block' }}></span>
                <span style={{ width: 6, height: 22, background: card.barColor, borderRadius: '2px 2px 0 0', display: 'inline-block' }}></span>
                <span style={{ width: 6, height: 32, background: card.barColor, borderRadius: '2px 2px 0 0', display: 'inline-block' }}></span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer Branding */}
      <div style={{
        borderTop: '1px solid #e2e8f0',
        paddingTop: 16,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 12,
        color: '#64748b',
        flexWrap: 'wrap',
        gap: 8,
      }}>
        <div>
          © 2026 A B Khan &amp; Associates. All rights reserved.
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          <span style={{ cursor: 'pointer' }}>Privacy Policy</span>
          <span style={{ cursor: 'pointer' }}>Terms of Service</span>
          <span style={{ cursor: 'pointer' }}>Support</span>
          <span>Built for CA Professionals</span>
        </div>
      </div>

    </div>
  );
}

function quickBtn(active) {
  return {
    padding: '6px 14px',
    borderRadius: 7,
    border: `1.5px solid ${active ? '#1d4ed8' : '#bfdbfe'}`,
    background: active ? '#eff6ff' : '#fff',
    color: active ? '#1d4ed8' : '#374151',
    fontWeight: active ? 700 : 500,
    fontSize: 12.5,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  };
}

function renderCardIcon(type, color) {
  switch (type) {
    case 'doc':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      );
    case 'refresh':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
        </svg>
      );
    case 'tag':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </svg>
      );
    case 'list':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <line x1="7" y1="8" x2="17" y2="8" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="7" y1="16" x2="13" y2="16" />
        </svg>
      );
    case 'people':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'clipboard':
    default:
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
        </svg>
      );
  }
}
