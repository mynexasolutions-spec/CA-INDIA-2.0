import React, { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../../api/client';

const REQUEST_TYPES = [
  'Profile Update',
  'Document Change',
  'Bank Details',
  'Invoice Settings',
  'Others',
];

const DOC_TYPES = [
  { value: 'tax_invoice',      label: 'Tax Invoice' },
  { value: 'bill_of_supply',   label: 'Bill of Supply' },
  { value: 'debit_note',       label: 'Debit Note' },
  { value: 'credit_note',      label: 'Credit Note' },
  { value: 'quotation',        label: 'Quotation' },
  { value: 'delivery_challan', label: 'Delivery Challan' },
];

/* ── icons ── */
function HeaderIcon() {
  return (
    <svg width="38" height="38" viewBox="0 0 80 80" fill="none" aria-hidden="true">
      <path d="M18 8h30l14 14v42a6 6 0 0 1-6 6H18a6 6 0 0 1-6-6V14a6 6 0 0 1 6-6z" fill="#fff" stroke="#3b82f6" strokeWidth="4" strokeLinejoin="round" />
      <path d="M48 8v10a4 4 0 0 0 4 4h10" stroke="#3b82f6" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
      <line x1="22" y1="36" x2="42" y2="36" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" />
      <line x1="22" y1="48" x2="50" y2="48" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" />
      <circle cx="58" cy="58" r="15" fill="#2563eb" />
      <path d="M53.5 55a4.6 4.6 0 1 1 6.6 4.1c-1.4.8-2.1 1.5-2.1 3" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" />
      <circle cx="58" cy="66.5" r="1.8" fill="#fff" />
    </svg>
  );
}

function IllustrationIcon({ size = 76 }) {
  // Document with a question-mark badge, as in the approved design.
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" aria-hidden="true">
      <path d="M18 8h30l14 14v42a6 6 0 0 1-6 6H18a6 6 0 0 1-6-6V14a6 6 0 0 1 6-6z" fill="#fff" stroke="#3b82f6" strokeWidth="3.2" strokeLinejoin="round" />
      <path d="M48 8v10a4 4 0 0 0 4 4h10" stroke="#3b82f6" strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round" />
      <line x1="22" y1="34" x2="42" y2="34" stroke="#3b82f6" strokeWidth="3.2" strokeLinecap="round" />
      <line x1="22" y1="44" x2="50" y2="44" stroke="#3b82f6" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="58" cy="58" r="14" fill="#2563eb" />
      <path d="M53.5 55a4.6 4.6 0 1 1 6.6 4.1c-1.4.8-2.1 1.5-2.1 3" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" fill="none" />
      <circle cx="58" cy="66.2" r="1.7" fill="#fff" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
      <polyline points="23 4 23 10 17 10"/>
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  );
}

