import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';

const CONSTITUTIONS = [
  'Proprietorship',
  'Partnership Firm',
  'Partnership',
  'LLP',
  'Private Limited',
  'Private Limited Company',
  'Individual',
  'One Person Company',
  'Trust',
  'Society',
];

function formatLastUpdated(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

// SVG Icons matching mockup
function UsersIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
    </svg>
  );
}

function UserCheckIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  );
}

function UserXIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <path d="M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" fill="currentColor" />
      <path d="M2 19c0-2.76 4.48-5 8-5 1.1 0 2.22.21 3.2.6-1.38 1.15-2.2 2.8-2.2 4.4v2H2v-2z" fill="currentColor" />
      <line x1="16" y1="16" x2="21" y2="21" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
      <line x1="21" y1="16" x2="16" y2="21" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

/* Zero-width anchor: the arrow hangs to the right of the label, so the label itself stays exactly
 * centred over its column (the data cells below are centred the same way). */
function SortIcon({ active }) {
  return (
    <span
      aria-hidden="true"
      style={{
        position: 'relative',
        display: 'inline-block',
        width: 0,
        height: 12,
        verticalAlign: 'middle',
        overflow: 'visible',
        color: active ? '#0066ff' : '#60a5fa',
      }}
    >
      <svg style={{ position: 'absolute', left: 6, top: 0 }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 15l5 5 5-5" />
        <path d="M7 9l5-5 5 5" />
      </svg>
    </span>
  );
}

export default function AdminClients() {
  const [overview, setOverview] = useState(null);
  const [rows, setRows] = useState([]);
  const [paginationMeta, setPaginationMeta] = useState({
    total: 0,
    from: 0,
    to: 0,
    current_page: 1,
    last_page: 1,
  });

  // Filter States
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [constitution, setConstitution] = useState('');
  const [gstStatus, setGstStatus] = useState('');

  // Sorting & Pagination States
  const [sort, setSort] = useState('client_code');
  const [dir, setDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const loadOverview = () => {
    api('/admin/dashboard')
      .then((d) => setOverview(d.overview))
      .catch(() => { });
  };

  const load = (targetPage = page) => {
    setLoading(true);
    const qs = new URLSearchParams({
      page: targetPage,
      per_page: 10,
      sort,
      dir,
    });
    if (q) qs.set('q', q);
    if (status) qs.set('status', status);
    if (constitution) qs.set('constitution_type', constitution);
    if (gstStatus) qs.set('gst_status', gstStatus);

    api(`/admin/clients?${qs}`)
      .then((d) => {
        setRows(d.data || []);
        setPaginationMeta({
          total: d.total || (d.data ? d.data.length : 0),
          from: d.from || (d.data && d.data.length > 0 ? 1 : 0),
          to: d.to || (d.data ? d.data.length : 0),
          current_page: d.current_page || 1,
          last_page: d.last_page || 1,
        });
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOverview();
  }, []);

  useEffect(() => {
    load(1);
  }, [sort, dir, status, constitution, gstStatus]);

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    load(1);
  };

  const handleReset = () => {
    setQ('');
    setStatus('');
    setConstitution('');
    setGstStatus('');
    setSort('client_code');
    setDir('asc');
    setPage(1);
  };

  const handleSort = (columnKey) => {
    if (sort === columnKey) {
      setDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSort(columnKey);
      setDir('asc');
    }
  };

  const o = overview || {};

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto', paddingBottom: 60 }}>
      {/* 1. Header Row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 14,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#001f7a', letterSpacing: '-0.4px' }}>
            Client Management
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#334155' }}>
            View, manage and maintain all your clients in one place.
          </p>
        </div>
        <Link
          to="/admin/clients/new"
          style={{
            background: '#0066ff',
            color: '#ffffff',
            padding: '10px 20px',
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 13.5,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            textDecoration: 'none',
          }}
        >
          + Add New Client
        </Link>
      </div>

      {/* 2. Top 3 Stat Cards (Exact Mockup Colors & Styling) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
          gap: 18,
          marginBottom: 20,
        }}
      >
        {/* Total Clients Card - Ice-Blue Tint */}
        <div
          style={{
            background: '#edf5ff',
            borderRadius: 16,
            border: '1.5px solid #cfe2fe',
            padding: '22px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: '#0066ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              flexShrink: 0,
            }}
          >
            <UsersIcon />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#001f7a' }}>
              Total Clients
            </div>
            <div style={{ fontSize: 34, fontWeight: 800, color: '#001f7a', marginTop: 3, lineHeight: 1.1 }}>
              {o.total_clients ?? paginationMeta.total ?? 0}
            </div>
          </div>
        </div>

        {/* Active Clients Card - Mint-Green Tint */}
        <div
          style={{
            background: '#eafaf1',
            borderRadius: 16,
            border: '1.5px solid #bbf7d0',
            padding: '22px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: '#007a3d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              flexShrink: 0,
            }}
          >
            <UserCheckIcon />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#001f7a' }}>
              Active Clients
            </div>
            <div style={{ fontSize: 34, fontWeight: 800, color: '#001f7a', marginTop: 3, lineHeight: 1.1 }}>
              {o.active_clients ?? 0}
            </div>
          </div>
        </div>

        {/* Inactive Clients Card - Rose-Pink Tint */}
        <div
          style={{
            background: '#fff1f2',
            borderRadius: 16,
            border: '1.5px solid #fecdd3',
            padding: '22px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: '#e11d48',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              flexShrink: 0,
            }}
          >
            <UserXIcon />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#001f7a' }}>
              Inactive Clients
            </div>
            <div style={{ fontSize: 34, fontWeight: 800, color: '#001f7a', marginTop: 3, lineHeight: 1.1 }}>
              {o.inactive_clients ?? 0}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Filter Bar Card */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 12,
          border: '1.5px solid #e2e8f0',
          padding: '12px 16px',
          marginBottom: 18,
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        <form
          onSubmit={handleSearchSubmit}
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          {/* Search box with Icon */}
          <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 160 }}>
            <span
              style={{
                position: 'absolute',
                left: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                pointerEvents: 'none',
              }}
            >
              <SearchIcon />
            </span>
            <input
              type="text"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                paddingLeft: 38,
                paddingRight: 12,
                height: 42,
                fontSize: 13.5,
                borderRadius: 8,
                border: '1.5px solid #e2e8f0',
                outline: 'none',
                color: '#0f172a',
                background: '#fff',
              }}
              placeholder="Search clients..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {/* All Status dropdown with blue chevron */}
          <div style={{ position: 'relative', flex: '1 1 140px', minWidth: 120 }}>
            <select
              style={{
                width: '100%',
                boxSizing: 'border-box',
                height: 42,
                padding: '0 32px 0 14px',
                fontSize: 13.5,
                fontWeight: 500,
                color: '#1e293b',
                borderRadius: 8,
                border: '1.5px solid #e2e8f0',
                background: '#fff',
                appearance: 'none',
                cursor: 'pointer',
                outline: 'none',
              }}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0066ff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>

          {/* All Constitution dropdown with blue chevron */}
          <div style={{ position: 'relative', flex: '1 1 160px', minWidth: 140 }}>
            <select
              style={{
                width: '100%',
                boxSizing: 'border-box',
                height: 42,
                padding: '0 32px 0 14px',
                fontSize: 13.5,
                fontWeight: 500,
                color: '#1e293b',
                borderRadius: 8,
                border: '1.5px solid #e2e8f0',
                background: '#fff',
                appearance: 'none',
                cursor: 'pointer',
                outline: 'none',
              }}
              value={constitution}
              onChange={(e) => setConstitution(e.target.value)}
            >
              <option value="">All Constitution</option>
              {CONSTITUTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0066ff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>

          {/* All GST Status dropdown with blue chevron */}
          <div style={{ position: 'relative', flex: '1 1 150px', minWidth: 130 }}>
            <select
              style={{
                width: '100%',
                boxSizing: 'border-box',
                height: 42,
                padding: '0 32px 0 14px',
                fontSize: 13.5,
                fontWeight: 500,
                color: '#1e293b',
                borderRadius: 8,
                border: '1.5px solid #e2e8f0',
                background: '#fff',
                appearance: 'none',
                cursor: 'pointer',
                outline: 'none',
              }}
              value={gstStatus}
              onChange={(e) => setGstStatus(e.target.value)}
            >
              <option value="">All GST Status</option>
              <option value="registered">GST Registered</option>
              <option value="unregistered">Unregistered</option>
            </select>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0066ff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>

          {/* Search Button */}
          <button
            type="submit"
            style={{
              height: 42,
              padding: '0 22px',
              background: '#0066ff',
              color: '#ffffff',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              fontWeight: 700,
              fontSize: 13.5,
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <SearchIcon />
            Search
          </button>

          {/* Reset Button */}
          <button
            type="button"
            style={{
              height: 42,
              padding: '0 18px',
              background: '#ffffff',
              color: '#0066ff',
              border: '1.5px solid #bfdbfe',
              borderRadius: 8,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontWeight: 650,
              fontSize: 13.5,
              cursor: 'pointer',
            }}
            onClick={handleReset}
          >
            <RefreshIcon />
            Reset
          </button>
        </form>
      </div>

      {/* 4. Table Card (Matching Mockup Table Design) */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 12,
          border: '1.5px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
        }}
      >
        <div className="ac-scroll" style={{ width: '100%', overflowX: 'hidden' }}>
          <table
            className="ac-table"
            style={{
              width: '100%',
              tableLayout: 'fixed',
              borderCollapse: 'collapse',
              fontSize: '13px',
              textAlign: 'center',
            }}
          >
            <thead>
              <tr style={{ background: '#eaf4ff', borderBottom: '1.5px solid #d0e4ff' }}>
                <th
                  style={{
                    width: '9%',
                    padding: '12px 4px',
                    fontWeight: 750,
                    color: '#001f7a',
                    cursor: 'pointer',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    fontSize: 12.5,
                  }}
                  onClick={() => handleSort('client_code')}
                >
                  Client ID <SortIcon active={sort === 'client_code'} />
                </th>
                <th
                  style={{
                    width: '21%',
                    padding: '12px 6px',
                    fontWeight: 750,
                    color: '#001f7a',
                    cursor: 'pointer',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    fontSize: 12.5,
                  }}
                  onClick={() => handleSort('client_name')}
                >
                  Client Name <SortIcon active={sort === 'client_name'} />
                </th>
                <th
                  style={{
                    width: '13%',
                    padding: '12px 6px',
                    fontWeight: 750,
                    color: '#001f7a',
                    cursor: 'pointer',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    fontSize: 12.5,
                  }}
                  onClick={() => handleSort('constitution_type')}
                >
                  Constitution <SortIcon active={sort === 'constitution_type'} />
                </th>
                <th
                  style={{
                    width: '10%',
                    padding: '12px 4px',
                    fontWeight: 750,
                    color: '#001f7a',
                    cursor: 'pointer',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    fontSize: 12.5,
                  }}
                  onClick={() => handleSort('pan')}
                >
                  PAN <SortIcon active={sort === 'pan'} />
                </th>
                <th
                  style={{
                    width: '13%',
                    padding: '12px 6px',
                    fontWeight: 750,
                    color: '#001f7a',
                    cursor: 'pointer',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    fontSize: 12.5,
                  }}
                  onClick={() => handleSort('gstin')}
                >
                  GSTIN <SortIcon active={sort === 'gstin'} />
                </th>
                <th
                  style={{
                    width: '10%',
                    padding: '12px 4px',
                    fontWeight: 750,
                    color: '#001f7a',
                    cursor: 'pointer',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    fontSize: 12.5,
                  }}
                  onClick={() => handleSort('mobile')}
                >
                  Mobile <SortIcon active={sort === 'mobile'} />
                </th>
                <th
                  style={{
                    width: '8%',
                    padding: '12px 4px',
                    fontWeight: 750,
                    color: '#001f7a',
                    cursor: 'pointer',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    fontSize: 12.5,
                  }}
                  onClick={() => handleSort('status')}
                >
                  Status <SortIcon active={sort === 'status'} />
                </th>
                <th
                  style={{
                    width: '9%',
                    padding: '12px 4px',
                    fontWeight: 750,
                    color: '#001f7a',
                    cursor: 'pointer',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    fontSize: 12.5,
                  }}
                  onClick={() => handleSort('updated_at')}
                >
                  Last Updated <SortIcon active={sort === 'updated_at'} />
                </th>
                <th
                  style={{
                    width: '7%',
                    padding: '12px 4px',
                    fontWeight: 750,
                    color: '#001f7a',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    fontSize: 12.5,
                  }}
                >
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '36px 16px', color: '#64748b' }}>
                    Loading clients…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '40px 16px', color: '#64748b' }}>
                    No clients found matching your search criteria.
                  </td>
                </tr>
              ) : (
                rows.map((c) => {
                  const isActive = c.user?.is_active ?? (c.status === 'active' || c.status === 1 || c.status === true);
                  const clientCode = c.client_code || `CL-${String(c.id).padStart(3, '0')}`;
                  const clientName = c.client_name || c.business_name || c.user?.name || '—';
                  return (
                    <tr
                      key={c.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#fcfdfe')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '12px 4px', textAlign: 'center', fontWeight: 650, color: '#001f7a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {clientCode}
                      </td>
                      <td style={{ padding: '12px 6px', textAlign: 'center', fontWeight: 600, color: '#0066ff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={clientName}>
                        <Link
                          to={`/admin/clients/${c.id}/edit`}
                          style={{
                            color: '#0066ff',
                            textDecoration: 'none',
                            fontWeight: 600,
                            display: 'inline-block',
                            maxWidth: '100%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            verticalAlign: 'middle',
                          }}
                        >
                          {clientName}
                        </Link>
                      </td>
                      <td style={{ padding: '12px 6px', textAlign: 'center', color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.constitution_type || '—'}>
                        {c.constitution_type || '—'}
                      </td>
                      <td style={{ padding: '12px 4px', textAlign: 'center', fontFamily: 'monospace', fontSize: 12, color: '#334155', whiteSpace: 'nowrap' }}>
                        {c.pan || '—'}
                      </td>
                      <td style={{ padding: '12px 6px', textAlign: 'center', fontFamily: 'monospace', fontSize: 12, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.gstin || (c.has_gst ? '—' : 'Unregistered')}>
                        {c.gstin || (c.has_gst ? '—' : 'Unregistered')}
                      </td>
                      <td style={{ padding: '12px 4px', textAlign: 'center', color: '#334155', whiteSpace: 'nowrap' }}>
                        {c.mobile || c.user?.phone || '—'}
                      </td>
                      <td style={{ padding: '12px 4px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 10px',
                            borderRadius: 20,
                            fontSize: 11.5,
                            fontWeight: 700,
                            background: isActive ? '#e6f9ee' : '#fee2e2',
                            color: isActive ? '#047857' : '#dc2626',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 4px', textAlign: 'center', color: '#475569', whiteSpace: 'nowrap', fontSize: 12 }}>
                        {formatLastUpdated(c.updated_at)}
                      </td>
                      <td style={{ padding: '12px 4px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <Link
                          to={`/admin/clients/${c.id}/edit`}
                          style={{
                            display: 'inline-block',
                            padding: '4px 12px',
                            fontSize: 12,
                            fontWeight: 650,
                            color: '#0066ff',
                            background: '#e8f4ff',
                            border: '1px solid #b8daff',
                            borderRadius: 6,
                            textDecoration: 'none',
                            whiteSpace: 'nowrap',
                            transition: 'background 0.15s ease',
                          }}
                        >
                          Manage
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 5. Pagination Footer (Matching Mockup Footer Design) */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 20px',
            borderTop: '1.5px solid #e2e8f0',
            flexWrap: 'wrap',
            gap: 12,
            background: '#ffffff',
          }}
        >
          <div style={{ fontSize: 13.5, fontWeight: 750, color: '#001f7a' }}>
            Showing {paginationMeta.from || (rows.length > 0 ? 1 : 0)} to {paginationMeta.to || rows.length} of {paginationMeta.total} clients
          </div>

          <div className="cl-pager" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Prev Page Button */}
            <button
              type="button"
              disabled={paginationMeta.current_page <= 1}
              onClick={() => {
                const prev = Math.max(1, paginationMeta.current_page - 1);
                setPage(prev);
                load(prev);
              }}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                color: paginationMeta.current_page <= 1 ? '#cbd5e1' : '#475569',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: paginationMeta.current_page <= 1 ? 'not-allowed' : 'pointer',
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              &lt;
            </button>

            {/* Page number buttons */}
            {Array.from({ length: paginationMeta.last_page }, (_, i) => i + 1)
              .filter((p) => {
                const last = paginationMeta.last_page;
                const cur = paginationMeta.current_page;
                if (last <= 7) return true;
                if (p === 1 || p === last) return true;
                if (cur <= 4) return p <= 5;
                if (cur >= last - 3) return p >= last - 4;
                return Math.abs(p - cur) <= 1;
              })
              .map((p, idx, arr) => {
                const prev = arr[idx - 1];
                const showEllipsis = prev && p - prev > 1;
                const isActive = p === paginationMeta.current_page;
                return (
                  <span key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {showEllipsis && (
                      <span style={{ padding: '0 4px', color: '#94a3b8', fontSize: 13 }}>…</span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setPage(p);
                        load(p);
                      }}
                      style={{
                        minWidth: 36,
                        height: 36,
                        padding: '0 8px',
                        borderRadius: 8,
                        border: isActive ? '1px solid #0066ff' : '1px solid #e2e8f0',
                        background: isActive ? '#0066ff' : '#ffffff',
                        color: isActive ? '#ffffff' : '#334155',
                        fontWeight: isActive ? 700 : 500,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      {p}
                    </button>
                  </span>
                );
              })}

            {/* Next Page Button */}
            <button
              type="button"
              disabled={paginationMeta.current_page >= paginationMeta.last_page}
              onClick={() => {
                const next = Math.min(paginationMeta.last_page, paginationMeta.current_page + 1);
                setPage(next);
                load(next);
              }}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                color: paginationMeta.current_page >= paginationMeta.last_page ? '#cbd5e1' : '#475569',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: paginationMeta.current_page >= paginationMeta.last_page ? 'not-allowed' : 'pointer',
                fontSize: 14,
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
