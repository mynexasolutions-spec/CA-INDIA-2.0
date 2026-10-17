import { useState } from 'react';
import { useReportsEnv } from './ReportsContext';
import PartyDocumentsModal from './PartyDocumentsModal';
import { filterDocsByPeriod, moneyFixed as money } from './billingUtils';

/**
 * Party-wise Detail table with clickable Documents count.
 * Document popup follows Financial Year / From / To filters.
 */
export default function PartyWiseDetailTable({
  rows = [],
  from = '',
  to = '',
  fy = '',
  /** Optional preloaded docs (admin). Filtered by customer_id + period on click. */
  documentPool = null,
  /** Optional path builder for admin document view. */
  detailBasePath = null,
  /** Optional client profile (admin client billing). Defaults to logged-in client. */
  profile = null,
}) {
  const env = useReportsEnv();
  const dealerProfile = profile || env.profile;
  const [open, setOpen] = useState(false);
  const [party, setParty] = useState(null);

  const openParty = (row) => {
    const id = row.customer_id;
    const name = row.customer?.name || row.party_name || 'Party';
    const count = Number(row.Documents ?? row.documents ?? row.invoices ?? row.count ?? 0);
    if (!id || count <= 0) return;

    if (Array.isArray(documentPool)) {
      const filtered = filterDocsByPeriod(
        documentPool.filter((d) => String(d.customer_id) === String(id)),
        { from, to },
      );
      setParty({
        name,
        documents: filtered,
        fetchUrl: null,
      });
    } else {
      const qs = new URLSearchParams({ party_id: String(id) });
      // Prefer From/To — FY selection already updates these in the filter bar.
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      // Fall back to FY only when dates are missing.
      if (!from && !to && fy) qs.set('fy', fy);
      qs.set('per_page', '500');
      qs.set('status', 'issued');
      setParty({
        name,
        documents: null,
        fetchUrl: `${env.docsApi}?${qs}`,
      });
    }
    setOpen(true);
  };

  return (
    <>
      <table className="bp-table">
        <thead>
          <tr>
            <th>Party</th>
            <th>Documents</th>
            <th>Taxable</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const count = r.Documents ?? r.documents ?? r.invoices ?? r.count ?? 0;
            const canOpen = r.customer_id && Number(count) > 0;
            return (
              <tr key={r.customer_id || i}>
                <td>{r.customer?.name || r.party_name || '—'}</td>
                <td>
                  {canOpen ? (
                    <button
                      type="button"
                      onClick={() => openParty(r)}
                      title="View documents for this party (current filters)"
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        color: 'var(--bp-navy)',
                        fontWeight: 700,
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        fontSize: 'inherit',
                      }}
                    >
                      {count}
                    </button>
                  ) : (
                    count || '—'
                  )}
                </td>
                <td>{money(r.taxable)}</td>
                <td>{money(r.total)}</td>
              </tr>
            );
          })}
          {!rows.length && (
            <tr><td colSpan={4}>No data for this period</td></tr>
          )}
        </tbody>
      </table>

      <PartyDocumentsModal
        open={open}
        onClose={() => setOpen(false)}
        partyName={party?.name}
        fetchUrl={party?.fetchUrl}
        documents={party?.documents}
        detailBasePath={detailBasePath}
        profile={dealerProfile}
        from={from}
        to={to}
        fy={fy}
      />
    </>
  );
}
