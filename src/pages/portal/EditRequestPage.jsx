import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { isRetail } from '../billing/billingProfile';
import { docTypeLabel } from '../billing/billingUtils';

const REASONS = [
  'Incorrect GST Rate',
  'Incorrect Taxable Value',
  'Incorrect Customer Details',
  'Incorrect HSN/SAC',
  'Incorrect Tax Amount',
  'Incorrect Invoice Details',
  'Other',
];

const DOC_TYPES = [
  { value: 'tax_invoice',    label: 'Tax Invoice',   retailLabel: 'Invoice' },
  { value: 'bill_of_supply', label: 'Bill of Supply' },
  { value: 'debit_note',     label: 'Debit Note' },
  { value: 'credit_note',    label: 'Credit Note' },
];

function DocSelectIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IllustrationIcon({ size = 78 }) {
  // Document with text lines and a blue pencil badge (bottom-right), as in the approved design.
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" aria-hidden="true">
      <path d="M18 8h30l14 14v42a6 6 0 0 1-6 6H18a6 6 0 0 1-6-6V14a6 6 0 0 1 6-6z" fill="#fff" stroke="#3b82f6" strokeWidth="3.2" strokeLinejoin="round" />
      <path d="M48 8v10a4 4 0 0 0 4 4h10" stroke="#3b82f6" strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round" />
      <line x1="22" y1="34" x2="42" y2="34" stroke="#3b82f6" strokeWidth="3.2" strokeLinecap="round" />
      <line x1="22" y1="44" x2="52" y2="44" stroke="#3b82f6" strokeWidth="3.2" strokeLinecap="round" />
      <line x1="22" y1="54" x2="34" y2="54" stroke="#3b82f6" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="58" cy="58" r="14" fill="#2563eb" />
      <path d="M52.5 63.5l1-4 8.2-8.2a2.2 2.2 0 0 1 3.1 3.1l-8.2 8.2-4.1.9z" fill="#fff" />
      <path d="M60.6 52.6l3 3" stroke="#2563eb" strokeWidth="1.4" />
    </svg>
  );
}

