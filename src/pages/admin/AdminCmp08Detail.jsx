import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useReturnRequest } from './useReturnRequest';

const R2 = n => Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sum = (...a) => a.reduce((s, v) => s + (+v || 0), 0);

export default function AdminCmp08Detail() {
  const { clientId, period } = useParams();
  const decodedPeriod = decodeURIComponent(period);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Local editable state (loaded from DB)
  const [turnover, setTurnover] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [remarks, setRemarks] = useState('');

  const [editTurn, setEditTurn] = useState(false);
  const [editAdj, setEditAdj] = useState(false);
  const [payModal, setPayModal] = useState(false);
  const [payEditIdx, setPayEditIdx] = useState(null);
  const emptyPay = { date: '', challan_no: '', mode: 'Online (Net Banking)', amount: 0, remarks: '' };
  const [payForm, setPayForm] = useState(emptyPay);

  const [filedPopup, setFiledPopup] = useState(false);
  const [filedOn, setFiledOn] = useState('');
  const [arnVal, setArnVal] = useState('');
  const [filedErr, setFiledErr] = useState('');
  const [marking, setMarking] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveErr, setSaveErr] = useState('');

  // GSTR-3B-style request flow: Initiate Request / Reject / View Request.
  const request = useReturnRequest({
    baseUrl: `/admin/clients/${clientId}/cmp08/period/${encodeURIComponent(decodedPeriod)}`,
    returnLabel: 'CMP-08',
    clientName: data?.client?.business_name,
    periodLabel: data?.quarter_label,
  });

  const load = () => {
    setLoading(true);
    api(`/admin/clients/${clientId}/cmp08/period/${encodeURIComponent(decodedPeriod)}`)
      .then(d => {
        setData(d);
        setTurnover(d.turnover ?? []);
        setAdjustments(d.adjustments ?? []);
        setPayments(d.payments ?? []);
        setRemarks(d.remarks ?? '');
        request.reload();
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [clientId, period]);

  const saveAll = (t, a, p, r) => {
    return api(`/admin/clients/${clientId}/cmp08/period/${encodeURIComponent(decodedPeriod)}`, {
      method: 'POST',
      body: {
        turnover: t ?? turnover,
        adjustments: a ?? adjustments,
        payments: p ?? payments,
        remarks: r ?? remarks,
      },
    })
      .then((res) => {
        // The server is the single source of the arithmetic — show exactly what it stored.
        if (res?.turnover) {
          setTurnover(res.turnover);
          setAdjustments(res.adjustments);
          setPayments(res.payments);
        }
        setSaveErr('');
        setSaveMsg('Draft saved successfully!');
        setTimeout(() => setSaveMsg(''), 2500);
      })
      .catch((e) => {
        setSaveMsg('');
        setSaveErr(e.message || 'Could not save. Please check the values and try again.');
        setTimeout(() => setSaveErr(''), 6000);
      });
  };

  // Dynamically calculated values based on DB state
  const taxLiability = turnover.reduce((s, r) => s + (+r.tax_amount || 0), 0);
  const totalTaxable = turnover.reduce((s, r) => s + (+r.taxable_value || 0), 0);
  const adjTotal = adjustments.reduce((s, r) => s + (+r.total || 0), 0);
  const adjTaxSum = adjustments.reduce((s, r) => s + (+r.tax_amount || 0), 0);
  const adjCgstSum = adjustments.reduce((s, r) => s + (+r.cgst || 0), 0);
  const adjSgstSum = adjustments.reduce((s, r) => s + (+r.sgst || 0), 0);
  const netPayable = taxLiability + adjTotal;
  const taxPaid = payments.reduce((s, p) => s + (+p.amount || 0), 0);
  const balancePayable = netPayable - taxPaid;

  const setTurn = (i, k, v) => {
    setTurnover(arr =>
      arr.map((r, j) => {
        if (j !== i) return r;
        const next = { ...r, [k]: v };
        if (k === 'taxable_value' || k === 'rate') {
          const val = k === 'taxable_value' ? +v : +r.taxable_value;
          const rt = k === 'rate' ? +v : +r.rate;
          next.tax_amount = ((val * rt) / 100).toFixed(2);
        }
        return next;
      })
    );
  };

  // Tax Amount = CGST + SGST = Total. Typing a Tax Amount splits it equally into CGST / SGST;
  // typing CGST or SGST re-derives the Tax Amount. Negative values are "Less" adjustments.
  const r2 = (n) => Math.round(n * 100) / 100;
  const setAdj = (i, k, v) => {
    setAdjustments(arr =>
      arr.map((r, j) => {
        if (j !== i) return r;
        const next = { ...r, [k]: v };
        if (k === 'tax_amount') {
          const t = +v || 0;
          const cg = r2(t / 2);
          next.cgst = String(cg);
          next.sgst = String(r2(t - cg));
          next.total = String(r2(t));
        } else if (k === 'cgst' || k === 'sgst') {
          const t = r2((+next.cgst || 0) + (+next.sgst || 0));
          next.tax_amount = String(t);
          next.total = String(t);
        }
        return next;
      })
    );
  };

  const submitMarkFiled = async () => {
    setFiledErr('');
    if (!filedOn) { setFiledErr('Filed On is required.'); return; }
    if (!arnVal) { setFiledErr('ARN is required.'); return; }
    setMarking(true);
    try {
      await api(`/admin/clients/${clientId}/cmp08/period/${encodeURIComponent(decodedPeriod)}/mark-filed`, {
        method: 'POST',
        body: { filed_on: filedOn, arn: arnVal },
      });
      setFiledPopup(false);
      load();
    } catch (e) {
      setFiledErr(e.message);
    } finally {
      setMarking(false);
    }
  };

  const openAddPay = () => {
    setPayForm(emptyPay);
    setPayEditIdx(null);
    setPayModal(true);
  };

  const openEditPay = i => {
    setPayForm({ ...payments[i] });
    setPayEditIdx(i);
    setPayModal(true);
  };

  const submitPay = () => {
    const next = payEditIdx !== null
      ? payments.map((p, i) => (i === payEditIdx ? { ...payForm } : p))
      : [...payments, { ...payForm }];
    setPayments(next);
    setPayModal(false);
    saveAll(null, null, next, null);
  };

  const deletePay = i => {
    const next = payments.filter((_, j) => j !== i);
    setPayments(next);
    saveAll(null, null, next, null);
  };

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: '#64748b', fontSize: 14 }}>
        Loading CMP-08 details from database...
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: '#dc2626', fontSize: 14 }}>
        Client or return period not found.
      </div>
    );
  }

  const { client, quarter_label, due_date, return_status } = data;
  const isFiled = return_status === 'Filed';

  return (
    <div style={{ fontFamily: "'Inter',system-ui,sans-serif", padding: '4px 0 48px', color: '#1e293b' }}>

      {/* Header & Breadcrumb */}
      <div className="gst-head gst-head-list" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>
            CMP-08 – Client Details <span style={{ fontWeight: 500, color: '#475569', fontSize: 17 }}>(Admin Portal)</span>
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, fontWeight: 500, color: '#2563eb' }}>
            View, verify and manage CMP-08 for the selected client.
          </p>
        </div>

        {/* Top-Right Breadcrumb */}
        <div className="gst-crumbs gst-crumbs-right" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 500 }}>
          <Link to="/admin/gst-returns" style={{ color: '#2563eb', textDecoration: 'none' }}>
            GST Compliance
          </Link>
          <span style={{ color: '#2563eb' }}>&gt;</span>
          <Link to="/admin/cmp08" style={{ color: '#2563eb', textDecoration: 'none' }}>
            CMP-08
          </Link>
          <span style={{ color: '#2563eb' }}>&gt;</span>
          <span style={{ color: '#2563eb' }}>Client Details</span>
        </div>
      </div>

      {/* Client Info Strip */}
      <div className="cm-strip" style={{
        background: '#fff',
        border: '1.5px solid #bfdbfe',
        borderRadius: 10,
        padding: '12px 18px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 14,
      }}>
        <div className="cm-strip-fields" style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 500, marginBottom: 2 }}>Client Name</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8' }}>{client?.business_name || '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 500, marginBottom: 2 }}>GSTIN</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8' }}>{client?.gstin || '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 500, marginBottom: 2 }}>Registration Type</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8' }}>Composition</div>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 500, marginBottom: 2 }}>Tax Period</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{quarter_label || period}</div>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 500, marginBottom: 2 }}>Due Date</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{due_date || '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 500, marginBottom: 2 }}>Return Status</div>
            <span style={{
              display: 'inline-block',
              padding: '2px 12px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              background: return_status === 'Filed' ? '#dcfce7' : return_status === 'Upcoming' ? '#e0f2fe' : '#fef3c7',
              color: return_status === 'Filed' ? '#16a34a' : return_status === 'Upcoming' ? '#0284c7' : '#d97706',
            }}>
              {return_status}
            </span>
          </div>
        </div>

        <div>
          {!isFiled ? (
            <button
              onClick={() => setFiledPopup(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 20px',
                background: '#1d4ed8',
                border: 'none',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Mark as Filed
            </button>
          ) : (
            <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
              ✓ Filed on {data.filed_on || '—'} {data.arn ? `(ARN: ${data.arn})` : ''}
            </div>
          )}
        </div>
      </div>

      {request.statusBar}

      {/* 6 Stat Cards Strip */}
      <div className="cm-stats6" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 18 }}>
        {/* Card 1: Total Taxable Turnover */}
        <div style={{
          background: '#eff6ff',
          border: '1.5px solid #bfdbfe',
          borderRadius: 10,
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{ flexShrink: 0, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2.2">
              <circle cx="12" cy="12" r="10" />
              <path d="M6 9h12M6 13h9M12 9a3 3 0 0 1 0 6H9" />
              <line x1="9" y1="15" x2="15" y2="21" strokeWidth="2" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#1e40af', lineHeight: 1.2 }}>Total Taxable Turnover</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1d4ed8', marginTop: 2 }}>₹ {R2(totalTaxable)}</div>
          </div>
        </div>

        {/* Card 2: Tax Liability */}
        <div style={{
          background: '#faf5ff',
          border: '1.5px solid #e9d5ff',
          borderRadius: 10,
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{ flexShrink: 0, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2">
              <rect x="4" y="2" width="16" height="20" rx="2" />
              <line x1="8" y1="6" x2="16" y2="6" strokeWidth="2" />
              <line x1="16" y1="14" x2="16" y2="18" strokeWidth="2" />
              <circle cx="8.5" cy="11.5" r="1" fill="#7c3aed" />
              <circle cx="12" cy="11.5" r="1" fill="#7c3aed" />
              <circle cx="15.5" cy="11.5" r="1" fill="#7c3aed" />
              <circle cx="8.5" cy="15.5" r="1" fill="#7c3aed" />
              <circle cx="12" cy="15.5" r="1" fill="#7c3aed" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6b21a8', lineHeight: 1.2 }}>Tax Liability</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#7c3aed', marginTop: 2 }}>₹ {R2(taxLiability)}</div>
          </div>
        </div>

        {/* Card 3: Adjustments */}
        <div style={{
          background: '#f0fdf4',
          border: '1.5px solid #bbf7d0',
          borderRadius: 10,
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{ flexShrink: 0, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="9" y1="13" x2="15" y2="13" />
              <line x1="9" y1="17" x2="13" y2="17" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#15803d', lineHeight: 1.2 }}>Adjustments</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#15803d', marginTop: 2 }}>₹ {R2(adjTotal)}</div>
          </div>
        </div>

        {/* Card 4: Net Tax Payable */}
        <div style={{
          background: '#fffbeb',
          border: '1.5px solid #fed7aa',
          borderRadius: 10,
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{ flexShrink: 0, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#c2410c', lineHeight: 1.2 }}>Net Tax Payable</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#ea580c', marginTop: 2 }}>₹ {R2(netPayable)}</div>
          </div>
        </div>

        {/* Card 5: Tax Paid */}
        <div style={{
          background: '#f0f9ff',
          border: '1.5px solid #bae6fd',
          borderRadius: 10,
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{ flexShrink: 0, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2">
              <ellipse cx="12" cy="7" rx="8" ry="3" />
              <path d="M4 7v6c0 1.66 3.58 3 8 3s8-1.34 8-3V7" />
              <path d="M4 13v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#0369a1', lineHeight: 1.2 }}>Tax Paid</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#0284c7', marginTop: 2 }}>₹ {R2(taxPaid)}</div>
          </div>
        </div>

        {/* Card 6: Balance Payable */}
        <div style={{
          background: '#fef2f2',
          border: '1.5px solid #fecaca',
          borderRadius: 10,
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{ flexShrink: 0, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M9 12h6M9 9h6M12 9v6" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#b91c1c', lineHeight: 1.2 }}>Balance Payable</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#dc2626', marginTop: 2 }}>₹ {R2(balancePayable)}</div>
          </div>
        </div>
      </div>

      {/* Section 1: Turnover & Tax Liability Details */}
      <div className="cm-table-card" style={{
        background: '#fff',
        border: '1.5px solid #bfdbfe',
        borderRadius: 10,
        overflow: 'hidden',
        marginBottom: 18,
      }}>
        <div style={{
          padding: '10px 16px',
          borderBottom: '1.5px solid #bfdbfe',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#fff',
        }}>
          <span style={{ fontWeight: 800, fontSize: 15, color: '#1d4ed8' }}>
            1. Turnover &amp; Tax Liability Details
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setEditTurn(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 14px',
                background: editTurn ? '#eff6ff' : '#fff',
                border: '1.5px solid #93c5fd',
                borderRadius: 6,
                fontSize: 12.5,
                fontWeight: 600,
                color: '#1d4ed8',
                cursor: 'pointer',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
              Edit
            </button>
            <button
              onClick={() => {
                setEditTurn(false);
                saveAll(turnover, null, null, null);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 16px',
                background: '#1d4ed8',
                border: 'none',
                borderRadius: 6,
                fontSize: 12.5,
                fontWeight: 600,
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
              Done
            </button>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#eaf3fd', borderBottom: '1.5px solid #bfdbfe' }}>
              <th style={thStyle({ align: 'center', width: 46 })}>#</th>
              <th style={thStyle({ align: 'left' })}>Particulars</th>
              <th style={thStyle({ align: 'right', width: 180 })}>Taxable Value (₹)</th>
              <th style={thStyle({ align: 'center', width: 150 })}>Applicable Rate</th>
              <th style={thStyle({ align: 'right', width: 170 })}>Tax Amount (₹)</th>
              <th style={thStyle({ align: 'center', width: 130, isLast: true })}>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {turnover.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #dbeafe' }}>
                <td style={tdStyle({ align: 'center', color: '#1e293b', weight: 600 })}>{i + 1}</td>
                <td style={tdStyle({ color: '#1e293b', weight: 500 })}>{r.particulars}</td>
                <td style={tdStyle({ align: 'right' })}>
                  {editTurn ? (
                    <input
                      type="number"
                      value={r.taxable_value}
                      onChange={e => setTurn(i, 'taxable_value', e.target.value)}
                      style={editInput}
                    />
                  ) : (
                    <span>{Number(r.taxable_value || 0).toLocaleString('en-IN')}</span>
                  )}
                </td>
                <td style={tdStyle({ align: 'center' })}>
                  {editTurn ? (
                    <input
                      type="number"
                      step="0.01"
                      value={r.rate}
                      onChange={e => setTurn(i, 'rate', e.target.value)}
                      style={{ ...editInput, width: 70, textAlign: 'center' }}
                    />
                  ) : (
                    <span>{Number(r.rate || 0).toFixed(2)}%</span>
                  )}
                </td>
                <td style={tdStyle({ align: 'right' })}>
                  {editTurn ? (
                    <input
                      type="number"
                      step="0.01"
                      value={r.tax_amount}
                      onChange={e => setTurn(i, 'tax_amount', e.target.value)}
                      style={editInput}
                    />
                  ) : (
                    <span>{Number(r.tax_amount || 0).toLocaleString('en-IN')}</span>
                  )}
                </td>
                <td style={tdStyle({ align: 'center', isLast: true })}>
                  {editTurn ? (
                    <input
                      type="text"
                      value={r.remarks || ''}
                      onChange={e => setTurn(i, 'remarks', e.target.value)}
                      placeholder="Remarks..."
                      style={{ ...editInput, width: '90%', textAlign: 'left' }}
                    />
                  ) : (
                    <span style={{ color: '#64748b' }}>{r.remarks || '-'}</span>
                  )}
                </td>
              </tr>
            ))}
            <tr style={{ background: '#eaf3fd', fontWeight: 800 }}>
              <td style={tdStyle({ align: 'center', color: '#1d4ed8' })}></td>
              <td style={tdStyle({ color: '#1d4ed8', weight: 800 })}>Total</td>
              <td style={tdStyle({ align: 'right', color: '#1d4ed8', weight: 800 })}>
                {Number(totalTaxable).toLocaleString('en-IN')}
              </td>
              <td style={tdStyle({ align: 'center' })}></td>
              <td style={tdStyle({ align: 'right', color: '#1d4ed8', weight: 800 })}>
                {Number(taxLiability).toLocaleString('en-IN')}
              </td>
              <td style={tdStyle({ align: 'center', isLast: true })}></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Section 2: Adjustment Details */}
      <div className="cm-table-card" style={{
        background: '#fff',
        border: '1.5px solid #bfdbfe',
        borderRadius: 10,
        overflow: 'hidden',
        marginBottom: 18,
      }}>
        <div style={{
          padding: '10px 16px',
          borderBottom: '1.5px solid #bfdbfe',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#fff',
        }}>
          <span style={{ fontWeight: 800, fontSize: 15, color: '#1d4ed8' }}>
            2. Adjustment Details
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setEditAdj(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 14px',
                background: editAdj ? '#eff6ff' : '#fff',
                border: '1.5px solid #93c5fd',
                borderRadius: 6,
                fontSize: 12.5,
                fontWeight: 600,
                color: '#1d4ed8',
                cursor: 'pointer',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
              Edit
            </button>
            <button
              onClick={() => {
                setEditAdj(false);
                saveAll(null, adjustments, null, null);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 16px',
                background: '#1d4ed8',
                border: 'none',
                borderRadius: 6,
                fontSize: 12.5,
                fontWeight: 600,
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
              Done
            </button>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#eaf3fd', borderBottom: '1.5px solid #bfdbfe' }}>
              <th style={thStyle({ align: 'center', width: 46 })}>#</th>
              <th style={thStyle({ align: 'left' })}>Particulars</th>
              <th style={thStyle({ align: 'right', width: 140 })}>Tax Amount (₹)</th>
              <th style={thStyle({ align: 'right', width: 140 })}>CGST (₹)</th>
              <th style={thStyle({ align: 'right', width: 140 })}>SGST (₹)</th>
              <th style={thStyle({ align: 'right', width: 140 })}>Total (₹)</th>
              <th style={thStyle({ align: 'center', width: 130, isLast: true })}>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {adjustments.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #dbeafe' }}>
                <td style={tdStyle({ align: 'center', color: '#1e293b', weight: 600 })}>{i + 1}</td>
                <td style={tdStyle({ color: '#1e293b', weight: 500 })}>{r.particulars}</td>
                {['tax_amount', 'cgst', 'sgst', 'total'].map(k => (
                  <td key={k} style={tdStyle({ align: 'right' })}>
                    {editAdj && k !== 'total' ? (
                      <input
                        type="number"
                        value={r[k]}
                        onChange={e => setAdj(i, k, e.target.value)}
                        style={editInput}
                      />
                    ) : (
                      <span>{Number(r[k] || 0).toLocaleString('en-IN')}</span>
                    )}
                  </td>
                ))}
                <td style={tdStyle({ align: 'center', isLast: true })}>
                  {editAdj ? (
                    <input
                      type="text"
                      value={r.remarks || ''}
                      onChange={e => setAdj(i, 'remarks', e.target.value)}
                      placeholder="Remarks..."
                      style={{ ...editInput, width: '90%', textAlign: 'left' }}
                    />
                  ) : (
                    <span style={{ color: '#64748b' }}>{r.remarks || '-'}</span>
                  )}
                </td>
              </tr>
            ))}
            <tr style={{ background: '#eaf3fd', fontWeight: 800 }}>
              <td style={tdStyle({ align: 'center', color: '#1d4ed8' })}></td>
              <td style={tdStyle({ color: '#1d4ed8', weight: 800 })}>Total Adjustment</td>
              <td style={tdStyle({ align: 'right', color: '#1d4ed8', weight: 800 })}>{r2(adjTaxSum).toLocaleString('en-IN')}</td>
              <td style={tdStyle({ align: 'right', color: '#1d4ed8', weight: 800 })}>{r2(adjCgstSum).toLocaleString('en-IN')}</td>
              <td style={tdStyle({ align: 'right', color: '#1d4ed8', weight: 800 })}>{r2(adjSgstSum).toLocaleString('en-IN')}</td>
              <td style={tdStyle({ align: 'right', color: '#1d4ed8', weight: 800 })}>
                {Number(r2(adjTotal)).toLocaleString('en-IN')}
              </td>
              <td style={tdStyle({ align: 'center', isLast: true })}></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Section 3 & 4 (Grid: 1fr 1.5fr) */}
      <div className="cm-two" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 16, marginBottom: 18 }}>

        {/* 3. Net Tax Payable */}
        <div className="cm-table-card" style={{
          background: '#fff',
          border: '1.5px solid #bfdbfe',
          borderRadius: 10,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{
            padding: '10px 16px',
            borderBottom: '1.5px solid #bfdbfe',
            fontWeight: 800,
            fontSize: 15,
            color: '#1d4ed8',
          }}>
            3. Net Tax Payable
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, flex: 1 }}>
            <thead>
              <tr style={{ background: '#eaf3fd', borderBottom: '1.5px solid #bfdbfe' }}>
                <th style={thStyle({ align: 'left' })}>Particulars</th>
                <th style={thStyle({ align: 'right', width: 140, isLast: true })}>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Total Tax Liability', val: taxLiability, isBold: false, isBg: false },
                { label: 'Add / Less: Adjustments', val: adjTotal, isBold: false, isBg: false },
                { label: 'Net Tax Payable', val: netPayable, isBold: true, isBg: true },
                { label: 'Less: Tax Paid', val: taxPaid, isBold: false, isBg: false },
                { label: 'Balance Payable', val: balancePayable, isBold: true, isBg: true },
              ].map((row, idx) => (
                <tr
                  key={row.label}
                  style={{
                    borderBottom: '1px solid #dbeafe',
                    background: row.isBg ? '#eaf3fd' : 'transparent',
                  }}
                >
                  <td style={tdStyle({ color: row.isBold ? '#1d4ed8' : '#1e293b', weight: row.isBold ? 800 : 500 })}>
                    {row.label}
                  </td>
                  <td style={tdStyle({ align: 'right', color: row.isBold ? '#1d4ed8' : '#1e293b', weight: row.isBold ? 800 : 500, isLast: true })}>
                    {Number(row.val).toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 4. Tax Payment Details */}
        <div className="cm-table-card" style={{
          background: '#fff',
          border: '1.5px solid #bfdbfe',
          borderRadius: 10,
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '10px 16px',
            borderBottom: '1.5px solid #bfdbfe',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ fontWeight: 800, fontSize: 15, color: '#1d4ed8' }}>
              4. Tax Payment Details
            </span>
            <button
              onClick={openAddPay}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 14px',
                background: '#fff',
                border: '1.5px solid #93c5fd',
                borderRadius: 6,
                fontSize: 12.5,
                fontWeight: 600,
                color: '#1d4ed8',
                cursor: 'pointer',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              Add Payment Entry
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: '#eaf3fd', borderBottom: '1.5px solid #bfdbfe' }}>
                <th style={thStyle({ align: 'center', width: 36 })}>#</th>
                <th style={thStyle({ align: 'center', width: 105 })}>Payment Date</th>
                <th style={thStyle({ align: 'center', width: 120 })}>Challan No.</th>
                <th style={thStyle({ align: 'center', width: 140 })}>Mode of Payment</th>
                <th style={thStyle({ align: 'right', width: 120 })}>Amount Paid (₹)</th>
                <th style={thStyle({ align: 'center', width: 90 })}>Remarks</th>
                <th style={thStyle({ align: 'center', width: 80, isLast: true })}>Action</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 && (
                <tr style={{ borderBottom: '1px solid #dbeafe' }}>
                  <td style={tdStyle({ align: 'center', color: '#94a3b8' })}>1</td>
                  <td style={tdStyle({ align: 'center', color: '#94a3b8' })}>-</td>
                  <td style={tdStyle({ align: 'center', color: '#94a3b8' })}>-</td>
                  <td style={tdStyle({ align: 'center', color: '#94a3b8' })}>-</td>
                  <td style={tdStyle({ align: 'right', color: '#94a3b8' })}>-</td>
                  <td style={tdStyle({ align: 'center', color: '#94a3b8' })}>-</td>
                  <td style={tdStyle({ align: 'center', isLast: true })}>
                    <button onClick={openAddPay} style={{ ...iconBtn, color: '#1d4ed8' }} title="Add payment">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    </button>
                  </td>
                </tr>
              )}
              {payments.map((p, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #dbeafe' }}>
                  <td style={tdStyle({ align: 'center', color: '#1e293b', weight: 600 })}>{i + 1}</td>
                  <td style={tdStyle({ align: 'center', color: '#1e293b' })}>{p.date}</td>
                  <td style={tdStyle({ align: 'center', color: '#1e293b' })}>{p.challan_no}</td>
                  <td style={tdStyle({ align: 'center', color: '#1e293b' })}>{p.mode}</td>
                  <td style={tdStyle({ align: 'right', color: '#1e293b', weight: 600 })}>
                    {Number(p.amount || 0).toLocaleString('en-IN')}
                  </td>
                  <td style={tdStyle({ align: 'center', color: '#64748b' })}>{p.remarks || '-'}</td>
                  <td style={tdStyle({ align: 'center', isLast: true })}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button onClick={() => openEditPay(i)} style={iconBtn} title="Edit payment">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                      </button>
                      <button onClick={() => deletePay(i)} style={{ ...iconBtn, borderColor: '#fecaca' }} title="Delete payment">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              <tr style={{ background: '#eaf3fd', fontWeight: 800 }}>
                <td colSpan={4} style={tdStyle({ color: '#1d4ed8', weight: 800, align: 'center' })}>
                  Total Tax Paid
                </td>
                <td style={tdStyle({ align: 'right', color: '#1d4ed8', weight: 800 })}>
                  {Number(taxPaid).toLocaleString('en-IN')}
                </td>
                <td colSpan={2} style={tdStyle({ isLast: true })}></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Remarks & Action Buttons */}
      <div style={{
        background: '#fff',
        border: '1.5px solid #bfdbfe',
        borderRadius: 10,
        padding: '14px 18px',
      }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a', marginBottom: 8 }}>
          Remarks (Internal)
        </div>
        {request.hasOpen && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '8px 12px', marginBottom: 10, fontSize: 12.5, color: '#92400e' }}>
            {request.openMessage}
          </div>
        )}
        <textarea
          value={remarks}
          onChange={e => setRemarks(e.target.value)}
          placeholder="Add internal remarks here..."
          style={{
            width: '100%',
            minHeight: 52,
            padding: '8px 12px',
            border: '1.5px solid #bfdbfe',
            borderRadius: 7,
            fontSize: 13,
            color: '#1e293b',
            boxSizing: 'border-box',
            outline: 'none',
            resize: 'vertical',
            marginBottom: 12,
            background: '#fff',
          }}
        />

        <div className="cm-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {saveMsg && <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>{saveMsg}</span>}
            {saveErr && <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 600 }}>{saveErr}</span>}
          </div>
          <div className="cm-actions-btns" style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => saveAll(null, null, null, remarks)}
              style={{
                padding: '8px 24px',
                background: '#fff',
                border: '1.5px solid #bfdbfe',
                borderRadius: 7,
                fontSize: 13,
                fontWeight: 600,
                color: '#1d4ed8',
                cursor: 'pointer',
              }}
            >
              Save Draft
            </button>
            <button
              onClick={request.openInitiate}
              disabled={request.hasOpen}
              style={{
                padding: '8px 26px',
                background: request.hasOpen ? '#94a3b8' : '#1d4ed8',
                border: 'none',
                borderRadius: 7,
                fontSize: 13,
                fontWeight: 600,
                color: '#fff',
                cursor: request.hasOpen ? 'not-allowed' : 'pointer',
              }}
            >
              {request.hasOpen ? request.openLabel : 'Initiate Request'}
            </button>
            <button
              onClick={request.openReject}
              disabled={!request.canReject}
              title={request.canReject ? 'Reject the request submitted by the client' : 'Reject is available only for a request submitted by the client'}
              style={{
                padding: '8px 24px',
                background: '#fff',
                border: `1.5px solid ${request.canReject ? '#ef4444' : '#cbd5e1'}`,
                borderRadius: 7,
                fontSize: 13,
                fontWeight: 600,
                color: request.canReject ? '#dc2626' : '#94a3b8',
                cursor: request.canReject ? 'pointer' : 'not-allowed',
              }}
            >
              Reject
            </button>
          </div>
        </div>
      </div>

      {/* Payment Entry Modal */}
      {payModal && (
        <ModalWrap title={payEditIdx !== null ? 'Edit Payment Entry' : 'Add Payment Entry'} onClose={() => setPayModal(false)}>
          <div className="cm-modal-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={modalLbl}>Payment Date</label>
              <input
                type="date"
                value={payForm.date}
                onChange={e => setPayForm(f => ({ ...f, date: e.target.value }))}
                style={modalIpt}
              />
            </div>
            <div>
              <label style={modalLbl}>Challan No.</label>
              <input
                type="text"
                placeholder="e.g. 012345678901"
                value={payForm.challan_no}
                onChange={e => setPayForm(f => ({ ...f, challan_no: e.target.value }))}
                style={modalIpt}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={modalLbl}>Mode of Payment</label>
              <select
                value={payForm.mode}
                onChange={e => setPayForm(f => ({ ...f, mode: e.target.value }))}
                style={modalIpt}
              >
                {['Online (Net Banking)', 'NEFT/RTGS', 'UPI', 'Over The Counter (Cash)', 'Cheque'].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={modalLbl}>Amount Paid (₹)</label>
              <input
                type="number"
                value={payForm.amount}
                onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                style={{ ...modalIpt, textAlign: 'right' }}
              />
            </div>
            <div>
              <label style={modalLbl}>Remarks</label>
              <input
                type="text"
                placeholder="Optional"
                value={payForm.remarks}
                onChange={e => setPayForm(f => ({ ...f, remarks: e.target.value }))}
                style={modalIpt}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setPayModal(false)}
              style={{
                padding: '7px 18px',
                background: '#fff',
                border: '1.5px solid #bfdbfe',
                borderRadius: 7,
                fontSize: 13,
                fontWeight: 600,
                color: '#64748b',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={submitPay}
              style={{
                padding: '7px 22px',
                background: '#1d4ed8',
                border: 'none',
                borderRadius: 7,
                fontSize: 13,
                fontWeight: 600,
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Save Entry
            </button>
          </div>
        </ModalWrap>
      )}

      {/* Mark as Filed Modal */}
      {filedPopup && (
        <ModalWrap title={`Mark ${quarter_label || period} as Filed`} onClose={() => setFiledPopup(false)}>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12.5, color: '#1e40af' }}>
            ℹ Once marked as filed, the return status will be updated to Filed in the database.
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={modalLbl}>Filing Date <span style={{ color: '#dc2626' }}>*</span></label>
            <input
              type="date"
              value={filedOn}
              onChange={e => setFiledOn(e.target.value)}
              style={modalIpt}
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={modalLbl}>ARN / Ack No. <span style={{ color: '#dc2626' }}>*</span></label>
            <input
              type="text"
              placeholder="e.g. AA2707260123456"
              value={arnVal}
              onChange={e => setArnVal(e.target.value)}
              style={modalIpt}
            />
          </div>
          {filedErr && (
            <div style={{ fontSize: 12, color: '#dc2626', background: '#fef2f2', padding: '8px 12px', borderRadius: 7, marginBottom: 12 }}>
              {filedErr}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setFiledPopup(false)}
              style={{
                padding: '7px 18px',
                background: '#fff',
                border: '1.5px solid #bfdbfe',
                borderRadius: 7,
                fontSize: 13,
                fontWeight: 600,
                color: '#64748b',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={submitMarkFiled}
              disabled={marking}
              style={{
                padding: '7px 22px',
                background: '#1d4ed8',
                border: 'none',
                borderRadius: 7,
                fontSize: 13,
                fontWeight: 600,
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              {marking ? 'Saving...' : 'Submit'}
            </button>
          </div>
        </ModalWrap>
      )}

      {request.modals}
    </div>
  );
}

function ModalWrap({ title, onClose, children }) {
  return (
    <div className="cm-modal" style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.45)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backdropFilter: 'blur(2px)',
    }}>
      <div className="cm-modal-box" style={{
        background: '#fff',
        borderRadius: 12,
        width: 480,
        padding: '22px 24px',
        boxShadow: '0 20px 50px rgba(0,0,0,.15)',
        maxHeight: '90vh',
        overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a' }}>{title}</div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 22, lineHeight: 1 }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const thStyle = ({ align = 'left', width, isLast = false }) => ({
  padding: '10px 14px',
  textAlign: align,
  fontWeight: 700,
  fontSize: 12.5,
  color: '#1d4ed8',
  whiteSpace: 'nowrap',
  width: width || 'auto',
  borderRight: isLast ? 'none' : '1px solid #dbeafe',
});

const tdStyle = ({ align = 'left', color = '#1e293b', weight = 400, isLast = false }) => ({
  padding: '9.5px 14px',
  textAlign: align,
  color,
  fontWeight: weight,
  fontSize: 13,
  borderRight: isLast ? 'none' : '1px solid #eff6ff',
});

const editInput = {
  width: 100,
  padding: '4px 8px',
  border: '1.5px solid #bfdbfe',
  borderRadius: 6,
  fontSize: 12.5,
  color: '#1e293b',
  outline: 'none',
  background: '#fff',
  boxSizing: 'border-box',
};

const modalLbl = {
  fontSize: 12,
  fontWeight: 600,
  color: '#334155',
  display: 'block',
  marginBottom: 4,
};

const modalIpt = {
  width: '100%',
  padding: '8px 12px',
  border: '1.5px solid #bfdbfe',
  borderRadius: 7,
  fontSize: 13,
  color: '#1e293b',
  boxSizing: 'border-box',
  outline: 'none',
};

const iconBtn = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 26,
  height: 26,
  background: '#fff',
  border: '1.5px solid #93c5fd',
  borderRadius: 5,
  cursor: 'pointer',
};
