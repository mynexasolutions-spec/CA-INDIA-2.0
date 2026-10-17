import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';

const FY_OPTIONS = ['2026-27', '2025-26', '2024-25'];
const STATUS_OPTIONS = ['All', 'Pending', 'Filed', 'Upcoming'];

export default function AdminCmp08List() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ total_clients: 0, active_clients: 0, pending: 0, filed: 0 });
  const [quarters, setQuarters] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [fy, setFy] = useState('2026-27');
  const [quarter, setQuarter] = useState('All');
  const [status, setStatus] = useState('All');
  const [applied, setApplied] = useState({ search: '', fy: '2026-27', quarter: 'All', status: 'All' });

  const load = (p = 1, f = applied) => {
    setLoading(true);
    const params = new URLSearchParams({
      page: p,
      fy: f.fy,
      quarter: f.quarter,
      status: f.status,
      search: f.search,
    });
    api(`/admin/cmp08/clients?${params}`)
      .then(d => {
        setRows(Array.isArray(d.rows) ? d.rows : []);
        setSummary(d.summary || { total_clients: 0, active_clients: 0, pending: 0, filed: 0 });
        setTotal(d.total || 0);
        setQuarters(d.quarters || []);
        setPage(p);
      })
      .catch(err => {
        console.error('Failed to load CMP-08 clients:', err);
        setRows([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(1, applied);
  }, []);

  const doSearch = () => {
    const f = { search, fy, quarter, status };
    setApplied(f);
    load(1, f);
  };

  const doReset = () => {
    const f = { search: '', fy: '2026-27', quarter: 'All', status: 'All' };
    setSearch('');
    setFy('2026-27');
    setQuarter('All');
    setStatus('All');
    setApplied(f);
    load(1, f);
  };

  const perPage = 10;
  const totalPages = Math.ceil(total / perPage);

  return (
    <div style={{ fontFamily: "'Inter',system-ui,sans-serif", padding: '4px 0 48px', color: '#1e293b' }}>

      {/* Header & Breadcrumb */}
      <div className="gst-head gst-head-list" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>
            CMP-08 – Client List <span style={{ fontWeight: 500, color: '#475569', fontSize: 17 }}>(Admin Portal)</span>
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, fontWeight: 500, color: '#2563eb' }}>
            Select a client to view, verify and manage CMP-08 return.
          </p>
        </div>

        {/* Top-Right Breadcrumb */}
        <div className="gst-crumbs gst-crumbs-right" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 500 }}>
          <Link to="/admin/gst-returns" style={{ color: '#2563eb', textDecoration: 'none' }}>
            GST Compliance
          </Link>
          <span style={{ color: '#2563eb' }}>&gt;</span>
          <span style={{ color: '#2563eb' }}>CMP-08</span>
          <span style={{ color: '#2563eb' }}>&gt;</span>
          <span style={{ color: '#2563eb' }}>Client List</span>
        </div>
      </div>

      {/* Filters Strip */}
      <div className="cm-filter" style={{
        background: '#fff',
        border: '1.5px solid #bfdbfe',
        borderRadius: 10,
        padding: '12px 16px',
        marginBottom: 18,
        display: 'flex',
        alignItems: 'flex-end',
        gap: 12,
        flexWrap: 'wrap',
      }}>
        {/* Search Input */}
        <div style={{ flex: '1 1 280px', minWidth: 240, position: 'relative' }}>
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#2563eb"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            placeholder="Search by Client Name / Client ID / GSTIN..."
            style={{
              width: '100%',
              padding: '8px 12px 8px 34px',
              border: '1.5px solid #bfdbfe',
              borderRadius: 7,
              fontSize: 13,
              color: '#1e293b',
              outline: 'none',
              boxSizing: 'border-box',
              background: '#fff',
            }}
          />
        </div>

        {/* Return Year */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#334155' }}>Return Year</label>
          <select
            value={fy}
            onChange={e => setFy(e.target.value)}
            style={selectStyle}
          >
            {FY_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Quarter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#334155' }}>Quarter</label>
          <select
            value={quarter}
            onChange={e => setQuarter(e.target.value)}
            style={selectStyle}
          >
            <option value="All">All</option>
            {quarters.map(q => <option key={q.key} value={q.key}>{q.key}</option>)}
          </select>
        </div>

        {/* Status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#334155' }}>Status</label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            style={selectStyle}
          >
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Search Button */}
        <button
          onClick={doSearch}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            padding: '8.5px 22px',
            background: '#1d4ed8',
            border: 'none',
            borderRadius: 7,
            fontSize: 13,
            fontWeight: 600,
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          Search
        </button>

        {/* Reset Button */}
        <button
          onClick={doReset}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 20px',
            background: '#fff',
            border: '1.5px solid #93c5fa',
            borderRadius: 7,
            fontSize: 13,
            fontWeight: 600,
            color: '#1d4ed8',
            cursor: 'pointer',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
          </svg>
          Reset
        </button>
      </div>

      {/* Summary Cards */}
      <div className="cm-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 18 }}>
        {/* Card 1: Total Composition Clients */}
        <div style={{
          background: '#eff6ff',
          border: '1.5px solid #bfdbfe',
          borderRadius: 10,
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}>
          <div style={{ flexShrink: 0, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="#1d4ed8">
              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#1e40af' }}>Total Composition Clients</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#1d4ed8', marginTop: 2, lineHeight: 1.1 }}>
              {summary.total_clients ?? 0}
            </div>
          </div>
        </div>

        {/* Card 2: Active Clients */}
        <div style={{
          background: '#f0fdf4',
          border: '1.5px solid #bbf7d0',
          borderRadius: 10,
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}>
          <div style={{ flexShrink: 0, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="9 12 11 14 15 9" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#15803d' }}>Active Clients</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#15803d', marginTop: 2, lineHeight: 1.1 }}>
              {summary.active_clients ?? 0}
            </div>
          </div>
        </div>

        {/* Card 3: Pending CMP-08 */}
        <div style={{
          background: '#fffbeb',
          border: '1.5px solid #fed7aa',
          borderRadius: 10,
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}>
          <div style={{ flexShrink: 0, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 15 15" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#c2410c' }}>Pending CMP-08</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#ea580c', marginTop: 2, lineHeight: 1.1 }}>
              {summary.pending ?? 0}
            </div>
          </div>
        </div>

        {/* Card 4: Filed CMP-08 */}
        <div style={{
          background: '#fef2f2',
          border: '1.5px solid #fecaca',
          borderRadius: 10,
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}>
          <div style={{ flexShrink: 0, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="8" y1="13" x2="16" y2="13" />
              <line x1="8" y1="17" x2="16" y2="17" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#b91c1c' }}>Filed CMP-08</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#dc2626', marginTop: 2, lineHeight: 1.1 }}>
              {summary.filed ?? 0}
            </div>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="cm-table-card" style={{
        background: '#fff',
        border: '1.5px solid #bfdbfe',
        borderRadius: 10,
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#eaf3fd', borderBottom: '1.5px solid #bfdbfe' }}>
              <th style={thStyle({ align: 'center', width: 46 })}>#</th>
              <th style={thStyle({ align: 'left', width: 110 })}>Client ID</th>
              <th style={thStyle({ align: 'left' })}>Client Name</th>
              <th style={thStyle({ align: 'left', width: 190 })}>GSTIN</th>
              <th style={thStyle({ align: 'left', width: 170 })}>Quarter</th>
              <th style={thStyle({ align: 'left', width: 120 })}>Due Date</th>
              <th style={thStyle({ align: 'center', width: 140 })}>Return Status</th>
              <th style={thStyle({ align: 'center', width: 110, isLast: true })}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                  Loading CMP-08 data...
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                  No composition clients found.
                </td>
              </tr>
            )}
            {!loading && rows.map((r, i) => {
              const idx = (page - 1) * perPage + i + 1;
              return (
                <tr
                  key={r.client_id ? `${r.client_id}-${r.period}-${i}` : i}
                  style={{ borderBottom: '1px solid #dbeafe' }}
                >
                  <td style={tdStyle({ align: 'center', color: '#1e293b', weight: 600 })}>{idx}</td>
                  <td style={tdStyle({ color: '#1e293b', weight: 500 })}>{r.client_code || `CL-${String(r.client_id).padStart(3, '0')}`}</td>
                  <td style={tdStyle({ color: '#1e293b', weight: 600 })}>
                    <Link
                      to={`/admin/cmp08/${r.client_id}/period/${encodeURIComponent(r.period)}`}
                      style={{ color: '#1e293b', textDecoration: 'none' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#1d4ed8'}
                      onMouseLeave={e => e.currentTarget.style.color = '#1e293b'}
                    >
                      {r.business_name}
                    </Link>
                  </td>
                  <td style={tdStyle({ color: '#1e293b' })}>{r.gstin}</td>
                  <td style={tdStyle({ color: '#1e293b' })}>{r.quarter}</td>
                  <td style={tdStyle({ color: '#1e293b' })}>{r.due_date}</td>
                  <td style={tdStyle({ align: 'center' })}>
                    <span style={{
                      display: 'inline-block',
                      minWidth: 84,
                      padding: '3px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      textAlign: 'center',
                      background: r.status === 'Filed' ? '#dcfce7' : r.status === 'Pending' ? '#fef3c7' : '#e0f2fe',
                      color: r.status === 'Filed' ? '#16a34a' : r.status === 'Pending' ? '#d97706' : '#0284c7',
                    }}>
                      {r.status}
                    </span>
                  </td>
                  <td style={tdStyle({ align: 'center', isLast: true })}>
                    <button
                      onClick={() => navigate(`/admin/cmp08/${r.client_id}/period/${encodeURIComponent(r.period)}`)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: '4.5px 14px',
                        background: '#fff',
                        border: '1.5px solid #93c5fd',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#1d4ed8',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = '#eff6ff';
                        e.currentTarget.style.borderColor = '#3b82f6';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = '#fff';
                        e.currentTarget.style.borderColor = '#93c5fd';
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      Open
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Pagination Strip */}
        <div style={{
          padding: '10px 16px',
          background: '#fff',
          borderTop: '1.5px solid #bfdbfe',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: 13, color: '#1d4ed8', fontWeight: 500 }}>
            {total > 0
              ? `Showing ${(page - 1) * perPage + 1} to ${Math.min(page * perPage, total)} of ${total} clients`
              : 'Showing 0 clients'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Prev Button */}
            <button
              disabled={page <= 1}
              onClick={() => load(page - 1)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                background: '#fff',
                border: '1.5px solid #bfdbfe',
                borderRadius: 6,
                color: '#1d4ed8',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
                opacity: page <= 1 ? 0.35 : 1,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            {/* Page Number Buttons */}
            {Array.from({ length: Math.max(1, totalPages) }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => load(p)}
                style={{
                  width: 32,
                  height: 32,
                  background: p === page ? '#1d4ed8' : '#fff',
                  border: `1.5px solid ${p === page ? '#1d4ed8' : '#bfdbfe'}`,
                  borderRadius: 6,
                  color: p === page ? '#fff' : '#1d4ed8',
                  fontSize: 13,
                  fontWeight: p === page ? 700 : 600,
                  cursor: 'pointer',
                }}
              >
                {p}
              </button>
            ))}

            {/* Next Button */}
            <button
              disabled={page >= totalPages || totalPages === 0}
              onClick={() => load(page + 1)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                background: '#fff',
                border: '1.5px solid #bfdbfe',
                borderRadius: 6,
                color: '#1d4ed8',
                cursor: (page >= totalPages || totalPages === 0) ? 'not-allowed' : 'pointer',
                opacity: (page >= totalPages || totalPages === 0) ? 0.35 : 1,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const selectStyle = {
  padding: '6px 24px 6px 10px',
  border: '1.5px solid #bfdbfe',
  borderRadius: 7,
  fontSize: 13,
  color: '#1e293b',
  outline: 'none',
  background: '#fff',
  cursor: 'pointer',
};

const thStyle = ({ align = 'left', width, isLast = false }) => ({
  padding: '10px 14px',
  textAlign: align,
  fontWeight: 700,
  fontSize: 12.5,
  color: '#1d4ed8',
  whiteSpace: 'nowrap',
  width: width || 'auto',
  borderRight: isLast ? 'none' : '1px solid #dbeafe',
});

const tdStyle = ({ align = 'left', color = '#1e293b', weight = 400, isLast = false }) => ({
  padding: '9.5px 14px',
  textAlign: align,
  color,
  fontWeight: weight,
  fontSize: 13,
  borderRight: isLast ? 'none' : '1px solid #eff6ff',
});