const fmtDate = (dStr) => {
  if (!dStr) return '—';
  const date = new Date(dStr);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${String(date.getDate()).padStart(2,'0')} ${months[date.getMonth()]} ${date.getFullYear()}`;
};

const statusBadge = (status) => {
  const map = {
    pending:  { bg: '#fff7ed', color: '#f97316', border: '#ffedd5', label: 'Pending' },
    approved: { bg: '#f0fdf4', color: '#16a34a', border: '#dcfce7', label: 'Approved' },
    rejected: { bg: '#fef2f2', color: '#ef4444', border: '#fee2e2', label: 'Rejected' },
  };
  const s = map[status] || { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0', label: status };
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontWeight: 800, padding: '5px 16px', borderRadius: 8, fontSize: 12, display: 'inline-block', minWidth: 86, textAlign: 'center' }}>
      {s.label}
    </span>
  );
};

export default function EditRequestPage() {
  const { user } = useAuth();
  const retail = isRetail(user?.client_profile);
  const types = DOC_TYPES.filter((t) => !(retail && t.value !== 'tax_invoice'));

  const [documentType, setDocumentType] = useState('');
  const [billNumber, setBillNumber]     = useState('');
  const [lookup, setLookup]             = useState(null);
  const [fetching, setFetching]         = useState(false);
  const [reason, setReason]             = useState('');
  const [remarks, setRemarks]           = useState('');
  const [rows, setRows]                 = useState([]);
  const [msg, setMsg]                   = useState('');
  const [err, setErr]                   = useState('');
  const [fetchErr, setFetchErr]         = useState('');
  const [busy, setBusy]                 = useState(false);
  const [detail, setDetail]             = useState(null);

  const load = () => {
    api('/client/edit-requests?status=all')
      .then((d) => setRows(d.data?.data || d.data || []))
      .catch(console.error);
  };
  useEffect(() => { load(); }, []);

  const canSubmit = documentType && billNumber.trim() && lookup && reason && remarks.trim();

  const doLookup = async () => {
    setFetchErr('');
    setLookup(null);
    if (!documentType) { setFetchErr('Please select a document type first.'); return; }
    if (!billNumber.trim()) { setFetchErr('Please enter a bill/invoice number.'); return; }
    setFetching(true);
    try {
      const d = await api(`/client/edit-requests/lookup?document_type=${encodeURIComponent(documentType)}&bill_number=${encodeURIComponent(billNumber.trim())}`);
      setLookup(d);
    } catch (e) {
      setFetchErr(e.message || 'Document not found. Please check the document type and number.');
    } finally {
      setFetching(false);
    }
  };

  const handleDocTypeChange = (v) => {
    setDocumentType(v);
    setLookup(null);
    setFetchErr('');
  };

  const handleBillNumberChange = (v) => {
    setBillNumber(v);
    setLookup(null);
    setFetchErr('');
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const res = await api('/client/edit-requests', {
        method: 'POST',
        body: { document_type: documentType, bill_number: billNumber.trim(), reason, remarks },
      });
      setMsg(res.message || 'Edit request submitted successfully!');
      setLookup(null);
      setDocumentType('');
      setBillNumber('');
      setReason('');
      setRemarks('');
      load();
    } catch (ex) {
      setErr(ex.message || 'Submission failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bp-content er-page" style={{ maxWidth: '100%' }}>
      {/* Header */}
      <div className="bp-toolbar" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="er-hico" style={{ width: 52, height: 52, borderRadius: 14, background: '#e6eeff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <IllustrationIcon size={40} />
          </span>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--bp-navy)', letterSpacing: '-0.3px' }}>Document Change – Edit Request</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--bp-muted)' }}>
              Request changes for an issued document. Admin approval is required.
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%' }}>

        {/* Create Edit Request Form */}
        <div className="bp-card" style={{ padding: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, color: '#2563eb', fontSize: 12, fontWeight: 750 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg> Create Edit Request
            </span>
          </div>

          <form onSubmit={submit}>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>

              {/* Form Fields */}
              <div style={{ flex: '1 1 58%', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14 }}>

                  {/* Document Type */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--bp-navy)' }}>
                      Document Type <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 10, top: 12, zIndex: 2 }}>
                        <DocSelectIcon />
                      </span>
                      <select
                        className="bp-select"
                        style={{ height: 40, boxSizing: 'border-box', paddingLeft: 34, width: '100%' }}
                        value={documentType}
                        onChange={(e) => handleDocTypeChange(e.target.value)}
                      >
                        <option value="">Select Document Type</option>
                        {types.map((t) => (
                          <option key={t.value} value={t.value}>{retail && t.retailLabel ? t.retailLabel : t.label}</option>
                        ))}
                      </select>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--bp-muted)' }}>Choose the type of document you want to edit.</span>
                  </div>

                  {/* Invoice / Bill Number */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--bp-navy)' }}>
                      Invoice / Bill Number <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div className="er-fetch-row" style={{ display: 'flex', gap: 6 }}>
                      <input
                        className="bp-input"
                        style={{ height: 40, boxSizing: 'border-box', flex: 1, padding: '0 12px' }}
                        value={billNumber}
                        onChange={(e) => handleBillNumberChange(e.target.value)}
                        placeholder="Enter document number"
                      />
                      <button
                        type="button"
                        className="bp-btn bp-btn-primary"
                        style={{ height: 40, boxSizing: 'border-box', background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', border: 'none', color: '#fff', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, borderRadius: 10, padding: '0 18px' }}
                        onClick={doLookup}
                        disabled={fetching}
                      >
                        {fetching ? (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                            <path d="M21 12a9 9 0 1 1-9-9" />
                          </svg>
                        ) : (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                          </svg>
                        )}
                        Fetch
                      </button>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--bp-muted)' }}>Enter the document number and click Fetch.</span>
                  </div>

                  {/* Reason for Edit */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--bp-navy)' }}>
                      Reason for Edit <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 10, top: 12, zIndex: 2, color: '#64748b', display: 'flex' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
                      </span>
                      <select
                        className="bp-select"
                        style={{ height: 40, boxSizing: 'border-box', paddingLeft: 34, width: '100%' }}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      >
                        <option value="">Select Reason for Edit</option>
                        {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--bp-muted)' }}>Choose the appropriate reason.</span>
                  </div>
                </div>

                {/* Fetch error */}
                {fetchErr && (
                  <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12, color: '#dc2626' }}>
                    {fetchErr}
                  </div>
                )}

                {/* Fetched Document Panel */}
                {lookup && (
                  <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 10, padding: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      <span style={{ fontSize: 13, color: '#166534', fontWeight: 700 }}>Document Found</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
                      {[
                        ['Bill Number',  lookup.bill_number],
                        ['Date',         String(lookup.document_date || '').slice(0, 10)],
                        ['Customer',     lookup.customer_name || '—'],
                        ['Amount',       `₹${Number(lookup.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`],
                        ['Status',       lookup.status],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>{k}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--bp-navy)', marginTop: 2 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Remarks */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, position: 'relative' }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--bp-navy)' }}>
                    Remarks <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <textarea
                      className="bp-input"
                      rows={4}
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value.slice(0, 500))}
                      placeholder="Describe the correction required…"
                      style={{ padding: 12, borderRadius: 8, fontSize: 13, minHeight: 110, paddingBottom: 28, width: '100%', boxSizing: 'border-box' }}
                    />
                    <span className="er-count" style={{ position: 'absolute', bottom: 10, right: 14, fontSize: 11.5, fontWeight: 700, color: 'var(--bp-muted)' }}>
                      {remarks.length}/500
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--bp-muted)' }}>Please provide detailed remarks for the change request.</span>
                </div>
              </div>

              {/* Important Side Box */}
              <div className="er-important" style={{ flex: '1 1 35%', background: 'linear-gradient(160deg,#eef5ff,#e1ecff)', border: '1px solid #cfe0fa', borderRadius: 16, padding: '18px 20px', position: 'relative', minHeight: 180, display: 'flex', flexDirection: 'column' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: '#2563eb', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 20, height: 20, background: '#2563eb', color: '#fff', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>i</span>
                  Important
                </h4>
                <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12, lineHeight: 1.7, color: '#1e3a8a', display: 'flex', flexDirection: 'column', gap: 4, fontWeight: 500 }}>
                  <li>Issued documents cannot be edited directly.</li>
                  <li>Submit an edit request for Admin approval.</li>
                  <li>If the request is rejected, you may create an amendment.</li>
                  <li>Use the correct document type and number to fetch the document details.</li>
                </ol>
                <div style={{ position: 'absolute', bottom: 10, right: 10 }}>
                  <IllustrationIcon />
                </div>
              </div>
            </div>

            {/* Submit */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <button
                type="submit"
                className="bp-btn bp-btn-primary"
                disabled={busy || !canSubmit}
                style={{ height: 44, padding: '0 28px', border: 'none', background: canSubmit ? 'linear-gradient(135deg,#2563eb,#1d4ed8)' : '#b8c4d9', boxShadow: canSubmit ? '0 12px 20px -12px rgba(29,78,216,.85)' : 'none', color: '#fff', fontWeight: 800, borderRadius: 11, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: canSubmit ? 'pointer' : 'not-allowed' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
                {busy ? 'Submitting…' : 'Submit Request'}
              </button>
              {!canSubmit && !msg && (
                <span style={{ fontSize: 12, color: 'var(--bp-muted)' }}>Please fill in all the required fields to enable the submit button.</span>
              )}
              {msg && <span style={{ color: '#16a34a', fontWeight: 700, fontSize: 13 }}>{msg}</span>}
              {err && <span style={{ color: '#dc2626', fontWeight: 700, fontSize: 13 }}>{err}</span>}
            </div>
          </form>
        </div>

        {/* My Edit Requests */}
        <div className="bp-card" style={{ padding: 20 }}>
          <div className="er-list-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg className="er-list-ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--bp-navy)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
              <h3 style={{ margin: 0, color: 'var(--bp-navy)', fontSize: 16, fontWeight: 800 }}>My Edit Requests</h3>
            </div>
            <button
              type="button"
              className="bp-btn bp-btn-outline er-viewall"
              style={{ height: 32, padding: '0 12px', fontSize: 12, fontWeight: 700, color: '#2563eb', borderColor: '#bfdbfe', background: '#f8fafc', display: 'flex', alignItems: 'center', gap: 4 }}
              onClick={load}
            >
              View All
            </button>
          </div>

          <div className="bp-table-wrapper" style={{ overflowX: 'auto' }}>
            <table className="bp-table bp-doc-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'center' }}>#</th>
                  <th>Document Type</th>
                  <th>Invoice / Bill Number</th>
                  <th>Reason for Edit</th>
                  <th>Requested On</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: 'var(--bp-muted)' }}>
                      No edit requests submitted yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((r, index) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 700, color: '#64748b', textAlign: 'center' }}>{index + 1}</td>
                      <td style={{ fontWeight: 600 }}>{docTypeLabel(r.document_type)}</td>
                      <td style={{ fontWeight: 700, color: 'var(--bp-navy)' }}>{r.bill_number}</td>
                      <td>{r.reason}</td>
                      <td>{fmtDate(r.created_at)}</td>
                      <td style={{ textAlign: 'center' }}>{statusBadge(r.status)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button type="button" onClick={() => setDetail(r)}
                          style={{ height: 30, padding: '0 14px', borderRadius: 999, border: '1px solid #bfd3f6', background: '#fff', color: '#1d4ed8', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                          <EyeIcon /> View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="er-note" style={{ background: '#f0f7ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', marginTop: 16, display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'var(--bp-navy)', fontWeight: 600 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="#2563eb"><circle cx="12" cy="12" r="10" /><line x1="12" y1="11" x2="12" y2="16" stroke="white" strokeWidth="2.2" strokeLinecap="round" /><line x1="12" y1="7.5" x2="12.01" y2="7.5" stroke="white" strokeWidth="2.4" strokeLinecap="round" /></svg>
            <span>Only admin-approved requests will be applied to the documents. Rejected requests can be handled through Amendment Request.</span>
          </div>
        </div>

      </div>

      {detail && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,.45)' }} onClick={() => setDetail(null)} />
          <div style={{ position: 'relative', background: '#fff', borderRadius: 18, width: '100%', maxWidth: 520, padding: '22px 26px', boxShadow: '0 30px 60px -20px rgba(15,42,95,.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0f2a5f' }}>Edit Request Details</h3>
              <button type="button" onClick={() => setDetail(null)} aria-label="Close" style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: '#eef2f8', cursor: 'pointer', color: '#475569' }}>×</button>
            </div>
            {[
              ['Document Type', docTypeLabel(detail.document_type)],
              ['Invoice / Bill Number', detail.bill_number],
              ['Reason for Edit', detail.reason],
              ['Requested On', fmtDate(detail.created_at)],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid #eef3fa', fontSize: 13 }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>{k}</span><b style={{ color: '#0f2a5f', textAlign: 'right' }}>{v || '—'}</b>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #eef3fa', fontSize: 13 }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>Status</span>{statusBadge(detail.status)}
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>Requested correction / remarks</div>
              <div style={{ background: '#f6f9fd', border: '1px solid #e3ebf6', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#1e293b', whiteSpace: 'pre-wrap' }}>{detail.remarks || '—'}</div>
            </div>
            {(detail.status === 'approved' || detail.status === 'rejected') && (
              <div style={{ marginTop: 12, background: detail.status === 'approved' ? '#e8f8ee' : '#fff1f1', border: `1px solid ${detail.status === 'approved' ? '#bbf0cf' : '#fbd0d0'}`, borderRadius: 10, padding: '10px 12px', fontSize: 13, color: detail.status === 'approved' ? '#166534' : '#991b1b' }}>
                <b>{detail.status === 'approved' ? 'Approved' : 'Rejected'}{detail.reviewed_at ? ` on ${fmtDate(detail.reviewed_at)}` : ''}.</b>{' '}
                {detail.admin_remarks || detail.admin_note || detail.rejection_reason || (detail.status === 'rejected' ? 'You may create an amendment instead.' : '')}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" onClick={() => setDetail(null)} style={{ height: 38, padding: '0 24px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
