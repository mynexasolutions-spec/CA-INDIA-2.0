import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { INDIAN_STATES } from '../../data/indianStates';

const AVATAR_COLORS = [
  { bg: '#e3ecfb', fg: '#1c4b9c' },
  { bg: '#e2f6ea', fg: '#1d7a45' },
  { bg: '#fdf1dc', fg: '#9b6a10' },
  { bg: '#fbe7ec', fg: '#a52e5a' },
];

function avatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash + name.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[hash];
}

function initialsOf(name) {
  const words = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Parties Dashboard — displays every company/party created by the logged-in client (the
 * backend scopes every query to the authenticated client's own client_profile_id, so this
 * list can never show another client's parties). Add New Company / Edit Company are their
 * own routed pages, not a modal — matching how the rest of the portal (invoices, etc.) works. */
export default function PartiesPage() {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 10 });
  const [q, setQ] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [gstFilter, setGstFilter] = useState('');
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('active');
  const [notice, setNotice] = useState('');

  const load = (targetPage = page, targetStatus = status) => {
    const qs = new URLSearchParams();
    if (q) qs.set('q', q);
    if (stateFilter) qs.set('state', stateFilter);
    if (gstFilter) qs.set('gst_status', gstFilter);
    qs.set('status', targetStatus);
    qs.set('per_page', perPage);
    qs.set('page', targetPage);
    api(`/billing/parties?${qs}`).then((d) => {
      setItems(d.data || []);
      setMeta({ current_page: d.current_page || 1, last_page: d.last_page || 1, total: d.total || 0, per_page: d.per_page || perPage });
    });
  };

  const changeStatus = (s) => { setStatus(s); setPage(1); setNotice(''); load(1, s); };

  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  // The Manage menu is fixed-positioned (table cells clip overflow), so it carries its own coordinates.
  const [menu, setMenu] = useState(null); // { party, top, left }

  useEffect(() => {
    if (!menu) return undefined;
    const close = () => setMenu(null);
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  const openMenu = (e, party) => {
    const r = e.currentTarget.getBoundingClientRect();
    setMenu({ party, top: r.bottom + 6, left: Math.max(8, r.right - 190) });
  };

  const removeParty = (p) => { setMenu(null); setConfirmName(''); setDeleting(p); };

  // Accidental-deletion guard: the final Delete only unlocks on an exact match of the company name.
  const nameMatches = Boolean(deleting) && confirmName === deleting.name;

  useEffect(() => {
    if (!deleting) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !deleteBusy) setDeleting(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deleting, deleteBusy]);

  const confirmRemove = async () => {
    if (!deleting || !nameMatches) return;
    setDeleteBusy(true);
    try {
      const r = await api(`/billing/parties/${deleting.id}`, { method: 'DELETE' });
      setNotice(r.message || `"${deleting.name}" deleted.`);
      load(page);
    } catch (e) {
      setNotice(e.message || 'Could not delete this party.');
    } finally {
      setDeleteBusy(false);
      setDeleting(null);
    }
  };

  const restoreParty = async (p) => {
    try {
      await api(`/billing/parties/${p.id}/restore`, { method: 'POST' });
      setNotice(`"${p.name}" restored.`);
      load(page);
    } catch (e) {
      setNotice(e.message || 'Could not restore this party.');
    }
  };

  useEffect(() => { load(page); }, [page, perPage]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live search: re-query a short moment after the user stops typing, instead of requiring
  // Enter/Apply. Skips the very first render so it doesn't duplicate the mount-time load above.
  const searchMounted = useRef(false);
  useEffect(() => {
    if (!searchMounted.current) {
      searchMounted.current = true;
      return;
    }
    const t = setTimeout(() => {
      setPage(1);
      load(1);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const changePerPage = (value) => {
    setPerPage(value);
    setPage(1);
  };

  const applyFilters = () => { setPage(1); load(1); };

  const resetFilters = () => {
    setQ('');
    setStateFilter('');
    setGstFilter('');
    setPage(1);
    setTimeout(() => load(1), 0);
  };

  const from = meta.total ? (meta.current_page - 1) * meta.per_page + 1 : 0;
  const to = Math.min(meta.current_page * meta.per_page, meta.total);

  return (
    <div className="bp-section-wrap">
      <div className="bp-parties-head">
        <span className="bp-parties-head-icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="7.5" cy="6" r="3" />
            <path d="M2 17c.7-3 2.7-4.7 5.5-4.7S12.8 14 13.5 17" />
            <circle cx="14.5" cy="7" r="2.3" />
            <path d="M13 12.6c2.4.2 3.9 1.8 4.5 4.4" />
          </svg>
        </span>
        <div>
          <h2>Parties (Company Management)</h2>
          <p className="bp-section-desc">Manage your companies and billing parties.</p>
        </div>
        <span className="bp-parties-count">{meta.total} {meta.total === 1 ? 'Company' : 'Companies'}</span>
        <Link to="/portal/billing/parties/new" className="bp-btn bp-btn-blue">+ New Company</Link>
      </div>

      <div className="bp-card">
        {notice && <p className="bp-alert">{notice}</p>}
        <div className="bp-parties-tabs" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button type="button" className={`bp-btn ${status === 'active' ? 'bp-btn-blue' : 'bp-btn-outline'}`} onClick={() => changeStatus('active')}>Active</button>
          <button type="button" className={`bp-btn ${status === 'archived' ? 'bp-btn-blue' : 'bp-btn-outline'}`} onClick={() => changeStatus('archived')}>Archived</button>
        </div>
        <div className="bp-parties-filters">
          <div className="bp-parties-search">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="9" cy="9" r="6.2" />
              <path d="m17 17-3.8-3.8" />
            </svg>
            <input
              placeholder="Search by Company Name, GSTIN or Phone"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
            />
          </div>
          <select className="bp-select" style={{ maxWidth: 170 }} value={stateFilter} onChange={(e) => { setStateFilter(e.target.value); }}>
            <option value="">State</option>
            {INDIAN_STATES.map((s) => (
              <option key={s.code} value={s.name}>{s.name}</option>
            ))}
          </select>
          <select className="bp-select" style={{ maxWidth: 170 }} value={gstFilter} onChange={(e) => setGstFilter(e.target.value)}>
            <option value="">GST Status</option>
            <option value="registered">B2B</option>
            <option value="unregistered">B2C</option>
          </select>
          <button type="button" className="bp-btn bp-btn-blue" onClick={applyFilters}>Apply</button>
          <button type="button" className="bp-btn bp-btn-outline" onClick={resetFilters}>↺ Reset</button>
        </div>

        <table className="bp-table bp-parties-table">
          <thead>
            <tr>
              <th>Company Name</th>
              <th style={{ textAlign: 'center' }}>GSTIN</th>
              <th style={{ textAlign: 'center' }}>Contact</th>
              <th style={{ textAlign: 'center' }}>State</th>
              <th style={{ textAlign: 'center' }}>GST Status</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => {
              const color = avatarColor(p.name || '');
              const registered = (p.gst_status || (p.gstin ? 'registered' : 'unregistered')) === 'registered';
              return (
                <tr key={p.id}>
                  <td>
                    <div className="bp-party-cell">
                      <span className="bp-party-avatar" style={{ background: color.bg, color: color.fg }}>{initialsOf(p.name)}</span>
                      <div>
                        <div className="bp-party-name">{p.name}</div>
                        {p.phone && <div className="bp-party-sub">{p.phone}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {registered
                      ? (p.gstin || <span className="bp-party-muted">—</span>)
                      : <span className="bp-party-muted">—</span>}
                  </td>
                  <td style={{ textAlign: 'center' }}>{p.phone || '—'}</td>
                  <td style={{ textAlign: 'center' }}>{p.state || p.state_code || '—'}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`bp-gst-badge ${registered ? 'is-registered' : 'is-unregistered'}`} style={{ justifyContent: 'center' }}>
                      <span className="dot" /> {registered ? 'B2B' : 'B2C'}
                    </span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>
                    <button type="button" className="bp-btn bp-btn-outline" style={{ padding: '4px 12px', display: 'inline-flex', alignItems: 'center', gap: 6, color: '#1d4ed8', borderColor: '#bcd0f5' }}
                      aria-haspopup="menu" aria-expanded={menu?.party.id === p.id}
                      onClick={(e) => openMenu(e, p)}>
                      Manage
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {items.length === 0 && (
          <p className="bp-table-empty">
            {(q || stateFilter || gstFilter)
              ? 'No companies found matching your search or filters.'
              : 'No companies yet — click "+ New Company" to add your first customer or vendor.'}
          </p>
        )}

        {meta.total > 0 && (
          <div className="bp-pagination">
            <span>Showing {from} to {to} of {meta.total} companies</span>
            <div className="bp-pagination-controls">
              <label>
                Rows per page:
                <select className="bp-select" style={{ width: 72 }} value={perPage} onChange={(e) => changePerPage(Number(e.target.value))}>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </label>
              <button type="button" className="bp-btn bp-btn-outline" disabled={meta.current_page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>«</button>
              <span>{meta.current_page}</span>
              <button type="button" className="bp-btn bp-btn-outline" disabled={meta.current_page >= meta.last_page} onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}>»</button>
            </div>
          </div>
        )}
      </div>

      {menu && (
        <>
          <div role="presentation" style={{ position: 'fixed', inset: 0, zIndex: 9000 }} onMouseDown={() => setMenu(null)} />
          <div role="menu" style={{ position: 'fixed', top: menu.top, left: menu.left, width: 190, zIndex: 9001, background: '#fff', border: '1px solid #dfe8f6', borderRadius: 12, padding: 6, boxShadow: '0 18px 40px -16px rgba(15,42,95,0.45)' }}>
            <Link role="menuitem" to={`/portal/billing/parties/${menu.party.id}/edit`} onClick={() => setMenu(null)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, color: '#1e293b', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
              Edit Company
            </Link>
            {status === 'archived' ? (
              <button type="button" role="menuitem" onClick={() => { const p = menu.party; setMenu(null); restoreParty(p); }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px', borderRadius: 8, border: 'none', background: 'none', color: '#1e293b', fontWeight: 600, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="1 4 1 10 7 10" /><path d="M3.5 15a9 9 0 1 0 2.1-9.4L1 10" /></svg>
                Restore Company
              </button>
            ) : (
              <button type="button" role="menuitem" onClick={() => removeParty(menu.party)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px', borderRadius: 8, border: 'none', background: 'none', color: '#dc2626', fontWeight: 600, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
                Delete Company
              </button>
            )}
          </div>
        </>
      )}

      {deleting && (
        <div role="presentation"
          onMouseDown={(e) => { if (e.target === e.currentTarget && !deleteBusy) setDeleting(null); }}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="dc-title"
            style={{ width: '100%', maxWidth: 440, background: '#fff', borderRadius: 16, padding: '20px 24px 22px', boxShadow: '0 30px 70px -20px rgba(15,42,95,0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
              <h3 id="dc-title" style={{ margin: 0, flex: 1, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Delete Company</h3>
              <button type="button" aria-label="Close" disabled={deleteBusy} onClick={() => setDeleting(null)}
                style={{ border: 'none', background: 'none', fontSize: 20, lineHeight: 1, color: '#64748b', cursor: 'pointer' }}>×</button>
            </div>
            <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Are you sure you want to delete this company?</p>
            <p style={{ margin: 0, fontSize: 12.5, color: '#475569', lineHeight: 1.5 }}>
              This action cannot be undone. To confirm, please type the company name below.
            </p>
            <div style={{ marginTop: 14, background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 14px' }}>
              <label htmlFor="dc-name" style={{ display: 'block', marginBottom: 6, fontSize: 12.5, fontWeight: 700, color: '#b91c1c' }}>Type company name to delete:</label>
              <input id="dc-name" className="bp-input" autoFocus autoComplete="off" spellCheck={false}
                value={confirmName} onChange={(e) => setConfirmName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && nameMatches && !deleteBusy) confirmRemove(); }}
                placeholder={deleting.name}
                style={{ width: '100%', boxSizing: 'border-box', background: '#fff' }} />
              <p style={{ margin: '8px 0 0', fontSize: 11.5, color: '#64748b', lineHeight: 1.5 }}>
                If this company already has invoices or documents, it is archived instead of deleted so your records stay safe. You can restore it from the Archived tab.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 18 }}>
              <button type="button" disabled={deleteBusy} onClick={() => setDeleting(null)}
                style={{ flex: 1, height: 42, borderRadius: 10, border: '1.5px solid #dbe3ef', background: '#fff', color: '#334155', fontWeight: 700, fontSize: 14, cursor: deleteBusy ? 'not-allowed' : 'pointer' }}>
                Cancel
              </button>
              <button type="button" disabled={!nameMatches || deleteBusy} onClick={confirmRemove}
                style={{ flex: 1, height: 42, borderRadius: 10, border: 'none', background: '#dc2626', color: '#fff', fontWeight: 800, fontSize: 14, cursor: nameMatches && !deleteBusy ? 'pointer' : 'not-allowed', opacity: nameMatches && !deleteBusy ? 1 : 0.45 }}>
                {deleteBusy ? 'Please wait…' : 'Delete Company'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
