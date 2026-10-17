import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/client';

export default function AdminGstFilingReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [req, setReq] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [filingDate, setFilingDate] = useState('');
  const [ackNo, setAckNo] = useState('');

  useEffect(() => {
    fetchRequest();
  }, [id]);

  const fetchRequest = async () => {
    try {
      const res = await api(`/admin/gst-filing/requests/${id}`);
      setReq(res);
    } catch (err) {
      console.error(err);
      alert('Failed to load request details.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    setUpdating(true);
    try {
      const body = { status: newStatus };
      if (newStatus === 'GST Filed') {
        body.filing_date = filingDate;
        body.ack_no = ackNo;
      }
      await api(`/admin/gst-filing/requests/${id}/status`, { method: 'PUT', body });
      alert(`Status updated to ${newStatus}`);
      fetchRequest();
    } catch (err) {
      console.error(err);
      alert('Failed to update status.');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading details...</div>;
  if (!req) return <div className="p-8 text-center text-red-500">Request not found.</div>;

  const clientName = req.client_profile?.business_name || req.client_profile?.client_name || 'N/A';

  return (
    <div className="bp-content" style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <div className="bp-toolbar" style={{ marginBottom: '20px' }}>
        <Link to="/admin/gst-filing-requests" style={{ textDecoration: 'none', color: 'var(--bp-muted)', fontSize: '13px', fontWeight: 600 }}>
          &larr; Back to Requests
        </Link>
      </div>

      <div className="bp-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', color: 'var(--bp-navy)' }}>Request: REQ-{req.id.toString().padStart(4, '0')}</h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--bp-muted)' }}>Submitted on {new Date(req.created_at).toLocaleString()}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {req.status === 'Pending CA Review' || req.status === 'Correction Required' ? (
            <>
              <button
                onClick={() => handleUpdateStatus('Correction Required')}
                disabled={updating}
                className="bp-btn bp-btn-outline"
                style={{ color: 'var(--bp-red)', borderColor: '#f0c6c0' }}
              >
                Send Back for Correction
              </button>
              <button
                onClick={() => handleUpdateStatus('Approved for Filing')}
                disabled={updating}
                className="bp-btn bp-btn-primary"
              >
                Approve / Proceed for Filing
              </button>
            </>
          ) : req.status === 'Approved for Filing' || (req.status === 'GST Filed' && !req.ack_no) ? (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--bp-navy)' }}>Filing Date *</label>
                <input
                  type="date"
                  className="bp-input"
                  style={{ height: 36 }}
                  value={filingDate}
                  onChange={(e) => setFilingDate(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--bp-navy)' }}>ACK. No. *</label>
                <input
                  type="text"
                  className="bp-input"
                  style={{ height: 36 }}
                  placeholder="Acknowledgement number"
                  value={ackNo}
                  onChange={(e) => setAckNo(e.target.value)}
                />
              </div>
              <button
                onClick={() => handleUpdateStatus('GST Filed')}
                disabled={updating || !filingDate || !ackNo.trim()}
                className="bp-btn bp-btn-green"
              >
                {req.status === 'GST Filed' ? 'Save Filing Details' : 'Mark as GST Filed'}
              </button>
            </div>
          ) : (
            <span className="bp-badge" style={{ padding: '8px 12px', fontSize: '13px', background: '#f1f5f9', color: '#64748b' }}>
              Current Status: {req.status}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px', marginBottom: '20px' }}>
        <div className="bp-card">
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: 'var(--bp-navy)', borderBottom: '1px solid var(--bp-border)', paddingBottom: '12px' }}>
            Client & Filing Details
          </h3>
          <div style={{ display: 'grid', gap: '12px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--bp-border)', paddingBottom: '8px' }}><span style={{ color: 'var(--bp-muted)' }}>Client Name:</span> <span style={{ fontWeight: 600 }}>{clientName}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--bp-border)', paddingBottom: '8px' }}><span style={{ color: 'var(--bp-muted)' }}>GSTIN:</span> <span style={{ fontWeight: 600 }}>{req.client_profile?.gstin || '—'}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--bp-border)', paddingBottom: '8px' }}><span style={{ color: 'var(--bp-muted)' }}>Email:</span> <span style={{ fontWeight: 600 }}>{req.client_profile?.user?.email}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--bp-border)', paddingBottom: '8px' }}><span style={{ color: 'var(--bp-muted)' }}>Taxpayer Type:</span> <span style={{ fontWeight: 600 }}>{req.meta?.taxpayer_type || '—'}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--bp-border)', paddingBottom: '8px' }}><span style={{ color: 'var(--bp-muted)' }}>Filing Frequency:</span> <span style={{ fontWeight: 600 }}>{req.meta?.filing_frequency || '—'}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--bp-border)', paddingBottom: '8px' }}><span style={{ color: 'var(--bp-muted)' }}>Financial Year:</span> <span style={{ fontWeight: 600 }}>{req.financial_year}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--bp-border)', paddingBottom: '8px' }}><span style={{ color: 'var(--bp-muted)' }}>Return Period:</span> <span style={{ fontWeight: 600 }}>{req.meta?.period_label || req.filing_period}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--bp-border)', paddingBottom: '8px' }}><span style={{ color: 'var(--bp-muted)' }}>Return Name:</span> <span style={{ fontWeight: 600 }}>{req.return_type}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--bp-border)', paddingBottom: '8px' }}><span style={{ color: 'var(--bp-muted)' }}>Due Date:</span> <span style={{ fontWeight: 600 }}>{req.meta?.due_date || '—'}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--bp-border)', paddingBottom: '8px' }}><span style={{ color: 'var(--bp-muted)' }}>Request Date:</span> <span style={{ fontWeight: 600 }}>{req.meta?.request_date || '—'}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--bp-border)', paddingBottom: '8px' }}><span style={{ color: 'var(--bp-muted)' }}>Status:</span> <span style={{ fontWeight: 700, color: 'var(--bp-blue)' }}>{req.status}</span></div>
            {req.status === 'GST Filed' && req.ack_no && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--bp-border)', paddingBottom: '8px' }}><span style={{ color: 'var(--bp-muted)' }}>Filing Date:</span> <span style={{ fontWeight: 600 }}>{req.filing_date ? new Date(req.filing_date).toLocaleDateString('en-GB') : '—'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--bp-border)', paddingBottom: '8px' }}><span style={{ color: 'var(--bp-muted)' }}>ACK. No.:</span> <span style={{ fontWeight: 600 }}>{req.ack_no}</span></div>
              </>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '4px' }}><span style={{ color: 'var(--bp-muted)' }}>Client Confirmation:</span> <span style={{ fontWeight: 600, color: 'var(--bp-green)' }}>✓ Declared & Confirmed</span></div>
          </div>
        </div>

        <div className="bp-card" style={{ background: 'var(--bp-sky)', borderColor: 'var(--bp-border)' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: 'var(--bp-navy)', borderBottom: '1px solid var(--bp-border)', paddingBottom: '12px' }}>
            GST Summary
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
            <div className="bp-card" style={{ padding: '12px', textAlign: 'center' }}>
              <div className="bp-kpi"><div className="label">Total Bills</div><div className="value">{req.total_bills}</div></div>
            </div>
            <div className="bp-card" style={{ padding: '12px', textAlign: 'center' }}>
              <div className="bp-kpi"><div className="label">Taxable Value</div><div className="value" style={{ fontSize: '20px' }}>₹{Number(req.taxable_value).toFixed(2)}</div></div>
            </div>
            <div className="bp-card" style={{ padding: '12px', textAlign: 'center' }}>
              <div className="bp-kpi"><div className="label">Total CGST</div><div className="value" style={{ fontSize: '18px' }}>₹{Number(req.total_cgst).toFixed(2)}</div></div>
            </div>
            <div className="bp-card" style={{ padding: '12px', textAlign: 'center' }}>
              <div className="bp-kpi"><div className="label">Total SGST</div><div className="value" style={{ fontSize: '18px' }}>₹{Number(req.total_sgst).toFixed(2)}</div></div>
            </div>
            <div className="bp-card" style={{ padding: '12px', textAlign: 'center' }}>
              <div className="bp-kpi"><div className="label">Total IGST</div><div className="value" style={{ fontSize: '18px' }}>₹{Number(req.total_igst).toFixed(2)}</div></div>
            </div>
            <div className="bp-card" style={{ padding: '12px', textAlign: 'center', borderColor: 'var(--bp-blue)' }}>
              <div className="bp-kpi"><div className="label" style={{ color: 'var(--bp-blue)' }}>Total GST</div><div className="value" style={{ fontSize: '22px', color: 'var(--bp-blue)' }}>₹{Number(req.total_gst).toFixed(2)}</div></div>
            </div>
          </div>
        </div>
      </div>

      <div className="bp-card">
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: 'var(--bp-navy)', borderBottom: '1px solid var(--bp-border)', paddingBottom: '12px' }}>
          Linked Invoices / Bills
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="bp-table">
            <thead>
              <tr>
                <th>Invoice No</th>
                <th>Type</th>
                <th>Date</th>
                <th style={{ textAlign: 'right' }}>Taxable</th>
                <th style={{ textAlign: 'right' }}>Total GST</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {req.documents?.map((doc) => {
                const docGst = Number(doc.cgst_amount) + Number(doc.sgst_amount) + Number(doc.igst_amount);
                return (
                  <tr key={doc.id}>
                    <td style={{ fontWeight: 600 }}>{doc.number}</td>
                    <td style={{ color: 'var(--bp-muted)' }}>{doc.type.replace('_', ' ').toUpperCase()}</td>
                    <td>{new Date(doc.document_date).toLocaleDateString()}</td>
                    <td style={{ textAlign: 'right' }}>₹{Number(doc.taxable_amount).toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>₹{docGst.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{Number(doc.total_amount).toFixed(2)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <Link to={`/admin/firm-billing/invoices/${doc.id}`} target="_blank" style={{ color: 'var(--bp-blue)', fontWeight: 600, textDecoration: 'none' }}>
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {req.documents?.length === 0 && <div className="bp-table-empty">No documents linked.</div>}
        </div>
      </div>
    </div>
  );
}
