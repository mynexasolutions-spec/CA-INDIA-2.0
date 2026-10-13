import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Navigate, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../api/client';
import { LoadingBlock } from '../Spinner';
import BillingSubNav from '../../pages/billing/BillingSubNav';
import ReportsSubNav from '../../pages/billing/ReportsSubNav';
import { billingMode } from '../../pages/billing/billingProfile';
import { buildFyOptions, currentFyLabel, currentFyRange, fyDateRange } from '../../pages/billing/billingUtils';
import { useAdminFy } from '../../context/AdminFyContext';
import { CONTACT } from '../../data/nav';
import '../../pages/billing/billing.css';
import '../../pages/billing/admin-overview.css';

function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 10, flexShrink: 0 }}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 10, flexShrink: 0 }}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function InvoiceIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 10, flexShrink: 0 }}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 10, flexShrink: 0 }}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 11 2 2 4-4" />
    </svg>
  );
}

/** Quotation is its own workflow, distinct from Billing (spec: "Quotation — Navigation
 * & Tab Behavior") — a quote/estimate icon, not the invoice document icon. */
function QuoteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 10, flexShrink: 0 }}>
      <path d="M7 8h1a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3c0 3-1 4-2 5" />
      <path d="M17 8h1a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-3a2 2 0 0 0-2 2v3c0 3-1 4-2 5" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 10, flexShrink: 0 }}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 10, flexShrink: 0 }}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="9" y1="9" x2="15" y2="9" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="13" y2="17" />
      <polyline points="7 9 7.01 9 7 13 7.01 13 7 17 7.01 17" />
    </svg>
  );
}

function RequestIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 10, flexShrink: 0 }}>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M9 12h6" />
      <path d="M9 16h6" />
    </svg>
  );
}

function NavGearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 10, flexShrink: 0 }}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.96 19a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.96a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06-.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1.04-1.56V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06-.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.56 1.04H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z" />
    </svg>
  );
}

/** Financial Year + Refresh Data are global controls, shared by every Client Portal page via
 * this context (provided by ClientPortalLayout, rendered in the shared topbar) — not owned by
 * any single page. A page that has its own data to refresh calls registerRefresh(fn) in a
 * useEffect; pages that don't just leave the button to fall back to a full reload. */
const ClientPortalCtx = createContext(null);

export function useClientPortal() {
  return useContext(ClientPortalCtx);
}

const ADMIN_BILLING_NAV = [
  { to: '/admin/firm-billing', label: 'Dashboard', end: true },
  { to: '/admin/firm-billing/invoices', label: 'Tax Invoice' },
  { to: '/admin/firm-billing/debit-notes', label: 'Debit Notes' },
  { to: '/admin/firm-billing/credit-notes', label: 'Credit Notes' },
  { to: '/admin/firm-billing/reports', label: 'Reports' },
  { to: '/admin/firm-billing/gst-summary', label: 'GST Summary' },
  { to: '/admin/firm-billing/hsn-summary', label: 'HSN Summary' },
];

/** A nav item is either a flat link {to, label, end?, isActive?} or a group {label, children:[...]}. */
function isItemActive(item, location) {
  if (item.isActive) return item.isActive(null, location);
  if (item.end) return location.pathname === item.to;
  return location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
}

