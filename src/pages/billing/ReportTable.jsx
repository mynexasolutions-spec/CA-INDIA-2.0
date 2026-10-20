import { Link } from 'react-router-dom';
import { docTypeLabel, paymentStatusBadge, paymentStatusLabel, formatDMY } from './billingUtils';
import GstSummaryMatrix, { resolveGstMatrix } from './GstSummaryMatrix';
import PartyWiseDetailTable from './PartyWiseDetailTable';

function money(n) {
  if (n == null || n === '') return '—';
  const num = Number(n);
  if (Number.isNaN(num)) return String(n);
  return `₹${num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function moneyFixed(n) {
  if (n == null || n === '') return '—';
  const num = Number(n);
  if (Number.isNaN(num)) return String(n);
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(v) {
  return formatDMY(v);
}

function asRows(data) {
  if (data == null) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === 'object') {
    if (Array.isArray(data.rows)) return data.rows;
    if (Array.isArray(data.items)) return data.items;
    if (data.taxable != null || data.cgst != null || data.total_gst != null || data.total != null) {
      return [data];
    }
  }
  return [];
}

/** Render report payload as a readable table (not JSON). */
export default function ReportTable({ type, payload, detailBasePath, from = '', to = '', fy = '', documentPool = null, profile = null }) {
  const data = payload?.data ?? payload;
  const rows = asRows(data);

  if (!payload && data == null) {
    return <p style={{ color: 'var(--bp-muted)' }}>Run a report to see results.</p>;
  }

  if (type === 'gst_summary' || (rows.length === 1 && rows[0].taxable != null && !rows[0].number && !rows[0].hsn_sac && !rows[0].month && !rows[0].customer_id)) {
    return <GstSummaryMatrix matrix={resolveGstMatrix(payload)} title="" />;
  }

  if (type === 'hsn_summary' || type === 'hsn_wise') {
    return (
      <table className="bp-table">
        <thead>
          <tr>
            <th>HSN/SAC</th><th>Description</th><th>Qty</th><th>Taxable</th>
            <th>GST %</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.hsn_sac || i}`}>
              <td>{r.hsn_sac || '—'}</td>
              <td>{r.description || '—'}</td>
              <td>{r.qty ?? '—'}</td>
              <td>{moneyFixed(r.taxable ?? r.taxable_amount)}</td>
              <td>{r.gst_rate != null ? Number(r.gst_rate).toFixed(2) : '—'}</td>
              <td>{moneyFixed(r.cgst ?? r.cgst_amount)}</td>
              <td>{moneyFixed(r.sgst ?? r.sgst_amount)}</td>
              <td>{moneyFixed(r.igst ?? r.igst_amount)}</td>
              <td>{moneyFixed(r.total ?? r.total_amount)}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={9}>No data for this period</td></tr>}
        </tbody>
      </table>
    );
  }

  if (type === 'monthly_sales') {
    return (
      <table className="bp-table">
        <thead><tr><th>Month</th><th>Count</th><th>Taxable</th><th>Total</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.month}>
              <td>{r.month}</td>
              <td>{r.count}</td>
              <td>{money(r.taxable)}</td>
              <td>{money(r.total)}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={4}>No data for this period</td></tr>}
        </tbody>
      </table>
    );
  }

  if (type === 'party_wise' || type === 'party_wise_sales') {
    return (
      <PartyWiseDetailTable
        rows={rows}
        from={from}
        to={to}
        fy={fy}
        documentPool={documentPool}
        detailBasePath={detailBasePath}
        profile={profile}
      />
    );
  }

  if (type === 'client_wise_register') {
    return (
      <table className="bp-table">
        <thead>
          <tr>
            <th>No.</th><th>Date</th><th>Client</th><th>Party</th><th>Type</th>
            <th>Taxable</th><th>GST</th><th>Total</th><th>Status</th>
            {detailBasePath ? <th /> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id || r.number}>
              <td>{r.number}</td>
              <td>{fmtDate(r.document_date)}</td>
              <td>{r.client_profile?.business_name || '—'}</td>
              <td>{r.customer?.name || '—'}</td>
              <td>{docTypeLabel(r.type)}</td>
              <td>{money(r.taxable_amount)}</td>
              <td>{money(Number(r.cgst_amount || 0) + Number(r.sgst_amount || 0) + Number(r.igst_amount || 0))}</td>
              <td>{money(r.grand_total || r.total_amount)}</td>
              <td>{paymentStatusLabel(r.status)}</td>
              {detailBasePath ? (
                <td>{r.id ? <Link to={`${detailBasePath}/${r.id}`}>View</Link> : null}</td>
              ) : null}
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={detailBasePath ? 10 : 9}>No data for this period</td></tr>}
        </tbody>
      </table>
    );
  }

  const isDocList = [
    'sales_register', 'invoice_register', 'outstanding_report', 'outstanding',
    'credit_notes', 'debit_notes', 'document_register',
  ].includes(type) || rows.some((r) => r.number != null);

  if (isDocList) {
    return (
      <table className="bp-table">
        <thead>
          <tr>
            <th>No.</th><th>Date</th><th>Party</th><th>Type</th>
            <th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Total</th><th>Status</th>
            {detailBasePath ? <th /> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id || `${r.number}-${r.document_date}`}>
              <td>{r.number}</td>
              <td>{fmtDate(r.document_date)}</td>
              <td>{r.customer?.name || r.party_name || '—'}</td>
              <td>{docTypeLabel(r.type)}</td>
              <td>{money(r.taxable_amount)}</td>
              <td>{money(r.cgst_amount)}</td>
              <td>{money(r.sgst_amount)}</td>
              <td>{money(r.igst_amount)}</td>
              <td>{money(r.grand_total || r.total_amount)}</td>
              <td><span className={`bp-badge ${paymentStatusBadge(r.status)}`}>{paymentStatusLabel(r.status)}</span></td>
              {detailBasePath && r.id ? (
                <td><Link to={`${detailBasePath}/${r.id}`}>View</Link></td>
              ) : null}
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={detailBasePath ? 11 : 10}>No data for this period</td></tr>}
        </tbody>
      </table>
    );
  }

  if (rows.length && typeof rows[0] === 'object') {
    const keys = Object.keys(rows[0]).filter((k) => !['customer', 'client_profile', 'line_items', 'reference_document'].includes(k));
    return (
      <table className="bp-table">
        <thead>
          <tr>{keys.map((k) => <th key={k}>{k.replaceAll('_', ' ')}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {keys.map((k) => {
                const v = r[k];
                if (v == null) return <td key={k}>—</td>;
                if (typeof v === 'number' || (typeof v === 'string' && /amount|total|taxable|cgst|sgst|igst|discount/i.test(k) && !Number.isNaN(Number(v)))) {
                  return <td key={k}>{money(v)}</td>;
                }
                if (typeof v === 'object') return <td key={k}>{v.name || JSON.stringify(v)}</td>;
                return <td key={k}>{String(v)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return <p style={{ color: 'var(--bp-muted)' }}>No data for this period</p>;
}
