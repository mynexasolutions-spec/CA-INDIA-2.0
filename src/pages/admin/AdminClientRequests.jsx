import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, getAuthToken } from '../../api/client';

const TYPE_TABS = [
  { key: 'all', label: 'All Requests', color: '#1d4ed8', bg: '#eff6ff', icon: 'doc' },
  { key: 'profile_update', label: 'Profile Update', color: '#7c3aed', bg: '#f5f3ff', icon: 'user' },
  { key: 'document_change', label: 'Document Change', color: '#16a34a', bg: '#f0fdf4', icon: 'doc-green' },
  { key: 'bank_details', label: 'Bank Details', color: '#d97706', bg: '#fffbeb', icon: 'bank' },
  { key: 'invoice_setting', label: 'Invoice Setting', color: '#0284c7', bg: '#e0f2fe', icon: 'gear' },
  { key: 'invoice_amendment', label: 'Invoice Amendment', color: '#dc2626', bg: '#fef2f2', icon: 'doc-red' },
  { key: 'other', label: 'Other Requests', color: '#0d9488', bg: '#f0fdfa', icon: 'dots' },
];

export default function AdminClientRequests() {
  const { clientId } = useParams();

  const [data, setData] = useState(null);
  const [requests, setRequests] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState('all');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All Status');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [applied, setApplied] = useState({ search: '', status: 'All Status', from_date: '', to_date: '' });

  useEffect(() => { setActionErr(''); }, [viewReq, rejectMode]);

  // View Modal
  const [viewReq, setViewReq] = useState(null);
  const [popupTab, setPopupTab] = useState('Details');
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionErr, setActionErr] = useState('');
  const [saving, setSaving] = useState(false);

  const load = (p = 1, type = activeType, f = applied) => {
    setLoading(true);
    const params = new URLSearchParams({
      page: p,
      type,
      status: f.status === 'All Status' ? 'All' : f.status,
      search: f.search,
      from_date: f.from_date,
      to_date: f.to_date,
    });
    api(`/admin/requests/clients/${clientId}?${params}`)
      .then(d => {
        setData(d);
        setRequests(Array.isArray(d.requests) ? d.requests : []);
        setTotal(d.total || 0);
        setPage(p);
      })
      .catch(err => {
        console.error('Failed to load client requests:', err);
        setRequests([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(1, 'all', applied);
  }, [clientId]);

  const switchType = t => {
    setActiveType(t);
    load(1, t, applied);
  };

  const doSearch = () => {
    const f = { search, status, from_date: fromDate, to_date: toDate };
    setApplied(f);
    load(1, activeType, f);
  };

  const doReset = () => {
    const f = { search: '', status: 'All Status', from_date: '', to_date: '' };
    setSearch('');
    setStatus('All Status');
    setFromDate('');
    setToDate('');
    setApplied(f);
    load(1, activeType, f);
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      await api(`/admin/requests/${viewReq.id}/complete`, { method: 'POST', body: {} });
      setViewReq(null);
      load(page, activeType, applied);
    } catch (e) {
      setActionErr(e.message || 'Could not complete the request.');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      setActionErr('Please enter a reason for rejection.');
      return;
    }
    setActionErr('');
    setSaving(true);
    try {
      await api(`/admin/requests/${viewReq.id}/reject`, { method: 'POST', body: { reason: rejectReason } });
      setViewReq(null);
      setRejectMode(false);
      setRejectReason('');
      load(page, activeType, applied);
    } catch (e) {
      setActionErr(e.message || 'Could not reject the request.');
    } finally {
      setSaving(false);
    }
  };

  // Attachments are stored privately, so they are fetched with the admin's token and saved from a blob.
  const downloadAttachment = async (att) => {
    setActionErr('');
    try {
      const res = await fetch(att.url, { headers: { Authorization: `Bearer ${getAuthToken()}` } });
      if (!res.ok) throw new Error('Could not download the attachment.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = att.name || 'attachment';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setActionErr(e.message || 'Could not download the attachment.');
    }
  };

  const perPage = 10;
  const totalPages = Math.ceil(total / perPage);
  const client = data?.client;
  const summary = data?.summary ?? { total: 0, pending: 0, completed: 0, rejected: 0 };
  const typeCounts = data?.type_counts ?? {};

  return (
    <div style={{ fontFamily: "'Inter',system-ui,sans-serif", padding: '4px 0 48px', color: '#1e293b' }}>

      {/* Top Breadcrumbs */}
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
        <Link to="/admin/requests" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>Request</Link>
        <span>&gt;</span>
        <Link to="/admin/requests" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>Client List</Link>
        <span>&gt;</span>
        <span style={{ color: '#2563eb', fontWeight: 500 }}>{client?.business_name || 'Client'}</span>
        <span>&gt;</span>
        <span style={{ color: '#2563eb', fontWeight: 500 }}>View Requests</span>
      </div>

      {/* Client Header Card */}
      {client && (
        <div style={{
          background: '#fff',
          border: '1.5px solid #bfdbfe',
          borderRadius: 12,
          padding: '16px 20px',
          marginBottom: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 50,
              height: 50,
              borderRadius: 10,
              background: '#eff6ff',
              border: '1.5px solid #bfdbfe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="2" width="16" height="20" rx="2" />
                <path d="M9 22v-4h6v4" />
                <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 18, color: '#0f172a', marginBottom: 4 }}>
                {client.business_name}
              </div>
              <div style={{ fontSize: 12.5, color: '#64748b', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <span>Client Code : <b style={{ color: '#334155' }}>{client.client_code}</b></span>
                <span style={{ color: '#cbd5e1' }}>|</span>
                <span>GSTIN : <b style={{ color: '#334155' }}>{client.gstin || '—'}</b></span>
                <span style={{ color: '#cbd5e1' }}>|</span>
                <span>PAN : <b style={{ color: '#334155' }}>{client.pan || '—'}</b></span>
                <span style={{ color: '#cbd5e1' }}>|</span>
                <span>Mobile : <b style={{ color: '#334155' }}>{client.mobile || '—'}</b></span>
                <span style={{ color: '#cbd5e1' }}>|</span>
                <span>Email : <b style={{ color: '#334155' }}>{client.email || '—'}</b></span>
              </div>
            </div>
          </div>

          <div style={{
            padding: '5px 16px',
            background: client.is_active ? '#dcfce7' : '#fee2e2',
            borderRadius: 20,
            color: client.is_active ? '#15803d' : '#b91c1c',
            fontWeight: 700,
            fontSize: 13,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: client.is_active ? '#16a34a' : '#dc2626', display: 'inline-block' }}></span>
            {client.is_active ? 'Active' : 'Inactive'}
          </div>
        </div>
      )}

      {/* Section Title */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>
          Client Requests
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
          View and manage all requests raised by {client?.business_name || 'the client'}. Client can raise requests for profile update, document change, bank details, Invoice settings, invoice amendment and other requests.
        </p>
      </div>

      {/* 4 Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 18 }}>
        <div style={statCard}>
          <div style={{ ...iconBox, background: '#eff6ff', color: '#1d4ed8' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{summary.total ?? 0}</div>
            <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 3 }}>Total Requests</div>
          </div>
        </div>

        <div style={statCard}>
          <div style={{ ...iconBox, background: '#fff7ed', color: '#ea580c' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{summary.pending ?? 0}</div>
            <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 3 }}>Pending</div>
          </div>
        </div>

        <div style={statCard}>
          <div style={{ ...iconBox, background: '#f0fdf4', color: '#16a34a' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{summary.completed ?? 0}</div>
            <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 3 }}>Completed</div>
          </div>
        </div>

        <div style={statCard}>
          <div style={{ ...iconBox, background: '#fef2f2', color: '#dc2626' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{summary.rejected ?? 0}</div>
            <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 3 }}>Rejected</div>
          </div>
        </div>
      </div>

      {/* Horizontal Category Tabs with Count Pills */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 10,
        marginBottom: 16,
      }}>
        {TYPE_TABS.map(t => {
          const cnt = typeCounts[t.key] ?? 0;
          const active = activeType === t.key;
          return (
            <button
              key={t.key}
              onClick={() => switchType(t.key)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '10px 8px 8px',
                background: '#fff',
                border: `1.5px solid ${active ? '#1d4ed8' : '#e2e8f0'}`,
                borderRadius: 9,
                cursor: 'pointer',
                boxShadow: active ? '0 1px 4px rgba(29, 78, 216, 0.15)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  {renderTypeIcon(t.icon, t.color)}
                </span>
                <span style={{
                  fontSize: 12,
                  fontWeight: active ? 700 : 600,
                  color: active ? '#1d4ed8' : '#334155',
                  whiteSpace: 'nowrap',
                }}>
                  {t.label}
                </span>
              </div>
              <span style={{
                display: 'inline-block',
                padding: '1px 10px',
                borderRadius: 12,
                fontSize: 11.5,
                fontWeight: 700,
                background: t.bg,
                color: t.color,
              }}>
                {cnt}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter Row */}
      <div style={{
        background: '#fff',
        border: '1.5px solid #bfdbfe',
        borderRadius: 10,
        padding: '10px 14px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 220 }}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#64748b"
            strokeWidth="2"
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            placeholder="Search by subject or request ID..."
            style={{
              width: '100%',
              padding: '7.5px 10px 7.5px 32px',
              border: '1.5px solid #bfdbfe',
              borderRadius: 7,
              fontSize: 12.5,
              outline: 'none',
              boxSizing: 'border-box',
              color: '#1e293b',
              background: '#fff',
            }}
          />
        </div>

        {/* Date Range Picker */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          border: '1.5px solid #bfdbfe',
          borderRadius: 7,
          padding: '2px 8px',
          background: '#fff',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            style={{ border: 'none', outline: 'none', fontSize: 12.5, color: '#334155', background: 'transparent' }}
          />
          <span style={{ color: '#94a3b8' }}>–</span>
          <input
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            style={{ border: 'none', outline: 'none', fontSize: 12.5, color: '#334155', background: 'transparent' }}
          />
        </div>

        {/* Status Dropdown */}
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          style={{
            padding: '7.5px 24px 7.5px 10px',
            border: '1.5px solid #bfdbfe',
            borderRadius: 7,
            fontSize: 12.5,
            outline: 'none',
            background: '#fff',
            color: '#1e293b',
            cursor: 'pointer',
          }}
        >
          {['All Status', 'Pending', 'Completed', 'Rejected'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Reset */}
        <button
          onClick={doReset}
          style={{
            padding: '7.5px 18px',
            background: '#fff',
            border: '1.5px solid #bfdbfe',
            borderRadius: 7,
            fontSize: 12.5,
            fontWeight: 600,
            color: '#374151',
            cursor: 'pointer',
          }}
        >
          Reset
        </button>

        {/* Search */}
        <button
          onClick={doSearch}
          style={{
            padding: '7.5px 22px',
            background: '#1d4ed8',
            border: 'none',
            borderRadius: 7,
            fontSize: 12.5,
            fontWeight: 600,
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Search
        </button>
      </div>

      {/* Table Card */}
      <div style={{
        background: '#fff',
        border: '1.5px solid #bfdbfe',
        borderRadius: 10,
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#eaf3fd', borderBottom: '1.5px solid #bfdbfe' }}>
              <th style={thStyle({ align: 'center', width: 55 })}>Sr. No.</th>
              <th style={thStyle({ align: 'left', width: 130 })}>Request ID</th>
              <th style={thStyle({ align: 'left', width: 170 })}>Request Type</th>
              <th style={thStyle({ align: 'left' })}>Subject</th>
              <th style={thStyle({ align: 'left', width: 140 })}>Submitted On</th>
              <th style={thStyle({ align: 'center', width: 130 })}>Status</th>
              <th style={thStyle({ align: 'center', width: 100, isLast: true })}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                  Loading requests from database...
                </td>
              </tr>
            )}
            {!loading && requests.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                  No requests found for this client.
                </td>
              </tr>
            )}
            {!loading && requests.map((r, i) => {
              const idx = (page - 1) * perPage + i + 1;
              const typeCfg = TYPE_TABS.find(t => t.key === r.request_type) || {
                color: '#0d9488',
                bg: '#f0fdfa',
                icon: 'dots',
                label: r.type_label || 'Request',
              };

              // Split submitted_on date & time if available
              const dateParts = (r.submitted_on || '').split(',');
              const dateLine = dateParts[0]?.trim() || r.submitted_on;
              const timeLine = dateParts[1]?.trim();

              return (
                <tr
                  key={r.id || i}
                  style={{ borderBottom: '1px solid #dbeafe', transition: 'background 0.15s ease' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={tdStyle({ align: 'center', color: '#1e293b', weight: 500 })}>{idx}</td>
                  <td style={tdStyle({ color: '#1e293b', weight: 500 })}>{r.request_id}</td>
                  <td style={tdStyle()}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '3px 12px',
                      borderRadius: 14,
                      fontSize: 12,
                      fontWeight: 600,
                      background: typeCfg.bg,
                      color: typeCfg.color,
                    }}>
                      {renderTypeIcon(typeCfg.icon, typeCfg.color, 13)}
                      {r.type_label || typeCfg.label}
                    </span>
                  </td>
                  <td style={tdStyle({ color: '#1e293b', weight: 500 })}>{r.subject}</td>
                  <td style={tdStyle({ color: '#1e293b' })}>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: '#1e293b' }}>{dateLine}</div>
                    {timeLine && <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{timeLine}</div>}
                  </td>
                  <td style={tdStyle({ align: 'center' })}>
                    {renderStatusBadge(r.status)}
                  </td>
                  <td style={tdStyle({ align: 'center', isLast: true })}>
                    <button
                      onClick={() => {
                        setViewReq(r);
                        setPopupTab('Details');
                        setRejectMode(false);
                        setRejectReason('');
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
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
          padding: '10px 16px',
          background: '#fff',
          borderTop: '1.5px solid #bfdbfe',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: 13, color: '#1d4ed8', fontWeight: 500 }}>
            {total > 0
              ? `Showing ${(page - 1) * perPage + 1} to ${Math.min(page * perPage, total)} of ${total} requests`
              : 'Showing 0 requests'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Prev */}
            <button
              disabled={page <= 1}
              onClick={() => load(page - 1)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 30,
                height: 30,
                background: '#fff',
                border: '1.5px solid #bfdbfe',
                borderRadius: 6,
                color: '#1d4ed8',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
                opacity: page <= 1 ? 0.35 : 1,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
            </button>

            {/* Pages */}
            {Array.from({ length: Math.max(1, totalPages) }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => load(p)}
                style={{
                  width: 30,
                  height: 30,
                  background: p === page ? '#1d4ed8' : '#fff',
                  border: `1.5px solid ${p === page ? '#1d4ed8' : '#bfdbfe'}`,
                  borderRadius: 6,
                  color: p === page ? '#fff' : '#1d4ed8',
                  fontSize: 12.5,
                  fontWeight: p === page ? 700 : 600,
                  cursor: 'pointer',
                }}
              >
                {p}
              </button>
            ))}

            {/* Next */}
            <button
              disabled={page >= totalPages || totalPages === 0}
              onClick={() => load(page + 1)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 30,
                height: 30,
                background: '#fff',
                border: '1.5px solid #bfdbfe',
                borderRadius: 6,
                color: '#1d4ed8',
                cursor: (page >= totalPages || totalPages === 0) ? 'not-allowed' : 'pointer',
                opacity: (page >= totalPages || totalPages === 0) ? 0.35 : 1,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* View Request Popup Modal */}
      {viewReq && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.45)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          backdropFilter: 'blur(2px)',
        }}>
          <div style={{
            background: '#fff',
            borderRadius: 14,
            width: '100%',
            maxWidth: 780,
            maxHeight: '92vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 24px 64px rgba(0,0,0,.2)',
          }}>
            {/* Header */}
            <div style={{
              padding: '16px 24px 14px',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 18, color: '#0f172a', marginBottom: 8 }}>
                  Request Details
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  {(() => {
                    const typeCfg = TYPE_TABS.find(t => t.key === viewReq.request_type) || {
                      color: '#7c3aed',
                      bg: '#f5f3ff',
                      icon: 'user',
                      label: viewReq.type_label || 'Request',
                    };
                    return (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '3px 14px',
                        borderRadius: 16,
                        fontSize: 12,
                        fontWeight: 700,
                        background: typeCfg.bg,
                        color: typeCfg.color,
                      }}>
                        {renderTypeIcon(typeCfg.icon, typeCfg.color, 13)}
                        {viewReq.type_label || typeCfg.label}
                      </span>
                    );
                  })()}
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a', lineHeight: 1.2 }}>
                      {viewReq.request_id}
                    </div>
                    <div style={{ fontSize: 12.5, color: '#475569', marginTop: 2 }}>
                      {viewReq.subject}
                    </div>
                  </div>
                </div>
              </div>
              <button
                onClick={() => { setViewReq(null); setRejectMode(false); setRejectReason(''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 24, lineHeight: 1, padding: 0 }}
              >
                ✕
              </button>
            </div>

            {/* Modal Tab Navigation */}
            <div style={{ display: 'flex', borderBottom: '1.5px solid #e2e8f0', padding: '0 24px', flexShrink: 0 }}>
              {['Details', 'Client Information', 'Attachments', 'Remarks'].map(t => (
                <button
                  key={t}
                  onClick={() => setPopupTab(t)}
                  style={{
                    padding: '11px 18px',
                    border: 'none',
                    background: 'transparent',
                    borderBottom: popupTab === t ? '2.5px solid #1d4ed8' : '2.5px solid transparent',
                    color: popupTab === t ? '#1d4ed8' : '#64748b',
                    fontWeight: popupTab === t ? 700 : 500,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, fontSize: 13 }}>
              {popupTab === 'Details' && (
                <div>
                  {/* Card 1: Request Information */}
                  <div style={modalCard}>
                    <div style={modalCardHeader}>Request Information</div>
                    <div style={{ padding: '4px 0' }}>
                      {[
                        ['Request ID', viewReq.request_id],
                        ['Request Type', (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '2px 12px',
                            borderRadius: 14,
                            fontSize: 11.5,
                            fontWeight: 700,
                            background: '#f5f3ff',
                            color: '#7c3aed',
                          }}>
                            {renderTypeIcon('user', '#7c3aed', 12)}
                            {viewReq.type_label}
                          </span>
                        )],
                        ['Subject', viewReq.subject],
                        ['Description', viewReq.description || '—'],
                        ['Submitted On', viewReq.submitted_on],
                        ['Requested By', viewReq.requested_by || `${client?.business_name || 'Client'} (Client)`],
                      ].map(([k, v], idx, arr) => (
                        <div
                          key={k}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '130px 15px 1fr',
                            padding: '8px 16px',
                            borderBottom: idx === arr.length - 1 ? 'none' : '1px solid #f1f5f9',
                            alignItems: 'center',
                          }}
                        >
                          <span style={{ color: '#475569', fontSize: 12.5, fontWeight: 500 }}>{k}</span>
                          <span style={{ color: '#64748b' }}>:</span>
                          <span style={{ color: '#0f172a', fontWeight: k === 'Subject' || k === 'Request ID' ? 600 : 400 }}>
                            {v}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Card 2: Requested Update Details */}
                  {(() => {
                    const detailsList = normalizeUpdateDetails(viewReq.update_details);
                    return (
                      <div style={modalCard}>
                        <div style={modalCardHeader}>Requested Update Details</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                          <thead>
                            <tr style={{ background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
                              <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 700, color: '#334155' }}>Field Name</th>
                              <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 700, color: '#334155' }}>Existing Value</th>
                              <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 700, color: '#334155' }}>Requested Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detailsList.length === 0 ? (
                              <tr>
                                <td colSpan={3} style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>
                                  No specific field changes recorded.
                                </td>
                              </tr>
                            ) : (
                              detailsList.map((item, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '8px 16px', color: '#0f172a', fontWeight: 500 }}>{item.field_name}</td>
                                  <td style={{ padding: '8px 16px', color: '#475569' }}>{item.existing_value}</td>
                                  <td style={{ padding: '8px 16px', color: '#0f172a', fontWeight: 500 }}>{item.requested_value}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}

                  {/* Card 3: Attachments */}
                  {(() => {
                    const attList = normalizeAttachments(viewReq.attachments);
                    return (
                      <div style={modalCard}>
                        <div style={modalCardHeader}>
                          Attachments ({attList.length})
                        </div>
                        <div style={{ padding: '12px 16px' }}>
                          {attList.length === 0 ? (
                            <div style={{ color: '#94a3b8', fontSize: 12.5, textAlign: 'center', padding: '12px 0' }}>
                              No attachments uploaded for this request.
                            </div>
                          ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                              {attList.map((att, idx) => (
                                <div
                                  key={idx}
                                  style={{
                                    border: '1px solid #e2e8f0',
                                    borderRadius: 8,
                                    padding: '10px 14px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    background: '#fff',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                    <div style={{
                                      width: 34,
                                      height: 34,
                                      borderRadius: 6,
                                      background: att.isPdf ? '#fef2f2' : '#f0fdf4',
                                      border: `1px solid ${att.isPdf ? '#fecaca' : '#bbf7d0'}`,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      flexShrink: 0,
                                      color: att.isPdf ? '#dc2626' : '#16a34a',
                                      fontWeight: 800,
                                      fontSize: 10,
                                    }}>
                                      {att.isPdf ? 'PDF' : 'IMG'}
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                      <div style={{
                                        fontSize: 12.5,
                                        fontWeight: 600,
                                        color: '#0f172a',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                      }}>
                                        {att.name}
                                      </div>
                                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                                        {att.size}
                                      </div>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => downloadAttachment(att)}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      width: 28,
                                      height: 28,
                                      color: '#1d4ed8',
                                      textDecoration: 'none',
                                      border: 'none',
                                      background: 'none',
                                      cursor: 'pointer',
                                      padding: 0,
                                      flexShrink: 0,
                                    }}
                                    title="Download Attachment"
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                      <polyline points="7 10 12 15 17 10" />
                                      <line x1="12" y1="15" x2="12" y2="3" />
                                    </svg>
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Card 4: Remarks / Message from Client */}
                  <div style={modalCard}>
                    <div style={modalCardHeader}>Remarks / Message from Client</div>
                    <div style={{ padding: '12px 16px', color: '#334155', fontSize: 13, lineHeight: 1.5 }}>
                      {viewReq.client_remarks || viewReq.description || 'No additional remarks from client.'}
                    </div>
                  </div>
                </div>
              )}

              {popupTab === 'Client Information' && (
                <div style={modalCard}>
                  <div style={modalCardHeader}>Client Profile Details</div>
                  <div style={{ padding: '8px 0' }}>
                    {[
                      ['Business Name', client?.business_name],
                      ['Client Code', client?.client_code],
                      ['GSTIN', client?.gstin || '—'],
                      ['PAN', client?.pan || '—'],
                      ['Mobile No.', client?.mobile || '—'],
                      ['Email Address', client?.email || '—'],
                      ['Status', client?.is_active ? 'Active' : 'Inactive'],
                    ].map(([k, v]) => (
                      <div key={k} style={{ display: 'grid', gridTemplateColumns: '140px 15px 1fr', padding: '8px 16px', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ color: '#475569', fontWeight: 500 }}>{k}</span>
                        <span style={{ color: '#64748b' }}>:</span>
                        <span style={{ color: '#0f172a', fontWeight: 600 }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {popupTab === 'Attachments' && (
                <div style={modalCard}>
                  <div style={modalCardHeader}>Uploaded Attachments</div>
                  <div style={{ padding: '14px 16px' }}>
                    {normalizeAttachments(viewReq.attachments).length === 0 ? (
                      <div style={{ textAlign: 'center', color: '#94a3b8', padding: '20px 0' }}>No attachments found.</div>
                    ) : (
                      normalizeAttachments(viewReq.attachments).map((att, idx) => (
                        <div key={idx} style={{ padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>📄 {att.name} ({att.size})</span>
                          <button type="button" onClick={() => downloadAttachment(att)} style={{ color: '#1d4ed8', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>Download</button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {popupTab === 'Remarks' && (
                <div style={modalCard}>
                  <div style={modalCardHeader}>Remarks &amp; Audit Log</div>
                  <div style={{ padding: '14px 16px' }}>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>Client Remarks:</div>
                      <div style={{ color: '#334155' }}>{viewReq.client_remarks || '—'}</div>
                    </div>
                    {viewReq.rejection_reason && (
                      <div style={{ marginTop: 12, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', marginBottom: 2 }}>Rejection Reason:</div>
                        <div style={{ color: '#b91c1c' }}>{viewReq.rejection_reason}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {actionErr && (
                <div style={{ margin: '0 24px 12px', padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7, color: '#b91c1c', fontSize: 12.5 }}>
                  {actionErr}
                </div>
              )}

              {/* Reject Mode Box */}
              {rejectMode && (
                <div style={{ marginTop: 16, padding: '14px 16px', background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 10 }}>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: '#dc2626', display: 'block', marginBottom: 6 }}>
                    Reason for Rejection <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder="Provide reason for rejecting this request..."
                    style={{
                      width: '100%',
                      minHeight: 64,
                      padding: '8px 12px',
                      border: '1.5px solid #fecaca',
                      borderRadius: 7,
                      fontSize: 13,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
                    <button
                      onClick={() => setRejectMode(false)}
                      style={{ padding: '6px 14px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12.5, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleReject}
                      disabled={saving}
                      style={{ padding: '6px 18px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
                    >
                      {saving ? 'Rejecting...' : 'Confirm Rejection'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div style={{
              padding: '12px 24px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: 10,
              background: '#fff',
            }}>
              <button
                onClick={() => { setViewReq(null); setRejectMode(false); setRejectReason(''); }}
                style={{
                  padding: '8px 22px',
                  background: '#fff',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: 7,
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#334155',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>

              {viewReq.status === 'pending' && !rejectMode && (
                <>
                  <button
                    onClick={() => setRejectMode(true)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 22px',
                      background: '#dc2626',
                      border: 'none',
                      borderRadius: 7,
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    ✕ Reject
                  </button>
                  <button
                    onClick={handleComplete}
                    disabled={saving}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 22px',
                      background: '#16a34a',
                      border: 'none',
                      borderRadius: 7,
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    ✓ Completed
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function renderStatusBadge(status) {
  const s = (status || '').toLowerCase();
  if (s === 'completed') {
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 12px',
        borderRadius: 14,
        fontSize: 12,
        fontWeight: 700,
        background: '#dcfce7',
        color: '#16a34a',
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
        Completed
      </span>
    );
  }
  if (s === 'rejected') {
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 12px',
        borderRadius: 14,
        fontSize: 12,
        fontWeight: 700,
        background: '#fee2e2',
        color: '#dc2626',
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
        Rejected
      </span>
    );
  }
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '3px 12px',
      borderRadius: 14,
      fontSize: 12,
      fontWeight: 700,
      background: '#fef3c7',
      color: '#d97706',
    }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
      Pending
    </span>
  );
}

function renderTypeIcon(type, color = '#1d4ed8', size = 15) {
  switch (type) {
    case 'user':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case 'doc-green':
    case 'doc-red':
    case 'doc':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      );
    case 'bank':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2">
          <line x1="3" y1="21" x2="21" y2="21" />
          <line x1="6" y1="18" x2="6" y2="10" />
          <line x1="10" y1="18" x2="10" y2="10" />
          <line x1="14" y1="18" x2="14" y2="10" />
          <line x1="18" y1="18" x2="18" y2="10" />
          <polygon points="12 3 2 9 22 9" />
        </svg>
      );
    case 'gear':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
    case 'dots':
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5">
          <circle cx="5" cy="12" r="1.5" fill={color} />
          <circle cx="12" cy="12" r="1.5" fill={color} />
          <circle cx="19" cy="12" r="1.5" fill={color} />
        </svg>
      );
  }
}

const statCard = {
  background: '#fff',
  border: '1.5px solid #bfdbfe',
  borderRadius: 12,
  padding: '14px 18px',
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
};

const iconBox = {
  width: 44,
  height: 44,
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
  padding: '10.5px 14px',
  textAlign: align,
  color,
  fontWeight: weight,
  fontSize: 13,
  borderRight: isLast ? 'none' : '1px solid #eff6ff',
});

function normalizeUpdateDetails(details) {
  if (!details) return [];
  if (Array.isArray(details)) {
    return details.map(item => ({
      field_name: item.field_name || item.field || item.key || 'Field',
      existing_value: item.existing_value ?? item.existing ?? item.old_value ?? '—',
      requested_value: item.requested_value ?? item.requested ?? item.new_value ?? '—',
    }));
  }
  if (typeof details === 'object') {
    return Object.entries(details).map(([key, val]) => {
      if (val && typeof val === 'object' && ('requested' in val || 'new' in val || 'existing' in val)) {
        return {
          field_name: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          existing_value: val.existing ?? val.old ?? '—',
          requested_value: val.requested ?? val.new ?? '—',
        };
      }
      return {
        field_name: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        existing_value: '—',
        requested_value: typeof val === 'object' ? JSON.stringify(val) : String(val),
      };
    });
  }
  return [];
}

function normalizeAttachments(atts) {
  if (!atts) return [];
  if (Array.isArray(atts)) {
    return atts.map((a, i) => {
      if (typeof a === 'string') {
        const name = a.split('/').pop() || `Attachment_${i + 1}`;
        const isPdf = name.toLowerCase().endsWith('.pdf');
        return { name, size: 'Document', url: a, isPdf };
      }
      const name = a.name || a.filename || `Attachment_${i + 1}`;
      const isPdf = name.toLowerCase().endsWith('.pdf');
      const size = a.size ? (typeof a.size === 'number' ? `${Math.round(a.size / 1024)} KB` : a.size) : 'Document';
      return {
        name,
        size,
        url: a.url || a.path || '#',
        isPdf,
      };
    });
  }
  return [];
}

const modalCard = {
  background: '#fff',
  border: '1.5px solid #dbeafe',
  borderRadius: 8,
  overflow: 'hidden',
  marginBottom: 14,
};

const modalCardHeader = {
  background: '#f0f7ff',
  padding: '8px 16px',
  fontWeight: 700,
  fontSize: 13,
  color: '#0f172a',
  borderBottom: '1px solid #dbeafe',
};