const fmtDate = (dStr) => {
  if (!dStr) return '—';
  const d = new Date(dStr);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${String(d.getDate()).padStart(2,'0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

const docTypeLabel = (v) => {
  const map = { tax_invoice:'Tax Invoice', bill_of_supply:'Bill of Supply', debit_note:'Debit Note', credit_note:'Credit Note', quotation:'Quotation', delivery_challan:'Delivery Challan' };
  return map[v] || v || '—';
};

const StatusBadge = ({ status }) => {
  const map = {
    pending:  { bg:'#fff7ed', color:'#f97316', border:'#ffedd5', label:'Pending' },
    resolved: { bg:'#f0fdf4', color:'#16a34a', border:'#dcfce7', label:'Resolved' },
    rejected: { bg:'#fef2f2', color:'#ef4444', border:'#fee2e2', label:'Rejected' },
  };
  const s = map[status] || { bg:'#f8fafc', color:'#64748b', border:'#e2e8f0', label: status };
  return (
    <span style={{ background:s.bg, color:s.color, border:`1px solid ${s.border}`, fontWeight:600, padding:'3px 10px', borderRadius:999, fontSize:12 }}>
      {s.label}
    </span>
  );
};

/* ── Detail Modal ── */
function DetailModal({ req, onClose }) {
  if (!req) return null;
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:16 }}>
      <div style={{ background:'#fff', borderRadius:12, padding:28, width:'100%', maxWidth:580, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div>
            <h3 style={{ margin:0, fontSize:16, fontWeight:800, color:'#1e3a5f' }}>Other Request Details</h3>
            <span style={{ fontSize:12, color:'#64748b' }}>{req.request_id}</span>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:22, color:'#94a3b8', lineHeight:1 }}>×</button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:16 }}>
          {[
            ['Request Type',    req.request_type],
            ['Requested On',    fmtDate(req.created_at)],
            ['Document Type',   docTypeLabel(req.document_type)],
            ['Document No.',    req.document_number || '—'],
            ['Status',          null],
          ].map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize:10, color:'#94a3b8', fontWeight:700, textTransform:'uppercase', marginBottom:2 }}>{k}</div>
              <div style={{ fontSize:13, fontWeight:600, color:'#1e293b' }}>
                {k === 'Status' ? <StatusBadge status={req.status} /> : v}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:10, color:'#94a3b8', fontWeight:700, textTransform:'uppercase', marginBottom:4 }}>Subject</div>
          <div style={{ fontSize:13, fontWeight:600, color:'#1e293b' }}>{req.subject}</div>
        </div>
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:10, color:'#94a3b8', fontWeight:700, textTransform:'uppercase', marginBottom:4 }}>Request Details</div>
          <div style={{ fontSize:13, color:'#374151', background:'#f8fafc', padding:'10px 12px', borderRadius:6, lineHeight:1.6 }}>{req.request_details}</div>
        </div>
        {req.please_specify && (
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:10, color:'#94a3b8', fontWeight:700, textTransform:'uppercase', marginBottom:4 }}>Please Specify</div>
            <div style={{ fontSize:13, color:'#374151', background:'#f8fafc', padding:'10px 12px', borderRadius:6 }}>{req.please_specify}</div>
          </div>
        )}
        {req.admin_remarks && (
          <div style={{ padding:'10px 12px', background:'#fef9c3', border:'1px solid #fde68a', borderRadius:6, marginBottom:12 }}>
            <div style={{ fontSize:10, color:'#854d0e', fontWeight:700, textTransform:'uppercase', marginBottom:2 }}>Admin Remarks</div>
            <div style={{ fontSize:13, color:'#854d0e' }}>{req.admin_remarks}</div>
          </div>
        )}

        <div style={{ textAlign:'right', marginTop:16 }}>
          <button onClick={onClose} style={{ padding:'8px 20px', background:'#1e3a5f', color:'#fff', border:'none', borderRadius:7, fontWeight:600, cursor:'pointer', fontSize:13 }}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function OtherRequestPage() {
  /* form */
  const [requestType,    setRequestType]    = useState('');
  const [documentType,   setDocumentType]   = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [subject,        setSubject]        = useState('');
  const [requestDetails, setRequestDetails] = useState('');
  const [pleaseSpecify,  setPleaseSpecify]  = useState('');
  const [attachment,     setAttachment]     = useState(null);
  const [busy,           setBusy]           = useState(false);
  const [msg,            setMsg]            = useState('');
  const [err,            setErr]            = useState('');
  const fileRef = useRef(null);

  /* history */
  const [rows,    setRows]    = useState([]);
  const [viewReq, setViewReq] = useState(null);

  const isOthers   = requestType === 'Others';
  const canSubmit  = requestType && subject.trim() && requestDetails.trim() && (!isOthers || pleaseSpecify.trim());

  const loadHistory = useCallback(() => {
    api('/client/other-requests')
      .then((d) => setRows(d.data?.data || d.data || []))
      .catch(console.error);
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const handleAttachment = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setErr('Attachment must be under 5 MB.'); return; }
    setAttachment(file);
    setErr('');
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true); setErr(''); setMsg('');

    const fd = new FormData();
    fd.append('request_type',    requestType);
    if (documentType)   fd.append('document_type',   documentType);
    if (documentNumber) fd.append('document_number', documentNumber);
    fd.append('subject',         subject);
    fd.append('request_details', requestDetails);
    if (isOthers && pleaseSpecify) fd.append('please_specify', pleaseSpecify);
    if (attachment) fd.append('attachment', attachment);

    try {
      const res = await api('/client/other-requests', { method: 'POST', body: fd });
      setMsg(`Request ${res.request_id || ''} submitted successfully!`);
      setRequestType(''); setDocumentType(''); setDocumentNumber('');
      setSubject(''); setRequestDetails(''); setPleaseSpecify('');
      setAttachment(null);
      if (fileRef.current) fileRef.current.value = '';
      loadHistory();
    } catch (ex) {
      setErr(ex.message || 'Submission failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  /* ── drag-and-drop ── */
  const [dragging, setDragging] = useState(false);
  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) { setAttachment(file); setErr(''); }
  };

  return (
    <div className="bp-content er-page" style={{ maxWidth: '100%' }}>
      {/* Header */}
      <div className="bp-toolbar" style={{ marginBottom: 20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <span className="er-hico" style={{ width:54, height:54, borderRadius:14, background:'#e6eeff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <HeaderIcon />
          </span>
          <div>
            <h2 style={{ margin:0, fontSize:22, fontWeight:800, color:'var(--bp-navy)', letterSpacing:'-0.3px' }}>Other Request</h2>
            <p style={{ margin:'4px 0 0', fontSize:13, color:'var(--bp-muted)' }}>
              Submit a request for document related issues, reports or any other support. Admin approval is required.
            </p>
          </div>
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

        {/* Create Form */}
        <div className="bp-card" style={{ padding:20 }}>
          <div style={{ marginBottom:16 }}>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'6px 14px', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:6, color:'#2563eb', fontSize:12, fontWeight:750 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg> Create Other Request
            </span>
          </div>

          <form onSubmit={submit}>
            <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>

              {/* Left — form fields */}
              <div style={{ flex:'1 1 58%', display:'flex', flexDirection:'column', gap:14 }}>

                {/* Row 1: Request Type | Doc Type | Doc Number */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(170px, 1fr))', gap:12 }}>

                  {/* Request Type */}
                  <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                    <label style={{ fontSize:13, fontWeight:700, color:'var(--bp-navy)' }}>
                      Request Type <span style={{ color:'#ef4444' }}>*</span>
                    </label>
                    <select
                      className="bp-select"
                      style={{ height:40, boxSizing:'border-box' }}
                      value={requestType}
                      onChange={(e) => { setRequestType(e.target.value); setPleaseSpecify(''); }}
                    >
                      <option value="">Select Request Type</option>
                      {REQUEST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  {/* Document Type — optional */}
                  <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                    <label style={{ fontSize:13, fontWeight:700, color:'var(--bp-navy)' }}>
                      Document Type <span style={{ color:'#94a3b8', fontWeight:400, fontSize:11 }}>(Optional)</span>
                    </label>
                    <select
                      className="bp-select"
                      style={{ height:40, boxSizing:'border-box' }}
                      value={documentType}
                      onChange={(e) => setDocumentType(e.target.value)}
                    >
                      <option value="">Select Document Type</option>
                      {DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>

                  {/* Document Number — optional */}
                  <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                    <label style={{ fontSize:13, fontWeight:700, color:'var(--bp-navy)' }}>
                      Document Number <span style={{ color:'#94a3b8', fontWeight:400, fontSize:11 }}>(Optional)</span>
                    </label>
                    <input
                      className="bp-input"
                      style={{ height:40, boxSizing:'border-box', padding:'0 12px' }}
                      value={documentNumber}
                      onChange={(e) => setDocumentNumber(e.target.value)}
                      placeholder="Enter document number"
                    />
                  </div>
                </div>

                {/* Subject */}
                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  <label style={{ fontSize:13, fontWeight:700, color:'var(--bp-navy)' }}>
                    Subject <span style={{ color:'#ef4444' }}>*</span>
                  </label>
                  <input
                    className="bp-input"
                    style={{ height:40, boxSizing:'border-box', padding:'0 12px' }}
                    value={subject}
                    onChange={(e) => setSubject(e.target.value.slice(0, 200))}
                    placeholder="Enter short subject"
                  />
                </div>

                {/* Request Details */}
                <div style={{ display:'flex', flexDirection:'column', gap:5, position:'relative' }}>
                  <label style={{ fontSize:13, fontWeight:700, color:'var(--bp-navy)' }}>
                    Request Details <span style={{ color:'#ef4444' }}>*</span>
                  </label>
                  <textarea
                    className="bp-input"
                    rows={4}
                    value={requestDetails}
                    onChange={(e) => setRequestDetails(e.target.value.slice(0, 1000))}
                    placeholder="Describe your request in detail…"
                    style={{ padding:12, borderRadius:8, fontSize:13, minHeight:90, paddingBottom:24 }}
                  />
                  <span style={{ position:'absolute', bottom:8, right:12, fontSize:11, color:'var(--bp-muted)' }}>
                    {requestDetails.length}/1000
                  </span>
                </div>

                {/* Attachment + Please Specify side by side */}
                <div style={{ display:'grid', gridTemplateColumns: isOthers ? '1fr 1fr' : '1fr', gap:12 }}>

                  {/* Attachment */}
                  <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                    <label style={{ fontSize:13, fontWeight:700, color:'var(--bp-navy)' }}>
                      Attachment <span style={{ color:'#94a3b8', fontWeight:400, fontSize:11 }}>(Optional)</span>
                    </label>
                    <div
                      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={handleDrop}
                      onClick={() => fileRef.current?.click()}
                      style={{
                        border: `2px dashed ${dragging ? '#2563eb' : '#bfdbfe'}`,
                        borderRadius:8, background: dragging ? '#eff6ff' : '#f8fafc',
                        padding:'20px 16px', cursor:'pointer', textAlign:'center',
                        transition:'border-color 0.15s, background 0.15s',
                      }}
                    >
                      <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display:'none' }} onChange={handleAttachment} />
                      <UploadIcon />
                      {attachment ? (
                        <div style={{ marginTop:6 }}>
                          <div style={{ fontSize:12, fontWeight:600, color:'#1e3a5f' }}>{attachment.name}</div>
                          <div style={{ fontSize:11, color:'#64748b' }}>{(attachment.size / 1024).toFixed(0)} KB</div>
                          <button type="button" onClick={(e) => { e.stopPropagation(); setAttachment(null); if (fileRef.current) fileRef.current.value = ''; }} style={{ marginTop:4, fontSize:11, color:'#ef4444', background:'none', border:'none', cursor:'pointer' }}>Remove</button>
                        </div>
                      ) : (
                        <div style={{ marginTop:6 }}>
                          <div style={{ fontSize:12, color:'#2563eb', fontWeight:600 }}>Click to upload <span style={{ fontWeight:400, color:'#64748b' }}>or drag and drop</span></div>
                          <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>PDF, JPG, PNG (Max 5 MB)</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Please Specify — only when Others */}
                  {isOthers && (
                    <div style={{ display:'flex', flexDirection:'column', gap:5, position:'relative' }}>
                      <label style={{ fontSize:13, fontWeight:700, color:'var(--bp-navy)' }}>
                        Additional Information <span style={{ fontSize:11, color:'#94a3b8', fontWeight:400 }}>(Only for Others)</span>
                      </label>
                      <textarea
                        className="bp-input"
                        rows={4}
                        value={pleaseSpecify}
                        onChange={(e) => setPleaseSpecify(e.target.value.slice(0, 1000))}
                        placeholder="Please specify your request…"
                        style={{ padding:12, borderRadius:8, fontSize:13, flex:1, minHeight:90, paddingBottom:24 }}
                      />
                      <span style={{ position:'absolute', bottom:8, right:12, fontSize:11, color:'var(--bp-muted)' }}>
                        {pleaseSpecify.length}/1000
                      </span>
                      <span style={{ fontSize:11, color:'#f97316' }}>This field is mandatory when 'Others' is selected.</span>
                    </div>
                  )}
                </div>

                {/* Submit */}
                <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap', marginTop:4 }}>
                  <button
                    type="submit"
                    className="bp-btn bp-btn-primary"
                    disabled={busy || !canSubmit}
                    style={{ height:44, padding:'0 28px', border:'none', background: canSubmit ? 'linear-gradient(135deg,#2563eb,#1d4ed8)' : '#b8c4d9', boxShadow: canSubmit ? '0 12px 20px -12px rgba(29,78,216,.85)' : 'none', color:'#fff', fontWeight:800, borderRadius:11, display:'inline-flex', alignItems:'center', gap:8, cursor: canSubmit ? 'pointer' : 'not-allowed' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                    {busy ? 'Submitting…' : 'Submit Request'}
                  </button>
                  {!canSubmit && !msg && <span style={{ fontSize:12, color:'var(--bp-muted)' }}>Please fill in all the required fields to enable the submit button.</span>}
                  {msg && <span style={{ color:'#16a34a', fontWeight:700, fontSize:13 }}>{msg}</span>}
                  {err && <span style={{ color:'#dc2626', fontWeight:700, fontSize:13 }}>{err}</span>}
                </div>
              </div>

              {/* Right — Important Information */}
              <div className="er-important" style={{ flex:'1 1 35%', alignSelf:'flex-start', background:'linear-gradient(160deg,#eef5ff,#e1ecff)', border:'1px solid #cfe0fa', borderRadius:16, padding:'18px 20px 22px', position:'relative', display:'flex', flexDirection:'column' }}>
                <h4 style={{ margin:'0 0 12px 0', fontSize:14, color:'#2563eb', fontWeight:800, display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ width:20, height:20, background:'#2563eb', color:'#fff', borderRadius:'50%', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0 }}>i</span>
                  Important Information
                </h4>
                <ol style={{ margin:0, paddingLeft:0, fontSize:12.5, lineHeight:1.55, color:'#1e3a8a', display:'flex', flexDirection:'column', gap:12, fontWeight:500 }}>
                  <li>This option is for requests that are not covered under <strong>Edit Request</strong> or <strong>Amendment Request</strong>.</li>
                  <li>Select the appropriate request type and provide complete details.</li>
                  <li>For <strong>Profile Update, Document Change, Bank Details</strong> or <strong>Invoice Settings</strong>, the request will be processed after admin approval.</li>
                  <li>You can attach supporting documents if required.</li>
                  <li>You will be notified once your request is reviewed.</li>
                </ol>
                <div style={{ alignSelf:'flex-end', marginTop:10 }}>
                  <IllustrationIcon />
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* History */}
        <div className="bp-card" style={{ padding:20 }}>
          <div className="er-list-head" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <svg className="er-list-ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--bp-navy)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                <path d="M9 12h6"/><path d="M9 16h4"/>
              </svg>
              <h3 style={{ margin:0, color:'var(--bp-navy)', fontSize:16, fontWeight:800 }}>My Other Request History</h3>
            </div>
            <button
              type="button"
              className="bp-btn bp-btn-outline er-viewall"
              style={{ height:32, padding:'0 12px', fontSize:12, fontWeight:700, color:'#2563eb', borderColor:'#bfdbfe', background:'#f8fafc', display:'flex', alignItems:'center' }}
              onClick={loadHistory}
            >
              <RefreshIcon /> Refresh
            </button>
          </div>

          <div className="bp-table-wrapper" style={{ overflowX:'auto' }}>
            <table className="bp-table bp-doc-table" style={{ width:'100%' }}>
              <thead>
                <tr>
                  <th style={{ textAlign:'center' }}>#</th>
                  <th>Request ID</th>
                  <th>Request Type</th>
                  <th>Subject</th>
                  <th>Document Type</th>
                  <th>Document No.</th>
                  <th>Requested On</th>
                  <th style={{ textAlign:'center' }}>Status</th>
                  <th style={{ textAlign:'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign:'center', padding:'30px', color:'var(--bp-muted)' }}>
                      No requests submitted yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((r, i) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight:700, color:'#64748b', textAlign:'center' }}>{i + 1}</td>
                      <td style={{ fontWeight:700, color:'#2563eb', fontSize:12 }}>{r.request_id}</td>
                      <td style={{ fontWeight:600 }}>{r.request_type}</td>
                      <td style={{ maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.subject}</td>
                      <td>{docTypeLabel(r.document_type)}</td>
                      <td>{r.document_number || '—'}</td>
                      <td>{fmtDate(r.created_at)}</td>
                      <td style={{ textAlign:'center' }}><StatusBadge status={r.status} /></td>
                      <td style={{ textAlign:'center' }}>
                        <button
                          type="button"
                          className="bp-btn bp-btn-outline"
                          style={{ height:28, padding:'0 12px', borderColor:'#2563eb', color:'#2563eb', fontSize:12, fontWeight:700, borderRadius:999, display:'inline-flex', alignItems:'center', cursor:'pointer' }}
                          onClick={() => setViewReq(r)}
                        >
                          <EyeIcon /> View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="er-note" style={{ background:'#f0f7ff', border:'1px solid #bfdbfe', borderRadius:8, padding:'10px 14px', marginTop:16, display:'flex', gap:8, alignItems:'center', fontSize:12, color:'var(--bp-navy)', fontWeight:600 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="#2563eb"><circle cx="12" cy="12" r="10" /><line x1="12" y1="11" x2="12" y2="16" stroke="white" strokeWidth="2.2" strokeLinecap="round" /><line x1="12" y1="7.5" x2="12.01" y2="7.5" stroke="white" strokeWidth="2.4" strokeLinecap="round" /></svg>
            <span>All requests are reviewed by Admin. The client cannot directly modify system data through this module.</span>
          </div>
        </div>
      </div>

      {viewReq && <DetailModal req={viewReq} onClose={() => setViewReq(null)} />}
    </div>
  );
}
