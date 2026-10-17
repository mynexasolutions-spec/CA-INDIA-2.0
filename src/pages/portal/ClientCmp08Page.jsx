import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, getAuthToken } from '../../api/client';
import Gstr3bRequestsPanel from './Gstr3bRequestsPanel';
import { useAuth } from '../../auth/AuthContext';
import { LoadingBlock } from '../../components/Spinner';
import { buildFyOptions, currentFyLabel } from '../billing/billingUtils';

/* ── helpers ── */
const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

function StatusBadge({ status }) {
  const map = {
    filed:     { bg: '#dcfce7', color: '#166534', label: 'Filed' },
    confirmed: { bg: '#dbeafe', color: '#1d4ed8', label: 'Confirmed' },
    pending:   { bg: '#fef9c3', color: '#854d0e', label: 'Pending' },
    upcoming:  { bg: '#f1f5f9', color: '#64748b', label: 'Upcoming' },
  };
  const s = map[status] || map.upcoming;
  return (
    <span style={{ display:'inline-block', padding:'2px 10px', borderRadius:12, background:s.bg, color:s.color, fontWeight:600, fontSize:12 }}>
      {s.label}
    </span>
  );
}

/* ══════════════════════════════════════════════
   PERIODS LIST VIEW
══════════════════════════════════════════════ */
function PeriodsView({ fy, setFy }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const fyOptions = buildFyOptions(5);

  const load = useCallback(async (fyVal) => {
    setLoading(true);
    try {
      // api() already returns the parsed JSON body (there is no Response to call .json() on).
      setData(await api(`/client/cmp08/periods?financial_year=${fyVal}`));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(fy); }, [fy, load]);

  const profile = data?.profile || user?.client_profile;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:700, color:'#1e3a5f' }}>CMP-08 Returns</h1>
          <p style={{ margin:'4px 0 0', color:'#64748b', fontSize:13 }}>Composition Taxpayer Quarterly Return</p>
        </div>
        <select
          value={fy}
          onChange={e => setFy(e.target.value)}
          style={{ padding:'6px 12px', border:'1px solid #d1d5db', borderRadius:6, fontSize:13, color:'#374151', background:'#fff' }}
        >
          {fyOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* CMP-08 requests received from the Admin (hidden when there are none) */}
      <Gstr3bRequestsPanel returnType="CMP08" />

      {/* Info cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:16, marginBottom:28 }}>
        <InfoCard label="Business Name" value={profile?.business_name || '—'} />
        <InfoCard label="GSTIN" value={profile?.gstin || '—'} />
        <InfoCard label="Dealer Type" value="Composition Scheme" />
        <InfoCard label="Financial Year" value={fy} accent />
      </div>

      {/* Table */}
      {loading ? <LoadingBlock /> : (
        <div style={{ background:'#fff', borderRadius:10, border:'1px solid #e2e8f0', overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#1e3a5f', color:'#fff' }}>
                <th style={th}>#</th>
                <th style={th}>Quarter</th>
                <th style={th}>Due Date</th>
                <th style={th}>Status</th>
                <th style={th}>Filed On</th>
                <th style={{ ...th, textAlign:'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {(data?.periods || []).map((p, i) => (
                <tr key={p.period} style={{ borderBottom:'1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                  <td style={td}>{i + 1}</td>
                  <td style={{ ...td, fontWeight:600 }}>{p.quarter_label}</td>
                  <td style={td}>{p.due_date}</td>
                  <td style={td}><StatusBadge status={p.status} /></td>
                  <td style={td}>{p.filed_on || '—'}</td>
                  <td style={{ ...td, textAlign:'center' }}>
                    {p.prepared ? (
                      <button
                        onClick={() => navigate(`/portal/cmp-08/${p.period}`)}
                        style={{ padding:'5px 14px', background:'#1e3a5f', color:'#fff', border:'none', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer' }}
                      >
                        View Return
                      </button>
                    ) : (
                      <span style={{ color:'#94a3b8', fontSize:12 }}>Not yet available</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop:16, padding:'12px 16px', background:'#fef9c3', borderRadius:8, border:'1px solid #fde68a', fontSize:12, color:'#854d0e' }}>
        <strong>Note:</strong> CMP-08 is a quarterly statement cum challan for Composition Scheme taxpayers. You can review and confirm the return prepared by your CA. Filing is done by your CA after your confirmation.
      </div>
    </div>
  );
}

function InfoCard({ label, value, accent }) {
  return (
    <div style={{ background: accent ? '#eff6ff' : '#f8fafc', border:`1px solid ${accent ? '#bfdbfe' : '#e2e8f0'}`, borderRadius:8, padding:'14px 16px' }}>
      <div style={{ fontSize:11, color:'#64748b', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:15, fontWeight:700, color: accent ? '#1d4ed8' : '#1e293b' }}>{value}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   PERIOD DETAIL VIEW
══════════════════════════════════════════════ */
function PeriodDetailView({ period, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [checked, setChecked] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const json = await api(`/client/cmp08/period/${period}`);
      setData(json);
      if (json.client_confirmed_at) setConfirmed(true);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const handleConfirm = async () => {
    if (!checked) return;
    setConfirming(true);
    try {
      await api(`/client/cmp08/period/${period}/confirm`, { method: 'POST' });
      setConfirmed(true);
      setShowSuccess(true);
    } catch (e) {
      alert(e.message || 'Could not confirm the return.');
    } finally {
      setConfirming(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      // The PDF is a file, not JSON, so it is fetched directly (api() would try to parse it as JSON).
      const res = await fetch(`/api/client/cmp08/period/${period}/download`, {
        headers: { Accept: 'application/pdf', Authorization: `Bearer ${getAuthToken()}` },
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `CMP-08_${period}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <div style={{ padding:32 }}><LoadingBlock /></div>;
  if (!data) return <div style={{ padding:32, color:'#ef4444' }}>Failed to load period data.</div>;

  const s = data.summary || {};
  const ic = (d) => <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d}</svg>;
  const money = (v) => `₹ ${fmt(v)}`;
  const balancePositive = Number(s.balance_payable || 0) > 0;
  const summaryCards = [
    { label: 'Total Taxable Turnover', value: money(s.total_taxable_turnover), tone: ['#eef5ff', '#d2e2fb', '#cfe0ff', '#1d4ed8'], icon: ic(<><circle cx="12" cy="12" r="10" /><path d="M8 8h8M8 12h8M10 8c4 0 4 6 0 6H8l5 4" /></>) },
    { label: 'Tax Liability', value: money(s.tax_liability), tone: ['#f6f2ff', '#e0d4fa', '#e4d9fb', '#7c3aed'], icon: ic(<><rect x="4" y="2" width="16" height="20" rx="2" /><line x1="8" y1="6" x2="16" y2="6" /><line x1="8" y1="11" x2="8.01" y2="11" /><line x1="12" y1="11" x2="12.01" y2="11" /><line x1="16" y1="11" x2="16.01" y2="11" /><line x1="8" y1="16" x2="16" y2="16" /></>) },
    { label: 'Adjustments', value: money(s.adjustments), tone: ['#f0fbf4', '#cdeed9', '#c9efd7', '#15803d'], icon: ic(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><polyline points="9 15 11 17 15 13" /></>) },
    { label: 'Net Tax Payable', value: money(s.net_tax_payable), tone: ['#fff8ec', '#f9e3bc', '#fde4b8', '#d97706'], icon: ic(<><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></>) },
    { label: 'Tax Paid', value: money(s.tax_paid), tone: ['#eef5ff', '#d2e2fb', '#cfe0ff', '#1d4ed8'], icon: ic(<><ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6" /><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></>) },
    { label: 'Balance Payable', value: money(s.balance_payable), tone: balancePositive ? ['#fff3f3', '#f8d2d2', '#fbd5d5', '#dc2626'] : ['#f0fbf4', '#cdeed9', '#c9efd7', '#15803d'], icon: ic(<><circle cx="12" cy="12" r="10" /><path d="M8 8h8M8 12h8M10 8c4 0 4 6 0 6H8l5 4" /></>) },
  ];

  const stat = data.return_status;
  const chip = { Filed: ['#d9f3e3', '#15803d'], Confirmed: ['#dbeafe', '#1d4ed8'], Pending: ['#fdecc8', '#b45309'] }[stat] || ['#e8edf5', '#64748b'];

  const panel = { background: '#fff', border: '1px solid #dfe8f5', borderRadius: 16, overflow: 'hidden', marginBottom: 18, boxShadow: '0 14px 30px -26px rgba(15,42,95,.55)' };
  const TH = { background: '#e9f0fb', color: '#0f2a5f', fontWeight: 800, fontSize: 12.5, padding: '11px 12px', textAlign: 'center', borderBottom: '1px solid #d6e3f7', whiteSpace: 'nowrap' };
  const TD = { padding: '10px 12px', textAlign: 'center', fontSize: 12.5, color: '#1e293b', borderBottom: '1px solid #eef3fa' };
  const TOT = { ...TD, background: '#e3ecfa', fontWeight: 800, color: '#0f2a5f', fontSize: 13.5 };
  const Panel = ({ title, children, style }) => (
    <div style={{ ...panel, ...style }}>
      <div style={{ padding: '14px 18px 8px' }}><h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f2a5f' }}>{title}</h3></div>
      <div style={{ overflowX: 'auto', padding: '0 12px 12px' }}>{children}</div>
    </div>
  );
  const Tbl = ({ head, children, left = [] }) => (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead><tr>{head.map((h, i) => <th key={h} style={{ ...TH, textAlign: left.includes(i) ? 'left' : 'center' }}>{h}</th>)}</tr></thead>
      <tbody>{children}</tbody>
    </table>
  );

  const turnover = data.turnover || [];
  const adjustments = data.adjustments || [];
  const payments = data.payments || [];

  return (
    <div style={{ maxWidth: 1250 }}>
      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
        <span>GST Compliance</span><span>›</span>
        <button type="button" onClick={onBack} style={{ background: 'none', border: 'none', padding: 0, color: '#2563eb', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>CMP-08</button><span>›</span>
        <span style={{ color: '#1e293b', fontWeight: 800 }}>My Return</span>
      </div>

      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#0f2a5f', letterSpacing: '-0.01em' }}>CMP-08 – My Return</h1>
        <p style={{ margin: '3px 0 0', fontSize: 13.5, color: '#64748b' }}>View and review your CMP-08 return details.</p>
      </div>

      {/* Return information */}
      <div style={{ ...panel, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        {[
          ['Client Name', data.client?.business_name],
          ['GSTIN', data.client?.gstin],
          ['Registration Type', data.client?.registration_type],
          ['Tax Period', data.quarter_label],
          ['Due Date', data.due_date],
        ].map(([k, v]) => (
          <div key={k} style={{ minWidth: 120 }}>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{k}</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0f2a5f', marginTop: 2 }}>{v || '—'}</div>
          </div>
        ))}
        <div>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Return Status</div>
          <span style={{ display: 'inline-block', marginTop: 2, padding: '3px 14px', borderRadius: 8, background: chip[0], color: chip[1], fontSize: 12.5, fontWeight: 800 }}>{stat}</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, background: data.prepared_by_ca ? '#e8f8ee' : '#f1f5f9', border: `1px solid ${data.prepared_by_ca ? '#bbf0cf' : '#e2e8f0'}`, borderRadius: 12, padding: '8px 14px' }}>
          <span style={{ width: 28, height: 28, borderRadius: '50%', background: data.prepared_by_ca ? '#16a34a' : '#94a3b8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </span>
          <div style={{ lineHeight: 1.25 }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: data.prepared_by_ca ? '#15803d' : '#475569' }}>{data.prepared_by_ca ? 'Prepared by CA' : 'Not prepared yet'}</div>
            <div style={{ fontSize: 10.5, color: '#64748b' }}>{data.prepared_by_ca ? 'Data prepared and verified by your CA.' : 'Your CA has not prepared this return yet.'}</div>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 12, marginBottom: 18 }} className="g2b-tiles">
        {summaryCards.map((c) => (
          <div key={c.label} style={{ background: c.tone[0], border: `1px solid ${c.tone[1]}`, borderRadius: 14, padding: '14px 14px', display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span style={{ width: 46, height: 46, borderRadius: 12, background: c.tone[2], color: c.tone[3], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{c.icon}</span>
            <div style={{ minWidth: 0, lineHeight: 1.25 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#334155' }}>{c.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: c.tone[3], whiteSpace: 'nowrap' }}>{c.value}</div>
            </div>
          </div>
        ))}
      </div>

      <Panel title="1. Turnover & Tax Liability Details">
        <Tbl head={['#', 'Particulars', 'Taxable Value (₹)', 'Applicable Rate', 'Tax Amount (₹)', 'Remarks']} left={[1]}>
          {turnover.map((r, i) => (
            <tr key={i}>
              <td style={TD}>{i + 1}</td><td style={{ ...TD, textAlign: 'left', fontWeight: 700 }}>{r.particulars}</td>
              <td style={TD}>{fmt(r.taxable_value)}</td><td style={TD}>{r.rate != null ? `${Number(r.rate).toFixed(2)}%` : '—'}</td>
              <td style={TD}>{fmt(r.tax_amount)}</td><td style={TD}>{r.remarks || '-'}</td>
            </tr>
          ))}
          {!turnover.length && <tr><td colSpan={6} style={{ ...TD, padding: 24, color: '#94a3b8' }}>No turnover details yet.</td></tr>}
          <tr><td style={TOT} /><td style={{ ...TOT, textAlign: 'left' }}>Total</td><td style={TOT}>{fmt(s.total_taxable_turnover)}</td><td style={TOT} /><td style={TOT}>{fmt(s.tax_liability)}</td><td style={TOT} /></tr>
        </Tbl>
      </Panel>

      <Panel title="2. Adjustment Details">
        <Tbl head={['#', 'Particulars', 'Tax Amount (₹)', 'CGST (₹)', 'SGST (₹)', 'Total (₹)', 'Remarks']} left={[1]}>
          {adjustments.map((r, i) => (
            <tr key={i}>
              <td style={TD}>{i + 1}</td><td style={{ ...TD, textAlign: 'left', fontWeight: 700 }}>{r.particulars}</td>
              <td style={TD}>{fmt(r.tax_amount)}</td><td style={TD}>{fmt(r.cgst)}</td><td style={TD}>{fmt(r.sgst)}</td><td style={TD}>{fmt(r.total)}</td><td style={TD}>{r.remarks || '-'}</td>
            </tr>
          ))}
          {!adjustments.length && <tr><td colSpan={7} style={{ ...TD, padding: 24, color: '#94a3b8' }}>No adjustments.</td></tr>}
          <tr><td style={TOT} /><td style={{ ...TOT, textAlign: 'left' }}>Total Adjustment</td><td style={TOT} /><td style={TOT} /><td style={TOT} /><td style={TOT}>{fmt(s.adjustments)}</td><td style={TOT} /></tr>
        </Tbl>
      </Panel>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.5fr)', gap: 18 }} className="cmp-two">
        <Panel title="3. Net Tax Payable">
          <Tbl head={['Particulars', 'Amount']} left={[0]}>
            {[['Total Tax Liability', fmt(s.tax_liability)], ['Add / Less: Adjustments', fmt(s.adjustments)]].map(([k, v]) => (
              <tr key={k}><td style={{ ...TD, textAlign: 'left' }}>{k}</td><td style={TD}>{v}</td></tr>
            ))}
            <tr><td style={{ ...TOT, textAlign: 'left' }}>Net Tax Payable</td><td style={TOT}>{fmt(s.net_tax_payable)}</td></tr>
            <tr><td style={{ ...TD, textAlign: 'left' }}>Less: Tax Paid</td><td style={TD}>{fmt(s.tax_paid)}</td></tr>
            <tr><td style={{ ...TOT, textAlign: 'left' }}>Balance Payable</td><td style={{ ...TOT, color: balancePositive ? '#dc2626' : '#15803d' }}>{fmt(s.balance_payable)}</td></tr>
          </Tbl>
        </Panel>

        <Panel title="4. Tax Payment Details">
          <Tbl head={['#', 'Payment Date', 'Challan No.', 'Mode of Payment', 'Amount Paid (₹)', 'Remarks']}>
            {payments.map((r, i) => (
              <tr key={i}><td style={TD}>{i + 1}</td><td style={TD}>{r.payment_date || '—'}</td><td style={TD}>{r.challan_no || '—'}</td><td style={TD}>{r.mode || '—'}</td><td style={TD}>{fmt(r.amount)}</td><td style={TD}>{r.remarks || '-'}</td></tr>
            ))}
            {!payments.length && <tr><td colSpan={6} style={{ ...TD, padding: 24, color: '#94a3b8' }}>No payments recorded yet.</td></tr>}
            <tr><td style={TOT} /><td style={TOT} /><td style={TOT} /><td style={{ ...TOT, textAlign: 'left' }}>Total Tax Paid</td><td style={TOT}>{fmt(s.tax_paid)}</td><td style={TOT} /></tr>
          </Tbl>
        </Panel>
      </div>

      {data.remarks && (
        <div style={{ padding: '12px 16px', background: '#fff8e8', border: '1px solid #f6dd9b', borderRadius: 12, marginBottom: 18, fontSize: 13, color: '#7a4a00' }}>
          <strong>CA Remarks:</strong> {data.remarks}
        </div>
      )}

      {/* Confirmation bar — the client can only review, confirm and download */}
      {data.return_status === 'Filed' || confirmed ? (
        <div style={{ ...panel, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', background: data.return_status === 'Filed' ? '#eaf3ff' : '#e8f8ee', borderColor: data.return_status === 'Filed' ? '#cfe2ff' : '#bbf0cf' }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: data.return_status === 'Filed' ? '#1d4ed8' : '#15803d' }}>
            {data.return_status === 'Filed' ? `Return Filed${data.filed_on ? ` on ${data.filed_on}` : ''}${data.arn ? ` · ARN: ${data.arn}` : ''}` : `Confirmed by Client${data.client_confirmed_at ? ` on ${data.client_confirmed_at}` : ''}`}
          </div>
          <button type="button" onClick={handleDownload} disabled={downloading} style={{ height: 40, padding: '0 20px', borderRadius: 10, border: '1px solid #bfd3f6', background: '#fff', color: '#1d4ed8', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            {downloading ? 'Downloading…' : 'Download CMP-08 Summary'}
          </button>
        </div>
      ) : (
        <div style={{ ...panel, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', background: '#f3f8ff' }}>
          <span style={{ width: 34, height: 34, borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><line x1="12" y1="11" x2="12" y2="17" /><line x1="12" y1="7" x2="12.01" y2="7" /></svg>
          </span>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontWeight: 800, fontSize: 13.5, color: '#0f2a5f' }}>Please review the details and confirm.</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Contact your CA if any correction is required.</div>
          </div>
          {data.prepared_by_ca ? (
            <>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#334155', cursor: 'pointer' }}>
                <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#2563eb' }} />
                I have reviewed the above details
              </label>
              <button type="button" onClick={handleConfirm} disabled={!checked || confirming}
                style={{ height: 42, padding: '0 26px', borderRadius: 10, border: 'none', background: checked ? 'linear-gradient(135deg,#2563eb,#1d4ed8)' : '#a9b8d4', color: '#fff', fontWeight: 800, fontSize: 13.5, cursor: checked ? 'pointer' : 'not-allowed', boxShadow: checked ? '0 10px 16px -10px rgba(29,78,216,.85)' : 'none' }}>
                {confirming ? 'Confirming…' : 'Review & Confirm'}
              </button>
            </>
          ) : (
            <span style={{ fontSize: 12.5, color: '#64748b', fontWeight: 600 }}>You can confirm once your CA has prepared this return.</span>
          )}
          <button type="button" onClick={handleDownload} disabled={downloading} style={{ height: 42, padding: '0 20px', borderRadius: 10, border: '1px solid #bfd3f6', background: '#fff', color: '#1d4ed8', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            {downloading ? 'Downloading…' : 'Download CMP-08 Summary'}
          </button>
        </div>
      )}

      {showSuccess && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 18, padding: '32px 38px', maxWidth: 400, textAlign: 'center', boxShadow: '0 30px 60px -20px rgba(15,42,95,.5)' }}>
            <div style={{ width: 60, height: 60, background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <h3 style={{ margin: '0 0 8px', color: '#0f2a5f', fontSize: 19, fontWeight: 800 }}>Return Confirmed!</h3>
            <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: 13.5 }}>Your CMP-08 return has been confirmed. Your CA will now proceed with the filing.</p>
            <button type="button" onClick={() => setShowSuccess(false)} style={{ height: 40, padding: '0 34px', background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800, cursor: 'pointer', fontSize: 14 }}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
}

const th = { padding:'10px 12px', textAlign:'left', fontWeight:600, fontSize:12, whiteSpace:'nowrap' };
const td = { padding:'9px 12px', color:'#374151', fontSize:12 };

/* ══════════════════════════════════════════════
   MAIN PAGE — router-aware
══════════════════════════════════════════════ */
export default function ClientCmp08Page() {
  const { period } = useParams();
  const navigate = useNavigate();
  const [fy, setFy] = useState(currentFyLabel());

  if (period) {
    return <PeriodDetailView period={period} onBack={() => navigate('/portal/cmp-08')} />;
  }

  return <PeriodsView fy={fy} setFy={setFy} />;
}
