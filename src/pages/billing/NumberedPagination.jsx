/** Billing Module spec §6 — "Same pagination design on every tab."
 *  Shared numbered pagination bar: "Showing X to Y of Z entries" + rows-per-page + page buttons. */
export default function NumberedPagination({ meta, perPage, onPerPage, onPage, itemLabel = 'entries', perPageOptions = [10, 25, 50] }) {
  const { current_page: page = 1, last_page: lastPage = 1, total = 0, per_page: metaPerPage } = meta || {};
  const effectivePerPage = metaPerPage || perPage || 10;
  if (!total) return null;

  const rowFrom = (page - 1) * effectivePerPage + 1;
  const rowTo = Math.min(page * effectivePerPage, total);

  const pages = [];
  const windowSize = 2;
  for (let p = 1; p <= lastPage; p += 1) {
    if (p === 1 || p === lastPage || (p >= page - windowSize && p <= page + windowSize)) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…');
    }
  }

  return (
    <div className="bp-pagination">
      <span>Showing {rowFrom} to {rowTo} of {total} {itemLabel}</span>
      <div className="bp-pagination-controls">
        {onPerPage && (
          <label>
            Rows per page:
            <select className="bp-select" style={{ width: 72 }} value={effectivePerPage} onChange={(e) => onPerPage(Number(e.target.value))}>
              {perPageOptions.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
        )}
        <button type="button" className="bp-page-btn" disabled={page <= 1} onClick={() => onPage(Math.max(1, page - 1))} aria-label="Previous page">Prev</button>
        {pages.map((p, i) => (
          p === '…'
            ? <span key={`e${i}`} className="bp-page-ellipsis">…</span>
            : (
              <button
                key={p}
                type="button"
                className={`bp-page-btn${p === page ? ' active' : ''}`}
                onClick={() => onPage(p)}
                aria-current={p === page ? 'page' : undefined}
              >
                {p}
              </button>
            )
        ))}
        <button type="button" className="bp-page-btn" disabled={page >= lastPage} onClick={() => onPage(Math.min(lastPage, page + 1))} aria-label="Next page">Next</button>
      </div>
    </div>
  );
}
