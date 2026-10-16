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
  const summaryCards = [
    { label: 'Total Taxable Turnover', value: fmt(s.total_taxable_turnover), color: '#eff6ff', textColor: '#1d4ed8' },
    { label: 'Tax Liability', value: fmt(s.tax_liability), color: '#fef9c3', textColor: '#854d0e' },
    { label: 'Adjustments', value: fmt(s.adjustments), color: '#fef3c7', textColor: '#92400e' },
    { label: 'Net Tax Payable', value: fmt(s.net_tax_payable), color: '#fee2e2', textColor: '#b91c1c' },
    { label: 'Tax Paid', value: fmt(s.tax_paid), color: '#dcfce7', textColor: '#166534' },
    { label: 'Balance Payable', value: fmt(s.balance_payable), color: s.balance_payable > 0 ? '#fee2e2' : '#dcfce7', textColor: s.balance_payable > 0 ? '#b91c1c' : '#166534' },
  ];

  const statusColor = { Filed:'#166534', Confirmed:'#1d4ed8', Pending:'#854d0e', Upcoming:'#64748b' };
  const statusBg    = { Filed:'#dcfce7', Confirmed:'#dbeafe', Pending:'#fef9c3', Upcoming:'#f1f5f9' };

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
      {/* Back */}
      <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', color:'#1e3a5f', fontWeight:600, fontSize:13, cursor:'pointer', marginBottom:20, padding:0 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        Back to CMP-08 Returns
      </button>

      {/* Return Info Bar */}
      <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, padding:'16px 20px', marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8, marginBottom:12 }}>
          <h2 style={{ margin:0, fontSize:17, fontWeight:700, color:'#1e3a5f' }}>
            CMP-08 — {data.quarter_label}
          </h2>
          <span style={{ padding:'3px 12px', borderRadius:12, fontSize:12, fontWeight:600, background: statusBg[data.return_status] || '#f1f5f9', color: statusColor[data.return_status] || '#64748b' }}>
            {data.return_status}
          </span>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:10 }}>
          {[
            ['Client Name', data.client?.business_name],
            ['GSTIN', data.client?.gstin],
            ['Registration Type', data.client?.registration_type],
            ['Tax Period', data.quarter_label],
            ['Due Date', data.due_date],
            ['Prepared by CA', data.prepared_by_ca ? 'Yes' : 'No'],
            data.client_confirmed_at && ['Confirmed On', data.client_confirmed_at],
            data.filed_on && ['Filed On', data.filed_on],
            data.arn && ['ARN', data.arn],
          ].filter(Boolean).map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize:10, color:'#94a3b8', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>{k}</div>
              <div style={{ fontSize:13, fontWeight:600, color:'#1e293b', marginTop:2 }}>{v || '—'}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:14, marginBottom:24 }}>
        {summaryCards.map(c => (
          <div key={c.label} style={{ background:c.color, borderRadius:8, padding:'14px 16px', border:'1px solid rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize:11, color:c.textColor, opacity:0.8, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:6 }}>{c.label}</div>
            <div style={{ fontSize:18, fontWeight:700, color:c.textColor }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Section 1: Turnover */}
      <SectionTable
        title="Section 1 — Details of Outward Supplies"
        subtitle="Taxable turnover for the quarter"
        columns={['#', 'Particulars', 'Taxable Value (₹)', 'Rate (%)', 'Tax Amount (₹)', 'Remarks']}
        rows={(data.turnover || []).map((r, i) => [
          i + 1, r.particulars, fmt(r.taxable_value), r.rate ?? '—', fmt(r.tax_amount), r.remarks || '—'
        ])}
        totals={[null, 'Total', fmt(s.total_taxable_turnover), null, fmt(s.tax_liability), null]}
      />

      {/* Section 2: Adjustments */}
      <SectionTable
        title="Section 2 — Adjustments"
        subtitle="Tax adjustments for the quarter"
        columns={['#', 'Particulars', 'Tax Amount (₹)', 'CGST (₹)', 'SGST (₹)', 'Total (₹)', 'Remarks']}
        rows={(data.adjustments || []).map((r, i) => [
          i + 1, r.particulars, fmt(r.tax_amount), fmt(r.cgst), fmt(r.sgst), fmt(r.total), r.remarks || '—'
        ])}
        totals={[null, 'Total', null, null, null, fmt(s.adjustments), null]}
      />

      {/* Section 3: Net Tax Payable */}
      <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, marginBottom:20, overflow:'hidden' }}>
        <div style={{ padding:'12px 16px', borderBottom:'1px solid #e2e8f0' }}>
          <h3 style={{ margin:0, fontSize:14, fontWeight:700, color:'#1e3a5f' }}>Section 3 — Net Tax Payable</h3>
        </div>
        <div style={{ padding:'16px', display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:12 }}>
          {[
            ['Tax Liability', fmt(s.tax_liability)],
            ['+/− Adjustments', fmt(s.adjustments)],
            ['= Net Tax Payable', fmt(s.net_tax_payable), true],
          ].map(([k, v, bold]) => (
            <div key={k} style={{ background: bold ? '#eff6ff' : '#f8fafc', borderRadius:8, padding:'12px 14px', border:`1px solid ${bold ? '#bfdbfe' : '#e2e8f0'}` }}>
              <div style={{ fontSize:11, color:'#64748b', fontWeight:600, textTransform:'uppercase', marginBottom:4 }}>{k}</div>
              <div style={{ fontSize:16, fontWeight: bold ? 700 : 600, color: bold ? '#1d4ed8' : '#1e293b' }}>₹ {v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 4: Tax Payment */}
      {(data.payments || []).length > 0 && (
        <SectionTable
          title="Section 4 — Tax Payment Details"
          subtitle="Challans paid for this quarter"
          columns={['#', 'Payment Date', 'Challan No.', 'Mode', 'Amount (₹)', 'Remarks']}
          rows={(data.payments || []).map((r, i) => [
            i + 1, r.payment_date || '—', r.challan_no || '—', r.mode || '—', fmt(r.amount), r.remarks || '—'
          ])}
          totals={[null, null, null, 'Total Paid', fmt(s.tax_paid), null]}
        />
      )}

      {/* Balance Payable */}
      {s.balance_payable > 0 && (
        <div style={{ padding:'12px 16px', background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:8, marginBottom:20, fontSize:13, color:'#b91c1c', fontWeight:600 }}>
          Balance Payable: ₹ {fmt(s.balance_payable)} — Please pay via GSTN portal before the due date.
        </div>
      )}

      {/* CA Remarks */}
      {data.remarks && (
        <div style={{ padding:'12px 16px', background:'#fef9c3', border:'1px solid #fde68a', borderRadius:8, marginBottom:20, fontSize:13, color:'#854d0e' }}>
          <strong>CA Remarks:</strong> {data.remarks}
        </div>
      )}

      {/* Bottom Action Bar */}
      {!confirmed && data.prepared_by_ca && data.return_status !== 'Filed' && (
        <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, padding:'16px 20px', display:'flex', alignItems:'flex-start', gap:16, flexWrap:'wrap' }}>
          <label style={{ display:'flex', alignItems:'flex-start', gap:10, flex:1, cursor:'pointer' }}>
            <input
              type="checkbox"
              checked={checked}
              onChange={e => setChecked(e.target.checked)}
              style={{ marginTop:3, accentColor:'#1e3a5f', width:16, height:16, flexShrink:0 }}
            />
            <span style={{ fontSize:13, color:'#374151', lineHeight:1.5 }}>
              I have reviewed the above CMP-08 return details and confirm that the information is correct to the best of my knowledge. I authorise my CA to proceed with the filing.
            </span>
          </label>
          <div style={{ display:'flex', gap:12, flexShrink:0 }}>
            <button
              onClick={handleDownload}
              disabled={downloading}
              style={{ padding:'9px 18px', background:'#f8fafc', color:'#1e3a5f', border:'1px solid #cbd5e1', borderRadius:7, fontSize:13, fontWeight:600, cursor:'pointer' }}
            >
              {downloading ? 'Downloading…' : 'Download Summary'}
            </button>
            <button
              onClick={handleConfirm}
              disabled={!checked || confirming}
              style={{ padding:'9px 20px', background: checked ? '#1e3a5f' : '#94a3b8', color:'#fff', border:'none', borderRadius:7, fontSize:13, fontWeight:600, cursor: checked ? 'pointer' : 'not-allowed' }}
            >
              {confirming ? 'Confirming…' : 'Review & Confirm'}
            </button>
          </div>
        </div>
      )}

      {confirmed && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12, background:'#dcfce7', border:'1px solid #86efac', borderRadius:10, padding:'14px 20px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span style={{ fontSize:14, fontWeight:700, color:'#166534' }}>Return Confirmed</span>
            {data.client_confirmed_at && <span style={{ fontSize:12, color:'#166534', opacity:0.8 }}>on {data.client_confirmed_at}</span>}
          </div>
          <button
            onClick={handleDownload}
            disabled={downloading}
            style={{ padding:'8px 16px', background:'#166534', color:'#fff', border:'none', borderRadius:7, fontSize:13, fontWeight:600, cursor:'pointer' }}
          >
            {downloading ? 'Downloading…' : 'Download Summary'}
          </button>
        </div>
      )}

      {data.return_status === 'Filed' && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12, background:'#dbeafe', border:'1px solid #93c5fd', borderRadius:10, padding:'14px 20px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 11 2 2 4-4"/></svg>
            <span style={{ fontSize:14, fontWeight:700, color:'#1d4ed8' }}>Return Filed</span>
            {data.filed_on && <span style={{ fontSize:12, color:'#1d4ed8', opacity:0.8 }}>on {data.filed_on}</span>}
            {data.arn && <span style={{ fontSize:12, color:'#1d4ed8' }}>ARN: {data.arn}</span>}
          </div>
          <button
            onClick={handleDownload}
            disabled={downloading}
            style={{ padding:'8px 16px', background:'#1d4ed8', color:'#fff', border:'none', borderRadius:7, fontSize:13, fontWeight:600, cursor:'pointer' }}
          >
            {downloading ? 'Downloading…' : 'Download Summary'}
          </button>
        </div>
      )}

      {/* Success Popup */}
      {showSuccess && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 }}>
          <div style={{ background:'#fff', borderRadius:12, padding:'32px 40px', maxWidth:400, textAlign:'center', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ width:56, height:56, background:'#dcfce7', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h3 style={{ margin:'0 0 8px', color:'#1e293b', fontSize:18 }}>Return Confirmed!</h3>
            <p style={{ margin:'0 0 20px', color:'#64748b', fontSize:13 }}>Your CMP-08 return has been confirmed. Your CA will now proceed with the filing.</p>
            <button
              onClick={() => setShowSuccess(false)}
              style={{ padding:'9px 28px', background:'#1e3a5f', color:'#fff', border:'none', borderRadius:7, fontWeight:600, cursor:'pointer', fontSize:14 }}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionTable({ title, subtitle, columns, rows, totals }) {
  return (
    <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, marginBottom:20, overflow:'hidden' }}>
      <div style={{ padding:'12px 16px', borderBottom:'1px solid #e2e8f0' }}>
        <h3 style={{ margin:0, fontSize:14, fontWeight:700, color:'#1e3a5f' }}>{title}</h3>
        {subtitle && <p style={{ margin:'2px 0 0', fontSize:12, color:'#64748b' }}>{subtitle}</p>}
      </div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead>
            <tr style={{ background:'#1e3a5f', color:'#fff' }}>
              {columns.map(c => <th key={c} style={th}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ borderBottom:'1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                {row.map((cell, j) => <td key={j} style={{ ...td, textAlign: j >= 2 ? 'right' : 'left' }}>{cell}</td>)}
              </tr>
            ))}
            {totals && (
              <tr style={{ background:'#eff6ff', fontWeight:700, borderTop:'2px solid #bfdbfe' }}>
                {totals.map((cell, j) => <td key={j} style={{ ...td, textAlign: j >= 2 ? 'right' : 'left', color:'#1d4ed8' }}>{cell || ''}</td>)}
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
