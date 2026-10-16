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

  const removeParty = async (p) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete "${p.name}"? If it already has invoices/documents it will be archived instead.`)) return;
    try {
      const r = await api(`/billing/parties/${p.id}`, { method: 'DELETE' });
      setNotice(r.message || '');
      load(page);
    } catch (e) {
      setNotice(e.message || 'Could not delete this party.');
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
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
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
                    <Link to={`/portal/billing/parties/${p.id}/edit`} className="bp-btn bp-btn-outline" style={{ padding: '4px 8px' }}>Edit</Link>
                    {status === 'archived'
                      ? <button type="button" className="bp-btn bp-btn-outline" style={{ padding: '4px 8px', marginLeft: 6 }} onClick={() => restoreParty(p)}>Restore</button>
                      : <button type="button" className="bp-btn bp-btn-outline" style={{ padding: '4px 8px', marginLeft: 6, color: '#b91c1c', borderColor: '#fca5a5' }} onClick={() => removeParty(p)}>Delete</button>}
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
    </div>
  );
}