function NavGroup({ item, location, closeSidebar }) {
  const hasActiveChild = item.children.some((c) => isItemActive(c, location));
  const [open, setOpen] = useState(hasActiveChild);

  useEffect(() => {
    if (hasActiveChild) setOpen(true);
  }, [hasActiveChild]);

  return (
    <div className={`bp-nav-group${open ? ' open' : ''}`}>
      <button
        type="button"
        className={`bp-nav-group-header${hasActiveChild ? ' has-active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}
      >
        <span style={{ display: 'flex', alignItems: 'center' }}>
          {item.icon && <item.icon />}
          {item.label}
          {item.locked && (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 6, flexShrink: 0 }}>
              <rect x="4" y="10" width="16" height="10" rx="2" />
              <path d="M7 10V7a5 5 0 0 1 10 0v3" />
            </svg>
          )}
        </span>
        <span className="bp-nav-chevron" style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-flex', alignItems: 'center' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>
      <div className="bp-nav-children">
        {item.children.map((child) => (
          <Link
            key={child.to}
            to={child.to}
            className={isItemActive(child, location) ? 'active' : undefined}
            onClick={closeSidebar}
          >
            <span className="bp-sub-tree">
              <span className="bp-sub-line" />
              <span className="bp-sub-dot" />
            </span>
            <span className="bp-sub-text">{child.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function useOutsideClose(onClose) {
  const ref = useRef(null);
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);
  return ref;
}

function timeAgo(iso) {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

/** Bell icon with unread badge; polls the client dashboard notifications feed. */
export function ClientNotificationBell() {
  const [open, setOpen] = useState(false);
  const [notices, setNotices] = useState(null);
  const [unread, setUnread] = useState(0);
  const ref = useOutsideClose(() => setOpen(false));

  const load = () => {
    api('/client/dashboard')
      .then((d) => {
        setNotices(d.notifications || []);
        setUnread(d.stats?.unread_notifications ?? 0);
      })
      .catch(() => {});
  };

  useEffect(() => {
    load();
    const t = window.setInterval(load, 30000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className="bp-dropdown-wrap" ref={ref}>
      <button type="button" className="bp-topbar-icon-btn" onClick={() => setOpen((v) => !v)} aria-label="Notifications">
        🔔
        {unread > 0 && <span className="bp-topbar-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="bp-dropdown-panel">
          <div className="bp-dropdown-panel-head">Notifications</div>
          {!notices || notices.length === 0 ? (
            <div className="bp-dropdown-empty">You're all caught up.</div>
          ) : (
            notices.slice(0, 8).map((n) => (
              <div key={n.id} className="bp-dropdown-item" style={{ opacity: n.read_at ? 0.65 : 1 }}>
                <div style={{ fontWeight: 700 }}>{n.title}</div>
                {n.body && <div style={{ color: 'var(--bp-muted)', marginTop: 2 }}>{n.body}</div>}
                <div style={{ color: 'var(--bp-muted)', fontSize: 11, marginTop: 4 }}>{timeAgo(n.created_at)}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function initialsOf(name) {
  const words = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  return words.slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}

const ICON_PROPS = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };

function ProfileIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" />
    </svg>
  );
}
function CalendarIcon({ size = 20 }) {
  return (
    <svg {...ICON_PROPS} width={size} height={size}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
function GearIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.96 19a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.96a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1.04-1.56V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.56 1.04H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z" />
    </svg>
  );
}
function ExitIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

/** Confirmation modal shown before actually signing out. */
function LogoutConfirmModal({ onCancel, onConfirm, busy }) {
  return (
    <div className="bp-modal-backdrop" role="presentation" onClick={onCancel}>
      <div className="bp-modal" role="dialog" aria-modal="true" aria-label="Logout Confirmation" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="bp-modal-close" onClick={onCancel} disabled={busy} aria-label="Close">×</button>
        <div className="bp-modal-icon"><ExitIcon /></div>
        <p className="bp-modal-title">Logout Confirmation</p>
        <p className="bp-modal-text">
          Are you sure you want to logout?
          <br />
          You will be signed out from your account and redirected to the login page.
        </p>
        <div className="bp-modal-actions">
          <button type="button" className="bp-btn bp-btn-outline" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="bp-btn bp-btn-danger" onClick={onConfirm} disabled={busy}>
            {busy ? 'Signing out…' : 'Logout'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Avatar + name button revealing Profile / Change Password / Settings / Logout. */
export function ClientAvatarMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const ref = useOutsideClose(() => setOpen(false));
  const name = user?.client_profile?.business_name || user?.name || 'Client';

  const doLogout = async () => {
    setLoggingOut(true);
    await logout();
    navigate('/login');
  };

  return (
    <>
      <div className="bp-dropdown-wrap" ref={ref}>
        <button type="button" className="bp-avatar-btn" onClick={() => setOpen((v) => !v)}>
          <span className="bp-avatar-circle">{initialsOf(user?.name)}</span>
          <span className="bp-avatar-name">{name}</span>
          <span style={{ fontSize: 10, opacity: 0.6 }}>▾</span>
        </button>
        {open && (
          <div className="bp-dropdown-panel" style={{ minWidth: 230 }}>
            <Link to="/portal/profile" className="bp-dropdown-row" onClick={() => setOpen(false)}>
              <span className="bp-dropdown-row-icon"><ProfileIcon /></span>
              <span>
                <span className="bp-dropdown-row-title">Profile</span>
                <span className="bp-dropdown-row-sub">Business Profile</span>
              </span>
            </Link>
            <Link to="/portal/profile/reset-password" className="bp-dropdown-row" onClick={() => setOpen(false)}>
              <span className="bp-dropdown-row-icon"><LockIcon /></span>
              <span>
                <span className="bp-dropdown-row-title">Change Password</span>
                <span className="bp-dropdown-row-sub">Update your password</span>
              </span>
            </Link>
            <Link to="/portal/settings" className="bp-dropdown-row" onClick={() => setOpen(false)}>
              <span className="bp-dropdown-row-icon"><GearIcon /></span>
              <span>
                <span className="bp-dropdown-row-title">Settings</span>
                <span className="bp-dropdown-row-sub">Billing &amp; Invoice Settings</span>
              </span>
            </Link>
            <button
              type="button"
              className="bp-dropdown-row danger"
              onClick={() => { setOpen(false); setConfirmingLogout(true); }}
            >
              <span className="bp-dropdown-row-icon"><ExitIcon /></span>
              <span>
                <span className="bp-dropdown-row-title">Logout</span>
                <span className="bp-dropdown-row-sub">Sign out from your account</span>
              </span>
            </button>
          </div>
        )}
      </div>
      {confirmingLogout && (
        <LogoutConfirmModal
          busy={loggingOut}
          onCancel={() => setConfirmingLogout(false)}
          onConfirm={doLogout}
        />
      )}
    </>
  );
}

function HeadsetIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Z" />
      <path d="M16 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-5Z" />
      <path d="M3 14c0-4.97 4.03-9 9-9s9 4.03 9 9" />
      <path d="M21 14v1a1 1 0 0 1-1 1h-1" />
    </svg>
  );
}

/** Small modal opened from the sidebar's Contact Support button — shows the support
 * mobile number and email with one-tap "Call Now" / "Send Email" actions. */
function ContactSupportModal({ onClose }) {
  return (
    <div className="bp-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="bp-modal bp-contact-modal" role="dialog" aria-modal="true" aria-label="Contact Support" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="bp-modal-close" onClick={onClose} aria-label="Close">×</button>
        <div className="bp-contact-modal-icon"><HeadsetIcon /></div>
        <p className="bp-modal-title">Contact Support</p>
        <p className="bp-contact-modal-text">
          We're here to help you with any queries. Reach out to us through any of the following:
        </p>
        <div className="bp-contact-modal-rows">
          <div className="bp-contact-modal-row">
            <span className="bp-contact-modal-row-icon phone">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </span>
            <span className="bp-contact-modal-row-info">
              <p className="bp-contact-modal-row-label">Mobile</p>
              <p className="bp-contact-modal-row-value">{CONTACT.phone}</p>
            </span>
            <a href={CONTACT.phoneHref} className="bp-contact-modal-row-action phone">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              Call Now
            </a>
          </div>
          <div className="bp-contact-modal-row">
            <span className="bp-contact-modal-row-icon email">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-10 5L2 7" />
              </svg>
            </span>
            <span className="bp-contact-modal-row-info">
              <p className="bp-contact-modal-row-label">Email</p>
              <p className="bp-contact-modal-row-value">{CONTACT.email}</p>
            </span>
            <a href={CONTACT.emailHref} className="bp-contact-modal-row-action email">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-10 5L2 7" />
              </svg>
              Send Email
            </a>
          </div>
        </div>
        <p className="bp-contact-modal-footer">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          We typically respond within 24 hours.
        </p>
      </div>
    </div>
  );
}

/** "Need Help?" card pinned to the bottom of the Client Portal sidebar. */
function NeedHelpCard() {
  const [showContact, setShowContact] = useState(false);
  return (
    <div className="bp-help-card">
      <div className="bp-help-icon">
        <HeadsetIcon />
      </div>
      <p className="bp-help-title">Need Help?</p>
      <p className="bp-help-text">We're here to help you with any queries.</p>
      <button type="button" className="bp-help-btn" onClick={() => setShowContact(true)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        Contact Support
        <span className="bp-help-arrow" aria-hidden="true" style={{ marginLeft: 'auto', fontWeight: 'bold' }}>&rsaquo;</span>
      </button>
      {showContact && <ContactSupportModal onClose={() => setShowContact(false)} />}
    </div>
  );
}

export function RequireAuth({ roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="section container"><LoadingBlock /></div>;
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (roles && !roles.includes(user.role)) {
    if (['super_admin', 'admin', 'staff'].includes(user.role)) return <Navigate to="/admin" replace />;
    return <Navigate to="/portal" replace />;
  }
  return <Outlet />;
}

function PortalFrame({
  brand, subtitle, title, userLabel, nav, loginPath, extraTopRight, footLinks = [],
  shellClassName = '', headerContent, rightContent, sidebarFoot, logoClickable = true,
}) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const closeSidebar = () => setOpen(false);

  return (
    <div className={`bp-shell ${shellClassName}`.trim()}>
      {open && <div className="bp-backdrop" role="presentation" onClick={() => setOpen(false)} />}
      <aside className={`bp-sidebar ${open ? 'open' : ''}`}>
        <div className="bp-brand">
          {logoClickable ? (
            <Link to="/" className="bp-brand-link" title="A B Khan & Associates">
              <img src="/assets/ca-india-logo.png" alt="A B Khan & Associates" className="bp-brand-logo" />
              <span className="bp-brand-text">
                <strong className="bp-brand-name">A B KHAN & ASSOCIATES</strong>
                <span className="bp-brand-tagline">Chartered Accountants</span>
              </span>
            </Link>
          ) : (
            <div className="bp-brand-link" style={{ cursor: 'default', userSelect: 'none' }} title="A B Khan & Associates">
              <img src="/assets/ca-india-logo.png" alt="A B Khan & Associates" className="bp-brand-logo" />
              <span className="bp-brand-text">
                <strong className="bp-brand-name">A B KHAN & ASSOCIATES</strong>
                <span className="bp-brand-tagline">Chartered Accountants</span>
              </span>
            </div>
          )}
          {brand ? <div className="bp-brand-portal">{brand}</div> : null}
          {subtitle ? <div className="bp-brand-sub">{subtitle}</div> : null}
        </div>
        <nav className="bp-nav">
          {nav.map((item) =>
            item.children ? (
              <NavGroup key={item.label} item={item} location={location} closeSidebar={closeSidebar} />
            ) : (
              <Link
                key={item.to}
                to={item.to}
                className={isItemActive(item, location) ? 'active' : undefined}
                onClick={closeSidebar}
                style={{ display: 'flex', alignItems: 'center' }}
              >
                {item.icon && <item.icon />}
                {item.label}
              </Link>
            )
          )}
        </nav>
        {sidebarFoot}
        {footLinks.length > 0 && (
          <div className="bp-sidebar-foot">
            {footLinks.map((link) => (
              <Link key={link.to} to={link.to} className="bp-btn bp-btn-outline bp-back-site">{link.label}</Link>
            ))}
          </div>
        )}
      </aside>
      <div className="bp-main">
        <header className="bp-topbar">
          <div className="bp-topbar-left" style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            <button type="button" className="bp-mobile-toggle" onClick={() => setOpen((v) => !v)} aria-label="Open menu">☰</button>
            {headerContent || (
              <div>
                <h1>{title}</h1>
                <div style={{ fontSize: 12, color: 'var(--bp-muted)' }}>{userLabel}</div>
              </div>
            )}
          </div>
          <div className="bp-topbar-right">
            {rightContent || (
              <>
                {extraTopRight}
                <button type="button" className="bp-btn bp-btn-outline bp-logout-btn" onClick={async () => { await logout(); navigate(loginPath); }}>
                  Logout
                </button>
              </>
            )}
          </div>
        </header>
        <div className="bp-content"><Outlet /></div>
      </div>
    </div>
  );
}

/** GST-registration label shown under the "Client Portal" header title. */
function gstModeLabel(profile) {
  const mode = billingMode(profile);
  if (mode === 'retail') return 'Non-GST';
  if (mode === 'composition') return 'Composition Scheme';
  return profile?.gst_filing_frequency === 'quarterly' ? 'Regular (Quarterly)' : 'Regular (Monthly)';
}

/** Title + GSTIN badge — the left side of the shared topbar, same spot as before. */
function ClientTopbarHeader() {
  const { user } = useAuth();
  const profile = user?.client_profile;
  const name = profile?.business_name || user?.name || 'Client';

  return (
    <div className="bp-topbar-title-block" style={{ minWidth: 0 }}>
      <h1 className="bp-topbar-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Client Portal</h1>
      <div className="bp-topbar-subtitle" style={{ fontSize: 12, color: 'var(--bp-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={`${name} · (${gstModeLabel(profile)})`}>
        {name} <span style={{ opacity: 0.5 }}>·</span> ({gstModeLabel(profile)})
      </div>
      {profile?.has_gst && profile?.gstin && (
        <span style={{ display: 'inline-block', marginTop: 6, background: '#dcfce7', color: '#15803d', fontSize: 10, fontWeight: 800, padding: '4px 12px', borderRadius: 20, letterSpacing: 0.3, whiteSpace: 'nowrap' }}>
          GSTIN: {profile.gstin}
        </span>
      )}
    </div>
  );
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2026-04-01" -> "01 Apr 2026" */
function ddMonYyyy(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d} ${SHORT_MONTHS[Number(m) - 1]} ${y}`;
}

/** Financial Year selector + Refresh Data — right side of the shared topbar, ahead of the
 * notification bell and avatar menu, same spot they occupied on the Dashboard before this
 * became a global control. Reads FY state from ClientPortalCtx. */
function ClientTopbarControls() {
  const ctx = useClientPortal();
  if (!ctx) return null;

  return (
    <>
      <span className="bp-fy-label" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, color: 'var(--bp-text)', fontWeight: 700, whiteSpace: 'nowrap' }}>
        <CalendarIcon size={22} />
        Financial Year
      </span>
      <div className="bp-fy-select-box" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 52, boxSizing: 'border-box', border: '1px solid var(--bp-border)', borderRadius: 8, padding: '0 14px', lineHeight: 1.3 }}>
        <select
          className="bp-select"
          style={{ border: 'none', padding: 0, fontWeight: 800, fontSize: 15, color: 'var(--bp-navy)', background: 'transparent', height: 'auto', textAlign: 'center' }}
          value={ctx.fy}
          onChange={(e) => ctx.setFy(e.target.value)}
        >
          {ctx.fyOptions.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <span style={{ fontSize: 10, color: 'var(--bp-muted)', whiteSpace: 'nowrap' }} className="bp-fy-dates">
          {ddMonYyyy(ctx.range.from)} - {ddMonYyyy(ctx.range.to)}
        </span>
      </div>
      <button
        type="button"
        className="bp-btn bp-btn-outline bp-refresh-btn"
        style={{ height: 52, boxSizing: 'border-box', padding: '0 14px', fontSize: 12, whiteSpace: 'nowrap' }}
        onClick={ctx.triggerRefresh}
        disabled={ctx.refreshing}
      >
        {ctx.refreshing ? (
          'Refreshing…'
        ) : (
          <>
            <span className="bp-refresh-text">↻ Refresh Data</span>
            <span className="bp-refresh-icon-only">↻</span>
          </>
        )}
      </button>
    </>
  );
}

function ClockIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function RefreshIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function AdminTopbarHeader() {
  return (
    <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1e3a8a', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
      Welcome Back to the Admin Portal
    </h1>
  );
}

function formatLastLogin(iso) {
  const d = iso ? new Date(iso) : new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  let hours = d.getHours();
  const mins = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const strHours = String(hours).padStart(2, '0');
  return `${day} ${month} ${year}, ${strHours}:${mins} ${ampm}`;
}

function AdminTopbarControls() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const adminFy = useAdminFy();
  const fy = adminFy?.fy ?? currentFyLabel();
  const setFy = adminFy?.setFy ?? (() => {});
  const fyOptions = adminFy?.fyOptions ?? buildFyOptions();
  const range = adminFy?.range ?? fyDateRange(fy);
  const refreshing = adminFy?.refreshing ?? false;
  const triggerRefresh = adminFy?.triggerRefresh;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      {/* Financial Year Selector */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '6px 14px',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          background: '#fff',
        }}
      >
        <span style={{ color: '#2563eb', display: 'flex', alignItems: 'center' }}>
          <CalendarIcon size={20} />
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
          <span style={{ fontSize: 10, color: '#64748b' }}>Financial Year</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <select
              value={fy}
              onChange={(e) => setFy(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                fontWeight: 700,
                fontSize: 13,
                color: '#0f172a',
                cursor: 'pointer',
                padding: 0,
                outline: 'none',
              }}
            >
              {fyOptions.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#64748b', pointerEvents: 'none' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
          <span style={{ fontSize: 10, color: '#94a3b8', whiteSpace: 'nowrap' }}>
            {ddMonYyyy(range.from)} - {ddMonYyyy(range.to)}
          </span>
        </div>
      </div>

      {/* Refresh Data Button */}
      <button
        type="button"
        onClick={() => {
          if (triggerRefresh) {
            triggerRefresh();
          }
        }}
        disabled={refreshing}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 16px',
          border: '1px solid #bfdbfe',
          borderRadius: 8,
          background: '#fff',
          color: '#2563eb',
          fontWeight: 600,
          fontSize: 13,
          cursor: refreshing ? 'default' : 'pointer',
          whiteSpace: 'nowrap',
          transition: 'all 0.15s ease',
          opacity: refreshing ? 0.7 : 1,
        }}
      >
        <RefreshIcon size={15} />
        {refreshing ? 'Refreshing…' : 'Refresh Data'}
      </button>

      {/* Last Login */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#475569' }}>
        <ClockIcon size={18} />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
          <span style={{ fontSize: 10, color: '#64748b' }}>Last Login</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>
            {formatLastLogin(user?.last_login_at)}
          </span>
        </div>
      </div>

      {/* Notification Bell with red dot */}
      <div
        title="Notifications"
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 38,
          height: 38,
          borderRadius: '50%',
          border: '1px solid #e2e8f0',
          background: '#fff',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        <span style={{ position: 'absolute', top: 8, right: 8, width: 7, height: 7, borderRadius: '50%', background: '#ef4444' }} />
      </div>

      {/* Logout (power icon) */}
      <button
        type="button"
        title="Logout"
        aria-label="Logout"
        onClick={() => setConfirmingLogout(true)}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.borderColor = '#fca5a5'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 38,
          height: 38,
          borderRadius: '50%',
          border: '1px solid #e2e8f0',
          background: '#fff',
          color: '#ef4444',
          cursor: 'pointer',
          flexShrink: 0,
          padding: 0,
          transition: 'all 0.15s ease',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v10" />
          <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
        </svg>
      </button>

      {confirmingLogout && (
        <LogoutConfirmModal
          busy={loggingOut}
          onCancel={() => setConfirmingLogout(false)}
          onConfirm={async () => {
            setLoggingOut(true);
            await logout();
            navigate('/login');
          }}
        />
      )}
    </div>
  );
}

