import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';

export default function AdminGstFilingRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const res = await api('/admin/gst-filing/requests');
      setRequests(res);
    } catch (err) {
      console.error(err);
      alert('Failed to load filing requests.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Pending CA Review': return <span className="bp-badge bp-badge-draft">Pending CA Review</span>;
      case 'Correction Required': return <span className="bp-badge bp-badge-unpaid">Correction Required</span>;
      case 'Approved for Filing': return <span className="bp-badge bp-badge-paid">Approved for Filing</span>;
      case 'GST Filed': return <span className="bp-badge bp-badge-paid">GST Filed</span>;
      default: return <span className="bp-badge" style={{ background: '#f1f5f9', color: '#64748b' }}>{status}</span>;
    }
  };

  return (
    <div className="bp-content" style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <div className="bp-toolbar">
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', color: 'var(--bp-navy)' }}>GST Filing Requests</h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--bp-muted)' }}>Manage and review client GST filing submissions.</p>
        </div>
      </div>

      <div className="bp-card">
        {loading ? (
          <div className="bp-table-empty">Loading requests...</div>
        ) : requests.length > 0 ? (
          <div style={{ overflowX: 'auto', border: '1px solid var(--bp-border)', borderRadius: '8px' }}>
            <table className="bp-table" style={{ margin: 0 }}>
              <thead style={{ background: '#f8fafc' }}>
                <tr>
                  <th>Request ID</th>
                  <th>Client</th>
                  <th>GSTIN</th>
                  <th>Period</th>
                  <th style={{ textAlign: 'right' }}>Bills</th>
                  <th style={{ textAlign: 'right' }}>Total GST</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr key={req.id}>
                    <td style={{ fontWeight: 600 }}>REQ-{req.id.toString().padStart(4, '0')}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{req.client_profile?.business_name || req.client_profile?.client_name || 'N/A'}</div>
                      <div style={{ fontSize: '12px', color: 'var(--bp-muted)' }}>{req.client_profile?.user?.email}</div>
                    </td>
                    <td style={{ color: 'var(--bp-muted)' }}>{req.client_profile?.gstin || '—'}</td>
                    <td>{req.filing_period}</td>
                    <td style={{ textAlign: 'right' }}>{req.total_bills}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{Number(req.total_gst).toFixed(2)}</td>
                    <td>{getStatusBadge(req.status)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <Link
                        to={`/admin/gst-filing-requests/${req.id}`}
                        style={{ color: 'var(--bp-blue)', fontWeight: 600, textDecoration: 'none' }}
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bp-table-empty">
            No filing requests found.
          </div>
        )}
      </div>
    </div>
  );
}
