import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getAuthToken } from '../../api/client';
import { LoadingBlock } from '../../components/Spinner';
import BillingDateFilters from './BillingDateFilters';
import { currentFyRange, docTypeLabel, money, formatDMY } from './billingUtils';
import GstSummaryMatrix, { resolveGstMatrix } from './GstSummaryMatrix';
import PartyWiseDetailTable from './PartyWiseDetailTable';

/** Report-type tiles hidden per client request. */
const REPORTS = [];

function fmtDate(v) {
  return formatDMY(v);
}

function rowsFrom(payload) {
  const data = payload?.data ?? payload;
  if (data == null) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === 'object' && (data.taxable != null || data.cgst != null || data.matrix)) return [data];
  return [];
}

function ReportView({ type, payload, profile = null, from = '', to = '', fy = '' }) {
  const data = payload?.data ?? payload;
  const rows = rowsFrom(payload);

  if (!payload) return <p style={{ color: 'var(--bp-muted)' }}>Run a report to see results.</p>;

  if (type === 'gst_summary') {
    return <GstSummaryMatrix matrix={resolveGstMatrix(payload, profile)} profile={profile} />;
  }

  if (type === 'hsn_summary') {
    return (
      <table className="bp-table">
        <thead>
          <tr>
            <th>HSN/SAC</th><th>Description</th><th>Qty</th><th>Taxable</th>
            <th>GST %</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Total</th>
          </tr>
        </thead>
        <tbody>
          {(Array.isArray(data) ? data : rows).map((r, i) => (
            <tr key={`${r.hsn_sac || i}`}>
              <td>{r.hsn_sac || '—'}</td>
              <td>{r.description || '—'}</td>
              <td>{r.qty ?? '—'}</td>
              <td>{money(r.taxable)}</td>
              <td>{r.gst_rate != null ? Number(r.gst_rate).toFixed(2) : '—'}</td>
              <td>{money(r.cgst)}</td>
              <td>{money(r.sgst)}</td>
              <td>{money(r.igst)}</td>
              <td>{money(r.total)}</td>
            </tr>
          ))}
          {!(Array.isArray(data) ? data : rows).length && <tr><td colSpan={9}>No data for this period</td></tr>}
        </tbody>
      </table>
    );
  }

  if (type === 'monthly_sales') {
    const list = Array.isArray(data) ? data : rows;
    return (
      <table className="bp-table">
        <thead><tr><th>Month</th><th>Count</th><th>Taxable</th><th>Total</th></tr></thead>
        <tbody>
          {list.map((r) => (
            <tr key={r.month}><td>{r.month}</td><td>{r.count}</td><td>{money(r.taxable)}</td><td>{money(r.total)}</td></tr>
          ))}
          {!list.length && <tr><td colSpan={4}>No data for this period</td></tr>}
        </tbody>
      </table>
    );
  }

  if (type === 'party_wise_sales') {
    const list = Array.isArray(data) ? data : rows;
    return <PartyWiseDetailTable rows={list} from={from} to={to} fy={fy} profile={profile} />;
  }

  // Document registers
  const list = Array.isArray(data) ? data : [];
  return (
    <table className="bp-table">
      <thead>
        <tr>
          <th>No.</th><th>Date</th><th>Party</th><th>Type</th>
          <th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Total</th><th>Status</th><th />
        </tr>
      </thead>
      <tbody>
        {list.map((r) => (
          <tr key={r.id || r.number}>
            <td>{r.number}</td>
            <td>{fmtDate(r.document_date)}</td>
            <td>{r.customer?.name || '—'}</td>
            <td>{docTypeLabel(r.type)}</td>
            <td>{money(r.taxable_amount)}</td>
            <td>{money(r.cgst_amount)}</td>
            <td>{money(r.sgst_amount)}</td>
            <td>{money(r.igst_amount)}</td>
            <td>{money(r.grand_total || r.total_amount)}</td>
            <td>
              <span className={`bp-badge ${r.status === 'paid' ? 'bp-badge-paid' : r.status === 'partial' ? 'bp-badge-partial' : 'bp-badge-unpaid'}`}>
                {r.status === 'paid' ? 'Paid' : r.status === 'partial' ? 'Partial' : r.status === 'issued' ? 'Unpaid' : r.status}
              </span>
            </td>
            <td>{r.id ? <Link to={`/portal/billing/invoices/${r.id}`}>View</Link> : null}</td>
          </tr>
        ))}
        {!list.length && <tr><td colSpan={11}>No data for this period</td></tr>}
      </tbody>
    </table>
  );
}

export default function BillingReports({ defaultType = 'gst_summary', title = 'Reports' }) {
  const fyDefault = currentFyRange();
  const [type, setType] = useState(defaultType);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState('');
  const [fy, setFy] = useState(fyDefault.fy);
  const [from, setFrom] = useState(fyDefault.from);
  const [to, setTo] = useState(fyDefault.to);

  const run = () => {
    setLoading(true);
    api(`/billing/reports?type=${type}&from=${from}&to=${to}`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { setType(defaultType); }, [defaultType]);

  useEffect(() => { run(); }, [type]);

  const download = async (format) => {
    const token = getAuthToken();
    const res = await fetch(`/api/billing/reports/export?type=${type}&from=${from}&to=${to}&format=${format}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: '*/*' },
    });
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${type}.${format === 'xlsx' ? 'xls' : format}`;
    a.click();
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      {REPORTS.length > 0 && (
        <div className="bp-report-grid">
          {REPORTS.map((r) => (
            <button key={r.type} type="button" className={`bp-report-tile ${type === r.type ? 'active' : ''}`} onClick={() => setType(r.type)}>
              {r.label}
            </button>
          ))}
        </div>
      )}
      <div className="bp-card" style={{ marginTop: 16 }}>
        <BillingDateFilters
          month={month}
          setMonth={setMonth}
          fy={fy}
          setFy={setFy}
          from={from}
          setFrom={setFrom}
          to={to}
          setTo={setTo}
          showSearch={false}
          onApply={run}
          onClear={run}
        />
        <div className="bp-toolbar" style={{ marginTop: 8 }}>
          <button type="button" className="bp-btn bp-btn-primary" onClick={run}>Search</button>
          <button type="button" className="bp-btn bp-btn-green" onClick={() => download('xlsx')}>Export Excel</button>
          <button type="button" className="bp-btn bp-btn-danger" onClick={() => download('pdf')}>Export PDF</button>
        </div>
      </div>
      <div className="bp-card" style={{ marginTop: 14, overflowX: 'auto' }}>
        {loading ? <LoadingBlock /> : <ReportView type={type} payload={data} from={from} to={to} fy={fy} />}
      </div>
    </div>
  );
}
