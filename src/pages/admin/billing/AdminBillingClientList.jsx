import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAdminFy } from '../../../context/AdminFyContext';
import Spinner from '../../../components/Spinner';
import { BILLING_DOC_TYPES } from './billingConstants';

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function getPaginationItems(currentPage, lastPage) {
  if (lastPage <= 7) {
    return Array.from({ length: lastPage }, (_, i) => i + 1);
  }
  const items = [];
  const left = Math.max(2, currentPage - 1);
  const right = Math.min(lastPage - 1, currentPage + 1);

  items.push(1);
  if (left > 2) {
    items.push('ellipsis-left');
  }
  for (let i = left; i <= right; i++) {
    items.push(i);
  }
  if (right < lastPage - 1) {
    items.push('ellipsis-right');
  }
  items.push(lastPage);
  return items;
}

export default function AdminBillingClientList() {
  const adminFy = useAdminFy();
  const fy = adminFy?.fy;
  const registerRefresh = adminFy?.registerRefresh;

  // Unsubmitted form input states
  const [searchInput, setSearchInput] = useState('');
  const [statusInput, setStatusInput] = useState('All');
  const [constitutionInput, setConstitutionInput] = useState('All');
  const [registrationInput, setRegistrationInput] = useState('All');

  // Applied filter state (only updated on Search submit or Reset)
  const [appliedFilters, setAppliedFilters] = useState({
    q: '',
    status: 'All',
    constitutionType: 'All',
    registrationType: 'All',
  });

  // Pagination & Data states
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const requestIdRef = useRef(0);

  // Fetch client list from GET /api/admin/billing/client-directory
  const fetchClients = useCallback(
    (targetPage = 1, filtersToUse = appliedFilters, targetFy = fy) => {
      const reqId = ++requestIdRef.current;
      setLoading(true);
      setError(null);

      const qs = new URLSearchParams();
      if (targetFy) qs.set('fy', targetFy);
      if (filtersToUse.q?.trim()) qs.set('q', filtersToUse.q.trim());
      if (filtersToUse.status && filtersToUse.status !== 'All') {
        qs.set('status', filtersToUse.status.toLowerCase());
      }
      if (filtersToUse.constitutionType && filtersToUse.constitutionType !== 'All') {
        qs.set('constitution_type', filtersToUse.constitutionType);
      }
      if (filtersToUse.registrationType && filtersToUse.registrationType !== 'All') {
        qs.set('registration_type', filtersToUse.registrationType);
      }
      qs.set('page', String(targetPage));
      qs.set('per_page', '10');

      return api(`/admin/billing/client-directory?${qs.toString()}`)
        .then((res) => {
          if (reqId !== requestIdRef.current) return res;
          setData(res);
          setLoading(false);
          return res;
        })
        .catch((err) => {
          if (reqId !== requestIdRef.current) return;
          setError(err?.message || 'Failed to load client directory.');
          setLoading(false);
        });
    },
    [appliedFilters, fy]
  );

  // When FY changes, reset to page 1
  const prevFyRef = useRef(fy);
  useEffect(() => {
    if (prevFyRef.current !== fy) {
      prevFyRef.current = fy;
      setPage(1);
    }
  }, [fy]);

  // Fetch data on appliedFilters, page, or fy changes
  useEffect(() => {
    fetchClients(page, appliedFilters, fy);
  }, [fetchClients, page, appliedFilters, fy]);

  // Register refresh callback with useAdminFy: uses APPLIED filters, current page, and current FY
  useEffect(() => {
    if (!registerRefresh) return;
    const unregister = registerRefresh(() => fetchClients(page, appliedFilters, fy));
    return () => {
      if (typeof unregister === 'function') unregister();
    };
  }, [registerRefresh, fetchClients, page, appliedFilters, fy]);

  // Form submit (Search button or Enter key in search box)
  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    setAppliedFilters({
      q: searchInput,
      status: statusInput,
      constitutionType: constitutionInput,
      registrationType: registrationInput,
    });
    setPage(1);
  };

  // Reset button
  const handleReset = () => {
    setSearchInput('');
    setStatusInput('All');
    setConstitutionInput('All');
    setRegistrationInput('All');
    setAppliedFilters({
      q: '',
      status: 'All',
      constitutionType: 'All',
      registrationType: 'All',
    });
    setPage(1);
  };

  const cardsData = data?.cards || {};
  const filterOptions = data?.filter_options || {};
  // Only use constitution_types provided by filter_options (no hardcoded fallback)
  const constitutionOptions = Array.isArray(filterOptions.constitution_types)
    ? filterOptions.constitution_types
    : [];

  const paginatedClients = data?.clients || {};
  const clientRows = paginatedClients.data || [];
  const totalClients = paginatedClients.total ?? 0;
  const fromIndex = paginatedClients.from ?? (totalClients > 0 ? 1 : 0);
  const toIndex = paginatedClients.to ?? (totalClients > 0 ? clientRows.length : 0);
  const currentPage = paginatedClients.current_page ?? page;
  const lastPage = paginatedClients.last_page ?? 1;

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto', paddingBottom: 60 }}>
      {/* 1. Breadcrumb, Title & Subtitle */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: '#2563eb', marginBottom: 8, fontWeight: 500 }}>
          <span>Billing</span>
          <span style={{ margin: '0 6px', color: '#94a3b8' }}>&gt;</span>
          <span style={{ color: '#64748b' }}>Client List</span>
        </div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a' }}>
          Client List
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13.5, color: '#64748b' }}>
          View and manage all clients for billing and document generation.
        </p>
      </div>

      {/* 2. Top 6 Document Cards (Single Row of 6 cards matching Mockup PDF p31) */}
      <div
        className="abc-tiles"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, minmax(130px, 1fr))',
          gap: 10,
          marginBottom: 20,
          overflowX: 'auto',
          paddingBottom: 4,
        }}
      >
        {BILLING_DOC_TYPES.map((item) => {
          const Icon = item.Icon;
          const count = cardsData[item.key] ?? 0;
          return (
            <div
              key={item.key}
              className="abc-tile"
              style={{
                background: item.bg,
                border: `1px solid ${item.borderColor}`,
                borderRadius: 12,
                padding: '12px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                minWidth: 0,
              }}
            >
              <div
                className="abc-tile-ic"
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: item.iconBg,
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon width={20} height={20} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: '#1e293b',
                    lineHeight: 1.2,
                    whiteSpace: 'normal',
                    wordBreak: 'normal',
                  }}
                  title={item.label}
                >
                  {item.label}
                </div>
                <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2, marginBottom: 2 }}>
                  Created by Clients
                </div>
                <div
                  className="abc-tile-num"
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    color: item.countColor || '#0f172a',
                    lineHeight: 1.1,
                  }}
                >
                  {Number(count).toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Search and Filter Bar (Perfect Baseline Alignment) */}
      <div
        className="bp-card"
        style={{
          background: '#ffffff',
          borderRadius: 12,
          border: '1px solid var(--bp-border, #e2e8f0)',
          padding: '16px 18px',
          marginBottom: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <form
          className="abc-filter"
          onSubmit={handleSearchSubmit}
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          {/* Search Input Container */}
          <div style={{ flex: '1 1 240px', minWidth: 200 }}>
            <span
              style={{
                display: 'block',
                fontSize: 11.5,
                fontWeight: 650,
                color: 'transparent',
                height: 18,
                lineHeight: '18px',
                marginBottom: 4,
                userSelect: 'none',
              }}
            >
              Search
            </span>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--bp-muted, #94a3b8)',
                  display: 'flex',
                  alignItems: 'center',
                  pointerEvents: 'none',
                }}
              >
                <SearchIcon />
              </span>
              <input
                type="text"
                className="bp-input"
                style={{
                  paddingLeft: 36,
                  height: 38,
                  fontSize: 13,
                  width: '100%',
                  boxSizing: 'border-box',
                }}
                placeholder="Search by Client Name / GSTIN / PAN / Client ID..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
          </div>

          {/* Status Filter */}
          <div style={{ flex: '0 0 130px' }}>
            <label
              htmlFor="filter-status"
              style={{
                display: 'block',
                fontSize: 11.5,
                fontWeight: 650,
                color: '#475569',
                height: 18,
                lineHeight: '18px',
                marginBottom: 4,
              }}
            >
              Status
            </label>
            <select
              id="filter-status"
              className="bp-select"
              style={{
                width: '100%',
                height: 38,
                fontSize: 13,
                boxSizing: 'border-box',
              }}
              value={statusInput}
              onChange={(e) => setStatusInput(e.target.value)}
            >
              <option value="All">All</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          {/* Constitution Type Filter (All + filter_options.constitution_types only) */}
          <div style={{ flex: '0 0 170px' }}>
            <label
              htmlFor="filter-constitution"
              style={{
                display: 'block',
                fontSize: 11.5,
                fontWeight: 650,
                color: '#475569',
                height: 18,
                lineHeight: '18px',
                marginBottom: 4,
              }}
            >
              Constitution Type
            </label>
            <select
              id="filter-constitution"
              className="bp-select"
              style={{
                width: '100%',
                height: 38,
                fontSize: 13,
                boxSizing: 'border-box',
              }}
              value={constitutionInput}
              onChange={(e) => setConstitutionInput(e.target.value)}
            >
              <option value="All">All</option>
              {constitutionOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Registration Type Filter */}
          <div style={{ flex: '0 0 150px' }}>
            <label
              htmlFor="filter-registration"
              style={{
                display: 'block',
                fontSize: 11.5,
                fontWeight: 650,
                color: '#475569',
                height: 18,
                lineHeight: '18px',
                marginBottom: 4,
              }}
            >
              Registration Type
            </label>
            <select
              id="filter-registration"
              className="bp-select"
              style={{
                width: '100%',
                height: 38,
                fontSize: 13,
                boxSizing: 'border-box',
              }}
              value={registrationInput}
              onChange={(e) => setRegistrationInput(e.target.value)}
            >
              <option value="All">All</option>
              <option value="Regular">Regular</option>
              <option value="Composition">Composition</option>
            </select>
          </div>

          {/* Action Buttons: perfectly aligned on same bottom baseline */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              alignSelf: 'flex-end',
            }}
          >
            <button
              type="submit"
              className="bp-btn bp-btn-primary"
              style={{
                height: 38,
                padding: '0 20px',
                background: '#2563eb',
                color: '#ffffff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                fontWeight: 700,
                fontSize: 13,
                borderRadius: 8,
                cursor: 'pointer',
                boxSizing: 'border-box',
                alignSelf: 'auto',
              }}
            >
              <SearchIcon />
              Search
            </button>

            <button
              type="button"
              className="bp-btn bp-btn-outline"
              style={{
                height: 38,
                padding: '0 16px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                fontWeight: 600,
                fontSize: 13,
                borderRadius: 8,
                cursor: 'pointer',
                boxSizing: 'border-box',
                alignSelf: 'auto',
              }}
              onClick={handleReset}
            >
              Reset
            </button>
          </div>
        </form>
      </div>

      {/* Error state banner */}
      {error && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fee2e2',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 16,
            color: '#b91c1c',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 13.5,
          }}
        >
          <span>{error}</span>
          <button
            type="button"
            className="bp-btn bp-btn-outline"
            style={{ borderColor: '#fca5a5', color: '#b91c1c', padding: '4px 12px', fontSize: 12.5 }}
            onClick={() => fetchClients(page, appliedFilters, fy)}
          >
            Retry
          </button>
        </div>
      )}

      {/* 4. Table Card */}
      <div
        className="bp-card abc-table-card"
        style={{
          background: '#ffffff',
          borderRadius: 12,
          border: '1px solid var(--bp-border, #e2e8f0)',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <table
            className="bp-table"
            style={{
              width: '100%',
              minWidth: '1020px',
              borderCollapse: 'collapse',
              fontSize: '13px',
              textAlign: 'left',
              tableLayout: 'auto',
            }}
          >
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ width: '48px', padding: '12px 10px 12px 16px', fontWeight: 700, color: '#475569', textAlign: 'center' }}>
                  #
                </th>
                <th style={{ width: '110px', padding: '12px 10px', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>
                  Client ID
                </th>
                <th style={{ minWidth: '180px', padding: '12px 10px', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>
                  Client Name
                </th>
                <th style={{ width: '170px', padding: '12px 10px', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>
                  GSTIN
                </th>
                <th style={{ width: '170px', padding: '12px 10px', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>
                  Constitution Type
                </th>
                <th style={{ width: '150px', padding: '12px 10px', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>
                  Registration Type
                </th>
                <th style={{ width: '110px', padding: '12px 10px', fontWeight: 700, color: '#475569', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  Status
                </th>
                <th style={{ width: '90px', padding: '12px 16px 12px 10px', fontWeight: 700, color: '#475569', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--bp-muted, #64748b)' }}>
                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <Spinner size={24} />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Loading clients…</span>
                    </div>
                  </td>
                </tr>
              ) : clientRows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--bp-muted, #64748b)' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                      No clients found
                    </div>
                    <div style={{ fontSize: 13, color: '#94a3b8' }}>
                      Try adjusting your search query or filters.
                    </div>
                  </td>
                </tr>
              ) : (
                clientRows.map((client, idx) => {
                  const clientNumber = fromIndex + idx;
                  const clientName = client.business_name || client.client_name || '-';
                  const gstin = client.gstin || '-';
                  const constitution = client.constitution_type || '-';
                  const registration = client.registration_type || '-';
                  const isActive = Boolean(client.is_active);

                  return (
                    <tr
                      key={client.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <td style={{ padding: '14px 10px 14px 16px', textAlign: 'center', color: '#64748b', fontSize: 12.5 }}>
                        {clientNumber}
                      </td>
                      <td style={{ padding: '14px 10px', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        {client.client_code || '-'}
                      </td>
                      <td
                        style={{
                          padding: '14px 10px',
                          fontWeight: 600,
                          color: '#0f172a',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: 240,
                        }}
                        title={clientName}
                      >
                        {clientName}
                      </td>
                      <td
                        style={{
                          padding: '14px 10px',
                          fontFamily: gstin !== '-' ? 'monospace' : 'inherit',
                          fontSize: 12.5,
                          color: gstin !== '-' ? '#0f172a' : '#94a3b8',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {gstin}
                      </td>
                      <td style={{ padding: '14px 10px', color: '#334155', whiteSpace: 'nowrap' }}>
                        {constitution}
                      </td>
                      <td style={{ padding: '14px 10px', color: '#334155', whiteSpace: 'nowrap' }}>
                        {registration}
                      </td>
                      <td style={{ padding: '14px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 14px',
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 700,
                            background: isActive ? '#ddfdf2' : '#fae7e9',
                            color: isActive ? '#00734a' : '#ec0a3a',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px 14px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <Link
                          to={`/admin/billing/${client.id}`}
                          className="bp-btn bp-btn-outline"
                          style={{
                            display: 'inline-block',
                            padding: '4px 16px',
                            fontSize: 12.5,
                            fontWeight: 650,
                            color: '#2563eb',
                            borderColor: '#bfdbfe',
                            background: '#ffffff',
                            borderRadius: 6,
                            textDecoration: 'none',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2.2" aria-hidden="true">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 5. Pagination Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 18px',
            borderTop: '1px solid #e2e8f0',
            flexWrap: 'wrap',
            gap: 12,
            background: '#ffffff',
          }}
        >
          <div style={{ fontSize: 13, color: '#64748b' }}>
            Showing {fromIndex} to {toIndex} of {totalClients} clients
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Previous Page Button */}
            <button
              type="button"
              aria-label="Previous page"
              disabled={currentPage <= 1 || loading}
              onClick={() => {
                const prev = Math.max(1, currentPage - 1);
                setPage(prev);
              }}
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: currentPage <= 1 || loading ? '#cbd5e1' : '#475569',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: currentPage <= 1 || loading ? 'not-allowed' : 'pointer',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              &lt;
            </button>

            {/* Page number buttons */}
            {getPaginationItems(currentPage, lastPage).map((item, idx) => {
              if (typeof item === 'string' && item.startsWith('ellipsis')) {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    style={{
                      width: 28,
                      textAlign: 'center',
                      color: '#94a3b8',
                      fontSize: 13,
                      userSelect: 'none',
                    }}
                  >
                    …
                  </span>
                );
              }

              const pageNum = Number(item);
              const isActive = pageNum === currentPage;
              return (
                <button
                  key={pageNum}
                  type="button"
                  disabled={loading}
                  onClick={() => setPage(pageNum)}
                  style={{
                    minWidth: 32,
                    height: 32,
                    padding: '0 8px',
                    borderRadius: 6,
                    border: isActive ? '1px solid #2563eb' : '1px solid #cbd5e1',
                    background: isActive ? '#2563eb' : '#ffffff',
                    color: isActive ? '#ffffff' : '#334155',
                    fontSize: 13,
                    fontWeight: isActive ? 700 : 500,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {pageNum}
                </button>
              );
            })}

            {/* Next Page Button */}
            <button
              type="button"
              aria-label="Next page"
              disabled={currentPage >= lastPage || loading}
              onClick={() => {
                const next = Math.min(lastPage, currentPage + 1);
                setPage(next);
              }}
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: currentPage >= lastPage || loading ? '#cbd5e1' : '#475569',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: currentPage >= lastPage || loading ? 'not-allowed' : 'pointer',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              &gt;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
