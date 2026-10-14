import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api, getAuthToken } from '../../../api/client';
import { useAdminFy } from '../../../context/AdminFyContext';
import { getDocTypeConfig } from './billingConstants';
import AdminEditCreationDateModal from './components/AdminEditCreationDateModal';
import AdminCancelDocumentModal from './components/AdminCancelDocumentModal';
import AdminDeleteDocumentModal from './components/AdminDeleteDocumentModal';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Format ISO or YYYY-MM-DD date string to "DD Mon YYYY" from IST string without browser timezone shift.
 */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const year = m[1];
    const monthIdx = parseInt(m[2], 10) - 1;
    const day = m[3];
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${day} ${MONTHS[monthIdx]} ${year}`;
    }
  }
  return dateStr;
}

/**
 * Format ISO timestamp to "DD Mon YYYY, hh:mm AM/PM" from IST string without timezone conversion.
 */
function formatDateTime(isoStr) {
  if (!isoStr) return '—';
  const m = String(isoStr).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (m) {
    const year = m[1];
    const monthIdx = parseInt(m[2], 10) - 1;
    const day = m[3];
    let hour = parseInt(m[4], 10);
    const min = m[5];
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    if (hour === 0) hour = 12;
    const hourStr = String(hour).padStart(2, '0');
    const monthStr = MONTHS[monthIdx] || m[2];
    return `${day} ${monthStr} ${year}, ${hourStr}:${min} ${ampm}`;
  }
  return isoStr;
}

/**
 * Format Indian currency with 2 decimals.
 */
function formatCurrency(val) {
  const num = Number(val);
  if (isNaN(num)) return '₹0.00';
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Format address joining non-empty parts only (same rule as 3A):
 * No stray "," or "-" when state/pincode is missing.
 */
function formatAddress(input) {
  if (!input) return '';
  if (typeof input === 'object') {
    const parts = [input.address_line_1, input.address_line_2, input.city]
      .map((s) => (s ? String(s).trim() : ''))
      .filter(Boolean);

    const state = input.state ? String(input.state).trim() : '';
    const pincode = input.pincode ? String(input.pincode).trim() : '';

    if (state && pincode) {
      parts.push(`${state} - ${pincode}`);
    } else if (state) {
      parts.push(state);
    } else if (pincode) {
      parts.push(pincode);
    }

    if (parts.length > 0) {
      return parts.join(', ');
    }
    input = input.address || input.billing_address || '';
  }

  if (typeof input !== 'string') return '';

  return input
    .split(',')
    .map((part) => {
      let p = part.trim();
      p = p.replace(/^[-–—\s]+/, '');
      p = p.replace(/[-–—\s]+$/, '');
      return p.trim();
    })
    .filter((part) => part.length > 0 && part !== '-' && part !== '–' && part !== '—')
    .join(', ');
}

export default function AdminBillingDocumentDetail() {
  const { clientId, docType: docTypeParam, id } = useParams();
  const navigate = useNavigate();
  const adminFyCtx = useAdminFy();
  const fy = adminFyCtx?.fy;
  const registerRefresh = adminFyCtx?.registerRefresh;

  const docConfig = useMemo(() => getDocTypeConfig(docTypeParam), [docTypeParam]);

  const [docData, setDocData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [is404, setIs404] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Modals state
  const [editDateOpen, setEditDateOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Busy state for in-flight requests
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Stale request guard
  const reqIdRef = useRef(0);

  const fetchDocument = useCallback(() => {
    if (!docConfig) return Promise.resolve();
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    setIs404(false);

    const endpoint = `/admin/billing/client-directory/${clientId}/documents/${docConfig.key}/${id}`;

    return api(endpoint)
      .then((json) => {
        if (reqId === reqIdRef.current && json) {
          setDocData(json);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (reqId === reqIdRef.current) {
          if (err?.status === 404) {
            setIs404(true);
          } else {
            setError(err?.message || 'Error loading document.');
          }
          setLoading(false);
        }
      });
  }, [clientId, docConfig, id]);

  useEffect(() => {
    fetchDocument();
  }, [fetchDocument]);

  // Hook refresh into AdminFyContext
  useEffect(() => {
    if (!registerRefresh) return;
    const unregister = registerRefresh(() => {
      return fetchDocument();
    });
    return () => {
      if (typeof unregister === 'function') unregister();
    };
  }, [registerRefresh, fetchDocument]);

  // PDF Download Handler (authenticated blob request)
  const handleDownloadPdf = async () => {
    if (!docConfig || downloadingPdf) return;
    setDownloadingPdf(true);
    setActionSuccess(null);

    const docNumber = docData?.document?.number || 'document';
    const pdfPath = `/admin/billing/client-directory/${clientId}/documents/${docConfig.key}/${id}/pdf`;
    const token = getAuthToken();

    try {
      const res = await fetch('/api' + pdfPath, {
        headers: {
          Accept: 'application/pdf',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.message || `Failed to download PDF (HTTP ${res.status})`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${docNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err?.message || 'Error downloading PDF.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Unknown docType
  if (!docConfig) {
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 60 }}>
        <div style={{ fontSize: 13, color: '#2563eb', marginBottom: 12, fontWeight: 500 }}>
          <Link to="/admin/billing" style={{ color: '#2563eb', textDecoration: 'none' }}>Billing</Link>
          <span style={{ margin: '0 6px', color: '#94a3b8' }}>&gt;</span>
          <span style={{ color: '#64748b' }}>Unknown document type</span>
        </div>
        <div
          className="bp-card"
          style={{
            background: '#ffffff',
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            padding: '48px 24px',
            textAlign: 'center',
            maxWidth: 600,
            margin: '40px auto',
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>
            Unknown Document Type
          </h2>
          <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 24px' }}>
            The document type &quot;{docTypeParam}&quot; does not exist.
          </p>
          <Link
            to={`/admin/billing/${clientId}`}
            className="bp-btn bp-btn-primary"
            style={{
              background: '#2563eb',
              color: '#ffffff',
              padding: '10px 22px',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 13.5,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            ← Back to Client Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // 404 Not Found
  if (is404) {
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 60 }}>
        <div style={{ fontSize: 13, color: '#2563eb', marginBottom: 12, fontWeight: 500 }}>
          <Link to="/admin/billing" style={{ color: '#2563eb', textDecoration: 'none' }}>Billing</Link>
          <span style={{ margin: '0 6px', color: '#94a3b8' }}>&gt;</span>
          <Link to={`/admin/billing/${clientId}`} style={{ color: '#2563eb', textDecoration: 'none' }}>Client Dashboard</Link>
          <span style={{ margin: '0 6px', color: '#94a3b8' }}>&gt;</span>
          <Link to={`/admin/billing/${clientId}/${docConfig.slug}`} style={{ color: '#2563eb', textDecoration: 'none' }}>{docConfig.pluralLabel}</Link>
        </div>
        <div
          className="bp-card"
          style={{
            background: '#ffffff',
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            padding: '48px 24px',
            textAlign: 'center',
            maxWidth: 600,
            margin: '40px auto',
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>
            Document Not Found
          </h2>
          <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 24px' }}>
            The requested {docConfig.label.toLowerCase()} (#{id}) does not exist or has been removed.
          </p>
          <Link
            to={`/admin/billing/${clientId}/${docConfig.slug}`}
            className="bp-btn bp-btn-primary"
            style={{
              background: '#2563eb',
              color: '#ffffff',
              padding: '10px 22px',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 13.5,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            ← Back to {docConfig.pluralLabel}
          </Link>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 60 }}>
        <div style={{ padding: '80px 20px', textAlign: 'center', color: '#64748b' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <div style={{ fontSize: 15, fontWeight: 650 }}>Loading {docConfig.label.toLowerCase()} details…</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !docData) {
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 60 }}>
        <div
          className="bp-card"
          style={{
            background: '#ffffff',
            borderRadius: 12,
            border: '1px solid #fee2e2',
            padding: '40px 24px',
            textAlign: 'center',
            maxWidth: 600,
            margin: '40px auto',
          }}
        >
          <div style={{ color: '#ef4444', fontSize: 15, fontWeight: 650, marginBottom: 16 }}>
            {error}
          </div>
          <button
            type="button"
            onClick={fetchDocument}
            className="bp-btn bp-btn-primary"
            style={{
              background: '#2563eb',
              color: '#ffffff',
              padding: '8px 20px',
              borderRadius: 6,
              border: 'none',
              fontWeight: 650,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const doc = docData?.document || {};
  const gst = docData?.gst || { status: '-', filed_on: null, ack_no: null };
  const flags = docData?.flags || { can_edit_creation_date: false, can_cancel: false, can_delete: false };
  const seller = docData?.seller || {};
  const customer = docData?.customer;
  const lineItems = docData?.line_items || [];
  const summary = docData?.summary || {};

  const sellerAddress = formatAddress(seller.address || seller);
  const customerAddress = customer ? formatAddress(customer.address || customer) : '';

  const isCancelled = doc.status === 'cancelled';
  const isDeleted = doc.status === 'deleted';
  const isFiled = gst.status === 'Filed';

  // Check if GST box should be hidden: '-' when quotation or delivery_challan
  const isNonGstType = docConfig.key === 'quotation' || docConfig.key === 'delivery_challan';
  const hideGstBox = gst.status === '-' && isNonGstType;

  // Status badge styling
  let statusBadgeBg = '#dcfce7';
  let statusBadgeText = '#15803d';
  let statusBadgeBorder = '#bbf7d0';
  let statusLabel = 'Active';

  if (isCancelled) {
    statusBadgeBg = '#fee2e2';
    statusBadgeText = '#b91c1c';
    statusBadgeBorder = '#fca5a5';
    statusLabel = 'Cancelled';
  } else if (isDeleted) {
    statusBadgeBg = '#f1f5f9';
    statusBadgeText = '#64748b';
    statusBadgeBorder = '#e2e8f0';
    statusLabel = 'Deleted';
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 60 }}>
      {/* 1. Breadcrumb */}
      <div style={{ fontSize: 13, color: '#2563eb', marginBottom: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <Link to="/admin/billing" style={{ color: '#2563eb', textDecoration: 'none' }}>Billing</Link>
        <span style={{ color: '#94a3b8' }}>&gt;</span>
        <Link to={`/admin/billing/${clientId}`} style={{ color: '#2563eb', textDecoration: 'none' }}>Client Dashboard</Link>
        <span style={{ color: '#94a3b8' }}>&gt;</span>
        <Link to={`/admin/billing/${clientId}/${docConfig.slug}`} style={{ color: '#2563eb', textDecoration: 'none' }}>{docConfig.pluralLabel}</Link>
        <span style={{ color: '#94a3b8' }}>&gt;</span>
        <span style={{ color: '#1e293b', fontWeight: 600 }}>View {docConfig.shortLabel}</span>
      </div>

      {/* Success Banner */}
      {actionSuccess && (
        <div
          style={{
            padding: '10px 16px',
            borderRadius: 8,
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>✓ {actionSuccess}</span>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            style={{ background: 'none', border: 'none', color: '#065f46', cursor: 'pointer', fontSize: 16 }}
          >
            ×
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div
          style={{
            padding: '10px 16px',
            borderRadius: 8,
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>⚠️ {error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: 16 }}
          >
            ×
          </button>
        </div>
      )}

      {/* 2. Top Header Strip: Title, Subtitle, Payment status, and Right Status/GST box */}
      <div
        className="bp-card"
        style={{
          background: '#ffffff',
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          padding: '18px 22px',
          marginBottom: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
            {docConfig.label} • {doc.number}
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13, color: '#64748b' }}>
            <span>{formatDateTime(doc.created_at)}</span>

            {/* Payment badge ONLY when payment_status is not null */}
            {doc.payment_status && (
              <span
                style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 700,
                  background:
                    doc.payment_status === 'Paid'
                      ? '#dcfce7'
                      : doc.payment_status === 'Partial'
                      ? '#fef3c7'
                      : '#fee2e2',
                  color:
                    doc.payment_status === 'Paid'
                      ? '#15803d'
                      : doc.payment_status === 'Partial'
                      ? '#b45309'
                      : '#b91c1c',
                  border: `1px solid ${
                    doc.payment_status === 'Paid'
                      ? '#bbf7d0'
                      : doc.payment_status === 'Partial'
                      ? '#fde68a'
                      : '#fca5a5'
                  }`,
                }}
              >
                {doc.payment_status}
              </span>
            )}
          </div>
        </div>

        {/* Right side: Status badge & GST Status box */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Status Badge */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
              background: statusBadgeBg,
              color: statusBadgeText,
              border: `1px solid ${statusBadgeBorder}`,
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusBadgeText }} />
            {statusLabel}
          </span>

          {/* GST Status Box (hidden for quotation/delivery_challan if status is '-') */}
          {!hideGstBox && (
            <div
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 650,
                background: isFiled ? '#ecfdf5' : gst.status === 'Not Filed' ? '#fef2f2' : '#f8fafc',
                color: isFiled ? '#065f46' : gst.status === 'Not Filed' ? '#dc2626' : '#64748b',
                border: `1px solid ${isFiled ? '#a7f3d0' : gst.status === 'Not Filed' ? '#fecaca' : '#cbd5e1'}`,
                textAlign: 'right',
              }}
            >
              <div>GST Status: {gst.status}</div>
              {isFiled && (
                <div style={{ fontSize: 11, fontWeight: 500, color: '#047857', marginTop: 2 }}>
                  Filed on: {formatDate(gst.filed_on)} | ARN: {gst.ack_no || '—'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3. Action Buttons Bar */}
      <div
        className="bp-card"
        style={{
          background: '#ffffff',
          borderRadius: 10,
          border: '1px solid #e2e8f0',
          padding: '12px 16px',
          marginBottom: 16,
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 10,
        }}
      >
        {/* 1. Back */}
        <button
          type="button"
          onClick={() => navigate(`/admin/billing/${clientId}/${docConfig.slug}`)}
          style={{
            padding: '7px 14px',
            borderRadius: 6,
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            color: '#1e293b',
            fontSize: 12.5,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>←</span> Back
        </button>

        {/* 2. Edit (always disabled, tooltip "Coming soon") */}
        <button
          type="button"
          disabled
          title="Coming soon"
          style={{
            padding: '7px 14px',
            borderRadius: 6,
            border: '1px solid #cbd5e1',
            background: '#f1f5f9',
            color: '#94a3b8',
            fontSize: 12.5,
            fontWeight: 600,
            cursor: 'not-allowed',
            opacity: 0.6,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>✏️</span> Edit
        </button>

        {/* 3. Edit Creation Date */}
        <button
          type="button"
          disabled={!flags.can_edit_creation_date || isDeleted}
          onClick={() => setEditDateOpen(true)}
          style={{
            padding: '7px 14px',
            borderRadius: 6,
            border: '1px solid #bfdbfe',
            background: flags.can_edit_creation_date && !isDeleted ? '#eff6ff' : '#f1f5f9',
            color: flags.can_edit_creation_date && !isDeleted ? '#2563eb' : '#94a3b8',
            fontSize: 12.5,
            fontWeight: 600,
            cursor: flags.can_edit_creation_date && !isDeleted ? 'pointer' : 'not-allowed',
            opacity: flags.can_edit_creation_date && !isDeleted ? 1 : 0.6,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>📅</span> Edit Creation Date
        </button>

        {/* 4. Download PDF */}
        <button
          type="button"
          disabled={downloadingPdf}
          onClick={handleDownloadPdf}
          style={{
            padding: '7px 16px',
            borderRadius: 6,
            border: 'none',
            background: '#1e3a8a',
            color: '#ffffff',
            fontSize: 12.5,
            fontWeight: 650,
            cursor: downloadingPdf ? 'wait' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>⬇️</span> {downloadingPdf ? 'Downloading…' : 'Download PDF'}
        </button>

        {/* 5. Email (disabled, tooltip "Coming soon") */}
        <button
          type="button"
          disabled
          title="Coming soon"
          style={{
            padding: '7px 14px',
            borderRadius: 6,
            border: '1px solid #cbd5e1',
            background: '#f1f5f9',
            color: '#94a3b8',
            fontSize: 12.5,
            fontWeight: 600,
            cursor: 'not-allowed',
            opacity: 0.6,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>✉️</span> Email
        </button>

        {/* 6. WhatsApp (disabled, tooltip "Coming soon") */}
        <button
          type="button"
          disabled
          title="Coming soon"
          style={{
            padding: '7px 14px',
            borderRadius: 6,
            border: '1px solid #cbd5e1',
            background: '#f1f5f9',
            color: '#94a3b8',
            fontSize: 12.5,
            fontWeight: 600,
            cursor: 'not-allowed',
            opacity: 0.6,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>💬</span> WhatsApp
        </button>

        {/* 7. Cancel */}
        <button
          type="button"
          disabled={!flags.can_cancel || isDeleted}
          onClick={() => setCancelOpen(true)}
          style={{
            padding: '7px 14px',
            borderRadius: 6,
            border: '1px solid #fecaca',
            background: flags.can_cancel && !isDeleted ? '#fef2f2' : '#f1f5f9',
            color: flags.can_cancel && !isDeleted ? '#dc2626' : '#94a3b8',
            fontSize: 12.5,
            fontWeight: 600,
            cursor: flags.can_cancel && !isDeleted ? 'pointer' : 'not-allowed',
            opacity: flags.can_cancel && !isDeleted ? 1 : 0.6,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>⊘</span> Cancel
        </button>

        {/* 8. Delete */}
        <button
          type="button"
          disabled={!flags.can_delete || isDeleted}
          onClick={() => setDeleteOpen(true)}
          style={{
            padding: '7px 14px',
            borderRadius: 6,
            border: 'none',
            background: flags.can_delete && !isDeleted ? '#dc2626' : '#f1f5f9',
            color: flags.can_delete && !isDeleted ? '#ffffff' : '#94a3b8',
            fontSize: 12.5,
            fontWeight: 650,
            cursor: flags.can_delete && !isDeleted ? 'pointer' : 'not-allowed',
            opacity: flags.can_delete && !isDeleted ? 1 : 0.6,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>🗑️</span> Delete
        </button>
      </div>

      {/* Cancelled Note (when status is cancelled) */}
      {isCancelled && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            fontSize: 12.5,
            marginBottom: 16,
          }}
        >
          <strong>Cancelled</strong>
          {doc.cancelled_at && ` on ${formatDateTime(doc.cancelled_at)}`}
          {doc.cancelled_by_name && ` by ${doc.cancelled_by_name}`}.
          {doc.cancellation_reason && (
            <span style={{ marginLeft: 6 }}>Reason: &quot;{doc.cancellation_reason}&quot;</span>
          )}
        </div>
      )}

      {/* Deleted Note (when status is deleted) */}
      {isDeleted && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            color: '#475569',
            fontSize: 12.5,
            marginBottom: 16,
          }}
        >
          <strong>This document is soft-deleted.</strong> Action buttons are disabled. PDF download remains available for audit purposes.
        </div>
      )}

      {/* 4. Parties & Document Information Box (Side by Side) */}
      <div
        className="bp-card"
        style={{
          background: '#ffffff',
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          padding: '20px',
          marginBottom: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 1fr)',
          gap: 24,
        }}
      >
        {/* Left Column: From (Seller) & To (Buyer) */}
        <div>
          {/* Seller Block */}
          <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
              From (Seller)
            </div>
            <div style={{ fontSize: 16, fontWeight: 750, color: '#0f172a', marginBottom: 4 }}>
              {seller.business_name || '—'}
            </div>
            <div style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.6 }}>
              <div>
                <strong>GSTIN:</strong> {seller.gstin || '—'} | <strong>PAN:</strong> {seller.pan || '—'}
              </div>
              {sellerAddress && <div>{sellerAddress}</div>}
              <div>
                {seller.email && <span>Email: {seller.email}</span>}
                {seller.email && seller.phone && <span> | </span>}
                {seller.phone && <span>Mob: {seller.phone}</span>}
              </div>
            </div>
          </div>

          {/* Buyer Block */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
              To (Buyer)
            </div>
            {customer ? (
              <div style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.6 }}>
                <div style={{ fontSize: 15, fontWeight: 750, color: '#0f172a', marginBottom: 2 }}>
                  {customer.name}
                </div>
                <div>
                  <strong>GSTIN:</strong> {customer.gstin || '—'} | <strong>State:</strong> {customer.state || '—'}
                </div>
                {(customer.email || customer.phone) && (
                  <div>
                    {customer.email && <span>Email: {customer.email}</span>}
                    {customer.email && customer.phone && <span> | </span>}
                    {customer.phone && <span>Mob: {customer.phone}</span>}
                  </div>
                )}
                {customerAddress && <div>Office: {customerAddress}</div>}
                <div>
                  <strong>Place of Supply:</strong> {doc.place_of_supply || customer.place_of_supply || '—'} | {doc.supply_type || '—'}
                </div>
                {doc.notes && (
                  <div style={{ marginTop: 4, color: '#0f172a', fontWeight: 500 }}>
                    <strong>Notes:</strong> {doc.notes}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: '#94a3b8' }}>—</div>
            )}
          </div>
        </div>

        {/* Right Column: Logo/Tagline & Document Info Box */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Logo & Tagline */}
          <div style={{ textAlign: 'right' }}>
            {seller.logo_url ? (
              <img
                src={seller.logo_url}
                alt="Seller Logo"
                style={{ maxHeight: 48, maxWidth: 180, objectFit: 'contain' }}
              />
            ) : (
              <div style={{ fontSize: 18, fontWeight: 800, color: '#2563eb' }}>
                {seller.business_name || 'AB KHAN & ASSOCIATES'}
              </div>
            )}
            {seller.tagline && (
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, letterSpacing: '0.05em', marginTop: 4 }}>
                {seller.tagline}
              </div>
            )}
          </div>

          {/* Document Information Box */}
          <div
            style={{
              background: '#f8fafc',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              fontSize: 12.5,
            }}
          >
            {/* Number Row */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ width: '45%', padding: '9px 12px', background: '#f1f5f9', fontWeight: 650, color: '#475569' }}>
                {docConfig.numberLabel}
              </div>
              <div style={{ width: '55%', padding: '9px 12px', fontWeight: 750, color: '#0f172a' }}>
                {doc.number}
              </div>
            </div>

            {/* Date Row */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ width: '45%', padding: '9px 12px', background: '#f1f5f9', fontWeight: 650, color: '#475569' }}>
                {docConfig.dateLabel}
              </div>
              <div style={{ width: '55%', padding: '9px 12px', color: '#1e293b' }}>
                {formatDate(doc.document_date)}
              </div>
            </div>

            {/* Creation Date Row */}
            <div style={{ display: 'flex', borderBottom: gst.status !== '-' ? '1px solid #e2e8f0' : 'none' }}>
              <div style={{ width: '45%', padding: '9px 12px', background: '#f1f5f9', fontWeight: 650, color: '#475569' }}>
                Creation Date
              </div>
              <div style={{ width: '55%', padding: '9px 12px', color: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{formatDateTime(doc.created_at)}</span>
                {flags.can_edit_creation_date && !isDeleted && (
                  <button
                    type="button"
                    onClick={() => setEditDateOpen(true)}
                    title="Edit Creation Date"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      cursor: 'pointer',
                      fontSize: 13,
                      padding: '2px 4px',
                    }}
                  >
                    📅
                  </button>
                )}
              </div>
            </div>

            {/* GST Rows (Hidden when gst.status === '-') */}
            {gst.status !== '-' && (
              <>
                <div style={{ display: 'flex', borderBottom: isFiled ? '1px solid #e2e8f0' : 'none' }}>
                  <div style={{ width: '45%', padding: '9px 12px', background: '#f1f5f9', fontWeight: 650, color: '#475569' }}>
                    GST Filed On
                  </div>
                  <div style={{ width: '55%', padding: '9px 12px' }}>
                    {isFiled ? (
                      <span style={{ color: '#047857', fontWeight: 600 }}>{formatDate(gst.filed_on)}</span>
                    ) : (
                      <span style={{ color: '#dc2626', fontWeight: 600 }}>Not Filed</span>
                    )}
                  </div>
                </div>

                {isFiled && (
                  <div style={{ display: 'flex' }}>
                    <div style={{ width: '45%', padding: '9px 12px', background: '#f1f5f9', fontWeight: 650, color: '#475569' }}>
                      ARN No.
                    </div>
                    <div style={{ width: '55%', padding: '9px 12px', color: '#1e293b', fontFamily: 'monospace' }}>
                      {gst.ack_no || '—'}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* 5. Item Table Card */}
      <div
        className="bp-card"
        style={{
          background: '#ffffff',
          borderRadius: 10,
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          overflow: 'hidden',
          marginBottom: 16,
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: '#1e3a8a', color: '#ffffff', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                <th style={{ padding: '10px 10px', width: 45, textAlign: 'center' }}>Sr. No.</th>
                <th style={{ padding: '10px 12px', fontWeight: 700 }}>Particulars</th>
                <th style={{ padding: '10px 10px', fontWeight: 700, textAlign: 'center' }}>HSN/SAC</th>
                <th style={{ padding: '10px 10px', fontWeight: 700, textAlign: 'right' }}>QTY</th>
                <th style={{ padding: '10px 10px', fontWeight: 700, textAlign: 'center' }}>UQC</th>
                <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'right' }}>Rate (₹)</th>
                <th style={{ padding: '10px 10px', fontWeight: 700, textAlign: 'right' }}>GST %</th>
                <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'right' }}>Taxable Value (₹)</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                    No items recorded on this {docConfig.label.toLowerCase()}.
                  </td>
                </tr>
              ) : (
                lineItems.map((item, idx) => (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: idx % 2 === 1 ? '#f8fafc' : '#ffffff',
                    }}
                  >
                    <td style={{ padding: '9px 10px', textAlign: 'center', color: '#94a3b8' }}>
                      {item.sr_no || idx + 1}
                    </td>
                    <td style={{ padding: '9px 12px', color: '#0f172a', fontWeight: 600 }}>
                      {item.description || '—'}
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'center', color: '#64748b', fontFamily: 'monospace' }}>
                      {item.hsn_sac || '—'}
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', color: '#1e293b' }}>
                      {item.qty}
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'center', color: '#64748b' }}>
                      {item.unit || 'NOS'}
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', color: '#334155' }}>
                      {Number(item.rate).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', color: '#64748b' }}>
                      {item.gst_rate}%
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 650, color: '#0f172a' }}>
                      {Number(item.taxable_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Terms & Conditions and Summary Box (Side by side) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.2fr) minmax(320px, 1fr)',
          gap: 16,
          marginBottom: 16,
        }}
      >
        {/* Left: Terms & Conditions */}
        <div
          className="bp-card"
          style={{
            background: '#ffffff',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            padding: '16px 18px',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 750, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
            Terms &amp; Conditions:
          </div>
          <div style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {doc.terms && doc.terms.trim() ? doc.terms : '-'}
          </div>
        </div>

        {/* Right: Summary Box */}
        <div
          className="bp-card"
          style={{
            background: '#ffffff',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            padding: '16px 18px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
            {/* Total Taxable Value */}
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
              <span>Total Taxable Value</span>
              <strong style={{ color: '#0f172a' }}>{formatCurrency(summary.taxable)}</strong>
            </div>

            {/* Tax rows (Bill of supply has none; others show only if non-zero) */}
            {docConfig.key !== 'bill_of_supply' && (
              <>
                {Number(summary.igst) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                    <span>IGST</span>
                    <strong style={{ color: '#0f172a' }}>{formatCurrency(summary.igst)}</strong>
                  </div>
                )}
                {Number(summary.cgst) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                    <span>CGST</span>
                    <strong style={{ color: '#0f172a' }}>{formatCurrency(summary.cgst)}</strong>
                  </div>
                )}
                {Number(summary.sgst) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                    <span>SGST</span>
                    <strong style={{ color: '#0f172a' }}>{formatCurrency(summary.sgst)}</strong>
                  </div>
                )}
              </>
            )}

            {/* Round Off */}
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
              <span>Round Off</span>
              <strong style={{ color: '#0f172a' }}>{formatCurrency(summary.round_off)}</strong>
            </div>

            {/* Grand Total */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                borderTop: '2px solid #e2e8f0',
                paddingTop: 8,
                marginTop: 2,
                fontSize: 15,
                fontWeight: 800,
                color: '#0f172a',
              }}
            >
              <span>Grand Total</span>
              <span style={{ color: '#2563eb' }}>{formatCurrency(summary.grand_total)}</span>
            </div>

            {/* Amount in Words (Exact as returned by API) */}
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 8, marginTop: 4, fontSize: 11.5, color: '#64748b' }}>
              <div style={{ fontWeight: 700, color: '#475569', marginBottom: 2 }}>Amount in Words:</div>
              <div style={{ fontStyle: 'italic', color: '#1e293b' }}>
                {summary.amount_in_words || '—'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 7. Bottom Green Info Note ONLY when GST is Filed */}
      {isFiled && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 8,
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            color: '#166534',
            fontSize: 13,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span style={{ fontSize: 18 }}>ℹ️</span>
          <span>
            Since the GST Status is <strong>Filed</strong>, the buttons Edit, Edit Creation Date, Cancel and Delete are disabled.
          </span>
        </div>
      )}

      {/* Modals */}
      <AdminEditCreationDateModal
        isOpen={editDateOpen}
        onClose={() => setEditDateOpen(false)}
        onSuccess={() => {
          setActionSuccess('Creation date updated successfully.');
          fetchDocument();
        }}
        clientId={clientId}
        docTypeKey={docConfig.key}
        docId={id}
        currentCreatedAt={doc.created_at}
        fy={fy}
        docLabel={docConfig.label}
      />

      <AdminCancelDocumentModal
        isOpen={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onSuccess={() => {
          setActionSuccess('Document cancelled successfully.');
          fetchDocument();
        }}
        clientId={clientId}
        docTypeKey={docConfig.key}
        docId={id}
        docNumber={doc.number}
        docLabel={docConfig.label}
      />

      <AdminDeleteDocumentModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onSuccess={() => {
          navigate(`/admin/billing/${clientId}/${docConfig.slug}`, {
            state: { message: `${docConfig.label} deleted successfully.` },
          });
        }}
        clientId={clientId}
        docTypeKey={docConfig.key}
        docId={id}
        docNumber={doc.number}
        docLabel={docConfig.label}
        shortLabel={docConfig.shortLabel}
      />
    </div>
  );
}
