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
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function UserCheckIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <polyline points="16 11 18 13 22 9" />
    </svg>
  );
}

function UserXIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="17" y1="8" x2="22" y2="13" />
      <line x1="22" y1="8" x2="17" y2="13" />
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
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function SortIcon({ active, dir }) {
  return (
    <span
      style={{
        display: 'inline-block',
        marginLeft: 4,
        whiteSpace: 'nowrap',
        color: active ? '#2563eb' : '#94a3b8',
        fontWeight: active ? 800 : 400,
        fontSize: 11,
      }}
    >
      {active ? (dir === 'asc' ? '▲' : '▼') : '⇅'}
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
      .catch(() => {});
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
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--bp-navy, #0a3d82)' }}>
            Client Management
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--bp-muted, #64748b)' }}>
            View, manage and maintain all your clients in one place.
          </p>
        </div>
        <Link
          to="/admin/clients/new"
          className="bp-btn bp-btn-primary"
          style={{
            background: 'var(--bp-blue, #2563eb)',
            color: '#ffffff',
            padding: '10px 18px',
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 13.5,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            textDecoration: 'none',
            boxShadow: '0 2px 4px rgba(37,99,235,0.2)',
          }}
        >
          + Add New Client
        </Link>
      </div>

      {/* 2. Top 3 Stat Cards (Exact PDF Mockup Colors) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
          marginBottom: 20,
        }}
      >
        {/* Total Clients Card - Ice-Blue Tint */}
        <div
          style={{
            background: '#e4f4f3',
            borderRadius: 14,
            border: '1px solid #bce6e4',
            padding: '22px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: '#285bd1',
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
            <div style={{ fontSize: 13.5, fontWeight: 650, color: '#334155' }}>
              Total Clients
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, color: '#0f172a', marginTop: 2, lineHeight: 1.1 }}>
              {o.total_clients ?? paginationMeta.total ?? 0}
            </div>
          </div>
        </div>

        {/* Active Clients Card - Mint-Green Tint */}
        <div
          style={{
            background: '#ddfdf2',
            borderRadius: 14,
            border: '1px solid #bbf7d0',
            padding: '22px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: '#00734a',
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
            <div style={{ fontSize: 13.5, fontWeight: 650, color: '#334155' }}>
              Active Clients
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, color: '#0f172a', marginTop: 2, lineHeight: 1.1 }}>
              {o.active_clients ?? 0}
            </div>
          </div>
        </div>

        {/* Inactive Clients Card - Rose-Pink Tint */}
        <div
          style={{
            background: '#fae7e9',
            borderRadius: 14,
            border: '1px solid #fecaca',
            padding: '22px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: '#ec0a3a',
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
            <div style={{ fontSize: 13.5, fontWeight: 650, color: '#334155' }}>
              Inactive Clients
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, color: '#0f172a', marginTop: 2, lineHeight: 1.1 }}>
              {o.inactive_clients ?? 0}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Filter Bar Card */}
      <div
        className="bp-card"
        style={{
          background: '#ffffff',
          borderRadius: 12,
          border: '1px solid var(--bp-border, #e2e8f0)',
          padding: '14px 18px',
          marginBottom: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
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
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
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
              style={{ paddingLeft: 36, height: 40, fontSize: 13.5 }}
              placeholder="Search clients..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {/* All Status dropdown */}
          <select
            className="bp-select"
            style={{ flex: '0 0 140px', height: 40, fontSize: 13.5 }}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          {/* All Constitution dropdown */}
          <select
            className="bp-select"
            style={{ flex: '0 0 170px', height: 40, fontSize: 13.5 }}
            value={constitution}
            onChange={(e) => setConstitution(e.target.value)}
          >
            <option value="">All Constitution</option>
            {CONSTITUTIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* All GST Status dropdown */}
          <select
            className="bp-select"
            style={{ flex: '0 0 160px', height: 40, fontSize: 13.5 }}
            value={gstStatus}
            onChange={(e) => setGstStatus(e.target.value)}
          >
            <option value="">All GST Status</option>
            <option value="registered">GST Registered</option>
            <option value="unregistered">Unregistered</option>
          </select>

          {/* Search Button */}
          <button
            type="submit"
            className="bp-btn bp-btn-primary"
            style={{
              height: 40,
              padding: '0 20px',
              background: '#2563eb',
              color: '#ffffff',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontWeight: 700,
              fontSize: 13,
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            <SearchIcon />
            Search
          </button>

          {/* Reset Button */}
          <button
            type="button"
            className="bp-btn bp-btn-outline"
            style={{
              height: 40,
              padding: '0 16px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontWeight: 600,
              fontSize: 13,
              borderRadius: 8,
              cursor: 'pointer',
            }}
            onClick={handleReset}
          >
            <RefreshIcon />
            Reset
          </button>
        </form>
      </div>

      {/* 4. Table Card (Explicit dedicated column widths so Last Updated and Action never collide) */}
      <div
        className="bp-card"
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
              minWidth: '1080px',
              borderCollapse: 'collapse',
              fontSize: '13px',
              textAlign: 'left',
              tableLayout: 'fixed',
            }}
          >
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th
                  style={{
                    width: '95px',
                    padding: '12px 10px 12px 16px',
                    fontWeight: 700,
                    color: '#475569',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    letterSpacing: 'normal',
                  }}
                  onClick={() => handleSort('client_code')}
                >
                  Client ID <SortIcon active={sort === 'client_code'} dir={dir} />
                </th>
                <th
                  style={{
                    width: '180px',
                    padding: '12px 10px',
                    fontWeight: 700,
                    color: '#475569',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    letterSpacing: 'normal',
                  }}
                  onClick={() => handleSort('client_name')}
                >
                  Client Name <SortIcon active={sort === 'client_name'} dir={dir} />
                </th>
                <th
                  style={{
                    width: '130px',
                    padding: '12px 10px',
                    fontWeight: 700,
                    color: '#475569',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    letterSpacing: 'normal',
                  }}
                  onClick={() => handleSort('constitution_type')}
                >
                  Constitution <SortIcon active={sort === 'constitution_type'} dir={dir} />
                </th>
                <th
                  style={{
                    width: '110px',
                    padding: '12px 10px',
                    fontWeight: 700,
                    color: '#475569',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    letterSpacing: 'normal',
                  }}
                  onClick={() => handleSort('pan')}
                >
                  PAN <SortIcon active={sort === 'pan'} dir={dir} />
                </th>
                <th
                  style={{
                    width: '150px',
                    padding: '12px 10px',
                    fontWeight: 700,
                    color: '#475569',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    letterSpacing: 'normal',
                  }}
                  onClick={() => handleSort('gstin')}
                >
                  GSTIN <SortIcon active={sort === 'gstin'} dir={dir} />
                </th>
                <th
                  style={{
                    width: '115px',
                    padding: '12px 10px',
                    fontWeight: 700,
                    color: '#475569',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    letterSpacing: 'normal',
                  }}
                  onClick={() => handleSort('mobile')}
                >
                  Mobile <SortIcon active={sort === 'mobile'} dir={dir} />
                </th>
                <th
                  style={{
                    width: '95px',
                    padding: '12px 10px',
                    fontWeight: 700,
                    color: '#475569',
                    cursor: 'pointer',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    letterSpacing: 'normal',
                  }}
                  onClick={() => handleSort('status')}
                >
                  Status <SortIcon active={sort === 'status'} dir={dir} />
                </th>
                <th
                  style={{
                    width: '130px',
                    padding: '12px 10px',
                    fontWeight: 700,
                    color: '#475569',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    letterSpacing: 'normal',
                  }}
                  onClick={() => handleSort('updated_at')}
                >
                  Last Updated <SortIcon active={sort === 'updated_at'} dir={dir} />
                </th>
                <th
                  style={{
                    width: '95px',
                    padding: '12px 16px 12px 10px',
                    fontWeight: 700,
                    color: '#475569',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    letterSpacing: 'normal',
                  }}
                >
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--bp-muted)' }}>
                    Loading clients…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--bp-muted)' }}>
                    No clients found matching your search criteria.
                  </td>
                </tr>
              ) : (
                rows.map((c) => (
                  <tr
                    key={c.id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <td style={{ width: '95px', padding: '14px 10px 14px 16px', fontWeight: 700, color: 'var(--bp-navy, #0a3d82)', whiteSpace: 'nowrap' }}>
                      {c.client_code || `CL-${String(c.id).padStart(3, '0')}`}
                    </td>
                    <td style={{ width: '180px', padding: '14px 10px', fontWeight: 600, color: 'var(--bp-text, #0f172a)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.client_name || c.business_name || c.user?.name}>
                      {c.client_name || c.business_name || c.user?.name || '—'}
                    </td>
                    <td style={{ width: '130px', padding: '14px 10px', color: 'var(--bp-text, #0f172a)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.constitution_type || '—'}
                    </td>
                    <td style={{ width: '110px', padding: '14px 10px', fontFamily: 'monospace', fontSize: 12.5, color: 'var(--bp-text, #0f172a)', whiteSpace: 'nowrap' }}>
                      {c.pan || '—'}
                    </td>
                    <td style={{ width: '150px', padding: '14px 10px', fontFamily: 'monospace', fontSize: 12.5, color: c.gstin ? 'var(--bp-text, #0f172a)' : 'var(--bp-muted, #94a3b8)', whiteSpace: 'nowrap' }}>
                      {c.gstin || (c.has_gst ? '—' : 'Unregistered')}
                    </td>
                    <td style={{ width: '115px', padding: '14px 10px', color: 'var(--bp-text, #0f172a)', whiteSpace: 'nowrap' }}>
                      {c.mobile || c.user?.phone || '—'}
                    </td>
                    <td style={{ width: '95px', padding: '14px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 12px',
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 700,
                          background: c.user?.is_active ? '#ddfdf2' : '#fae7e9',
                          color: c.user?.is_active ? '#00734a' : '#ec0a3a',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {c.user?.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ width: '130px', padding: '14px 10px', color: 'var(--bp-muted, #64748b)', whiteSpace: 'nowrap', fontSize: 12.5 }}>
                      {formatLastUpdated(c.updated_at)}
                    </td>
                    <td style={{ width: '95px', padding: '14px 16px 14px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <Link
                        to={`/admin/clients/${c.id}/edit`}
                        className="bp-btn bp-btn-outline"
                        style={{
                          display: 'inline-block',
                          padding: '5px 14px',
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
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))
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
          <div style={{ fontSize: 13, color: 'var(--bp-muted, #64748b)' }}>
            Showing {paginationMeta.from || (rows.length > 0 ? 1 : 0)} to {paginationMeta.to || rows.length} of {paginationMeta.total} clients
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
                width: 32,
                height: 32,
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: paginationMeta.current_page <= 1 ? '#cbd5e1' : '#475569',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: paginationMeta.current_page <= 1 ? 'not-allowed' : 'pointer',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              &lt;
            </button>

            {/* Page number buttons */}
            {Array.from({ length: paginationMeta.last_page }, (_, i) => i + 1)
              .filter((p) => {
                if (paginationMeta.last_page <= 7) return true;
                if (p === 1 || p === paginationMeta.last_page) return true;
                return Math.abs(p - paginationMeta.current_page) <= 1;
              })
              .map((p, idx, arr) => {
                const prev = arr[idx - 1];
                const showEllipsis = prev && p - prev > 1;
                const isActive = p === paginationMeta.current_page;
                return (
                  <span key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {showEllipsis && (
                      <span style={{ padding: '0 4px', color: '#94a3b8', fontSize: 12 }}>…</span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setPage(p);
                        load(p);
                      }}
                      style={{
                        minWidth: 32,
                        height: 32,
                        padding: '0 8px',
                        borderRadius: 6,
                        border: isActive ? '1px solid #2563eb' : '1px solid #cbd5e1',
                        background: isActive ? '#2563eb' : '#ffffff',
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
                width: 32,
                height: 32,
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: paginationMeta.current_page >= paginationMeta.last_page ? '#cbd5e1' : '#475569',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: paginationMeta.current_page >= paginationMeta.last_page ? 'not-allowed' : 'pointer',
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
