import { useEffect, useState, useRef } from 'react';
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

const getPrevPeriodLabel = (p) => {
  if (!p) return '';
  if (p.includes('-Q')) {
    const [y, q] = p.split('-Q');
    const prevQ = +q === 1 ? 4 : +q - 1;
    const prevY = +q === 1 ? +y - 1 : +y;
    return `Q${prevQ} (${prevY})`;
  }
  const [yr, mo] = p.split('-');
  return new Date(Number(yr), Number(mo) - 2, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
};

const REASONS = ['Previous period correction', 'Wrong ITC availed', 'Others'];

export default function AdminGstr2bPeriod() {
  const { clientId, period } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adj, setAdj] = useState({ adj_igst: '', adj_cgst: '', adj_sgst: '', adjustment_reason: '', remarks: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  const load = () => {
    setLoading(true);
    api(`/admin/clients/${clientId}/gstr2b/period/${period}`)
      .then((d) => {
        setData(d);
        if (d.adjustment) {
          setAdj({
            adj_igst: d.adjustment.adj_igst ?? '',
            adj_cgst: d.adjustment.adj_cgst ?? '',
            adj_sgst: d.adjustment.adj_sgst ?? '',
            adjustment_reason: d.adjustment.adjustment_reason ?? '',
            remarks: d.adjustment.remarks ?? '',
          });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [clientId, period]);

  const saveAdj = async () => {
    setSaving(true);
    try {
      await api(`/admin/clients/${clientId}/gstr2b/period/${period}/adjustment`, { method: 'POST', body: adj });
      load();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const uploadFile = async (file) => {
    if (!file) return;
    setUploading(true);
    setUploadErr('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('tax_period', period);
      const base = import.meta.env.VITE_API_BASE_URL || '';
      const res = await fetch(`${base}/api/admin/clients/${clientId}/gstr2b`, {
        method: 'POST',
        body: fd,
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Upload failed');
      load();
    } catch (e) {
      setUploadErr(e.message);
    } finally {
      setUploading(false);
    }
  };

  const downloadPredefinedFormat = () => {
    const headers = [
      'GSTIN of Supplier',
      'Trade/Legal Name',
      'Invoice Number',
      'Invoice Type',
      'Invoice Date',
      'Invoice Value',
      'Place of Supply',
      'Supply Attract Reverse Charge',
      'Rate (%)',
      'Taxable Value',
      'Integrated Tax (₹)',
      'Central Tax (₹)',
      'State/UT Tax (₹)',
      'Cess (₹)',
      'ITC Availability',
      'Reason',
    ];
    const sampleRow = [
      '27AABCDE1234F1Z5',
      'ABC Supplier Pvt Ltd',
      'INV-2026-001',
      'Regular',
      '05/04/2026',
      '11800.00',
      '27-Maharashtra',
      'N',
      '18',
      '10000.00',
      '0.00',
      '900.00',
      '900.00',
      '0.00',
      'Yes',
      '',
    ];
    const csvContent = headers.join(',') + '\n' + sampleRow.join(',');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GSTR-2B_Template_${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div style={{ padding: '60px 20px', color: '#64748b', textAlign: 'center', fontSize: 15, fontWeight: 600 }}>
        Loading GSTR-2B period details...
      </div>
    );
  }

  if (!data) return null;

  const { client, record, itc, summary } = data;
  const pLabel = periodLabel(period);
  const prevPLabel = getPrevPeriodLabel(period);
  const freqLabel = client.filing_frequency === 'quarterly' ? 'Quarterly' : 'Monthly';

  const adjIgst = parseFloat(adj.adj_igst) || 0;
  const adjCgst = parseFloat(adj.adj_cgst) || 0;
  const adjSgst = parseFloat(adj.adj_sgst) || 0;
  const adjTotal = adjIgst + adjCgst + adjSgst;

  const prevIgst = itc?.prev?.igst || 0;
  const prevCgst = itc?.prev?.cgst || 0;
  const prevSgst = itc?.prev?.sgst || 0;
  const prevTotal = prevIgst + prevCgst + prevSgst;

  const curIgst = itc?.current?.igst || 0;
  const curCgst = itc?.current?.cgst || 0;
  const curSgst = itc?.current?.sgst || 0;
  const curTotal = curIgst + curCgst + curSgst;

  const totalAvailIgst = prevIgst + adjIgst + curIgst;
  const totalAvailCgst = prevCgst + adjCgst + curCgst;
  const totalAvailSgst = prevSgst + adjSgst + curSgst;
  const totalAvailTotal = totalAvailIgst + totalAvailCgst + totalAvailSgst;

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
          {client.business_name}
        </Link>
        <span style={bcSep}>›</span>
        <span style={{ color: '#1e3a8a', fontWeight: 700 }}>{pLabel}</span>
      </div>

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#1e3a8a', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            GSTR-2B – {pLabel}
          </h1>
          <div style={{ marginTop: 6, fontSize: 13, color: '#64748b', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: '#1e293b', fontWeight: 600 }}>{client.business_name}</span>
            <span style={{ color: '#cbd5e1' }}>|</span>
            <span>
              GSTIN: <strong style={{ color: '#1e293b', fontWeight: 600 }}>{client.gstin || '—'}</strong>
            </span>
            <span style={{ color: '#cbd5e1' }}>|</span>
            <span>
              Filing Frequency: <strong style={{ color: '#1d4ed8', fontWeight: 700 }}>{freqLabel}</strong>
            </span>
            <span style={{ color: '#cbd5e1' }}>|</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Status:</span>
              <span
                style={{
                  padding: '3px 14px',
                  borderRadius: 9999,
                  fontSize: 12,
                  fontWeight: 700,
                  background: '#dbeafe',
                  color: '#1d4ed8',
                  border: '1px solid #bfdbfe',
                }}
              >
                In Progress
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate(`/admin/gst-returns/gstr-2b/${clientId}`)}
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
          Back to {freqLabel} List
        </button>
      </div>

      {/* Two-column: ITC + Upload */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
        {/* Left Card: ITC Balance & Adjustment */}
        <div style={{ background: '#fff', border: '1.5px solid #bfdbfe', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Card Header */}
          <div
            style={{
              padding: '16px 18px',
              borderBottom: '1.5px solid #bfdbfe',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 8,
                  background: '#1d4ed8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <CoinStackIcon />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15.5, color: '#1e3a8a' }}>ITC Balance &amp; Adjustment</div>
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2, lineHeight: 1.4 }}>
                  Manage previous period ITC balance and adjustments before calculating available ITC for this period.
                </div>
              </div>
            </div>

            <div style={{ flexShrink: 0, textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 3 }}>From Previous Month</div>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <select
                  style={{
                    padding: '5px 28px 5px 10px',
                    border: '1.5px solid #bfdbfe',
                    borderRadius: 6,
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: '#1e3a8a',
                    background: '#fff',
                    appearance: 'none',
                    cursor: 'pointer',
                    minWidth: 120,
                  }}
                >
                  <option>{prevPLabel || pLabel}</option>
                </select>
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#1d4ed8"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>
          </div>

          {/* ITC Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: '#eaf3fd', borderBottom: '1.5px solid #bfdbfe' }}>
                {['Particulars', 'IGST (₹)', 'CGST (₹)', 'SGST (₹)', 'Total (₹)'].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      padding: '9px 12px',
                      textAlign: i === 0 ? 'left' : 'right',
                      fontWeight: 700,
                      color: '#1e3a8a',
                      fontSize: 12,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Row 1: Previous Month Closing ITC Balance */}
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '10px 12px', color: '#1e293b', fontWeight: 500, fontSize: 12.5 }}>
                  Previous Month Closing ITC Balance
                </td>
                <td style={tdVal}>{R2(prevIgst)}</td>
                <td style={tdVal}>{R2(prevCgst)}</td>
                <td style={tdVal}>{R2(prevSgst)}</td>
                <td style={{ ...tdVal, fontWeight: 700 }}>{R2(prevTotal)}</td>
              </tr>

              {/* Row 2: ITC Adjustment (+ / -) */}
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '8px 12px', color: '#1e293b', fontWeight: 500, fontSize: 12.5 }}>
                  ITC Adjustment (+ / -)
                </td>
                {['adj_igst', 'adj_cgst', 'adj_sgst'].map((k) => (
                  <td key={k} style={{ padding: '6px 8px', textAlign: 'right' }}>
                    <input
                      type="number"
                      step="0.01"
                      value={adj[k]}
                      onChange={(e) => setAdj((a) => ({ ...a, [k]: e.target.value }))}
                      placeholder="0.00"
                      style={{
                        width: 82,
                        height: 30,
                        padding: '4px 8px',
                        border: '1.5px solid #bfdbfe',
                        borderRadius: 6,
                        fontSize: 12.5,
                        fontWeight: 600,
                        textAlign: 'right',
                        color: '#1e293b',
                        outline: 'none',
                        boxSizing: 'border-box',
                        background: '#fff',
                      }}
                      onFocus={(e) => (e.target.style.borderColor = '#2563eb')}
                      onBlur={(e) => (e.target.style.borderColor = '#bfdbfe')}
                    />
                  </td>
                ))}
                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#1e293b', fontWeight: 700, fontSize: 12.5 }}>
                  {R2(adjTotal)}
                </td>
              </tr>

              {/* Row 3: Current Month GSTR-2B ITC */}
              <tr style={{ borderBottom: '1.5px solid #bfdbfe' }}>
                <td style={{ padding: '10px 12px', color: '#1e293b', fontWeight: 500, fontSize: 12.5 }}>
                  Current Month GSTR-2B ITC
                </td>
                <td style={tdVal}>{R2(curIgst)}</td>
                <td style={tdVal}>{R2(curCgst)}</td>
                <td style={tdVal}>{R2(curSgst)}</td>
                <td style={{ ...tdVal, fontWeight: 700 }}>{R2(curTotal)}</td>
              </tr>

              {/* Row 4: Total Available ITC */}
              <tr style={{ background: '#eaf3fd' }}>
                <td style={{ padding: '11px 12px', color: '#1d4ed8', fontWeight: 700, fontSize: 13 }}>
                  Total Available ITC
                </td>
                <td style={tdTotalVal}>{R2(totalAvailIgst)}</td>
                <td style={tdTotalVal}>{R2(totalAvailCgst)}</td>
                <td style={tdTotalVal}>{R2(totalAvailSgst)}</td>
                <td style={{ ...tdTotalVal, color: '#1d4ed8' }}>{R2(totalAvailTotal)}</td>
              </tr>
            </tbody>
          </table>

          {/* Adjustment Reason + Save */}
          <div
            style={{
              padding: '13px 16px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              gap: 12,
              alignItems: 'flex-end',
              background: '#fff',
              marginTop: 'auto',
            }}
          >
            <div style={{ width: 190 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                Adjustment Reason
              </label>
              <div style={{ position: 'relative' }}>
                <select
                  value={adj.adjustment_reason}
                  onChange={(e) => setAdj((a) => ({ ...a, adjustment_reason: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '7px 28px 7px 10px',
                    border: '1.5px solid #bfdbfe',
                    borderRadius: 7,
                    fontSize: 12.5,
                    color: '#1e293b',
                    background: '#fff',
                    appearance: 'none',
                    fontWeight: 500,
                  }}
                >
                  <option value="">Select reason...</option>
                  {REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#1d4ed8"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                Remarks (Optional)
              </label>
              <input
                value={adj.remarks}
                onChange={(e) => setAdj((a) => ({ ...a, remarks: e.target.value }))}
                placeholder="Enter remarks..."
                style={{
                  width: '100%',
                  padding: '7px 12px',
                  border: '1.5px solid #bfdbfe',
                  borderRadius: 7,
                  fontSize: 12.5,
                  color: '#1e293b',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#2563eb')}
                onBlur={(e) => (e.target.style.borderColor = '#bfdbfe')}
              />
            </div>

            <button
              type="button"
              onClick={saveAdj}
              disabled={saving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 18px',
                height: 36,
                background: '#1d4ed8',
                border: 'none',
                borderRadius: 7,
                fontSize: 13,
                fontWeight: 600,
                color: '#fff',
                cursor: saving ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'background .15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#1e40af')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#1d4ed8')}
            >
              <SaveIcon />
              {saving ? 'Saving...' : 'Save Adjustment'}
            </button>
          </div>
        </div>

        {/* Right Card: GSTR-2B Document Upload */}
        <div style={{ background: '#fff', border: '1.5px solid #bfdbfe', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Card Header */}
          <div
            style={{
              padding: '16px 18px',
              borderBottom: '1.5px solid #bfdbfe',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 8,
                  background: '#16a34a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <UploadDocIcon />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15.5, color: '#1e3a8a' }}>GSTR-2B Document Upload</div>
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                  Upload the GSTR-2B document file in the predefined format.
                </div>
              </div>
            </div>

            <div style={{ color: '#2563eb', padding: 2, flexShrink: 0, cursor: 'pointer' }} title="Predefined GSTR-2B format information">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </div>
          </div>

          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
            {/* Drop Zone */}
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                uploadFile(e.dataTransfer.files[0]);
              }}
              style={{
                border: `2px dashed ${dragOver ? '#2563eb' : '#93c5fd'}`,
                borderRadius: 10,
                padding: '22px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                background: dragOver ? '#eff6ff' : '#f8fbff',
                transition: 'all .15s ease',
              }}
            >
              <div style={{ margin: '0 auto 8px', display: 'flex', justifyContent: 'center' }}>
                <CloudUploadIcon />
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                Drag &amp; drop your GSTR-2B file here
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>or</div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileRef.current?.click();
                }}
                style={{
                  padding: '5px 22px',
                  background: '#fff',
                  border: '1.5px solid #bfdbfe',
                  borderRadius: 6,
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: '#1d4ed8',
                  cursor: 'pointer',
                }}
              >
                Browse File
              </button>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>
                Only .xlsx and .json files are allowed. Max file size: 10 MB.
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.json" style={{ display: 'none' }} onChange={(e) => uploadFile(e.target.files[0])} />
            </div>

            {uploadErr && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '7px 10px', borderRadius: 7 }}>
                {uploadErr}
              </div>
            )}

            {/* Uploaded File Success State */}
            {record && (
              <div
                style={{
                  marginTop: 12,
                  padding: '10px 14px',
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 9999,
                    background: '#16a34a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#1e3a8a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {record.file_name}
                  </div>
                  <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 500, marginTop: 1 }}>
                    {record.invoices_count ?? 0} records uploaded successfully.
                  </div>
                </div>
                <div style={{ fontSize: 11, color: '#64748b', textAlign: 'right', flexShrink: 0, lineHeight: 1.6 }}>
                  <div style={{ color: '#94a3b8' }}>Uploaded On</div>
                  <div style={{ fontWeight: 600, color: '#374151' }}>
                    {record.updated_at
                      ? new Date(record.updated_at).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                  </div>
                  <div style={{ color: '#94a3b8' }}>Uploaded By</div>
                  <div style={{ fontWeight: 600, color: '#374151' }}>{record.uploader?.name ?? 'Admin'}</div>
                </div>
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
              <button
                type="button"
                onClick={downloadPredefinedFormat}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7,
                  padding: '9px 12px',
                  background: '#fff',
                  border: '1.5px solid #bfdbfe',
                  borderRadius: 7,
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: '#1d4ed8',
                  cursor: 'pointer',
                  transition: 'background .15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fbff')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
              >
                <DownloadTrayIcon />
                Download Predefined Format
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7,
                  padding: '9px 12px',
                  background: '#1d4ed8',
                  border: 'none',
                  borderRadius: 7,
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: '#fff',
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  transition: 'background .15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#1e40af')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#1d4ed8')}
              >
                <UploadTrayIcon />
                {uploading ? 'Uploading...' : 'Upload GSTR-2B'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* GSTR-2B Summary */}
      <div style={{ background: '#fff', border: '1.5px solid #bfdbfe', borderRadius: 12, overflow: 'hidden', marginTop: 16 }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 7,
              background: '#1d4ed8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ChartSquareIcon />
          </div>
          <span style={{ fontWeight: 700, fontSize: 15.5, color: '#1e3a8a' }}>GSTR-2B Summary</span>
        </div>

        <div style={{ padding: '16px 18px', display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 12 }}>
          {[
            {
              label: 'Total Documents',
              icon: <TotalDocIcon />,
              color: '#4338ca',
              bg: '#f8fafc',
              br: '#e2e8f0',
              display: (summary?.total_invoices ?? 0).toLocaleString('en-IN'),
            },
            {
              label: 'Total Taxable Value',
              icon: <RupeeCircleIcon color="#0284c7" bg="#e0f2fe" />,
              color: '#1d4ed8',
              bg: '#eff6ff',
              br: '#bfdbfe',
              display: summary?.total_taxable != null && summary.total_taxable > 0 ? `₹ ${R2(summary.total_taxable)}` : '—',
            },
            {
              label: 'IGST',
              icon: <RupeeCircleIcon color="#16a34a" bg="#dcfce7" />,
              color: '#16a34a',
              bg: '#f0fdf4',
              br: '#bbf7d0',
              display: `₹ ${R2(curIgst)}`,
            },
            {
              label: 'CGST',
              icon: <MiniBarIcon color="#d97706" bg="#fef3c7" />,
              color: '#d97706',
              bg: '#fffbeb',
              br: '#fde68a',
              display: `₹ ${R2(curCgst)}`,
            },
            {
              label: 'SGST',
              icon: <MiniBarIcon color="#dc2626" bg="#fee2e2" />,
              color: '#dc2626',
              bg: '#fef2f2',
              br: '#fecaca',
              display: `₹ ${R2(curSgst)}`,
            },
            {
              label: 'Total ITC',
              icon: <MiniBarIcon color="#1d4ed8" bg="#dbeafe" />,
              color: '#1d4ed8',
              bg: '#eff6ff',
              br: '#bfdbfe',
              display: `₹ ${R2(curTotal)}`,
            },
          ].map((c, i) => (
            <div key={i} style={{ border: `1px solid ${c.br}`, borderRadius: 10, padding: '14px 14px', background: c.bg }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                {c.icon}
                <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 500, lineHeight: 1.3 }}>{c.label}</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 16, color: c.color }}>{c.display}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Uploaded GSTR-2B Documents Card */}
      <div
        style={{
          background: '#fff',
          border: '1.5px solid #bfdbfe',
          borderRadius: 12,
          marginTop: 16,
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: '#1d4ed8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ListSquareIcon />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15.5, color: '#1e3a8a' }}>Uploaded GSTR-2B Documents</div>
            <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>
              View, search and reconcile all documents uploaded from GSTR-2B.
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate(`/admin/gst-returns/gstr-2b/${clientId}/period/${period}/documents`)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 22px',
            background: '#1d4ed8',
            border: 'none',
            borderRadius: 8,
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
          View Uploaded Documents
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>

      {/* Important Note */}
      <div style={{ marginTop: 16, padding: '16px 20px', background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span style={{ fontWeight: 700, fontSize: 13.5, color: '#1e3a8a' }}>Important Note:</span>
        </div>
        <ol style={{ margin: '6px 0 0', paddingLeft: 20, fontSize: 12.5, color: '#334155', lineHeight: 1.85 }}>
          <li>Previous month closing ITC balance will be automatically carried forward from the last filed period.</li>
          <li>You can make adjustments (+/-) if required. Please select the reason for adjustment.</li>
          <li>Total Available ITC = Previous Month Closing Balance + Adjustment + Current Month GSTR-2B ITC.</li>
          <li>After uploading, all documents will be available in the Uploaded Documents section for reconciliation.</li>
        </ol>
      </div>
    </div>
  );
}

// ── Styles & Components ──────────────────────────────────────────────────────
const bcLink = { color: '#2563eb', textDecoration: 'none', fontWeight: 600 };
const bcSep = { color: '#2563eb', fontWeight: 700, margin: '0 2px' };

const tdVal = {
  padding: '10px 12px',
  textAlign: 'right',
  color: '#1e293b',
  fontWeight: 600,
  fontSize: 12.5,
};

const tdTotalVal = {
  padding: '11px 12px',
  textAlign: 'right',
  color: '#1d4ed8',
  fontWeight: 700,
  fontSize: 13,
};

const CoinStackIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    <path d="M21 17c0 1.66-4 3-9 3s-9-1.34-9-3" />
  </svg>
);

const UploadDocIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const CloudUploadIcon = () => (
  <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 16 12 12 8 16" />
    <line x1="12" y1="12" x2="12" y2="21" />
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
  </svg>
);

const ChartSquareIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

const ListSquareIcon = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <circle cx="3.5" cy="6" r="1.5" fill="#fff" />
    <circle cx="3.5" cy="12" r="1.5" fill="#fff" />
    <circle cx="3.5" cy="18" r="1.5" fill="#fff" />
  </svg>
);

const SaveIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

const DownloadTrayIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const UploadTrayIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const TotalDocIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const RupeeCircleIcon = ({ color, bg }) => (
  <div
    style={{
      width: 22,
      height: 22,
      borderRadius: 6,
      background: bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      fontSize: 13,
      fontWeight: 700,
      color: color,
    }}
  >
    ₹
  </div>
);

const MiniBarIcon = ({ color, bg }) => (
  <div
    style={{
      width: 22,
      height: 22,
      borderRadius: 6,
      background: bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}
  >
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  </div>
);
