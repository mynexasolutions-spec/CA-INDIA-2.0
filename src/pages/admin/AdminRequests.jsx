import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/client';

const STATUS_OPTS = ['All Status', 'Pending', 'Completed', 'Rejected'];

export default function AdminRequests() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ total: 0, pending: 0, completed: 0, rejected: 0 });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All Status');
  const [applied, setApplied] = useState({ search: '', status: 'All Status' });

  const load = (p = 1, f = applied) => {
    setLoading(true);
    const params = new URLSearchParams({
      page: p,
      search: f.search,
      status: f.status === 'All Status' ? 'All' : f.status,
    });
    api(`/admin/requests/clients?${params}`)
      .then(d => {
        setRows(Array.isArray(d.rows) ? d.rows : []);
        setSummary(d.summary || { total: 0, pending: 0, completed: 0, rejected: 0 });
        setTotal(d.total || 0);
        setPage(p);
      })
      .catch(err => {
        console.error('Failed to load client requests:', err);
        setRows([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(1, applied);
  }, []);

  const doSearch = () => {
    const f = { search, status };
    setApplied(f);
    load(1, f);
  };

  const perPage = 10;
  const totalPages = Math.ceil(total / perPage);

  return (
    <div style={{ fontFamily: "'Inter',system-ui,sans-serif", padding: '4px 0 48px', color: '#1e293b' }}>

      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>
          Request
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b', fontWeight: 400 }}>
          View client-wise requests for profile update, document change, bank details, invoice settings and other amendments.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="rq-stats crq-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        {/* Total Requests */}
        <div className="rq-card" style={cardStyle}>
          <div className="rq-ic" style={{ ...iconCircle, background: '#eff6ff', color: '#1d4ed8' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <line x1="10" y1="9" x2="8" y2="9" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
              {summary.total ?? 0}
            </div>
            <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4, fontWeight: 500 }}>
              Total Requests
            </div>
          </div>
        </div>

        {/* Pending */}
        <div className="rq-card" style={cardStyle}>
          <div className="rq-ic" style={{ ...iconCircle, background: '#fff7ed', color: '#ea580c' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
              {summary.pending ?? 0}
            </div>
            <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4, fontWeight: 500 }}>
              Pending
            </div>
          </div>
        </div>

        {/* Completed */}
        <div className="rq-card" style={cardStyle}>
          <div className="rq-ic" style={{ ...iconCircle, background: '#f0fdf4', color: '#16a34a' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
              {summary.completed ?? 0}
            </div>
            <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4, fontWeight: 500 }}>
              Completed
            </div>
          </div>
        </div>

        {/* Rejected */}
        <div className="rq-card" style={cardStyle}>
          <div className="rq-ic" style={{ ...iconCircle, background: '#fef2f2', color: '#dc2626' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
              {summary.rejected ?? 0}
            </div>
            <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4, fontWeight: 500 }}>
              Rejected
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div style={{
        background: '#fff',
        border: '1.5px solid #bfdbfe',
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
      }}>
        {/* Table Toolbar */}
        <div style={{
          padding: '14px 18px',
          borderBottom: '1.5px solid #bfdbfe',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <span style={{ fontWeight: 800, fontSize: 17, color: '#0f172a' }}>
            Client List
          </span>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Search Input */}
            <div style={{ position: 'relative' }}>
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#64748b"
                strokeWidth="2"
                style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }}
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doSearch()}
                placeholder="Search by client name, GSTIN, PAN or code..."
                style={{
                  padding: '8px 12px 8px 34px',
                  border: '1.5px solid #bfdbfe',
                  borderRadius: 7,
                  fontSize: 13,
                  width: 300,
                  outline: 'none',
                  color: '#1e293b',
                  background: '#fff',
                }}
              />
            </div>

            {/* Status Select */}
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              style={{
                padding: '8px 24px 8px 12px',
                border: '1.5px solid #bfdbfe',
                borderRadius: 7,
                fontSize: 13,
                outline: 'none',
                background: '#fff',
                color: '#1e293b',
                cursor: 'pointer',
              }}
            >
              {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            {/* Filter Button */}
            <button
              onClick={doSearch}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 20px',
                background: '#1d4ed8',
                border: 'none',
                borderRadius: 7,
                fontSize: 13,
                fontWeight: 600,
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              Filter
            </button>
          </div>
        </div>

        {/* Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#eaf3fd', borderBottom: '1.5px solid #bfdbfe' }}>
              <th style={thStyle({ align: 'center', width: 55 })}>Sr. No.</th>
              <th style={thStyle({ align: 'left', width: 95 })}>Client Code</th>
              <th style={thStyle({ align: 'left' })}>Client Name</th>
              <th style={thStyle({ align: 'left', width: 170 })}>GSTIN</th>
              <th style={thStyle({ align: 'left', width: 125 })}>Mobile No.</th>
              <th style={thStyle({ align: 'center', width: 110 })}>Total Requests</th>
              <th style={thStyle({ align: 'center', width: 85 })}>Pending</th>
              <th style={thStyle({ align: 'center', width: 95 })}>Completed</th>
              <th style={thStyle({ align: 'center', width: 85 })}>Rejected</th>
              <th style={thStyle({ align: 'center', width: 135, isLast: true })}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={10} style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                  Loading client requests...
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={10} style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                  No clients found.
                </td>
              </tr>
            )}
            {!loading && rows.map((r, i) => {
              const idx = (page - 1) * perPage + i + 1;
              return (
                <tr
                  key={r.id || i}
                  style={{ borderBottom: '1px solid #dbeafe', transition: 'background 0.15s ease' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={tdStyle({ align: 'center', color: '#1e293b', weight: 500 })}>{idx}</td>
                  <td style={tdStyle({ color: '#1e293b', weight: 500 })}>{r.client_code}</td>
                  <td style={tdStyle({ color: '#1e293b', weight: 600 })}>
                    <button
                      onClick={() => navigate(`/admin/requests/${r.id}`)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#1e293b',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontSize: 13,
                        padding: 0,
                        textAlign: 'left',
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = '#1d4ed8'}
                      onMouseLeave={e => e.currentTarget.style.color = '#1e293b'}
                    >
                      {r.business_name}
                    </button>
                  </td>
                  <td style={tdStyle({ color: '#1e293b' })}>{r.gstin}</td>
                  <td style={tdStyle({ color: '#1e293b' })}>{r.mobile}</td>
                  <td style={tdStyle({ align: 'center', color: '#1e293b', weight: 600 })}>
                    {r.total_requests}
                  </td>
                  <td style={tdStyle({ align: 'center' })}>
                    <span style={{
                      display: 'inline-block',
                      minWidth: 26,
                      padding: '2px 10px',
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 700,
                      textAlign: 'center',
                      background: r.pending === 1 ? '#e0f2fe' : '#fef3c7',
                      color: r.pending === 1 ? '#0284c7' : '#d97706',
                    }}>
                      {r.pending}
                    </span>
                  </td>
                  <td style={tdStyle({ align: 'center' })}>
                    <span style={{
                      display: 'inline-block',
                      minWidth: 26,
                      padding: '2px 10px',
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 700,
                      textAlign: 'center',
                      background: '#dcfce7',
                      color: '#16a34a',
                    }}>
                      {r.completed}
                    </span>
                  </td>
                  <td style={tdStyle({ align: 'center' })}>
                    <span style={{
                      display: 'inline-block',
                      minWidth: 26,
                      padding: '2px 10px',
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 700,
                      textAlign: 'center',
                      background: '#fee2e2',
                      color: '#dc2626',
                    }}>
                      {r.rejected}
                    </span>
                  </td>
                  <td style={tdStyle({ align: 'center', isLast: true })}>
                    <button
                      onClick={() => navigate(`/admin/requests/${r.id}`)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '5px 14px',
                        background: '#fff',
                        border: '1.5px solid #93c5fd',
                        borderRadius: 6,
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: '#1d4ed8',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
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
                      View Requests
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Pagination Strip */}
        <div style={{
          padding: '12px 18px',
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

const cardStyle = {
  background: '#fff',
  border: '1.5px solid #bfdbfe',
  borderRadius: 12,
  padding: '16px 20px',
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
};

const iconCircle = {
  width: 46,
  height: 46,
  borderRadius: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const thStyle = ({ align = 'left', width, isLast = false }) => ({
  padding: '11px 14px',
  textAlign: align,
  fontWeight: 700,
  fontSize: 12.5,
  color: '#1d4ed8',
  whiteSpace: 'nowrap',
  width: width || 'auto',
  borderRight: isLast ? 'none' : '1px solid #dbeafe',
});

const tdStyle = ({ align = 'left', color = '#1e293b', weight = 400, isLast = false }) => ({
  padding: '11px 14px',
  textAlign: align,
  color,
  fontWeight: weight,
  fontSize: 13,
  borderRight: isLast ? 'none' : '1px solid #eff6ff',
});
