import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import GstRateSelect from '../../components/GstRateSelect';
import { LoadingBlock } from '../../components/Spinner';
import GstSummaryMatrix, { resolveGstMatrix } from './GstSummaryMatrix';
import { formatDMY } from './billingUtils';

const card = {
  background: '#fff',
  borderRadius: 12,
  padding: 20,
  boxShadow: '0 1px 3px rgba(0,0,0,.08)',
};

const DOC_TYPES = [
  { value: 'tax_invoice', label: 'Tax Invoice/Bill of Supply' },
  { value: 'credit_note', label: 'Credit Note' },
  { value: 'debit_note', label: 'Debit Note' },
  { value: 'quotation', label: 'Quotation' },
  { value: 'proforma', label: 'Proforma' },
  { value: 'delivery_challan', label: 'Delivery Challan' },
];

const REPORT_TYPES = [
  'sales_summary', 'gst_summary', 'customer_wise', 'hsn_wise', 'document_register',
  'credit_notes', 'debit_notes', 'quotations', 'proforma', 'delivery_challans',
  'pending_dues', 'cancelled', 'daily_sales', 'monthly_sales', 'yearly_sales',
  'receivables_aging', 'product_wise', 'customer_list', 'product_list',
];

export function BillingHome() {
  return (
    <div>
      <h1 style={{ marginTop: 0 }}>GST Billing</h1>
      <p>Manage masters, create documents, and run reports.</p>
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
        <Link to="/portal/billing/customers" style={card}>Customers</Link>
        <Link to="/portal/billing/products" style={card}>Products</Link>
        <Link to="/portal/billing/documents" style={card}>Documents</Link>
        <Link to="/portal/billing/documents/new" style={card}>Create Invoice</Link>
      </div>
    </div>
  );
}

export function BillingCustomers() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', phone: '', gstin: '', state_code: '27', billing_address: '' });
  const load = () => api('/billing/customers').then((d) => setItems(d.data || []));
  useEffect(() => { load(); }, []);
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={card}>
        <h2 style={{ marginTop: 0 }}>Add Customer</h2>
        <form style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }} onSubmit={async (e) => {
          e.preventDefault();
          await api('/billing/customers', { method: 'POST', body: form });
          setForm({ name: '', email: '', phone: '', gstin: '', state_code: '27', billing_address: '' });
          load();
        }}>
          {Object.keys(form).map((k) => (
            <label key={k} style={{ gridColumn: k === 'billing_address' ? '1 / -1' : undefined }}>
              {k}
              <input className="form-control" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} required={k === 'name'} />
            </label>
          ))}
          <button className="btn btn-navy" type="submit">Save Customer</button>
        </form>
      </div>
      <div style={card}>
        <h2 style={{ marginTop: 0 }}>Customers</h2>
        <ul>{items.map((c) => <li key={c.id}>{c.name} {c.gstin ? `· ${c.gstin}` : ''}</li>)}</ul>
      </div>
    </div>
  );
}

export function BillingProducts() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ name: '', hsn_sac: '', gst_rate: '18', unit: 'NOS', sale_price: '' });
  const load = () => api('/billing/products').then((d) => setItems(d.data || []));
  useEffect(() => { load(); }, []);
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={card}>
        <h2 style={{ marginTop: 0 }}>Add Product / Service</h2>
        <form style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }} onSubmit={async (e) => {
          e.preventDefault();
          await api('/billing/products', { method: 'POST', body: { ...form, gst_rate: +form.gst_rate, sale_price: +form.sale_price || 0 } });
          setForm({ name: '', hsn_sac: '', gst_rate: '18', unit: 'NOS', sale_price: '' });
          load();
        }}>
          <label>
            name
            <input className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>
            hsn_sac
            <input className="form-control" value={form.hsn_sac} onChange={(e) => setForm({ ...form, hsn_sac: e.target.value })} />
          </label>
          <label>
            gst_rate
            <GstRateSelect className="form-control" value={form.gst_rate} onChange={(rate) => setForm({ ...form, gst_rate: String(rate) })} />
          </label>
          <label>
            unit
            <input className="form-control" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          </label>
          <label>
            sale_price
            <input className="form-control" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} />
          </label>
          <button className="btn btn-navy" type="submit">Save Product</button>
        </form>
      </div>
      <div style={card}>
        <h2 style={{ marginTop: 0 }}>Products</h2>
        <ul>{items.map((p) => <li key={p.id}>{p.name} · GST {p.gst_rate}% · ₹{p.sale_price}</li>)}</ul>
      </div>
    </div>
  );
}

