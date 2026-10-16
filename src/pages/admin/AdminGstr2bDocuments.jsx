import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/client';

const R2 = (n) =>
  Number(n ?? 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const periodLabel = (p) => {
  if (!p) return '';
  if (p.includes('-Q')) {
    const [y, q] = p.split('-Q');
    const labels = { '1': `Apr–Jun ${y}`, '2': `Jul–Sep ${y}`, '3': `Oct–Dec ${y}`, '4': `Jan–Mar ${+y + 1}` };
    return `Q${q} (${labels[q]})`;
  }
  const [yr, mo] = p.split('-');
  return new Date(yr, mo - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
};

const formatDate = (d) => {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
};

// [label, text colour, background, border]
const GREEN = ['#16a34a', '#dcfce7', '#86efac'];
const RED = ['#dc2626', '#fee2e2', '#fca5a5'];
const GREY = ['#475569', '#f1f5f9', '#cbd5e1'];

const ELIGIBILITY_BADGE = {
  eligible: ['Yes', ...GREEN],
  ineligible: ['No', ...RED],
};
const MATCH_BADGE = {
  matched: ['Matched', ...GREEN],
  unmatched: ['Unmatched', ...RED],
  pending: ['Pending', ...GREY],
};

/** Read-only status pill. Unreviewed ITC eligibility (null) shows "Select" until Admin decides. */
function StatusBadge({ spec }) {
  const [label, color, bg, border] = spec;
  return (
    <span
      style={{
        display: 'inline-block',
        minWidth: 64,
        padding: '3px 12px',
        border: `1.5px solid ${border}`,
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 700,
        color,
        background: bg,
        textAlign: 'center',
      }}
    >
      {label}
    </span>
  );
}

// One invoice selected -> "Mark as X"; several -> "Mark Selected as X".
const actionLabel = (count, verb) => (count > 1 ? `Mark Selected as ${verb}` : `Mark as ${verb}`);

export default function AdminGstr2bDocuments() {
  const { clientId, period } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [filters, setFilters] = useState({
    supplier_gstin: '',
    supplier_name: '',
    invoice_number: '',
    date_from: '',
    date_to: '',
  });
  const [applied, setApplied] = useState({});

  const [selected, setSelected] = useState([]);
  const [bulkMatch, setBulkMatch] = useState('');
  const [bulkItc, setBulkItc] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);

  const load = useCallback(
    (pg = 1, f = applied) => {
      setLoading(true);
      const params = new URLSearchParams({ page: pg, ...f });
      api(`/admin/clients/${clientId}/gstr2b/period/${period}/invoices?${params}`)
        .then((d) => {
          setData(d);
          setSelected([]);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    },
    [clientId, period, applied]
  );

  useEffect(() => {
    load(page);
  }, [clientId, period, page]);

  const applyFilters = () => {
    setApplied({ ...filters });
    setPage(1);
    load(1, filters);
  };

  const clearFilters = () => {
    const empty = { supplier_gstin: '', supplier_name: '', invoice_number: '', date_from: '', date_to: '' };
    setFilters(empty);
    setApplied({});
    setPage(1);
    load(1, {});
  };

  const applyBulkMatch = async () => {
    if (!selected.length || !bulkMatch) return;
    setBulkLoading(true);
    try {
      await api(`/admin/clients/${clientId}/gstr2b/invoices/bulk-status`, {
        method: 'POST',
        body: { ids: selected, match_status: bulkMatch },
      });
      setBulkMatch('');
      setSelected([]);
      load(page);
    } catch (e) {
      alert(e.message);
    } finally {
      setBulkLoading(false);
    }
  };

  const applyBulkItc = async () => {
    if (!selected.length || !bulkItc) return;
    setBulkLoading(true);
    try {
      await api(`/admin/clients/${clientId}/gstr2b/invoices/bulk-status`, {
        method: 'POST',
        body: { ids: selected, itc_eligibility: bulkItc },
      });
      setBulkItc('');
      setSelected([]);
      load(page);
    } catch (e) {
      alert(e.message);
    } finally {
      setBulkLoading(false);
    }
  };

  const toggleAll = () => {
    const ids = (data?.invoices?.data ?? data?.data ?? []).map((r) => r.id);
    setSelected((s) => (s.length === ids.length ? [] : ids));
  };

  const summ = data?.summary ?? {};
  const rows = data?.invoices?.data ?? data?.data ?? [];
  const meta = data?.invoices ?? data ?? {};
  const client = data?.client ?? {};
  const pLabel = periodLabel(period);
  const freqLabel = client.filing_frequency === 'quarterly' ? 'Quarterly' : 'Monthly';

  const totalInvoices = summ.total_invoices ?? meta.total ?? 0;
  const matchedInvoices = summ.matched ?? 0;
  const unmatchedInvoices = summ.unmatched ?? 0;
  const matchedItc = summ.matched_itc ?? 0;
  const unmatchedItc = summ.unmatched_itc ?? 0;

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", padding: '16px 20px 60px' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, fontSize: 13 }}>
        <Link to="/admin/gst-returns?tab=gstr-2b" style={bcLink}>
          GST Compliance
        </Link>
        <span style={bcSep}>›</span>
        <Link to="/admin/gst-returns?tab=gstr-2b" style={bcLink}>
          GSTR-2B
        </Link>
        <span style={bcSep}>›</span>
        <Link to={`/admin/gst-returns/gstr-2b/${clientId}`} style={bcLink}>
          {client.business_name || 'Client Details'}
        </Link>
        <span style={bcSep}>›</span>
        <Link to={`/admin/gst-returns/gstr-2b/${clientId}/period/${period}`} style={bcLink}>
          {pLabel}
        </Link>
        <span style={bcSep}>›</span>
        <span style={{ color: '#1e3a8a', fontWeight: 700 }}>Uploaded Documents</span>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#1e3a8a', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            Uploaded GSTR-2B Documents – {pLabel}
          </h1>
          <div style={{ marginTop: 6, fontSize: 13, color: '#64748b', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: '#1e293b', fontWeight: 600 }}>{client.business_name || '—'}</span>
            <span style={{ color: '#cbd5e1' }}>|</span>
            <span>
              GSTIN: <strong style={{ color: '#1e293b', fontWeight: 600 }}>{client.gstin || '—'}</strong>
            </span>
            <span style={{ color: '#cbd5e1' }}>|</span>
            <span>
              Filing Frequency: <strong style={{ color: '#1d4ed8', fontWeight: 700 }}>{freqLabel}</strong>
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate(`/admin/gst-returns/gstr-2b/${clientId}/period/${period}`)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '8px 18px',
            background: '#fff',
            border: '1.5px solid #bfdbfe',
            borderRadius: 8,
            fontSize: 13.5,
            fontWeight: 600,
            color: '#1d4ed8',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all .15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#f8fbff';
            e.currentTarget.style.borderColor = '#93c5fd';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#fff';
            e.currentTarget.style.borderColor = '#bfdbfe';
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back to GSTR-2B ({pLabel})
        </button>
      </div>

      {/* Search & Filters Card */}
      <div
        style={{
          background: '#fff',
          border: '1.5px solid #bfdbfe',
          borderRadius: 12,
          padding: '16px 20px',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.3fr 1.3fr 1.8fr auto', gap: 14, alignItems: 'flex-end' }}>
          {/* Supplier GSTIN */}
          <div>
            <label style={filterLabel}>Supplier GSTIN</label>
            <input
              type="text"
              value={filters.supplier_gstin}
              onChange={(e) => setFilters((x) => ({ ...x, supplier_gstin: e.target.value }))}
              placeholder="Search GSTIN..."
              style={filterInput}
              onFocus={(e) => (e.target.style.borderColor = '#2563eb')}
              onBlur={(e) => (e.target.style.borderColor = '#bfdbfe')}
            />
          </div>

          {/* Supplier Name */}
          <div>
            <label style={filterLabel}>Supplier Name</label>
            <input
              type="text"
              value={filters.supplier_name}
              onChange={(e) => setFilters((x) => ({ ...x, supplier_name: e.target.value }))}
              placeholder="Search Supplier..."
              style={filterInput}
              onFocus={(e) => (e.target.style.borderColor = '#2563eb')}
              onBlur={(e) => (e.target.style.borderColor = '#bfdbfe')}
            />
          </div>

          {/* Invoice No. */}
          <div>
            <label style={filterLabel}>Invoice No.</label>
            <input
              type="text"
              value={filters.invoice_number}
              onChange={(e) => setFilters((x) => ({ ...x, invoice_number: e.target.value }))}
              placeholder="Search Invoice No..."
              style={filterInput}
              onFocus={(e) => (e.target.style.borderColor = '#2563eb')}
              onBlur={(e) => (e.target.style.borderColor = '#bfdbfe')}
            />
          </div>

          {/* Invoice Date Range */}
          <div>
            <label style={filterLabel}>Invoice Date</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type="date"
                  value={filters.date_from}
                  onChange={(e) => setFilters((x) => ({ ...x, date_from: e.target.value }))}
                  style={{ ...filterInput, paddingRight: 8 }}
                  onFocus={(e) => (e.target.style.borderColor = '#2563eb')}
                  onBlur={(e) => (e.target.style.borderColor = '#bfdbfe')}
                />
              </div>
              <span style={{ color: '#94a3b8', fontSize: 13, fontWeight: 500 }}>To</span>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type="date"
                  value={filters.date_to}
                  onChange={(e) => setFilters((x) => ({ ...x, date_to: e.target.value }))}
                  style={{ ...filterInput, paddingRight: 8 }}
                  onFocus={(e) => (e.target.style.borderColor = '#2563eb')}
                  onBlur={(e) => (e.target.style.borderColor = '#bfdbfe')}
                />
              </div>
            </div>
          </div>

          {/* Buttons: Search + Reset */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              type="button"
              onClick={applyFilters}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                height: 38,
                padding: '0 20px',
                background: '#1d4ed8',
                border: 'none',
                borderRadius: 7,
                fontSize: 13.5,
                fontWeight: 600,
                color: '#fff',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'background .15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#1e40af')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#1d4ed8')}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              Search
            </button>

            <button
              type="button"
              onClick={clearFilters}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                height: 38,
                padding: '0 18px',
                background: '#fff',
                border: '1.5px solid #bfdbfe',
                borderRadius: 7,
                fontSize: 13.5,
                fontWeight: 600,
                color: '#1e3a8a',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all .15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f8fbff';
                e.currentTarget.style.borderColor = '#93c5fd';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#fff';
                e.currentTarget.style.borderColor = '#bfdbfe';
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards Row (5 Cards) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 14, marginBottom: 16 }}>
        {/* Card 1: Total Invoices */}
        <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500, marginBottom: 2 }}>Total Invoices</div>
            <div style={{ fontWeight: 700, fontSize: 20, color: '#312e81' }}>{totalInvoices.toLocaleString('en-IN')}</div>
          </div>
        </div>

        {/* Card 2: Matched Invoices */}
        <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <polyline points="9 15 11 17 15 13" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500, marginBottom: 2 }}>Matched Invoices</div>
            <div style={{ fontWeight: 700, fontSize: 20, color: '#16a34a' }}>{matchedInvoices.toLocaleString('en-IN')}</div>
          </div>
        </div>

        {/* Card 3: Unmatched Invoices */}
        <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="9" y1="13" x2="15" y2="19" />
              <line x1="15" y1="13" x2="9" y2="19" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500, marginBottom: 2 }}>Unmatched Invoices</div>
            <div style={{ fontWeight: 700, fontSize: 20, color: '#dc2626' }}>{unmatchedInvoices.toLocaleString('en-IN')}</div>
          </div>
        </div>

        {/* Card 4: Matched ITC Amount */}
        <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500, marginBottom: 2 }}>Matched ITC Amount</div>
            <div style={{ fontWeight: 700, fontSize: 17, color: '#16a34a' }}>₹ {R2(matchedItc)}</div>
          </div>
        </div>

        {/* Card 5: Unmatched ITC Amount */}
        <div style={{ background: '#fff1f2', border: '1.5px solid #fecaca', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: '#ffe4e6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500, marginBottom: 2 }}>Unmatched ITC Amount</div>
            <div style={{ fontWeight: 700, fontSize: 17, color: '#dc2626' }}>₹ {R2(unmatchedItc)}</div>
          </div>
        </div>
      </div>

      {/* Documents Table Card */}
      <div style={{ background: '#fff', border: '1.5px solid #bfdbfe', borderRadius: 12, overflow: 'hidden' }}>
        {/* Table Card Header & Bulk Actions */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1.5px solid #bfdbfe',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 16.5, color: '#1e3a8a' }}>
            Uploaded Documents ({totalInvoices})
          </div>

          {/* Bulk Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            {selected.length > 0 && (
              <span style={{ fontSize: 13, color: '#1d4ed8', fontWeight: 600 }}>
                {selected.length} selected
              </span>
            )}

            {/* Bulk ITC Eligibility */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#334155', fontWeight: 600 }}>ITC Eligibility</span>
              <div style={{ position: 'relative' }}>
                <select
                  value={bulkItc}
                  onChange={(e) => setBulkItc(e.target.value)}
                  disabled={!selected.length}
                  style={{ ...bulkSelectStyle, opacity: selected.length ? 1 : 0.6 }}
                >
                  <option value="">Select Action</option>
                  <option value="eligible">{actionLabel(selected.length, 'Eligible')}</option>
                  <option value="ineligible">{actionLabel(selected.length, 'Ineligible')}</option>
                </select>
                <SelectChevron />
              </div>
              <button
                type="button"
                onClick={applyBulkItc}
                disabled={bulkLoading || !selected.length || !bulkItc}
                style={{
                  ...applyBtnStyle,
                  background: selected.length && bulkItc ? '#1d4ed8' : '#e2e8f0',
                  color: selected.length && bulkItc ? '#fff' : '#94a3b8',
                  cursor: selected.length && bulkItc ? 'pointer' : 'not-allowed',
                }}
              >
                Apply
              </button>
            </div>

            {/* Bulk Reconciliation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#334155', fontWeight: 600 }}>Reconciliation</span>
              <div style={{ position: 'relative' }}>
                <select
                  value={bulkMatch}
                  onChange={(e) => setBulkMatch(e.target.value)}
                  disabled={!selected.length}
                  style={{ ...bulkSelectStyle, opacity: selected.length ? 1 : 0.6 }}
                >
                  <option value="">Select Action</option>
                  <option value="matched">{actionLabel(selected.length, 'Matched')}</option>
                  <option value="unmatched">{actionLabel(selected.length, 'Unmatched')}</option>
                </select>
                <SelectChevron />
              </div>
              <button
                type="button"
                onClick={applyBulkMatch}
                disabled={bulkLoading || !selected.length || !bulkMatch}
                style={{
                  ...applyBtnStyle,
                  background: selected.length && bulkMatch ? '#1d4ed8' : '#e2e8f0',
                  color: selected.length && bulkMatch ? '#fff' : '#94a3b8',
                  cursor: selected.length && bulkMatch ? 'pointer' : 'not-allowed',
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: '#eaf3fd', borderBottom: '1.5px solid #bfdbfe' }}>
                <th style={{ ...thStyle, width: 36, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && selected.length === rows.length}
                    onChange={toggleAll}
                    style={{ width: 16, height: 16, accentColor: '#1d4ed8', cursor: 'pointer' }}
                  />
                </th>
                <th style={{ ...thStyle, width: 40, textAlign: 'center' }}>#</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>Supplier GSTIN</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>Supplier Name</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>Invoice No.</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Invoice Date</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Taxable Value (₹)</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>IGST (₹)</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>CGST (₹)</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>SGST (₹)</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Total ITC (₹)</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>ITC Eligibility</th>
                <th style={{ ...thStyle, textAlign: 'center', borderRight: 'none' }}>Reconciliation Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={13} style={{ padding: 48, textAlign: 'center', color: '#64748b', fontSize: 14 }}>
                    Loading documents...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={13} style={{ padding: 48, textAlign: 'center', color: '#64748b', fontSize: 14 }}>
                    No GSTR-2B documents found for this period.
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => {
                  const isChecked = selected.includes(r.id);
                  const taxable = r.taxable_value ?? r.taxable_amount ?? 0;
                  const igst = r.igst ?? r.igst_amount ?? 0;
                  const cgst = r.cgst ?? r.cgst_amount ?? 0;
                  const sgst = r.sgst ?? r.sgst_amount ?? 0;
                  const totalItcVal = r.total_gst ?? igst + cgst + sgst;
                  const eligibilityBadge = ELIGIBILITY_BADGE[r.itc_eligibility] ?? ['Select', ...GREY];
                  const matchBadge = MATCH_BADGE[r.match_status] ?? MATCH_BADGE.pending;

                  return (
                    <tr
                      key={r.id}
                      style={{
                        borderBottom: '1px solid #e2e8f0',
                        background: isChecked ? '#eff6ff' : '#fff',
                        transition: 'background .1s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isChecked) e.currentTarget.style.background = '#f8fbff';
                      }}
                      onMouseLeave={(e) => {
                        if (!isChecked) e.currentTarget.style.background = '#fff';
                      }}
                    >
                      {/* Checkbox */}
                      <td style={{ ...tdCell, textAlign: 'center', width: 36 }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() =>
                            setSelected((s) => (s.includes(r.id) ? s.filter((x) => x !== r.id) : [...s, r.id]))
                          }
                          style={{ width: 16, height: 16, accentColor: '#1d4ed8', cursor: 'pointer' }}
                        />
                      </td>

                      {/* # */}
                      <td style={{ ...tdCell, textAlign: 'center', color: '#64748b' }}>
                        {(page - 1) * (meta.per_page ?? 10) + i + 1}
                      </td>

                      {/* Supplier GSTIN */}
                      <td style={{ ...tdCell, color: '#1e293b', fontWeight: 600 }}>
                        {r.supplier_gstin || '—'}
                      </td>

                      {/* Supplier Name */}
                      <td style={{ ...tdCell, color: '#1e293b', fontWeight: 500 }}>
                        {r.supplier_name || '—'}
                      </td>

                      {/* Invoice No. */}
                      <td style={{ ...tdCell, color: '#1d4ed8', fontWeight: 600 }}>
                        {r.invoice_number || '—'}
                      </td>

                      {/* Invoice Date */}
                      <td style={{ ...tdCell, textAlign: 'center', color: '#334155', whiteSpace: 'nowrap' }}>
                        {formatDate(r.invoice_date)}
                      </td>

                      {/* Taxable Value (₹) */}
                      <td style={{ ...tdCell, textAlign: 'right', color: '#334155', fontWeight: 500 }}>
                        {R2(taxable)}
                      </td>

                      {/* IGST (₹) */}
                      <td style={{ ...tdCell, textAlign: 'right', color: '#334155' }}>
                        {R2(igst)}
                      </td>

                      {/* CGST (₹) */}
                      <td style={{ ...tdCell, textAlign: 'right', color: '#334155' }}>
                        {R2(cgst)}
                      </td>

                      {/* SGST (₹) */}
                      <td style={{ ...tdCell, textAlign: 'right', color: '#334155' }}>
                        {R2(sgst)}
                      </td>

                      {/* Total ITC (₹) */}
                      <td style={{ ...tdCell, textAlign: 'right', color: '#1e293b', fontWeight: 700 }}>
                        {R2(totalItcVal)}
                      </td>

                      {/* ITC Eligibility (changed only through the action bar above) */}
                      <td style={{ ...tdCell, textAlign: 'center' }}>
                        <StatusBadge spec={eligibilityBadge} />
                      </td>

                      {/* Reconciliation Status */}
                      <td style={{ ...tdCell, textAlign: 'center', borderRight: 'none' }}>
                        <StatusBadge spec={matchBadge} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1.5px solid #bfdbfe',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 13,
            color: '#1e3a8a',
          }}
        >
          <span style={{ fontWeight: 600 }}>
            Showing {meta.total === 0 ? 0 : (page - 1) * (meta.per_page ?? 10) + 1} to{' '}
            {Math.min(page * (meta.per_page ?? 10), meta.total ?? 0)} of {meta.total ?? 0} records
          </span>

          {meta.last_page > 1 && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <PgBtn disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                ‹
              </PgBtn>

              {Array.from({ length: meta.last_page }, (_, j) => j + 1)
                .filter((n) => n === 1 || n === meta.last_page || Math.abs(n - page) <= 2)
                .reduce((acc, n, idx, arr) => {
                  if (idx > 0 && n - arr[idx - 1] > 1) {
                    acc.push(
                      <span key={`ellip-${n}`} style={{ padding: '0 6px', color: '#64748b', fontSize: 13 }}>
                        ...
                      </span>
                    );
                  }
                  acc.push(
                    <PgBtn key={n} active={n === page} onClick={() => setPage(n)}>
                      {n}
                    </PgBtn>
                  );
                  return acc;
                }, [])}

              <PgBtn disabled={page === meta.last_page} onClick={() => setPage((p) => p + 1)}>
                ›
              </PgBtn>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Styles & Components ──────────────────────────────────────────────────────
const bcLink = { color: '#2563eb', textDecoration: 'none', fontWeight: 600 };
const bcSep = { color: '#2563eb', fontWeight: 700, margin: '0 2px' };

const filterLabel = {
  fontSize: 12,
  fontWeight: 600,
  color: '#334155',
  display: 'block',
  marginBottom: 4,
};

const filterInput = {
  width: '100%',
  padding: '7px 12px',
  border: '1.5px solid #bfdbfe',
  borderRadius: 7,
  fontSize: 13,
  color: '#1e293b',
  outline: 'none',
  boxSizing: 'border-box',
  background: '#fff',
};

const bulkSelectStyle = {
  padding: '5px 24px 5px 10px',
  border: '1.5px solid #bfdbfe',
  borderRadius: 6,
  fontSize: 12.5,
  fontWeight: 500,
  color: '#1e293b',
  background: '#fff',
  appearance: 'none',
  cursor: 'pointer',
  outline: 'none',
};

const applyBtnStyle = {
  padding: '5px 16px',
  border: 'none',
  borderRadius: 6,
  fontSize: 12.5,
  fontWeight: 600,
  whiteSpace: 'nowrap',
  transition: 'background .15s ease',
};

const thStyle = {
  padding: '10px 10px',
  fontWeight: 700,
  color: '#1e3a8a',
  fontSize: 12,
  whiteSpace: 'nowrap',
  borderRight: '1px solid #bfdbfe',
};

const tdCell = {
  padding: '10px 10px',
  verticalAlign: 'middle',
  fontSize: 12.5,
  borderRight: '1px solid #dbeafe',
};

const SelectChevron = () => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#1d4ed8"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const PgBtn = ({ children, active, disabled, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    style={{
      minWidth: 32,
      height: 32,
      padding: '0 8px',
      border: active ? 'none' : '1.5px solid #bfdbfe',
      borderRadius: 6,
      background: active ? '#1d4ed8' : disabled ? '#f8fafc' : '#fff',
      color: active ? '#fff' : disabled ? '#94a3b8' : '#1d4ed8',
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontSize: 13,
      fontWeight: active ? 700 : 600,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all .15s ease',
    }}
  >
    {children}
  </button>
);
