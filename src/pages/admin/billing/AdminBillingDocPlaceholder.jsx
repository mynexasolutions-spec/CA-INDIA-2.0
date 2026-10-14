import { Link, useParams } from 'react-router-dom';
import { getDocTypeConfig } from './billingConstants';

export default function AdminBillingDocPlaceholder() {
  const { clientId, docType } = useParams();
  const docConfig = getDocTypeConfig(docType);

  const docTitle = docConfig?.pluralLabel || (docType ? docType.replace(/[-_]/g, ' ') : 'Client Billing Dashboard');
  const Icon = docConfig?.Icon;

  const isDocTypeView = Boolean(docType);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 60 }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: 13, color: 'var(--bp-blue, #2563eb)', marginBottom: 12, fontWeight: 500 }}>
        <Link to="/admin/billing" style={{ color: '#2563eb', textDecoration: 'none' }}>Billing</Link>
        <span style={{ margin: '0 6px', color: '#94a3b8' }}>&gt;</span>
        <Link to="/admin/billing" style={{ color: '#2563eb', textDecoration: 'none' }}>Client List</Link>
        <span style={{ margin: '0 6px', color: '#94a3b8' }}>&gt;</span>
        <span style={{ color: '#64748b' }}>Client #{clientId}</span>
        {isDocTypeView && (
          <>
            <span style={{ margin: '0 6px', color: '#94a3b8' }}>&gt;</span>
            <span style={{ color: '#1e293b', fontWeight: 600 }}>{docConfig?.label || docType}</span>
          </>
        )}
      </div>

      {/* Card Content */}
      <div
        className="bp-card"
        style={{
          background: '#ffffff',
          borderRadius: 12,
          border: '1px solid var(--bp-border, #e2e8f0)',
          padding: '48px 24px',
          textAlign: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          maxWidth: 720,
          margin: '24px auto',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: docConfig?.bg || '#eff6ff',
            color: docConfig?.color || '#2563eb',
            border: `1px solid ${docConfig?.borderColor || '#bfdbfe'}`,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
          }}
        >
          {Icon ? (
            <Icon width={32} height={32} />
          ) : (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 8px', textTransform: 'capitalize' }}>
          {docTitle}
        </h2>

        <p style={{ fontSize: 14, color: '#64748b', maxWidth: 480, margin: '0 auto 20px', lineHeight: 1.5 }}>
          {isDocTypeView ? (
            <>
              Commercial document management and register view for <strong>Client #{clientId}</strong> ({docConfig?.label || docType}) is scheduled for development in <strong>Stage 3B</strong>.
            </>
          ) : (
            <>
              Client Billing Dashboard for <strong>Client #{clientId}</strong> is scheduled for development in <strong>Stage 3A-3</strong>.
            </>
          )}
        </p>

        <div
          style={{
            display: 'inline-block',
            padding: '6px 14px',
            borderRadius: 999,
            background: '#f1f5f9',
            color: '#475569',
            fontSize: 12.5,
            fontWeight: 600,
            marginBottom: 28,
          }}
        >
          {isDocTypeView ? 'Feature Notice: Coming in Stage 3B' : 'Feature Notice: Coming in Stage 3A-3'}
        </div>

        <div>
          <Link
            to="/admin/billing"
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
            ← Back to Client List
          </Link>
        </div>
      </div>
    </div>
  );
}
