import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAdminFy } from '../../../context/AdminFyContext';
import { getDocTypeConfig } from './billingConstants';

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
 * Format Indian currency with 2 decimals. Returns "—" for 0 or empty (for tax columns).
 */
function formatTaxCurrency(val) {
  const num = Number(val);
  if (!val || isNaN(num) || num === 0) return '—';
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Format Indian currency with 2 decimals. Returns "₹0.00" for 0.
 */
function formatCurrency(val) {
  const num = Number(val);
  if (isNaN(num)) return '₹0.00';
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function AdminBillingDocumentList() {
  const { clientId, docType: docTypeParam } = useParams();
  const adminFyCtx = useAdminFy();
  const fy = adminFyCtx?.fy;
  const registerRefresh = adminFyCtx?.registerRefresh;

  const docConfig = useMemo(() => getDocTypeConfig(docTypeParam), [docTypeParam]);

  // Selected tab: 'all' | 'b2b' | 'b2c' | 'cancelled' | 'deleted'
  const [activeTab, setActiveTab] = useState('all');

  // Filter drafts (local inputs)
  const [qDraft, setQDraft] = useState('');
  const [invoiceDateFromDraft, setInvoiceDateFromDraft] = useState('');
  const [invoiceDateToDraft, setInvoiceDateToDraft] = useState('');
  const [creationDateFromDraft, setCreationDateFromDraft] = useState('');
  const [creationDateToDraft, setCreationDateToDraft] = useState('');
  const [statusDraft, setStatusDraft] = useState('all');

  // Applied filters
  const [appliedFilters, setAppliedFilters] = useState({
    q: '',
    invoice_date_from: '',
    invoice_date_to: '',
    creation_date_from: '',
    creation_date_to: '',
    status: 'all',
  });

  // Pagination
  const [page, setPage] = useState(1);
  const perPage = 10;

  // Server state
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [is404, setIs404] = useState(false);

  // Sync status draft when tab changes to locked tabs (cancelled or deleted)
  useEffect(() => {
    if (activeTab === 'cancelled') {
      setStatusDraft('cancelled');
      setAppliedFilters((prev) => ({ ...prev, status: 'cancelled' }));
    } else if (activeTab === 'deleted') {
      setStatusDraft('deleted');
      setAppliedFilters((prev) => ({ ...prev, status: 'deleted' }));
    } else {
      setStatusDraft('all');
      setAppliedFilters((prev) => ({ ...prev, status: 'all' }));
    }
    setPage(1);
  }, [activeTab]);

  // Fetch document list from backend API
  const fetchDocuments = useCallback(
    (targetPage = page, filters = appliedFilters, tab = activeTab, targetFy = fy) => {
      if (!docConfig) return;
      setLoading(true);
      setError(null);
      setIs404(false);

      const params = new URLSearchParams();
      if (targetFy) params.set('fy', targetFy);
      params.set('tab', tab);
      params.set('page', String(targetPage));
      params.set('per_page', String(perPage));

      if (filters.status && filters.status !== 'all') {
        params.set('status', filters.status);
      }
      if (filters.q && filters.q.trim()) {
        params.set('q', filters.q.trim());
      }
      if (filters.invoice_date_from) {
        params.set('invoice_date_from', filters.invoice_date_from);
      }
      if (filters.invoice_date_to) {
        params.set('invoice_date_to', filters.invoice_date_to);
      }
      if (filters.creation_date_from) {
        params.set('creation_date_from', filters.creation_date_from);
      }
      if (filters.creation_date_to) {
        params.set('creation_date_to', filters.creation_date_to);
      }

      const endpoint = `/admin/billing/client-directory/${clientId}/documents/${docConfig.key}?${params.toString()}`;

      api(endpoint)
        .then((json) => {
          if (json) {
            setData(json);
          }
          setLoading(false);
        })
        .catch((err) => {
          if (err?.status === 404) {
            setIs404(true);
          } else {
            setError(err?.message || 'Error loading documents.');
          }
          setLoading(false);
        });
    },
    [clientId, docConfig, page, appliedFilters, activeTab, fy, perPage]
  );

  // Trigger initial fetch & reload on page/appliedFilters/activeTab/fy change
  useEffect(() => {
    fetchDocuments(page, appliedFilters, activeTab, fy);
  }, [fetchDocuments, page, appliedFilters, activeTab, fy]);

  // Register refresh callback with useAdminFy
  useEffect(() => {
    if (!registerRefresh) return;
    const unregister = registerRefresh(() => {
      fetchDocuments(page, appliedFilters, activeTab, fy);
    });
    return () => {
      if (typeof unregister === 'function') unregister();
    };
  }, [registerRefresh, fetchDocuments, page, appliedFilters, activeTab, fy]);

  // Handle Search submit
  const handleSearch = (e) => {
    if (e) e.preventDefault();
    const newFilters = {
      q: qDraft,
      invoice_date_from: invoiceDateFromDraft,
      invoice_date_to: invoiceDateToDraft,
      creation_date_from: creationDateFromDraft,
      creation_date_to: creationDateToDraft,
      status: (activeTab === 'cancelled' || activeTab === 'deleted') ? activeTab : statusDraft,
    };
    setAppliedFilters(newFilters);
    setPage(1);
  };

  // Handle Reset filters (clears inputs but keeps current tab)
  const handleReset = () => {
    setQDraft('');
    setInvoiceDateFromDraft('');
    setInvoiceDateToDraft('');
    setCreationDateFromDraft('');
    setCreationDateToDraft('');
    const defaultStatus = (activeTab === 'cancelled' || activeTab === 'deleted') ? activeTab : 'all';
    setStatusDraft(defaultStatus);

    const clearedFilters = {
      q: '',
      invoice_date_from: '',
      invoice_date_to: '',
      creation_date_from: '',
      creation_date_to: '',
      status: defaultStatus,
    };
    setAppliedFilters(clearedFilters);
    setPage(1);
  };

  // Handle Enter key inside inputs
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch(e);
    }
  };

  // Unknown docType error view
  if (!docConfig) {
    return (
      <div style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: 60 }}>
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

  // 404 Client Not Found view
  if (is404) {
    return (
      <div style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: 60 }}>
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
    );
  }

  const client = data?.client;
  const cards = data?.cards || { total: 0, b2b: 0, b2c: 0, cancelled: 0, deleted: 0 };
  const paginator = data?.documents || { data: [], total: 0, from: 0, to: 0, current_page: 1, last_page: 1 };
  const filteredTotals = data?.filtered_totals || { taxable: 0, igst: 0, cgst: 0, sgst: 0, grand_total: 0 };

  const tabLabels = {
    all: 'All',
    b2b: 'B2B',
    b2c: 'B2C',
    cancelled: 'Cancelled',
    deleted: 'Deleted',
  };

  const isStatusLocked = activeTab === 'cancelled' || activeTab === 'deleted';

  const typePlural = docConfig.shortPlural || (docConfig.shortLabel + 's');

  const fyStr = fy || data?.fy || '2026-27';
  const startYear = parseInt(String(fyStr).split('-')[0], 10) || 2026;
  const endYear = startYear + 1;

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: 60 }}>
      {/* 1. Breadcrumb */}
      <div style={{ fontSize: 13, color: '#2563eb', marginBottom: 8, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Link to="/admin/billing" style={{ color: '#2563eb', textDecoration: 'none' }}>Billing</Link>
        <span style={{ color: '#94a3b8' }}>&gt;</span>
        <Link to={`/admin/billing/${clientId}`} style={{ color: '#2563eb', textDecoration: 'none' }}>Client Dashboard</Link>
        <span style={{ color: '#94a3b8' }}>&gt;</span>
        <span style={{ color: '#1e293b', fontWeight: 600 }}>{docConfig.pluralLabel}</span>
      </div>

      {/* Subtitle under breadcrumb */}
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
          View and manage all {docConfig.pluralLabel.toLowerCase()} for this client.
        </p>
      </div>

      {/* 2. Client Profile Header Strip */}
      <div
        className="bp-card"
        style={{
          background: '#ffffff',
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          padding: '14px 18px',
          marginBottom: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Building Icon */}
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #dbeafe',
              flexShrink: 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
              <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
              <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
              <path d="M10 6h4" />
              <path d="M10 10h4" />
              <path d="M10 14h4" />
              <path d="M10 18h4" />
            </svg>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 17, fontWeight: 750, color: '#0f172a', margin: 0 }}>
                {client?.business_name || client?.client_name || `Client #${clientId}`}
              </h1>
              {client && (
                <span
                  style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 650,
                    textTransform: 'none',
                    letterSpacing: '0.02em',
                    background: client.is_active ? '#dcfce7' : '#f1f5f9',
                    color: client.is_active ? '#15803d' : '#475569',
                    border: `1px solid ${client.is_active ? '#bbf7d0' : '#e2e8f0'}`,
                  }}
                >
                  {client.is_active ? 'Active' : 'Inactive'}
                </span>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 16,
                marginTop: 4,
                fontSize: 12,
                color: '#64748b',
              }}
            >
              <span><strong>Client ID:</strong> {client?.client_code || clientId}</span>
              <span><strong>GSTIN:</strong> {client?.gstin || '—'}</span>
              <span><strong>Constitution:</strong> {client?.constitution_type || '—'}</span>
              <span><strong>Reg Type:</strong> {client?.registration_type || '—'}</span>
            </div>
          </div>
        </div>

        {/* Right side FY label + Date Range */}
        <div>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 8,
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              color: '#1e293b',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#2563eb', flexShrink: 0 }} />
            <span>Financial Year {fyStr}, 01 Apr {startYear} - 31 Mar {endYear}</span>
          </span>
        </div>
      </div>

      {/* 3. Five Top Metric Cards (One row, compact, type-driven, no subtitle lines) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        {/* Card 1: Total */}
        <div
          className="bp-card"
          style={{
            background: '#eff6ff',
            border: '1px solid #dbeafe',
            borderRadius: 8,
            padding: '12px 14px',
          }}
        >
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Total {docConfig.pluralLabel}
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#1e3a8a', marginTop: 4 }}>
            {Number(cards.total).toLocaleString('en-IN')}
          </div>
        </div>

        {/* Card 2: B2B */}
        <div
          className="bp-card"
          style={{
            background: '#ecfdf5',
            border: '1px solid #d1fae5',
            borderRadius: 8,
            padding: '12px 14px',
          }}
        >
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            B2B {typePlural}
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#064e3b', marginTop: 4 }}>
            {Number(cards.b2b).toLocaleString('en-IN')}
          </div>
        </div>

        {/* Card 3: B2C */}
        <div
          className="bp-card"
          style={{
            background: '#f5f3ff',
            border: '1px solid #ede9fe',
            borderRadius: 8,
            padding: '12px 14px',
          }}
        >
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#5b21b6', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            B2C {typePlural}
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#4c1d95', marginTop: 4 }}>
            {Number(cards.b2c).toLocaleString('en-IN')}
          </div>
        </div>

        {/* Card 4: Cancelled */}
        <div
          className="bp-card"
          style={{
            background: '#fef2f2',
            border: '1px solid #fee2e2',
            borderRadius: 8,
            padding: '12px 14px',
          }}
        >
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Cancelled {typePlural}
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#7f1d1d', marginTop: 4 }}>
            {Number(cards.cancelled).toLocaleString('en-IN')}
          </div>
        </div>

        {/* Card 5: Deleted */}
        <div
          className="bp-card"
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '12px 14px',
          }}
        >
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Deleted {typePlural}
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', marginTop: 4 }}>
            {Number(cards.deleted).toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* 4. Five Tabs Bar with Counts */}
      <div
        style={{
          display: 'flex',
          borderBottom: '2px solid #e2e8f0',
          marginBottom: 16,
          gap: 6,
          overflowX: 'auto',
        }}
      >
        {[
          { key: 'all', label: 'All', count: cards.total },
          { key: 'b2b', label: 'B2B', count: cards.b2b },
          { key: 'b2c', label: 'B2C', count: cards.b2c },
          { key: 'cancelled', label: 'Cancelled', count: cards.cancelled },
          { key: 'deleted', label: 'Deleted', count: cards.deleted },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: isActive ? '3px solid #2563eb' : '3px solid transparent',
                marginBottom: -2,
                padding: '9px 16px',
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#2563eb' : '#64748b',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.15s ease',
              }}
            >
              <span>{tab.label}</span>
              <span
                style={{
                  padding: '2px 7px',
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 700,
                  background: isActive ? '#eff6ff' : '#f1f5f9',
                  color: isActive ? '#2563eb' : '#64748b',
                }}
              >
                {Number(tab.count || 0).toLocaleString('en-IN')}
              </span>
            </button>
          );
        })}
      </div>

      {/* 5. Filters Strip */}
      <form
        onSubmit={handleSearch}
        className="bp-card"
        style={{
          background: '#ffffff',
          borderRadius: 10,
          border: '1px solid #e2e8f0',
          padding: '12px 14px',
          marginBottom: 16,
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: 10,
            alignItems: 'end',
          }}
        >
          {/* Search Input */}
          <div style={{ gridColumn: 'span 2', minWidth: 240 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 3 }}>
              Search
            </label>
            <input
              type="text"
              value={qDraft}
              onChange={(e) => setQDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={docConfig.searchPlaceholder}
              style={{
                width: '100%',
                padding: '7px 10px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                fontSize: 12.5,
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Invoice Date From */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 3 }}>
              {docConfig.dateLabel} From
            </label>
            <input
              type="date"
              value={invoiceDateFromDraft}
              onChange={(e) => setInvoiceDateFromDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{
                width: '100%',
                padding: '6.5px 8px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                fontSize: 12,
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Invoice Date To */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 3 }}>
              {docConfig.dateLabel} To
            </label>
            <input
              type="date"
              value={invoiceDateToDraft}
              onChange={(e) => setInvoiceDateToDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{
                width: '100%',
                padding: '6.5px 8px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                fontSize: 12,
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Creation Date From */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 3 }}>
              Creation Date From
            </label>
            <input
              type="date"
              value={creationDateFromDraft}
              onChange={(e) => setCreationDateFromDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{
                width: '100%',
                padding: '6.5px 8px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                fontSize: 12,
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Creation Date To */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 3 }}>
              Creation Date To
            </label>
            <input
              type="date"
              value={creationDateToDraft}
              onChange={(e) => setCreationDateToDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{
                width: '100%',
                padding: '6.5px 8px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                fontSize: 12,
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Status Dropdown: All / Active / Cancelled on All/B2B/B2C tabs */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 3 }}>
              {docConfig.statusLabel}
            </label>
            <select
              value={statusDraft}
              onChange={(e) => setStatusDraft(e.target.value)}
              disabled={isStatusLocked}
              style={{
                width: '100%',
                padding: '7px 8px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                fontSize: 12,
                background: isStatusLocked ? '#f1f5f9' : '#ffffff',
                boxSizing: 'border-box',
                cursor: isStatusLocked ? 'not-allowed' : 'pointer',
              }}
            >
              {activeTab === 'cancelled' ? (
                <option value="cancelled">Cancelled</option>
              ) : activeTab === 'deleted' ? (
                <option value="deleted">Deleted</option>
              ) : (
                <>
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="cancelled">Cancelled</option>
                </>
              )}
            </select>
          </div>

          {/* Buttons: Search & Reset */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="submit"
              className="bp-btn bp-btn-primary"
              style={{
                flex: 1,
                background: '#2563eb',
                color: '#ffffff',
                padding: '7px 12px',
                borderRadius: 6,
                border: 'none',
                fontWeight: 700,
                fontSize: 12.5,
                cursor: 'pointer',
              }}
            >
              Search
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="bp-btn"
              style={{
                background: '#f1f5f9',
                color: '#475569',
                padding: '7px 12px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                fontWeight: 600,
                fontSize: 12.5,
                cursor: 'pointer',
              }}
            >
              Reset
            </button>
          </div>
        </div>
      </form>

      {/* 6. Document Table Card */}
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
        {/* Loading state */}
        {loading ? (
          <div style={{ padding: '50px 20px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: 26, marginBottom: 8 }}>⏳</div>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Loading {docConfig.pluralLabel.toLowerCase()}...</div>
          </div>
        ) : error ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ color: '#ef4444', fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>{error}</div>
            <button
              type="button"
              onClick={() => fetchDocuments(page, appliedFilters, activeTab, fy)}
              style={{
                background: '#2563eb',
                color: '#ffffff',
                padding: '7px 16px',
                borderRadius: 6,
                border: 'none',
                fontWeight: 600,
                fontSize: 12.5,
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        ) : paginator.data.length === 0 ? (
          <div style={{ padding: '50px 20px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
              No {docConfig.pluralLabel.toLowerCase()} found
            </div>
            <div style={{ fontSize: 12.5, color: '#94a3b8' }}>
              No records match your active tab and filter criteria for this financial year.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>
                  <th style={{ padding: '8px 6px', width: 32, textAlign: 'center' }}>#</th>
                  <th style={{ padding: '8px 8px', fontWeight: 700 }}>{docConfig.numberLabel}</th>
                  <th style={{ padding: '8px 8px', fontWeight: 700 }}>{docConfig.dateLabel}</th>
                  <th style={{ padding: '8px 8px', fontWeight: 700 }}>Creation Date</th>
                  <th style={{ padding: '8px 8px', fontWeight: 700 }}>Customer Name</th>
                  <th style={{ padding: '8px 8px', fontWeight: 700 }}>GSTIN</th>
                  <th style={{ padding: '8px 6px', fontWeight: 700, textAlign: 'center' }}>Type</th>
                  <th style={{ padding: '8px 8px', fontWeight: 700, textAlign: 'right' }}>Taxable Value</th>
                  <th style={{ padding: '8px 8px', fontWeight: 700, textAlign: 'right' }}>IGST</th>
                  <th style={{ padding: '8px 8px', fontWeight: 700, textAlign: 'right' }}>CGST</th>
                  <th style={{ padding: '8px 8px', fontWeight: 700, textAlign: 'right' }}>SGST</th>
                  <th style={{ padding: '8px 8px', fontWeight: 700, textAlign: 'right' }}>Total Amount</th>
                  <th style={{ padding: '8px 8px', fontWeight: 700, textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '8px 8px', fontWeight: 700, textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {paginator.data.map((doc, idx) => {
                  const rowNum = (paginator.from || 1) + idx;
                  const isCancelled = doc.status === 'cancelled';
                  const isDeleted = doc.status === 'deleted';

                  let statusBadgeStyle = {
                    background: '#dcfce7',
                    color: '#15803d',
                    border: '1px solid #bbf7d0',
                  };
                  let statusText = 'Active';

                  if (isCancelled) {
                    statusBadgeStyle = {
                      background: '#fee2e2',
                      color: '#b91c1c',
                      border: '1px solid #fca5a5',
                    };
                    statusText = 'Cancelled';
                  } else if (isDeleted) {
                    statusBadgeStyle = {
                      background: '#fef2f2',
                      color: '#991b1b',
                      border: '1px solid #fecaca',
                    };
                    statusText = 'Deleted';
                  }

                  return (
                    <tr
                      key={doc.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background 0.1s ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
                    >
                      <td style={{ padding: '7px 6px', textAlign: 'center', color: '#94a3b8', fontSize: 11.5 }}>
                        {rowNum}
                      </td>
                      <td style={{ padding: '7px 8px', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        {doc.number}
                      </td>
                      <td style={{ padding: '7px 8px', color: '#475569', whiteSpace: 'nowrap' }}>
                        {formatDate(doc.document_date)}
                      </td>
                      <td style={{ padding: '7px 8px', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {formatDate(doc.created_at)}
                      </td>
                      <td
                        style={{
                          padding: '7px 8px',
                          color: '#1e293b',
                          fontWeight: 600,
                          maxWidth: 160,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={doc.customer_name || ''}
                      >
                        {doc.customer_name || '—'}
                      </td>
                      <td style={{ padding: '7px 8px', color: '#64748b', fontFamily: 'monospace', fontSize: 11.5, whiteSpace: 'nowrap' }}>
                        {doc.customer_gstin || '—'}
                      </td>
                      <td style={{ padding: '7px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '1px 6px',
                            borderRadius: 4,
                            fontSize: 10.5,
                            fontWeight: 700,
                            background: doc.customer_type === 'B2B' ? '#ecfdf5' : '#f5f3ff',
                            color: doc.customer_type === 'B2B' ? '#047857' : '#6d28d9',
                            border: `1px solid ${doc.customer_type === 'B2B' ? '#a7f3d0' : '#ddd6fe'}`,
                          }}
                        >
                          {doc.customer_type}
                        </span>
                      </td>
                      <td style={{ padding: '7px 8px', textAlign: 'right', color: '#334155', whiteSpace: 'nowrap' }}>
                        {formatCurrency(doc.taxable_amount)}
                      </td>
                      <td style={{ padding: '7px 8px', textAlign: 'right', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {formatTaxCurrency(doc.igst_amount)}
                      </td>
                      <td style={{ padding: '7px 8px', textAlign: 'right', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {formatTaxCurrency(doc.cgst_amount)}
                      </td>
                      <td style={{ padding: '7px 8px', textAlign: 'right', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {formatTaxCurrency(doc.sgst_amount)}
                      </td>
                      <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        {formatCurrency(doc.grand_total)}
                      </td>
                      <td style={{ padding: '7px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 7px',
                            borderRadius: 999,
                            fontSize: 10.5,
                            fontWeight: 700,
                            ...statusBadgeStyle,
                          }}
                        >
                          {statusText}
                        </span>
                      </td>
                      <td style={{ padding: '7px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <Link
                          to={`/admin/billing/${clientId}/${docConfig.slug}/${doc.id}`}
                          style={{
                            color: '#2563eb',
                            fontWeight: 650,
                            textDecoration: 'none',
                            fontSize: 12,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
                          <span>View</span>
                          <span>&rarr;</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 7. Footer: Showing X to Y of Total + Filtered Totals Strip + Pagination */}
      {!loading && paginator.data.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {/* Filtered Totals Strip (matches mockup bottom bar) */}
          <div
            className="bp-card"
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              padding: '10px 16px',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 14,
              fontSize: 12.5,
            }}
          >
            <div style={{ fontWeight: 750, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Total (Filtered)
            </div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 18,
                color: '#475569',
              }}
            >
              <span>Taxable: <strong style={{ color: '#0f172a' }}>{formatCurrency(filteredTotals.taxable)}</strong></span>
              <span>IGST: <strong style={{ color: '#0f172a' }}>{formatCurrency(filteredTotals.igst)}</strong></span>
              <span>CGST: <strong style={{ color: '#0f172a' }}>{formatCurrency(filteredTotals.cgst)}</strong></span>
              <span>SGST: <strong style={{ color: '#0f172a' }}>{formatCurrency(filteredTotals.sgst)}</strong></span>
              <span style={{ fontSize: 13.5, borderLeft: '1px solid #cbd5e1', paddingLeft: 14 }}>
                Grand Total: <strong style={{ color: '#2563eb' }}>{formatCurrency(filteredTotals.grand_total)}</strong>
              </span>
            </div>
          </div>

          {/* Pagination & Row range */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '0 4px',
            }}
          >
            <div style={{ fontSize: 12.5, color: '#64748b' }}>
              Showing <strong>{paginator.from || 0}</strong> to <strong>{paginator.to || 0}</strong> of <strong>{paginator.total}</strong> {docConfig.pluralLabel.toLowerCase()}{activeTab !== 'all' ? ` (${tabLabels[activeTab]})` : ''}
            </div>

            {paginator.last_page > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  style={{
                    background: page <= 1 ? '#f1f5f9' : '#ffffff',
                    color: page <= 1 ? '#94a3b8' : '#334155',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    padding: '5px 10px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: page <= 1 ? 'not-allowed' : 'pointer',
                  }}
                >
                  ← Previous
                </button>

                {Array.from({ length: paginator.last_page }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === paginator.last_page || Math.abs(p - page) <= 2)
                  .map((p, idx, arr) => {
                    const prevP = arr[idx - 1];
                    const showEllipsis = prevP && p - prevP > 1;
                    return (
                      <span key={p} style={{ display: 'inline-flex', alignItems: 'center' }}>
                        {showEllipsis && <span style={{ padding: '0 4px', color: '#94a3b8' }}>…</span>}
                        <button
                          type="button"
                          onClick={() => setPage(p)}
                          style={{
                            background: page === p ? '#2563eb' : '#ffffff',
                            color: page === p ? '#ffffff' : '#334155',
                            border: `1px solid ${page === p ? '#2563eb' : '#cbd5e1'}`,
                            borderRadius: 6,
                            padding: '5px 9px',
                            fontSize: 12,
                            fontWeight: page === p ? 700 : 500,
                            cursor: 'pointer',
                          }}
                        >
                          {p}
                        </button>
                      </span>
                    );
                  })}

                <button
                  type="button"
                  disabled={page >= paginator.last_page}
                  onClick={() => setPage((p) => Math.min(paginator.last_page, p + 1))}
                  style={{
                    background: page >= paginator.last_page ? '#f1f5f9' : '#ffffff',
                    color: page >= paginator.last_page ? '#94a3b8' : '#334155',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    padding: '5px 10px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: page >= paginator.last_page ? 'not-allowed' : 'pointer',
                  }}
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
