import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { isRetail } from '../billing/billingProfile';
import { billingDocPath, docTypeLabel } from '../billing/billingUtils';

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

function HeaderEditIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M10.4 12.6a2 2 0 1 1 3 3L8 21l-1.5-.5.5-1.5z" />
    </svg>
  );
}

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

function IllustrationIcon() {
  return (
    <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.9 }}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M10.4 12.6a2 2 0 1 1 3 3L8 21l-1.5-.5.5-1.5z" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 4 }}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
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
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontWeight: 600, padding: '3px 10px', borderRadius: 999, fontSize: 12 }}>
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
    <div className="bp-content" style={{ maxWidth: '100%' }}>
      {/* Header */}
      <div className="bp-toolbar" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ width: 44, height: 44, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #bfdbfe' }}>
            <HeaderEditIcon />
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
              <span style={{ fontSize: 14, fontWeight: 'bold' }}>&#9998;</span> Create Edit Request
            </span>
          </div>

          <form onSubmit={submit}>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>

              {/* Form Fields */}
              <div style={{ flex: '1 1 58%', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>

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
                    <div style={{ display: 'flex', gap: 6 }}>
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
                        style={{ height: 40, boxSizing: 'border-box', background: '#0052cc', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, borderRadius: 8, padding: '0 14px' }}
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
                    <select
                      className="bp-select"
                      style={{ height: 40, boxSizing: 'border-box', width: '100%' }}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    >
                      <option value="">Select Reason for Edit</option>
                      {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
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
                  <textarea
                    className="bp-input"
                    rows={4}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value.slice(0, 500))}
                    placeholder="Describe the correction required…"
                    style={{ padding: 12, borderRadius: 8, fontSize: 13, minHeight: 90, paddingBottom: 24 }}
                  />
                  <span style={{ position: 'absolute', bottom: 8, right: 12, fontSize: 11, color: 'var(--bp-muted)' }}>
                    {remarks.length}/500
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--bp-muted)' }}>Please provide detailed remarks for the change request.</span>
                </div>
              </div>

              {/* Important Side Box */}
              <div style={{ flex: '1 1 35%', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '16px', position: 'relative', minHeight: 180, display: 'flex', flexDirection: 'column' }}>
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
                style={{ height: 42, padding: '0 24px', background: canSubmit ? '#0052cc' : '#94a3b8', fontWeight: 800, borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: canSubmit ? 'pointer' : 'not-allowed' }}
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
              {msg && <span style={{ color: '#16a34a', fontWeight: 700, fontSize: 13 }}>✓ {msg}</span>}
              {err && <span style={{ color: '#dc2626', fontWeight: 700, fontSize: 13 }}>⚠ {err}</span>}
            </div>
          </form>
        </div>

        {/* My Edit Requests */}
        <div className="bp-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--bp-navy)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
              <h3 style={{ margin: 0, color: 'var(--bp-navy)', fontSize: 16, fontWeight: 800 }}>My Edit Requests</h3>
            </div>
            <button
              type="button"
              className="bp-btn bp-btn-outline"
              style={{ height: 32, padding: '0 12px', fontSize: 12, fontWeight: 700, color: '#2563eb', borderColor: '#bfdbfe', background: '#f8fafc', display: 'flex', alignItems: 'center', gap: 4 }}
              onClick={load}
            >
              View All <ArrowRightIcon />
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
                        <Link
                          to={r.commercial_document_id ? billingDocPath(r.document_type, r.commercial_document_id) : '#'}
                          className="bp-btn bp-btn-outline"
                          style={{ height: 28, padding: '0 12px', borderColor: '#2563eb', color: '#2563eb', fontSize: 12, fontWeight: 700, borderRadius: 999, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                          onClick={(e) => { if (!r.commercial_document_id) e.preventDefault(); }}
                        >
                          <EyeIcon /> View
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={{ background: '#f0f7ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', marginTop: 16, display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'var(--bp-navy)', fontWeight: 600 }}>
            <span style={{ fontSize: 14 }}>ⓘ</span>
            <span>Only admin-approved requests will be applied to the documents. Rejected requests can be handled through Amendment Request.</span>
          </div>
        </div>

      </div>
    </div>
  );
}
