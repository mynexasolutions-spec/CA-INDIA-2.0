import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/client';
import { exportRows, HSN_COLUMNS, documentColumns, STATE_COLUMNS } from './gstExport';

const RETURN_LABELS = { GSTR1: 'GSTR-1', GSTR3B: 'GSTR-3B', CMP08: 'CMP-08' };

const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('en-IN'));
const shortDesc = (s) => (!s ? '—' : s.length > 30 ? s.slice(0, 28) + '...' : s);
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '—');

export default function AdminGstr1Review({ returnType = 'GSTR1' }) {
  const { clientId, period } = useParams();
  const navigate = useNavigate();
  const label = RETURN_LABELS[returnType] ?? 'GSTR-1';
  const listTab = returnType === 'GSTR1' ? 'gstr-1' : returnType === 'GSTR3B' ? 'gstr-3b' : 'cmp-08';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('summary');
  const [popup, setPopup] = useState(null);
  const [exportFmt, setExportFmt] = useState('');
  const [formatOpen, setFormatOpen] = useState(false);
  const [marking, setMarking] = useState(false);
  const [filedPopup, setFiledPopup] = useState(false);
  const [filedOn, setFiledOn] = useState('');
  const [arnVal, setArnVal] = useState('');
  const [filedErr, setFiledErr] = useState('');

  // B2B tab state
  const [b2bDocType, setB2bDocType] = useState('');
  const [b2bFmt, setB2bFmt] = useState('');
  const [b2bDocs, setB2bDocs] = useState(null);
  const [b2bPage, setB2bPage] = useState(1);
  const [b2bLoading, setB2bLoading] = useState(false);

  // B2C tab state
  const [b2cDocType, setB2cDocType] = useState('');
  const [b2cFmt, setB2cFmt] = useState('');
  const [b2cView, setB2cView] = useState('invoice'); // 'invoice' | 'state'
  const [b2cDocs, setB2cDocs] = useState(null);
  const [b2cPage, setB2cPage] = useState(1);
  const [b2cLoading, setB2cLoading] = useState(false);
  const [b2cSummary, setB2cSummary] = useState(null);
  const [b2cSumLoading, setB2cSumLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api(`/admin/gst-returns/${clientId}/review/${period}?return_type=${returnType}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [clientId, period, returnType]);

  useEffect(() => {
    if (tab !== 'b2b') return;
    setB2bLoading(true);
    api(`/admin/gst-returns/${clientId}/b2b/${period}?doc_type=${b2bDocType}&page=${b2bPage}`)
      .then(setB2bDocs)
      .catch(() => {})
      .finally(() => setB2bLoading(false));
  }, [tab, b2bDocType, b2bPage, clientId, period]);

  useEffect(() => {
    if (tab !== 'b2c' || b2cView !== 'invoice') return;
    setB2cLoading(true);
    api(`/admin/gst-returns/${clientId}/b2c/${period}?doc_type=${b2cDocType}&page=${b2cPage}`)
      .then(setB2cDocs)
      .catch(() => {})
      .finally(() => setB2cLoading(false));
  }, [tab, b2cDocType, b2cPage, b2cView, clientId, period]);

  useEffect(() => {
    if (tab !== 'b2c' || b2cView !== 'state') return;
    setB2cSumLoading(true);
    api(`/admin/gst-returns/${clientId}/b2c-summary/${period}?doc_type=${b2cDocType}`)
      .then(setB2cSummary)
      .catch(() => {})
      .finally(() => setB2cSumLoading(false));
  }, [tab, b2cDocType, b2cView, clientId, period]);

  const openFiledPopup = () => {
    setFiledOn('');
    setArnVal('');
    setFiledErr('');
    setFiledPopup(true);
  };

  const submitMarkFiled = async () => {
    if (!filedOn || !arnVal.trim()) {
      setFiledErr('Both fields are mandatory.');
      return;
    }
    setMarking(true);
    setFiledErr('');
    try {
      const res = await api(`/admin/gst-returns/${clientId}`, {
        method: 'POST',
        body: { tax_period: period, return_type: returnType, status: 'filed', filed_on: filedOn, arn: arnVal.trim() },
      });
      setData((d) => ({ ...d, filing_status: 'filed', filed_on: res.filed_on, arn: res.arn }));
      setFiledPopup(false);
    } catch (e) {
      setFiledErr(e.message);
    } finally {
      setMarking(false);
    }
  };

  const [hsnExporting, setHsnExporting] = useState(false);
  const handleExport = async () => {
    if (!exportFmt || !data || hsnExporting) return;
    setHsnExporting(true);
    try {
      await exportRows({
        rows: data.hsn_summary,
        columns: HSN_COLUMNS,
        fmt: exportFmt,
        name: `hsn_summary_${period}`,
        sheetName: 'HSN Summary',
      });
    } finally {
      setHsnExporting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b', fontSize: 15, fontWeight: 500 }}>
        Loading review data...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: '#dc2626', fontSize: 15 }}>
        Error: {error}
      </div>
    );
  }

  if (!data) return null;

  const { client, period_label, due_date, filing_status, filed_on, arn, doc_summary = [], hsn_summary = [] } = data;
  const isFiled = filing_status === 'filed';
  const isRegular = (client.dealer_type || '').toLowerCase() === 'regular';
  const clientCode = client.client_code || `CL-${String(client.id).padStart(3, '0')}`;

  // Totals for document summary
  const totals = doc_summary.reduce(
    (a, r) => ({
      count: a.count + (r.count || 0),
      taxable: a.taxable + (r.taxable || 0),
      igst: a.igst + (r.igst || 0),
      cgst: a.cgst + (r.cgst || 0),
      sgst: a.sgst + (r.sgst || 0),
      total: a.total + (r.total || 0),
    }),
    { count: 0, taxable: 0, igst: 0, cgst: 0, sgst: 0, total: 0 }
  );

  // Totals for HSN summary
  const hsnTotals = hsn_summary.reduce(
    (a, r) => ({
      qty: a.qty + (r.qty || 0),
      taxable: a.taxable + (r.taxable || 0),
      igst: a.igst + (r.igst || 0),
      cgst: a.cgst + (r.cgst || 0),
      sgst: a.sgst + (r.sgst || 0),
    }),
    { qty: 0, taxable: 0, igst: 0, cgst: 0, sgst: 0 }
  );

  // When a B2B/B2C document type is chosen the page switches to the supplies list header
  const suppliesKind = tab === 'b2b' ? 'B2B' : tab === 'b2c' ? 'B2C' : null;
  const suppliesDocType = tab === 'b2b' ? b2bDocType : tab === 'b2c' ? b2cDocType : '';
  const detailView = !!suppliesKind && !!suppliesDocType;
  const detailDocLabel = DOC_TYPE_SINGULAR[suppliesDocType];

  return (
    <div style={{ fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif", padding: '0 0 40px' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 13 }}>
        <Link to="/admin/gst-returns" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>
          GST Compliance
        </Link>
        <span style={{ color: '#2563eb', fontWeight: 600, fontSize: 13 }}>&gt;</span>
        {detailView ? (
          <>
            <span style={{ color: '#2563eb', fontWeight: 500 }}>{suppliesKind} Supplies</span>
            <span style={{ color: '#2563eb', fontWeight: 600, fontSize: 13 }}>&gt;</span>
            <span style={{ color: '#2563eb', fontWeight: 600 }}>{detailDocLabel}</span>
          </>
        ) : (
          <>
            <Link to={`/admin/gst-returns?tab=${listTab}`} style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>
              {label}
            </Link>
            <span style={{ color: '#2563eb', fontWeight: 600, fontSize: 13 }}>&gt;</span>
            <Link to={`/admin/gst-returns/${listTab}/${clientId}`} style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>
              {client.business_name || client.client_name}
            </Link>
            <span style={{ color: '#2563eb', fontWeight: 600, fontSize: 13 }}>&gt;</span>
            <span style={{ color: '#2563eb', fontWeight: 600 }}>{period_label}</span>
          </>
        )}
      </div>

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#1e3a8a', lineHeight: 1.2 }}>
            {detailView ? `${suppliesKind} Supplies - ${detailDocLabel}` : `${label} – ${period_label} (Review)`}
          </h1>
          <p style={{ margin: '5px 0 0', fontSize: 13.5, color: '#475569', fontWeight: 400 }}>
            {detailView
              ? suppliesKind === 'B2B'
                ? `View the complete list of ${DOC_TYPE_LABELS[suppliesDocType]} issued for the selected period. You can search, filter, and download the data.`
                : `View the complete list of ${suppliesKind} Invoices issued for the selected period. You can view state-wise summary and export the data.`
              : 'Review the invoice summary and documents for the selected period. The data is fetched from your billing documents.'}
          </p>
        </div>
        {detailView ? null : !isFiled ? (
          <button
            type="button"
            onClick={openFiledPopup}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 24px',
              background: '#1d4ed8',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              color: '#fff',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'background .15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#1e40af')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#1d4ed8')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Mark as Filed
          </button>
        ) : (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 22px',
              background: '#dcfce7',
              borderRadius: 8,
              fontSize: 13.5,
              fontWeight: 700,
              color: '#16a34a',
              border: '1.5px solid #bbf7d0',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Filed
          </span>
        )}
      </div>

      {/* 3 Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 20,
          marginBottom: 16,
          border: '1.5px solid #bfdbfe',
          borderRadius: 12,
          padding: '16px 20px',
          background: '#fff',
        }}
      >
        {/* Card 1: Client Info */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: '#e0f2fe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <SkylineIcon />
            </div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 15,
                  color: '#0f172a',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {client.business_name || client.client_name}
              </span>
              <span
                style={{
                  padding: '2px 10px',
                  borderRadius: 9999,
                  fontSize: 12,
                  fontWeight: 600,
                  background: client.is_active ? '#dcfce7' : '#fee2e2',
                  color: client.is_active ? '#16a34a' : '#dc2626',
                  flexShrink: 0,
                }}
              >
                {client.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              <tr>
                <td style={lblCell}>Client ID</td>
                <td style={colonCell}>:</td>
                <td style={valCell}>{clientCode}</td>
              </tr>
              <tr>
                <td style={lblCell}>GSTIN</td>
                <td style={colonCell}>:</td>
                <td style={valCell}>{client.gstin || '—'}</td>
              </tr>
              <tr>
                <td style={lblCell}>Registration Type</td>
                <td style={colonCell}>:</td>
                <td style={valCell}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 12px',
                      borderRadius: 9999,
                      fontSize: 12,
                      fontWeight: 600,
                      background: isRegular ? '#dcfce7' : '#dbeafe',
                      color: isRegular ? '#16a34a' : '#1d4ed8',
                    }}
                  >
                    {cap(client.dealer_type)}
                  </span>
                </td>
              </tr>
              <tr>
                <td style={lblCell}>Filing Frequency</td>
                <td style={colonCell}>:</td>
                <td style={valCell}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 12px',
                      borderRadius: 9999,
                      fontSize: 12,
                      fontWeight: 600,
                      background: '#dbeafe',
                      color: '#1d4ed8',
                    }}
                  >
                    {cap(client.filing_frequency)}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Card 2: Tax Period */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: '#e0f2fe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <CalendarIcon />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>Tax Period</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1e3a8a', margin: '2px 0 8px' }}>
              {period_label}
            </div>
            <div style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>Due Date</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#1e3a8a', marginTop: 2 }}>
              {due_date}
            </div>
          </div>
        </div>

        {/* Card 3: Filing Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: '#e0f2fe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <DocStatusIcon />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: '#475569', fontWeight: 500, marginBottom: 4 }}>Filing Status</div>
            <div style={{ marginBottom: 8 }}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '4px 30px',
                  borderRadius: 9999,
                  fontSize: 13,
                  fontWeight: 700,
                  background: isFiled ? '#dcfce7' : '#fee2e2',
                  color: isFiled ? '#16a34a' : '#dc2626',
                }}
              >
                {isFiled ? 'Filed' : 'Pending'}
              </span>
            </div>
            {[
              ['Filed On', filed_on],
              ['ARN', arn],
            ].map(([k, v]) => (
              <div
                key={k}
                style={{ display: 'grid', gridTemplateColumns: '62px 12px minmax(0, 1fr)', alignItems: 'start', fontSize: 13, padding: '2px 0' }}
              >
                <span style={{ color: '#475569', fontWeight: 500 }}>{k}</span>
                <span style={{ color: '#64748b' }}>:</span>
                <span style={{ color: '#1e293b', fontWeight: 500, wordBreak: 'break-all', overflowWrap: 'anywhere' }}>{v || '—'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          marginBottom: 16,
          background: '#fff',
          border: '1.5px solid #bfdbfe',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        {[
          { id: 'summary', icon: <ChartIcon />, label: 'Summary' },
          { id: 'b2b', icon: <B2BIcon />, label: 'B2B Supplies (Registered Persons)' },
          { id: 'b2c', icon: <B2CIcon />, label: 'B2C Supplies (Unregistered Persons)' },
        ].map((t, i) => {
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 24px',
                border: 'none',
                borderRight: i < 2 ? '1px solid #bfdbfe' : 'none',
                background: isActive ? '#1d4ed8' : '#fff',
                color: isActive ? '#fff' : '#1e3a8a',
                fontSize: 14,
                fontWeight: isActive ? 700 : 600,
                cursor: 'pointer',
                transition: 'all .15s',
                flex: 1,
                justifyContent: 'center',
              }}
            >
              {t.icon}
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'summary' && (
        <>
          {/* Document Type Summary */}
          <div style={{ background: '#fff', border: '1.5px solid #bfdbfe', borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1.5px solid #bfdbfe' }}>
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  background: '#1d4ed8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              <span style={{ fontWeight: 700, fontSize: 15, color: '#1e3a8a' }}>
                Document Type Summary
              </span>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead>
                <tr style={{ background: '#eaf3fd', borderBottom: '1.5px solid #bfdbfe' }}>
                  <th style={sumTh('Document Type', 'left')}>Document Type</th>
                  <th style={sumTh('No. of Documents', 'center')}>No. of Documents</th>
                  <th style={sumTh('Taxable Value (₹)', 'center')}>Taxable Value (₹)</th>
                  <th style={sumTh('IGST (₹)', 'center')}>IGST (₹)</th>
                  <th style={sumTh('CGST (₹)', 'center')}>CGST (₹)</th>
                  <th style={sumTh('SGST (₹)', 'center')}>SGST (₹)</th>
                  <th style={{ ...sumTh('Total Invoice Value (₹)', 'center'), borderRight: 'none' }}>Total Invoice Value (₹)</th>
                </tr>
              </thead>
              <tbody>
                {doc_summary.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ padding: 36, textAlign: 'center', color: '#94a3b8' }}>
                      No documents found for this period.
                    </td>
                  </tr>
                ) : (
                  doc_summary.map((r, i) => (
                    <tr
                      key={i}
                      style={{ borderBottom: '1px solid #e2e8f0', transition: 'background .15s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1e293b', borderRight: '1px solid #bfdbfe' }}>
                        {r.type}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', borderRight: '1px solid #bfdbfe' }}>
                        <button
                          type="button"
                          onClick={() => setPopup(r)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#2563eb',
                            fontWeight: 600,
                            fontSize: 13.5,
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            padding: 0,
                          }}
                        >
                          {r.count}
                        </button>
                      </td>
                      <td style={sumTd}>{fmt(r.taxable)}</td>
                      <td style={sumTd}>{fmt(r.igst)}</td>
                      <td style={sumTd}>{fmt(r.cgst)}</td>
                      <td style={sumTd}>{fmt(r.sgst)}</td>
                      <td style={{ ...sumTd, borderRight: 'none', fontWeight: 600 }}>{fmt(r.total)}</td>
                    </tr>
                  ))
                )}
                {doc_summary.length > 0 && (
                  <tr style={{ background: '#eaf3fd', fontWeight: 700 }}>
                    <td style={{ padding: '12px 16px', color: '#1e3a8a', borderRight: '1px solid #bfdbfe' }}>Total</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', color: '#1e3a8a', borderRight: '1px solid #bfdbfe' }}>
                      {totals.count}
                    </td>
                    <td style={sumTotalTd}>{fmt(totals.taxable)}</td>
                    <td style={sumTotalTd}>{fmt(totals.igst)}</td>
                    <td style={sumTotalTd}>{fmt(totals.cgst)}</td>
                    <td style={sumTotalTd}>{fmt(totals.sgst)}</td>
                    <td style={{ ...sumTotalTd, borderRight: 'none' }}>{fmt(totals.total)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* HSN/SAC Summary */}
          <div style={{ background: '#fff', border: '1.5px solid #bfdbfe', borderRadius: 8, overflow: 'visible' }}>
            <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1.5px solid #bfdbfe' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 6,
                    background: '#1d4ed8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
                  </svg>
                </div>
                <span style={{ fontWeight: 700, fontSize: 15, color: '#1e3a8a' }}>
                  HSN/SAC Summary - Outward Supplies (B2B and B2C)
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, color: '#1e3a8a', fontWeight: 600 }}>Format</span>
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setFormatOpen((v) => !v)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '6px 14px',
                      border: '1.5px solid #bfdbfe',
                      borderRadius: 6,
                      fontSize: 13,
                      color: exportFmt ? '#1e293b' : '#64748b',
                      background: '#fff',
                      cursor: 'pointer',
                      minWidth: 120,
                      fontWeight: 500,
                    }}
                  >
                    <span>
                      {exportFmt === 'excel' ? 'Excel' : exportFmt === 'csv' ? 'Predefined CSV' : exportFmt === 'json' ? 'JSON' : 'Select'}
                    </span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {formatOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        left: 0,
                        right: 0,
                        background: '#fff',
                        border: '1.5px solid #bfdbfe',
                        borderRadius: 6,
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                        zIndex: 50,
                        overflow: 'hidden',
                      }}
                    >
                      {[
                        { id: 'excel', label: 'Excel' },
                        { id: 'csv', label: 'Predefined CSV' },
                        { id: 'json', label: 'JSON' },
                      ].map((opt) => (
                        <div
                          key={opt.id}
                          onClick={() => {
                            setExportFmt(opt.id);
                            setFormatOpen(false);
                          }}
                          style={{
                            padding: '8px 12px',
                            fontSize: 13,
                            color: '#1e293b',
                            cursor: 'pointer',
                            background: exportFmt === opt.id ? '#e0f2fe' : '#fff',
                            transition: 'background .15s',
                          }}
                          onMouseEnter={(e) => {
                            if (exportFmt !== opt.id) e.currentTarget.style.background = '#f0f9ff';
                          }}
                          onMouseLeave={(e) => {
                            if (exportFmt !== opt.id) e.currentTarget.style.background = '#fff';
                          }}
                        >
                          {opt.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleExport}
                  disabled={!exportFmt || hsn_summary.length === 0 || hsnExporting}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 20px',
                    background: exportFmt && hsn_summary.length > 0 ? '#1d4ed8' : '#93c5fd',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 13.5,
                    fontWeight: 600,
                    color: '#fff',
                    cursor: exportFmt && hsn_summary.length > 0 && !hsnExporting ? 'pointer' : 'not-allowed',
                    transition: 'background .15s ease',
                  }}
                  onMouseEnter={(e) => { if (exportFmt && hsn_summary.length > 0) e.currentTarget.style.background = '#1e40af'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = exportFmt && hsn_summary.length > 0 ? '#1d4ed8' : '#93c5fd'; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  {hsnExporting ? 'Exporting…' : 'Export'}
                </button>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#eaf3fd', borderBottom: '1.5px solid #bfdbfe' }}>
                  <th style={sumTh('Code Type', 'center')}>Code Type</th>
                  <th style={sumTh('HSN/SAC Code', 'center')}>HSN/SAC Code</th>
                  <th style={sumTh('Description (Short)', 'center')}>Description (Short)</th>
                  <th style={sumTh('GST (%)', 'center')}>GST (%)</th>
                  <th style={sumTh('QTY', 'center')}>QTY</th>
                  <th style={sumTh('UQC', 'center')}>UQC</th>
                  <th style={sumTh('Taxable Value (₹)', 'center')}>Taxable Value (₹)</th>
                  <th style={sumTh('IGST (₹)', 'center')}>IGST (₹)</th>
                  <th style={sumTh('CGST (₹)', 'center')}>CGST (₹)</th>
                  <th style={{ ...sumTh('SGST (₹)', 'center'), borderRight: 'none' }}>SGST (₹)</th>
                </tr>
              </thead>
              <tbody>
                {hsn_summary.length === 0 ? (
                  <tr>
                    <td colSpan="10" style={{ padding: 36, textAlign: 'center', color: '#94a3b8' }}>
                      No HSN/SAC data found.
                    </td>
                  </tr>
                ) : (
                  hsn_summary.map((r, i) => (
                    <tr
                      key={i}
                      style={{ borderBottom: '1px solid #e2e8f0', transition: 'background .15s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                    >
                      <td style={{ padding: '10px 12px', textAlign: 'center', borderRight: '1px solid #bfdbfe' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: 20,
                            height: 20,
                            padding: '0 6px',
                            borderRadius: 4,
                            background: '#fff',
                            border: '1.5px solid #60a5fa',
                            color: '#2563eb',
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {r.code_type || 'HSN'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: '#1e293b', borderRight: '1px solid #bfdbfe' }}>
                        {r.hsn_sac || '—'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#1e293b', borderRight: '1px solid #bfdbfe' }} title={r.description}>
                        {shortDesc(r.description)}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#1e293b', borderRight: '1px solid #bfdbfe' }}>
                        {r.gst_rate}%
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#1e293b', borderRight: '1px solid #bfdbfe' }}>
                        {r.qty}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#1e293b', borderRight: '1px solid #bfdbfe' }}>
                        {r.uqc}
                      </td>
                      <td style={sumTd}>{fmt(r.taxable)}</td>
                      <td style={sumTd}>{fmt(r.igst)}</td>
                      <td style={sumTd}>{r.cgst ? fmt(r.cgst) : ''}</td>
                      <td style={{ ...sumTd, borderRight: 'none' }}>{r.sgst ? fmt(r.sgst) : ''}</td>
                    </tr>
                  ))
                )}
                {hsn_summary.length > 0 && (
                  <tr style={{ background: '#eaf3fd', fontWeight: 700 }}>
                    <td style={{ padding: '11px 12px', textAlign: 'center', color: '#1e3a8a', borderRight: '1px solid #bfdbfe' }}>
                      Total
                    </td>
                    <td style={{ padding: '11px 12px', textAlign: 'center', color: '#1e3a8a', borderRight: '1px solid #bfdbfe' }}>—</td>
                    <td style={{ padding: '11px 12px', textAlign: 'center', color: '#1e3a8a', borderRight: '1px solid #bfdbfe' }}>—</td>
                    <td style={{ padding: '11px 12px', textAlign: 'center', color: '#1e3a8a', borderRight: '1px solid #bfdbfe' }}>—</td>
                    <td style={{ padding: '11px 12px', textAlign: 'center', color: '#1e3a8a', borderRight: '1px solid #bfdbfe' }}>
                      {hsnTotals.qty}
                    </td>
                    <td style={{ padding: '11px 12px', textAlign: 'center', color: '#1e3a8a', borderRight: '1px solid #bfdbfe' }}>—</td>
                    <td style={sumTotalTd}>{fmt(hsnTotals.taxable)}</td>
                    <td style={sumTotalTd}>{fmt(hsnTotals.igst)}</td>
                    <td style={sumTotalTd}>{fmt(hsnTotals.cgst)}</td>
                    <td style={{ ...sumTotalTd, borderRight: 'none' }}>{fmt(hsnTotals.sgst)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'b2b' && (
        <SuppliesTab
          clientId={clientId}
          period={period}
          tabKey="b2b"
          docType={b2bDocType}
          setDocType={(v) => {
            setB2bDocType(v);
            setB2bPage(1);
          }}
          fmt={b2bFmt}
          setFmt={setB2bFmt}
          docs={b2bDocs}
          loading={b2bLoading}
          page={b2bPage}
          setPage={setB2bPage}
        />
      )}

      {tab === 'b2c' && (
        <B2CSuppliesTab
          clientId={clientId}
          period={period}
          docType={b2cDocType}
          setDocType={(v) => {
            setB2cDocType(v);
            setB2cPage(1);
          }}
          fmt={b2cFmt}
          setFmt={setB2cFmt}
          view={b2cView}
          setView={(v) => {
            setB2cView(v);
          }}
          docs={b2cDocs}
          loading={b2cLoading}
          page={b2cPage}
          setPage={setB2cPage}
          summary={b2cSummary}
          sumLoading={b2cSumLoading}
        />
      )}

      {/* Mark as Filed Popup */}
      {filedPopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: 480, maxWidth: '92vw', boxShadow: '0 20px 40px -8px rgba(15, 23, 42, 0.3)', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '18px 24px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 8, background: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <polyline points="9 15 11 17 15 13" />
                  </svg>
                </div>
                <span style={{ fontWeight: 700, fontSize: 18, color: '#1e3a8a' }}>Mark {label} as Filed</span>
              </div>
              <button
                type="button"
                onClick={() => setFiledPopup(false)}
                aria-label="Close"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Info banner */}
            <div style={{ margin: '0 24px', padding: '10px 14px', background: '#eaf3fd', borderRadius: 8, display: 'flex', gap: 10, alignItems: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span style={{ fontSize: 13, color: '#1e3a8a' }}>Please enter the filing details. These fields are mandatory.</span>
            </div>

            {/* Fields */}
            <div style={{ padding: '18px 24px 6px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 6 }}>
                  Filed On <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="date"
                  value={filedOn}
                  onChange={(e) => setFiledOn(e.target.value)}
                  style={{ width: '100%', height: 42, padding: '0 12px', border: '1.5px solid #bfdbfe', borderRadius: 8, fontSize: 14, color: '#1e293b', outline: 'none', boxSizing: 'border-box', background: '#fff' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 6 }}>
                  ARN <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  value={arnVal}
                  maxLength={15}
                  onChange={(e) => setArnVal(e.target.value.toUpperCase())}
                  style={{ width: '100%', height: 42, padding: '0 12px', border: '1.5px solid #bfdbfe', borderRadius: 8, fontSize: 14, color: '#1e293b', outline: 'none', boxSizing: 'border-box', background: '#fff' }}
                />
                <div style={{ fontSize: 12, color: '#475569', marginTop: 5 }}>Enter 15-digit ARN (e.g. AA2707261234567)</div>
              </div>
              {filedErr && <div style={{ fontSize: 13, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7, padding: '8px 12px' }}>{filedErr}</div>}
            </div>

            {/* Actions */}
            <div style={{ padding: '14px 24px 22px', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button
                type="button"
                onClick={() => setFiledPopup(false)}
                style={{ minWidth: 110, height: 42, background: '#e2e8f0', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, color: '#1e293b', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitMarkFiled}
                disabled={marking || !filedOn || !arnVal.trim()}
                style={{
                  minWidth: 110,
                  height: 42,
                  background: '#1d4ed8',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#fff',
                  cursor: marking || !filedOn || !arnVal.trim() ? 'not-allowed' : 'pointer',
                  opacity: marking || !filedOn || !arnVal.trim() ? 0.6 : 1,
                }}
              >
                {marking ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Detail Popup */}
      {popup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 10, width: 520, maxWidth: '92vw', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', overflow: 'hidden' }}>
            {/* Modal Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: '#1e3a8a' }}>{popup.type} - Document Details</span>
              <button
                onClick={() => setPopup(null)}
                style={{ background: 'none', border: 'none', fontSize: 18, color: '#64748b', cursor: 'pointer', lineHeight: 1, padding: 4 }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '18px 20px' }}>
              {/* Callout */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: 8,
                  marginBottom: 16,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                <span style={{ fontSize: 13, color: '#1d4ed8', fontWeight: 500 }}>
                  Document numbering details for {popup.type} ({period_label})
                </span>
              </div>

              {/* Table */}
              <div style={{ border: '1px solid #bfdbfe', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                  <thead>
                    <tr style={{ background: '#eaf3fd', borderBottom: '1.5px solid #bfdbfe' }}>
                      {['From', 'To', 'Issued', 'Cancelled'].map((h, i) => (
                        <th
                          key={h}
                          style={{
                            padding: '10px 14px',
                            textAlign: 'center',
                            fontWeight: 700,
                            color: '#1e3a8a',
                            borderRight: i < 3 ? '1px solid #bfdbfe' : 'none',
                            fontSize: 13,
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #bfdbfe' }}>
                      <td style={{ padding: '11px', textAlign: 'center', color: '#1e293b', borderRight: '1px solid #bfdbfe' }}>
                        {popup.number_from || '—'}
                      </td>
                      <td style={{ padding: '11px', textAlign: 'center', color: '#1e293b', borderRight: '1px solid #bfdbfe' }}>
                        {popup.number_to || '—'}
                      </td>
                      <td style={{ padding: '11px', textAlign: 'center', color: '#1e293b', borderRight: '1px solid #bfdbfe' }}>
                        {popup.issued ?? 0}
                      </td>
                      <td style={{ padding: '11px', textAlign: 'center', color: '#1e293b' }}>
                        {popup.cancelled ?? 0}
                      </td>
                    </tr>
                    <tr style={{ background: '#eaf3fd', fontWeight: 700 }}>
                      <td colSpan="2" style={{ padding: '10px', textAlign: 'center', color: '#1e3a8a', borderRight: '1px solid #bfdbfe' }}>
                        Total
                      </td>
                      <td style={{ padding: '10px', textAlign: 'center', color: '#1d4ed8', borderRight: '1px solid #bfdbfe' }}>
                        {popup.issued ?? 0}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'center', color: '#1d4ed8' }}>
                        {popup.cancelled ?? 0}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Close Button Footer */}
              <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setPopup(null)}
                  style={{
                    padding: '6px 22px',
                    background: '#fff',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: 6,
                    fontSize: 13.5,
                    fontWeight: 600,
                    color: '#374151',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── B2B / B2C Supplies Tabs ──────────────────────────────────────────────────
const DOC_TYPE_LABELS = {
  tax_invoice: 'Tax Invoices',
  bill_of_supply: 'Bills of Supply',
  debit_note: 'Debit Notes',
  credit_note: 'Credit Notes',
};

const DOC_TYPE_SINGULAR = {
  tax_invoice: 'Tax Invoice',
  bill_of_supply: 'Bill of Supply',
  debit_note: 'Debit Note',
  credit_note: 'Credit Note',
};

const DOC_TYPE_OPTIONS = [
  { value: '', label: 'Select' },
  ...Object.entries(DOC_TYPE_SINGULAR).map(([value, label]) => ({ value, label })),
];

const FORMAT_OPTIONS = [
  { value: '', label: 'Select' },
  { value: 'excel', label: 'Excel' },
  { value: 'csv', label: 'Predefined CSV' },
  { value: 'json', label: 'JSON' },
];

const B2C_VIEW_OPTIONS = [
  { value: 'invoice', label: 'Invoice-wise Detail' },
  { value: 'state', label: 'State-wise Summary' },
];

const num = (v) => Number(v) || 0;

function FancySelect({ label, value, options, onChange, width = 150 }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const current = options.find((o) => o.value === value) ?? options[0];

  return (
    <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label ? <span style={{ fontSize: 12.5, color: '#1e3a8a', fontWeight: 600 }}>{label}</span> : <span style={{ height: 17 }} />}
      <div style={{ position: 'relative', width }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{
            width: '100%',
            height: 38,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            padding: '0 12px',
            border: '1.5px solid #bfdbfe',
            borderRadius: 8,
            background: '#fff',
            color: '#1e293b',
            fontSize: 13.5,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <span>{current?.label}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1e3a8a" strokeWidth="3" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {open && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              minWidth: '100%',
              background: '#fff',
              border: '1.5px solid #bfdbfe',
              borderRadius: 8,
              boxShadow: '0 8px 20px rgba(30, 58, 138, 0.12)',
              padding: 4,
              zIndex: 60,
            }}
          >
            {options.map((o) => {
              const active = o.value === value;
              return (
                <div
                  key={o.value || 'none'}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  style={{
                    padding: '7px 10px',
                    borderRadius: 5,
                    fontSize: 13,
                    whiteSpace: 'nowrap',
                    color: '#1e293b',
                    cursor: 'pointer',
                    background: active ? '#dbeafe' : '#fff',
                    fontWeight: active ? 600 : 400,
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.background = '#f0f7ff';
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = '#fff';
                  }}
                >
                  {o.label}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ListShell({ controls, onExport, canExport, exporting, children }) {
  return (
    <div style={{ background: '#fff', border: '1.5px solid #bfdbfe', borderRadius: 10 }}>
      <div
        style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, alignSelf: 'center' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: '#dbeafe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 16, color: '#1e3a8a' }}>Document List</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          {controls}
          <button
            type="button"
            onClick={onExport}
            disabled={!canExport || exporting}
            style={{
              height: 38,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '0 24px',
              background: canExport ? '#1d4ed8' : '#93c5fd',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              color: '#fff',
              cursor: canExport && !exporting ? 'pointer' : 'not-allowed',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {exporting ? 'Exporting…' : 'Export'}
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

const dlTh = {
  padding: '12px 10px',
  textAlign: 'center',
  fontWeight: 700,
  color: '#1e3a8a',
  fontSize: 12.5,
  whiteSpace: 'nowrap',
  borderRight: '1px solid #bfdbfe',
  background: '#eaf3fd',
};

const dlTd = {
  padding: '11px 10px',
  textAlign: 'center',
  color: '#1e293b',
  fontSize: 13,
  borderRight: '1px solid #bfdbfe',
  borderBottom: '1px solid #e2e8f0',
};

const dlTotal = {
  padding: '13px 10px',
  textAlign: 'center',
  color: '#1e3a8a',
  fontWeight: 700,
  fontSize: 14,
  borderRight: '1px solid #bfdbfe',
  background: '#eaf3fd',
};

function Pagination({ meta, page, setPage }) {
  const last = Math.max(1, meta?.last_page ?? 1);
  const total = meta?.total ?? 0;
  const from = meta?.from ?? 0;
  const to = meta?.to ?? 0;
  const start = Math.max(1, Math.min(page - 2, last - 4));
  const end = Math.min(last, start + 4);
  const pages = [];
  for (let p = start; p <= end; p += 1) pages.push(p);

  const btn = (active, disabled) => ({
    minWidth: 34,
    height: 34,
    padding: '0 8px',
    borderRadius: 8,
    border: active ? '1.5px solid #1d4ed8' : '1.5px solid #bfdbfe',
    background: active ? '#1d4ed8' : '#fff',
    color: active ? '#fff' : '#1e3a8a',
    fontWeight: 600,
    fontSize: 13.5,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  });

  return (
    <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
      <span style={{ fontSize: 13, color: '#334155' }}>
        Showing {from} to {to} of {total} records
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} style={btn(false, page <= 1)}>
          &lt;
        </button>
        {pages.map((p) => (
          <button key={p} type="button" onClick={() => setPage(p)} style={btn(p === page, false)}>
            {p}
          </button>
        ))}
        <button type="button" disabled={page >= last} onClick={() => setPage(page + 1)} style={btn(false, page >= last)}>
          &gt;
        </button>
      </div>
    </div>
  );
}

function DocumentTable({ rows, page, showGstin }) {
  const heads = [
    'S. No.',
    'Invoice No.',
    'Invoice Date',
    'Party Name',
    ...(showGstin ? ['GSTIN'] : []),
    'Place of Supply',
    'GST %',
    'Taxable Value (₹)',
    'IGST (₹)',
    'CGST (₹)',
    'SGST (₹)',
    'Total Value (₹)',
  ];
  const sum = (k) => rows.reduce((a, r) => a + num(r[k]), 0);
  const labelSpan = showGstin ? 7 : 6;

  return (
    <div style={{ overflowX: 'auto', borderTop: '1.5px solid #bfdbfe' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {heads.map((h, i) => (
              <th key={h} style={{ ...dlTh, borderRight: i === heads.length - 1 ? 'none' : dlTh.borderRight }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id}>
              <td style={dlTd}>{(page - 1) * 10 + i + 1}</td>
              <td style={{ ...dlTd, textAlign: 'left' }}>
                <span style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'underline' }}>{r.number}</span>
              </td>
              <td style={dlTd}>{r.document_date}</td>
              <td style={{ ...dlTd, textAlign: 'left', fontWeight: 500 }}>{r.party_name}</td>
              {showGstin && <td style={dlTd}>{r.gstin}</td>}
              <td style={dlTd}>{r.place_of_supply}</td>
              <td style={dlTd}>{r.gst_rate}%</td>
              <td style={dlTd}>{fmt(r.taxable)}</td>
              <td style={dlTd}>{fmt(r.igst)}</td>
              <td style={dlTd}>{fmt(r.cgst)}</td>
              <td style={dlTd}>{fmt(r.sgst)}</td>
              <td style={{ ...dlTd, borderRight: 'none', fontWeight: 600 }}>{fmt(r.total)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={labelSpan} style={dlTotal}>
              Total
            </td>
            <td style={dlTotal}>{fmt(sum('taxable'))}</td>
            <td style={dlTotal}>{fmt(sum('igst'))}</td>
            <td style={dlTotal}>{fmt(sum('cgst'))}</td>
            <td style={dlTotal}>{fmt(sum('sgst'))}</td>
            <td style={{ ...dlTotal, borderRight: 'none' }}>{fmt(sum('total'))}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function StateTable({ rows }) {
  const heads = ['S. No.', 'Place of Supply', 'GST %', 'No. of Documents', 'Taxable Value (₹)', 'IGST (₹)', 'CGST (₹)', 'SGST (₹)', 'Total Value (₹)'];
  const sum = (k) => rows.reduce((a, r) => a + num(r[k]), 0);

  return (
    <div style={{ overflowX: 'auto', borderTop: '1.5px solid #bfdbfe' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {heads.map((h, i) => (
              <th key={h} style={{ ...dlTh, borderRight: i === heads.length - 1 ? 'none' : dlTh.borderRight }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.state}-${r.gst_rate}-${i}`}>
              <td style={dlTd}>{i + 1}</td>
              <td style={{ ...dlTd, fontWeight: 500 }}>{r.state}</td>
              <td style={dlTd}>{r.gst_rate}%</td>
              <td style={dlTd}>{r.doc_count}</td>
              <td style={dlTd}>{fmt(r.taxable)}</td>
              <td style={dlTd}>{fmt(r.igst)}</td>
              <td style={dlTd}>{fmt(r.cgst)}</td>
              <td style={dlTd}>{fmt(r.sgst)}</td>
              <td style={{ ...dlTd, borderRight: 'none', fontWeight: 600 }}>{fmt(r.total)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={3} style={dlTotal}>
              Total
            </td>
            <td style={dlTotal}>{sum('doc_count')}</td>
            <td style={dlTotal}>{fmt(sum('taxable'))}</td>
            <td style={dlTotal}>{fmt(sum('igst'))}</td>
            <td style={dlTotal}>{fmt(sum('cgst'))}</td>
            <td style={dlTotal}>{fmt(sum('sgst'))}</td>
            <td style={{ ...dlTotal, borderRight: 'none' }}>{fmt(sum('total'))}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ListMessage({ children }) {
  return (
    <div style={{ borderTop: '1.5px solid #bfdbfe', padding: '56px 20px', textAlign: 'center', color: '#64748b', fontSize: 14 }}>
      {children}
    </div>
  );
}

const ExportError = ({ children }) =>
  children ? (
    <div style={{ padding: '10px 20px', color: '#dc2626', fontSize: 13, borderTop: '1.5px solid #bfdbfe' }}>{children}</div>
  ) : null;

const emptyLabel = (docType) => (docType ? `No ${DOC_TYPE_LABELS[docType]} found for this period.` : 'No documents found for this period.');

function SuppliesTab({ clientId, period, tabKey, docType, setDocType, fmt: formatVal, setFmt, docs, loading, page, setPage }) {
  const rows = docs?.data ?? [];
  // Export needs a real Document Type + Format; the table itself lists everything while "Select" is showing.
  const canExport = !!docType && !!formatVal && rows.length > 0;
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState('');

  const handleExport = async () => {
    setExporting(true);
    setExportErr('');
    try {
      // Export covers the whole period, not just the page on screen.
      const res = await api(`/admin/gst-returns/${clientId}/${tabKey}/${period}?doc_type=${docType}&all=1`);
      const all = (res.data ?? []).map((r, i) => ({ ...r, sr: i + 1 }));
      await exportRows({
        rows: all,
        columns: documentColumns(true),
        fmt: formatVal,
        name: `${tabKey}_${docType}_${period}`,
        sheetName: tabKey.toUpperCase(),
      });
    } catch (e) {
      setExportErr(e.message || 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <ListShell
      canExport={canExport}
      exporting={exporting}
      onExport={handleExport}
      controls={
        <>
          <FancySelect
            label="Document Type"
            value={docType}
            options={DOC_TYPE_OPTIONS}
            width={150}
            onChange={(v) => {
              setDocType(v);
              setPage(1);
            }}
          />
          <FancySelect label="Format" value={formatVal} options={FORMAT_OPTIONS} width={140} onChange={setFmt} />
        </>
      }
    >
      <ExportError>{exportErr}</ExportError>
      {loading ? (
        <ListMessage>Loading...</ListMessage>
      ) : rows.length === 0 ? (
        <>
          <ListMessage>{emptyLabel(docType)}</ListMessage>
          <Pagination meta={docs} page={page} setPage={setPage} />
        </>
      ) : (
        <>
          <DocumentTable rows={rows} page={page} showGstin />
          <Pagination meta={docs} page={page} setPage={setPage} />
        </>
      )}
    </ListShell>
  );
}

// ── B2C Supplies Tab ─────────────────────────────────────────────────────────
function B2CSuppliesTab({ clientId, period, docType, setDocType, fmt: formatVal, setFmt, view, setView, docs, loading, page, setPage, summary, sumLoading }) {
  const rows = docs?.data ?? [];
  const stateRows = (summary?.data ?? []).flatMap((s) => s.rates.map((r) => ({ state: s.state, ...r })));
  const isState = view === 'state';
  const count = isState ? stateRows.length : rows.length;
  const canExport = !!docType && !!formatVal && count > 0;
  const stateMeta = { from: stateRows.length ? 1 : 0, to: stateRows.length, total: stateRows.length, last_page: 1 };
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState('');

  const handleExport = async () => {
    setExporting(true);
    setExportErr('');
    try {
      if (isState) {
        await exportRows({
          rows: stateRows.map((r, i) => ({ ...r, sr: i + 1 })),
          columns: STATE_COLUMNS,
          fmt: formatVal,
          name: `b2c_state_${docType}_${period}`,
          sheetName: 'B2C State-wise',
        });
      } else {
        const res = await api(`/admin/gst-returns/${clientId}/b2c/${period}?doc_type=${docType}&all=1`);
        await exportRows({
          rows: (res.data ?? []).map((r, i) => ({ ...r, sr: i + 1 })),
          columns: documentColumns(false),
          fmt: formatVal,
          name: `b2c_invoice_${docType}_${period}`,
          sheetName: 'B2C Invoices',
        });
      }
    } catch (e) {
      setExportErr(e.message || 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  const busy = isState ? sumLoading : loading;

  return (
    <ListShell
      canExport={canExport}
      exporting={exporting}
      onExport={handleExport}
      controls={
        <>
          <FancySelect label="" value={view} options={B2C_VIEW_OPTIONS} width={170} onChange={setView} />
          <FancySelect
            label="Document Type"
            value={docType}
            options={DOC_TYPE_OPTIONS}
            width={150}
            onChange={(v) => {
              setDocType(v);
              setPage(1);
            }}
          />
          <FancySelect label="Format" value={formatVal} options={FORMAT_OPTIONS} width={140} onChange={setFmt} />
        </>
      }
    >
      <ExportError>{exportErr}</ExportError>
      {busy ? (
        <ListMessage>Loading...</ListMessage>
      ) : count === 0 ? (
        <>
          <ListMessage>{emptyLabel(docType)}</ListMessage>
          <Pagination meta={isState ? stateMeta : docs} page={page} setPage={setPage} />
        </>
      ) : isState ? (
        <>
          <StateTable rows={stateRows} />
          <Pagination meta={stateMeta} page={1} setPage={() => {}} />
        </>
      ) : (
        <>
          <DocumentTable rows={rows} page={page} showGstin={false} />
          <Pagination meta={docs} page={page} setPage={setPage} />
        </>
      )}
    </ListShell>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const lblCell = {
  padding: '4px 0',
  color: '#475569',
  whiteSpace: 'nowrap',
  paddingRight: 6,
  verticalAlign: 'middle',
  fontWeight: 500,
};

const colonCell = {
  padding: '4px 6px',
  color: '#64748b',
  verticalAlign: 'middle',
};

const valCell = {
  padding: '4px 0',
  color: '#1e293b',
  verticalAlign: 'middle',
  fontWeight: 500,
};

const sumTh = (title, align = 'center') => ({
  padding: '12px 14px',
  textAlign: align,
  fontWeight: 700,
  color: '#1e3a8a',
  fontSize: 13,
  whiteSpace: 'nowrap',
  borderRight: '1px solid #bfdbfe',
});

const sumTd = {
  padding: '11px 14px',
  textAlign: 'center',
  color: '#1e293b',
  fontWeight: 500,
  borderRight: '1px solid #bfdbfe',
};

const sumTotalTd = {
  padding: '12px 14px',
  textAlign: 'center',
  color: '#1e3a8a',
  fontWeight: 700,
  borderRight: '1px solid #bfdbfe',
};

const SkylineIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
    <path d="M6 12H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
    <path d="M10 6h4" />
    <path d="M10 10h4" />
    <path d="M10 14h4" />
    <path d="M10 18h4" />
  </svg>
);

const CalendarIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
  </svg>
);

const DocStatusIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const ChartIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

const B2BIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
    <path d="M6 12H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
    <path d="M10 6h4" />
    <path d="M10 10h4" />
  </svg>
);

const B2CIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

