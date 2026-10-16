import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api, getAuthToken } from '../../api/client';
import { useReportsEnv } from './ReportsContext';
import { currentFyRange } from './billingUtils';

/* ── helpers ── */
const fmtDate = (s) => {
  if (!s) return '—';
  const d = new Date(s);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${String(d.getDate()).padStart(2,'0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

const DOC_PATH_MAP = {
  tax_invoice:      '/portal/billing/invoices',
  bill_of_supply:   '/portal/billing/bill-of-supply',
  debit_note:       '/portal/billing/debit-notes',
  credit_note:      '/portal/billing/credit-notes',
  quotation:        '/portal/billing/quotation',
  delivery_challan: '/portal/billing/delivery-challan',
};

/* Extracts the numeric suffix from a document number for sequential gap detection */
function extractSeq(number) {
  const m = number?.match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
}

/* Extracts the alphabetic prefix part */
function extractPrefix(number) {
  const m = number?.match(/^([A-Za-z\-_\/]+)/);
  return m ? m[1].replace(/[-_/]$/, '') : '';
}

/* Build full sequence including gap rows between a start and end number */
function buildSequenceWithGaps(docs) {
  if (!docs.length) return docs;
  const prefixStr = extractPrefix(docs[0].number);
  const padLen    = docs[0].number?.match(/(\d+)$/)?.[1]?.length ?? 3;
  const map       = Object.fromEntries(docs.map((d) => [d.number, d]));
  const nums      = docs.map((d) => extractSeq(d.number)).filter((n) => n != null);
  if (!nums.length) return docs;
  const min = Math.min(...nums);
  const max = Math.max(...nums);

  const result = [];
  for (let i = min; i <= max; i++) {
    const numStr = String(i).padStart(padLen, '0');
    const fullNum = prefixStr ? `${prefixStr}-${numStr}` : numStr;
    if (map[fullNum]) {
      result.push({ ...map[fullNum], missing: false });
    } else {
      result.push({ id: null, number: fullNum, document_date: null, status: null, created_at: null, filing_status: null, missing: true });
    }
  }
  return result;
}

/* ── Status badge ── */
const DocStatusBadge = ({ status }) => {
  const map = {
    issued:    { bg:'#eff6ff', color:'#2563eb', label:'Issued' },
    paid:      { bg:'#f0fdf4', color:'#16a34a', label:'Paid' },
    partial:   { bg:'#fef9c3', color:'#854d0e', label:'Partial' },
    cancelled: { bg:'#fef2f2', color:'#ef4444', label:'Cancelled' },
    draft:     { bg:'#f8fafc', color:'#64748b', label:'Draft' },
  };
  const s = map[status] || { bg:'#f8fafc', color:'#94a3b8', label: status || '—' };
  return <span style={{ background:s.bg, color:s.color, padding:'2px 8px', borderRadius:8, fontSize:11, fontWeight:600 }}>{s.label}</span>;
};

/* ── Drill-Down Modal ── */
function DrillDownModal({ typeKey, typeLabel, from, to, onClose }) {
  const env = useReportsEnv();
  const [docs,    setDocs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');

  useEffect(() => {
    setLoading(true);
    api(`${env.drillApi}?document_type=${typeKey}&from=${from}&to=${to}`)
      .then((d) => setDocs(d.documents || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [typeKey, from, to]);

  const withGaps  = buildSequenceWithGaps(docs);
  const filtered  = search
    ? withGaps.filter((d) => d.number?.toLowerCase().includes(search.toLowerCase()))
    : withGaps;

  const missing   = withGaps.filter((d) => d.missing).length;
  const docPath   = DOC_PATH_MAP[typeKey];

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:16 }}>
      <div style={{ background:'#fff', borderRadius:14, width:'100%', maxWidth:780, maxHeight:'90vh', display:'flex', flexDirection:'column', boxShadow:'0 20px 60px rgba(0,0,0,0.25)' }}>
        {/* Modal Header */}
        <div style={{ padding:'16px 20px', borderBottom:'1px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <h3 style={{ margin:0, fontSize:15, fontWeight:800, color:'#1e3a5f' }}>{typeLabel} — Document Sequence</h3>
            <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>
              {fmtDate(from)} – {fmtDate(to)} &nbsp;·&nbsp;
              <span style={{ color:'#1e293b', fontWeight:600 }}>{docs.length}</span> documents
              {missing > 0 && <span style={{ color:'#ef4444', marginLeft:6 }}>· <strong>{missing}</strong> missing</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:22, color:'#94a3b8', lineHeight:1 }}>×</button>
        </div>

        {/* Search */}
        <div style={{ padding:'12px 20px', borderBottom:'1px solid #f1f5f9' }}>
          <input
            className="bp-input"
            style={{ height:36, padding:'0 12px', width:'100%', maxWidth:260, fontSize:13 }}
            placeholder={`Search ${typeLabel} number…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Table */}
        <div style={{ flex:1, overflowY:'auto', padding:'0 0 8px' }}>
          {loading ? (
            <div style={{ padding:40, textAlign:'center', color:'#94a3b8', fontSize:13 }}>Loading…</div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead style={{ position:'sticky', top:0, zIndex:1 }}>
                <tr style={{ background:'#1e3a5f', color:'#fff' }}>
                  <th style={th}>#</th>
                  <th style={th}>Document No.</th>
                  <th style={th}>Document Date</th>
                  <th style={th}>Status</th>
                  <th style={th}>Created On</th>
                  <th style={th}>Filing Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan="6" style={{ textAlign:'center', padding:24, color:'#94a3b8' }}>No documents found.</td></tr>
                ) : (
                  filtered.map((doc, i) => doc.missing ? (
                    <tr key={doc.number} style={{ background:'#fff5f5', borderBottom:'1px solid #fee2e2' }}>
                      <td style={{ ...td, color:'#94a3b8', textAlign:'center' }}>{i + 1}</td>
                      <td style={{ ...td, color:'#ef4444', fontWeight:700 }}>{doc.number}</td>
                      <td style={td}>—</td>
                      <td style={td}>
                        <span style={{ background:'#fee2e2', color:'#b91c1c', padding:'2px 8px', borderRadius:8, fontSize:11, fontWeight:700 }}>Missing</span>
                      </td>
                      <td style={td}>—</td>
                      <td style={td}>—</td>
                    </tr>
                  ) : (
                    <tr key={doc.id} style={{ borderBottom:'1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                      <td style={{ ...td, color:'#94a3b8', textAlign:'center' }}>{i + 1}</td>
                      <td style={td}>
                        {docPath && env.docLink(typeKey, doc.id) ? (
                          <Link to={env.docLink(typeKey, doc.id)} style={{ color:'#2563eb', fontWeight:700, textDecoration:'none' }} onClick={onClose}>
                            {doc.number}
                          </Link>
                        ) : (
                          <span style={{ fontWeight:700, color:'#1e293b' }}>{doc.number}</span>
                        )}
                      </td>
                      <td style={td}>{doc.document_date || '—'}</td>
                      <td style={td}><DocStatusBadge status={doc.status} /></td>
                      <td style={{ ...td, color:'#64748b' }}>{doc.created_at || '—'}</td>
                      <td style={td}>
                        {doc.filing_status === 'filed'
                          ? <span style={{ background:'#f0fdf4', color:'#16a34a', padding:'2px 8px', borderRadius:8, fontSize:11, fontWeight:600 }}>Filed</span>
                          : <span style={{ background:'#f8fafc', color:'#94a3b8', padding:'2px 8px', borderRadius:8, fontSize:11, fontWeight:600 }}>Not Filed</span>
                        }
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer note */}
        {missing > 0 && !loading && (
          <div style={{ padding:'10px 20px', background:'#fef2f2', borderTop:'1px solid #fee2e2', fontSize:12, color:'#b91c1c', display:'flex', alignItems:'center', gap:8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <strong>{missing}</strong> document number{missing > 1 ? 's are' : ' is'} missing in the sequence. Highlighted rows indicate gaps in numbering.
          </div>
        )}
      </div>
    </div>
  );
}

const th = { padding:'10px 14px', textAlign:'left', fontWeight:600, fontSize:11, whiteSpace:'nowrap' };
const td = { padding:'9px 14px', color:'#374151' };

/* ── KPI summary card ── */
function KpiCard({ label, value, sub, icon, color, bg }) {
  return (
    <div style={{ background:`linear-gradient(145deg,${bg},${bg}cc)`, border:'1.5px solid rgba(0,0,0,0.05)', borderRadius:14, padding:'16px 20px', display:'flex', alignItems:'center', gap:14 }}>
      <div style={{ width:48, height:48, borderRadius:13, background:color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:`0 4px 12px ${color}55` }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize:12, color:'#64748b', fontWeight:600, marginBottom:4 }}>{label}</div>
        <div style={{ fontSize:22, fontWeight:800, color:'#1e293b', lineHeight:1.1 }}>{value}</div>
        {sub && <div style={{ fontSize:11, color:'#94a3b8', marginTop:3 }}>{sub}</div>}
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function DocumentNumberingPage() {
  const env = useReportsEnv();
  const fyDefault = currentFyRange();

  const [from,        setFrom]        = useState(fyDefault.from);
  const [to,          setTo]          = useState(fyDefault.to);
  const [activeQuick, setActiveQuick] = useState('fy');
  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [err,         setErr]         = useState('');
  const [drillType,   setDrillType]   = useState(null);

  const run = useCallback(async (f = from, t = to) => {
    setLoading(true); setErr('');
    try {
      const d = await api(`${env.reportsApi}?type=document_numbering&from=${f}&to=${t}`);
      setData(d.data);
    } catch (e) {
      setErr(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { run(); }, []);

  // The export needs the login token, so it is fetched and saved as a file (a plain link cannot send it).
  const downloadXlsx = async () => {
    const res = await fetch(`${env.exportUrl}?type=document_numbering&from=${from}&to=${to}&format=xlsx`, {
      headers: { Authorization: `Bearer ${getAuthToken()}`, Accept: '*/*' },
    });
    if (!res.ok) { setErr('Failed to export'); return; }
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `document_numbering_${from}_to_${to}.xls`;
    a.click();
  };

  const applyQuick = (id) => {
    const now = new Date();
    let f, t;
    if (id === 'current') {
      const y = now.getFullYear(), m = now.getMonth() + 1;
      const ms = String(m).padStart(2,'0'), last = new Date(y, m, 0).getDate();
      f = `${y}-${ms}-01`; t = `${y}-${ms}-${String(last).padStart(2,'0')}`;
    } else if (id === 'prev') {
      const prev = new Date(now); prev.setMonth(now.getMonth() - 1);
      const y = prev.getFullYear(), m = prev.getMonth() + 1;
      const ms = String(m).padStart(2,'0'), last = new Date(y, m, 0).getDate();
      f = `${y}-${ms}-01`; t = `${y}-${ms}-${String(last).padStart(2,'0')}`;
    } else if (id === 'fy') {
      const fy = currentFyRange(); f = fy.from; t = fy.to;
    }
    setFrom(f); setTo(t); setActiveQuick(id);
    run(f, t);
  };

  const handleApply = () => run(from, to);

  const summary = data?.summary || {};
  const rows    = data?.rows    || [];

  const drillRow = drillType ? rows.find((r) => r.type === drillType) : null;

  return (
    <div style={{ maxWidth:'100%' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12, marginBottom:20 }}>
        <div>
          <h2 style={{ margin:0, fontSize:22, fontWeight:800, color:'var(--bp-navy)' }}>Document Numbering</h2>
          <p style={{ margin:'3px 0 0', fontSize:13, color:'var(--bp-muted)' }}>
            View document-wise numbering, including start sequence, end sequence and total number of documents generated for the selected period.
          </p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#94a3b8' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Last Updated {new Date().toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
        </div>
      </div>

      {/* Period Filters */}
      <div className="bp-card" style={{ padding:'14px 18px', marginBottom:20 }}>
        <div style={{ fontSize:12, fontWeight:700, color:'var(--bp-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:10 }}>Select Period</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:10, alignItems:'flex-end' }}>
          {[
            { id:'current', label:'Current Month' },
            { id:'prev',    label:'Previous Month' },
            { id:'fy',      label:'Financial Year' },
          ].map(({ id, label }) => (
            <button key={id} type="button" onClick={() => applyQuick(id)} style={{
              height:36, padding:'0 14px', borderRadius:8, whiteSpace:'nowrap',
              border:`1.5px solid ${activeQuick === id ? '#2563eb' : '#e2e8f0'}`,
              background: activeQuick === id ? '#eff6ff' : '#fff',
              color: activeQuick === id ? '#2563eb' : 'var(--bp-text)',
              fontWeight:600, fontSize:13, cursor:'pointer',
            }}>{label}</button>
          ))}
          <button type="button" onClick={() => setActiveQuick('custom')} style={{
            height:36, padding:'0 14px', borderRadius:8,
            border:`1.5px solid ${activeQuick === 'custom' ? '#2563eb' : '#e2e8f0'}`,
            background: activeQuick === 'custom' ? '#eff6ff' : '#fff',
            color: activeQuick === 'custom' ? '#2563eb' : 'var(--bp-text)',
            fontWeight:600, fontSize:13, cursor:'pointer',
          }}>Custom Range</button>

          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            <span style={{ fontSize:10, fontWeight:700, color:'var(--bp-muted)', textTransform:'uppercase', letterSpacing:'0.5px' }}>From Date</span>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <input type="date" className="bp-input" style={{ height:36, minWidth:140 }} value={from}
                onChange={(e) => { setFrom(e.target.value); setActiveQuick('custom'); }} />
            </div>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            <span style={{ fontSize:10, fontWeight:700, color:'var(--bp-muted)', textTransform:'uppercase', letterSpacing:'0.5px' }}>To Date</span>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <input type="date" className="bp-input" style={{ height:36, minWidth:140 }} value={to}
                onChange={(e) => { setTo(e.target.value); setActiveQuick('custom'); }} />
            </div>
          </div>

          <button type="button" disabled={loading} onClick={handleApply}
            style={{ height:36, padding:'0 18px', borderRadius:8, background:'#0052cc', border:'none', color:'#fff', fontWeight:700, fontSize:13, display:'flex', alignItems:'center', gap:7, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4h14l-5.5 6.5V16l-3 1.5v-7L3 4Z"/></svg>
            Apply Filters
          </button>
        </div>
        {err && <p style={{ color:'#ef4444', margin:'10px 0 0', fontSize:13 }}>{err}</p>}
      </div>

      {/* KPI Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:14, marginBottom:24 }}>
        <KpiCard label="Total Documents" value={loading ? '…' : (summary.totalDocs ?? 0)} sub="All document types"
          color="#2563eb" bg="#eff6ff"
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
        />
        <KpiCard label="Active Documents" value={loading ? '…' : (summary.activeDocs ?? 0)} sub="Generated in selected period"
          color="#16a34a" bg="#f0fdf4"
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>}
        />
        <KpiCard label="Cancelled Documents" value={loading ? '…' : (summary.cancelledDocs ?? 0)} sub="Not included in active count"
          color="#ea580c" bg="#fff7ed"
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>}
        />
        <KpiCard label="Document Types" value={loading ? '…' : (summary.docTypesCount ?? 0)} sub="Configured types"
          color="#7c3aed" bg="#faf5ff"
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>}
        />
      </div>

      {/* Summary Table */}
      <div className="bp-card" style={{ padding:0, overflow:'hidden' }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h3 style={{ margin:0, fontSize:15, fontWeight:800, color:'var(--bp-navy)' }}>Document Numbering Summary</h3>
          <div style={{ display:'flex', gap:8 }}>
            <button type="button" onClick={downloadXlsx}
              style={{ height:32, padding:'0 12px', borderRadius:6, border:'1px solid #e2e8f0', background:'#fff', color:'#374151', fontSize:12, fontWeight:600, display:'inline-flex', alignItems:'center', gap:5, textDecoration:'none', cursor:'pointer' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export to Excel
            </button>
            <button type="button" onClick={() => window.print()}
              style={{ height:32, padding:'0 12px', borderRadius:6, border:'1px solid #e2e8f0', background:'#fff', color:'#374151', fontSize:12, fontWeight:600, display:'inline-flex', alignItems:'center', gap:5, cursor:'pointer' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Print
            </button>
          </div>
        </div>

        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#1e3a5f', color:'#fff' }}>
                {['Sr. No.','Document Type','Prefix','Start Sequence (First Document)','End Sequence (Last Document)','Total Documents (Generated)','Cancelled (If any)','Status'].map((h) => (
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontWeight:600, fontSize:12, whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" style={{ textAlign:'center', padding:32, color:'#94a3b8' }}>Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign:'center', padding:32, color:'#94a3b8' }}>No documents found for the selected period.</td></tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={r.type} style={{ borderBottom:'1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                    <td style={{ padding:'10px 14px', color:'#94a3b8', fontWeight:600 }}>{i + 1}</td>
                    <td style={{ padding:'10px 14px' }}>
                      <button type="button" onClick={() => setDrillType(r.type)}
                        style={{ background:'none', border:'none', color:'#2563eb', fontWeight:700, cursor:'pointer', fontSize:13, padding:0, textDecoration:'underline' }}>
                        {r.label}
                      </button>
                    </td>
                    <td style={{ padding:'10px 14px', fontWeight:600, color:'#475569' }}>{r.prefix}</td>
                    <td style={{ padding:'10px 14px', fontWeight:600, color:'#1e293b' }}>{r.start_sequence || '—'}</td>
                    <td style={{ padding:'10px 14px', fontWeight:600, color:'#1e293b' }}>{r.end_sequence || '—'}</td>
                    <td style={{ padding:'10px 14px' }}>
                      <button type="button" onClick={() => setDrillType(r.type)}
                        style={{ background:'#eff6ff', color:'#2563eb', border:'none', fontWeight:700, cursor:'pointer', fontSize:13, padding:'3px 10px', borderRadius:8 }}>
                        {r.total}
                      </button>
                    </td>
                    <td style={{ padding:'10px 14px', color: r.cancelled > 0 ? '#ef4444' : '#94a3b8' }}>{r.cancelled}</td>
                    <td style={{ padding:'10px 14px' }}>
                      <span style={{ background:'#f0fdf4', color:'#16a34a', padding:'3px 10px', borderRadius:8, fontSize:12, fontWeight:600 }}>Active</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Notes */}
        <div style={{ padding:'14px 20px', background:'#f0f7ff', borderTop:'1px solid #bfdbfe', fontSize:12, color:'#1e3a8a' }}>
          <div style={{ fontWeight:700, marginBottom:6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" style={{ marginRight:5, verticalAlign:'middle' }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Note:
          </div>
          <ul style={{ margin:'0', paddingLeft:18, lineHeight:1.7 }}>
            <li>Start Sequence shows the first document number generated in the selected period.</li>
            <li>End Sequence shows the last document number generated in the selected period.</li>
            <li>Total Documents include active documents only. Cancelled documents are shown separately.</li>
            <li>Document numbering follows the prefix and series configured in Billing Settings.</li>
          </ul>
        </div>
      </div>

      {/* Drill-Down Modal */}
      {drillType && drillRow && (
        <DrillDownModal
          typeKey={drillType}
          typeLabel={drillRow.label}
          from={from}
          to={to}
          onClose={() => setDrillType(null)}
        />
      )}
    </div>
  );
}
