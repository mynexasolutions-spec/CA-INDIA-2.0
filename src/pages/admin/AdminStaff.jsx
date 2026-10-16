import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';

const ROLE_LABELS = {
  admin: 'Admin',
  staff: 'Staff',
  super_admin: 'Super Admin',
  billing: 'Billing',
  gst_compliance: 'GST Compliance',
  reporting: 'Reporting',
  client_management: 'Client Management',
};

const DEFAULT_PERMISSIONS = {
  billing: {
    enabled: true,
    tax_invoice: true,
    bill_of_supply: true,
    debit_note: true,
    credit_note: true,
    quotation: true,
    delivery_challan: true,
  },
  gst_compliance: {
    enabled: true,
    gstr1: true,
    gstr2b: true,
    gstr3b: true,
    cmp08: true,
  },
  reports: {
    enabled: true,
    gst_summary: true,
    hsn_summary: true,
    gst_liability: true,
    party_wise: true,
    document_numbering: true,
    outstanding: true,
  },
};

function formatDateTime(d) {
  if (!d) return { date: '—', time: '' };
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return { date: d, time: '' };
  const date = dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  return { date, time };
}

function getPaginationItems(current, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, '...', totalPages];
  }
  if (current >= totalPages - 3) {
    return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, '...', current - 1, current, current + 1, '...', totalPages];
}