export function ClientPortalLayout() {
  const { user } = useAuth();
  const profile = user?.client_profile;
  const hasGst = Boolean(profile?.has_gst);
  const gstComplianceEnabled = profile?.gst_compliance_enabled !== false;
  const mode = billingMode(profile);

  const fyOptions = buildFyOptions(6);
  const [fy, setFy] = useState(currentFyLabel());
  const range = fyDateRange(fy) || currentFyRange();
  const [refreshing, setRefreshing] = useState(false);
  const refreshFnRef = useRef(null);

  const registerRefresh = useCallback((fn) => {
    refreshFnRef.current = fn;
    return () => {
      if (refreshFnRef.current === fn) refreshFnRef.current = null;
    };
  }, []);

  const triggerRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (refreshFnRef.current) {
        await refreshFnRef.current();
      } else {
        window.location.reload();
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  const portalCtx = { fy, setFy, fyOptions, range, refreshing, triggerRefresh, registerRefresh };

  const nav = [
    { to: '/portal', label: 'Dashboard', end: true, icon: HomeIcon },
    { to: '/portal/billing/parties', label: 'Parties', icon: UsersIcon },
    {
      to: '/portal/billing',
      label: 'Billing',
      icon: InvoiceIcon,
      isActive: (_, { pathname }) =>
        (pathname.startsWith('/portal/billing') || pathname.startsWith('/portal/quotation')) &&
        !pathname.startsWith('/portal/billing/parties'),
    },
    // Quotation has been moved into the Billing Section tabs as requested.
    hasGst && {
      label: 'GST Compliance',
      icon: ShieldCheckIcon,
      locked: !gstComplianceEnabled,
      children: [
        { to: '/portal/gstr-2b', label: 'GSTR-2B' },
        { to: '/portal/gst-returns', label: 'GST Returns' },
        { to: '/portal/gst-filing', label: 'GST Filing Confirmation' },
      ],
    },
    {
      label: 'Document Change',
      icon: EditIcon,
      children: [
        { to: '/portal/edit-requests', label: 'Edit Request' },
        { to: '/portal/amendments', label: 'Amendment Request' },
      ],
    },
    {
      label: 'Reports',
      icon: ReportIcon,
      children: [
        { to: '/portal/reports', label: 'Report Dashboard', end: true },
        hasGst && { to: '/portal/reports/gst-summary', label: 'GST Summary' },
        mode === 'regular' && { to: '/portal/reports/gst-liability', label: 'GST Liability / ITC' },
        hasGst && { to: '/portal/reports/hsn-summary', label: 'HSN / SAC Summary' },
        { to: '/portal/reports/party-wise', label: 'Party-wise Details' },
        { to: '/portal/reports/outstanding', label: 'Outstanding' },
      ].filter(Boolean),
    },
  ].filter(Boolean);

  return (
    <ClientPortalCtx.Provider value={portalCtx}>
      <PortalFrame
        shellClassName="bp-shell-client"
        loginPath="/login"
        nav={nav}
        headerContent={<ClientTopbarHeader />}
        rightContent={
          <>
            <ClientTopbarControls />
            <ClientNotificationBell />
            <ClientAvatarMenu />
          </>
        }
        sidebarFoot={<NeedHelpCard />}
      />
    </ClientPortalCtx.Provider>
  );
}

export function ClientBillingLayout() {
  return (
    <div className="bp-section-wrap">
      <div className="bp-section-head">
        <div>
          <div className="bp-section-kicker">Billing Section</div>
          <p className="bp-section-desc">Tax invoices, bill of supply, debit notes, credit notes, and quotations.</p>
        </div>
      </div>
      <BillingSubNav />
      <Outlet />
    </div>
  );
}

export function ClientReportsLayout() {
  return (
    <div className="bp-section-wrap">
      <Outlet />
    </div>
  );
}

export function AdminPortalLayout() {
  const { user } = useAuth();

  const nav = [
    { to: '/admin', label: 'Dashboard', end: true, icon: HomeIcon },
    { to: '/admin/clients', label: 'Clients', icon: UsersIcon },
    { to: '/admin/billing', label: 'Billing', icon: InvoiceIcon },
    {
      label: 'GST Compliance',
      icon: ShieldCheckIcon,
      children: [
        {
          to: '/admin/gst-returns?tab=gstr-1',
          label: 'GSTR-1',
          isActive: (_, { pathname, search }) => pathname === '/admin/gst-returns' && search.includes('gstr-1'),
        },
        { to: '/admin/gstr-2b', label: 'GSTR-2B' },
        {
          to: '/admin/gst-returns?tab=gstr-3b',
          label: 'GSTR-3B',
          isActive: (_, { pathname, search }) => pathname === '/admin/gst-returns' && (search.includes('gstr-3b') || (!search.includes('gstr-1') && !search.includes('cmp-08'))),
        },
        {
          to: '/admin/gst-returns?tab=cmp-08',
          label: 'CMP-08',
          isActive: (_, { pathname, search }) => pathname === '/admin/gst-returns' && search.includes('cmp-08'),
        },
      ],
    },
    {
      to: '/admin/gst-filing-requests',
      label: 'Request',
      icon: RequestIcon,
      isActive: (_, { pathname }) =>
        pathname.startsWith('/admin/gst-filing-requests') ||
        pathname.startsWith('/admin/edit-requests') ||
        pathname.startsWith('/admin/pending-approval'),
    },
    { to: '/admin/firm-billing/reports', label: 'Reports', icon: ReportIcon },
    { to: '/admin/configuration', label: 'Configuration', icon: NavGearIcon },
    {
      label: 'Settings',
      icon: NavGearIcon,
      children: [
        {
          to: '/admin/settings',
          label: 'Admin Security',
          isActive: (_, { pathname, search }) => pathname === '/admin/settings' && !search.includes('company-deletion'),
        },
        { to: '/admin/staff', label: 'Sub-User Management' },
        {
          to: '/admin/settings?tab=company-deletion',
          label: 'Company Deletion',
          isActive: (_, { pathname, search }) => pathname === '/admin/settings' && search.includes('company-deletion'),
        },
      ],
    },
  ];

  return (
    <PortalFrame
      brand=""
      title="Admin Portal"
      userLabel={`${user?.name || ''} · ${user?.role || ''}`}
      loginPath="/login"
      logoClickable={false}
      shellClassName="bp-shell-admin"
      headerContent={<AdminTopbarHeader />}
      rightContent={<AdminTopbarControls />}
      nav={nav}
    />
  );
}

export function AdminBillingLayout() {
  const { user } = useAuth();
  return (
    <PortalFrame
      brand="BILLING SECTION"
      title="Billing"
      userLabel={`${user?.name || ''} · ${user?.role || ''}`}
      loginPath="/login"
      logoClickable={false}
      shellClassName="bp-shell-admin"
      nav={ADMIN_BILLING_NAV}
      footLinks={[{ to: '/admin', label: '← Back to Admin' }]}
    />
  );
}