export function BillingDocuments() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    api('/billing/documents').then((d) => setItems(d.data || []));
  }, []);
  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ marginTop: 0 }}>Documents</h1>
        <Link to="/portal/billing/documents/new" className="btn btn-gold">New Document</Link>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th align="left">Number</th><th align="left">Type</th><th align="left">Date</th><th align="left">Customer</th><th align="right">Total</th><th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((d) => (
            <tr key={d.id}>
              <td>{d.number}</td>
              <td>{d.type}</td>
              <td>{formatDMY(d.document_date)}</td>
              <td>{d.customer?.name || '—'}</td>
              <td align="right">₹{Number(d.total_amount).toLocaleString('en-IN')}</td>
              <td>
                <Link to={`/portal/billing/documents/${d.id}`}>View</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BillingDocumentNew() {
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [type, setType] = useState('tax_invoice');
  const [customerId, setCustomerId] = useState('');
  const [inter, setInter] = useState(false);
  const [lines, setLines] = useState([{ description: '', qty: 1, rate: 0, gst_rate: 18, hsn_sac: '', unit: 'NOS' }]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/billing/customers').then((d) => setCustomers(d.data || []));
    api('/billing/products').then((d) => setProducts(d.data || []));
  }, []);

  const addLine = () => setLines((L) => [...L, { description: '', qty: 1, rate: 0, gst_rate: 18, hsn_sac: '', unit: 'NOS' }]);

  return (
    <div style={card}>
      <h1 style={{ marginTop: 0 }}>Create Document</h1>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr 1fr' }}>
        <label>
          Type
          <select className="form-control" value={type} onChange={(e) => setType(e.target.value)}>
            {DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label>
          Customer
          <select className="form-control" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Select…</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'end', gap: 8 }}>
          <input type="checkbox" checked={inter} onChange={(e) => setInter(e.target.checked)} /> Inter-state (IGST)
        </label>
      </div>

      <h3>Line items</h3>
      {lines.map((line, idx) => (
        <div key={idx} style={{ display: 'grid', gap: 8, gridTemplateColumns: '2fr 1fr 1fr 1fr', marginBottom: 8 }}>
          <input className="form-control" placeholder="Description" value={line.description}
            onChange={(e) => setLines((L) => L.map((x, i) => i === idx ? { ...x, description: e.target.value } : x))}
            list="product-list" />
          <input className="form-control" type="number" placeholder="Qty" value={line.qty}
            onChange={(e) => setLines((L) => L.map((x, i) => i === idx ? { ...x, qty: +e.target.value } : x))} />
          <input className="form-control" type="number" placeholder="Rate" value={line.rate}
            onChange={(e) => setLines((L) => L.map((x, i) => i === idx ? { ...x, rate: +e.target.value } : x))} />
          <GstRateSelect
            className="form-control"
            value={line.gst_rate}
            onChange={(rate) => setLines((L) => L.map((x, i) => i === idx ? { ...x, gst_rate: rate } : x))}
          />
        </div>
      ))}
      <datalist id="product-list">
        {products.map((p) => <option key={p.id} value={p.name} />)}
      </datalist>
      <button type="button" className="btn btn-outline-navy" onClick={addLine}>+ Add line</button>
      <button
        type="button"
        className="btn btn-gold"
        style={{ marginLeft: 8 }}
        onClick={async () => {
          setError('');
          try {
            const doc = await api('/billing/documents', {
              method: 'POST',
              body: {
                type,
                customer_id: customerId ? +customerId : null,
                is_inter_state: inter,
                lines,
              },
            });
            setResult(doc);
          } catch (e) {
            setError(e.message);
          }
        }}
      >
        Create
      </button>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {result && (
        <div style={{ marginTop: 16 }}>
          <p>Created <strong>{result.number}</strong> · Total ₹{result.total_amount}</p>
          <p>{result.amount_in_words}</p>
          <Link to={`/portal/billing/documents/${result.id}`}>Open document</Link>
          {result.share_token && (
            <p>
              WhatsApp share:{' '}
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Invoice ${result.number}: https://abkhanassociates.com/api/billing/share/${result.share_token}`)}`}
                target="_blank"
                rel="noreferrer"
              >
                Share link
              </a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function BillingDocumentView() {
  const { id } = useParams();
  const [doc, setDoc] = useState(null);
  useEffect(() => {
    api(`/billing/documents/${id}`).then(setDoc).catch(console.error);
  }, [id]);
  if (!doc) return <LoadingBlock />;
  return (
    <div style={card}>
      <h1 style={{ marginTop: 0 }}>{doc.type.replace('_', ' ')} {doc.number}</h1>
      <p>Date: {formatDMY(doc.document_date)} · Customer: {doc.customer?.name || '—'}</p>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th align="left">Item</th><th align="right">Qty</th><th align="right">Rate</th><th align="right">Total</th></tr></thead>
        <tbody>
          {doc.line_items?.map((li) => (
            <tr key={li.id}>
              <td>{li.description}</td>
              <td align="right">{li.qty}</td>
              <td align="right">{li.rate}</td>
              <td align="right">{li.total_amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p><strong>Total: ₹{doc.total_amount}</strong></p>
      <p>{doc.amount_in_words}</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-navy"
          onClick={async () => {
            const r = await api(`/billing/documents/${doc.id}/pdf`);
            window.open(r.url, '_blank');
          }}
        >
          Download PDF
        </button>
        <button
          type="button"
          className="btn btn-outline-navy"
          onClick={async () => {
            const r = await api(`/billing/documents/${doc.id}/email`, { method: 'POST', body: {} });
            alert(r.message || 'Emailed');
          }}
        >
          Email Invoice
        </button>
        {doc.share_token && (
          <a
            className="btn btn-gold"
            href={`https://wa.me/?text=${encodeURIComponent(`Invoice ${doc.number}: https://abkhanassociates.com/api/billing/share/${doc.share_token}`)}`}
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp Share
          </a>
        )}
      </div>
      {doc.share_token && (
        <p style={{ marginTop: 12 }}>
          Public share: <code>/api/billing/share/{doc.share_token}</code>
        </p>
      )}
      <div style={{ marginTop: 12 }}>
        <Link to="/portal/billing/documents">← All documents</Link>
      </div>
    </div>
  );
}

export function BillingReports() {
  const [type, setType] = useState('sales_summary');
  const [data, setData] = useState(null);
  const run = () => api(`/billing/reports?type=${type}`).then(setData);
  useEffect(() => { run(); }, []);
  return (
    <div style={card}>
      <h1 style={{ marginTop: 0 }}>Reports</h1>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <select className="form-control" style={{ maxWidth: 280 }} value={type} onChange={(e) => setType(e.target.value)}>
          {REPORT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button type="button" className="btn btn-navy" onClick={run}>Run</button>
        <a className="btn btn-outline-navy" href={`/api/billing/reports/export?type=${type}`} onClick={(e) => {
          e.preventDefault();
          const token = localStorage.getItem('abkhan_token');
          fetch(`/api/billing/reports/export?type=${type}`, { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => r.blob())
            .then((b) => {
              const url = URL.createObjectURL(b);
              const a = document.createElement('a');
              a.href = url; a.download = `${type}.csv`; a.click();
            });
        }}>Export CSV</a>
      </div>
      {type === 'gst_summary' ? (
        <GstSummaryMatrix matrix={resolveGstMatrix(data)} />
      ) : (
        <pre style={{ background: '#f8fafc', padding: 16, overflow: 'auto', borderRadius: 8 }}>
          {JSON.stringify(data?.data ?? data, null, 2)}
        </pre>
      )}
    </div>
  );
}
