import { useCallback, useEffect, useState } from 'react';
import { api, getAuthToken } from '../../api/client';
import { useReportsEnv } from './ReportsContext';
import { LoadingBlock } from '../../components/Spinner';
import { billingMode } from './billingProfile';
import { buildFyOptions, currentFyRange, moneyFixed as money } from './billingUtils';

/* ── Icons ─────────────────────────────────────────────────── */
function DocIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
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
function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  );
}
function BarChartIcon({ color = '#2563eb' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      <line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  );
}

// KPI Card icon — document with upload arrow (blue, Output GST)
const OutputGstIcon = () => (
  <svg width="26" height="26" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="2" width="18" height="24" rx="3" stroke="white" strokeWidth="1.5" fill="none"/>
    <line x1="8" y1="10" x2="18" y2="10" stroke="white" strokeWidth="1.5"/>
    <line x1="8" y1="14" x2="18" y2="14" stroke="white" strokeWidth="1.5"/>
    <line x1="8" y1="18" x2="14" y2="18" stroke="white" strokeWidth="1.5"/>
    <circle cx="24" cy="23" r="6" fill="#16a34a"/>
    <path d="M24 26V20M21 23l3-3 3 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
// ITC icon — document with check (green)
const ItcIcon = () => (
  <svg width="26" height="26" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="2" width="18" height="24" rx="3" stroke="white" strokeWidth="1.5" fill="none"/>
    <line x1="8" y1="10" x2="18" y2="10" stroke="white" strokeWidth="1.5"/>
    <line x1="8" y1="14" x2="18" y2="14" stroke="white" strokeWidth="1.5"/>
    <path d="M9 19l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
// Net liability icon — grid/table (orange)
const NetLiabilityIcon = () => (
  <svg width="26" height="26" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="4" width="24" height="24" rx="3" stroke="white" strokeWidth="1.5" fill="none"/>
    <line x1="4" y1="12" x2="28" y2="12" stroke="white" strokeWidth="1.2"/>
    <line x1="4" y1="20" x2="28" y2="20" stroke="white" strokeWidth="1.2"/>
    <line x1="14" y1="4" x2="14" y2="28" stroke="white" strokeWidth="1.2"/>
  </svg>
);
// GST Payable icon — wallet (purple)
const PayableIcon = () => (
  <svg width="26" height="26" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="8" width="28" height="20" rx="3" stroke="white" strokeWidth="1.5" fill="none"/>
    <path d="M2 14h28" stroke="white" strokeWidth="1.5"/>
    <circle cx="23" cy="20" r="3" stroke="white" strokeWidth="1.5"/>
    <path d="M8 4h16a2 2 0 0 1 2 2v2H6V6a2 2 0 0 1 2-2z" stroke="white" strokeWidth="1.2" fill="none"/>
  </svg>
);

function formatDateDisplay(isoStr) {
  if (!isoStr) return '—';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const [y, m, d] = isoStr.split('-');
  return `${d} ${months[Number(m) - 1]} ${y}`;
}

function fmt(n) { return money(Number(n) || 0); }

/* ── Simple bar chart ──────────────────────────────────────── */
function LiabilityBarChart({ outputGst, eligibleItc }) {
  const [hover, setHover] = useState(null);   // key of the hovered bar
  const [hidden, setHidden] = useState({});   // legend toggles
  const [ready, setReady] = useState(false);  // bars grow in on mount

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const series = [
    { key: 'output', label: 'Output GST', value: Number(outputGst) || 0, from: '#60a5fa', to: '#1d4ed8', dot: '#2563eb' },
    { key: 'itc', label: 'Eligible ITC', value: Number(eligibleItc) || 0, from: '#4ade80', to: '#15803d', dot: '#16a34a' },
  ];
  const visible = series.filter((x) => !hidden[x.key]);
  const maxVal = Math.max(...visible.map((x) => x.value), 1);

  const labelize = (n) => {
    if (n >= 100000) return `${(n / 100000).toFixed(2)} L`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)} K`;
    return String(Math.round(n));
  };
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const toggle = (key) => setHidden((h) => {
    // Never allow hiding both series
    const next = { ...h, [key]: !h[key] };
    return series.every((x) => next[x.key]) ? h : next;
  });

  const netLiability = Math.max(series[0].value - series[1].value, 0);
  const coverage = series[0].value > 0 ? Math.min((series[1].value / series[0].value) * 100, 100) : 0;
  const hovered = series.find((x) => x.key === hover);

  return (
    <div className="gl-chart">
      <div className="gl-chart-body">
        <div className="gl-chart-ytitle">Amount (₹)</div>
        <div className="gl-chart-y">
          {ticks.map((f) => <span key={f} style={{ bottom: `${f * 100}%` }}>{labelize(maxVal * f)}</span>)}
        </div>
        <div className="gl-chart-plot">
          {ticks.map((f) => <div key={f} className="gl-chart-grid" style={{ bottom: `${f * 100}%` }} />)}
          <div className="gl-chart-bars">
            {series.map((x) => {
              const off = hidden[x.key];
              const pct = off ? 0 : Math.max((x.value / maxVal) * 100, x.value > 0 ? 2 : 0.8);
              const active = hover === x.key;
              return (
                <div
                  key={x.key}
                  className={`gl-chart-col${active ? ' is-active' : ''}${off ? ' is-off' : ''}`}
                  onMouseEnter={() => setHover(x.key)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(x.key)}
                  onBlur={() => setHover(null)}
                  tabIndex={0}
                  role="img"
                  aria-label={`${x.label}: ${fmt(x.value)}`}
                >
                  <span className="gl-chart-val">{off ? '' : fmt(x.value)}</span>
                  <div
                    className="gl-chart-bar"
                    style={{
                      height: ready ? `${pct}%` : '0%',
                      background: `linear-gradient(180deg, ${x.from}, ${x.to})`,
                    }}
                  />
                </div>
              );
            })}
          </div>

          {hovered && !hidden[hovered.key] && (
            <div className={`gl-chart-tip gl-chart-tip-${hovered.key}`}>
              <div className="gl-chart-tip-title"><i style={{ background: hovered.dot }} />{hovered.label}</div>
              <div className="gl-chart-tip-amt">{fmt(hovered.value)}</div>
              {hovered.key === 'output' ? (
                <div className="gl-chart-tip-sub">Net liability {fmt(netLiability)}</div>
              ) : (
                <div className="gl-chart-tip-sub">{coverage.toFixed(1)}% of output GST covered</div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="gl-chart-x">
        {series.map((x) => <span key={x.key} className={hover === x.key ? 'is-active' : ''}>{x.label}</span>)}
      </div>

      <div className="gl-chart-legend">
        {series.map((x) => (
          <button
            key={x.key}
            type="button"
            className={`gl-chart-chip${hidden[x.key] ? ' is-off' : ''}`}
            onClick={() => toggle(x.key)}
            onMouseEnter={() => setHover(x.key)}
            onMouseLeave={() => setHover(null)}
            title={hidden[x.key] ? `Show ${x.label}` : `Hide ${x.label}`}
          >
            <i style={{ background: x.dot }} />{x.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function GstLiabilityReport() {
  const env = useReportsEnv();
  const profile = env.profile;
  const fyDefault = currentFyRange();
  const fyOptions = buildFyOptions();

  const [fy, setFy]     = useState(fyDefault.fy);
  const [from, setFrom] = useState(fyDefault.from);
  const [to, setTo]     = useState(fyDefault.to);
  const [activeQuick, setActiveQuick] = useState('fy');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const run = useCallback(() => {
    setErr('');
    setLoading(true);
    const qs = new URLSearchParams({ type: 'gst_liability', from, to });
    api(`${env.reportsApi}?${qs}`)
      .then(setReport)
      .catch((e) => {
        // Don't leave stale figures from a previous period on screen once the fetch
        // for the newly selected period has failed — cards/table/chart fall back to 0.
        setReport(null);
        setErr(e.message || 'Failed to load GST liability report.');
      })
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(() => { if (billingMode(profile) === 'regular') run(); }, []);

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
  };

  const download = async (format) => {
    setErr('');
    try {
      const qs = new URLSearchParams({ type: 'gst_liability', from, to, format });
      const res = await fetch(`${env.exportUrl}?${qs}`, {
        headers: { Authorization: `Bearer ${getAuthToken()}`, Accept: '*/*' },
      });
      if (!res.ok) throw new Error('Failed to export');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      // Export is legacy SpreadsheetML XML, not real OOXML — must be named .xls, not
      // .xlsx, or Excel refuses to open it ("file format or extension is not valid").
      a.download = `gst_liability_${from}_to_${to}.${format === 'xlsx' ? 'xls' : 'pdf'}`;
      a.click();
    } catch (e) { setErr(e.message); }
  };

  if (billingMode(profile) !== 'regular') {
    return (
      <div className="bp-card">
        <h2 style={{ marginTop: 0 }}>GST Liability / ITC</h2>
        <p style={{ marginBottom: 0 }}>This report is available only for regular GST dealers.</p>
      </div>
    );
  }

  const data = report?.data || {};
  // Single source of truth: every figure below reads straight from the backend's one
  // GstLiabilityService::calculate() result, so cards, table and chart can never disagree.
  const outputGst  = Number(data.total_output_gst   ?? 0);
  const eligibleItc= Number(data.total_eligible_itc ?? 0);
  const netLiability = Number(data.net_gst_liability ?? (outputGst - eligibleItc));
  const gstPayable   = Number(data.gst_payable ?? Math.max(0, netLiability));

  const cgst  = Number(data.cgst  ?? 0);
  const sgst  = Number(data.sgst  ?? 0);
  const igst  = Number(data.igst  ?? 0);
  // Same source as the "Total Output GST" KPI card (data.total_output_gst) — the backend
  // derives it from these same cgst/sgst/igst figures, so the breakdown table's total and
  // the card can never disagree.
  const totalOutput = outputGst;
  const pct = (v) => totalOutput > 0 ? `${((v / totalOutput) * 100).toFixed(2)}%` : '0.00%';

  return (
    <div style={{ maxWidth: '100%' }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="gs-head gl-head" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="gl-head-ic" style={{ width: 44, height: 44, background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--bp-navy)' }}>GST Liability / ITC</h2>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--bp-muted)' }}>
              Summary of Output GST, Eligible ITC and Net GST Liability for the selected period.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          <button type="button" onClick={() => download('xlsx')}
            style={{ height: 38, padding: '0 16px', borderRadius: 10, border: '1.5px solid #16a34a', background: '#fff', color: '#16a34a', fontWeight: 700, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
            <ExcelIcon /> Export Excel
          </button>
          <button type="button" onClick={() => download('pdf')}
            style={{ height: 38, padding: '0 16px', borderRadius: 10, border: '1.5px solid #ef4444', background: '#fff', color: '#ef4444', fontWeight: 700, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
            <DocIcon /> Export PDF
          </button>
        </div>
      </div>

      {/* ── Filter Bar ─────────────────────────────────────── */}
      <div className="bp-card gs-filter" style={{ marginBottom: 20, padding: '14px 18px' }}>
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

          {/* FY Select */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--bp-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Financial Year</span>
            <select className="bp-select" style={{ height: 36, minWidth: 130 }} value={fy} onChange={(e) => applyFy(e.target.value)}>
              {fyOptions.map((opt) => <option key={opt} value={opt}>FY {opt}</option>)}
            </select>
          </div>

          {/* From Date */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--bp-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>From Date</span>
            <input type="date" className="bp-input" style={{ height: 36, minWidth: 148 }} value={from}
              onChange={(e) => { setFrom(e.target.value); setActiveQuick(''); setFy(''); }} />
          </div>

          {/* To Date */}
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
        {err && <p style={{ color: '#ef4444', margin: '10px 0 0', fontSize: 13 }}>{err}</p>}
      </div>

      {/* ── Report Period Bar ───────────────────────────────── */}
      <div className="gl-bar" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '11px 18px', background: '#f8fafc', border: '1px solid var(--bp-border)', borderRadius: 10, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b' }}>
          <InfoIcon />
          Net GST Liability = Output GST – Eligible ITC (from matched GSTR-2B invoices)
        </div>
      </div>

      {loading ? (
        <div className="bp-card"><LoadingBlock /></div>
      ) : (
        <>
          {/* ── KPI Cards ──────────────────────────────────── */}
          <div className="gl-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
            {/* Total Output GST */}
            <div className="gl-kpi" style={{ padding: '16px 18px', background: 'linear-gradient(145deg,#eff6ff,#dbeafe)', borderRadius: 14, border: '1.5px solid rgba(0,0,0,0.05)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div className="gl-kpi-ic" style={{ width: 48, height: 48, borderRadius: 12, background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px #2563eb55', marginBottom: 12 }}>
                <OutputGstIcon />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 12, color: '#1e293b', fontWeight: 700, marginBottom: 4 }}>
                  Total Output GST <span style={{ color: '#94a3b8', display: 'inline-flex', cursor: 'pointer' }}><InfoIcon /></span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--bp-navy)', letterSpacing: '-0.5px' }}>{fmt(outputGst)}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 5 }}>GST collected on outward supplies</div>
              </div>
            </div>

            {/* Total Eligible ITC */}
            <div className="gl-kpi" style={{ padding: '16px 18px', background: 'linear-gradient(145deg,#f0fdf4,#dcfce7)', borderRadius: 14, border: '1.5px solid rgba(0,0,0,0.05)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div className="gl-kpi-ic" style={{ width: 48, height: 48, borderRadius: 12, background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px #16a34a55', marginBottom: 12 }}>
                <ItcIcon />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 12, color: '#16a34a', fontWeight: 700, marginBottom: 4 }}>
                  Total Eligible ITC <span style={{ color: '#94a3b8', display: 'inline-flex', cursor: 'pointer' }}><InfoIcon /></span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#16a34a', letterSpacing: '-0.5px' }}>{fmt(eligibleItc)}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 5 }}>Eligible ITC from matched GSTR-2B invoices</div>
              </div>
            </div>

            {/* Net GST Liability */}
            <div className="gl-kpi" style={{ padding: '16px 18px', background: 'linear-gradient(145deg,#fff7ed,#fed7aa)', borderRadius: 14, border: '1.5px solid rgba(0,0,0,0.05)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div className="gl-kpi-ic" style={{ width: 48, height: 48, borderRadius: 12, background: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px #ea580c55', marginBottom: 12 }}>
                <NetLiabilityIcon />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 12, color: '#ea580c', fontWeight: 700, marginBottom: 4 }}>
                  Net GST Liability <span style={{ color: '#94a3b8', display: 'inline-flex', cursor: 'pointer' }}><InfoIcon /></span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#ea580c', letterSpacing: '-0.5px' }}>{fmt(netLiability)}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 5 }}>Output GST – Eligible ITC</div>
              </div>
            </div>

            {/* GST Payable */}
            <div className="gl-kpi" style={{ padding: '16px 18px', background: 'linear-gradient(145deg,#faf5ff,#e9d5ff)', borderRadius: 14, border: '1.5px solid rgba(0,0,0,0.05)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div className="gl-kpi-ic" style={{ width: 48, height: 48, borderRadius: 12, background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px #7c3aed55', marginBottom: 12 }}>
                <PayableIcon />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 12, color: '#7c3aed', fontWeight: 700, marginBottom: 4 }}>
                  GST Payable <span style={{ color: '#94a3b8', display: 'inline-flex', cursor: 'pointer' }}><InfoIcon /></span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#7c3aed', letterSpacing: '-0.5px' }}>{fmt(gstPayable)}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 5 }}>Final GST payable for the selected period</div>
              </div>
            </div>
          </div>

          {/* ── Bottom Split: Table + Chart ─────────────────── */}
          <div className="bp-split" style={{ gap: 16, marginBottom: 18 }}>

            {/* OUTPUT GST BREAKDOWN */}
            <div className="bp-card gl-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--bp-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <BarChartIcon color="#2563eb" />
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--bp-navy)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Output GST Breakdown</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '10px 18px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', borderBottom: '1px solid var(--bp-border)' }}>GST Component</th>
                    <th style={{ padding: '10px 18px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#64748b', borderBottom: '1px solid var(--bp-border)' }}>Amount (₹)</th>
                    <th style={{ padding: '10px 18px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#64748b', borderBottom: '1px solid var(--bp-border)' }}>% to Total</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'CGST',       val: cgst },
                    { label: 'SGST / UTGST', val: sgst },
                    { label: 'IGST',       val: igst },
                  ].map(({ label, val }, i) => (
                    <tr key={label} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid var(--bp-border)' }}>
                      <td style={{ padding: '12px 18px', fontSize: 13, color: 'var(--bp-navy)', fontWeight: 500 }}>{label}</td>
                      <td style={{ padding: '12px 18px', textAlign: 'center', fontSize: 13 }}>{val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td style={{ padding: '12px 18px', textAlign: 'center', fontSize: 13 }}>{pct(val)}</td>
                    </tr>
                  ))}
                  {/* Total row */}
                  <tr style={{ background: '#f0f9ff', borderTop: '2px solid #bfdbfe' }}>
                    <td style={{ padding: '13px 18px', fontSize: 13, fontWeight: 800, color: '#2563eb' }}>TOTAL OUTPUT GST</td>
                    <td style={{ padding: '13px 18px', textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#2563eb' }}>{totalOutput.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td style={{ padding: '13px 18px', textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#2563eb' }}>100.00%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* OUTPUT GST vs ELIGIBLE ITC Chart */}
            <div className="bp-card gl-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--bp-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <BarChartIcon color="#2563eb" />
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--bp-navy)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Output GST vs Eligible ITC</span>
              </div>
              <div style={{ padding: '16px 18px 18px', height: 260 }}>
                <LiabilityBarChart outputGst={outputGst} eligibleItc={eligibleItc} />
              </div>
            </div>

          </div>

          {/* ── Note bar ───────────────────────────────────── */}
          <div className="gl-note" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 18px', background: '#f8fafc', border: '1px solid var(--bp-border)', borderRadius: 10, fontSize: 13, color: '#475569' }}>
            <span style={{ marginTop: 1, flexShrink: 0 }}><InfoIcon /></span>
            <span><strong>Note:</strong> Figures are based on data from GSTR-1 (Output) and matched GSTR-2B (ITC).</span>
          </div>
        </>
      )}
    </div>
  );
}
