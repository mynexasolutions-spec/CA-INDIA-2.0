import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';

export default function AdminReportsList() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');

  const perPage = 10;

  const load = (p = 1, q = applied) => {
    setLoading(true);
    const params = new URLSearchParams({
      page: p,
      per_page: perPage,
      ...(q ? { search: q, q } : {}),
    });
    api(`/admin/clients?${params}&directory=1`)
      .then(d => {
        setClients(Array.isArray(d) ? d : (d.data ?? d.clients ?? []));
        setTotal(d.total ?? d.meta?.total ?? (Array.isArray(d) ? d.length : 0));
        setPage(p);
      })
      .catch(err => {
        console.error('Failed to load clients for reports:', err);
        setClients([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(1, '');
  }, []);

  const doSearch = () => {
    setApplied(search);
    load(1, search);
  };

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div style={{ fontFamily: "'Inter',system-ui,sans-serif", padding: '4px 0 48px', color: '#1e293b' }}>

      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>
          Reports
        </h1>
      </div>

      {/* Main Client List Card */}
      <div style={{
        background: '#fff',
        border: '1.5px solid #bfdbfe',
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
      }}>
        {/* Card Toolbar */}
        <div style={{
          padding: '14px 18px',
          borderBottom: '1.5px solid #bfdbfe',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
        }}>
          <span style={{ fontWeight: 800, fontSize: 17, color: '#0f172a' }}>
            Client List
          </span>
          <div style={{ position: 'relative' }}>
            <svg
              width="14"
              height="14"
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
              placeholder="Search..."
              style={{
                padding: '7.5px 12px 7.5px 32px',
                border: '1.5px solid #bfdbfe',
                borderRadius: 7,
                fontSize: 13,
                width: 240,
                outline: 'none',
                color: '#1e293b',
                background: '#fff',
              }}
            />
          </div>
        </div>

        {/* Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#eaf3fd', borderBottom: '1.5px solid #bfdbfe' }}>
              <th style={thStyle({ align: 'center', width: 55 })}>Sr. No.</th>
              <th style={thStyle({ align: 'left', width: 220 })}>Client Name</th>
              <th style={thStyle({ align: 'left', width: 180 })}>GSTIN</th>
              <th style={thStyle({ align: 'left', width: 140 })}>PAN</th>
              <th style={thStyle({ align: 'left', width: 140 })}>Client Type</th>
              <th style={thStyle({ align: 'center', width: 110 })}>Status</th>
              <th style={thStyle({ align: 'center', width: 100, isLast: true })}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                  Loading client reports data...
                </td>
              </tr>
            )}
            {!loading && clients.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                  No clients found.
                </td>
              </tr>
            )}
            {!loading && clients.map((c, i) => {
              const idx = (page - 1) * perPage + i + 1;
              const isActive = c.is_active !== false && c.user?.is_active !== false && c.status !== 'inactive';
              return (
                <tr
                  key={c.id || i}
                  style={{ borderBottom: '1px solid #dbeafe', transition: 'background 0.15s ease' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={tdStyle({ align: 'center', color: '#1e293b', weight: 500 })}>{idx}</td>
                  <td style={tdStyle({ color: '#1e293b', weight: 600 })}>
                    <button
                      onClick={() => navigate(`/admin/reports/${c.id}`)}
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
                      {c.business_name ?? c.client_name}
                    </button>
                  </td>
                  <td style={tdStyle({ color: '#1e293b' })}>{c.gstin ?? '—'}</td>
                  <td style={tdStyle({ color: '#1e293b' })}>{c.pan ?? '—'}</td>
                  <td style={tdStyle({ color: '#1e293b' })}>
                    {c.dealer_type === 'composition' ? 'Composition' : 'Regular'}
                  </td>
                  <td style={tdStyle({ align: 'center' })}>
                    <span style={{
                      display: 'inline-block',
                      minWidth: 64,
                      padding: '2.5px 14px',
                      borderRadius: 14,
                      fontSize: 12,
                      fontWeight: 700,
                      textAlign: 'center',
                      background: isActive ? '#dcfce7' : '#fee2e2',
                      color: isActive ? '#16a34a' : '#dc2626',
                    }}>
                      {isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={tdStyle({ align: 'center', isLast: true })}>
                    <button
                      onClick={() => navigate(`/admin/reports/${c.id}`)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4.5px 16px',
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
                      View
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
          <span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>
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

            {/* Page Buttons */}
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

const thStyle = ({ align = 'left', width, isLast = false }) => ({
  padding: '11px 16px',
  textAlign: align,
  fontWeight: 700,
  fontSize: 12.5,
  color: '#0f172a',
  whiteSpace: 'nowrap',
  width: width || 'auto',
  borderRight: isLast ? 'none' : '1px solid #dbeafe',
});

const tdStyle = ({ align = 'left', color = '#1e293b', weight = 400, isLast = false }) => ({
  padding: '10.5px 16px',
  textAlign: align,
  color,
  fontWeight: weight,
  fontSize: 13,
  borderRight: isLast ? 'none' : '1px solid #f1f5f9',
});
