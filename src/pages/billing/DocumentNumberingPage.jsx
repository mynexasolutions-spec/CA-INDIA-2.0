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

/* Documents in strictly ascending number order, with a "Missing" row for every skipped number.
 * Series are kept apart by their own prefix (INV- vs INS/), so a different prefix is never a gap. */
function buildSequenceWithGaps(docs) {
  if (!docs.length) return docs;
  const split = (n) => {
    const m = /^(.*?)(\d+)$/.exec(n || '');
    return m ? { prefix: m[1], seq: parseInt(m[2], 10), pad: m[2].length } : { prefix: n || '', seq: null, pad: 0 };
  };
  const groups = new Map();
  docs.forEach((d) => {
    const p = split(d.number);
    if (!groups.has(p.prefix)) groups.set(p.prefix, []);
    groups.get(p.prefix).push({ d, ...p });
  });
  const result = [];
  [...groups.keys()].sort().forEach((prefix) => {
    const items = groups.get(prefix).sort((x, y) => (x.seq ?? 0) - (y.seq ?? 0));
    const seqs = items.filter((i) => i.seq != null);
    if (!seqs.length) { items.forEach((i) => result.push({ ...i.d, missing: false })); return; }
    // Every document is kept, even when two share the same number (e.g. INS/36 and INS/036).
    const bySeq = new Map();
    seqs.forEach((i) => { if (!bySeq.has(i.seq)) bySeq.set(i.seq, []); bySeq.get(i.seq).push(i); });
    const pad = Math.max(...seqs.map((i) => i.pad));
    for (let n = seqs[0].seq; n <= seqs[seqs.length - 1].seq; n += 1) {
      const hits = bySeq.get(n);
      if (hits) hits.forEach((h) => result.push({ ...h.d, missing: false }));
      else result.push({ id: null, number: `${prefix}${String(n).padStart(pad, '0')}`, document_date: null, status: null, created_at: null, filing_status: null, missing: true });
    }
  });
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
const LEGEND = [['#22c55e', 'Filed'], ['#fca5a5', 'Not Filed'], ['#ef4444', 'Missing'], ['#9ca3af', 'Cancelled']];

const svgP = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: '#64748b', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
const IconSearch = () => <svg {...svgP}><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg>;
const IconCal = () => <svg {...svgP}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const IconX = () => <svg {...svgP} stroke="#334155" strokeWidth="2.4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IconInfo = () => <svg width="13" height="13" viewBox="0 0 24 24" style={{ verticalAlign:'-2px', marginLeft:5 }}><circle cx="12" cy="12" r="11" fill="#2563eb"/><line x1="12" y1="11" x2="12" y2="17" stroke="#fff" strokeWidth="2.6" strokeLinecap="round"/><line x1="12" y1="7.3" x2="12.01" y2="7.3" stroke="#fff" strokeWidth="2.8" strokeLinecap="round"/></svg>;

function DrillDownModal({ typeKey, typeLabel, row, from, to, onClose }) {
  const env = useReportsEnv();
  const [docs,    setDocs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [dFrom,   setDFrom]   = useState('');
  const [dTo,     setDTo]     = useState('');
  const [status,  setStatus]  = useState('all');

  useEffect(() => {
    setLoading(true);
    api(`${env.drillApi}?document_type=${typeKey}&from=${from}&to=${to}`)
      .then((d) => setDocs(d.documents || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [typeKey, from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  const withGaps = buildSequenceWithGaps(docs);
  const t = search.trim().toLowerCase();
  const filtered = withGaps.filter((d) => {
    if (t && !(`${d.number} ${d.document_date || ''} ${d.created_at || ''}`).toLowerCase().includes(t)) return false;
    if (dFrom && !(d.date_iso && d.date_iso >= dFrom)) return false;
    if (dTo && !(d.date_iso && d.date_iso <= dTo)) return false;
    if (status === 'missing' && !d.missing) return false;
    if (status === 'cancelled' && d.status !== 'cancelled') return false;
    if (status === 'active' && (d.missing || d.status === 'cancelled')) return false;
    return true;
  });
  const missing = withGaps.filter((d) => d.missing).length;
  const noLabel = typeKey === 'tax_invoice' ? 'Invoice No.' : 'Document No.';
  const dateLabel = typeKey === 'tax_invoice' ? 'Invoice Date' : 'Document Date';
  const reset = () => { setSearch(''); setDFrom(''); setDTo(''); setStatus('all'); };
  const ctl = { height: 36, borderRadius: 9, border: '1px solid #d3deef', background: '#fff', padding: '0 11px', fontSize: 12.5, color: '#1e293b' };
  const info = (k, v) => (
    <div style={{ display: 'grid', gridTemplateColumns: '130px 12px 1fr', fontSize: 12.5, lineHeight: 1.85 }}>
      <span style={{ color: '#475569', fontWeight: 700 }}>{k}</span><span style={{ color: '#94a3b8' }}>:</span><span style={{ color: '#0f2a5f', fontWeight: 600 }}>{v ?? '—'}</span>
    </div>
  );

  return (
    <div className="dd-overlay" style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:16 }} onClick={onClose}>
      <div className="dd-modal" onClick={(e) => e.stopPropagation()} style={{ background:'#fff', borderRadius:18, width:'100%', maxWidth:860, maxHeight:'92vh', display:'flex', flexDirection:'column', boxShadow:'0 30px 70px -20px rgba(15,42,95,0.5)' }}>
        <div className="dd-head" style={{ padding:'18px 24px 8px', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div style={{ flex:1 }}>
            <h3 style={{ margin:'0 0 10px', fontSize:19, fontWeight:800, color:'#1d4ed8' }}>{typeLabel} – Document Details</h3>
            <div className="dd-info" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', columnGap:30 }}>
              <div>{info('Document Type', typeLabel)}{info('Prefix', row?.prefix)}{info('Start Sequence', row?.start_sequence)}</div>
              <div>{info('Total Documents', row?.total)}{info('End Sequence', row?.end_sequence)}{info('Cancelled Documents', row?.cancelled)}</div>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ width:30, height:30, borderRadius:8, border:'none', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><IconX /></button>
        </div>

        <div className="dd-tools" style={{ padding:'10px 24px', display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
          <label style={{ ...ctl, flex:'1 1 220px', minWidth:200, display:'flex', alignItems:'center', gap:8 }}>
            <IconSearch />
            <input style={{ border:'none', outline:'none', background:'transparent', flex:1, fontSize:12.5, minWidth:0 }} placeholder="Search by invoice number or date…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <label style={{ ...ctl, display:'flex', alignItems:'center', gap:8, width:160 }}>
            <IconCal />
            <input type="date" style={{ border:'none', outline:'none', background:'transparent', fontSize:12.5, width:'100%', color: dFrom ? '#1e293b' : '#94a3b8' }} value={dFrom} onChange={(e) => setDFrom(e.target.value)} aria-label="From date" />
          </label>
          <label style={{ ...ctl, display:'flex', alignItems:'center', gap:8, width:160 }}>
            <IconCal />
            <input type="date" style={{ border:'none', outline:'none', background:'transparent', fontSize:12.5, width:'100%', color: dTo ? '#1e293b' : '#94a3b8' }} value={dTo} onChange={(e) => setDTo(e.target.value)} aria-label="To date" />
          </label>
          <select style={{ ...ctl, width:130 }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All Status</option><option value="active">Active</option><option value="cancelled">Cancelled</option><option value="missing">Missing</option>
          </select>
          <button type="button" onClick={reset} style={{ ...ctl, cursor:'pointer', color:'#1d4ed8', fontWeight:700, borderColor:'#bfd3f6' }}>Reset</button>
        </div>

        <div className="dd-tbl" style={{ flex:1, overflowY:'auto', margin:'0 24px 8px', border:'1px solid #dbe5f3', borderRadius:10 }}>
          {loading ? (
            <div style={{ padding:40, textAlign:'center', color:'#94a3b8', fontSize:13 }}>Loading…</div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
              <thead style={{ position:'sticky', top:0, zIndex:1 }}>
                <tr>{['Sr. No.', noLabel, dateLabel, 'Created On', 'Filing Status', 'Status'].map((h) => <th key={h} style={{ background:'#e9f0fb', color:'#0f2a5f', fontWeight:800, fontSize:12, padding:'10px 10px', textAlign:'center', whiteSpace:'nowrap' }}>{h}{h === 'Filing Status' && <IconInfo />}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan="6" style={{ textAlign:'center', padding:28, color:'#94a3b8' }}>No documents found.</td></tr>
                ) : filtered.map((doc, i) => {
                  const cell = { padding:'9px 10px', textAlign:'center', borderBottom:'1px solid #e3ebf6', borderRight:'1px solid #eef3fa', whiteSpace:'nowrap' };
                  const pill = (bg, fg, text) => <span style={{ display:'inline-block', minWidth:74, padding:'3px 10px', borderRadius:8, background:bg, color:fg, fontSize:11.5, fontWeight:700 }}>{text}</span>;
                  if (doc.missing) {
                    return (
                      <tr key={`m-${doc.number}`} style={{ background:'#fde8e8' }}>
                        <td style={cell}>{i + 1}</td><td style={{ ...cell, fontWeight:800, color:'#dc2626' }}>{doc.number}</td>
                        <td style={cell}>—</td><td style={cell}>—</td><td style={cell}>—</td><td style={cell}>{pill('#fbd0d0', '#b91c1c', 'Missing')}</td>
                      </tr>
                    );
                  }
                  const link = env.docLink(typeKey, doc.id);
                  const cancelled = doc.status === 'cancelled';
                  return (
                    <tr key={doc.id} style={{ background: cancelled ? '#f4f5f7' : (i % 2 ? '#f9fbff' : '#fff') }}>
                      <td style={{ ...cell, color:'#64748b' }}>{i + 1}</td>
                      <td style={cell}>{link ? <Link to={link} onClick={onClose} style={{ color:'#1d4ed8', fontWeight:800, textDecoration:'underline' }}>{doc.number}</Link> : <b>{doc.number}</b>}</td>
                      <td style={cell}>{doc.document_date || '—'}</td>
                      <td style={{ ...cell, color:'#64748b' }}>{doc.created_at || '—'}</td>
                      <td style={cell}>{doc.filing_status === 'not_applicable' ? '—' : doc.filing_status === 'filed' ? pill('#d9f3e3', '#15803d', 'Filed') : pill('#ffe0e0', '#dc2626', 'Not Filed')}</td>
                      <td style={cell}>{cancelled ? pill('#e5e7eb', '#4b5563', 'Cancelled') : pill('#d9f3e3', '#15803d', 'Active')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="dd-foot" style={{ padding:'12px 24px 18px', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
          <span style={{ fontSize:12, color:'#475569' }}>Showing 1 to {filtered.length} of {filtered.length} records{missing > 0 && <b style={{ color:'#dc2626' }}> · {missing} missing</b>}</span>
          <div style={{ display:'flex', gap:14, alignItems:'center', flexWrap:'wrap' }}>
            {LEGEND.map(([c, l]) => <span key={l} style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11.5, color:'#475569' }}><i style={{ width:9, height:9, borderRadius:'50%', background:c, display:'inline-block' }} />{l}</span>)}
            <button type="button" onClick={onClose} style={{ height:36, padding:'0 24px', borderRadius:9, border:'1px solid #bfd3f6', background:'#fff', color:'#1d4ed8', fontWeight:800, cursor:'pointer' }}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const th = { padding:'13px 16px', textAlign:'left', fontWeight:600, fontSize:11, whiteSpace:'nowrap' };
const td = { padding:'9px 14px', color:'#374151' };

/* ── KPI summary card ── */
function KpiCard({ label, value, sub, icon, color, bg, border }) {
  return (
    <div className="dn-kpi" style={{ background:bg, border:`1px solid ${border}`, borderRadius:12, padding:'16px 18px', display:'flex', alignItems:'center', gap:14 }}>
      <div className="dn-kpi-ic" style={{ width:50, height:50, borderRadius:'50%', background:`${color}22`, color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize:12.5, color, fontWeight:700, marginBottom:2 }}>{label}</div>
        <div style={{ fontSize:26, fontWeight:800, color:'#0f172a', lineHeight:1.15 }}>{value}</div>
        {sub && <div style={{ fontSize:11.5, color:'#64748b', marginTop:2 }}>{sub}</div>}
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
      <div className="dn-head gs-head" style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12, marginBottom:18 }}>
        <div>
          <div style={{ fontSize:12.5, color:'#64748b', marginBottom:10, display:'flex', gap:6, alignItems:'center' }}>
            <Link to={env.rootCrumbTo} style={{ color:'#2563eb', textDecoration:'none', fontWeight:500 }}>Reports</Link>
            <span>&gt;</span>
            <span>Document Numbering</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div className="gl-head-ic" style={{ width:44, height:44, background:'linear-gradient(135deg,#1d4ed8,#2563eb)', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" /><line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" /></svg>
            </div>
            <div className="dn-title">
              <h2 style={{ margin:0, fontSize:26, fontWeight:800, color:'#0f172a', letterSpacing:'-0.3px' }}>Document Numbering</h2>
              <p style={{ margin:'4px 0 0', fontSize:13, color:'#64748b' }}>
                View document-wise numbering, including start sequence, end sequence and total documents for the selected period.
              </p>
            </div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12, background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:12, padding:'10px 18px', minWidth:210 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <div>
            <div style={{ fontSize:11.5, color:'#475569', fontWeight:600 }}>Last Updated</div>
            <div style={{ fontSize:12.5, color:'#0f172a', fontWeight:600 }}>{new Date().toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}</div>
          </div>
        </div>
      </div>

      {/* Period Filters */}
      <div className="dn-filter gs-filter" style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:'16px 20px', marginBottom:18 }}>
        <div style={{ fontSize:13, fontWeight:800, color:'#0f172a', marginBottom:12 }}>Select Period</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:10, alignItems:'flex-end' }}>
          {[
            { id:'current', label:'Current Month' },
            { id:'prev',    label:'Previous Month' },
            { id:'fy',      label:'Financial Year' },
          ].map(({ id, label }) => (
            <button key={id} type="button" onClick={() => applyQuick(id)} style={{
              height:40, padding:'0 20px', borderRadius:9, whiteSpace:'nowrap',
              border:`1.5px solid ${activeQuick === id ? '#2563eb' : '#e2e8f0'}`,
              background: activeQuick === id ? '#eff6ff' : '#fff',
              color: activeQuick === id ? '#2563eb' : 'var(--bp-text)',
              fontWeight:600, fontSize:13, cursor:'pointer',
            }}>{label}</button>
          ))}
          <button type="button" onClick={() => setActiveQuick('custom')} style={{
            height:40, padding:'0 20px', borderRadius:9,
            border:`1.5px solid ${activeQuick === 'custom' ? '#2563eb' : '#e2e8f0'}`,
            background: activeQuick === 'custom' ? '#eff6ff' : '#fff',
            color: activeQuick === 'custom' ? '#2563eb' : 'var(--bp-text)',
            fontWeight:600, fontSize:13, cursor:'pointer',
          }}>Custom Range</button>

          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            <span style={{ fontSize:12, fontWeight:600, color:'#334155' }}>From Date</span>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <input type="date" className="bp-input" style={{ height:40, minWidth:150 }} value={from}
                onChange={(e) => { setFrom(e.target.value); setActiveQuick('custom'); }} />
            </div>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            <span style={{ fontSize:12, fontWeight:600, color:'#334155' }}>To Date</span>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <input type="date" className="bp-input" style={{ height:40, minWidth:150 }} value={to}
                onChange={(e) => { setTo(e.target.value); setActiveQuick('custom'); }} />
            </div>
          </div>

          <button type="button" disabled={loading} onClick={handleApply}
            style={{ height:40, padding:'0 28px', borderRadius:9, background:'#1d5fe0', marginLeft:'auto', minWidth:170, justifyContent:'center', border:'none', color:'#fff', fontWeight:700, fontSize:13, display:'flex', alignItems:'center', gap:7, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4h14l-5.5 6.5V16l-3 1.5v-7L3 4Z"/></svg>
            Apply Filters
          </button>
        </div>
        {err && <p style={{ color:'#ef4444', margin:'10px 0 0', fontSize:13 }}>{err}</p>}
      </div>

      {/* KPI Cards */}
      <div className="dn-kpis" style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:16, marginBottom:20 }}>
        <KpiCard label="Total Documents" value={loading ? '…' : (summary.totalDocs ?? 0)} sub="All document types"
          color="#2563eb" bg="#eef4ff" border="#d6e4fb"
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
        />
        <KpiCard label="Active Documents" value={loading ? '…' : (summary.activeDocs ?? 0)} sub="Generated in selected period"
          color="#16a34a" bg="#eefaf2" border="#cfeedb"
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>}
        />
        <KpiCard label="Cancelled Documents" value={loading ? '…' : (summary.cancelledDocs ?? 0)} sub="Not included in active count"
          color="#ea580c" bg="#fff3ec" border="#fbd9c4"
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>}
        />
        <KpiCard label="Document Types" value={loading ? '…' : (summary.docTypesCount ?? 0)} sub="Configured types"
          color="#7c3aed" bg="#f6f0ff" border="#e4d6fa"
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>}
        />
      </div>

      {/* Summary Table */}
      <div className="dn-table" style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:0, overflow:'hidden' }}>
        <div style={{ padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h3 style={{ margin:0, fontSize:15, fontWeight:800, color:'#0f172a' }}>Document Numbering Summary</h3>
          <div style={{ display:'flex', gap:8 }}>
            <button type="button" onClick={downloadXlsx}
              style={{ height:36, padding:'0 16px', borderRadius:8, border:'1px solid #cfd8e6', background:'#fff', color:'#374151', fontSize:12, fontWeight:600, display:'inline-flex', alignItems:'center', gap:5, textDecoration:'none', cursor:'pointer' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export to Excel
            </button>
            <button type="button" onClick={() => window.print()}
              style={{ height:36, padding:'0 16px', borderRadius:8, border:'1px solid #cfd8e6', background:'#fff', color:'#374151', fontSize:12, fontWeight:600, display:'inline-flex', alignItems:'center', gap:5, cursor:'pointer' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Print
            </button>
          </div>
        </div>

        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#f1f5f9', color:'#0f172a' }}>
                {[['Sr. No.'],['Document Type'],['Prefix'],['Start Sequence','(First Document)'],['End Sequence','(Last Document)'],['Total Documents','(Generated)'],['Cancelled','(If any)'],['Status']].map(([h, sub]) => (
                  <th key={h} style={{ padding:'11px 16px', textAlign:'left', fontWeight:700, fontSize:12.5, whiteSpace:'nowrap', borderTop:'1px solid #e2e8f0', borderBottom:'1px solid #e2e8f0' }}>
                    {h}{sub && <div style={{ fontWeight:500, fontSize:11.5, color:'#475569' }}>{sub}</div>}
                  </th>
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
                  <tr key={r.type} style={{ borderBottom:'1px solid #eef2f7', background:'#fff' }}>
                    <td style={{ padding:'13px 16px', color:'#334155', fontWeight:500 }}>{i + 1}</td>
                    <td style={{ padding:'13px 16px' }}>
                      <button type="button" onClick={() => setDrillType(r.type)}
                        style={{ background:'none', border:'none', color:'#1d4ed8', fontWeight:600, cursor:'pointer', fontSize:13, padding:0, textDecoration:'underline' }}>
                        {r.label}
                      </button>
                    </td>
                    <td style={{ padding:'13px 16px', fontWeight:500, color:'#334155' }}>{r.prefix}</td>
                    <td style={{ padding:'13px 16px', fontWeight:500, color:'#334155' }}>{r.start_sequence || '—'}</td>
                    <td style={{ padding:'13px 16px', fontWeight:500, color:'#334155' }}>{r.end_sequence || '—'}</td>
                    <td style={{ padding:'13px 16px' }}>
                      <button type="button" onClick={() => setDrillType(r.type)}
                        style={{ background:'none', color:'#1d4ed8', border:'none', fontWeight:600, cursor:'pointer', fontSize:13, padding:0, textDecoration:'underline' }}>
                        {r.total}
                      </button>
                    </td>
                    <td style={{ padding:'13px 16px', color: r.cancelled > 0 ? '#dc2626' : '#334155', fontWeight: r.cancelled > 0 ? 600 : 500 }}>{r.cancelled}</td>
                    <td style={{ padding:'13px 16px' }}>
                      {(() => {
                        const st = r.status || 'Active';
                        const c = st === 'Active' ? ['#d9f6e3', '#15803d'] : st === 'Cancelled' ? ['#fef2f2', '#ef4444'] : ['#f1f5f9', '#64748b'];
                        return <span style={{ background:c[0], color:c[1], padding:'3px 14px', borderRadius:8, fontSize:12, fontWeight:700 }}>{st}</span>;
                      })()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Notes */}
        <div className="bf-note" style={{ margin:'16px 20px 20px', padding:'16px 22px', background:'linear-gradient(135deg,#f3f8ff,#e8f1fd)', border:'1px solid #d3e3f8', borderRadius:12, fontSize:12.5, color:'#1e293b' }}>
          <div style={{ fontWeight:700, marginBottom:6 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" style={{ marginRight:8, verticalAlign:'middle' }}><circle cx="12" cy="12" r="11" fill="#1d5fe0" stroke="none"/><line x1="12" y1="11" x2="12" y2="17" stroke="#fff"/><line x1="12" y1="7.5" x2="12.01" y2="7.5" stroke="#fff"/></svg>
            Note:
          </div>
          <ul style={{ margin:'0', paddingLeft:18, lineHeight:1.8 }}>
            <li>Start Sequence shows the first document number generated in the selected period.</li>
            <li>End Sequence shows the last document number generated in the selected period.</li>
            <li>Total Documents is every document generated in the period; the Cancelled column shows how many of them were cancelled.</li>
            <li>Document numbering follows the prefix and series configured in Billing Settings.</li>
          </ul>
        </div>
      </div>

      {/* Drill-Down Modal */}
      {drillType && drillRow && (
        <DrillDownModal
          typeKey={drillType}
          typeLabel={drillRow.label}
          row={drillRow}
          from={from}
          to={to}
          onClose={() => setDrillType(null)}
        />
      )}
    </div>
  );
}
