import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api, getAuthToken } from '../../../api/client';
import { useAdminFy } from '../../../context/AdminFyContext';
import { getDocTypeConfig, getDocumentActionDisabledReason } from './billingConstants';
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

function formatReasonForTransportation(reason, other) {
  switch (reason) {
    case 'job_work': return 'Job Work';
    case 'repair': return 'Repair';
    case 'returnable_goods': return 'Returnable Goods';
    case 'branch_transfer': return 'Branch Transfer';
    case 'other': return other || 'Other';
    default: return reason || '—';
  }
}

const ICON_PATHS = {
  back: <><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></>,
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>,
  mail: <><rect x="2" y="4" width="20" height="16" rx="2" /><polyline points="22 6 12 13 2 6" /></>,
  whatsapp: <><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /><path d="M9.5 9c.4 1.800 2 3.400 3.900 3.900l1-1a.7.7 0 0 1 .8-.2l1.400.600" /></>,
  ban: <><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></>,
  trash: <><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></>,
  check: <polyline points="20 6 9 17 4 12" />,
  alert: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
  info: <><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></>,
  doc: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></>,
};

function Icon({ name, size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      {ICON_PATHS[name]}
    </svg>
  );
}

const BTN_VARIANTS = {
  back:     { background: '#ffffff', color: '#1e3a8a', border: '1px solid #2563eb' },
  edit:     { background: '#2563eb', color: '#ffffff', border: '1px solid #2563eb' },
  date:     { background: '#ffffff', color: '#1e3a8a', border: '1px solid #2563eb' },
  pdf:      { background: '#0f3a8a', color: '#ffffff', border: '1px solid #0f3a8a' },
  email:    { background: '#f5a623', color: '#ffffff', border: '1px solid #f5a623' },
  whatsapp: { background: '#16a34a', color: '#ffffff', border: '1px solid #16a34a' },
  cancel:   { background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca' },
  delete:   { background: '#dc2626', color: '#ffffff', border: '1px solid #dc2626' },
};

function ActionBtn({ variant, icon, label, disabled, title, onClick, wait }) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      style={{
        ...BTN_VARIANTS[variant],
        padding: '8px 16px',
        borderRadius: 6,
        fontSize: 12.5,
        fontWeight: 650,
        cursor: disabled ? (wait ? 'wait' : 'not-allowed') : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        minWidth: 90,
        justifyContent: 'center',
      }}
    >
      <Icon name={icon} size={14} />
      {label}
    </button>
  );
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
          <div style={{ marginBottom: 12, color: '#dc2626', display: 'flex', justifyContent: 'center' }}><Icon name="alert" size={40} /></div>
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
            Back to Client Dashboard
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
          <div style={{ marginBottom: 12, color: '#64748b', display: 'flex', justifyContent: 'center' }}><Icon name="doc" size={40} /></div>
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
            Back to {docConfig.pluralLabel}
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
  const flags = docData?.flags || { can_edit: false, can_edit_creation_date: false, can_cancel: false, can_delete: false };
  const seller = docData?.seller || {};
  const customer = docData?.customer;
  const lineItems = docData?.line_items || [];
  const summary = docData?.summary || {};

  const sellerAddress = formatAddress(seller.address || seller);
  const customerAddress = customer ? formatAddress(customer.address || customer) : '';

  const isCancelled = doc.status === 'cancelled';
  const isDeleted = doc.status === 'deleted';
  const isFiled = gst.status === 'Filed';
  const isConverted = docConfig.key === 'quotation' && Boolean(doc.converted_document_id);

  // Check if GST box should be hidden: quotation or delivery_challan or status '-'
  const isNonGstType = docConfig.key === 'quotation' || docConfig.key === 'delivery_challan';
  const hideGstBox = isNonGstType || gst.status === '-';

  // Status badge styling
  let statusBadgeBg = '#dcfce7';
  let statusBadgeText = '#15803d';
  let statusBadgeBorder = '#bbf7d0';
  let statusLabel = 'Active';

  if (isConverted) {
    statusBadgeBg = '#f3e8ff';
    statusBadgeText = '#7e22ce';
    statusBadgeBorder = '#e9d5ff';
    statusLabel = 'Converted';
  } else if (isCancelled) {
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

  const editDisabledReason = getDocumentActionDisabledReason('edit', docData, docConfig?.key);
  const deleteDisabledReason = getDocumentActionDisabledReason('delete', docData, docConfig?.key);
  const cancelDisabledReason = getDocumentActionDisabledReason('cancel', docData, docConfig?.key);
  const editDateDisabledReason = getDocumentActionDisabledReason('edit_creation_date', docData, docConfig?.key);

  const shareMessage = () => {
    const total = formatCurrency(summary.grand_total);
    const link = doc.share_url ? `
View / download: ${doc.share_url}` : '';
    return `Dear ${customer?.name || 'Customer'},

Please find your ${docConfig.label} ${doc.number} dated ${formatDate(doc.document_date)} for ${total} from ${seller.business_name || 'us'}.${link}

Regards,
${seller.business_name || ''}`;
  };
  const handleEmail = () => {
    const subject = `${docConfig.label} ${doc.number} from ${seller.business_name || ''}`.trim();
    window.location.href = `mailto:${encodeURIComponent(customer.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(shareMessage())}`;
  };
  const handleWhatsapp = () => {
    let digits = String(customer.phone || '').replace(/\D/g, '');
    if (digits.length === 10) digits = `91${digits}`;
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(shareMessage())}`, '_blank', 'noopener');
  };

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
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Icon name="check" size={15} /> {actionSuccess}</span>
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
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Icon name="alert" size={15} /> {error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: 16 }}
          >
            ×
          </button>
        </div>
      )}

      {/* 2. Title, date/time (left) and invoice status + GST status (right) */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1d4ed8', margin: '0 0 4px', letterSpacing: '-0.01em' }}>
            {docConfig.label} • {doc.number}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13, color: '#334155' }}>
            <span>{formatDateTime(doc.created_at)}</span>
            {doc.payment_status && docConfig.key !== 'quotation' && docConfig.key !== 'delivery_challan' && doc.type !== 'quotation' && doc.type !== 'delivery_challan' && (
              <span
                style={{
                  display: 'inline-block', padding: '2px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 700,
                  background: doc.payment_status === 'Paid' ? '#dcfce7' : doc.payment_status === 'Partial' ? '#fef3c7' : '#fee2e2',
                  color: doc.payment_status === 'Paid' ? '#15803d' : doc.payment_status === 'Partial' ? '#b45309' : '#b91c1c',
                  border: `1px solid ${doc.payment_status === 'Paid' ? '#bbf7d0' : doc.payment_status === 'Partial' ? '#fde68a' : '#fca5a5'}`,
                }}
              >
                {doc.payment_status}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 18px', borderRadius: 6,
              fontSize: 12.5, fontWeight: 700, background: statusBadgeBg, color: statusBadgeText, border: `1px solid ${statusBadgeBorder}`,
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusBadgeText }} />
            {statusLabel}
          </span>
          {!hideGstBox && (
            <div
              style={{
                padding: '6px 16px', borderRadius: 6, fontSize: 12.5, fontWeight: 700,
                background: isFiled ? '#ecfdf5' : gst.status === 'Not Filed' ? '#fee2e2' : '#f8fafc',
                color: isFiled ? '#065f46' : gst.status === 'Not Filed' ? '#dc2626' : '#64748b',
                border: `1px solid ${isFiled ? '#a7f3d0' : gst.status === 'Not Filed' ? '#fecaca' : '#cbd5e1'}`,
                lineHeight: 1.35,
              }}
            >
              <div>GST Status: {gst.status}</div>
              {isFiled && (
                <div style={{ fontSize: 10.5, fontWeight: 500, color: '#047857' }}>
                  Filed on: {formatDate(gst.filed_on)} | ARN: {gst.ack_no || '—'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3. Action buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <ActionBtn variant="back" icon="back" label="Back" onClick={() => navigate(`/admin/billing/${clientId}/${docConfig.slug}`)} />
        <ActionBtn
          variant="edit" icon="edit" label="Edit"
          disabled={!flags.can_edit || isDeleted}
          title={!flags.can_edit || isDeleted ? editDisabledReason : 'Edit Document'}
          onClick={() => navigate(`/admin/billing/${clientId}/${docConfig.slug}/${id}/edit`)}
        />
        <ActionBtn
          variant="date" icon="calendar" label="Edit Creation Date"
          disabled={!flags.can_edit_creation_date || isDeleted}
          title={!flags.can_edit_creation_date || isDeleted ? (editDateDisabledReason || undefined) : 'Edit Creation Date'}
          onClick={() => setEditDateOpen(true)}
        />
        <ActionBtn
          variant="pdf" icon="download" label={downloadingPdf ? 'Downloading…' : 'Download PDF'}
          disabled={downloadingPdf} wait onClick={handleDownloadPdf}
        />
        <ActionBtn variant="email" icon="mail" label="Email" disabled={isDeleted || !customer?.email} title={customer?.email ? `Email ${customer.email}` : 'Customer has no email address'} onClick={handleEmail} />
        <ActionBtn variant="whatsapp" icon="whatsapp" label="WhatsApp" disabled={isDeleted || !customer?.phone} title={customer?.phone ? `WhatsApp ${customer.phone}` : 'Customer has no mobile number'} onClick={handleWhatsapp} />
        <ActionBtn
          variant="cancel" icon="ban" label="Cancel"
          disabled={!flags.can_cancel || isDeleted}
          title={!flags.can_cancel || isDeleted ? (cancelDisabledReason || undefined) : 'Cancel Document'}
          onClick={() => setCancelOpen(true)}
        />
        <ActionBtn
          variant="delete" icon="trash" label="Delete"
          disabled={!flags.can_delete || isDeleted}
          title={!flags.can_delete || isDeleted ? (deleteDisabledReason || undefined) : 'Delete Document'}
          onClick={() => setDeleteOpen(true)}
        />
      </div>

      {/* Converted Banner (when quotation is converted) */}
      {isConverted && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            background: '#f5f3ff',
            border: '1px solid #ddd6fe',
            color: '#5b21b6',
            fontSize: 12.5,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ display: 'inline-flex' }}><Icon name="doc" size={16} /></span>
          <span>
            <strong>Converted to </strong>
            {doc.converted_document && !doc.converted_document.is_deleted ? (
              <Link
                to={`/admin/billing/${clientId}/${getDocTypeConfig(doc.converted_document.type)?.slug || 'tax-invoice'}/${doc.converted_document.id}`}
                style={{
                  color: '#6d28d9',
                  fontWeight: 700,
                  textDecoration: 'underline',
                }}
              >
                {doc.converted_document.number || `#${doc.converted_document.id}`}
              </Link>
            ) : (
              <strong style={{ color: '#4c1d95' }}>
                {doc.converted_document?.number || `#${doc.converted_document_id}`}
              </strong>
            )}
          </span>
        </div>
      )}

      {/* Cancelled Note (when status is cancelled AND not converted) */}
      {isCancelled && !isConverted && (
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
        {/* Left Column: From (Sender) & To (Recipient) */}
        <div>
          {/* Seller Block */}
          <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: 'none' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#1d4ed8', marginBottom: 4 }}>
              From ({isNonGstType ? 'Sender' : 'Seller'})
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0a2a6b', marginBottom: 4 }}>
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
            <div style={{ fontSize: 17, fontWeight: 800, color: '#1d4ed8', marginBottom: 4 }}>
              To ({isNonGstType ? 'Recipient' : 'Buyer'})
            </div>
            {customer ? (
              <div style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.6 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0a2a6b', marginBottom: 2 }}>
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
                {customerAddress && <div>Address: {customerAddress}</div>}
                <div>
                  <strong>Place of Supply:</strong> {doc.place_of_supply || customer.place_of_supply || '—'} | {doc.supply_type || '—'}
                </div>
                {doc.notes && docConfig.key !== 'delivery_challan' && (
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
              background: '#ffffff',
              borderRadius: 8,
              border: '1px solid #bfdbfe',
              overflow: 'hidden',
              fontSize: 12.5,
            }}
          >
            {/* Number Row */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ width: '45%', padding: '9px 12px', background: '#eff6ff', fontWeight: 600, color: '#1e3a8a' }}>
                {docConfig.numberLabel}
              </div>
              <div style={{ width: '55%', padding: '9px 12px', fontWeight: 750, color: '#0f172a' }}>
                {doc.number}
              </div>
            </div>

            {/* Date Row */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ width: '45%', padding: '9px 12px', background: '#eff6ff', fontWeight: 600, color: '#1e3a8a' }}>
                {docConfig.dateLabel}
              </div>
              <div style={{ width: '55%', padding: '9px 12px', color: '#0f172a', fontWeight: 700 }}>
                {formatDate(doc.document_date)}
              </div>
            </div>

            {/* Valid Until / Due Date Row */}
            {doc.due_date && (
              <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0' }}>
                <div style={{ width: '45%', padding: '9px 12px', background: '#eff6ff', fontWeight: 600, color: '#1e3a8a' }}>
                  {docConfig.key === 'quotation' ? 'Valid Until' : 'Due Date'}
                </div>
                <div style={{ width: '55%', padding: '9px 12px', color: '#1e293b' }}>
                  {formatDate(doc.due_date)}
                </div>
              </div>
            )}

            {/* Creation Date Row */}
            <div style={{ display: 'flex', borderBottom: gst.status !== '-' ? '1px solid #e2e8f0' : 'none' }}>
              <div style={{ width: '45%', padding: '9px 12px', background: '#eff6ff', fontWeight: 600, color: '#1e3a8a' }}>
                Creation Date
              </div>
              <div style={{ width: '55%', padding: '9px 12px', color: '#0f172a', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                      padding: '2px 4px',
                      display: 'inline-flex',
                    }}
                  >
                    <Icon name="calendar" size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* E-Way Bill No. (optional, Delivery Challan only) */}
            {docConfig.key === 'delivery_challan' && (
              <div style={{ display: 'flex', borderTop: '1px solid #e2e8f0' }}>
                <div style={{ width: '45%', padding: '9px 12px', background: '#eff6ff', fontWeight: 600, color: '#1e3a8a' }}>
                  E-Way Bill No.
                </div>
                <div style={{ width: '55%', padding: '9px 12px', color: '#0f172a', fontWeight: 700 }}>
                  {doc.eway_bill_no || '—'}
                </div>
              </div>
            )}

            {/* GST Rows (Hidden when gst.status === '-') */}
            {gst.status !== '-' && (
              <>
                <div style={{ display: 'flex', borderBottom: isFiled ? '1px solid #e2e8f0' : 'none' }}>
                  <div style={{ width: '45%', padding: '9px 12px', background: '#eff6ff', fontWeight: 600, color: '#1e3a8a' }}>
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
                    <div style={{ width: '45%', padding: '9px 12px', background: '#eff6ff', fontWeight: 600, color: '#1e3a8a' }}>
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
          border: '1px solid #bfdbfe',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          overflow: 'hidden',
          marginBottom: 16,
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: '#0f3a8a', color: '#ffffff', fontSize: 12.5 }}>
                <th style={{ padding: '10px 10px', width: 45, textAlign: 'center' }}>Sr. No.</th>
                <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'center' }}>Particulars</th>
                <th style={{ padding: '10px 10px', fontWeight: 700, textAlign: 'center' }}>HSN/SAC</th>
                <th style={{ padding: '10px 10px', fontWeight: 700, textAlign: 'center' }}>QTY</th>
                <th style={{ padding: '10px 10px', fontWeight: 700, textAlign: 'center' }}>UQC</th>
                <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'center' }}>Rate (₹)</th>
                <th style={{ padding: '10px 10px', fontWeight: 700, textAlign: 'center' }}>GST %</th>
                <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'center' }}>Taxable Value (₹)</th>
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
                      borderBottom: '1px solid #e2e8f0',
                      background: '#ffffff',
                    }}
                  >
                    <td style={{ padding: '9px 10px', textAlign: 'center', color: '#94a3b8' }}>
                      {item.sr_no || idx + 1}
                    </td>
                    <td style={{ padding: '9px 12px', color: '#1e3a8a' }}>
                      {item.description || '—'}
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'center', color: '#64748b', }}>
                      {item.hsn_sac || '—'}
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'center', color: '#1e293b' }}>
                      {item.qty}
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'center', color: '#64748b' }}>
                      {item.unit || 'NOS'}
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'center', color: '#334155' }}>
                      {Number(item.rate).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'center', color: '#334155' }}>
                      {item.gst_rate}%
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'center', color: '#0f172a' }}>
                      {Number(item.taxable_amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
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
        {/* Left: Transportation Details (when DC) or Terms & Conditions */}
        {docConfig.key === 'delivery_challan' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="bp-card" style={{
              background: '#ffffff',
              borderRadius: 10,
              border: '1px solid #bfdbfe',
              padding: '14px 18px',
            }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#1d4ed8', marginBottom: 6 }}>Remarks:</div>
              <div style={{ fontSize: 12.5, color: '#334155', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{doc.notes && doc.notes.trim() ? doc.notes : '-'}</div>
            </div>
            <div className="bp-card" style={{
              background: '#ffffff',
              borderRadius: 10,
              border: '1px solid #bfdbfe',
              padding: '14px 18px',
            }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#1d4ed8', marginBottom: 6 }}>Terms &amp; Conditions:</div>
              <div style={{ fontSize: 12.5, color: '#334155', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{doc.terms && doc.terms.trim() ? doc.terms : '-'}</div>
            </div>
            {(doc.reason_for_transportation || doc.vehicle_no || doc.transporter_name || doc.receiver_name || doc.receiver_signature_datetime) && (
              <div className="bp-card" style={{
              background: '#ffffff',
              borderRadius: 10,
              border: '1px solid #bfdbfe',
              padding: '14px 18px',
            }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: '#1d4ed8', marginBottom: 6 }}>Transportation Details:</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, fontSize: 12.5 }}>
                  <div><span style={{ color: '#64748b' }}>Reason:</span> <strong>{formatReasonForTransportation(doc.reason_for_transportation, doc.reason_for_transportation_other)}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Vehicle No.:</span> <strong>{doc.vehicle_no || '—'}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Transporter:</span> <strong>{doc.transporter_name || '—'}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Receiver:</span> <strong>{doc.receiver_name || '—'}</strong></div>
                  <div style={{ gridColumn: '1 / -1' }}><span style={{ color: '#64748b' }}>Receiver Signature:</span> <strong>{doc.receiver_signature_datetime ? formatDateTime(doc.receiver_signature_datetime) : '—'}</strong></div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div
            className="bp-card"
            style={{
              background: '#ffffff',
              borderRadius: 10,
              border: '1px solid #bfdbfe',
              padding: '16px 18px',
            }}
          >
            <div style={{ fontSize: 12.5, fontWeight: 800, color: '#1d4ed8', marginBottom: 8 }}>
              Terms &amp; Conditions:
            </div>
            <div style={{ fontSize: 12.5, color: '#334155', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {doc.terms && doc.terms.trim() ? doc.terms : '-'}
            </div>
          </div>
        )}

        {/* Right: Summary Box */}
        <div
          className="bp-card"
          style={{
            background: '#eff6ff',
            borderRadius: 10,
            border: '1px solid #bfdbfe',
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

            {/* Round Off (only when there is one) */}
            {Number(summary.round_off) !== 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                <span>Round Off</span>
                <strong style={{ color: '#0f172a' }}>{formatCurrency(summary.round_off)}</strong>
              </div>
            )}

            {/* Grand Total */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                borderTop: '1px solid #bfdbfe',
                paddingTop: 8,
                marginTop: 2,
                fontSize: 17,
                fontWeight: 800,
                color: '#0a2a6b',
              }}
            >
              <span>Grand Total</span>
              <span style={{ color: '#0f3a8a', fontSize: 20 }}>{formatCurrency(summary.grand_total)}</span>
            </div>

            {/* Amount in Words (Exact as returned by API) */}
            <div style={{ paddingTop: 4, fontSize: 12 }}>
              <div style={{ fontWeight: 800, color: '#1d4ed8', marginBottom: 2 }}>Amount in Words</div>
              <div style={{ color: '#1e293b' }}>
                {summary.amount_in_words || '—'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 7. Bottom Green Info Note ONLY when GST is Filed (tax invoice only) */}
      {isFiled && !isNonGstType && (
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
          <span style={{ display: 'inline-flex' }}><Icon name="info" size={18} /></span>
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
