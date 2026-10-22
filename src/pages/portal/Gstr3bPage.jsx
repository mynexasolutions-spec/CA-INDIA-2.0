import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useClientPortal } from '../../components/portal/ClientPortalContext';
import { useAuth } from '../../auth/AuthContext';
import { LoadingBlock } from '../../components/Spinner';
import { periodLabel } from '../billing/billingUtils';
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

function AmberDot() { return <span style={{ width:6, height:6, borderRadius:'50%', background:'#d97706', display:'inline-block' }} />; }

const IcCheckC = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><polyline points="8 12.5 11 15.5 16 9.5" /></svg>;
const IcClockC = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><polyline points="12 7 12 12 15.5 14" /></svg>;
const IcWarnC = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;

function Chip({ bg, fg, icon, children, width = 132 }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, minWidth: width, padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: bg, color: fg }}>
      {icon}{children}
    </span>
  );
}

function ReconBadge({ status }) {
  const t = String(status || '').toLowerCase();
  if (t === 'completed') return <Chip bg="#d9f3e3" fg="#15803d" icon={<IcCheckC />}>Completed</Chip>;
  if (!status || t === 'upcoming') return <Chip bg="#e8edf5" fg="#64748b" icon={<IcClockC />}>Upcoming</Chip>;
  return <Chip bg="#fdecc8" fg="#b45309" icon={<IcWarnC />}>Pending</Chip>;
}

function StatusBadge({ status }) {
  const t = String(status || '').toLowerCase();
  if (t.includes('filed') && !t.includes('not')) return <Chip bg="#d9f3e3" fg="#15803d" icon={<IcCheckC />} width={110}>Filed</Chip>;
  if (t.includes('request raised') || t.includes('pending ca') || t.includes('approved')) return <Chip bg="#dbeafe" fg="#1d4ed8" icon={<IcClockC />} width={140}>Request Raised</Chip>;
  if (t.includes('not raised') || t.includes('reconciliation pending') || t.includes('pending')) return <Chip bg="#ffe8d6" fg="#c2410c" icon={<IcWarnC />} width={140}>Request Not Raised</Chip>;
  return <Chip bg="#e8edf5" fg="#64748b" icon={<IcClockC />} width={110}>Upcoming</Chip>;
}

// ── Action cell ───────────────────────────────────────────────────────────────

