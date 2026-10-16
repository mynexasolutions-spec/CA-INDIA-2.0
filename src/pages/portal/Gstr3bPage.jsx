import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { LoadingBlock } from '../../components/Spinner';
import { buildFyOptions, periodLabel } from '../billing/billingUtils';
import Gstr3bRequestsPanel from './Gstr3bRequestsPanel';

// ── helpers ──────────────────────────────────────────────────────────────────

function money(n) {
  const v = Number(n || 0);
  const abs = Math.abs(v);
  const fmt = abs.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return v < 0 ? `(${fmt})` : fmt;
}

function moneyFull(n) {
  const v = Number(n || 0);
  const abs = Math.abs(v);
  const fmt = `₹${abs.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  return v < 0 ? `(-) ${fmt}` : `₹${abs.toLocaleString('en-IN')}`;
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function SendIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

// ── Status/Reconciliation Badges ─────────────────────────────────────────────

function ReconBadge({ status }) {
  if (!status || status === 'upcoming') {
    return <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:700, background:'#f1f5f9', color:'#64748b' }}>
      <ClockDot />Upcoming
    </span>;
  }
  if (status === 'completed' || status === 'Completed') {
    return <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:700, background:'#dcfce7', color:'#15803d' }}>
      <GreenDot />Completed
    </span>;
  }
  return <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:700, background:'#fef3c7', color:'#b45309' }}>
    <AmberDot />Pending
  </span>;
}

function StatusBadge({ status }) {
  const s = String(status || '').toLowerCase();
  if (s.includes('filed') || s === 'filed successfully') {
    return <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:700, background:'#dcfce7', color:'#15803d' }}>
      <GreenDot />Filed
    </span>;
  }
  if (s.includes('request raised') || s.includes('request_raised') || s.includes('pending ca') || s.includes('approved')) {
    return <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:700, background:'#dbeafe', color:'#1d4ed8' }}>
      <BlueDot />Request Raised
    </span>;
  }
  if (s.includes('request not raised') || s.includes('reconciliation pending') || s.includes('pending')) {
    return <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:700, background:'#ffedd5', color:'#c2410c' }}>
      <AmberDot />Request Not Raised
    </span>;
  }
  return <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:700, background:'#f1f5f9', color:'#64748b' }}>
    <ClockDot />Upcoming
  </span>;
}

function GreenDot() { return <span style={{ width:6, height:6, borderRadius:'50%', background:'#16a34a', display:'inline-block' }} />; }
function BlueDot() { return <span style={{ width:6, height:6, borderRadius:'50%', background:'#2563eb', display:'inline-block' }} />; }
function AmberDot() { return <span style={{ width:6, height:6, borderRadius:'50%', background:'#d97706', display:'inline-block' }} />; }
function ClockDot() { return <span style={{ width:6, height:6, borderRadius:'50%', background:'#94a3b8', display:'inline-block' }} />; }

// ── Action cell ───────────────────────────────────────────────────────────────

function ActionCell({ row, onRequestFiling }) {
  const action = row.action;
  const status = String(row.status || '').toLowerCase();

  if (action === 'view_filed_return' || status.includes('filed')) {
    return (
      <button className="bp-btn bp-btn-outline" style={{ height:30, padding:'0 12px', display:'inline-flex', alignItems:'center', gap:5, fontSize:12, fontWeight:700, borderColor:'#2563eb', color:'#2563eb', borderRadius:6 }}>
        <EyeIcon /> View Filed Return
      </button>
    );
  }
  if (action === 'request_filing') {
    return (
      <button className="bp-btn bp-btn-primary" style={{ height:30, padding:'0 12px', display:'inline-flex', alignItems:'center', gap:5, fontSize:12, fontWeight:700, borderRadius:6, background:'#2563eb' }}
        onClick={() => onRequestFiling(row.period)}>
        <SendIcon /> Request Filing
      </button>
    );
  }
  if (action === 'view_details' || status.includes('request') || status.includes('pending')) {
    return (
      <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'4px 12px', borderRadius:6, fontSize:12, fontWeight:700, background:'#fef9c3', color:'#854d0e', border:'1px solid #fde047' }}>
        <AmberDot />Pending
      </span>
    );
  }
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, color:'#94a3b8', fontSize:12 }}>
      <ClockDot />Upcoming
    </span>
  );
}

// ── GSTR-3B Summary View ──────────────────────────────────────────────────────

function SummaryView({ period, financialYear, onBack, onSubmitted }) {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    setLoading(true);
    api(`/client/gst-filing/gstr3b-summary?tax_period=${period}`)
      .then(setData)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [period]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setErr('');
    try {
      await api('/client/gst-filing/request', {
        method: 'POST',
        body: {
          financial_year: financialYear,
          filing_period:  period,
          return_type:    'GSTR-3B',
          client_declaration: true,
        },
      });
      setShowSuccess(true);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const summary  = data?.summary              || {};
  const breakup  = data?.tax_payment_breakup  || [];
  const balance  = data?.itc_balance          || [];

  const summaryCards = [
    {
      label: 'Total Outward Taxable Value',
      value: `₹ ${Number(summary.total_outward_taxable || 0).toLocaleString('en-IN')}`,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
      ),
      bg: '#eff6ff', border: '#bfdbfe', iconColor: '#2563eb',
    },
    {
      label: 'Total Output Tax (Outward + RCM)',
      value: `₹ ${Number(summary.total_output_tax || 0).toLocaleString('en-IN')}`,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
        </svg>
      ),
      bg: '#fdf4ff', border: '#e9d5ff', iconColor: '#9333ea',
    },
    {
      label: 'Total Eligible ITC',
      value: `₹ ${Number(summary.total_eligible_itc || 0).toLocaleString('en-IN')}`,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          <polyline points="7.5 4.21 12 6.81 16.5 4.21"/>
          <polyline points="7.5 19.79 7.5 14.6 3 12"/>
          <polyline points="21 12 16.5 14.6 16.5 19.79"/>
        </svg>
      ),
      bg: '#f0fdf4', border: '#bbf7d0', iconColor: '#15803d',
    },
    {
      label: 'Total Tax Liability',
      value: `₹ ${Number(summary.total_tax_liability || 0).toLocaleString('en-IN')}`,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      ),
      bg: '#fff1f2', border: '#fecdd3', iconColor: '#e11d48',
    },
    {
      label: 'Net Tax Payable / Excess ITC',
      value: moneyFull(summary.net_tax_payable),
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10"/>
          <line x1="12" y1="20" x2="12" y2="4"/>
          <line x1="6"  y1="20" x2="6"  y2="14"/>
        </svg>
      ),
      bg: '#f0fdf4', border: '#bbf7d0', iconColor: '#15803d',
      valueBold: true, valueColor: Number(summary.net_tax_payable || 0) < 0 ? '#15803d' : '#e11d48',
    },
  ];

  if (loading) return <div className="bp-card" style={{ marginTop: 20 }}><LoadingBlock /></div>;

  return (
    <div>
      {/* Header */}
      <div className="bp-toolbar no-print" style={{ marginBottom: 20 }}>
        <button type="button"
          style={{ background:'none', border:'none', cursor:'pointer', color:'#2563eb', display:'flex', alignItems:'center', gap:6, fontSize:13, fontWeight:600, padding:'4px 0' }}
          onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back to Filing Periods
        </button>
        <div style={{ flex:1, marginLeft:16 }}>
          <h2 style={{ margin:0, fontSize:22, fontWeight:800, color:'var(--bp-navy)' }}>GSTR-3B Summary</h2>
          <p style={{ margin:'2px 0 0', fontSize:13, color:'var(--bp-muted)' }}>
            {data?.period_label} — Review before submitting filing request
          </p>
        </div>
        {!submitted && (
          <button type="button" className="bp-btn bp-btn-primary"
            style={{ height:40, borderRadius:8, fontWeight:700, display:'inline-flex', alignItems:'center', gap:7, paddingInline:18 }}
            onClick={handleSubmit} disabled={submitting}>
            <SendIcon /> {submitting ? 'Submitting…' : 'Submit Request'}
          </button>
        )}
        {submitted && (
          <span style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:8, background:'#fef9c3', color:'#854d0e', fontWeight:700, fontSize:13, border:'1px solid #fde047' }}>
            <AmberDot /> Pending – CA Verification
          </span>
        )}
      </div>

      {/* Summary tab strip (single tab) */}
      <div style={{ display:'flex', borderBottom:'2px solid #e2e8f0', marginBottom:20 }}>
        <div style={{ padding:'10px 20px', fontSize:14, fontWeight:700, color:'#2563eb', borderBottom:'2px solid #2563eb', marginBottom:-2 }}>
          Summary
        </div>
      </div>

      {err && <p className="bp-alert bp-alert-error" style={{ marginBottom:14 }}>{err}</p>}

      {/* 5 Summary Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:14, marginBottom:24 }}>
        {summaryCards.map((c) => (
          <div key={c.label} style={{ background:c.bg, border:`1.5px solid ${c.border}`, borderRadius:12, padding:'14px 16px' }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:8 }}>
              <span style={{ width:40, height:40, borderRadius:10, background:'#fff', border:`1px solid ${c.border}`, display:'flex', alignItems:'center', justifyContent:'center', color:c.iconColor, flexShrink:0 }}>
                {c.icon}
              </span>
            </div>
            <div style={{ fontSize:11, fontWeight:700, color:'#475569', marginBottom:4, lineHeight:1.3 }}>{c.label}</div>
            <div style={{ fontSize:20, fontWeight:800, color: c.valueColor || '#1e293b', lineHeight:1.1 }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Tax Payment Breakup */}
      <div className="bp-card" style={{ padding:0, marginBottom:20, overflow:'hidden' }}>
        <div style={{ padding:'14px 18px', borderBottom:'1px solid #e2e8f0' }}>
          <h3 style={{ margin:0, fontSize:15, fontWeight:800, color:'var(--bp-navy)' }}>Tax Payment Breakup</h3>
        </div>
        <div className="bp-table-wrapper">
          <table className="bp-table" style={{ width:'100%' }}>
            <thead>
              <tr style={{ background:'#1e3a5f' }}>
                {['Particulars','Output Tax and RCM (₹)','ITC (₹)','Interest (₹)','Late Fee (₹)','Total Liability (₹)'].map((h) => (
                  <th key={h} style={{ color:'#fff', fontWeight:700, fontSize:12, padding:'10px 14px', textAlign: h === 'Particulars' ? 'left' : 'right' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {breakup.map((row) => (
                <tr key={row.label} style={{ background: row.is_total ? '#eff6ff' : undefined }}>
                  <td style={{ fontWeight: row.is_total ? 800 : 600, color:'var(--bp-navy)' }}>{row.label}</td>
                  <td style={{ textAlign:'right', fontWeight: row.is_total ? 800 : 400 }}>{money(row.output)}</td>
                  <td style={{ textAlign:'right', fontWeight: row.is_total ? 800 : 400 }}>{money(row.itc)}</td>
                  <td style={{ textAlign:'right', color:'#94a3b8' }}>{money(row.interest)}</td>
                  <td style={{ textAlign:'right', color:'#94a3b8' }}>{money(row.late_fee)}</td>
                  <td style={{ textAlign:'right', fontWeight: row.is_total ? 800 : 600, color: row.is_total ? '#1d4ed8' : undefined }}>
                    {money(row.liability)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ITC Balance Details */}
      <div className="bp-card" style={{ padding:0, overflow:'hidden' }}>
        <div style={{ padding:'14px 18px', borderBottom:'1px solid #e2e8f0', display:'flex', alignItems:'center', gap:8 }}>
          <h3 style={{ margin:0, fontSize:15, fontWeight:800, color:'var(--bp-navy)' }}>ITC Balance Details</h3>
          <span style={{ width:18, height:18, borderRadius:'50%', background:'#dbeafe', display:'flex', alignItems:'center', justifyContent:'center', cursor:'default' }} title="Balance ITC shows unused Input Tax Credit after offsetting tax liability.">
            <svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="10" r="7.5"/><path d="M10 9.2v4.3M10 6.7v.01"/></svg>
          </span>
        </div>
        <div className="bp-table-wrapper">
          <table className="bp-table" style={{ width:'100%' }}>
            <thead>
              <tr style={{ background:'#1e3a5f' }}>
                {['Particulars','IGST (₹)','CGST (₹)','SGST/UTGST (₹)','Total (₹)'].map((h) => (
                  <th key={h} style={{ color:'#fff', fontWeight:700, fontSize:12, padding:'10px 14px', textAlign: h === 'Particulars' ? 'left' : 'right' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {balance.map((row) => (
                <tr key={row.label} style={{ background: row.is_total ? '#eff6ff' : undefined }}>
                  <td style={{ fontWeight: row.is_total ? 800 : 600, color:'var(--bp-navy)' }}>{row.label}</td>
                  <td style={{ textAlign:'right', fontWeight: row.is_total ? 800 : 400 }}>{money(row.igst)}</td>
                  <td style={{ textAlign:'right', fontWeight: row.is_total ? 800 : 400 }}>{money(row.cgst)}</td>
                  <td style={{ textAlign:'right', fontWeight: row.is_total ? 800 : 400 }}>{money(row.sgst)}</td>
                  <td style={{ textAlign:'right', fontWeight: row.is_total ? 800 : 600, color: row.is_total ? '#1d4ed8' : undefined }}>
                    {money(row.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Success Popup */}
      {showSuccess && (
        <div style={{ position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.45)' }} />
          <div style={{ position:'relative', background:'#fff', borderRadius:16, padding:'36px 40px 28px', width:'100%', maxWidth:420, boxShadow:'0 20px 60px rgba(0,0,0,0.2)', textAlign:'center' }}>
            <div style={{ width:64, height:64, borderRadius:'50%', background:'#dcfce7', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 18px' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h3 style={{ margin:'0 0 10px', fontSize:20, fontWeight:800, color:'var(--bp-navy)' }}>Request Submitted Successfully!</h3>
            <p style={{ margin:'0 0 24px', fontSize:14, color:'#475569', lineHeight:1.6 }}>
              Your GSTR-3B filing request has been successfully submitted to the CA for verification.
            </p>
            <button type="button" className="bp-btn bp-btn-primary"
              style={{ height:42, width:'100%', borderRadius:10, fontWeight:700, fontSize:15 }}
              onClick={() => { setShowSuccess(false); setSubmitted(true); onSubmitted(period); }}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main GSTR-3B Page ─────────────────────────────────────────────────────────

export default function Gstr3bPage() {
  const { user } = useAuth();
  const profile  = user?.client_profile;

  const fyOptions  = buildFyOptions();
  const now        = new Date();
  const fyStartNow = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const defaultFy  = `${fyStartNow}-${String(fyStartNow + 1).slice(-2)}`;

  const [fy, setFy]               = useState(defaultFy);
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [err, setErr]             = useState('');
  const [summaryPeriod, setSummaryPeriod] = useState(null);

  const [localRequested, setLocalRequested] = useState(new Set());

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    const qs = new URLSearchParams({ financial_year: fy, return_type: 'GSTR-3B' });
    return api(`/client/gst-filing/periods?${qs}`)
      .then(setData)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [fy]);

  useEffect(() => { load(); }, [load]);

  const summary = data?.summary || {};

  if (summaryPeriod) {
    return (
      <SummaryView
        period={summaryPeriod}
        financialYear={fy}
        onBack={() => setSummaryPeriod(null)}
        onSubmitted={(period) => {
          setLocalRequested((s) => new Set([...s, period]));
          setSummaryPeriod(null);
          load();
        }}
      />
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="bp-toolbar no-print" style={{ marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--bp-navy)' }}>GSTR-3B</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--bp-muted)' }}>Goods and Services Tax Return</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--bp-navy)', whiteSpace: 'nowrap' }}>Financial Year</label>
          <select className="bp-select" value={fy} onChange={(e) => setFy(e.target.value)} style={{ height: 38, minWidth: 110 }}>
            {fyOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Requests received from the Admin / raised by the client (hidden when there are none) */}
      <Gstr3bRequestsPanel />

      {/* 4 Info Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', background: '#fff', border: '1.5px solid #cbd5e1', borderRadius: 12, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        {[
          {
            label: 'Dealer Type',
            value: profile?.dealer_type ? `${profile.dealer_type.charAt(0).toUpperCase() + profile.dealer_type.slice(1)} Dealer` : 'Regular Dealer',
            icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
            noBorder: false,
          },
          {
            label: 'Filing Frequency',
            value: summary.filing_frequency_label || (data?.quarterly ? 'Quarterly' : 'Monthly'),
            sub: data?.quarterly ? 'Quarterly (Q1M)' : undefined,
            icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
            noBorder: false,
          },
          {
            label: 'Last Filed',
            value: summary.last_filed ? periodLabel(summary.last_filed.period) : '—',
            sub: summary.last_filed?.filed_on ? `Filed on: ${fmtDate(summary.last_filed.filed_on)}` : undefined,
            valueColor: '#15803d',
            icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="10 9 9 9 8 9"/></svg>,
            noBorder: false,
          },
          {
            label: 'Next Due Date',
            value: summary.next_due ? fmtDate(summary.next_due.date) : '—',
            sub: summary.next_due?.period_label ? `(For ${summary.next_due.period_label} Return)` : undefined,
            valueColor: '#e11d48',
            icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
            noBorder: true,
          },
        ].map((c, idx) => (
          <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 22px', borderRight: c.noBorder ? 'none' : '1px solid #e2e8f0' }}>
            <span style={{ width: 42, height: 42, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb', flexShrink: 0 }}>
              {c.icon}
            </span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 2 }}>{c.label}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: c.valueColor || '#1e40af' }}>{c.value}</div>
              {c.sub && <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{c.sub}</div>}
            </div>
          </div>
        ))}
      </div>

      {err && <p className="bp-alert bp-alert-error" style={{ marginBottom: 12 }}>{err}</p>}

      {/* Filing Periods Table */}
      <div className="bp-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--bp-navy)' }}>Filing Periods ({fy})</h3>
        </div>
        {loading ? (
          <div style={{ padding: 32 }}><LoadingBlock /></div>
        ) : (
          <div className="bp-table-wrapper" style={{ overflowX: 'auto' }}>
            <table className="bp-table" style={{ width: '100%' }}>
              <thead>
                <tr style={{ background: '#1e3a5f' }}>
                  {['Tax Period', 'Due Date', 'Reconciliation Status', 'Status', 'Filed On', 'ARN', 'Action'].map((h) => (
                    <th key={h} style={{ color: '#fff', fontWeight: 700, fontSize: 12, padding: '10px 14px', textAlign: h === 'Action' ? 'center' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.periods || []).map((row) => {
                  const wasRequested = localRequested.has(row.period);
                  const effectiveAction = wasRequested ? 'view_details' : row.action;
                  const effectiveStatus = wasRequested ? 'Request Raised' : row.status;
                  return (
                    <tr key={row.period}>
                      <td style={{ fontWeight: 700, color: 'var(--bp-navy)', whiteSpace: 'nowrap' }}>{row.period_label || periodLabel(row.period)}</td>
                      <td style={{ whiteSpace: 'nowrap', color: '#475569' }}>{fmtDate(row.due_date)}</td>
                      <td><ReconBadge status={row.reconciliation_status} /></td>
                      <td><StatusBadge status={effectiveStatus} /></td>
                      <td style={{ whiteSpace: 'nowrap', color: '#475569' }}>{row.filed_on ? fmtDate(row.filed_on) : '—'}</td>
                      <td style={{ fontWeight: row.ack_no ? 700 : 400, color: row.ack_no ? '#2563eb' : '#94a3b8', fontSize: 12, fontFamily: 'monospace' }}>{row.ack_no || '—'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <ActionCell row={{ ...row, action: effectiveAction, status: effectiveStatus }} onRequestFiling={setSummaryPeriod} />
                      </td>
                    </tr>
                  );
                })}
                {!(data?.periods?.length) && (
                  <tr><td colSpan={7} style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--bp-muted)' }}>No periods found for {fy}.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Important Notes */}
      <div style={{ marginTop: 16, background: '#eff6ff', border: '1px solid #dbeafe', borderRadius: 10, padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
          </svg>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13, color: '#1e40af', marginBottom: 6 }}>Important Notes:</div>
            <ul style={{ margin: 0, padding: '0 0 0 16px', color: '#1e40af', fontSize: 13, lineHeight: 1.7 }}>
              <li>Reconciliation must be completed with GSTR-1 and GSTR-2B before raising a request for filing GSTR-3B.</li>
              <li>"Request Filing" button will be available only after reconciliation is completed.</li>
              <li>Future tax periods will be enabled once the due date is available.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
