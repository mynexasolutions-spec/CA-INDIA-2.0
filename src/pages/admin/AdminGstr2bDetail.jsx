import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/client';

const FMT_YR = ['2026-27', '2025-26', '2027-28'];

const shortPeriod = p => {
  if (!p) return '';
  if (p.includes('-Q')) {
    const [y, q] = p.split('-Q');
    const labels = { '1': `Q1 (Apr–Jun ${y})`, '2': `Q2 (Jul–Sep ${y})`, '3': `Q3 (Oct–Dec ${y})`, '4': `Q4 (Jan–Mar ${+y+1})` };
    return labels[q] ?? p;
  }
  const [yr, mo] = p.split('-');
  return new Date(yr, mo - 1, 1).toLocaleString('en-IN', { month: 'short', year: 'numeric' });
};

export default function AdminGstr2bDetail() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [fy, setFy]           = useState('2026-27');

  const load = () => {
    setLoading(true);
    api(`/admin/clients/${clientId}/gstr2b/periods`)
      .then(setData).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [clientId]);

  if (loading) return <div style={{ padding: 40, color: '#94a3b8', textAlign: 'center' }}>Loading...</div>;
  if (!data)   return null;

  const { client, frequency, periods } = data;
  const isQuarterly = frequency === 'quarterly';
  const freqLabel   = isQuarterly ? 'Quarterly' : 'Monthly';

  const statusBadge = status => {
    if (status === 'matched')
      return <span style={{ padding:'3px 14px', borderRadius:20, fontSize:12, fontWeight:600, background:'#dcfce7', color:'#16a34a' }}>Matched</span>;
    return <span style={{ padding:'3px 14px', borderRadius:20, fontSize:12, fontWeight:500, background:'#f1f5f9', color:'#64748b', border:'1px solid #e2e8f0' }}>Pending</span>;
  };

  return (
    <div style={{ fontFamily:"'Inter',system-ui,sans-serif", padding:'0 0 48px' }}>

      {/* Breadcrumb */}
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10, fontSize:13 }}>
        <Link to="/admin/gst-returns?tab=gstr-2b" style={bcLink}>GST Compliance</Link>
        <BcSep/>
        <Link to="/admin/gst-returns?tab=gstr-2b" style={bcLink}>GSTR-2B</Link>
        <BcSep/>
        <span style={{ color:'#374151' }}>{client.business_name}</span>
      </div>

      {/* Page Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
        <div>
          <h1 style={{ margin:0, fontSize:26, fontWeight:700, color:'#1e3a5f', lineHeight:1.2 }}>
            GSTR-2B – {client.business_name}
          </h1>
          <div style={{ marginTop:6, fontSize:13, color:'#64748b', display:'flex', gap:12, alignItems:'center' }}>
            <span>GSTIN: <strong style={{ color:'#1e293b' }}>{client.gstin || '—'}</strong></span>
            <span style={{ color:'#cbd5e1' }}>|</span>
            <span>Filing Frequency: <strong style={{ color:'#2563eb' }}>{freqLabel}</strong></span>
            <span style={{ color:'#cbd5e1' }}>|</span>
            <span>Status:&nbsp;
              <span style={{ padding:'2px 12px', borderRadius:20, fontSize:12, fontWeight:600, background:'#dcfce7', color:'#16a34a' }}>
                {client.is_active ? 'Active' : 'Inactive'}
              </span>
            </span>
          </div>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={() => navigate('/admin/gst-returns?tab=gstr-2b')}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', background:'#fff', border:'1.5px solid #e2e8f0', borderRadius:8, fontSize:13, fontWeight:600, color:'#374151', cursor:'pointer' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            Back to Client List
          </button>
          <button style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', background:'#fff', border:'1.5px solid #e2e8f0', borderRadius:8, fontSize:13, fontWeight:600, color:'#374151', cursor:'pointer' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            User Guide
          </button>
        </div>
      </div>

      {/* Period Table Card */}
      <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, overflow:'hidden', marginTop:20 }}>
        {/* Card Header */}
        <div style={{ padding:'14px 20px', borderBottom:'1px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontWeight:700, fontSize:15, color:'#1e3a5f' }}>GSTR-2B – {freqLabel}</div>
            <div style={{ fontSize:12.5, color:'#64748b', marginTop:2 }}>
              View, reconcile and track GSTR-2B details for each {isQuarterly ? 'quarter' : 'month'}.
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:13 }}>
            <span style={{ color:'#64748b' }}>Financial Year</span>
            <select value={fy} onChange={e => setFy(e.target.value)}
              style={{ padding:'6px 28px 6px 10px', border:'1.5px solid #e2e8f0', borderRadius:7, fontSize:13, color:'#1e293b', background:'#fff', cursor:'pointer', appearance:'none' }}>
              {FMT_YR.map(y => <option key={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {/* Table */}
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13.5 }}>
          <thead>
            <tr>
              {['#','Period','Due Date','Reconciliation Status','Total Invoices','Matched','Unmatched','Action'].map(h => (
                <th key={h} style={{
                  padding:'11px 16px',
                  textAlign: ['Total Invoices','Matched','Unmatched'].includes(h) ? 'center' : 'left',
                  fontWeight:700, color:'#1e3a5f', fontSize:13,
                  borderBottom:'1.5px solid #e5e7eb', background:'#fff', whiteSpace:'nowrap'
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((p, i) => (
              <tr key={p.period} style={{ borderBottom:'1px solid #f1f5f9' }}
                onMouseEnter={e => e.currentTarget.style.background='#fafbfc'}
                onMouseLeave={e => e.currentTarget.style.background=''}>
                <td style={{ padding:'12px 16px', color:'#374151' }}>{i + 1}</td>
                <td style={{ padding:'12px 16px', fontWeight:600, color:'#1e293b' }}>{shortPeriod(p.period)}</td>
                <td style={{ padding:'12px 16px', color:'#374151' }}>{p.due_date}</td>
                <td style={{ padding:'12px 16px' }}>{statusBadge(p.recon_status)}</td>
                <td style={{ padding:'12px 16px', textAlign:'center', color:'#374151' }}>{p.total_invoices}</td>
                <td style={{ padding:'12px 16px', textAlign:'center', color: p.matched > 0 ? '#16a34a' : '#374151', fontWeight: p.matched > 0 ? 600 : 400 }}>{p.matched}</td>
                <td style={{ padding:'12px 16px', textAlign:'center', color: p.unmatched > 0 ? '#dc2626' : '#374151', fontWeight: p.unmatched > 0 ? 600 : 400 }}>{p.unmatched}</td>
                <td style={{ padding:'12px 16px' }}>
                  <button onClick={() => navigate(`/admin/gst-returns/gstr-2b/${clientId}/period/${p.period}`)}
                    style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 16px', background:'#fff', border:'1.5px solid #bfdbfe', borderRadius:7, fontSize:13, fontWeight:600, color:'#2563eb', cursor:'pointer' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer */}
        <div style={{ padding:'12px 20px', borderTop:'1px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:13, fontWeight:600, color:'#2563eb' }}>
            Showing 1 to {periods.length} of {periods.length} records
          </span>
          <div style={{ display:'flex', gap:4, alignItems:'center' }}>
            <PgBtn disabled><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg></PgBtn>
            <PgBtn active>1</PgBtn>
            <PgBtn disabled><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg></PgBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

const bcLink = { color:'#2563eb', textDecoration:'none', fontWeight:500 };
const BcSep  = () => <span style={{ color:'#94a3b8' }}>›</span>;

const PgBtn = ({ children, active, disabled, onClick }) => (
  <button onClick={onClick} disabled={disabled} style={{
    minWidth:34, height:34, padding:'0 8px', border:'1.5px solid',
    borderColor: active ? '#2563eb' : '#e2e8f0',
    borderRadius:7,
    background: active ? '#2563eb' : disabled ? '#f8fafc' : '#fff',
    color: active ? '#fff' : disabled ? '#94a3b8' : '#374151',
    cursor: disabled ? 'default' : 'pointer',
    fontSize:13, fontWeight: active ? 700 : 500,
    display:'flex', alignItems:'center', justifyContent:'center',
  }}>{children}</button>
);