function ActionCell({ row, onRequestFiling }) {
  const action = row.action;
  const status = String(row.status || '').toLowerCase();
  const base = { height: 32, padding: '0 16px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 12.5, fontWeight: 700, minWidth: 140 };

  if (action === 'view_filed_return' || (status.includes('filed') && !status.includes('not'))) {
    return <button type="button" style={{ ...base, border: '1px solid #9fbdf2', background: '#fff', color: '#1d4ed8', cursor: 'pointer' }}><SendIcon /> View Filed Return</button>;
  }
  if (action === 'request_filing') {
    return (
      <button type="button" onClick={() => onRequestFiling(row.period)}
        style={{ ...base, border: 'none', background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: '#fff', cursor: 'pointer', boxShadow: '0 8px 14px -8px rgba(29,78,216,.85)' }}>
        <SendIcon /> Request Filing
      </button>
    );
  }
  if (action === 'view_details' || status.includes('request') || status.includes('pending')) {
    return <span style={{ ...base, background: '#fdecc8', color: '#b45309', border: '1px solid #f6d58e' }}><AmberDot /> Pending</span>;
  }
  return <span style={{ ...base, background: '#e8edf5', color: '#8a97ad', cursor: 'not-allowed' }}><IcClockC /> Upcoming</span>;
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

  const inrv = (n) => Number(n || 0).toLocaleString('en-IN');
  const net = Number(summary.net_tax_payable || 0);
  const ic = (d) => <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d}</svg>;
  const summaryCards = [
    { label: 'Total Outward Taxable Value', value: `₹ ${inrv(summary.total_outward_taxable)}`, tone: ['linear-gradient(135deg,#eef5ff,#e1ecff)', '#d2e2fb', '#cfe0ff', '#1d4ed8'], color: '#0f2a5f',
      icon: ic(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></>) },
    { label: 'Total Output Tax (Outward + RCM)', value: `₹ ${inrv(summary.total_output_tax)}`, tone: ['linear-gradient(135deg,#f8f1ff,#efe3fd)', '#e4d3f8', '#e6d6fa', '#7c3aed'], color: '#0f2a5f',
      icon: ic(<><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></>) },
    { label: Number(summary.projected_itc) > 0 ? `Total Eligible ITC (incl. ₹ ${inrv(summary.projected_itc)} Projected)` : 'Total Eligible ITC', value: `₹ ${inrv(summary.total_eligible_itc)}`, tone: ['linear-gradient(135deg,#f0fbf4,#e0f6e8)', '#cdeed9', '#c9efd7', '#15803d'], color: '#0f2a5f',
      icon: ic(<><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="7.5 4.21 12 6.81 16.5 4.21" /><polyline points="7.5 19.79 7.5 14.6 3 12" /><polyline points="21 12 16.5 14.6 16.5 19.79" /></>) },
    { label: 'Total Tax Liability', value: `₹ ${inrv(summary.total_tax_liability)}`, tone: ['linear-gradient(135deg,#fff3f3,#fde6e6)', '#f8d2d2', '#fbd5d5', '#dc2626'], color: '#0f2a5f',
      icon: ic(<><rect x="4" y="2" width="16" height="20" rx="2" /><line x1="8" y1="6" x2="16" y2="6" /><line x1="8" y1="11" x2="8.01" y2="11" /><line x1="12" y1="11" x2="12.01" y2="11" /><line x1="16" y1="11" x2="16.01" y2="11" /><line x1="8" y1="16" x2="8.01" y2="16" /><line x1="12" y1="16" x2="16" y2="16" /></>) },
    { label: 'Net Tax Payable / Excess ITC', value: moneyFull(summary.net_tax_payable), info: true, tone: ['linear-gradient(135deg,#eef5ff,#e1ecff)', '#d2e2fb', '#cfe0ff', '#1d4ed8'], color: net < 0 ? '#15803d' : '#dc2626',
      icon: ic(<><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>) },
  ];

  if (loading) return <div className="bp-card" style={{ marginTop: 20 }}><LoadingBlock /></div>;

  const TH = { background: '#e9f0fb', color: '#0f2a5f', fontWeight: 800, fontSize: 12.5, padding: '12px 14px', textAlign: 'center', borderBottom: '1px solid #d6e3f7', whiteSpace: 'nowrap' };
  const TD = { padding: '13px 14px', textAlign: 'center', fontSize: 13, color: '#1e293b', borderBottom: '1px solid #eef3fa' };
  const panel = { background: '#fff', border: '1px solid #dfe8f5', borderRadius: 16, overflow: 'hidden', marginBottom: 20, boxShadow: '0 14px 30px -26px rgba(15,42,95,.55)' };

  return (
    <div style={{ maxWidth: 1250 }}>
      <button type="button" onClick={onBack} style={{ background: 'none', border: 'none', padding: 0, marginBottom: 10, color: '#2563eb', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>‹ Back to Filing Periods</button>

      <div style={{ display: 'inline-block', padding: '10px 28px', borderRadius: '10px 10px 0 0', background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: '#fff', fontWeight: 800, fontSize: 13.5 }}>Summary</div>

      <div style={{ ...panel, borderRadius: '0 16px 16px 16px', padding: '18px 20px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: '#0f2a5f' }}>GSTR-3B Summary</h2>
            {data?.period_label && <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>{data.period_label} — review before submitting the filing request</div>}
          </div>
          {!submitted ? (
            <button type="button" onClick={handleSubmit} disabled={submitting}
              style={{ height: 44, padding: '0 26px', borderRadius: 11, border: 'none', background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: '#fff', fontWeight: 800, fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 9, cursor: submitting ? 'wait' : 'pointer', boxShadow: '0 12px 20px -12px rgba(29,78,216,.85)' }}>
              <SendIcon /> {submitting ? 'Submitting…' : 'Submit Request'}
            </button>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, background: '#ffe8d6', color: '#c2410c', fontWeight: 700, fontSize: 13 }}><AmberDot /> Pending – CA Verification</span>
          )}
        </div>

        {err && <p className="bp-alert bp-alert-error" style={{ marginBottom: 14 }}>{err}</p>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 14 }} className="g2b-tiles">
          {summaryCards.map((c) => (
            <div key={c.label} style={{ background: c.tone[0], border: `1px solid ${c.tone[1]}`, borderRadius: 14, padding: '16px 16px', display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <span style={{ width: 52, height: 52, borderRadius: 14, background: c.tone[2], color: c.tone[3], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{c.icon}</span>
              <div style={{ minWidth: 0, lineHeight: 1.25 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#334155' }}>{c.label}{c.info && <span title="A negative figure is excess ITC carried forward." style={{ marginLeft: 5, display: 'inline-flex', width: 14, height: 14, borderRadius: '50%', background: '#2563eb', color: '#fff', fontSize: 9, fontWeight: 800, alignItems: 'center', justifyContent: 'center', verticalAlign: 'middle' }}>i</span>}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: c.color, whiteSpace: 'nowrap' }}>{c.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={panel}>
        <div style={{ padding: '16px 20px 10px' }}><h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f2a5f' }}>Tax Payment Breakup</h3></div>
        <div style={{ overflowX: 'auto', padding: '0 14px 14px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {['Particulars', 'Output Tax and RCM (₹)', 'ITC (₹)', 'Interest (₹)', 'Late Fee (₹)', 'Total Liability (₹)'].map((h, i) => <th key={h} style={{ ...TH, textAlign: i === 0 ? 'left' : 'center' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {breakup.map((row) => {
                const t = row.is_total;
                const cell = { ...TD, ...(t ? { background: '#e3ecfa', fontWeight: 800, fontSize: 15, color: '#0f2a5f', padding: '15px 14px' } : {}) };
                return (
                  <tr key={row.label}>
                    <td style={{ ...cell, textAlign: 'left', fontWeight: 800, color: '#0f2a5f' }}>{row.label}</td>
                    <td style={cell}>{money(row.output)}</td>
                    <td style={cell}>{money(row.itc)}</td>
                    <td style={cell}>{money(row.interest)}</td>
                    <td style={cell}>{money(row.late_fee)}</td>
                    <td style={{ ...cell, fontWeight: 800, color: '#0f2a5f' }}>{money(row.liability)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={panel}>
        <div style={{ padding: '16px 20px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f2a5f' }}>ITC Balance Details</h3>
          <span title="Balance ITC shows unused Input Tax Credit after offsetting tax liability." style={{ width: 18, height: 18, borderRadius: '50%', background: '#2563eb', color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help' }}>i</span>
        </div>
        <div style={{ overflowX: 'auto', padding: '0 14px 14px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {['Particulars', 'IGST (₹)', 'CGST (₹)', 'SGST/UTGST (₹)', 'Total (₹)'].map((h, i) => <th key={h} style={{ ...TH, textAlign: i === 0 ? 'left' : 'center' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {balance.map((row) => {
                const t = row.is_total;
                const cell = { ...TD, ...(t ? { background: '#e3ecfa', fontWeight: 800, fontSize: 15, color: '#0f2a5f', padding: '15px 14px' } : {}) };
                return (
                  <tr key={row.label}>
                    <td style={{ ...cell, textAlign: 'left', fontWeight: 700, color: '#0f2a5f' }}>{row.label}</td>
                    <td style={cell}>{money(row.igst)}</td>
                    <td style={cell}>{money(row.cgst)}</td>
                    <td style={cell}>{money(row.sgst)}</td>
                    <td style={{ ...cell, fontWeight: 800, color: '#0f2a5f' }}>{money(row.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Success Popup */}
      {showSuccess && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.45)' }} />
          <div style={{ position: 'relative', background: '#fff', borderRadius: 18, padding: '34px 38px 26px', width: '100%', maxWidth: 420, boxShadow: '0 30px 60px -20px rgba(15,42,95,.5)', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <h3 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 800, color: '#0f2a5f' }}>Request Submitted Successfully!</h3>
            <p style={{ margin: '0 0 22px', fontSize: 14, color: '#475569', lineHeight: 1.6 }}>Your GSTR-3B filing request has been successfully submitted to the CA for verification.</p>
            <button type="button" style={{ height: 42, width: '100%', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}
              onClick={() => { setShowSuccess(false); setSubmitted(true); onSubmitted(period); }}>OK</button>
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

  const now        = new Date();
  const fyStartNow = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const defaultFy  = `${fyStartNow}-${String(fyStartNow + 1).slice(-2)}`;

  // The Financial Year comes from the portal header selector.
  const portal = useClientPortal();
  const fy = portal?.fy || defaultFy;
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

  const info = (d) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>;
  const dealer = profile?.dealer_type ? `${profile.dealer_type.charAt(0).toUpperCase() + profile.dealer_type.slice(1)} Dealer` : 'Regular Dealer';
  const freqLabel = data?.quarterly ? 'Quarterly' : 'Monthly';
  const card = { background: '#fff', border: '1px solid #e3ebf6', borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 10px 24px -22px rgba(15,42,95,.6)' };
  const ibox = (d) => <span style={{ width: 46, height: 46, borderRadius: 12, background: '#e6eeff', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{info(d)}</span>;
  const TH = { background: '#0f3a8a', color: '#fff', fontWeight: 800, fontSize: 12, padding: '12px 10px', textAlign: 'center', whiteSpace: 'nowrap' };
  const TD = { padding: '10px 10px', textAlign: 'center', fontSize: 13, color: '#334155', borderBottom: '1px solid #eef3fa', whiteSpace: 'nowrap' };

  return (
    <div style={{ maxWidth: 1250 }}>
      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
        <Link to="/portal" style={{ color: '#2563eb', textDecoration: 'none' }}>Dashboard</Link><span>›</span>
        <span>GST Compliance</span><span>›</span><span style={{ color: '#1e293b', fontWeight: 800 }}>GSTR-3B</span>
      </div>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#0f2a5f', letterSpacing: '-0.01em' }}>GSTR-3B</h1>
        <p style={{ margin: '2px 0 0', fontSize: 14, color: '#2563eb', fontWeight: 600 }}>Goods and Services Tax Return</p>
      </div>

      {/* Requests received from the Admin / raised by the client (hidden when there are none) */}
      <Gstr3bRequestsPanel />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, marginBottom: 20 }} className="g2b-tiles">
        <div style={card}>
          {ibox(<><path d="M3 9l1-5h16l1 5" /><path d="M4 9v11h16V9" /><path d="M9 20v-6h6v6" /></>)}
          <div><div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>Dealer Type</div><div style={{ fontSize: 16, fontWeight: 800, color: '#0f2a5f' }}>{dealer}</div></div>
        </div>
        <div style={card}>
          {ibox(<><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>)}
          <div>
            <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>Filing Frequency</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#0f2a5f' }}>{freqLabel}</span>
              <span style={{ padding: '2px 10px', borderRadius: 8, background: '#d9f3e3', color: '#15803d', fontSize: 11, fontWeight: 800 }}>{data?.quarterly ? 'Quarterly (QRMP)' : 'Monthly (Q1M)'}</span>
            </div>
          </div>
        </div>
        <div style={card}>
          {ibox(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /></>)}
          <div>
            <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>Last Filed</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 16, fontWeight: 800, color: '#0f2a5f' }}>
              {summary.last_filed ? periodLabel(summary.last_filed.period) : '—'}
              {summary.last_filed && <span style={{ color: '#16a34a', display: 'inline-flex' }}><IcCheckC /></span>}
            </div>
            {summary.last_filed?.filed_on && <div style={{ fontSize: 11.5, color: '#64748b' }}>Filed on: {fmtDate(summary.last_filed.filed_on)}</div>}
          </div>
        </div>
        <div style={card}>
          {ibox(<><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>)}
          <div>
            <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>Next Due Date</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f2a5f' }}>{summary.next_due ? fmtDate(summary.next_due.date) : '—'}</div>
            {summary.next_due?.period_label && <div style={{ fontSize: 11.5, color: '#dc2626', fontWeight: 600 }}>(For {summary.next_due.period_label} Return)</div>}
          </div>
        </div>
      </div>

      {err && <p className="bp-alert bp-alert-error" style={{ marginBottom: 12 }}>{err}</p>}

      <div className="cl-gst-periods" style={{ background: '#fff', border: '1px solid #dfe8f5', borderRadius: 16, overflow: 'hidden', boxShadow: '0 14px 30px -26px rgba(15,42,95,.55)' }}>
        <div style={{ padding: '16px 20px 10px' }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0f2a5f' }}>Filing Periods (FY {fy})</h3>
        </div>
        {loading ? (
          <div style={{ padding: 32 }}><LoadingBlock /></div>
        ) : (
          <div style={{ overflowX: 'auto', padding: '0 14px 14px' }}>
            <table className="fp-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Tax Period', 'Due Date', 'Reconciliation Status', 'Status', 'Filed On', 'ARN', 'Action'].map((h) => <th key={h} style={TH}>{h.toUpperCase()}</th>)}</tr>
              </thead>
              <tbody>
                {(data?.periods || []).map((row, i) => {
                  const wasRequested = localRequested.has(row.period);
                  const effectiveAction = wasRequested ? 'view_details' : row.action;
                  const effectiveStatus = wasRequested ? 'Request Raised' : row.status;
                  return (
                    <tr key={row.period} style={String(effectiveStatus).toLowerCase().includes('request raised') ? { background: '#e8f1ff' } : (i % 2 ? { background: '#f9fbff' } : undefined)}>
                      <td style={{ ...TD, fontWeight: 800, color: '#0f2a5f', textAlign: 'left', paddingLeft: 18 }}>{row.period_label || periodLabel(row.period)}</td>
                      <td style={TD}>{fmtDate(row.due_date)}</td>
                      <td style={TD}><ReconBadge status={row.reconciliation_status} /></td>
                      <td style={TD}><StatusBadge status={effectiveStatus} /></td>
                      <td style={{ ...TD, color: row.filed_on ? '#334155' : '#94a3b8' }}>{row.filed_on ? fmtDate(row.filed_on) : '—'}</td>
                      <td style={{ ...TD, fontFamily: row.ack_no ? 'monospace' : undefined, color: row.ack_no ? '#1d4ed8' : '#94a3b8', fontWeight: row.ack_no ? 700 : 400 }}>{row.ack_no || '—'}</td>
                      <td style={TD}><ActionCell row={{ ...row, action: effectiveAction, status: effectiveStatus }} onRequestFiling={setSummaryPeriod} /></td>
                    </tr>
                  );
                })}
                {!(data?.periods?.length) && <tr><td colSpan={7} style={{ ...TD, padding: '40px 16px', color: '#94a3b8' }}>No periods found for {fy}.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="cl-notes" style={{ marginTop: 18, background: '#eaf3ff', border: '1px solid #cfe2ff', borderRadius: 14, padding: '16px 20px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <span style={{ width: 36, height: 36, borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><line x1="12" y1="11" x2="12" y2="17" /><line x1="12" y1="7" x2="12.01" y2="7" /></svg>
        </span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#1d4ed8', marginBottom: 6 }}>Important Notes:</div>
          <ul style={{ margin: 0, paddingLeft: 18, listStyle: 'disc', color: '#1e3a8a', fontSize: 12.5, lineHeight: 1.75 }}>
            <li>Reconciliation must be completed with GSTR-1 and GSTR-2B before raising a request for filing GSTR-3B.</li>
            <li>"Request Filing" button will be available only after reconciliation is completed.</li>
            <li>Future tax periods will be enabled once the due date is available.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
