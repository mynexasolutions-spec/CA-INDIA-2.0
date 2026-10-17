import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { fyMonthOptions, fyQuarterPeriodOptions, periodLabel } from '../billing/billingUtils';
import Gstr2bReconciliationGateModal from '../../components/Gstr2bReconciliationGateModal';

function formatDateOnly(dStr) {
  if (!dStr) return '—';
  const date = new Date(dStr);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Self-contained "raise a filing request" flow used by the new GST Returns workspace
 * for BOTH tabs (returnType is 'GSTR-1' or 'GSTR-3B'). Deliberately a fresh component
 * rather than an extraction from GstFilingConfirmation.jsx (the existing, separate
 * "GST Filing Confirmation" nav page — /portal/gst-filing, untouched by this feature) —
 * same preview -> declare -> submit interaction pattern, reimplemented so a bug here
 * can never affect that live page.
 *
 * GSTR-3B mandatory reconciliation gate (spec §6): after fetching the preview, if
 * `reconciliation_status === 'pending'`, the bill/declare/submit UI is replaced by the
 * blocking Gstr2bReconciliationGateModal and POST /client/gst-filing/request is never
 * called. This is defense-in-depth for the banner "Request Filing" button's period
 * picker — a period-row's own "Request Filing" action is already only shown by the
 * workspace when the period's status is not pending (see GstReturnsWorkspace.jsx).
 */
export default function GstFilingRequestFlow({ returnType, financialYear, quarterly, initialPeriod, onClose, onSubmitted }) {
  const [period, setPeriod] = useState(initialPeriod || '');
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [showGate, setShowGate] = useState(false);
  const [clientDeclaration, setClientDeclaration] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const periodOptions = quarterly ? fyQuarterPeriodOptions(financialYear) : fyMonthOptions(financialYear);
  const label = returnType;

  const fetchPreview = async (p) => {
    if (!p) return;
    setLoading(true);
    setError('');
    setPreviewData(null);
    setShowGate(false);
    setSuccessMessage('');
    setClientDeclaration(false);

    try {
      const params = new URLSearchParams({ financial_year: financialYear, filing_period: p, return_type: returnType });
      const res = await api(`/client/gst-filing/preview?${params.toString()}`);
      setPreviewData(res);

      if (returnType === 'GSTR-3B' && res.reconciliation_status === 'pending') {
        setShowGate(true);
      } else if (returnType === 'GSTR-3B' && res.reconciliation_status === 'completed') {
        setSuccessMessage('GSTR reconciliation for the selected period has been completed. You can now raise the filing request for GSTR-3B.');
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch billing data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialPeriod) fetchPreview(initialPeriod);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPeriod]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await api('/client/gst-filing/request', {
        method: 'POST',
        body: {
          financial_year: financialYear,
          filing_period: period,
          return_type: returnType,
          client_declaration: clientDeclaration,
        },
      });
      setShowConfirmModal(false);
      onSubmitted?.(res);
    } catch (err) {
      setError(err.message || 'Failed to submit request.');
      setShowConfirmModal(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bp-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="bp-modal"
        role="dialog"
        aria-modal="true"
        style={{ width: 720, maxWidth: '96vw', maxHeight: '90vh', overflowY: 'auto', padding: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bp-border)', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--bp-navy)' }}>Request {label} Filing</h3>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--bp-muted)' }}>×</button>
        </div>

        <div style={{ padding: 20 }}>
          {!initialPeriod && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 18 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--bp-navy)' }}>{quarterly ? 'Filing Quarter' : 'Filing Period (Month)'}</span>
                <select className="bp-select" style={{ height: 40, boxSizing: 'border-box', minWidth: 200 }} value={period} onChange={(e) => setPeriod(e.target.value)}>
                  <option value="">{quarterly ? 'Select Quarter' : 'Select Month'}</option>
                  {periodOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <button
                onClick={() => fetchPreview(period)}
                disabled={loading || !period}
                className="bp-btn bp-btn-primary"
                style={{ height: 40, borderRadius: 8, fontWeight: 600, background: '#0052cc' }}
              >
                {loading ? 'Fetching…' : 'Fetch Bills & Summary'}
              </button>
            </div>
          )}

          {loading && initialPeriod && <p style={{ color: 'var(--bp-muted)' }}>Fetching…</p>}
          {error && <p className="bp-alert bp-alert-error">{error}</p>}

          {showGate && (
            <Gstr2bReconciliationGateModal
              financialYear={financialYear}
              period={period}
              onClose={() => { setShowGate(false); onClose(); }}
            />
          )}

          {successMessage && (
            <div style={{ background: '#dcfce7', border: '1px solid #bbf7d0', color: '#166534', borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>✓ Reconciliation Completed —</span> {successMessage}
            </div>
          )}

          {previewData && !showGate && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <h4 style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--bp-navy)', fontWeight: 800 }}>
                  Bill Review ({previewData.summary.total_bills} Invoices)
                </h4>
                {previewData.bills.length > 0 ? (
                  <div className="bp-table-wrapper" style={{ overflowX: 'auto', border: '1px solid var(--bp-border)', borderRadius: 8 }}>
                    <table className="bp-table bp-doc-table" style={{ margin: 0, width: '100%' }}>
                      <thead>
                        <tr>
                          <th>Invoice No</th>
                          <th>Date</th>
                          <th style={{ textAlign: 'right' }}>Taxable (₹)</th>
                          <th style={{ textAlign: 'right' }}>Total GST (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.bills.map((bill) => (
                          <tr key={bill.id}>
                            <td style={{ fontWeight: 700 }}>{bill.number}</td>
                            <td>{formatDateOnly(bill.document_date)}</td>
                            <td style={{ textAlign: 'right' }}>₹{Number(bill.taxable_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{(Number(bill.cgst_amount) + Number(bill.sgst_amount) + Number(bill.igst_amount)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: 24, color: 'var(--bp-muted)' }}>No bills found for this period. You can proceed with a Nil Filing.</div>
                )}
              </div>

              <div className="bp-card" style={{ background: '#f0f7ff', border: '1px solid #bfdbfe', padding: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 16 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--bp-muted)' }}>TOTAL GST</div>
                    <div style={{ fontSize: 18, fontWeight: 850, color: '#2563eb' }}>₹{previewData.summary.total_gst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--bp-muted)' }}>TAXABLE VALUE</div>
                    <div style={{ fontSize: 18, fontWeight: 850, color: 'var(--bp-navy)' }}>₹{previewData.summary.taxable_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                  </div>
                </div>

                <div
                  style={{ padding: 12, display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', background: '#fff', borderRadius: 8, border: '1px solid var(--bp-border)' }}
                  onClick={() => setClientDeclaration(!clientDeclaration)}
                >
                  <input type="checkbox" style={{ width: 18, height: 18, marginTop: 2 }} checked={clientDeclaration} onChange={(e) => setClientDeclaration(e.target.checked)} onClick={(e) => e.stopPropagation()} />
                  <div style={{ fontSize: 13, lineHeight: 1.5, fontWeight: 600 }}>
                    “I confirm that I have reviewed the above bills and GST summary and request the CA to proceed with GST filing (including Nil filing if applicable) for the selected period.”
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                  <button onClick={() => setShowConfirmModal(true)} disabled={!clientDeclaration} className="bp-btn bp-btn-green" style={{ padding: '10px 22px', fontSize: 14, fontWeight: 700, borderRadius: 8 }}>
                    Send {label} Filing Request
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {showConfirmModal && previewData && (
          <div className="cf-modal" style={{ position: 'fixed', inset: 0, background: 'rgba(22, 58, 82, 0.4)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
            <div className="bp-card cf-card" style={{ width: '100%', maxWidth: 420, padding: 0, overflow: 'hidden', background: '#fff' }}>
              <div className="cf-head" style={{ padding: '14px 18px', borderBottom: '1px solid var(--bp-border)', background: '#f8fafc' }}>
                <h3 style={{ margin: 0, fontSize: 15, color: 'var(--bp-navy)' }}>Confirm Submission</h3>
              </div>
              <div className="cf-body" style={{ padding: 18 }}>
                <p style={{ margin: '0 0 14px', fontWeight: 600 }}>
                  Are you sure you want to send this {label} filing request to the CA?
                </p>
                <div className="cf-sum" style={{ background: '#f0f7ff', padding: 14, borderRadius: 8, display: 'grid', gap: 6, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--bp-muted)' }}>Filing Period:</span><span style={{ fontWeight: 700 }}>{periodLabel(period)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--bp-border)', paddingTop: 6, marginTop: 2 }}>
                    <span style={{ fontWeight: 800, color: 'var(--bp-navy)' }}>Total GST:</span>
                    <span style={{ fontWeight: 800, color: '#166534' }}>₹{previewData.summary.total_gst.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              <div className="cf-foot" style={{ padding: '10px 18px 14px', borderTop: '1px solid var(--bp-border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button onClick={() => setShowConfirmModal(false)} className="bp-btn bp-btn-outline" style={{ height: 34, borderRadius: 6 }}>Cancel</button>
                <button onClick={handleSubmit} disabled={submitting} className="bp-btn bp-btn-primary" style={{ height: 34, borderRadius: 6, background: '#0052cc' }}>
                  {submitting ? 'Sending…' : 'Send Request to CA'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
