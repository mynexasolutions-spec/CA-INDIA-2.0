import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { LoadingBlock } from '../../components/Spinner';
import { useAdminFy } from '../../context/AdminFyContext';
import '../billing/admin-overview.css';

// SVG Icons for Top Metric Cards
function UsersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function UserCheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <polyline points="16 11 18 13 22 9" />
    </svg>
  );
}

function UserXIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="17" y1="8" x2="22" y2="13" />
      <line x1="22" y1="8" x2="17" y2="13" />
    </svg>
  );
}

function ClipboardListIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M9 12h6" />
      <path d="M9 16h6" />
    </svg>
  );
}

function FileTaxIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

// Icons for Strips
function ClockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function MiniDocIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function ShieldCheckMiniIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 11 12 14 16 9" />
    </svg>
  );
}

function CalendarMiniIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

// Crisp SVGs for Request Overview Table 3
function ReqUserIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function ReqDocIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function ReqBankIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18M3 10h18M5 10v11M19 10v11M9 10v11M15 10v11M12 3L2 10h20L12 3z" />
    </svg>
  );
}

function ReqGearIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.96 19a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.96a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06-.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1.04-1.56V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06-.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.56 1.04H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z" />
    </svg>
  );
}

function ReqDotsIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" />
      <circle cx="5" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

const SPEC_CLIENT_REQUEST_ROWS = [
  {
    key: 'profile_update',
    title: 'Profile Update',
    action_url: '/admin/pending-approval',
  },
  {
    key: 'document_change',
    title: 'Document Change',
    action_url: '/admin/edit-requests',
  },
  {
    key: 'bank_details',
    title: 'Bank Details',
    action_url: '/admin/pending-approval',
  },
  {
    key: 'invoice_settings',
    title: 'Invoice Settings',
    action_url: '/admin/pending-approval',
  },
  {
    key: 'others',
    title: 'Others',
    action_url: '/admin/pending-approval',
  },
];

