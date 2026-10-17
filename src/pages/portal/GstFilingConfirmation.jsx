import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { fyQuarterOptions } from '../billing/billingUtils';

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function GstFilingConfirmation() {
  const { user } = useAuth();
  const profile = user?.client_profile;

  // GST Filing Return Type & Period Logic spec: Regular dealers raise GSTR-1/GSTR-3B
  // requests here; Composition dealers raise CMP-08/GSTR-4 instead — GSTR-2B has no
  // applicability at all for Composition, so neither type ever hits the reconciliation
  // gate below (that gate is a no-op for anything but GSTR-3B).
  const isComposition = profile?.dealer_type === 'composition';
  const returnTypeOptions = isComposition ? ['CMP-08', 'GSTR-4'] : ['GSTR-1', 'GSTR-3B'];

  const [returnType, setReturnType] = useState('GSTR-1');
  // GST Filing Return Type & Period Logic spec:
  // - GSTR-1's Filing Period is always Monthly (even under QRMP it's tracked monthly via IFF).
  // - GSTR-3B's Filing Period follows the client's GSTR-2B frequency — GSTR-2B Monthly ->
  //   GSTR-3B Monthly, GSTR-2B Quarterly -> GSTR-3B Quarterly.
  // - CMP-08 has no GSTR-2B applicability and is always Quarterly.
  // - GSTR-4 is Annual — its "period" is the Financial Year itself, no separate picker.
  // Matches the backend's BillingPolicy::gstr2bFrequency() /
  // GstFilingController::assertPeriodMatchesFrequency().
  const gstr2bQuarterly = (profile?.gstr2b_filing_frequency ?? profile?.gst_filing_frequency ?? 'monthly') === 'quarterly';
  const isAnnual = returnType === 'GSTR-4';
  const quarterly = returnType === 'CMP-08' || (returnType === 'GSTR-3B' && gstr2bQuarterly);

  const [financialYear, setFinancialYear] = useState('2026-2027');
  const [filingPeriod, setFilingPeriod] = useState('');
  const [filingQuarter, setFilingQuarter] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [clientDeclaration, setClientDeclaration] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const [pastRequests, setPastRequests] = useState([]);
  const [selectedRequestDetail, setSelectedRequestDetail] = useState(null);

  const fyStartYear = financialYear.split('-')[0];
  const quarterOptions = fyQuarterOptions(`${fyStartYear}-${String((parseInt(fyStartYear, 10) + 1)).slice(-2)}`);
  // The actual value sent to the API — bare "YYYY" for GSTR-4 (Annual), "YYYY-MM" for a
  // monthly filer, "YYYY-Qn" for a quarterly one (GSTR-3B on quarterly GSTR-2B, or CMP-08),
  // matching what the backend enforces.
  const effectivePeriod = isAnnual ? fyStartYear : quarterly ? (filingQuarter ? `${fyStartYear}-${filingQuarter}` : '') : filingPeriod;

  const handleReturnTypeChange = (value) => {
    setReturnType(value);
    setFilingQuarter('');
    setFilingPeriod('');
    setPreviewData(null);
  };

  // Dealer type resolves asynchronously (profile loads via useAuth) — once known, make
  // sure the selected Return Type is actually valid for this dealer (Regular vs Composition).
  useEffect(() => {
    if (!profile) return;
    if (!returnTypeOptions.includes(returnType)) {
      handleReturnTypeChange(returnTypeOptions[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, isComposition]);

  useEffect(() => {
    fetchPastRequests();
  }, []);

  // "View Request" from a just-submitted filing request opens that request's details straight away.
  const [searchParams] = useSearchParams();
  const requestedId = searchParams.get('request');
  useEffect(() => {
    if (requestedId) handleViewRequestDetails(requestedId);
  }, [requestedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Opened from a GST Filing Reminder (popup / bell): preselect that return and period.
  const reminderReturn = searchParams.get('return');
  const reminderPeriod = searchParams.get('period');
  useEffect(() => {
    if (!profile || !reminderReturn || !reminderPeriod) return;
    const q = /^(\d{4})-(Q[1-4])$/.exec(reminderPeriod);
    const m = /^(\d{4})-(\d{2})$/.exec(reminderPeriod);
    setReturnType(reminderReturn);
    setPreviewData(null);
    if (q) {
      const y = parseInt(q[1], 10);
      setFinancialYear(`${y}-${y + 1}`);
      setFilingQuarter(q[2]); setFilingPeriod('');
    } else if (m) {
      const y = parseInt(m[1], 10);
      const fy = parseInt(m[2], 10) >= 4 ? y : y - 1;
      setFinancialYear(`${fy}-${fy + 1}`);
      setFilingPeriod(reminderPeriod); setFilingQuarter('');
    }
  }, [profile?.id, reminderReturn, reminderPeriod]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPastRequests = async () => {
    try {
      const res = await api('/client/gst-filing/requests');
      setPastRequests(res || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Past Requests table below is scoped to whichever Return Type is currently selected.
  const visibleRequests = pastRequests.filter((r) => r.return_type === returnType);

  const handleFetchPreview = async () => {
    if (!effectivePeriod) {
      alert(quarterly ? 'Please select a filing quarter.' : 'Please select a filing period.');
      return;
    }

    setLoading(true);
    setPreviewData(null);
    setClientDeclaration(false);

    try {
      const params = new URLSearchParams({
        financial_year: financialYear,
        filing_period: effectivePeriod,
        return_type: returnType,
      });
      const res = await api(`/client/gst-filing/preview?${params.toString()}`);
      setPreviewData(res);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to fetch billing data.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRequest = async () => {
    setSubmitting(true);
    try {
      const res = await api('/client/gst-filing/request', {
        method: 'POST',
        body: {
          financial_year: financialYear,
          filing_period: effectivePeriod,
          return_type: returnType,
          client_declaration: clientDeclaration,
        }
      });
      alert(res.message);
      setShowConfirmModal(false);
      setPreviewData(null);
      fetchPastRequests();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to submit request.');
      setShowConfirmModal(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewRequestDetails = async (id) => {
    try {
      const res = await api(`/client/gst-filing/requests/${id}`);
      setSelectedRequestDetail(res);
    } catch (err) {
      console.error(err);
      alert('Failed to fetch request details.');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Pending CA Review': 
        return <span className="bp-badge" style={{ background: '#ffedd5', color: '#ea580c', fontWeight: 700 }}>Pending CA Review</span>;
      case 'Approved for Filing': 
      case 'Approved by CA': 
        return <span className="bp-badge" style={{ background: '#dcfce7', color: '#166534', fontWeight: 700 }}>Approved by CA</span>;
      case 'Correction Required': 
      case 'Rejected': 
        return <span className="bp-badge" style={{ background: '#fee2e2', color: '#dc2626', fontWeight: 700 }}>Rejected</span>;
      case 'GST Filed': 
      case 'Filed': 
        return <span className="bp-badge" style={{ background: '#dcfce7', color: '#166534', fontWeight: 700 }}>Filed</span>;
      default: 
        return <span className="bp-badge" style={{ background: '#f1f5f9', color: '#64748b', fontWeight: 700 }}>{status}</span>;
    }
  };

  const formatPeriod = (periodStr) => {
    if (!periodStr) return '—';
    // Bare "YYYY" — GSTR-4's Annual period (the FY start year itself).
    if (/^\d{4}$/.test(periodStr)) {
      const y1 = parseInt(periodStr, 10);
      return `FY ${y1}-${String(y1 + 1).slice(-2)}`;
    }
    const parts = periodStr.split('-');
    if (parts.length < 2) return periodStr;
    const year = parts[0];
    // QRMP quarterly filers store "YYYY-Qn" — the Apr-Jun/Jul-Sep/etc. label comes from
    // the same fyQuarterOptions() definitions used to build the picker, so both places
    // describe the same quarters.
    if (/^Q[1-4]$/.test(parts[1])) {
      const fyLabel = `${year}-${String(parseInt(year, 10) + 1).slice(-2)}`;
      const q = fyQuarterOptions(fyLabel).find((o) => o.value === parts[1]);
      return q ? `FY${fyLabel} ${q.label}` : `${parts[1]} ${year}`;
    }
    const monthNum = parseInt(parts[1], 10);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[monthNum - 1]} ${year}`;
  };

  const formatDateOnly = (dStr) => {
    if (!dStr) return '—';
    const date = new Date(dStr);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="bp-content" style={{ maxWidth: '100%' }}>
      {/* Toolbar */}
      <div className="bp-toolbar" style={{ marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--bp-navy)' }}>GST Filing</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--bp-muted)' }}>
            Review your sales invoices and submit a {returnType} filing request to your CA.
          </p>
        </div>
      </div>

      {/* Period Selection */}
      <div className="bp-card" style={{ marginBottom: 20, padding: 20 }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 15, fontWeight: 800, color: 'var(--bp-navy)', borderBottom: '1px solid var(--bp-border)', paddingBottom: 12 }}>
          1. Period Selection
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--bp-navy)' }}>Financial Year</span>
            <select 
              className="bp-select"
              style={{ height: 40, boxSizing: 'border-box', minWidth: 160 }}
              value={financialYear}
              onChange={(e) => { setFinancialYear(e.target.value); setFilingQuarter(''); setFilingPeriod(''); }}
            >
              <option value="2026-2027">2026-2027</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--bp-navy)' }}>Return Type</span>
            <select
              className="bp-select"
              style={{ height: 40, boxSizing: 'border-box', minWidth: 160 }}
              value={returnType}
              onChange={(e) => handleReturnTypeChange(e.target.value)}
            >
              {returnTypeOptions.map((rt) => <option key={rt} value={rt}>{rt}</option>)}
            </select>
          </div>
          {isAnnual ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--bp-navy)' }}>Filing Period</span>
              <div className="bp-input" style={{ height: 40, boxSizing: 'border-box', minWidth: 160, display: 'flex', alignItems: 'center', color: 'var(--bp-muted)' }}>
                Annual — FY {financialYear}
              </div>
            </div>
          ) : quarterly ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--bp-navy)' }}>Filing Quarter *</span>
              <select
                className="bp-select"
                style={{ height: 40, boxSizing: 'border-box', minWidth: 200 }}
                value={filingQuarter}
                onChange={(e) => setFilingQuarter(e.target.value)}
              >
                <option value="">Select Quarter</option>
                {quarterOptions.map((q) => (
                  <option key={q.value} value={q.value}>{q.label}</option>
                ))}
              </select>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--bp-navy)' }}>Filing Period (Month) *</span>
              <input
                type="month"
                className="bp-input"
                style={{ height: 40, boxSizing: 'border-box', minWidth: 160, padding: '0 12px' }}
                value={filingPeriod}
                onChange={(e) => setFilingPeriod(e.target.value)}
              />
            </div>
          )}
          <div>
            <button 
              onClick={handleFetchPreview}
              disabled={loading || !effectivePeriod}
              className="bp-btn bp-btn-primary"
              style={{ height: 40, borderRadius: 8, fontWeight: 600, background: '#0052cc' }}
            >
              {loading ? 'Fetching...' : 'Fetch Bills & Summary'}
            </button>
          </div>
        </div>
      </div>

      {previewData && previewData.reconciliation_status === 'pending' && (
        <div className="bp-alert bp-alert-error" style={{ marginBottom: 20 }}>
          GSTR-2B reconciliation is pending for this period. Complete reconciliation (or ask your CA to mark this
          period "No Bills in GSTR-2B") before you can raise the {returnType} filing request.
        </div>
      )}

      {previewData && previewData.reconciliation_status !== 'pending' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '20px' }}>
          {/* Bill Review */}
          <div className="bp-card" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 15, fontWeight: 800, color: 'var(--bp-navy)' }}>
              2. Bill Review <span style={{ fontSize: 13, color: 'var(--bp-muted)', fontWeight: 'normal' }}>({previewData.summary.total_bills} Invoices)</span>
            </h3>
            
            {previewData.bills.length > 0 ? (
              <div className="bp-table-wrapper" style={{ overflowX: 'auto', border: '1px solid var(--bp-border)', borderRadius: '8px' }}>
                <table className="bp-table bp-doc-table" style={{ margin: 0, width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'center' }}>Invoice No</th>
                      <th style={{ textAlign: 'center' }}>Date</th>
                      <th style={{ textAlign: 'center' }}>Taxable Val (₹)</th>
                      <th style={{ textAlign: 'center' }}>IGST (₹)</th>
                      <th style={{ textAlign: 'center' }}>CGST (₹)</th>
                      <th style={{ textAlign: 'center' }}>SGST (₹)</th>
                      <th style={{ textAlign: 'center' }}>Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.bills.map((bill) => (
                      <tr key={bill.id}>
                        <td style={{ fontWeight: 700, color: 'var(--bp-navy)' }}>{bill.number}</td>
                        <td>{formatDateOnly(bill.document_date)}</td>
                        <td style={{ fontWeight: 600 }}>₹{Number(bill.taxable_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td>₹{Number(bill.igst_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td>₹{Number(bill.cgst_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td>₹{Number(bill.sgst_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td style={{ fontWeight: 700, color: '#166534' }}>₹{Number(bill.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bp-table-empty" style={{ textAlign: 'center', padding: '30px', color: 'var(--bp-muted)' }}>
                No bills found for this period. You can proceed with a Nil Filing.
              </div>
            )}
          </div>

          {/* GST Summary & Declaration */}
          <div className="bp-card" style={{ background: '#f0f7ff', border: '1px solid #bfdbfe', padding: 20 }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 15, fontWeight: 800, color: 'var(--bp-navy)' }}>
              3. GST Filing Summary
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
              <div className="bp-card" style={{ padding: 14, textAlign: 'center', background: '#fff' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--bp-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Total Bills</div>
                <div style={{ fontSize: 20, fontWeight: 850, color: 'var(--bp-navy)' }}>{previewData.summary.total_bills}</div>
              </div>
              <div className="bp-card" style={{ padding: 14, textAlign: 'center', background: '#fff' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--bp-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Taxable Value</div>
                <div style={{ fontSize: 18, fontWeight: 850, color: 'var(--bp-navy)' }}>₹{previewData.summary.taxable_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              </div>
              <div className="bp-card" style={{ padding: 14, textAlign: 'center', background: '#fff' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--bp-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Total IGST</div>
                <div style={{ fontSize: 18, fontWeight: 850, color: 'var(--bp-navy)' }}>₹{previewData.summary.total_igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              </div>
              <div className="bp-card" style={{ padding: 14, textAlign: 'center', background: '#fff' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--bp-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Total CGST</div>
                <div style={{ fontSize: 18, fontWeight: 850, color: 'var(--bp-navy)' }}>₹{previewData.summary.total_cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              </div>
              <div className="bp-card" style={{ padding: 14, textAlign: 'center', background: '#fff' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--bp-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Total SGST</div>
                <div style={{ fontSize: 18, fontWeight: 850, color: 'var(--bp-navy)' }}>₹{previewData.summary.total_sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              </div>
              <div className="bp-card" style={{ padding: 14, textAlign: 'center', background: '#fff', borderColor: '#2563eb' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', marginBottom: 4 }}>Total GST</div>
                <div style={{ fontSize: 18, fontWeight: 850, color: '#2563eb' }}>₹{previewData.summary.total_gst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #bfdbfe', paddingTop: 16 }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 800, color: 'var(--bp-navy)' }}>4. Client Confirmation</h3>
              <div 
                className="bp-card" 
                style={{ padding: 16, display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer', background: '#fff' }}
                onClick={() => setClientDeclaration(!clientDeclaration)}
              >
                <input
                  type="checkbox"
                  style={{ width: 18, height: 18, cursor: 'pointer', marginTop: 2 }}
                  checked={clientDeclaration}
                  onChange={(e) => setClientDeclaration(e.target.checked)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div style={{ fontSize: 13, lineHeight: '1.5', color: 'var(--bp-text)', fontWeight: 600 }}>
                  “I confirm that I have reviewed the above bills and GST summary and request the CA to proceed with GST filing (including Nil filing if applicable) for the selected period.”
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <button
                  onClick={() => setShowConfirmModal(true)}
                  disabled={!clientDeclaration}
                  className="bp-btn bp-btn-green"
                  style={{ padding: '12px 24px', fontSize: 14, fontWeight: 700, borderRadius: 8 }}
                >
                  Send {returnType} Filing Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Past Requests */}
      <div className="bp-card" style={{ padding: 20 }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 15, fontWeight: 800, color: 'var(--bp-navy)', borderBottom: '1px solid var(--bp-border)', paddingBottom: 12 }}>
          Filing Requests
        </h3>
        <div className="bp-table-wrapper" style={{ overflowX: 'auto' }}>
          <table className="bp-table bp-doc-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'center' }}>Request ID</th>
                <th style={{ textAlign: 'center' }}>Period</th>
                <th style={{ textAlign: 'center' }}>Return</th>
                <th style={{ textAlign: 'center' }}>Bills</th>
                <th style={{ textAlign: 'center' }}>Total GST</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'center' }}>Submitted On</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleRequests.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: 'var(--bp-muted)' }}>
                    No past {returnType} filing requests found.
                  </td>
                </tr>
              ) : (
                visibleRequests.map((req) => (
                  <tr key={req.id}>
                    <td style={{ fontWeight: 700 }}>REQ-{String(req.id).padStart(4, '0')}</td>
                    <td style={{ fontWeight: 700, color: 'var(--bp-navy)' }}>{formatPeriod(req.filing_period)}</td>
                    <td>{req.return_type}</td>
                    <td>{req.total_bills}</td>
                    <td style={{ fontWeight: 700 }}>₹{Number(req.total_gst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td>{getStatusBadge(req.status)}</td>
                    <td>{formatDateOnly(req.created_at)}</td>
                    <td>
                      <button
                        className="bp-btn bp-btn-outline"
                        style={{
                          height: 28,
                          padding: '0 10px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          borderColor: '#2563eb',
                          color: '#2563eb',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 700
                        }}
                        onClick={() => handleViewRequestDetails(req.id)}
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
      </div>

      {/* Confirm Modal */}
      {showConfirmModal && previewData && (
        <div className="cf-modal" style={{
          position: 'fixed', inset: 0, background: 'rgba(22, 58, 82, 0.4)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px'
        }}>
          <div className="bp-card cf-card" style={{ width: '100%', maxWidth: '440px', padding: 0, overflow: 'hidden', background: '#fff' }}>
            <div className="cf-head" style={{ padding: '16px 20px', borderBottom: '1px solid var(--bp-border)', background: '#f8fafc' }}>
              <h3 style={{ margin: 0, fontSize: 16, color: 'var(--bp-navy)' }}>Confirm Submission</h3>
            </div>
            <div className="cf-body" style={{ padding: 20 }}>
              <p style={{ margin: '0 0 16px 0', color: 'var(--bp-text)', fontWeight: 600 }}>
                Are you sure you want to send this {returnType} filing request to the CA?
              </p>
              
              <div className="cf-sum" style={{ background: '#f0f7ff', padding: 16, borderRadius: 8, display: 'grid', gap: 8, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--bp-muted)' }}>Filing Period:</span> <span style={{ fontWeight: 700 }}>{formatPeriod(effectivePeriod)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--bp-muted)' }}>Total Invoices:</span> <span style={{ fontWeight: 700 }}>{previewData.summary.total_bills}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--bp-muted)' }}>Taxable Value:</span> <span style={{ fontWeight: 700 }}>₹{previewData.summary.taxable_value.toFixed(2)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--bp-border)', paddingTop: 8, marginTop: 4 }}>
                  <span style={{ fontWeight: 800, color: 'var(--bp-navy)' }}>Total GST:</span> 
                  <span style={{ fontWeight: 800, color: '#166534' }}>₹{previewData.summary.total_gst.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="cf-foot" style={{ padding: '12px 20px 16px', borderTop: '1px solid var(--bp-border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button 
                onClick={() => setShowConfirmModal(false)}
                className="bp-btn bp-btn-outline"
                style={{ height: 36, borderRadius: 6 }}
              >
                Cancel
              </button>
              <button 
                onClick={handleSubmitRequest}
                disabled={submitting}
                className="bp-btn bp-btn-primary"
                style={{ height: 36, borderRadius: 6, background: '#0052cc' }}
              >
                {submitting ? 'Sending...' : 'Send Request to CA'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details View Modal */}
      {selectedRequestDetail && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(22, 58, 82, 0.4)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 101, padding: '20px'
        }}>
          <div className="bp-card" style={{ width: '100%', maxWidth: '750px', padding: 0, overflow: 'hidden', background: '#fff' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bp-border)', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 16, color: 'var(--bp-navy)', fontWeight: 800 }}>
                Request Details: REQ-{String(selectedRequestDetail.id).padStart(4, '0')}
              </h3>
              <button 
                type="button" 
                onClick={() => setSelectedRequestDetail(null)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--bp-muted)' }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: 20, maxHeight: '450px', overflowY: 'auto' }}>
              <div className="bp-stat-grid-3" style={{ gap: 16, marginBottom: 20, background: '#f8fafc', padding: 14, borderRadius: 8 }}>
                <div><span style={{ fontSize: 11, color: 'var(--bp-muted)', fontWeight: 600 }}>Period:</span> <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--bp-navy)' }}>{formatPeriod(selectedRequestDetail.filing_period)}</div></div>
                <div><span style={{ fontSize: 11, color: 'var(--bp-muted)', fontWeight: 600 }}>Status:</span> <div>{getStatusBadge(selectedRequestDetail.status)}</div></div>
                <div><span style={{ fontSize: 11, color: 'var(--bp-muted)', fontWeight: 600 }}>Total GST:</span> <div style={{ fontSize: 14, fontWeight: 700, color: '#166534' }}>₹{Number(selectedRequestDetail.total_gst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div></div>
              </div>

              <h4 style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--bp-navy)', fontWeight: 800 }}>Attached Invoices</h4>
              <div className="bp-table-wrapper" style={{ overflowX: 'auto', border: '1px solid var(--bp-border)', borderRadius: 6 }}>
                <table className="bp-table bp-doc-table" style={{ margin: 0, width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Invoice No</th>
                      <th>Date</th>
                      <th style={{ textAlign: 'right' }}>Taxable Amt</th>
                      <th style={{ textAlign: 'right' }}>Total GST</th>
                      <th style={{ textAlign: 'right' }}>Total Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedRequestDetail.documents || []).map((doc) => (
                      <tr key={doc.id}>
                        <td style={{ fontWeight: 700 }}>{doc.number}</td>
                        <td>{formatDateOnly(doc.document_date)}</td>
                        <td style={{ textAlign: 'right' }}>₹{Number(doc.taxable_amount).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>₹{(Number(doc.cgst_amount) + Number(doc.sgst_amount) + Number(doc.igst_amount)).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{Number(doc.total_amount).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div style={{ padding: '12px 20px 16px', borderTop: '1px solid var(--bp-border)', display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setSelectedRequestDetail(null)}
                className="bp-btn bp-btn-primary"
                style={{ height: 36, borderRadius: 6, background: '#0052cc' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
