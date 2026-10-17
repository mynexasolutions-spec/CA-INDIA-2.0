import { createContext, useContext, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../api/client';

// Lets the shared bottom action bar (RemarksButtons) open the Reject popup without threading a prop through every tab.
const ReqActionsCtx = createContext({ onReject: null });

// Requests that are still open for the period: a second one cannot be initiated.
const REQ_ACTIVE = ['pending_client', 'submitted', 'accepted'];

const REQ_TONE = {
  pending_client: { bg: '#fffbeb', border: '#fde68a', color: '#92400e', pill: '#fef3c7' },
  submitted: { bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8', pill: '#dbeafe' },
  accepted: { bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d', pill: '#dcfce7' },
  completed: { bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d', pill: '#dcfce7' },
  rejected: { bg: '#fef2f2', border: '#fecaca', color: '#b91c1c', pill: '#fee2e2' },
};

const fmt = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '0';
  const num = Number(n);
  if (Number.isInteger(num)) {
    return num.toLocaleString('en-IN');
  }
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const R2 = fmt;
const sum = (...a) => a.reduce((s, v) => s + (+v || 0), 0);

const CROSS_LABELS = {
  igst_to_igst: 'IGST ITC → IGST liability',
  igst_to_cgst: 'IGST ITC → CGST liability',
  igst_to_sgst: 'IGST ITC → SGST/UTGST liability',
  cgst_to_cgst: 'CGST ITC → CGST liability',
  cgst_to_igst: 'CGST ITC → IGST liability',
  sgst_to_sgst: 'SGST/UTGST ITC → SGST/UTGST liability',
  sgst_to_igst: 'SGST/UTGST ITC → IGST liability',
};

/**
 * Automatic ITC set-off (Section 49 / Rule 88A order): IGST credit is used first
 * (IGST → CGST → SGST), then CGST and SGST credit against their own head, and only
 * then against IGST. CGST and SGST credit are never set off against each other.
 */
function crossUtilise(itc, liability) {
  const avail = { igst: Math.max(0, +itc.igst || 0), cgst: Math.max(0, +itc.cgst || 0), sgst: Math.max(0, +itc.sgst || 0) };
  const liab = { igst: Math.max(0, +liability.igst || 0), cgst: Math.max(0, +liability.cgst || 0), sgst: Math.max(0, +liability.sgst || 0) };
  const detail = Object.fromEntries(Object.keys(CROSS_LABELS).map((k) => [k, 0]));
  const apply = (from, to) => {
    const amt = Math.min(avail[from], liab[to]);
    avail[from] -= amt;
    liab[to] -= amt;
    detail[`${from}_to_${to}`] += amt;
  };
  apply('igst', 'igst');
  apply('igst', 'cgst');
  apply('igst', 'sgst');
  apply('cgst', 'cgst');
  apply('sgst', 'sgst');
  apply('cgst', 'igst');
  apply('sgst', 'igst');
  const used = {
    igst: detail.igst_to_igst + detail.igst_to_cgst + detail.igst_to_sgst,
    cgst: detail.cgst_to_cgst + detail.cgst_to_igst,
    sgst: detail.sgst_to_sgst + detail.sgst_to_igst,
  };
  return { used, balance: avail, detail };
}
const TABS = ['Summary', 'Outward Supply & RCM', 'ITC Related', 'Interest & Late Fee', 'Cash Ledger'];

export default function AdminGstr3bReview() {
  const { clientId, period } = useParams();

  const [data, setData]         = useState(null);
  const [tabData, setTabData]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState('Summary');
  const [filedPopup, setFiledPopup] = useState(false);
  const [filedOn, setFiledOn]   = useState('');
  const [arnVal, setArnVal]     = useState('');
  const [filedErr, setFiledErr] = useState('');
  const [marking, setMarking]   = useState(false);

  // Initiate Request state
  const [reqStatus, setReqStatus]         = useState(null); // null = not loaded yet
  const [initPopup, setInitPopup]         = useState(false);
  const [rejectPopup, setRejectPopup]     = useState(false);
  const [rejectReason, setRejectReason]   = useState('');
  const [rejecting, setRejecting]         = useState(false);
  const [rejectErr, setRejectErr]         = useState('');
  const [viewReq, setViewReq]             = useState(false);
  const [initiating, setInitiating]       = useState(false);
  const [initErr, setInitErr]             = useState('');

  const [error, setError]       = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      api(`/admin/clients/${clientId}/gstr3b/period/${period}`),
      api(`/admin/clients/${clientId}/gstr3b/period/${period}/tab-data`),
      api(`/admin/clients/${clientId}/gstr3b/period/${period}/request`).catch(() => ({ request: null })),
    ])
      .then(([d, td, rq]) => {
        setData(d);
        setTabData(td);
        setReqStatus(rq?.request ?? null);
      })
      .catch((err) => {
        console.error(err);
        setError(err?.message || 'Failed to load GSTR-3B details.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [clientId, period]);

  const saveTabData = async (payload) => {
    try {
      await api(`/admin/clients/${clientId}/gstr3b/period/${period}/tab-data`, { method:'POST', body: payload });
      load();
    } catch(e) { alert(e.message); }
  };

  const submitInitiate = async () => {
    setInitErr('');
    setInitiating(true);
    try {
      const res = await api(`/admin/clients/${clientId}/gstr3b/period/${period}/request`, { method:'POST', body:{} });
      setReqStatus(res.request);
      setInitPopup(false);
    } catch(e) { setInitErr(e.message || 'Failed to initiate request.'); }
    finally { setInitiating(false); }
  };

  const submitReject = async () => {
    if (!rejectReason.trim()) { setRejectErr('Please provide a reason for rejecting this request.'); return; }
    setRejecting(true);
    setRejectErr('');
    try {
      const res = await api(`/admin/clients/${clientId}/gstr3b/period/${period}/request/reject`, { method:'POST', body:{ reason: rejectReason.trim() } });
      setReqStatus(res.request);
      setRejectPopup(false);
      setRejectReason('');
    } catch(e) { setRejectErr(e.message || 'Failed to reject the request.'); }
    finally { setRejecting(false); }
  };

  const submitMarkFiled = async () => {
    setFiledErr('');
    if (!filedOn) { setFiledErr('Filed On date is required.'); return; }
    if (!arnVal)  { setFiledErr('ARN is required.'); return; }
    setMarking(true);
    try {
      await api(`/admin/clients/${clientId}/gstr3b/period/${period}/mark-filed`, { method:'POST', body:{ filed_on:filedOn, arn:arnVal }});
      setFiledPopup(false); load();
    } catch(e) { setFiledErr(e.message); }
    finally { setMarking(false); }
  };

  if (loading) return <div style={{ padding: 40, color: '#94a3b8', textAlign: 'center' }}>Loading...</div>;

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ color: '#dc2626', fontWeight: 600, marginBottom: 12 }}>{error}</div>
        <button
          type="button"
          onClick={load}
          style={{ padding: '8px 20px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data || !tabData) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
        No GSTR-3B data available for this tax period.
      </div>
    );
  }

  const { client, period_label, due_date, return_status, summary, tax_payment_breakup, itc_balance } = data;
  const isFiled    = return_status === 'Filed';
  const freqLabel  = client?.filing_frequency === 'quarterly' ? 'Quarterly' : 'Monthly';
  const breadcrumbTab = tab === 'Summary' ? 'Client Details' : tab;

  return (
    <ReqActionsCtx.Provider value={{ onReject: () => { setRejectErr(''); setRejectReason(''); setRejectPopup(true); } }}>
    <div style={{ fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif", padding: '0 0 40px' }}>
      {/* Header */}
      <div className="gst-head gst-head-list" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>
            GSTR-3B – Client Details (Admin Portal)
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: '#2563eb', fontWeight: 400 }}>
            Review, verify and manage GSTR-3B for the selected client.
          </p>
        </div>
        <div className="gst-crumbs gst-crumbs-right" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 500, paddingTop: 4 }}>
          <Link to="/admin/gst-returns?tab=gstr-3b" style={{ color: '#2563eb', textDecoration: 'none' }}>
            GST Compliance
          </Link>
          <span style={{ color: '#93c5fd', fontSize: 12 }}>&gt;</span>
          <Link to="/admin/gst-returns?tab=gstr-3b" style={{ color: '#2563eb', textDecoration: 'none' }}>
            GSTR-3B
          </Link>
          <span style={{ color: '#93c5fd', fontSize: 12 }}>&gt;</span>
          <span style={{ color: '#2563eb' }}>Client Details</span>
          {tab !== 'Summary' && (
            <>
              <span style={{ color: '#93c5fd', fontSize: 12 }}>&gt;</span>
              <span style={{ color: '#2563eb' }}>{tab}</span>
            </>
          )}
        </div>
      </div>

      {/* Client Summary Strip */}
      <div
        className="gst-strip"
        style={{
          background: '#fff',
          border: '1px solid #bfdbfe',
          borderRadius: 8,
          padding: '12px 20px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div className="gst-strip-fields" style={{ display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
          {[
            ['Client Name', client?.business_name || client?.client_name || '—'],
            ['GSTIN', client?.gstin || '—'],
            ['Tax Period', period_label],
            ['Filing Frequency', freqLabel],
            ['Due Date', due_date],
            ['Return Status', return_status],
          ].map(([k, v]) => (
            <div key={k} style={{ fontSize: 12 }}>
              <div style={{ color: '#64748b', marginBottom: 3, fontWeight: 500 }}>{k}</div>
              {k === 'Return Status' ? (
                <span
                  style={{
                    display: 'inline-block',
                    padding: '3px 16px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    background: isFiled ? '#dcfce7' : '#fef3c7',
                    color: isFiled ? '#15803d' : '#d97706',
                  }}
                >
                  {v}
                </span>
              ) : (
                <div style={{ fontWeight: 700, fontSize: 13.5, color: '#1e3a8a' }}>{v}</div>
              )}
            </div>
          ))}
        </div>
        {!isFiled && (
          <button
            type="button"
            onClick={() => setFiledPopup(true)}
            style={{
              padding: '0 24px',
              height: 38,
              background: '#1d4ed8',
              border: 'none',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              color: '#fff',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'background .15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#1e40af')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#1d4ed8')}
          >
            Mark as Filed
          </button>
        )}
      </div>

      {/* Request Status Bar */}
      {reqStatus && (() => {
        const tone = REQ_TONE[reqStatus.status] ?? REQ_TONE.submitted;
        return (
          <div
            style={{
              background: tone.bg,
              border: `1px solid ${tone.border}`,
              borderRadius: 8,
              padding: '10px 18px',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', fontSize: 13 }}>
              <span style={{ fontWeight: 700, color: tone.color }}>Request Status: {reqStatus.status_label}</span>
              <span style={{ color: '#64748b' }}>Initiated By: <b>{reqStatus.initiated_by_name}</b></span>
              <span style={{ color: '#64748b' }}>Request Date: {reqStatus.created_at}</span>
              {reqStatus.rejection_reason && <span style={{ color: '#b91c1c' }}>Reason: {reqStatus.rejection_reason}</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ padding: '3px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, background: tone.pill, color: tone.color }}>
                {reqStatus.status_label}
              </span>
              <button
                type="button"
                onClick={() => setViewReq(true)}
                style={{ height: 30, padding: '0 14px', background: '#fff', border: '1.5px solid #1d4ed8', borderRadius: 6, fontSize: 12.5, fontWeight: 600, color: '#1d4ed8', cursor: 'pointer' }}
              >
                View Request
              </button>
            </div>
          </div>
        );
      })()}

      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              style={{
                padding: '9px 22px',
                border: active ? 'none' : '1px solid #bfdbfe',
                borderRadius: 8,
                background: active ? '#1d4ed8' : '#fff',
                color: active ? '#fff' : '#1e3a8a',
                fontWeight: active ? 700 : 600,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all .15s ease',
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = '#eff6ff';
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = '#fff';
              }}
            >
              {t}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {tab === 'Summary' && (
        <SummaryTab
          summary={summary}
          breakup={tax_payment_breakup}
          itcBalance={itc_balance}
          tabData={tabData}
          saveTabData={saveTabData}
          reqStatus={reqStatus}
          onInitiate={() => setInitPopup(true)}
        />
      )}
      {tab === 'Outward Supply & RCM' && (
        <OutwardRcmTab tabData={tabData} saveTabData={saveTabData} reqStatus={reqStatus} onInitiate={() => setInitPopup(true)} />
      )}
      {tab === 'ITC Related' && (
        <ItcRelatedTab tabData={tabData} saveTabData={saveTabData} reqStatus={reqStatus} onInitiate={() => setInitPopup(true)} />
      )}
      {tab === 'Interest & Late Fee' && (
        <InterestLateFeeTab tabData={tabData} saveTabData={saveTabData} reqStatus={reqStatus} onInitiate={() => setInitPopup(true)} />
      )}
      {tab === 'Cash Ledger' && (
        <CashLedgerTab tabData={tabData} saveTabData={saveTabData} reqStatus={reqStatus} onInitiate={() => setInitPopup(true)} />
      )}

      {/* Initiate Request Popup */}
      {initPopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(2px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: 460, padding: 24, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontWeight: 700, fontSize: 17, color: '#1e3a8a' }}>Initiate GSTR-3B Request?</h3>
              <button
                type="button"
                onClick={() => { setInitPopup(false); setInitErr(''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 20 }}
              >
                ✕
              </button>
            </div>
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 14px', marginBottom: 18, fontSize: 13, color: '#1e40af', lineHeight: 1.6 }}>
              You are about to initiate a GSTR-3B request for <b>{data?.client?.business_name}</b> – <b>{data?.period_label}</b>.<br />
              The request will be sent to the client for review and action.
            </div>
            {initErr && <div style={{ fontSize: 12, color: '#dc2626', background: '#fef2f2', padding: '8px 12px', borderRadius: 7, marginBottom: 12 }}>{initErr}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setInitPopup(false); setInitErr(''); }} style={btnOutline}>Cancel</button>
              <button type="button" onClick={submitInitiate} disabled={initiating} style={btnBlue}>{initiating ? 'Initiating...' : 'Initiate Request'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Mark as Filed Popup */}
      {filedPopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(2px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: 440, padding: 24, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontWeight: 700, fontSize: 17, color: '#1e3a8a' }}>Mark {period_label} as Filed</h3>
              <button type="button" onClick={() => setFiledPopup(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 20 }}>✕</button>
            </div>
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 12.5, color: '#1e40af' }}>
              ℹ Once marked as filed, the return status will be updated to Filed and the ARN will be recorded.
            </div>
            <label style={labelSt}>Filed On <span style={{ color: '#dc2626' }}>*</span></label>
            <input type="date" value={filedOn} onChange={(e) => setFiledOn(e.target.value)} style={{ ...inputSt, marginBottom: 14 }} />
            <label style={labelSt}>ARN (Acknowledgement Number) <span style={{ color: '#dc2626' }}>*</span></label>
            <input type="text" value={arnVal} onChange={(e) => setArnVal(e.target.value)} placeholder="Enter ARN..." style={{ ...inputSt, marginBottom: 14 }} />
            {filedErr && <div style={{ fontSize: 12, color: '#dc2626', background: '#fef2f2', padding: '8px 12px', borderRadius: 7, marginBottom: 12 }}>{filedErr}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setFiledPopup(false)} style={btnOutline}>Cancel</button>
              <button type="button" onClick={submitMarkFiled} disabled={marking} style={btnBlue}>{marking ? 'Saving...' : 'Submit'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Reject a client-submitted request */}
      {rejectPopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(2px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: 460, padding: 24, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontWeight: 700, fontSize: 17, color: '#1e3a8a' }}>Reject GSTR-3B Request?</h3>
              <button type="button" onClick={() => setRejectPopup(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 20 }}>✕</button>
            </div>
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#991b1b', lineHeight: 1.6 }}>
              You are rejecting the GSTR-3B request submitted by <b>{data?.client?.business_name}</b> for <b>{data?.period_label}</b>. The client will see the reason.
            </div>
            <label style={labelSt}>Reason <span style={{ color: '#dc2626' }}>*</span></label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Enter reason"
              style={{ ...inputSt, marginBottom: 14, resize: 'vertical', fontFamily: 'inherit' }}
            />
            {rejectErr && <div style={{ fontSize: 12, color: '#dc2626', background: '#fef2f2', padding: '8px 12px', borderRadius: 7, marginBottom: 12 }}>{rejectErr}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setRejectPopup(false)} style={btnOutline}>Cancel</button>
              <button type="button" onClick={submitReject} disabled={rejecting} style={{ ...btnBlue, background: '#dc2626' }}>{rejecting ? 'Rejecting...' : 'Reject Request'}</button>
            </div>
          </div>
        </div>
      )}

      {/* View Request */}
      {viewReq && reqStatus && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(2px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: 440, padding: 24, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontWeight: 700, fontSize: 17, color: '#1e3a8a' }}>GSTR-3B Request</h3>
              <button type="button" onClick={() => setViewReq(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 20 }}>✕</button>
            </div>
            <table style={{ width: '100%', fontSize: 13.5, borderCollapse: 'collapse' }}>
              <tbody>
                {[
                  ['Client Name', reqStatus.client_name ?? data?.client?.business_name],
                  ['Tax Period', reqStatus.period_label ?? data?.period_label],
                  ['Request Status', reqStatus.status_label],
                  ['Initiated By', reqStatus.initiated_by_name],
                  ['Request Date', reqStatus.created_at],
                  ...(reqStatus.rejection_reason ? [['Rejection Reason', reqStatus.rejection_reason]] : []),
                ].map(([k, v]) => (
                  <tr key={k} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '9px 0', color: '#64748b', width: 150 }}>{k}</td>
                    <td style={{ padding: '9px 0', color: '#0f172a', fontWeight: 600 }}>{v || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
              <button type="button" onClick={() => setViewReq(false)} style={btnBlue}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </ReqActionsCtx.Provider>
  );
}

/* ─────────────────── SUMMARY TAB ─────────────────── */
function SummaryTab({ summary, breakup, itcBalance, tabData, saveTabData, reqStatus, onInitiate }) {
  const [remarks, setRemarks] = useState(tabData?.remarks ?? '');
  const cards = [
    {
      label: 'Total Outward\nTaxable Value',
      val: summary?.total_outward_taxable ?? 0,
      bg: '#f0f7ff',
      br: '#dbeafe',
      icon: <DocIcon c="#2563eb" />,
    },
    {
      label: 'Total Output Tax\n(Outward + RCM)',
      val: summary?.total_output_tax ?? 0,
      bg: '#faf5ff',
      br: '#f3e8ff',
      icon: <CoinsIcon c="#9333ea" />,
    },
    {
      label: 'Total Eligible ITC',
      val: summary?.total_eligible_itc ?? 0,
      bg: '#f0fdf4',
      br: '#dcfce7',
      icon: <BoxIcon c="#10b981" />,
    },
    {
      label: 'Total Tax Liability',
      val: summary?.total_tax_liability ?? 0,
      bg: '#fef2f2',
      br: '#fee2e2',
      icon: <CalcIcon c="#ef4444" />,
    },
    {
      label: (summary?.net_tax_payable ?? 0) > 0 || !((summary?.excess_itc ?? 0) > 0) ? 'Net Tax Payable /\nExcess ITC' : 'Excess ITC\n(No tax payable)',
      val: (summary?.net_tax_payable ?? 0) > 0 ? summary.net_tax_payable : (summary?.excess_itc ?? 0),
      bg: '#f0f9ff',
      br: '#e0f2fe',
      icon: <BarIcon c="#0284c7" />,
      showInfo: true,
    },
  ];

  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 16, color: '#1e3a8a', marginBottom: 14 }}>
        GSTR-3B Summary
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 24 }}>
        {cards.map((c, i) => (
          <div
            key={i}
            style={{
              background: c.bg,
              border: `1px solid ${c.br}`,
              borderRadius: 8,
              padding: '16px 16px 14px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: 100,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flexShrink: 0, marginTop: 2 }}>{c.icon}</div>
              <div style={{ fontSize: 12, color: '#334155', fontWeight: 500, lineHeight: 1.35, whiteSpace: 'pre-line' }}>
                {c.label}
                {c.showInfo && (
                  <span
                    style={{
                      display: 'inline-flex',
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: '#2563eb',
                      color: '#fff',
                      fontSize: 9,
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      marginLeft: 5,
                      verticalAlign: 'middle',
                    }}
                  >
                    i
                  </span>
                )}
              </div>
            </div>
            <div style={{ fontWeight: 700, fontSize: 20, color: '#1e3a8a', marginTop: 14 }}>
              {c.val < 0 ? `(-) ₹ ${fmt(Math.abs(c.val))}` : `₹ ${fmt(c.val)}`}
            </div>
          </div>
        ))}
      </div>

      <div style={{ fontWeight: 700, fontSize: 16, color: '#1e3a8a', marginBottom: 12, marginTop: 24 }}>
        Tax Payment Breakup
      </div>
      <div style={{ background: '#fff', border: '1px solid #bfdbfe', borderRadius: 8, overflow: 'hidden', marginBottom: 24 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#eaf3fd', borderBottom: '1.5px solid #bfdbfe' }}>
              {['Particulars', 'Output Tax and RCM (₹)', 'ITC (₹)', 'Interest (₹)', 'Late Fee (₹)', 'Total Liability (₹)'].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '12px 18px',
                    textAlign: h === 'Particulars' ? 'left' : 'right',
                    fontWeight: 700,
                    color: '#1d4ed8',
                    fontSize: 13,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(breakup || []).map((r, i) => {
              const isTot = r.is_total || r.label === 'Total';
              return (
                <tr
                  key={i}
                  style={{
                    borderBottom: isTot ? 'none' : '1px solid #f1f5f9',
                    background: isTot ? '#eaf3fd' : undefined,
                    fontWeight: isTot ? 700 : 500,
                  }}
                >
                  <td style={{ padding: '12px 18px', color: isTot ? '#1d4ed8' : '#1e293b' }}>{r.label}</td>
                  <td style={{ padding: '12px 18px', textAlign: 'right', color: isTot ? '#1d4ed8' : '#1e293b' }}>{fmt(r.output)}</td>
                  <td style={{ padding: '12px 18px', textAlign: 'right', color: isTot ? '#1d4ed8' : '#1e293b' }}>{fmt(r.itc)}</td>
                  <td style={{ padding: '12px 18px', textAlign: 'right', color: isTot ? '#1d4ed8' : '#1e293b' }}>{fmt(r.interest)}</td>
                  <td style={{ padding: '12px 18px', textAlign: 'right', color: isTot ? '#1d4ed8' : '#1e293b' }}>{fmt(r.late_fee)}</td>
                  <td style={{ padding: '12px 18px', textAlign: 'right', color: isTot ? '#1d4ed8' : '#1e293b', fontWeight: 700 }}>
                    {fmt(r.liability)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, marginTop: 24 }}>
        <span style={{ fontWeight: 700, fontSize: 16, color: '#1e3a8a' }}>ITC Balance Details</span>
        <span
          style={{
            display: 'inline-flex',
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: '#2563eb',
            color: '#fff',
            fontSize: 10,
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
          }}
        >
          i
        </span>
      </div>
      <div style={{ background: '#fff', border: '1px solid #bfdbfe', borderRadius: 8, overflow: 'hidden', marginBottom: 24 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#eaf3fd', borderBottom: '1.5px solid #bfdbfe' }}>
              {['Particulars', 'IGST (₹)', 'CGST (₹)', 'SGST/UTGST (₹)', 'Total (₹)'].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '12px 18px',
                    textAlign: h === 'Particulars' ? 'left' : 'right',
                    fontWeight: 700,
                    color: '#1d4ed8',
                    fontSize: 13,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(itcBalance || []).map((r, i) => {
              const isTot = r.is_total || r.label === 'Balance ITC (Available)';
              return (
                <tr
                  key={i}
                  style={{
                    borderBottom: isTot ? 'none' : '1px solid #f1f5f9',
                    background: isTot ? '#eaf3fd' : undefined,
                    fontWeight: isTot ? 700 : 500,
                  }}
                >
                  <td style={{ padding: '12px 18px', color: isTot ? '#1d4ed8' : '#1e293b' }}>{r.label}</td>
                  {['igst', 'cgst', 'sgst', 'total'].map((k) => {
                    const val = r[k];
                    const formatted = val < 0 ? `(${fmt(Math.abs(val))})` : fmt(val);
                    return (
                      <td
                        key={k}
                        style={{
                          padding: '12px 18px',
                          textAlign: 'right',
                          color: isTot ? '#1d4ed8' : '#1e293b',
                          fontWeight: isTot ? 700 : 500,
                        }}
                      >
                        {formatted}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <RemarksButtons remarks={remarks} setRemarks={setRemarks} onSave={() => saveTabData({ remarks })} reqStatus={reqStatus} onInitiate={onInitiate} />
    </div>
  );
}

/* ─────────────────── OUTWARD SUPPLY & RCM TAB ─────────────────── */
function OutwardRcmTab({ tabData, saveTabData, reqStatus, onInitiate }) {
  const g1Data = tabData.gstr1 || {};
  // GSTR-1 liability is computed by the backend from this period's commercial documents.
  const g1 = {
    igst: g1Data.igst ?? 0,
    cgst: g1Data.cgst ?? 0,
    sgst: g1Data.sgst ?? 0,
  };

  const rawOutward = tabData.outward || {};
  const initialForm = {
    rcm_igst: rawOutward.rcm_igst ?? 0,
    rcm_cgst: rawOutward.rcm_cgst ?? 0,
    rcm_sgst: rawOutward.rcm_sgst ?? 0,
    adj_igst: rawOutward.adj_igst ?? 0,
    adj_cgst: rawOutward.adj_cgst ?? 0,
    adj_sgst: rawOutward.adj_sgst ?? 0,
  };

  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [remarks, setRemarks] = useState(tabData.remarks ?? '');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const rcmTotal = sum(form.rcm_igst, form.rcm_cgst, form.rcm_sgst);
  const adjTotal = sum(form.adj_igst, form.adj_cgst, form.adj_sgst);
  const totIgst = sum(g1.igst, form.rcm_igst, form.adj_igst);
  const totCgst = sum(g1.cgst, form.rcm_cgst, form.adj_cgst);
  const totSgst = sum(g1.sgst, form.rcm_sgst, form.adj_sgst);
  const g1Total = sum(g1.igst, g1.cgst, g1.sgst);
  const grandTotal = sum(totIgst, totCgst, totSgst);

  const cards = [
    {
      label: 'Liability to GSTR-1',
      val: `₹ ${fmt(g1Total)}`,
      color: '#1d4ed8',
      bg: '#f0f7ff',
      br: '#dbeafe',
      icon: <DocIcon c="#2563eb" />,
    },
    {
      label: 'RCM Liability',
      val: `₹ ${fmt(rcmTotal)}`,
      color: '#7c3aed',
      bg: '#faf5ff',
      br: '#ede9fe',
      icon: <CalcIcon c="#7c3aed" />,
    },
    {
      label: 'Total Liability\n(Outward + RCM)',
      val: `₹ ${fmt(sum(g1Total, rcmTotal))}`,
      color: '#1e3a8a',
      bg: '#fffdf5',
      br: '#fef3c7',
      icon: <RefreshIcon c="#f59e0b" />,
    },
    {
      label: 'Other Adjustments',
      val: `₹ ${fmt(adjTotal)}`,
      color: '#1e3a8a',
      bg: '#f0fdf4',
      br: '#dcfce7',
      icon: <DocIcon c="#10b981" />,
    },
  ];

  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 16, color: '#1e3a8a', marginBottom: 14 }}>
        Outward Supply and RCM
      </div>

      {/* 4 Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        {cards.map((c, i) => (
          <div
            key={i}
            style={{
              background: c.bg,
              border: `1px solid ${c.br}`,
              borderRadius: 8,
              padding: '16px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              minHeight: 80,
            }}
          >
            <div style={{ flexShrink: 0 }}>{c.icon}</div>
            <div>
              <div style={{ fontSize: 12, color: '#334155', fontWeight: 500, marginBottom: 4, lineHeight: 1.3, whiteSpace: 'pre-line' }}>
                {c.label}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: c.color }}>{c.val}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Details Table */}
      <div style={{ background: '#fff', border: '1px solid #bfdbfe', borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid #bfdbfe', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#1e3a8a' }}>Outward Supply and RCM Details</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => setEdit(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 18px',
                background: edit ? '#eff6ff' : '#fff',
                border: '1.5px solid #1d4ed8',
                borderRadius: 6,
                fontSize: 12.5,
                fontWeight: 600,
                color: '#1d4ed8',
                cursor: 'pointer',
              }}
            >
              <EditSvg /> Edit
            </button>
            <button
              type="button"
              onClick={() => {
                setEdit(false);
                saveTabData({ outward_rcm: form, remarks });
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 18px',
                background: '#1d4ed8',
                border: 'none',
                borderRadius: 6,
                fontSize: 12.5,
                fontWeight: 600,
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              <DoneSvg /> Done
            </button>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#eaf3fd', borderBottom: '1.5px solid #bfdbfe' }}>
              {['Particulars', 'IGST (₹)', 'CGST (₹)', 'SGST/UTGST (₹)', 'Total (₹)'].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '11px 18px',
                    textAlign: h === 'Particulars' ? 'left' : 'center',
                    fontWeight: 700,
                    color: '#1d4ed8',
                    fontSize: 13,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '11px 18px', color: '#1e293b' }}>Liability to GSTR-1 (Auto populated)</td>
              <td style={{ padding: '11px 18px', textAlign: 'center', color: '#1e293b' }}>{fmt(g1.igst)}</td>
              <td style={{ padding: '11px 18px', textAlign: 'center', color: '#1e293b' }}>{fmt(g1.cgst)}</td>
              <td style={{ padding: '11px 18px', textAlign: 'center', color: '#1e293b' }}>{fmt(g1.sgst)}</td>
              <td style={{ padding: '11px 18px', textAlign: 'center', color: '#1e293b', fontWeight: 600 }}>{fmt(g1Total)}</td>
            </tr>

            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '11px 18px', color: '#1e293b' }}>RCM Liability</td>
              {['rcm_igst', 'rcm_cgst', 'rcm_sgst'].map((k) => (
                <td key={k} style={{ padding: '8px 18px', textAlign: 'center' }}>
                  {edit ? (
                    <input
                      type="number"
                      value={form[k]}
                      onChange={(e) => set(k, e.target.value)}
                      style={{
                        width: 90,
                        padding: '4px 8px',
                        border: '1.5px solid #bfdbfe',
                        borderRadius: 6,
                        fontSize: 13,
                        textAlign: 'center',
                        color: '#1e293b',
                        outline: 'none',
                      }}
                    />
                  ) : (
                    <span style={{ color: '#1e293b' }}>{fmt(form[k])}</span>
                  )}
                </td>
              ))}
              <td style={{ padding: '11px 18px', textAlign: 'center', color: '#1e293b', fontWeight: 600 }}>{fmt(rcmTotal)}</td>
            </tr>

            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '11px 18px', color: '#1e293b' }}>Other Adjustments</td>
              {['adj_igst', 'adj_cgst', 'adj_sgst'].map((k) => (
                <td key={k} style={{ padding: '8px 18px', textAlign: 'center' }}>
                  <input
                    type="number"
                    value={form[k]}
                    disabled={!edit}
                    onChange={(e) => set(k, e.target.value)}
                    style={{
                      width: 90,
                      padding: '4px 8px',
                      border: '1px solid #bfdbfe',
                      borderRadius: 4,
                      fontSize: 13,
                      textAlign: 'center',
                      color: '#1e293b',
                      background: '#fff',
                      outline: 'none',
                    }}
                  />
                </td>
              ))}
              <td style={{ padding: '8px 18px', textAlign: 'center' }}>
                <div
                  style={{
                    display: 'inline-block',
                    width: 90,
                    padding: '4px 8px',
                    border: '1px solid #bfdbfe',
                    borderRadius: 4,
                    fontSize: 13,
                    textAlign: 'center',
                    color: '#1e293b',
                    background: '#fff',
                    boxSizing: 'border-box',
                  }}
                >
                  {fmt(adjTotal)}
                </div>
              </td>
            </tr>

            {/* Total Row */}
            <tr style={{ background: '#eaf3fd', fontWeight: 700 }}>
              <td style={{ padding: '11px 18px', color: '#1d4ed8' }}>Total</td>
              <td style={{ padding: '11px 18px', textAlign: 'center', color: '#1d4ed8' }}>{fmt(totIgst)}</td>
              <td style={{ padding: '11px 18px', textAlign: 'center', color: '#1d4ed8' }}>{fmt(totCgst)}</td>
              <td style={{ padding: '11px 18px', textAlign: 'center', color: '#1d4ed8' }}>{fmt(totSgst)}</td>
              <td style={{ padding: '11px 18px', textAlign: 'center', color: '#1d4ed8' }}>{fmt(grandTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <RemarksButtons
        remarks={remarks}
        setRemarks={setRemarks}
        onSave={() => saveTabData({ outward_rcm: form, remarks })}
        reqStatus={reqStatus}
        onInitiate={onInitiate}
      />
    </div>
  );
}

/* ─────────────────── ITC RELATED TAB ─────────────────── */
function ItcRelatedTab({ tabData, saveTabData, reqStatus, onInitiate }) {
  const rawG2b = tabData.itc_gstr2b || {};
  const g2b = {
    total_invoices: rawG2b.total_invoices ?? 0,
    matched: rawG2b.matched ?? 0,
    unmatched: rawG2b.unmatched ?? 0,
    igst: rawG2b.igst ?? 0,
    cgst: rawG2b.cgst ?? 0,
    sgst: rawG2b.sgst ?? 0,
    unmatched_itc: rawG2b.unmatched_itc ?? 0,
  };

  const rawItc = tabData.itc_data || {};
  const initialForm = {};
  ['bf', 'adj', 'rev', 'other'].forEach((r) => {
    ['igst', 'cgst', 'sgst'].forEach((h) => {
      initialForm[`${r}_${h}`] = rawItc[`${r}_${h}`] ?? 0;
    });
  });

  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [remarks, setRemarks] = useState(tabData.remarks ?? '');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const matchedItc = sum(g2b.igst, g2b.cgst, g2b.sgst);
  const unmatchedItc = g2b.unmatched_itc;

  const reconCards = [
    {
      label: 'Total Invoices',
      val: g2b.total_invoices,
      color: '#1d4ed8',
      bg: '#f0f7ff',
      br: '#dbeafe',
      icon: <DocIcon c="#2563eb" />,
      isAmt: false,
    },
    {
      label: 'Matched Invoices',
      val: g2b.matched,
      color: '#1e3a8a',
      bg: '#f0fdf4',
      br: '#dcfce7',
      icon: <CheckCircleIcon />,
      isAmt: false,
    },
    {
      label: 'Unmatched Invoices',
      val: g2b.unmatched,
      color: '#dc2626',
      bg: '#fef2f2',
      br: '#fee2e2',
      icon: <XCircleIcon />,
      isAmt: false,
    },
    {
      label: 'Matched ITC',
      val: `₹ ${fmt(matchedItc)}`,
      color: '#1d4ed8',
      bg: '#f0f7ff',
      br: '#dbeafe',
      icon: <CoinsIcon c="#2563eb" />,
      isAmt: true,
    },
    {
      label: 'Unmatched ITC',
      val: `₹ ${fmt(unmatchedItc)}`,
      color: '#dc2626',
      bg: '#fef2f2',
      br: '#fee2e2',
      icon: <CoinsIcon c="#dc2626" />,
      isAmt: true,
    },
  ];

  const bfTotal = sum(form.bf_igst, form.bf_cgst, form.bf_sgst);
  const adjTotal = sum(form.adj_igst, form.adj_cgst, form.adj_sgst);
  const revTotal = sum(form.rev_igst, form.rev_cgst, form.rev_sgst);
  const otherTotal = sum(form.other_igst, form.other_cgst, form.other_sgst);

  // ITC available per head = BF + Adjustment + GSTR-2B (eligible & matched) - Reversal + Other.
  const availBefore = (h) => sum(form[`bf_${h}`], form[`adj_${h}`], g2b[h], form[`other_${h}`]) - sum(form[`rev_${h}`]);
  const itcBefore = { igst: availBefore('igst'), cgst: availBefore('cgst'), sgst: availBefore('sgst') };

  // Set-off / cross-utilisation is automatic: the available ITC is set off against the
  // Output tax & RCM liability (GSTR-1 + RCM + adjustments from the Outward tab).
  const liability = tabData.liability || { igst: 0, cgst: 0, sgst: 0 };
  const so = crossUtilise(itcBefore, liability);
  const setoffTotal = sum(so.used.igst, so.used.cgst, so.used.sgst);

  const totIgst = itcBefore.igst - so.used.igst;
  const totCgst = itcBefore.cgst - so.used.cgst;
  const totSgst = itcBefore.sgst - so.used.sgst;
  const totAvail = sum(totIgst, totCgst, totSgst);
  const crossRows = Object.entries(so.detail).filter(([, v]) => v > 0);

  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 16, color: '#1e3a8a', marginBottom: 14 }}>
        ITC Reconciliation Summary
      </div>

      {/* 5 Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 20 }}>
        {reconCards.map((c, i) => (
          <div
            key={i}
            style={{
              background: c.bg,
              border: `1px solid ${c.br}`,
              borderRadius: 8,
              padding: '16px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              minHeight: 76,
            }}
          >
            <div style={{ flexShrink: 0 }}>{c.icon}</div>
            <div>
              <div style={{ fontSize: 12, color: '#334155', fontWeight: 500, marginBottom: 4, whiteSpace: 'nowrap' }}>
                {c.label}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: c.color }}>{c.val}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ITC Balance Details Table */}
      <div style={{ background: '#fff', border: '1px solid #bfdbfe', borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid #bfdbfe', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#1e3a8a' }}>ITC Balance Details</span>
            <span
              style={{
                display: 'inline-flex',
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: '#2563eb',
                color: '#fff',
                fontSize: 10,
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
              }}
            >
              i
            </span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => setEdit(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 18px',
                background: edit ? '#eff6ff' : '#fff',
                border: '1.5px solid #1d4ed8',
                borderRadius: 6,
                fontSize: 12.5,
                fontWeight: 600,
                color: '#1d4ed8',
                cursor: 'pointer',
              }}
            >
              <EditSvg /> Edit
            </button>
            <button
              type="button"
              onClick={() => {
                setEdit(false);
                saveTabData({ itc_data: form, remarks });
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 18px',
                background: '#1d4ed8',
                border: 'none',
                borderRadius: 6,
                fontSize: 12.5,
                fontWeight: 600,
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              <DoneSvg /> Done
            </button>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#eaf3fd', borderBottom: '1.5px solid #bfdbfe' }}>
              {['Particulars', 'IGST (₹)', 'CGST (₹)', 'SGST/UTGST (₹)', 'Total (₹)'].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '11px 18px',
                    textAlign: h === 'Particulars' ? 'left' : 'center',
                    fontWeight: 700,
                    color: '#1d4ed8',
                    fontSize: 13,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Brought Forward */}
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '11px 18px', color: '#1e293b' }}>Brought Forward from Previous Year</td>
              {['bf_igst', 'bf_cgst', 'bf_sgst'].map((k) => (
                <td key={k} style={{ padding: '8px 18px', textAlign: 'center' }}>
                  {edit ? (
                    <input
                      type="number"
                      value={form[k]}
                      onChange={(e) => set(k, e.target.value)}
                      style={{ width: 85, padding: '4px 6px', border: '1.5px solid #bfdbfe', borderRadius: 6, textAlign: 'center' }}
                    />
                  ) : (
                    <span style={{ color: '#1e293b' }}>{fmt(form[k])}</span>
                  )}
                </td>
              ))}
              <td style={{ padding: '11px 18px', textAlign: 'center', color: '#1e293b', fontWeight: 600 }}>{fmt(bfTotal)}</td>
            </tr>

            {/* Adjustment */}
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '11px 18px', color: '#1e293b' }}>Adjustment</td>
              {['adj_igst', 'adj_cgst', 'adj_sgst'].map((k) => (
                <td key={k} style={{ padding: '8px 18px', textAlign: 'center' }}>
                  {edit ? (
                    <input
                      type="number"
                      value={form[k]}
                      onChange={(e) => set(k, e.target.value)}
                      style={{ width: 85, padding: '4px 6px', border: '1.5px solid #bfdbfe', borderRadius: 6, textAlign: 'center' }}
                    />
                  ) : (
                    <span style={{ color: '#1e293b' }}>{fmt(form[k])}</span>
                  )}
                </td>
              ))}
              <td style={{ padding: '11px 18px', textAlign: 'center', color: '#1e293b', fontWeight: 600 }}>{fmt(adjTotal)}</td>
            </tr>

            {/* Current Period ITC (GSTR-2B) */}
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '11px 18px', color: '#1e293b' }}>Current Period ITC (GSTR-2B)</td>
              <td style={{ padding: '11px 18px', textAlign: 'center', color: '#1e293b' }}>{fmt(g2b.igst)}</td>
              <td style={{ padding: '11px 18px', textAlign: 'center', color: '#1e293b' }}>{fmt(g2b.cgst)}</td>
              <td style={{ padding: '11px 18px', textAlign: 'center', color: '#1e293b' }}>{fmt(g2b.sgst)}</td>
              <td style={{ padding: '11px 18px', textAlign: 'center', color: '#1e293b', fontWeight: 600 }}>{fmt(matchedItc)}</td>
            </tr>

            {/* Less: ITC Reversal */}
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '11px 18px', color: '#1e293b' }}>Less: ITC Reversal</td>
              {['rev_igst', 'rev_cgst', 'rev_sgst'].map((k) => (
                <td key={k} style={{ padding: '8px 18px', textAlign: 'center' }}>
                  {edit ? (
                    <input
                      type="number"
                      value={form[k]}
                      onChange={(e) => set(k, e.target.value)}
                      style={{ width: 85, padding: '4px 6px', border: '1.5px solid #bfdbfe', borderRadius: 6, textAlign: 'center' }}
                    />
                  ) : (
                    <span style={{ color: '#1e293b' }}>{form[k] > 0 ? `(${fmt(form[k])})` : fmt(form[k])}</span>
                  )}
                </td>
              ))}
              <td style={{ padding: '11px 18px', textAlign: 'center', color: '#1e293b', fontWeight: 600 }}>
                {revTotal > 0 ? `(${fmt(revTotal)})` : fmt(revTotal)}
              </td>
            </tr>

            {/* Less: Set-off / Cross Utilisation */}
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '11px 18px', color: '#1e293b' }}>
                Less: Set-off / Cross Utilisation
                <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '1px 8px' }}>Auto</span>
              </td>
              {['igst', 'cgst', 'sgst'].map((h) => (
                <td key={h} style={{ padding: '11px 18px', textAlign: 'center', color: '#1e293b' }}>
                  {so.used[h] > 0 ? `(${fmt(so.used[h])})` : fmt(0)}
                </td>
              ))}
              <td style={{ padding: '11px 18px', textAlign: 'center', color: '#1e293b', fontWeight: 600 }}>
                {setoffTotal > 0 ? `(${fmt(setoffTotal)})` : fmt(setoffTotal)}
              </td>
            </tr>

            {/* Other Adjustment */}
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '11px 18px', color: '#1e293b' }}>Other Adjustment</td>
              {['other_igst', 'other_cgst', 'other_sgst'].map((k) => (
                <td key={k} style={{ padding: '8px 18px', textAlign: 'center' }}>
                  {edit ? (
                    <input
                      type="number"
                      value={form[k]}
                      onChange={(e) => set(k, e.target.value)}
                      style={{ width: 85, padding: '4px 6px', border: '1.5px solid #bfdbfe', borderRadius: 6, textAlign: 'center' }}
                    />
                  ) : (
                    <span style={{ color: '#1e293b' }}>{fmt(form[k])}</span>
                  )}
                </td>
              ))}
              <td style={{ padding: '11px 18px', textAlign: 'center', color: '#1e293b', fontWeight: 600 }}>{fmt(otherTotal)}</td>
            </tr>

            {/* Total Available ITC */}
            <tr style={{ background: '#eaf3fd', fontWeight: 700 }}>
              <td style={{ padding: '11px 18px', color: '#1d4ed8' }}>Total Available ITC</td>
              <td style={{ padding: '11px 18px', textAlign: 'center', color: '#1d4ed8' }}>{fmt(totIgst)}</td>
              <td style={{ padding: '11px 18px', textAlign: 'center', color: '#1d4ed8' }}>{fmt(totCgst)}</td>
              <td style={{ padding: '11px 18px', textAlign: 'center', color: '#1d4ed8' }}>{fmt(totSgst)}</td>
              <td style={{ padding: '11px 18px', textAlign: 'center', color: '#1d4ed8' }}>{fmt(totAvail)}</td>
            </tr>
          </tbody>
        </table>
        <div style={{ padding: '12px 18px', borderTop: '1px solid #e2e8f0', fontSize: 12.5, color: '#475569', background: '#fafcff' }}>
          <div style={{ fontWeight: 700, color: '#1e3a8a', marginBottom: 6 }}>Cross-utilisation applied (automatic)</div>
          {crossRows.length === 0 ? (
            <div>No ITC set-off applicable — liability from Outward Supply &amp; RCM is {sum(liability.igst, liability.cgst, liability.sgst) > 0 ? 'not covered by available ITC.' : 'nil.'}</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 22px' }}>
              {crossRows.map(([k, v]) => (
                <span key={k}>
                  {CROSS_LABELS[k]}: <strong style={{ color: '#1e293b' }}>₹ {fmt(v)}</strong>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <RemarksButtons
        remarks={remarks}
        setRemarks={setRemarks}
        onSave={() => saveTabData({ itc_data: form, remarks })}
        reqStatus={reqStatus}
        onInitiate={onInitiate}
      />
    </div>
  );
}

/* ─────────────────── INTEREST & LATE FEE TAB ─────────────────── */
function InterestLateFeeTab({ tabData, saveTabData, reqStatus, onInitiate }) {
  const rawInt = tabData.interest || {};
  const blankRow = (raw, prefix) => ({
    [`${prefix}_igst`]: raw[`${prefix}_igst`] ?? 0,
    [`${prefix}_cgst`]: raw[`${prefix}_cgst`] ?? 0,
    [`${prefix}_sgst`]: raw[`${prefix}_sgst`] ?? 0,
    [`${prefix}_utgst`]: raw[`${prefix}_utgst`] ?? 0,
    [`${prefix}_remarks`]: raw[`${prefix}_remarks`] || '',
  });
  const initialInt = { ...blankRow(rawInt, 'output'), ...blankRow(rawInt, 'rcm'), ...blankRow(rawInt, 'other') };

  const rawFee = tabData.late_fee || {};
  const initialFee = { ...blankRow(rawFee, 'output'), ...blankRow(rawFee, 'rcm'), ...blankRow(rawFee, 'other') };

  const [intForm, setIntForm] = useState(initialInt);
  const [feeForm, setFeeForm] = useState(initialFee);
  const [editInt, setEditInt] = useState(false);
  const [editFee, setEditFee] = useState(false);
  const [remarks, setRemarks] = useState(tabData.remarks ?? '');

  const setI = (k, v) => setIntForm((f) => ({ ...f, [k]: v }));
  const setF = (k, v) => setFeeForm((f) => ({ ...f, [k]: v }));

  const intRows = [
    { label: 'Interest on Output Tax Liability', prefix: 'output', form: intForm, set: setI },
    { label: 'Interest on RCM', prefix: 'rcm', form: intForm, set: setI },
    { label: 'Other Interest', prefix: 'other', form: intForm, set: setI },
  ];
  const feeRows = [
    { label: 'Late Fee on Output Tax Liability', prefix: 'output', form: feeForm, set: setF },
    { label: 'Late Fee on RCM', prefix: 'rcm', form: feeForm, set: setF },
    { label: 'Other Late Fee', prefix: 'other', form: feeForm, set: setF },
  ];

  const rowTotal = (row) =>
    sum(
      row.form[`${row.prefix}_igst`],
      row.form[`${row.prefix}_cgst`],
      row.form[`${row.prefix}_sgst`],
      row.form[`${row.prefix}_utgst`]
    );
  const secTotal = (rows) => rows.reduce((s, r) => s + rowTotal(r), 0);

  const totalInt = secTotal(intRows);
  const totalFee = secTotal(feeRows);
  const totalPayable = totalInt + totalFee;

  const cards = [
    {
      label: 'Total Interest',
      val: `₹ ${fmt(totalInt)}`,
      color: '#1d4ed8',
      bg: '#f0f7ff',
      br: '#dbeafe',
      icon: <PercentCircleIcon />,
    },
    {
      label: 'Total Late Fee',
      val: `₹ ${fmt(totalFee)}`,
      color: '#1e3a8a',
      bg: '#fef2f2',
      br: '#fee2e2',
      icon: <CalendarCheckIcon />,
    },
    {
      label: 'Total Payable',
      val: `₹ ${fmt(totalPayable)}`,
      color: '#1e3a8a',
      bg: '#f0f7ff',
      br: '#dbeafe',
      icon: <MoneyBagIcon />,
    },
  ];

  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 16, color: '#1e3a8a', marginBottom: 14 }}>
        Interest &amp; Late Fee
      </div>

      {/* 3 Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        {cards.map((c, i) => (
          <div
            key={i}
            style={{
              background: c.bg,
              border: `1px solid ${c.br}`,
              borderRadius: 8,
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              minHeight: 80,
            }}
          >
            <div style={{ flexShrink: 0 }}>{c.icon}</div>
            <div>
              <div style={{ fontSize: 12.5, color: '#334155', fontWeight: 500, marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: c.color }}>{c.val}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 1. Interest Details */}
      <InterestFeeSubTable
        title="1. Interest Details"
        rows={intRows}
        edit={editInt}
        setEdit={setEditInt}
        getTotal={rowTotal}
        secTotal={totalInt}
        label="Total Interest"
        onDone={() => {
          setEditInt(false);
          saveTabData({ interest_data: intForm, remarks });
        }}
      />

      {/* 2. Late Fee Details */}
      <InterestFeeSubTable
        title="2. Late Fee Details"
        rows={feeRows}
        edit={editFee}
        setEdit={setEditFee}
        getTotal={rowTotal}
        secTotal={totalFee}
        label="Total Late Fee"
        style={{ marginTop: 20 }}
        onDone={() => {
          setEditFee(false);
          saveTabData({ late_fee_data: feeForm, remarks });
        }}
      />

      <RemarksButtons
        remarks={remarks}
        setRemarks={setRemarks}
        onSave={() => saveTabData({ interest_data: intForm, late_fee_data: feeForm, remarks })}
        reqStatus={reqStatus}
        onInitiate={onInitiate}
      />
    </div>
  );
}

function InterestFeeSubTable({ title, rows, edit, setEdit, getTotal, secTotal, onDone, label, style: st }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #bfdbfe', borderRadius: 8, overflow: 'hidden', ...(st || {}) }}>
      <div style={{ padding: '12px 18px', borderBottom: '1px solid #bfdbfe', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#1e3a8a' }}>{title}</span>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={() => setEdit(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 18px',
              background: edit ? '#eff6ff' : '#fff',
              border: '1.5px solid #1d4ed8',
              borderRadius: 6,
              fontSize: 12.5,
              fontWeight: 600,
              color: '#1d4ed8',
              cursor: 'pointer',
            }}
          >
            <EditSvg /> Edit
          </button>
          <button
            type="button"
            onClick={onDone}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 18px',
              background: '#1d4ed8',
              border: 'none',
              borderRadius: 6,
              fontSize: 12.5,
              fontWeight: 600,
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            <DoneSvg /> Done
          </button>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#eaf3fd', borderBottom: '1.5px solid #bfdbfe' }}>
            {['Particulars', 'IGST (₹)', 'CGST (₹)', 'SGST (₹)', 'UTGST (₹)', 'Total (₹)', 'Remarks'].map((h) => (
              <th
                key={h}
                style={{
                  padding: '11px 14px',
                  textAlign: h === 'Particulars' ? 'left' : h === 'Remarks' ? 'left' : 'center',
                  fontWeight: 700,
                  color: '#1d4ed8',
                  fontSize: 12.5,
                  whiteSpace: 'nowrap',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const p = r.prefix;
            return (
              <tr key={r.label} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 14px', color: '#1e293b' }}>{r.label}</td>
                {['igst', 'cgst', 'sgst', 'utgst'].map((t) => (
                  <td key={t} style={{ padding: '8px 12px', textAlign: 'center' }}>
                    {edit ? (
                      <input
                        type="number"
                        value={r.form[`${p}_${t}`]}
                        onChange={(e) => r.set(`${p}_${t}`, e.target.value)}
                        style={{
                          width: 75,
                          padding: '4px 6px',
                          border: '1.5px solid #bfdbfe',
                          borderRadius: 6,
                          textAlign: 'center',
                          fontSize: 12.5,
                        }}
                      />
                    ) : (
                      <span style={{ color: '#1e293b' }}>{fmt(r.form[`${p}_${t}`])}</span>
                    )}
                  </td>
                ))}
                <td style={{ padding: '10px 14px', textAlign: 'center', color: '#1e293b', fontWeight: 600 }}>
                  {fmt(getTotal(r))}
                </td>
                <td style={{ padding: '8px 14px' }}>
                  {edit ? (
                    <input
                      value={r.form[`${p}_remarks`] || ''}
                      onChange={(e) => r.set(`${p}_remarks`, e.target.value)}
                      style={{
                        width: '100%',
                        padding: '4px 8px',
                        border: '1px solid #bfdbfe',
                        borderRadius: 6,
                        fontSize: 12,
                        color: '#1e293b',
                      }}
                    />
                  ) : (
                    <span style={{ color: '#64748b', fontSize: 12 }}>{r.form[`${p}_remarks`] || ''}</span>
                  )}
                </td>
              </tr>
            );
          })}

          {/* Total Row */}
          <tr style={{ background: '#eaf3fd', fontWeight: 700 }}>
            <td style={{ padding: '10px 14px', color: '#1d4ed8' }}>{label}</td>
            {['igst', 'cgst', 'sgst', 'utgst'].map((t) => {
              const col = rows.reduce((s, r) => s + (+r.form[`${r.prefix}_${t}`] || 0), 0);
              return (
                <td key={t} style={{ padding: '10px 14px', textAlign: 'center', color: '#1d4ed8' }}>
                  {fmt(col)}
                </td>
              );
            })}
            <td style={{ padding: '10px 14px', textAlign: 'center', color: '#1d4ed8' }}>{fmt(secTotal)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ─────────────────── CASH LEDGER TAB ─────────────────── */
function CashLedgerTab({ tabData, saveTabData, reqStatus, onInitiate }) {
  const init = tabData.cash_ledger ?? {};
  const initialOB = {
    igst: init.opening_balance?.igst ?? 0,
    cgst: init.opening_balance?.cgst ?? 0,
    sgst: init.opening_balance?.sgst ?? 0,
  };
  const initialPays = init.payments ?? [];
  const initialUtils = init.utilisations ?? [];

  const [ob, setOb] = useState(initialOB);
  const [editOb, setEditOb] = useState(false);
  const [pays, setPays] = useState(initialPays);
  const [utils, setUtils] = useState(initialUtils);
  const [remarks, setRemarks] = useState(tabData.remarks ?? '');

  // Payment modal
  const [payModal, setPayModal] = useState(false);
  const [payEditIdx, setPayEditIdx] = useState(null);
  const emptyPay = { date: '', challan_no: '', mode: 'Online (Net Banking)', igst: 0, cgst: 0, sgst: 0, remarks: '' };
  const [payForm, setPayForm] = useState(emptyPay);

  // Utilisation modal
  const [utilModal, setUtilModal] = useState(false);
  const [utilEditIdx, setUtilEditIdx] = useState(null);
  const emptyUtil = { utilised_for: '', igst: 0, cgst: 0, sgst: 0, remarks: '' };
  const [utilForm, setUtilForm] = useState(emptyUtil);

  const setPay = (k, v) => setPayForm((f) => ({ ...f, [k]: v }));
  const setUtil = (k, v) => setUtilForm((f) => ({ ...f, [k]: v }));

  // Totals
  const depIgst = pays.reduce((s, p) => s + (+p.igst || 0), 0);
  const depCgst = pays.reduce((s, p) => s + (+p.cgst || 0), 0);
  const depSgst = pays.reduce((s, p) => s + (+p.sgst || 0), 0);
  const depTotal = sum(depIgst, depCgst, depSgst);

  const utlIgst = utils.reduce((s, u) => s + (+u.igst || 0), 0);
  const utlCgst = utils.reduce((s, u) => s + (+u.cgst || 0), 0);
  const utlSgst = utils.reduce((s, u) => s + (+u.sgst || 0), 0);
  const utlTotal = sum(utlIgst, utlCgst, utlSgst);

  const clsIgst = (+ob.igst || 0) + depIgst - utlIgst;
  const clsCgst = (+ob.cgst || 0) + depCgst - utlCgst;
  const clsSgst = (+ob.sgst || 0) + depSgst - utlSgst;
  const clsTotal = sum(clsIgst, clsCgst, clsSgst);
  const obTotal = sum(ob.igst, ob.cgst, ob.sgst);

  const totalPaymentsMade = depTotal;

  const save = (newPays, newUtils, newOb) => {
    const p = newPays ?? pays;
    const u = newUtils ?? utils;
    const o = newOb ?? ob;
    saveTabData({ cash_ledger: { opening_balance: o, payments: p, utilisations: u }, remarks });
  };

  const openAddPay = () => {
    setPayForm(emptyPay);
    setPayEditIdx(null);
    setPayModal(true);
  };
  const openEditPay = (i) => {
    setPayForm({ ...pays[i] });
    setPayEditIdx(i);
    setPayModal(true);
  };
  const submitPay = () => {
    let next;
    if (payEditIdx !== null) {
      next = pays.map((p, i) => (i === payEditIdx ? { ...payForm } : p));
    } else {
      next = [...pays, { ...payForm }];
    }
    setPays(next);
    setPayModal(false);
    save(next, null, null);
  };
  const deletePay = (i) => {
    const next = pays.filter((_, j) => j !== i);
    setPays(next);
    save(next, null, null);
  };

  const openAddUtil = () => {
    setUtilForm(emptyUtil);
    setUtilEditIdx(null);
    setUtilModal(true);
  };
  const openEditUtil = (i) => {
    setUtilForm({ ...utils[i] });
    setUtilEditIdx(i);
    setUtilModal(true);
  };
  const submitUtil = () => {
    let next;
    if (utilEditIdx !== null) {
      next = utils.map((u, i) => (i === utilEditIdx ? { ...utilForm } : u));
    } else {
      next = [...utils, { ...utilForm }];
    }
    setUtils(next);
    setUtilModal(false);
    save(null, next, null);
  };
  const deleteUtil = (i) => {
    const next = utils.filter((_, j) => j !== i);
    setUtils(next);
    save(null, next, null);
  };

  const cards = [
    {
      label: 'Total Cash Ledger Balance',
      val: `₹ ${fmt(obTotal)}`,
      color: '#1d4ed8',
      bg: '#f0f7ff',
      br: '#dbeafe',
      icon: <WalletIcon c="#2563eb" />,
    },
    {
      label: 'Total Utilised (Current Period)',
      val: `₹ ${fmt(utlTotal)}`,
      color: '#1d4ed8',
      bg: '#f0fdf4',
      br: '#dcfce7',
      icon: <CoinsIcon c="#10b981" />,
    },
    {
      label: 'Total Payments Made',
      val: `₹ ${fmt(totalPaymentsMade)}`,
      color: '#1d4ed8',
      bg: '#f0f7ff',
      br: '#dbeafe',
      icon: <DocIcon c="#2563eb" />,
    },
    {
      label: 'Total Balance Available',
      val: `₹ ${fmt(clsTotal)}`,
      color: '#1d4ed8',
      bg: '#fffdf5',
      br: '#fef3c7',
      icon: <ClockIcon />,
    },
  ];

  return (
    <div>
      {/* 4 Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        {cards.map((c, i) => (
          <div
            key={i}
            style={{
              background: c.bg,
              border: `1px solid ${c.br}`,
              borderRadius: 8,
              padding: '16px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              minHeight: 80,
            }}
          >
            <div style={{ flexShrink: 0 }}>{c.icon}</div>
            <div>
              <div style={{ fontSize: 12, color: '#334155', fontWeight: 500, marginBottom: 4, lineHeight: 1.3 }}>
                {c.label}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: c.color }}>{c.val}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 1. Cash Ledger Balance (As on Date) */}
      <div style={{ background: '#fff', border: '1px solid #bfdbfe', borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid #bfdbfe', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#1e3a8a' }}>1. Cash Ledger Balance (As on Date)</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => setEditOb(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 18px', background: editOb ? '#eff6ff' : '#fff', border: '1.5px solid #1d4ed8', borderRadius: 6, fontSize: 12.5, fontWeight: 600, color: '#1d4ed8', cursor: 'pointer' }}
            >
              <EditSvg /> Edit
            </button>
            <button
              type="button"
              onClick={() => { setEditOb(false); save(null, null, ob); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 18px', background: '#1d4ed8', border: 'none', borderRadius: 6, fontSize: 12.5, fontWeight: 600, color: '#fff', cursor: 'pointer' }}
            >
              <DoneSvg /> Done
            </button>
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#eaf3fd', borderBottom: '1.5px solid #bfdbfe' }}>
              {['Particulars', 'IGST (₹)', 'CGST (₹)', 'SGST/UTGST (₹)', 'Total (₹)'].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '11px 18px',
                    textAlign: h === 'Particulars' ? 'left' : 'center',
                    fontWeight: 700,
                    color: '#1d4ed8',
                    fontSize: 13,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '11px 18px', color: '#1e293b' }}>Opening Balance</td>
              {['igst', 'cgst', 'sgst'].map((h) => (
                <td key={h} style={{ padding: '8px 18px', textAlign: 'center', color: '#1e293b' }}>
                  {editOb ? (
                    <input
                      type="number"
                      value={ob[h]}
                      onChange={(e) => setOb((o) => ({ ...o, [h]: e.target.value }))}
                      style={{ width: 85, padding: '4px 6px', border: '1.5px solid #bfdbfe', borderRadius: 6, textAlign: 'center' }}
                    />
                  ) : (
                    fmt(ob[h])
                  )}
                </td>
              ))}
              <td style={{ padding: '11px 18px', textAlign: 'center', color: '#1e293b', fontWeight: 600 }}>{fmt(obTotal)}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '11px 18px', color: '#1e293b' }}>Add: Amount Deposited (Current Period)</td>
              <td style={{ padding: '11px 18px', textAlign: 'center', color: '#1e293b' }}>{fmt(depIgst)}</td>
              <td style={{ padding: '11px 18px', textAlign: 'center', color: '#1e293b' }}>{fmt(depCgst)}</td>
              <td style={{ padding: '11px 18px', textAlign: 'center', color: '#1e293b' }}>{fmt(depSgst)}</td>
              <td style={{ padding: '11px 18px', textAlign: 'center', color: '#1e293b', fontWeight: 600 }}>{fmt(depTotal)}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '11px 18px', color: '#1e293b' }}>Less: Amount Utilised (Current Period)</td>
              <td style={{ padding: '11px 18px', textAlign: 'center', color: '#1e293b' }}>{fmt(utlIgst)}</td>
              <td style={{ padding: '11px 18px', textAlign: 'center', color: '#1e293b' }}>{fmt(utlCgst)}</td>
              <td style={{ padding: '11px 18px', textAlign: 'center', color: '#1e293b' }}>{fmt(utlSgst)}</td>
              <td style={{ padding: '11px 18px', textAlign: 'center', color: '#1e293b', fontWeight: 600 }}>{fmt(utlTotal)}</td>
            </tr>
            <tr style={{ background: '#eaf3fd', fontWeight: 700 }}>
              <td style={{ padding: '11px 18px', color: '#1d4ed8' }}>Closing Balance (As on Date)</td>
              <td style={{ padding: '11px 18px', textAlign: 'center', color: '#1d4ed8' }}>{fmt(clsIgst)}</td>
              <td style={{ padding: '11px 18px', textAlign: 'center', color: '#1d4ed8' }}>{fmt(clsCgst)}</td>
              <td style={{ padding: '11px 18px', textAlign: 'center', color: '#1d4ed8' }}>{fmt(clsSgst)}</td>
              <td style={{ padding: '11px 18px', textAlign: 'center', color: '#1d4ed8' }}>{fmt(clsTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 2. Payments Made During the Period */}
      <div style={{ background: '#fff', border: '1px solid #bfdbfe', borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid #bfdbfe', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#1e3a8a' }}>2. Payments Made During the Period</span>
          <button
            type="button"
            onClick={openAddPay}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 16px',
              background: '#fff',
              border: '1.5px solid #1d4ed8',
              borderRadius: 6,
              fontSize: 12.5,
              fontWeight: 600,
              color: '#1d4ed8',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add Payment Entry
          </button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#eaf3fd', borderBottom: '1.5px solid #bfdbfe' }}>
              {['Sr. No.', 'Date', 'Challan No.', 'Mode of Payment', 'IGST (₹)', 'CGST (₹)', 'SGST/UTGST (₹)', 'Total (₹)', 'Remarks', 'Action'].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '10px 14px',
                    textAlign: ['IGST (₹)', 'CGST (₹)', 'SGST/UTGST (₹)', 'Total (₹)', 'Sr. No.', 'Date', 'Challan No.'].includes(h)
                      ? 'center'
                      : h === 'Action'
                      ? 'center'
                      : 'left',
                    fontWeight: 700,
                    color: '#1d4ed8',
                    fontSize: 12.5,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pays.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>No payments recorded for this period.</td></tr>
            )}
            {pays.map((p, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 14px', textAlign: 'center', color: '#1e293b' }}>{i + 1}</td>
                <td style={{ padding: '10px 14px', textAlign: 'center', color: '#1e293b', whiteSpace: 'nowrap' }}>{p.date}</td>
                <td style={{ padding: '10px 14px', textAlign: 'center', color: '#1e293b' }}>{p.challan_no}</td>
                <td style={{ padding: '10px 14px', color: '#1e293b' }}>{p.mode}</td>
                <td style={{ padding: '10px 14px', textAlign: 'center', color: '#1e293b' }}>{fmt(p.igst)}</td>
                <td style={{ padding: '10px 14px', textAlign: 'center', color: '#1e293b' }}>{fmt(p.cgst)}</td>
                <td style={{ padding: '10px 14px', textAlign: 'center', color: '#1e293b' }}>{fmt(p.sgst)}</td>
                <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: '#1e293b' }}>
                  {fmt(sum(p.igst, p.cgst, p.sgst))}
                </td>
                <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 12 }}>{p.remarks || '-'}</td>
                <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => openEditPay(i)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', padding: 2 }}
                    >
                      <EditSvg />
                    </button>
                    <button
                      type="button"
                      onClick={() => deletePay(i)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2 }}
                    >
                      <TrashSvg />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {/* Total Row */}
            <tr style={{ background: '#eaf3fd', fontWeight: 700 }}>
              <td colSpan={4} style={{ padding: '10px 14px', textAlign: 'center', color: '#1d4ed8' }}>
                Total
              </td>
              <td style={{ padding: '10px 14px', textAlign: 'center', color: '#1d4ed8' }}>{fmt(depIgst)}</td>
              <td style={{ padding: '10px 14px', textAlign: 'center', color: '#1d4ed8' }}>{fmt(depCgst)}</td>
              <td style={{ padding: '10px 14px', textAlign: 'center', color: '#1d4ed8' }}>{fmt(depSgst)}</td>
              <td style={{ padding: '10px 14px', textAlign: 'center', color: '#1d4ed8' }}>{fmt(depTotal)}</td>
              <td colSpan={2}></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 3. Cash Ledger Utilisation */}
      <div style={{ background: '#fff', border: '1px solid #bfdbfe', borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid #bfdbfe', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#1e3a8a' }}>3. Cash Ledger Utilisation (Current Period)</span>
          <button
            type="button"
            onClick={openAddUtil}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 16px',
              background: '#fff',
              border: '1.5px solid #1d4ed8',
              borderRadius: 6,
              fontSize: 12.5,
              fontWeight: 600,
              color: '#1d4ed8',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add Utilisation Entry
          </button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#eaf3fd', borderBottom: '1.5px solid #bfdbfe' }}>
              {['Sr. No.', 'Utilised For', 'IGST (₹)', 'CGST (₹)', 'SGST/UTGST (₹)', 'Total (₹)', 'Remarks', 'Action'].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '10px 14px',
                    textAlign: ['IGST (₹)', 'CGST (₹)', 'SGST/UTGST (₹)', 'Total (₹)', 'Sr. No.'].includes(h)
                      ? 'center'
                      : h === 'Action'
                      ? 'center'
                      : 'left',
                    fontWeight: 700,
                    color: '#1d4ed8',
                    fontSize: 12.5,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {utils.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>No utilisation recorded for this period.</td></tr>
            )}
            {utils.map((u, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 14px', textAlign: 'center', color: '#1e293b' }}>{i + 1}</td>
                <td style={{ padding: '10px 14px', color: '#1e293b' }}>{u.utilised_for}</td>
                <td style={{ padding: '10px 14px', textAlign: 'center', color: '#1e293b' }}>{fmt(u.igst)}</td>
                <td style={{ padding: '10px 14px', textAlign: 'center', color: '#1e293b' }}>{fmt(u.cgst)}</td>
                <td style={{ padding: '10px 14px', textAlign: 'center', color: '#1e293b' }}>{fmt(u.sgst)}</td>
                <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: '#1e293b' }}>
                  {fmt(sum(u.igst, u.cgst, u.sgst))}
                </td>
                <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 12 }}>{u.remarks || '-'}</td>
                <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => openEditUtil(i)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', padding: 2 }}
                    >
                      <EditSvg />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteUtil(i)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2 }}
                    >
                      <TrashSvg />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {/* Total Row */}
            <tr style={{ background: '#eaf3fd', fontWeight: 700 }}>
              <td colSpan={2} style={{ padding: '10px 14px', textAlign: 'center', color: '#1d4ed8' }}>
                Total
              </td>
              <td style={{ padding: '10px 14px', textAlign: 'center', color: '#1d4ed8' }}>{fmt(utlIgst)}</td>
              <td style={{ padding: '10px 14px', textAlign: 'center', color: '#1d4ed8' }}>{fmt(utlCgst)}</td>
              <td style={{ padding: '10px 14px', textAlign: 'center', color: '#1d4ed8' }}>{fmt(utlSgst)}</td>
              <td style={{ padding: '10px 14px', textAlign: 'center', color: '#1d4ed8' }}>{fmt(utlTotal)}</td>
              <td colSpan={2}></td>
            </tr>
          </tbody>
        </table>
      </div>

      <RemarksButtons
        remarks={remarks}
        setRemarks={setRemarks}
        onSave={() => saveTabData({ cash_ledger: { opening_balance: ob, payments: pays, utilisations: utils }, remarks })}
        reqStatus={reqStatus}
        onInitiate={onInitiate}
      />

      {/* Payment Entry Modal */}
      {payModal && (
        <Modal title={payEditIdx !== null ? 'Edit Payment Entry' : 'Add Payment Entry'} onClose={() => setPayModal(false)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={labelSt}>Date *</label>
              <input type="text" placeholder="DD/MM/YYYY" value={payForm.date} onChange={(e) => setPay('date', e.target.value)} style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Challan No. *</label>
              <input type="text" value={payForm.challan_no} onChange={(e) => setPay('challan_no', e.target.value)} placeholder="e.g. 012345678901" style={inputSt} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={labelSt}>Mode of Payment</label>
              <select value={payForm.mode} onChange={(e) => setPay('mode', e.target.value)} style={inputSt}>
                {['Online (Net Banking)', 'NEFT/RTGS', 'UPI', 'Cash', 'Cheque'].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </div>
            {[
              ['igst', 'IGST (₹)'],
              ['cgst', 'CGST (₹)'],
              ['sgst', 'SGST/UTGST (₹)'],
            ].map(([k, l]) => (
              <div key={k}>
                <label style={labelSt}>{l}</label>
                <input type="number" value={payForm[k]} onChange={(e) => setPay(k, e.target.value)} style={{ ...inputSt, textAlign: 'right' }} />
              </div>
            ))}
            <div>
              <label style={labelSt}>Total (₹)</label>
              <input
                type="text"
                readOnly
                value={fmt(sum(payForm.igst, payForm.cgst, payForm.sgst))}
                style={{ ...inputSt, background: '#f8fafc', color: '#1e3a5f', fontWeight: 700, textAlign: 'right' }}
              />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={labelSt}>Remarks</label>
              <input type="text" value={payForm.remarks} onChange={(e) => setPay('remarks', e.target.value)} placeholder="e.g. Deposit for tax payment" style={inputSt} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setPayModal(false)} style={btnOutline}>Cancel</button>
            <button type="button" onClick={submitPay} style={btnBlue}>Save</button>
          </div>
        </Modal>
      )}

      {/* Utilisation Entry Modal */}
      {utilModal && (
        <Modal title={utilEditIdx !== null ? 'Edit Utilisation Entry' : 'Add Utilisation Entry'} onClose={() => setUtilModal(false)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={labelSt}>Utilised For *</label>
              <input type="text" value={utilForm.utilised_for} onChange={(e) => setUtil('utilised_for', e.target.value)} placeholder="e.g. Tax Payment (GSTR-3B)" style={inputSt} />
            </div>
            {[
              ['igst', 'IGST (₹)'],
              ['cgst', 'CGST (₹)'],
              ['sgst', 'SGST/UTGST (₹)'],
            ].map(([k, l]) => (
              <div key={k}>
                <label style={labelSt}>{l}</label>
                <input type="number" value={utilForm[k]} onChange={(e) => setUtil(k, e.target.value)} style={{ ...inputSt, textAlign: 'right' }} />
              </div>
            ))}
            <div>
              <label style={labelSt}>Total (₹)</label>
              <input
                type="text"
                readOnly
                value={fmt(sum(utilForm.igst, utilForm.cgst, utilForm.sgst))}
                style={{ ...inputSt, background: '#f8fafc', color: '#1e3a5f', fontWeight: 700, textAlign: 'right' }}
              />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={labelSt}>Remarks</label>
              <input type="text" value={utilForm.remarks} onChange={(e) => setUtil('remarks', e.target.value)} placeholder="e.g. Utilised for Aug 2026" style={inputSt} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setUtilModal(false)} style={btnOutline}>Cancel</button>
            <button type="button" onClick={submitUtil} style={btnBlue}>Save</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(2px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 12, width: 500, padding: 24, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#1e3a8a' }}>{title}</div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ─────────────────── SHARED REMARKS & BUTTONS ─────────────────── */
function RemarksButtons({ remarks, setRemarks, onSave, reqStatus, onInitiate }) {
  const { onReject } = useContext(ReqActionsCtx);
  // Any open request (waiting for the client, submitted by the client, or accepted) blocks a new one.
  const hasOpenRequest = REQ_ACTIVE.includes(reqStatus?.status);
  const canReject = !!reqStatus?.awaiting_admin; // only a request the client submitted can be rejected here
  const openLabel = { pending_client: 'Request Pending', submitted: 'Request Submitted', accepted: 'Accepted' }[reqStatus?.status];
  const openMessage = reqStatus?.status === 'pending_client'
    ? 'A GSTR-3B request is already pending with the client.'
    : 'A request for this tax period is already in progress.';

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #bfdbfe',
        borderRadius: 8,
        padding: '16px 20px',
        marginTop: 20,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 15, color: '#1e3a8a', marginBottom: 10 }}>
        Remarks (Internal)
      </div>
      {hasOpenRequest && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '8px 12px', marginBottom: 10, fontSize: 12.5, color: '#92400e' }}>
          {openMessage}
        </div>
      )}
      <textarea
        value={remarks}
        onChange={(e) => setRemarks(e.target.value)}
        placeholder="Add internal remarks here..."
        rows={2}
        style={{
          width: '100%',
          padding: '10px 14px',
          border: '1px solid #bfdbfe',
          borderRadius: 6,
          fontSize: 13,
          color: '#1e293b',
          boxSizing: 'border-box',
          outline: 'none',
          resize: 'vertical',
          marginBottom: 16,
          fontFamily: 'inherit',
          background: '#fff',
        }}
      />
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onSave}
          style={{
            height: 38,
            padding: '0 24px',
            background: '#fff',
            border: '1.5px solid #1d4ed8',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            color: '#1d4ed8',
            cursor: 'pointer',
            transition: 'all .15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#eff6ff')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
        >
          Save Draft
        </button>
        <button
          type="button"
          onClick={onInitiate}
          disabled={hasOpenRequest}
          style={{
            height: 38,
            padding: '0 24px',
            background: hasOpenRequest ? '#94a3b8' : '#1d4ed8',
            border: 'none',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            color: '#fff',
            cursor: hasOpenRequest ? 'not-allowed' : 'pointer',
            transition: 'background .15s ease',
          }}
          onMouseEnter={(e) => {
            if (!hasOpenRequest) e.currentTarget.style.background = '#1e40af';
          }}
          onMouseLeave={(e) => {
            if (!hasOpenRequest) e.currentTarget.style.background = '#1d4ed8';
          }}
        >
          {hasOpenRequest ? openLabel : 'Initiate Request'}
        </button>
        <button
          type="button"
          onClick={onReject ?? undefined}
          disabled={!canReject}
          title={canReject ? 'Reject the request submitted by the client' : 'Reject is available only for a request submitted by the client'}
          style={{
            height: 38,
            padding: '0 24px',
            background: '#fff',
            border: `1.5px solid ${canReject ? '#ef4444' : '#cbd5e1'}`,
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            color: canReject ? '#ef4444' : '#94a3b8',
            cursor: canReject ? 'pointer' : 'not-allowed',
            transition: 'all .15s ease',
          }}
          onMouseEnter={(e) => { if (canReject) e.currentTarget.style.background = '#fef2f2'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
        >
          Reject
        </button>
      </div>
    </div>
  );
}

/* ─────────────────── SHARED STYLES & SVGS ─────────────────── */
const labelSt = { fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 };
const inputSt = { width: '100%', padding: '9px 12px', border: '1.5px solid #bfdbfe', borderRadius: 8, fontSize: 13, color: '#1e293b', boxSizing: 'border-box', outline: 'none' };
const btnBlue = { padding: '8px 24px', background: '#1d4ed8', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer' };
const btnOutline = { padding: '8px 20px', background: '#fff', border: '1.5px solid #cbd5e1', borderRadius: 6, fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer' };

const EditSvg = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);
const DoneSvg = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const TrashSvg = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14H6L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4h6v2" />
  </svg>
);

const DocIcon = ({ c = '#2563eb' }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <line x1="10" y1="9" x2="8" y2="9" />
  </svg>
);
const CoinsIcon = ({ c = '#9333ea' }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    <path d="M21 8.5c0 1.66-4 3-9 3s-9-1.34-9-3" />
  </svg>
);
const BoxIcon = ({ c = '#10b981' }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);
const CalcIcon = ({ c = '#ef4444' }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="2" />
    <line x1="8" y1="6" x2="16" y2="6" />
    <line x1="8" y1="10" x2="16" y2="10" />
    <line x1="8" y1="14" x2="12" y2="14" />
    <line x1="8" y1="18" x2="12" y2="18" />
  </svg>
);
const BarIcon = ({ c = '#0284c7' }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);
const RefreshIcon = ({ c = '#f59e0b' }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);
const CheckCircleIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);
const XCircleIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);
const PercentCircleIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="8" y1="16" x2="16" y2="8" />
    <circle cx="9" cy="9" r="1.5" fill="#2563eb" />
    <circle cx="15" cy="15" r="1.5" fill="#2563eb" />
  </svg>
);
const CalendarCheckIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <line x1="8" y1="14" x2="16" y2="14" />
    <line x1="8" y1="18" x2="13" y2="18" />
  </svg>
);
const MoneyBagIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 13.5A7.5 7.5 0 0 1 11.5 21 7.5 7.5 0 0 1 4 13.5C4 9.5 7 5 11.5 3c4.5 2 7.5 6.5 7.5 10.5z" />
    <line x1="11.5" y1="9" x2="11.5" y2="16" />
    <path d="M9.5 11h4a1.5 1.5 0 0 1 0 3h-4" />
  </svg>
);
const WalletIcon = ({ c = '#2563eb' }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
    <line x1="16" y1="14" x2="18" y2="14" />
    <path d="M4 7V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2" />
  </svg>
);
const ClockIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);