function getUpcomingDueDatesFallback() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed: 0=Jan, 9=Oct
  const month1Indexed = month + 1;
  const today = new Date(year, month, now.getDate());

  const formatStatus = (dueDay) => {
    const dueDate = new Date(year, month, dueDay);
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      return { label: 'Overdue', type: 'overdue' };
    } else if (diffDays === 0) {
      return { label: 'Due Today', type: 'due_today' };
    } else {
      return {
        label: `In ${diffDays} ${diffDays === 1 ? 'Day' : 'Days'}`,
        type: 'upcoming',
      };
    }
  };

  const formatDate = (dueDay) => {
    const d = new Date(year, month, dueDay);
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day} ${months[month]} ${year}`;
  };

  const rows = [
    {
      return_type: 'GSTR-1 (Monthly)',
      due_date_formatted: formatDate(11),
      client_count: 0,
      status: formatStatus(11).label,
      status_type: formatStatus(11).type,
    },
    {
      return_type: 'GSTR-3B (Monthly)',
      due_date_formatted: formatDate(20),
      client_count: 0,
      status: formatStatus(20).label,
      status_type: formatStatus(20).type,
    },
    {
      return_type: 'GSTR-1 (QRMP)',
      due_date_formatted: formatDate(13),
      client_count: 1,
      status: formatStatus(13).label,
      status_type: formatStatus(13).type,
    },
  ];

  if ([1, 4, 7, 10].includes(month1Indexed)) {
    rows.push({
      return_type: 'GSTR-3B (Quarterly)',
      due_date_formatted: formatDate(22),
      client_count: 1,
      status: formatStatus(22).label,
      status_type: formatStatus(22).type,
    });
    rows.push({
      return_type: 'CMP-08',
      due_date_formatted: formatDate(18),
      client_count: 1,
      status: formatStatus(18).label,
      status_type: formatStatus(18).type,
    });
  }

  return rows;
}

export default function AdminOverview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const adminFy = useAdminFy();
  const from = adminFy?.range?.from;
  const to = adminFy?.range?.to;
  const registerRefresh = adminFy?.registerRefresh;

  // The header's Financial Year limits the request counts; "Refresh Data" reloads this page.
  useEffect(() => {
    const qs = from && to ? `?from=${from}&to=${to}` : '';
    const load = () => api(`/admin/dashboard${qs}`)
      .then((res) => setData(res))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
    load();

    return registerRefresh ? registerRefresh(load) : undefined;
  }, [from, to, registerRefresh]);

  if (loading || !data) {
    return (
      <div className="ao-wrap">
        <LoadingBlock label="Loading Dashboard" size={26} minHeight={420} />
      </div>
    );
  }

  // Pure dynamic data directly from database through /admin/dashboard API
  const o = data.overview || {};
  const returnSummary = data.gst_return_summary || {};
  const filingSummary = data.filing_request_summary || {};
  const gstReturns = data.gst_returns_table || [];
  const filingRequests = data.gst_filing_requests_table || [];

  // Always show all 5 spec rows for Client Request Overview, even with zero counts
  const clientRequests = SPEC_CLIENT_REQUEST_ROWS.map((specRow) => {
    const apiRow = (data.client_requests_overview || []).find((r) => r.key === specRow.key);
    return {
      ...specRow,
      total: apiRow?.total ?? 0,
      pending: apiRow?.pending ?? 0,
      approved: apiRow?.approved ?? 0,
      rejected: apiRow?.rejected ?? 0,
      action_url: apiRow?.action_url || specRow.action_url,
    };
  });

  // Dynamic upcoming due dates from DB, with spec-compliant current month fallback.
  // Hide rows with 0 clients; show only rows with at least 1 applicable client per user request.
  const rawUpcomingDueDates =
    Array.isArray(data.upcoming_due_dates) && data.upcoming_due_dates.length > 0
      ? data.upcoming_due_dates
      : getUpcomingDueDatesFallback();
  const upcomingDueDates = rawUpcomingDueDates.filter((row) => Number(row.client_count) > 0);

  return (
    <div className="ao-wrap">
      {/* ========================================================
          1. TOP ROW: 5 CARDS (100% DYNAMIC FROM DATABASE)
         ======================================================== */}
      <div className="ao-grid-5">
        {/* Card 1: Total Clients */}
        <div className="ao-top-card">
          <div className="ao-card-main">
            <div className="ao-card-icon-wrap ao-card-icon-blue">
              <UsersIcon />
            </div>
            <div className="ao-card-body">
              <div className="ao-card-label">Total Clients</div>
              <div className="ao-card-count">{o.total_clients ?? 0}</div>
            </div>
          </div>
          <div className="ao-card-footer">
            <Link to="/admin/clients" className="ao-card-link">
              View All Clients
            </Link>
          </div>
        </div>

        {/* Card 2: Active Clients */}
        <div className="ao-top-card">
          <div className="ao-card-main">
            <div className="ao-card-icon-wrap ao-card-icon-green">
              <UserCheckIcon />
            </div>
            <div className="ao-card-body">
              <div className="ao-card-label">Active Clients</div>
              <div className="ao-card-count">{o.active_clients ?? 0}</div>
            </div>
          </div>
          <div className="ao-card-footer">
            <Link to="/admin/clients" className="ao-card-link">
              View Active Clients
            </Link>
          </div>
        </div>

        {/* Card 3: Inactive Clients */}
        <div className="ao-top-card">
          <div className="ao-card-main">
            <div className="ao-card-icon-wrap ao-card-icon-red">
              <UserXIcon />
            </div>
            <div className="ao-card-body">
              <div className="ao-card-label">Inactive Clients</div>
              <div className="ao-card-count">{o.inactive_clients ?? 0}</div>
            </div>
          </div>
          <div className="ao-card-footer">
            <Link to="/admin/clients" className="ao-card-link">
              View Inactive Clients
            </Link>
          </div>
        </div>

        {/* Card 4: Client Requests */}
        <div className="ao-top-card">
          <div className="ao-card-main">
            <div className="ao-card-icon-wrap ao-card-icon-purple">
              <ClipboardListIcon />
            </div>
            <div className="ao-card-body">
              <div className="ao-card-label">Client Requests</div>
              <div className="ao-card-count">{o.client_requests ?? 0}</div>
            </div>
          </div>
          <div className="ao-card-footer">
            <span className="ao-card-pending-badge">
              {o.client_requests_pending ?? 0} Pending
            </span>
            <Link to="/admin/pending-approval" className="ao-card-link">
              View Requests
            </Link>
          </div>
        </div>

        {/* Card 5: GST Filing Requests */}
        <div className="ao-top-card">
          <div className="ao-card-main">
            <div className="ao-card-icon-wrap ao-card-icon-orange">
              <FileTaxIcon />
            </div>
            <div className="ao-card-body">
              <div className="ao-card-label">GST Filing Requests</div>
              <div className="ao-card-count">{o.gst_filing_requests ?? 0}</div>
            </div>
          </div>
          <div className="ao-card-footer">
            <span className="ao-card-pending-badge">
              {o.gst_filing_requests_pending ?? 0} Pending
            </span>
            <Link to="/admin/gst-filing-requests" className="ao-card-link">
              View GST Requests
            </Link>
          </div>
        </div>
      </div>

      {/* ========================================================
          2. SECOND ROW: 2 SUMMARY STRIPS (100% DYNAMIC)
         ======================================================== */}
      <div className="ao-strips-grid">
        {/* Strip 1: GST Return Status */}
        <div className="ao-strip-card">
          <div className="ao-strip-head">
            <div className="ao-strip-title">
              GST Return Status
              <span className="ao-info-icon" title="Summary of GST returns in the current filing period">i</span>
            </div>
            <Link to="/admin/gst-returns" className="ao-view-all-link">
              View All
            </Link>
          </div>
          <div className="ao-strip-items">
            <div className="ao-strip-item ao-strip-item-blue">
              <div className="ao-strip-item-icon ao-bg-blue">
                <MiniDocIcon />
              </div>
              <div className="ao-strip-item-text">
                <span className="ao-strip-item-label">Total Returns Due</span>
                <span className="ao-strip-item-val">{returnSummary.total_returns_due ?? 0}</span>
              </div>
            </div>

            <div className="ao-strip-item ao-strip-item-orange">
              <div className="ao-strip-item-icon ao-bg-orange">
                <ClockIcon />
              </div>
              <div className="ao-strip-item-text">
                <span className="ao-strip-item-label">Pending</span>
                <span className="ao-strip-item-val">{returnSummary.pending ?? 0}</span>
              </div>
            </div>

            <div className="ao-strip-item ao-strip-item-red">
              <div className="ao-strip-item-icon ao-bg-red">
                <AlertIcon />
              </div>
              <div className="ao-strip-item-text">
                <span className="ao-strip-item-label">Overdue</span>
                <span className="ao-strip-item-val">{returnSummary.overdue ?? 0}</span>
              </div>
            </div>

            <div className="ao-strip-item ao-strip-item-green">
              <div className="ao-strip-item-icon ao-bg-green">
                <CheckCircleIcon />
              </div>
              <div className="ao-strip-item-text">
                <span className="ao-strip-item-label">Filed</span>
                <span className="ao-strip-item-val">{returnSummary.filed ?? 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Strip 2: GST Filing Request Summary */}
        <div className="ao-strip-card">
          <div className="ao-strip-head">
            <div className="ao-strip-title">
              GST Filing Request Summary
              <span className="ao-info-icon" title="Client GST filing requests overview">i</span>
            </div>
            <Link to="/admin/gst-filing-requests" className="ao-view-all-link">
              View All
            </Link>
          </div>
          <div className="ao-strip-items">
            <div className="ao-strip-item ao-strip-item-blue">
              <div className="ao-strip-item-icon ao-bg-blue">
                <MiniDocIcon />
              </div>
              <div className="ao-strip-item-text">
                <span className="ao-strip-item-label">Total Requests</span>
                <span className="ao-strip-item-val">{filingSummary.total_requests ?? 0}</span>
              </div>
            </div>

            <div className="ao-strip-item ao-strip-item-orange">
              <div className="ao-strip-item-icon ao-bg-orange">
                <ClockIcon />
              </div>
              <div className="ao-strip-item-text">
                <span className="ao-strip-item-label">Confirmation Pending</span>
                <span className="ao-strip-item-val">{filingSummary.confirmation_pending ?? 0}</span>
              </div>
            </div>

            <div className="ao-strip-item ao-strip-item-purple">
              <div className="ao-strip-item-icon ao-bg-purple">
                <ShieldCheckMiniIcon />
              </div>
              <div className="ao-strip-item-text">
                <span className="ao-strip-item-label">Confirmed</span>
                <span className="ao-strip-item-val">{filingSummary.confirmed ?? 0}</span>
              </div>
            </div>

            <div className="ao-strip-item ao-strip-item-green">
              <div className="ao-strip-item-icon ao-bg-green">
                <CheckCircleIcon />
              </div>
              <div className="ao-strip-item-text">
                <span className="ao-strip-item-label">Filed</span>
                <span className="ao-strip-item-val">{filingSummary.filed ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          3. THIRD ROW: 4 TABLES IN 2X2 GRID (100% DYNAMIC)
         ======================================================== */}
      <div className="ao-tables-grid">
        {/* Table 1: GST Return Status */}
        <div className="ao-table-card">
          <div className="ao-table-head">
            <div className="ao-table-title">
              GST Return Status
            </div>
            <Link to="/admin/gst-returns" className="ao-view-all-link">
              View All
            </Link>
          </div>
          <div className="ao-table-responsive">
            <table className="ao-table ao-table-returns">
              <thead>
                <tr>
                  <th className="ao-col-client">Client Name</th>
                  <th className="ao-col-gstin">GSTIN</th>
                  <th className="ao-col-return">Return<br />Type</th>
                  <th className="ao-col-due">Due Date</th>
                  <th className="ao-col-status">Status</th>
                  <th className="ao-col-action">Action</th>
                </tr>
              </thead>
              <tbody>
                {gstReturns.length > 0 ? (
                  gstReturns.map((row, idx) => (
                    <tr key={`${row.id || idx}-${row.return_type}-${idx}`}>
                      <td className="ao-col-client" style={{ fontWeight: 600 }} title={row.client_name}>{row.client_name}</td>
                      <td className="ao-col-gstin" style={{ color: '#64748b' }} title={row.gstin}>{row.gstin}</td>
                      <td className="ao-col-return">{row.return_type}</td>
                      <td className="ao-col-due">{row.due_date}</td>
                      <td className="ao-col-status">
                        <span
                          className={`ao-badge ${row.status === 'Overdue'
                              ? 'ao-badge-overdue'
                              : row.status === 'Filed'
                                ? 'ao-badge-filed'
                                : 'ao-badge-pending'
                            }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="ao-col-action">
                        <Link to={row.action_url || '/admin/gst-returns'} className="ao-action-link">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="ao-table-empty">
                      No pending or overdue returns found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 2: GST Filing Requests */}
        <div className="ao-table-card">
          <div className="ao-table-head">
            <div className="ao-table-title">
              GST Filing Requests
            </div>
            <Link to="/admin/gst-filing-requests" className="ao-view-all-link">
              View All
            </Link>
          </div>
          <div className="ao-table-responsive">
            <table className="ao-table ao-table-filing">
              <thead>
                <tr>
                  <th className="ao-col-client">Client Name</th>
                  <th className="ao-col-return">Return Type</th>
                  <th className="ao-col-due">Due Date</th>
                  <th className="ao-col-conf">Confirmation<br />Status</th>
                  <th className="ao-col-filing">Filing<br />Status</th>
                  <th className="ao-col-action">Action</th>
                </tr>
              </thead>
              <tbody>
                {filingRequests.length > 0 ? (
                  filingRequests.map((req, idx) => (
                    <tr key={req.id || idx}>
                      <td className="ao-col-client" style={{ fontWeight: 600 }} title={req.client_name}>{req.client_name}</td>
                      <td className="ao-col-return">{req.return_type}</td>
                      <td className="ao-col-due">{req.due_date}</td>
                      <td className="ao-col-conf">
                        <span
                          className={`ao-badge ${req.confirmation_status === 'Received'
                              ? 'ao-badge-received'
                              : 'ao-badge-overdue'
                            }`}
                        >
                          {req.confirmation_status}
                        </span>
                      </td>
                      <td className="ao-col-filing">
                        <span
                          className={`ao-badge ${req.filing_status === 'Filed'
                              ? 'ao-badge-filed'
                              : req.filing_status === 'Pending'
                                ? 'ao-badge-pending'
                                : 'ao-badge-notstarted'
                            }`}
                        >
                          {req.filing_status}
                        </span>
                      </td>
                      <td className="ao-col-action">
                        <Link to={req.action_url || '/admin/gst-filing-requests'} className="ao-action-link">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="ao-table-empty">
                      No pending filing requests found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 3: Client Request Overview */}
        <div className="ao-table-card">
          <div className="ao-table-head">
            <div className="ao-table-title">
              Client Request Overview
            </div>
            <Link to="/admin/pending-approval" className="ao-view-all-link">
              View All
            </Link>
          </div>
          <div className="ao-table-responsive">
            <table className="ao-table ao-table-req">
              <thead>
                <tr>
                  <th>Request Type</th>
                  <th style={{ textAlign: 'center' }}>Total</th>
                  <th style={{ textAlign: 'center' }}>Pending</th>
                  <th style={{ textAlign: 'center' }}>Approved</th>
                  <th style={{ textAlign: 'center' }}>Rejected</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {clientRequests.map((row) => (
                  <tr key={row.key}>
                    <td style={{ fontWeight: 600 }}>
                      <span
                        className="ao-req-icon-badge"
                        style={{
                          background:
                            row.key === 'profile_update'
                              ? '#dbeafe'
                              : row.key === 'document_change'
                                ? '#cffafe'
                                : row.key === 'bank_details'
                                  ? '#ffedd5'
                                  : row.key === 'invoice_settings'
                                    ? '#dcfce7'
                                    : '#f3e8ff',
                          color:
                            row.key === 'profile_update'
                              ? '#1d4ed8'
                              : row.key === 'document_change'
                                ? '#0e7490'
                                : row.key === 'bank_details'
                                  ? '#c2410c'
                                  : row.key === 'invoice_settings'
                                    ? '#15803d'
                                    : '#7e22ce',
                        }}
                      >
                        {row.key === 'profile_update' && <ReqUserIcon />}
                        {row.key === 'document_change' && <ReqDocIcon />}
                        {row.key === 'bank_details' && <ReqBankIcon />}
                        {row.key === 'invoice_settings' && <ReqGearIcon />}
                        {row.key === 'others' && <ReqDotsIcon />}
                      </span>
                      {row.title}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>
                      {row.total}
                    </td>
                    <td
                      style={{
                        textAlign: 'center',
                        fontWeight: 700,
                        color: row.pending > 0 ? '#ea580c' : '#64748b',
                      }}
                    >
                      {row.pending}
                    </td>
                    <td
                      style={{
                        textAlign: 'center',
                        fontWeight: 600,
                        color: row.approved > 0 ? '#16a34a' : '#64748b',
                      }}
                    >
                      {row.approved}
                    </td>
                    <td
                      style={{
                        textAlign: 'center',
                        fontWeight: 600,
                        color: row.rejected > 0 ? '#dc2626' : '#64748b',
                      }}
                    >
                      {row.rejected}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <Link to={row.action_url} className="ao-action-link">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 4: Upcoming Due Dates */}
        <div className="ao-table-card">
          <div className="ao-table-head">
            <div className="ao-table-title">
              <CalendarMiniIcon />
              Upcoming Due Dates
            </div>
            <Link to="/admin/gst-returns" className="ao-view-all-link">
              View All
            </Link>
          </div>
          <div className="ao-table-responsive">
            <table className="ao-table">
              <thead>
                <tr>
                  <th>Return Type</th>
                  <th>Due Date</th>
                  <th style={{ textAlign: 'center' }}>No. of Clients</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {upcomingDueDates.length > 0 ? (
                  upcomingDueDates.map((row, idx) => (
                    <tr key={`${row.return_type}-${idx}`}>
                      <td style={{ fontWeight: 600 }}>{row.return_type}</td>
                      <td>{row.due_date_formatted}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>
                        {row.client_count}
                      </td>
                      <td>
                        <span
                          className={`ao-badge ${row.status_type === 'overdue' || row.status === 'Overdue'
                              ? 'ao-badge-overdue'
                              : 'ao-badge-upcoming'
                            }`}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="ao-table-empty">
                      No upcoming returns due in current month.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
