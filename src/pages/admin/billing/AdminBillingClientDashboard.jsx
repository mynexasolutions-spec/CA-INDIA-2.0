import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAdminFy } from '../../../context/AdminFyContext';
import Spinner from '../../../components/Spinner';
import { BILLING_DOC_TYPES } from './billingConstants';
import DocumentDistributionDonut from './components/DocumentDistributionDonut';
import MonthlyDocumentTrendBar from './components/MonthlyDocumentTrendBar';

function BuildingIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function TotalStackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  );
}

export default function AdminBillingClientDashboard() {
  const { clientId } = useParams();
  const adminFy = useAdminFy();
  const fy = adminFy?.fy;
  const registerRefresh = adminFy?.registerRefresh;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [is404, setIs404] = useState(false);
  const [data, setData] = useState(null);

  const requestIdRef = useRef(0);

  const loadDashboard = useCallback(
    (currentFy = fy) => {
      const reqId = ++requestIdRef.current;
      setLoading(true);
      setError(null);
      setIs404(false);

      const qs = new URLSearchParams();
      if (currentFy) qs.set('fy', currentFy);

      return api(`/admin/billing/client-directory/${clientId}/dashboard?${qs.toString()}`)
        .then((res) => {
          if (reqId !== requestIdRef.current) return res;
          setData(res);
          setLoading(false);
          return res;
        })
        .catch((err) => {
          if (reqId !== requestIdRef.current) return;
          if (err?.status === 404) {
            setIs404(true);
          } else {
            setError(err?.message || 'Failed to load client dashboard.');
          }
          setLoading(false);
        });
    },
    [clientId, fy]
  );

  // Load when clientId or FY changes
  useEffect(() => {
    loadDashboard(fy);
  }, [loadDashboard, fy]);

  // Register refresh callback with useAdminFy
  useEffect(() => {
    if (!registerRefresh) return;
    const unregister = registerRefresh(() => loadDashboard(fy));
    return () => {
      if (typeof unregister === 'function') unregister();
    };
  }, [registerRefresh, loadDashboard, fy]);

  // 404 State: Client not found
  if (is404) {
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 60 }}>
        <div style={{ fontSize: 13, color: '#2563eb', marginBottom: 12, fontWeight: 500 }}>
          <Link to="/admin/billing" style={{ color: '#2563eb', textDecoration: 'none' }}>Billing</Link>
          <span style={{ margin: '0 6px', color: '#94a3b8' }}>&gt;</span>
          <span style={{ color: '#64748b' }}>Client Dashboard</span>
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
            Client Not Found
          </h2>
          <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 24px' }}>
            The requested client profile (#{clientId}) does not exist or has been removed.
          </p>
          <Link
            to="/admin/billing"
            className="bp-btn bp-btn-primary"
            style={{
              background: '#2563eb',
              color: '#ffffff',
              padding: '10px 20px',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 13.5,
              textDecoration: 'none',
              display: 'inline-flex',
            }}
          >
            Back to Client List
          </Link>
        </div>
      </div>
    );
  }

  // Initial Loading state
  if (loading && !data) {
    return (
      <div style={{ maxWidth: 1320, margin: '0 auto', paddingBottom: 60 }}>
        <div style={{ minHeight: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#64748b' }}>
          <Spinner size={28} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>Loading client dashboard…</span>
        </div>
      </div>
    );
  }

  // Error State with Retry
  if (error && !data) {
    return (
      <div style={{ maxWidth: 1320, margin: '0 auto', paddingBottom: 60 }}>
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fee2e2',
            borderRadius: 10,
            padding: '24px',
            textAlign: 'center',
            maxWidth: 600,
            margin: '40px auto',
          }}
        >
          <h3 style={{ margin: '0 0 8px', color: '#b91c1c', fontSize: 17, fontWeight: 700 }}>
            Unable to Load Dashboard
          </h3>
          <p style={{ margin: '0 0 16px', color: '#7f1d1d', fontSize: 13.5 }}>{error}</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
            <button
              type="button"
              className="bp-btn bp-btn-primary"
              style={{ background: '#b91c1c', color: '#fff', padding: '8px 18px', borderRadius: 6 }}
              onClick={() => loadDashboard(fy)}
            >
              Retry
            </button>
            <Link
              to="/admin/billing"
              className="bp-btn bp-btn-outline"
              style={{ padding: '8px 18px', borderRadius: 6, textDecoration: 'none' }}
            >
              Back to Client List
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const client = data?.client || {};
  const cards = data?.cards || {};
  const donut = data?.donut || [];
  const monthlyTrend = data?.monthly_trend || [];

  const displayName = client.business_name || client.client_name || '-';
  const isActive = Boolean(client.is_active);

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto', paddingBottom: 60 }}>
      {/* 1. Breadcrumb, Title & Subtitle */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: '#2563eb', marginBottom: 8, fontWeight: 500 }}>
          <Link to="/admin/billing" style={{ color: '#2563eb', textDecoration: 'none' }}>Billing</Link>
          <span style={{ margin: '0 6px', color: '#94a3b8' }}>&gt;</span>
          <span style={{ color: '#64748b' }}>Client Dashboard</span>
        </div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a' }}>
          Client Dashboard
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13.5, color: '#64748b' }}>
          View and manage all billing documents for this client.
        </p>
      </div>

      {/* 2. Client Info Card */}
      <div
        className="bp-card"
        style={{
          background: '#ffffff',
          borderRadius: 12,
          border: '1px solid var(--bp-border, #e2e8f0)',
          padding: '20px 24px',
          marginBottom: 20,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 20,
        }}
      >
        {/* Left Side: Business Name, Status & Registration Metadata */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, minWidth: 280, flex: 2 }}>
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: 12,
              background: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <BuildingIcon />
          </div>

          <div style={{ flex: 1 }}>
            {/* Top Row: Business Name & Status Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: '#0f172a' }}>
                {displayName}
              </h2>
              <span
                style={{
                  display: 'inline-block',
                  padding: '2px 10px',
                  borderRadius: 999,
                  fontSize: 11.5,
                  fontWeight: 700,
                  background: isActive ? '#ddfdf2' : '#fae7e9',
                  color: isActive ? '#00734a' : '#ec0a3a',
                }}
              >
                {isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            {/* Bottom Row: 4 Metadata Columns */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                gap: 16,
                marginTop: 14,
              }}
            >
              <div>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Client ID</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                  {client.client_code || '-'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>GSTIN</div>
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    fontFamily: client.gstin ? 'monospace' : 'inherit',
                    color: client.gstin ? '#0f172a' : '#94a3b8',
                    marginTop: 2,
                  }}
                >
                  {client.gstin || '-'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Constitution Type</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                  {client.constitution_type || '-'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Registration Type</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                  {client.registration_type || '-'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Contact Information */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            fontSize: 12.5,
            color: '#334155',
            minWidth: 240,
            flex: 1,
            paddingLeft: 16,
            borderLeft: '1px solid #f1f5f9',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#2563eb', display: 'flex' }}><PhoneIcon /></span>
            <span style={{ fontWeight: 600 }}>{client.mobile || '-'}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#2563eb', display: 'flex' }}><MailIcon /></span>
            <span>{client.email || '-'}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ color: '#2563eb', display: 'flex', marginTop: 2 }}><MapPinIcon /></span>
            <span style={{ lineHeight: 1.35, color: '#64748b' }}>{client.address || '-'}</span>
          </div>
        </div>
      </div>

      {/* 3. 7 Summary Cards (Single Row of 7 cards matching Mockup) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(125px, 1fr))',
          gap: 10,
          marginBottom: 24,
          overflowX: 'auto',
          paddingBottom: 4,
        }}
      >
        {/* Card 1: Total Documents (Count only, NO link) */}
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: '14px 10px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
            minWidth: 0,
          }}
        >
          <div>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: '#0284c7',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 10,
              }}
            >
              <TotalStackIcon />
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', lineHeight: 1.2 }}>
              Total Documents
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginTop: 4, lineHeight: 1.1 }}>
              {Number(cards.total ?? 0).toLocaleString('en-IN')}
            </div>
          </div>
          {/* Empty placeholder spacer matching the link height of the other 6 cards */}
          <div style={{ height: 22 }} />
        </div>

        {/* Cards 2-7: 6 Commercial Types (With Plural labels and View link) */}
        {BILLING_DOC_TYPES.map((t) => {
          const Icon = t.Icon;
          const count = cards[t.key] ?? 0;
          return (
            <div
              key={t.key}
              style={{
                background: t.bg,
                border: `1px solid ${t.borderColor}`,
                borderRadius: 12,
                padding: '14px 10px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                minWidth: 0,
              }}
            >
              <div>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: t.iconBg,
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 10,
                  }}
                >
                  <Icon width={20} height={20} />
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#1e293b',
                    lineHeight: 1.2,
                    whiteSpace: 'normal',
                    wordBreak: 'normal',
                  }}
                  title={t.pluralLabel}
                >
                  {t.pluralLabel}
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: t.countColor || '#0f172a',
                    marginTop: 4,
                    lineHeight: 1.1,
                  }}
                >
                  {Number(count).toLocaleString('en-IN')}
                </div>
              </div>

              {/* View <Plural> -> Link to /admin/billing/:clientId/:slug */}
              <div style={{ marginTop: 10 }}>
                <Link
                  to={`/admin/billing/${clientId}/${t.slug}`}
                  style={{
                    fontSize: 11.5,
                    fontWeight: 650,
                    color: t.color,
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  <span>View {t.pluralLabel}</span>
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Bottom Grid: Document Distribution Donut & Monthly Document Trend */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 20,
        }}
      >
        {/* Left: Document Distribution */}
        <div
          className="bp-card"
          style={{
            background: '#ffffff',
            borderRadius: 12,
            border: '1px solid var(--bp-border, #e2e8f0)',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
            Document Distribution
          </h3>
          <DocumentDistributionDonut cards={cards} donut={donut} />
        </div>

        {/* Right: Monthly Document Trend */}
        <div
          className="bp-card"
          style={{
            background: '#ffffff',
            borderRadius: 12,
            border: '1px solid var(--bp-border, #e2e8f0)',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
            Monthly Document Trend
          </h3>
          <MonthlyDocumentTrendBar monthlyTrend={monthlyTrend} />
        </div>
      </div>
    </div>
  );
}
