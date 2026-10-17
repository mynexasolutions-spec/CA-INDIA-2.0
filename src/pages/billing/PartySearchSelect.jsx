import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';

const PAGE_SIZE = 15;

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="6" />
      <path d="m17 17-3.5-3.5" />
    </svg>
  );
}

/** Search-as-you-type party picker. Parties are fetched from the server (debounced `?q=`,
 *  15 at a time with infinite scroll) so it stays fast with any number of parties. With an
 *  empty search it shows the 5 most recently invoiced parties first. Archived parties are
 *  never listed. "+ New" opens Add Company in a new tab so in-progress document details
 *  here are never lost. */
export default function PartySearchSelect({
  selected,
  value,
  onSelect,
  partiesEndpointBase = '/billing/parties',
  hideNewParty = false,
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [recent, setRecent] = useState([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);
  const reqId = useRef(0);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // Recently used parties: refreshed each time the dropdown opens.
  useEffect(() => {
    if (!open) return;
    api(`${partiesEndpointBase}/recent`).then((d) => setRecent(d.data || [])).catch(() => setRecent([]));
  }, [open, partiesEndpointBase]);

  const fetchPage = (targetPage, search) => {
    const id = ++reqId.current;
    setLoading(true);
    const qs = new URLSearchParams({ status: 'active', per_page: PAGE_SIZE, page: targetPage });
    if (search) qs.set('q', search);
    api(`${partiesEndpointBase}?${qs}`).then((d) => {
      if (id !== reqId.current) return;
      setItems((prev) => (targetPage === 1 ? (d.data || []) : [...prev, ...(d.data || [])]));
      setPage(d.current_page || targetPage);
      setLastPage(d.last_page || 1);
    }).catch(() => {}).finally(() => { if (id === reqId.current) setLoading(false); });
  };

  // Debounced server-side search (fires immediately on open, then 300ms after typing stops).
  useEffect(() => {
    if (!open) return undefined;
    const t = setTimeout(() => fetchPage(1, query.trim()), query ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query]);

  const onScroll = (e) => {
    const el = e.currentTarget;
    if (!loading && page < lastPage && el.scrollTop + el.clientHeight >= el.scrollHeight - 24) {
      fetchPage(page + 1, query.trim());
    }
  };

  const pick = (p) => { onSelect(String(p.id)); setOpen(false); setQuery(''); };

  const showRecent = !query.trim() && recent.length > 0;
  const recentIds = new Set(showRecent ? recent.map((p) => p.id) : []);
  const listItems = items.filter((p) => !recentIds.has(p.id));

  const row = (p) => (
    <button key={p.id} type="button" className="bp-party-search-item" onClick={() => pick(p)}>
      <span className="bp-party-search-item-name">{p.name}</span>
      <span className="bp-party-search-item-sub">
        {p.gstin_display || p.gstin || 'B2C'}
        {p.branch_name && ` (Branch Name - ${p.branch_name})`}
      </span>
    </button>
  );

  return (
    <div className="bp-party-search" ref={ref}>
      <div className="bp-party-search-row">
        <div className="bp-party-search-input-wrap">
          <SearchIcon />
          <input
            className="bp-input"
            style={{ paddingLeft: 30, height: 40, boxSizing: 'border-box' }}
            placeholder="Search and select party…"
            value={open ? query : (value ? (selected?.name || '') : '')}
            onFocus={() => { setOpen(true); setQuery(''); }}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          />
        </div>
        {!hideNewParty && (
          <a
            className="bp-btn bp-btn-outline"
            href="/portal/billing/parties/new"
            target="_blank"
            rel="noreferrer"
            style={{
              height: 40,
              boxSizing: 'border-box',
              display: 'inline-flex',
              alignItems: 'center',
              whiteSpace: 'nowrap',
              border: '1.5px solid #2563eb',
              color: '#2563eb',
              fontWeight: 700,
              borderRadius: 8,
              padding: '0 16px'
            }}
          >
            + New
          </a>
        )}
      </div>
      {open && (
        <div className="bp-party-search-panel" style={{ maxHeight: 320, overflowY: 'auto' }} onScroll={onScroll}>
          {showRecent && (
            <>
              <div className="bp-dropdown-empty" style={{ fontWeight: 700, textAlign: 'left' }}>Recently used</div>
              {recent.map(row)}
              {listItems.length > 0 && <div className="bp-dropdown-empty" style={{ fontWeight: 700, textAlign: 'left' }}>All parties</div>}
            </>
          )}
          {!loading && items.length === 0 && recent.length === 0 && <div className="bp-dropdown-empty">No matching parties</div>}
          {!loading && query.trim() && items.length === 0 && <div className="bp-dropdown-empty">No matching parties</div>}
          {listItems.map(row)}
          {loading && <div className="bp-dropdown-empty">Loading…</div>}
        </div>
      )}
    </div>
  );
}