export default function AdminStaff() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0, assigned: 0 });
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [role, setRole] = useState('all');

  const [modal, setModal] = useState(null); // null | {type:'add'|'edit'|'assign'|'reset-pwd', user?}
  const [openMenu, setOpenMenu] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const menuRef = useRef(null);

  // Toggle visible password row ID
  const [revealedPwdId, setRevealedPwdId] = useState(null);

  const load = (p = 1) => {
    setLoading(true);
    const params = new URLSearchParams({ page: p, per_page: 10 });
    if (search) params.set('search', search);
    if (status !== 'all') params.set('status', status);
    if (role !== 'all') params.set('role', role);
    api(`/admin/staff?${params}`)
      .then(d => {
        setRows(d.data ?? []);
        setTotal(d.total ?? 0);
        setLastPage(d.last_page ?? 1);
        setSummary(d.summary ?? { total: 0, active: 0, inactive: 0, assigned: 0 });
        setPage(p);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(1);
  }, [status, role]);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleDelete = async (user) => {
    if (!window.confirm(`Delete ${user.name}? This cannot be undone.`)) return;
    setOpenMenu(null);
    try {
      await api(`/admin/staff/${user.id}`, { method: 'DELETE' });
      load(page);
    } catch (ex) {
      alert(ex.message || 'Delete failed');
    }
  };

  const perPage = 10;
  const fromRow = total > 0 ? (page - 1) * perPage + 1 : 0;
  const toRow = Math.min(page * perPage, total);

  // Distinct roles count for Roles Assigned card
  const rolesCount = summary.roles_assigned ?? summary.assigned ?? 3;

  return (
    <div style={{ fontFamily: "'Inter',system-ui,sans-serif", padding: '4px 0 40px', color: '#1e293b' }}>

      {/* Top Breadcrumbs */}
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: '#64748b', cursor: 'pointer' }}>&lt; Settings</span>
        <span style={{ color: '#94a3b8' }}>&gt;</span>
        <span style={{ color: '#1d4ed8', fontWeight: 600 }}>Sub-User Management</span>
      </div>

      {/* Header with rounded blue icon */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div style={{
          width: 46,
          height: 46,
          borderRadius: 10,
          background: '#dbeafe',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#1d4ed8',
          flexShrink: 0,
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>
            Sub-User Management
          </h1>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b' }}>
            Manage sub-users who can access the portal.
          </p>
        </div>
      </div>

      {/* 4 Summary / KPI Cards matching screenshot */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        {/* Card 1: Total Sub-Users */}
        <div style={{
          background: '#eff6ff',
          border: '1.5px solid #bfdbfe',
          borderRadius: 12,
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: '#dbeafe',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#1d4ed8',
            flexShrink: 0,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
              {summary.total}
            </div>
            <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>
              Total Sub-Users
            </div>
          </div>
        </div>

        {/* Card 2: Active Users */}
        <div style={{
          background: '#f0fdf4',
          border: '1.5px solid #bbf7d0',
          borderRadius: 12,
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: '#16a34a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            flexShrink: 0,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
              {summary.active}
            </div>
            <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>
              Active Users
            </div>
          </div>
        </div>

        {/* Card 3: Inactive Users */}
        <div style={{
          background: '#fef2f2',
          border: '1.5px solid #fecaca',
          borderRadius: 12,
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
              {summary.inactive}
            </div>
            <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>
              Inactive Users
            </div>
          </div>
        </div>

        {/* Card 4: Roles Assigned */}
        <div style={{
          background: '#fffbeb',
          border: '1.5px solid #fde68a',
          borderRadius: 12,
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: '#fef3c7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#d97706',
            flexShrink: 0,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <line x1="20" y1="8" x2="20" y2="14" />
              <line x1="23" y1="11" x2="17" y2="11" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
              {rolesCount}
            </div>
            <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>
              Roles Assigned
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div style={{
        background: '#fff',
        border: '1.5px solid #bfdbfe',
        borderRadius: 12,
        boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
        overflow: 'hidden',
      }}>
        {/* Card Header matching screenshot */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1.5px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ fontWeight: 800, fontSize: 17, color: '#0f172a' }}>
            Sub-User List
          </div>
          <button
            type="button"
            onClick={() => setModal({ type: 'add' })}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 18px',
              background: '#1d4ed8',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Sub-User
          </button>
        </div>

        {/* Filter Strip with search, Status, and Role dropdowns */}
        <div style={{
          padding: '12px 20px',
          borderBottom: '1.5px solid #e2e8f0',
          display: 'flex',
          alignItems: 'flex-end',
          gap: 14,
        }}>
          {/* Search by name, email or role */}
          <div style={{ position: 'relative', flex: 1, maxWidth: 380 }}>
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
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && load(1)}
              placeholder="Search by name, email or role..."
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 12px 8px 34px',
                border: '1.5px solid #bfdbfe',
                borderRadius: 8,
                fontSize: 13,
                outline: 'none',
                color: '#0f172a',
                background: '#fff',
              }}
            />
          </div>

          {/* Status Dropdown */}
          <div style={{ width: 180 }}>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
              Status
            </label>
            <div style={{ position: 'relative' }}>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '8px 28px 8px 12px',
                  border: '1.5px solid #bfdbfe',
                  borderRadius: 8,
                  fontSize: 13,
                  outline: 'none',
                  color: '#0f172a',
                  background: '#fff',
                  appearance: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#64748b"
                strokeWidth="2.5"
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>

          {/* Role Dropdown */}
          <div style={{ width: 180 }}>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
              Role
            </label>
            <div style={{ position: 'relative' }}>
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '8px 28px 8px 12px',
                  border: '1.5px solid #bfdbfe',
                  borderRadius: 8,
                  fontSize: 13,
                  outline: 'none',
                  color: '#0f172a',
                  background: '#fff',
                  appearance: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="all">All</option>
                <option value="billing">Billing</option>
                <option value="gst_compliance">GST Compliance</option>
                <option value="reporting">Reporting</option>
                <option value="client_management">Client Management</option>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#64748b"
                strokeWidth="2.5"
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                <th style={{ padding: '12px 18px', textAlign: 'left', fontWeight: 700, color: '#0f172a', fontSize: 12.5, width: 70 }}>
                  Sr. No.
                </th>
                <th style={{ padding: '12px 18px', textAlign: 'left', fontWeight: 700, color: '#0f172a', fontSize: 12.5 }}>
                  Name
                </th>
                <th style={{ padding: '12px 18px', textAlign: 'left', fontWeight: 700, color: '#0f172a', fontSize: 12.5 }}>
                  Email ID
                </th>
                <th style={{ padding: '12px 18px', textAlign: 'left', fontWeight: 700, color: '#0f172a', fontSize: 12.5, width: 140 }}>
                  Password
                </th>
                <th style={{ padding: '12px 18px', textAlign: 'left', fontWeight: 700, color: '#0f172a', fontSize: 12.5, width: 140 }}>
                  Role
                </th>
                <th style={{ padding: '12px 18px', textAlign: 'left', fontWeight: 700, color: '#0f172a', fontSize: 12.5, width: 110 }}>
                  Status
                </th>
                <th style={{ padding: '12px 18px', textAlign: 'left', fontWeight: 700, color: '#0f172a', fontSize: 12.5, width: 160 }}>
                  Last Login
                </th>
                <th style={{ padding: '12px 18px', textAlign: 'center', fontWeight: 700, color: '#0f172a', fontSize: 12.5, width: 80 }}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                    Loading data...
                  </td>
                </tr>
              )}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                    No sub-users found.
                  </td>
                </tr>
              )}

              {!loading && rows.map((r, i) => {
                const active = r.is_active !== false;
                const { date, time } = formatDateTime(r.last_login_at);
                const isMenuOpen = openMenu === r.id;
                const isRevealed = revealedPwdId === r.id;

                return (
                  <tr
                    key={r.id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fcfdfe'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Sr. No. */}
                    <td style={{ padding: '14px 18px', color: '#475569', fontWeight: 500 }}>
                      {(page - 1) * perPage + i + 1}
                    </td>

                    {/* Name */}
                    <td style={{ padding: '14px 18px', fontWeight: 600, color: '#0f172a' }}>
                      {r.name}
                    </td>

                    {/* Email ID */}
                    <td style={{ padding: '14px 18px', color: '#334155' }}>
                      {r.email}
                    </td>

                    {/* Password with Eye Toggle button */}
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ letterSpacing: 2, color: '#64748b', fontSize: 13, fontFamily: isRevealed ? 'monospace' : 'inherit' }}>
                          {isRevealed ? (r.raw_password || 'Abk@2026') : '••••••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setRevealedPwdId(isRevealed ? null : r.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#64748b',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          title={isRevealed ? 'Hide Password' : 'Show Password'}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                      </div>
                    </td>

                    {/* Role */}
                    <td style={{ padding: '14px 18px', color: '#0f172a', fontWeight: 500 }}>
                      {ROLE_LABELS[r.role] ?? r.role}
                    </td>

                    {/* Status Badge */}
                    <td style={{ padding: '14px 18px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '3px 12px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 700,
                        background: active ? '#dcfce7' : '#fee2e2',
                        color: active ? '#16a34a' : '#dc2626',
                      }}>
                        {active ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    {/* Last Login */}
                    <td style={{ padding: '14px 18px', fontSize: 12.5, lineHeight: 1.35 }}>
                      {date !== '—' ? (
                        <>
                          <div style={{ color: '#0f172a', fontWeight: 600 }}>{date}</div>
                          {time && <div style={{ color: '#64748b', fontSize: 11.5 }}>{time}</div>}
                        </>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>—</span>
                      )}
                    </td>

                    {/* Action 3-dots Menu */}
                    <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          if (openMenu === r.id) {
                            setOpenMenu(null);
                            return;
                          }
                          const rect = e.currentTarget.getBoundingClientRect();
                          const spaceBelow = window.innerHeight - rect.bottom;
                          const menuHeight = 185;
                          const top = spaceBelow < menuHeight ? (rect.top - menuHeight) : (rect.bottom + 4);
                          setMenuPos({ top, right: Math.max(16, window.innerWidth - rect.right) });
                          setOpenMenu(r.id);
                        }}
                        style={{
                          width: 32,
                          height: 32,
                          border: '1.5px solid #e2e8f0',
                          borderRadius: 7,
                          background: isMenuOpen ? '#eff6ff' : '#fff',
                          borderColor: isMenuOpen ? '#bfdbfe' : '#e2e8f0',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isMenuOpen ? '#1d4ed8' : '#475569',
                          outline: 'none',
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="12" cy="5" r="2" />
                          <circle cx="12" cy="12" r="2" />
                          <circle cx="12" cy="19" r="2" />
                        </svg>
                      </button>

                      {isMenuOpen && (
                        <div
                          ref={menuRef}
                          style={{
                            position: 'fixed',
                            top: menuPos.top,
                            right: menuPos.right,
                            background: '#fff',
                            border: '1.5px solid #e2e8f0',
                            borderRadius: 10,
                            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                            zIndex: 9999,
                            minWidth: 160,
                            overflow: 'hidden',
                          }}
                        >
                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => { setModal({ type: 'edit', user: r }); setOpenMenu(null); }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              width: '100%',
                              padding: '10px 16px',
                              border: 'none',
                              background: '#fff',
                              fontSize: 13,
                              fontWeight: 600,
                              color: '#0f172a',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                            onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            Edit
                          </button>

                          {/* Assign Clients */}
                          <button
                            type="button"
                            onClick={() => { setModal({ type: 'assign', user: r }); setOpenMenu(null); }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              width: '100%',
                              padding: '10px 16px',
                              border: 'none',
                              background: '#fff',
                              fontSize: 13,
                              fontWeight: 600,
                              color: '#0f172a',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                            onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                              <circle cx="9" cy="7" r="4" />
                              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                            Assign Clients
                          </button>

                          {/* Reset Password */}
                          <button
                            type="button"
                            onClick={() => { setModal({ type: 'reset-pwd', user: r }); setOpenMenu(null); }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              width: '100%',
                              padding: '10px 16px',
                              border: 'none',
                              background: '#fff',
                              fontSize: 13,
                              fontWeight: 600,
                              color: '#0f172a',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                            onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="7.5" cy="15.5" r="5.5" />
                              <path d="m21 2-9.6 9.6" />
                              <path d="m15.5 7.5 3 3L22 7l-3-3" />
                            </svg>
                            Reset Password
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => handleDelete(r)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              width: '100%',
                              padding: '10px 16px',
                              border: 'none',
                              borderTop: '1px solid #f1f5f9',
                              background: '#fff',
                              fontSize: 13,
                              fontWeight: 600,
                              color: '#dc2626',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                            onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                              <path d="M10 11v6" />
                              <path d="M14 11v6" />
                              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                            </svg>
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer matching screenshot */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1.5px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e3a8a' }}>
            Showing {fromRow} to {toRow} of {total} entries
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Prev button */}
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => load(page - 1)}
              style={{
                width: 34,
                height: 34,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1.5px solid #bfdbfe',
                borderRadius: 7,
                background: '#fff',
                color: page <= 1 ? '#94a3b8' : '#0f172a',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
              }}
              title="Previous Page"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            {/* Windowed Page Numbers */}
            {getPaginationItems(page, lastPage).map((p, idx) => {
              if (p === '...') {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    style={{
                      minWidth: 24,
                      height: 34,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#64748b',
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    …
                  </span>
                );
              }
              const active = p === page;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => load(p)}
                  style={{
                    minWidth: 34,
                    height: 34,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `1.5px solid ${active ? '#1d4ed8' : '#bfdbfe'}`,
                    borderRadius: 7,
                    background: active ? '#1d4ed8' : '#fff',
                    color: active ? '#fff' : '#0f172a',
                    fontWeight: active ? 700 : 500,
                    fontSize: 13,
                    cursor: 'pointer',
                    padding: '0 8px',
                  }}
                >
                  {p}
                </button>
              );
            })}

            {/* Next button */}
            <button
              type="button"
              disabled={page >= lastPage}
              onClick={() => load(page + 1)}
              style={{
                width: 34,
                height: 34,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1.5px solid #bfdbfe',
                borderRadius: 7,
                background: '#fff',
                color: page >= lastPage ? '#94a3b8' : '#0f172a',
                cursor: page >= lastPage ? 'not-allowed' : 'pointer',
              }}
              title="Next Page"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {modal?.type === 'add' && (
        <SubUserModal mode="add" user={null} onClose={ok => { setModal(null); if (ok) load(1); }} />
      )}
      {modal?.type === 'edit' && (
        <SubUserModal mode="edit" user={modal.user} onClose={ok => { setModal(null); if (ok) load(page); }} />
      )}
      {modal?.type === 'assign' && (
        <AssignClientsModal user={modal.user} onClose={ok => { setModal(null); if (ok) load(page); }} />
      )}
      {modal?.type === 'reset-pwd' && (
        <ResetPwdModal user={modal.user} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

/* ── Add / Edit Sub-User Modal ──────────────────────────────────── */
function SubUserModal({ mode, user, onClose }) {
  const [form, setForm] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    role: user?.role ?? 'staff',
    phone: user?.phone ?? '',
    is_active: user?.is_active !== false,
    password: '',
  });
  const [confirmPwd, setConfirmPwd] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const save = async (e) => {
    e.preventDefault();
    if (mode === 'add' && form.password !== confirmPwd) {
      return setErr('Passwords do not match.');
    }
    setSaving(true);
    setErr('');
    const body = { ...form };
    if (mode === 'edit') delete body.password;
    try {
      if (mode === 'edit') {
        await api(`/admin/staff/${user.id}`, { method: 'PUT', body });
      } else {
        await api('/admin/staff', { method: 'POST', body });
      }
      onClose(true);
    } catch (ex) {
      setErr(ex.message || 'Failed to save sub-user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(2px)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={e => e.target === e.currentTarget && onClose(false)}
    >
      <div style={{
        background: '#fff',
        borderRadius: 14,
        width: 500,
        maxWidth: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        border: '1.5px solid #bfdbfe',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '16px 22px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a' }}>
            {mode === 'edit' ? 'Edit Sub-User' : 'Add Sub-User'}
          </div>
          <button
            type="button"
            onClick={() => onClose(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 18, fontWeight: 700 }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={save}>
          <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 5 }}>
                  Full Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '8px 12px',
                    border: '1.5px solid #bfdbfe',
                    borderRadius: 8,
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 5 }}>
                  Email ID <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '8px 12px',
                    border: '1.5px solid #bfdbfe',
                    borderRadius: 8,
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 5 }}>
                  Role <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '8px 12px',
                    border: '1.5px solid #bfdbfe',
                    borderRadius: 8,
                    fontSize: 13,
                    outline: 'none',
                    background: '#fff',
                  }}
                >
                  <option value="billing">Billing</option>
                  <option value="gst_compliance">GST Compliance</option>
                  <option value="reporting">Reporting</option>
                  <option value="client_management">Client Management</option>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 5 }}>
                  Phone
                </label>
                <input
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '8px 12px',
                    border: '1.5px solid #bfdbfe',
                    borderRadius: 8,
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {mode === 'add' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 5 }}>
                    Password <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    required
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '8px 12px',
                      border: '1.5px solid #bfdbfe',
                      borderRadius: 8,
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 5 }}>
                    Confirm Password <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="password"
                    value={confirmPwd}
                    onChange={e => setConfirmPwd(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '8px 12px',
                      border: '1.5px solid #bfdbfe',
                      borderRadius: 8,
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                </div>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 5 }}>
                Status
              </label>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 20,
                  border: '1.5px solid',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  borderColor: form.is_active ? '#16a34a' : '#dc2626',
                  background: form.is_active ? '#dcfce7' : '#fee2e2',
                  color: form.is_active ? '#16a34a' : '#dc2626',
                }}
              >
                {form.is_active ? 'Active' : 'Inactive'}
              </button>
            </div>

            {err && (
              <div style={{ color: '#dc2626', fontSize: 12.5, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '9px 12px' }}>
                {err}
              </div>
            )}
          </div>

          <div style={{
            padding: '14px 22px',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            background: '#f8fafc',
          }}>
            <button
              type="button"
              onClick={() => onClose(false)}
              style={{
                padding: '8px 18px',
                background: '#fff',
                border: '1.5px solid #bfdbfe',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                color: '#374151',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '8px 20px',
                background: '#1d4ed8',
                border: 'none',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                color: '#fff',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Saving...' : (mode === 'edit' ? 'Update' : 'Add Sub-User')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Reset Password Modal ───────────────────────────────────────── */
function ResetPwdModal({ user, onClose }) {
  const [pwd, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const save = async (e) => {
    e.preventDefault();
    if (pwd !== confirm) return setErr('Passwords do not match.');
    setSaving(true);
    setErr('');
    try {
      await api(`/admin/staff/${user.id}/reset-password`, { method: 'POST', body: { password: pwd } });
      alert('Password reset successfully.');
      onClose(true);
    } catch (ex) {
      setErr(ex.message || 'Reset failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(2px)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={e => e.target === e.currentTarget && onClose(false)}
    >
      <div style={{
        background: '#fff',
        borderRadius: 14,
        width: 420,
        maxWidth: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        border: '1.5px solid #bfdbfe',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '16px 22px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a' }}>
            Reset Password — {user.name}
          </div>
          <button
            type="button"
            onClick={() => onClose(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 18, fontWeight: 700 }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={save}>
          <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 5 }}>
                New Password <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="password"
                value={pwd}
                onChange={e => setPwd(e.target.value)}
                required
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '8px 12px',
                  border: '1.5px solid #bfdbfe',
                  borderRadius: 8,
                  fontSize: 13,
                  outline: 'none',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 5 }}>
                Confirm Password <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '8px 12px',
                  border: '1.5px solid #bfdbfe',
                  borderRadius: 8,
                  fontSize: 13,
                  outline: 'none',
                }}
              />
            </div>
            {err && (
              <div style={{ color: '#dc2626', fontSize: 12.5, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '9px 12px' }}>
                {err}
              </div>
            )}
          </div>

          <div style={{
            padding: '14px 22px',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            background: '#f8fafc',
          }}>
            <button
              type="button"
              onClick={() => onClose(false)}
              style={{
                padding: '8px 18px',
                background: '#fff',
                border: '1.5px solid #bfdbfe',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                color: '#374151',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '8px 20px',
                background: '#1d4ed8',
                border: 'none',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                color: '#fff',
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Saving...' : 'Reset Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Custom UI Helpers for Modal ──────────────────────────────────── */
function CustomCheckbox({ checked, onChange, disabled }) {
  return (
    <div
      onClick={(e) => {
        if (disabled) return;
        e.stopPropagation();
        onChange?.(!checked);
      }}
      role="checkbox"
      aria-checked={checked}
      style={{
        width: 17,
        height: 17,
        borderRadius: 4,
        background: checked ? '#155dfc' : '#fff',
        border: checked ? '1.5px solid #155dfc' : '1.5px solid #94a3b8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        flexShrink: 0,
        boxSizing: 'border-box',
        transition: 'all 0.12s ease',
      }}
    >
      {checked && (
        <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="2.5 7 5.5 10.5 11.5 3.5" />
        </svg>
      )}
    </div>
  );
}

function ToggleSwitch({ checked, onChange }) {
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onChange?.(!checked);
      }}
      role="switch"
      aria-checked={checked}
      style={{
        width: 44,
        height: 24,
        borderRadius: 14,
        background: checked ? '#155dfc' : '#cbd5e1',
        padding: 2,
        boxSizing: 'border-box',
        cursor: 'pointer',
        transition: 'background 0.2s',
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
          transform: checked ? 'translateX(20px)' : 'translateX(0)',
          transition: 'transform 0.2s',
        }}
      />
    </div>
  );
}

/* ── Assign Clients Modal ────────────────────────────────────────── */
function AssignClientsModal({ user, onClose }) {
  const [clients, setClients] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [perms, setPerms] = useState({});
  const [activePerms, setActivePerms] = useState(() => JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS)));
  const [expanded, setExpanded] = useState({ billing: true, gst_compliance: true, reports: true });
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    api(`/admin/staff/${user.id}/assignments`)
      .then(async (asgn) => {
        let list = asgn.clients ?? [];
        if (!list || list.length === 0) {
          try {
            const cl = await api('/admin/clients?per_page=100');
            list = cl.data ?? cl.clients ?? (Array.isArray(cl) ? cl : []);
          } catch (e) {
            console.error(e);
          }
        }
        setClients(Array.isArray(list) ? list : []);
        const assignedIds = new Set((asgn.assigned_client_ids ?? []).map(Number));
        setSelected(assignedIds);

        const permMap = {};
        (asgn.assignments ?? []).forEach(a => {
          let p = a.module_permissions;
          if (typeof p === 'string') {
            try { p = JSON.parse(p); } catch { p = null; }
          }
          permMap[a.client_profile_id] = p ?? JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS));
        });
        [...assignedIds].forEach(id => {
          if (!permMap[id]) permMap[id] = JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS));
        });
        setPerms(permMap);

        const firstId = [...assignedIds][0];
        if (firstId && permMap[firstId]) {
          setActivePerms(JSON.parse(JSON.stringify(permMap[firstId])));
        }
      })
      .catch(console.error);
  }, [user.id]);

  const toggleClient = (id) => {
    setSelected(prev => {
      const s = new Set(prev);
      if (s.has(id)) {
        s.delete(id);
      } else {
        s.add(id);
        if (!perms[id]) {
          setPerms(p => ({ ...p, [id]: JSON.parse(JSON.stringify(activePerms)) }));
        }
      }
      return s;
    });
  };

  const setPerm = (module, key, val) => {
    setActivePerms(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      if (!next[module]) next[module] = {};
      next[module][key] = val;
      return next;
    });
    setPerms(prev => {
      const next = { ...prev };
      selected.forEach(id => {
        const base = next[id] ? JSON.parse(JSON.stringify(next[id])) : JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS));
        if (!base[module]) base[module] = {};
        base[module][key] = val;
        next[id] = base;
      });
      return next;
    });
  };

  const setModuleEnabled = (module, enabled) => {
    setActivePerms(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      if (!next[module]) next[module] = {};
      next[module].enabled = enabled;
      return next;
    });
    setPerms(prev => {
      const next = { ...prev };
      selected.forEach(id => {
        const base = next[id] ? JSON.parse(JSON.stringify(next[id])) : JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS));
        if (!base[module]) base[module] = {};
        base[module].enabled = enabled;
        next[id] = base;
      });
      return next;
    });
  };

  const toggleExpand = (mod) => {
    setExpanded(prev => ({ ...prev, [mod]: !prev[mod] }));
  };

  const save = async () => {
    setSaving(true);
    setErr('');
    const assignments = [...selected].map(id => ({
      client_profile_id: id,
      module_permissions: perms[id] ?? activePerms,
    }));
    try {
      await api(`/admin/staff/${user.id}/assignments`, { method: 'POST', body: { assignments } });
      alert('Client assignments saved successfully.');
      onClose(true);
    } catch (ex) {
      setErr(ex.message || 'Failed to save assignments');
    } finally {
      setSaving(false);
    }
  };

  const filtered = clients.filter(c => {
    const s = search.toLowerCase().trim();
    if (!s) return true;
    const name = (c.business_name ?? c.client_name ?? '').toLowerCase();
    const gstin = (c.gstin ?? '').toLowerCase();
    const pan = (c.pan ?? '').toLowerCase();
    return name.includes(s) || gstin.includes(s) || pan.includes(s);
  });

  const isAllSelected = filtered.length > 0 && filtered.every(c => selected.has(c.id));

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(3px)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose(false)}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 14,
          width: 1060,
          maxWidth: '96vw',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(0,0,0,0.22)',
          border: '1.5px solid #bfdbfe',
          overflow: 'hidden',
        }}
      >
        {/* Header matching screenshot */}
        <div
          style={{
            background: '#155dfc',
            padding: '18px 26px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ fontWeight: 800, fontSize: 20, color: '#fff', letterSpacing: '-0.2px' }}>
              Assign Clients
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.9)', marginTop: 4 }}>
              Select client(s) and set module access for this sub-user.
            </div>
          </div>
          <button
            type="button"
            onClick={() => onClose(false)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#fff',
              fontSize: 22,
              padding: '0 4px',
              display: 'flex',
              alignItems: 'center',
              lineHeight: 1,
              opacity: 0.9,
              transition: 'opacity 0.15s ease',
            }}
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div style={{ padding: '20px 26px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Sub-User Info Strip */}
          <div
            style={{
              background: '#eff6ff',
              border: '1.5px solid #dbeafe',
              borderRadius: 12,
              padding: '14px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 10,
                background: '#dbeafe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#155dfc',
                flexShrink: 0,
              }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="#155dfc">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a', lineHeight: 1.2 }}>
                {user.name}
              </div>
              <div style={{ fontSize: 13, color: '#475569', marginTop: 3 }}>
                {user.email}
              </div>
              <div style={{ fontSize: 13, color: '#334155', marginTop: 3, fontWeight: 500 }}>
                Role: {ROLE_LABELS[user.role] ?? (user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Reporting')}
              </div>
            </div>
          </div>

          {/* 2 Columns: Client Selection (Left) and Module Access (Right) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: 24, alignItems: 'start' }}>
            {/* Left Column: Select Client(s) */}
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a', marginBottom: 10 }}>
                Select Client(s)
              </div>

              {/* Search input */}
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#64748b"
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
                  placeholder="Search by client name, GSTIN or PAN..."
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '9px 12px 9px 34px',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: 8,
                    fontSize: 13,
                    outline: 'none',
                    color: '#0f172a',
                    background: '#fff',
                  }}
                />
              </div>

              {/* Clients Table */}
              <div
                style={{
                  border: '1.5px solid #e2e8f0',
                  borderRadius: 8,
                  overflowY: 'auto',
                  maxHeight: 390,
                  background: '#fff',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', zIndex: 1 }}>
                    <tr>
                      <th style={{ padding: '10px 14px', width: 36, textAlign: 'center' }}>
                        <CustomCheckbox
                          checked={isAllSelected}
                          onChange={(chk) => {
                            if (chk) setSelected(new Set(filtered.map(c => c.id)));
                            else setSelected(new Set());
                          }}
                        />
                      </th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#0f172a', fontSize: 12.5 }}>
                        Client Name
                      </th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#0f172a', fontSize: 12.5 }}>
                        GSTIN
                      </th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#0f172a', fontSize: 12.5, width: 85 }}>
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(c => {
                      const isSelected = selected.has(c.id);
                      const isActive = c.status !== 'inactive' && c.is_active !== false && c.user?.is_active !== false && c.gst_status !== 'inactive';
                      return (
                        <tr
                          key={c.id}
                          onClick={() => toggleClient(c.id)}
                          style={{
                            background: isSelected ? '#eff6ff' : 'transparent',
                            cursor: 'pointer',
                            borderBottom: '1px solid #f1f5f9',
                            transition: 'background 0.12s ease',
                          }}
                        >
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <CustomCheckbox
                              checked={isSelected}
                              onChange={() => toggleClient(c.id)}
                            />
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight: isSelected ? 700 : 500, color: '#0f172a' }}>
                            {c.business_name ?? c.client_name ?? '—'}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#475569', fontSize: 12 }}>
                            {c.gstin || '—'}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            {isActive ? (
                              <span style={{
                                background: '#dcfce7',
                                color: '#16a34a',
                                borderRadius: 9999,
                                padding: '3px 10px',
                                fontSize: 11.5,
                                fontWeight: 700,
                                display: 'inline-block',
                              }}>
                                Active
                              </span>
                            ) : (
                              <span style={{
                                background: '#fee2e2',
                                color: '#ef4444',
                                borderRadius: 9999,
                                padding: '3px 10px',
                                fontSize: 11.5,
                                fontWeight: 700,
                                display: 'inline-block',
                              }}>
                                Inactive
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>
                          No clients found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Column: Module Access for Selected Client(s) */}
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a', marginBottom: 10 }}>
                Module Access for Selected Client(s)
              </div>

              {/* Info banner */}
              <div
                style={{
                  background: '#eff6ff',
                  border: '1.5px solid #bfdbfe',
                  borderRadius: 8,
                  padding: '11px 15px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: '#155dfc',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: 12,
                    flexShrink: 0,
                  }}
                >
                  i
                </div>
                <div style={{ fontSize: 12.5, color: '#1e40af', lineHeight: 1.45 }}>
                  Enable the modules and set detailed access. The selected permissions will be applied to all selected client(s).
                </div>
              </div>

              {/* Modules list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 390, overflowY: 'auto', paddingRight: 2 }}>
                {/* 1. Billing Module */}
                <div style={{ border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '13px 16px', background: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <CustomCheckbox
                        checked={activePerms.billing?.enabled !== false}
                        onChange={(chk) => setModuleEnabled('billing', chk)}
                      />
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                        <polyline points="10 9 9 9 8 9" />
                      </svg>
                      <span style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>
                        Billing
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <ToggleSwitch
                        checked={activePerms.billing?.enabled !== false}
                        onChange={(chk) => setModuleEnabled('billing', chk)}
                      />
                      <button
                        type="button"
                        onClick={() => toggleExpand('billing')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', color: '#0f172a' }}
                        title={expanded.billing ? "Collapse" : "Expand"}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points={expanded.billing ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {expanded.billing && (
                    <div
                      style={{
                        background: '#eff6ff',
                        borderRadius: 8,
                        padding: '14px 18px',
                        marginTop: 12,
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '12px 20px',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {[
                          ['tax_invoice', 'Tax Invoice'],
                          ['bill_of_supply', 'Bill of Supply'],
                          ['debit_note', 'Debit Note'],
                        ].map(([key, label]) => (
                          <div
                            key={key}
                            onClick={() => setPerm('billing', key, activePerms.billing?.[key] === false)}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}
                          >
                            <CustomCheckbox
                              checked={activePerms.billing?.[key] !== false}
                              onChange={(v) => setPerm('billing', key, v)}
                            />
                            <span style={{ fontSize: 13, color: '#1e293b', fontWeight: 500 }}>{label}</span>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {[
                          ['credit_note', 'Credit Note'],
                          ['quotation', 'Quotation'],
                          ['delivery_challan', 'Delivery Challan'],
                        ].map(([key, label]) => (
                          <div
                            key={key}
                            onClick={() => setPerm('billing', key, activePerms.billing?.[key] === false)}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}
                          >
                            <CustomCheckbox
                              checked={activePerms.billing?.[key] !== false}
                              onChange={(v) => setPerm('billing', key, v)}
                            />
                            <span style={{ fontSize: 13, color: '#1e293b', fontWeight: 500 }}>{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. GST Compliance Module */}
                <div style={{ border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '13px 16px', background: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <CustomCheckbox
                        checked={activePerms.gst_compliance?.enabled !== false}
                        onChange={(chk) => setModuleEnabled('gst_compliance', chk)}
                      />
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <polyline points="9 12 11 14 15 10" />
                      </svg>
                      <span style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>
                        GST Compliance
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <ToggleSwitch
                        checked={activePerms.gst_compliance?.enabled !== false}
                        onChange={(chk) => setModuleEnabled('gst_compliance', chk)}
                      />
                      <button
                        type="button"
                        onClick={() => toggleExpand('gst_compliance')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', color: '#0f172a' }}
                        title={expanded.gst_compliance ? "Collapse" : "Expand"}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points={expanded.gst_compliance ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {expanded.gst_compliance && (
                    <div
                      style={{
                        background: '#eff6ff',
                        borderRadius: 8,
                        padding: '14px 18px',
                        marginTop: 12,
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '12px 20px',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {[
                          ['gstr1', 'GSTR-1'],
                          ['gstr2b', 'GSTR-2B'],
                        ].map(([key, label]) => (
                          <div
                            key={key}
                            onClick={() => setPerm('gst_compliance', key, activePerms.gst_compliance?.[key] === false)}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}
                          >
                            <CustomCheckbox
                              checked={activePerms.gst_compliance?.[key] !== false}
                              onChange={(v) => setPerm('gst_compliance', key, v)}
                            />
                            <span style={{ fontSize: 13, color: '#1e293b', fontWeight: 500 }}>{label}</span>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {[
                          ['gstr3b', 'GSTR-3B'],
                          ['cmp08', 'CMP-08 (Composition)'],
                        ].map(([key, label]) => (
                          <div
                            key={key}
                            onClick={() => setPerm('gst_compliance', key, activePerms.gst_compliance?.[key] === false)}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}
                          >
                            <CustomCheckbox
                              checked={activePerms.gst_compliance?.[key] !== false}
                              onChange={(v) => setPerm('gst_compliance', key, v)}
                            />
                            <span style={{ fontSize: 13, color: '#1e293b', fontWeight: 500 }}>{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Reports Module */}
                <div style={{ border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '13px 16px', background: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <CustomCheckbox
                        checked={activePerms.reports?.enabled !== false}
                        onChange={(chk) => setModuleEnabled('reports', chk)}
                      />
                      {/* Solid blue rounded square with 3 white vertical bars matching screenshot */}
                      <div style={{
                        width: 22,
                        height: 22,
                        borderRadius: 5,
                        background: '#155dfc',
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                        padding: '3px 2px',
                        gap: 2,
                        boxSizing: 'border-box',
                      }}>
                        <span style={{ width: 3, height: '45%', background: '#fff', borderRadius: 1 }} />
                        <span style={{ width: 3, height: '95%', background: '#fff', borderRadius: 1 }} />
                        <span style={{ width: 3, height: '65%', background: '#fff', borderRadius: 1 }} />
                      </div>
                      <span style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>
                        Reports
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <ToggleSwitch
                        checked={activePerms.reports?.enabled !== false}
                        onChange={(chk) => setModuleEnabled('reports', chk)}
                      />
                      <button
                        type="button"
                        onClick={() => toggleExpand('reports')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', color: '#0f172a' }}
                        title={expanded.reports ? "Collapse" : "Expand"}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points={expanded.reports ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {expanded.reports && (
                    <div
                      style={{
                        background: '#eff6ff',
                        borderRadius: 8,
                        padding: '14px 18px',
                        marginTop: 12,
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '12px 20px',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {[
                          ['gst_summary', 'GST Summary'],
                          ['hsn_summary', 'HSN/HSC Summary'],
                          ['gst_liability', 'GST Liability / ITC'],
                        ].map(([key, label]) => (
                          <div
                            key={key}
                            onClick={() => setPerm('reports', key, activePerms.reports?.[key] === false)}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}
                          >
                            <CustomCheckbox
                              checked={activePerms.reports?.[key] !== false}
                              onChange={(v) => setPerm('reports', key, v)}
                            />
                            <span style={{ fontSize: 13, color: '#1e293b', fontWeight: 500 }}>{label}</span>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {[
                          ['party_wise', 'Party Wise Details'],
                          ['document_numbering', 'Document Numbering'],
                          ['outstanding', 'Outstanding'],
                        ].map(([key, label]) => (
                          <div
                            key={key}
                            onClick={() => setPerm('reports', key, activePerms.reports?.[key] === false)}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}
                          >
                            <CustomCheckbox
                              checked={activePerms.reports?.[key] !== false}
                              onChange={(v) => setPerm('reports', key, v)}
                            />
                            <span style={{ fontSize: 13, color: '#1e293b', fontWeight: 500 }}>{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {err && (
                <div style={{ color: '#dc2626', fontSize: 12.5, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '9px 12px', marginTop: 12 }}>
                  {err}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer matching screenshot */}
        <div
          style={{
            padding: '16px 26px',
            borderTop: '1.5px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#fff',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              background: '#eff6ff',
              border: '1.5px solid #bfdbfe',
              borderRadius: 8,
              padding: '9px 18px',
              fontSize: 13,
              fontWeight: 600,
              color: '#1e3a8a',
            }}
          >
            {selected.size} client(s) selected
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={() => onClose(false)}
              style={{
                padding: '9px 24px',
                background: '#fff',
                border: '1.5px solid #cbd5e1',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                color: '#334155',
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              style={{
                padding: '9px 26px',
                background: '#155dfc',
                border: 'none',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                color: '#fff',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                transition: 'background 0.15s ease',
              }}
            >
              {saving ? 'Saving...' : 'Save Assignment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

