import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { LoadingBlock } from '../../components/Spinner';
import CancelDocumentModal from './CancelDocumentModal';
import { MarkAsPaidModal, UnmarkAsPaidModal } from './PaymentModals';
import { billingDocEditPath, billingDocPath, docTypeLabel, formatDMY, formatDMYTime, reasonForTransportLabel } from './billingUtils';

function money(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

/** Always exactly 2 decimal places, however many were entered/stored (5 -> 5.00, 5.567 -> 5.57). */
function fmtQty(v) {
  return Number(v || 0).toFixed(2);
}

/* ── Toolbar button icons ─────────────────────────────────────── */
const ICON = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.3, strokeLinecap: 'round', strokeLinejoin: 'round' };
function ArrowLeftIcon() { return <svg {...ICON}><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>; }
function PencilIcon() { return <svg {...ICON}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>; }
function CopyIcon() { return <svg {...ICON}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>; }
function CheckIcon() { return <svg {...ICON}><polyline points="20 6 9 17 4 12" /></svg>; }
function UndoIcon() { return <svg {...ICON}><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>; }
function DownloadIcon() { return <svg {...ICON}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>; }
function MailIcon() { return <svg {...ICON}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 6-10 7L2 6" /></svg>; }
function XCircleIcon() { return <svg {...ICON}><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>; }
function TrashIcon() { return <svg {...ICON}><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>; }
function RefreshCwIcon() { return <svg {...ICON}><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>; }
function DocEditIcon() { return <svg {...ICON}><path d="M12.5 22H18a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v9.5" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M13.378 15.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z" /></svg>; }
function WhatsAppIcon() { return <svg {...ICON} width={17} height={17} fill="currentColor" stroke="none" viewBox="0 0 24 24"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2Zm5.8 14.03c-.24.68-1.4 1.3-1.93 1.38-.5.08-1.11.11-1.79-.11-.41-.13-.94-.31-1.62-.61-2.85-1.23-4.71-4.1-4.85-4.29-.14-.19-1.16-1.54-1.16-2.94 0-1.4.73-2.08.99-2.37.26-.29.57-.36.76-.36.19 0 .38 0 .55.01.18.01.41-.07.64.49.24.58.81 2 .88 2.15.07.15.12.32.02.51-.1.19-.15.31-.29.48-.15.17-.31.38-.44.51-.15.15-.3.31-.13.61.17.29.75 1.24 1.62 2.01 1.11.99 2.05 1.3 2.34 1.44.29.15.46.13.63-.05.17-.19.72-.84.92-1.13.19-.29.38-.24.64-.14.26.1 1.66.78 1.95.92.29.14.48.21.55.33.07.12.07.68-.17 1.36Z" /></svg>; }

export default function InvoiceDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const profile = user?.client_profile;
  const isComposition = profile?.dealer_type === 'composition';
  const [doc, setDoc] = useState(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  // Separate from `err` above (which, when set, replaces the whole page with a
  // load-failure view) — actionErr is for a failed action (Download/Email/etc.) on an
  // already-loaded document, shown inline without losing the page.
  const [actionErr, setActionErr] = useState('');
  const [busyAction, setBusyAction] = useState(''); // '' | 'download' | 'email' | 'whatsapp' | ...
  const [cancelling, setCancelling] = useState(false);
  // Payment pop-ups shared with Reports -> Outstanding: { type: 'paid' } | { type: 'unpaid', log }
  const [payModal, setPayModal] = useState(null);
  // Caches the in-flight/resolved PDF File Promise for the current doc, keyed by doc id.
  // The Web Share API only accepts a share() call while the browser still considers the
  // click a live "user gesture" — regenerating + fetching the PDF (a full server round
  // trip) inside the click handler can eat that window on a slow connection, making the
  // share sheet randomly fail to open. Kicking the fetch off on pointerdown (fires before
  // click) and reusing that same promise in onClick keeps the gap between gesture and
  // share() as small as possible, and a retry after a failure is then instant.
  const pdfFileCache = useRef({});
  const [cancelBusy, setCancelBusy] = useState(false);

  const load = () => {
    setErr('');
    return api(`/billing/documents/${id}`)
      .then(setDoc)
      .catch((e) => setErr(e.message || 'Failed to load'));
  };
  useEffect(() => { setDoc(null); load(); }, [id]);

  if (err) {
    return (
      <div className="bp-card">
        <p style={{ color: '#b91c1c' }}>{err}</p>
        <Link className="bp-btn bp-btn-outline" to="/portal/billing">Back</Link>
      </div>
    );
  }
  if (!doc) return <LoadingBlock />;

  const listBack = {
    tax_invoice: '/portal/billing/invoices',
    debit_note: '/portal/billing/debit-notes',
    credit_note: '/portal/billing/credit-notes',
    bill_of_supply: '/portal/billing/bill-of-supply',
    quotation: '/portal/billing/quotation',
    delivery_challan: '/portal/billing/delivery-challan',
    amendment: '/portal/amendments',
  }[doc.type] || '/portal/billing';
  const editPath = billingDocEditPath(doc.type, doc.id);
  // Edit Request spec: an issued document is directly editable, no admin approval needed,
  // as long as its month isn't locked (GST Filing Confirmation submitted, or the GST
  // Return actually filed). doc.edit_allowed is the separate one-time admin-approved
  // exception for an otherwise-locked month.
  const isIssuedFamily = ['issued', 'partial', 'paid'].includes(doc.status);
  const canEdit = doc.status === 'draft' || (isIssuedFamily && (!doc.direct_edit_locked || doc.edit_allowed));
  const cancellable = doc.status !== 'cancelled' && doc.status !== 'draft' && !(doc.type === 'quotation' && doc.converted_document_id);

  const confirmCancel = async (reason) => {
    setCancelBusy(true);
    try {
      await api(`/billing/documents/${doc.id}/cancel`, { method: 'POST', body: { reason } });
      setCancelling(false);
      setMsg('Document cancelled.');
      load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setCancelBusy(false);
    }
  };

  // Kicks off (or reuses) the PDF fetch for the current doc; safe to call more than once
  // (pointerdown warm-up + click) since the promise is cached per doc id.
  const preparePdfFile = () => {
    if (!pdfFileCache.current[doc.id]) {
      pdfFileCache.current[doc.id] = (async () => {
        const r = await api(`/billing/documents/${doc.id}/pdf`);
        const pdfUrl = r.url.startsWith('http') ? r.url : `${window.location.origin}${r.url}`;
        const res = await fetch(pdfUrl);
        const blob = await res.blob();
        return new File([blob], `${doc.number}.pdf`, { type: 'application/pdf' });
      })().catch((e) => {
        delete pdfFileCache.current[doc.id]; // let the next attempt retry cleanly
        throw e;
      });
    }
    return pdfFileCache.current[doc.id];
  };

  return (
    <div className="bp-card">
      <div className="bp-toolbar">
        <div>
          <h2 style={{ margin: 0 }}>{docTypeLabel(doc.type)} · <span style={{ color: 'var(--bp-blue)' }}>{doc.number}</span></h2>
          <div style={{ fontSize: 13, color: 'var(--bp-muted)' }}>
            {formatDMY(doc.document_date)}
            {doc.due_date ? ` · Due ${formatDMY(doc.due_date)}` : ''}
            {doc.currency && doc.currency !== 'INR' ? ` · ${doc.currency}` : ''}
            {' · '}
            {['tax_invoice', 'bill_of_supply', 'debit_note'].includes(doc.type) || doc.status === 'cancelled' || doc.status === 'draft' ? (
              <span className={`bp-badge ${doc.status === 'paid' ? 'bp-badge-paid' : doc.status === 'partial' ? 'bp-badge-partial' : doc.status === 'draft' ? 'bp-badge-draft' : doc.status === 'cancelled' ? 'bp-badge-cancelled' : 'bp-badge-unpaid'}`}>
                {doc.status === 'paid' ? 'Paid' : doc.status === 'partial' ? 'Partial' : doc.status === 'draft' ? 'Draft' : doc.status === 'cancelled' ? 'Cancelled' : 'Unpaid'}
              </span>
            ) : (
              <span className={`bp-badge ${doc.converted_document_id ? 'bp-badge-partial' : 'bp-badge-paid'}`}>
                {doc.converted_document_id ? 'Converted' : 'Active'}
              </span>
            )}
            {doc.edit_allowed ? <span className="bp-badge bp-badge-paid" style={{ marginLeft: 6 }}>Edit Allowed</span> : null}
          </div>
        </div>
        <div className="bp-actions dv-actions" style={{ marginTop: 0 }}>
          <Link className="bp-btn bp-btn-outline" to={listBack}><ArrowLeftIcon /> Back</Link>
          {canEdit && editPath && (
            <Link className="bp-btn bp-btn-outline" to={editPath}><PencilIcon /> Edit</Link>
          )}
          {doc.status === 'draft' && (
            <button
              type="button"
              className="bp-btn bp-btn-green"
              disabled={busyAction === 'issue'}
              onClick={async () => {
                setBusyAction('issue'); setMsg(''); setActionErr('');
                try {
                  await api(`/billing/documents/${doc.id}/issue`, { method: 'POST', body: {} });
                  setMsg('Generated');
                  load();
                } catch (e) {
                  setActionErr(e.message || 'Failed to generate document.');
                } finally {
                  setBusyAction('');
                }
              }}
            >
              {busyAction === 'issue' ? 'Generating…' : (<><CheckIcon /> Generate / Issue</>)}
            </button>
          )}
          {doc.type === 'quotation' && !doc.converted_document_id && doc.status !== 'cancelled' && (
            <button
              type="button"
              className="bp-btn bp-btn-primary"
              disabled={busyAction === 'convert'}
              onClick={async () => {
                setBusyAction('convert'); setMsg(''); setActionErr('');
                try {
                  const inv = await api(`/billing/documents/${doc.id}/convert`, { method: 'POST', body: { target_type: isComposition ? 'bill_of_supply' : 'tax_invoice' } });
                  setMsg(`Converted to ${inv.number}`);
                  const dest = isComposition
                    ? `/portal/billing/bill-of-supply/${inv.id}`
                    : `/portal/billing/invoices/${inv.id}`;
                  window.location.href = dest;
                } catch (e) {
                  setActionErr(e.message || 'Failed to convert document.');
                  setBusyAction('');
                }
              }}
            >
              {busyAction === 'convert' ? 'Converting…' : (
                <><RefreshCwIcon /> {isComposition ? 'Convert to Bill of Supply' : 'Convert to Tax Invoice'}</>
              )}
            </button>
          )}
          <button
            type="button"
            className="bp-btn bp-btn-outline"
            disabled={busyAction === 'duplicate'}
            onClick={async () => {
              setBusyAction('duplicate'); setMsg(''); setActionErr('');
              try {
                const copy = await api(`/billing/documents/${doc.id}/duplicate`, { method: 'POST', body: {} });
                setMsg(`Duplicated as ${copy.number}`);
                window.location.href = billingDocEditPath(copy.type, copy.id) || billingDocPath(copy.type, copy.id);
              } catch (e) {
                setActionErr(e.message || 'Failed to duplicate document.');
                setBusyAction('');
              }
            }}
          >
            {busyAction === 'duplicate' ? 'Duplicating…' : (<><CopyIcon /> Duplicate</>)}
          </button>
          {doc.type === 'quotation' && !doc.converted_document_id && (
            <button
              type="button"
              className="bp-btn bp-btn-danger"
              disabled={busyAction === 'delete'}
              onClick={async () => {
                if (!window.confirm('Delete this quotation?')) return;
                setBusyAction('delete'); setMsg(''); setActionErr('');
                try {
                  await api(`/billing/documents/${doc.id}`, { method: 'DELETE' });
                  window.location.href = '/portal/billing/quotations';
                } catch (e) {
                  setActionErr(e.message || 'Failed to delete quotation.');
                  setBusyAction('');
                }
              }}
            >
              {busyAction === 'delete' ? 'Deleting…' : (<><TrashIcon /> Delete</>)}
            </button>
          )}
          {isIssuedFamily && ['tax_invoice', 'credit_note', 'debit_note'].includes(doc.type) && !canEdit && (
            doc.gst_return_filed ? (
              <span
                className="bp-btn bp-btn-amber"
                style={{ opacity: 0.45, cursor: 'not-allowed' }}
                title="Request Edit is disabled — the GST Return for this period has already been filed. Use Credit Note, Debit Note, or Amendment instead."
              >
                <PencilIcon /> Request Edit
              </span>
            ) : (
              <Link className="bp-btn bp-btn-amber" to="/portal/edit-requests"><PencilIcon /> Request Edit</Link>
            )
          )}
          {['issued', 'partial', 'paid'].includes(doc.status) && ['tax_invoice', 'credit_note', 'debit_note'].includes(doc.type) && (
            <Link className="bp-btn bp-btn-outline" to={`/portal/amendments/new?ref=${doc.id}`}><DocEditIcon /> Create Amendment</Link>
          )}
          {['issued', 'partial', 'paid'].includes(doc.status) && ['tax_invoice', 'bill_of_supply', 'debit_note'].includes(doc.type) && (
            doc.status === 'paid' ? (
              <button
                type="button"
                className="bp-btn bp-btn-danger"
                disabled={busyAction === 'markUnpaid'}
                onClick={async () => {
                  // Same workflow as Reports -> Outstanding: a reason is required before the status changes.
                  setBusyAction('markUnpaid'); setMsg(''); setActionErr('');
                  let log = null;
                  try {
                    log = (await api(`/billing/documents/${doc.id}/payment-log`)).latest || null;
                  } catch (_) { /* the reason pop-up still works without the recorded payment */ }
                  setPayModal({ type: 'unpaid', log });
                  setBusyAction('');
                }}
              >
                {busyAction === 'markUnpaid' ? 'Opening…' : (<><UndoIcon /> Mark Unpaid</>)}
              </button>
            ) : (
              <button
                type="button"
                className="bp-btn bp-btn-green"
                onClick={() => {
                  // Same payment-details pop-up as Reports -> Outstanding; the status changes only once it is submitted.
                  setMsg(''); setActionErr('');
                  setPayModal({ type: 'paid' });
                }}
              >
                <CheckIcon /> Mark Paid
              </button>
            )
          )}
          <button
            type="button"
            className="bp-btn bp-btn-primary"
            disabled={busyAction === 'download'}
            onClick={async () => {
              setBusyAction('download'); setMsg(''); setActionErr('');
              try {
                const r = await api(`/billing/documents/${doc.id}/pdf`);
                window.open(r.url, '_blank');
                setMsg('PDF opened in a new tab.');
              } catch (e) {
                setActionErr(e.message || 'Failed to download PDF.');
              } finally {
                setBusyAction('');
              }
            }}
          >
            {busyAction === 'download' ? 'Downloading…' : (<><DownloadIcon /> Download PDF</>)}
          </button>
          <button
            type="button"
            className="bp-btn bp-btn-amber"
            disabled={busyAction === 'email'}
            title="Open your mail app with the PDF attached"
            onPointerDown={preparePdfFile}
            onClick={async () => {
              setBusyAction('email'); setMsg(''); setActionErr('');
              try {
                // Web Share API (Level 2, files) — lets the OS share sheet hand the real
                // PDF to whichever mail app the user picks (Gmail/Outlook/etc.), with the
                // file genuinely attached in that app's own compose window. A mailto: link
                // can never carry an attachment, so that's not an option here.
                if (navigator.canShare) {
                  const file = await preparePdfFile();
                  if (navigator.canShare({ files: [file] })) {
                    try {
                      await navigator.share({ files: [file], title: `${docTypeLabel(doc.type)} ${doc.number}` });
                      setMsg('Shared the PDF file.');
                      return;
                    } catch (shareErr) {
                      if (shareErr?.name === 'AbortError') return; // user cancelled the share sheet
                      // Any other failure (e.g. gesture window closed): the file is now
                      // cached, so tapping again immediately will retry near-instantly.
                      setActionErr("Couldn't open the share sheet — tap Email again to retry.");
                      return;
                    }
                  }
                }
                // Desktop / unsupported browsers — no share sheet available, so fall back
                // to sending the email directly from the server (PDF attached there too).
                const er = await api(`/billing/documents/${doc.id}/email`, { method: 'POST', body: {} });
                setMsg(er.message || 'Email sent successfully.');
              } catch (e) {
                setActionErr(e.message || 'Failed to email document.');
              } finally {
                setBusyAction('');
              }
            }}
          >
            {busyAction === 'email' ? 'Sending…' : (<><MailIcon /> Email</>)}
          </button>
          {cancellable && (
            <button type="button" className="bp-btn bp-btn-danger" onClick={() => setCancelling(true)}>
              <XCircleIcon /> Cancel
            </button>
          )}
          {doc.share_token && (
            <button
              type="button"
              className="bp-btn bp-btn-green"
              disabled={busyAction === 'whatsapp'}
              title="Share the PDF file via WhatsApp"
              onPointerDown={preparePdfFile}
              onClick={async () => {
                setBusyAction('whatsapp'); setMsg(''); setActionErr('');
                try {
                  // Web Share API (Level 2, files) — the only way a browser can hand an
                  // actual PDF file to WhatsApp from a website; wa.me links only support
                  // pre-filled text, never a file attachment. Supported on most mobile
                  // browsers, not on desktop — fall back to the link there.
                  if (navigator.canShare) {
                    const file = await preparePdfFile();
                    if (navigator.canShare({ files: [file] })) {
                      try {
                        await navigator.share({ files: [file], title: `${docTypeLabel(doc.type)} ${doc.number}` });
                        setMsg('Shared the PDF file.');
                        return;
                      } catch (shareErr) {
                        if (shareErr?.name === 'AbortError') return; // user cancelled the share sheet
                        // Any other failure (e.g. gesture window closed): the file is now
                        // cached, so tapping again immediately will retry near-instantly.
                        setActionErr("Couldn't open the share sheet — tap WhatsApp again to retry.");
                        return;
                      }
                    }
                  }
                  // Desktop / unsupported browsers — no share sheet available, fall back to a link.
                  const shareLink = `${window.location.origin}/api/billing/share/${doc.share_token}`;
                  const waText = `${docTypeLabel(doc.type)} ${doc.number}: ${shareLink}`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(waText)}`, '_blank', 'noreferrer');
                  setMsg("Opened WhatsApp with the document link — this browser can't attach the PDF file directly.");
                } catch (e) {
                  setActionErr(e.message || 'Failed to share document.');
                } finally {
                  setBusyAction('');
                }
              }}
            >
              {busyAction === 'whatsapp' ? 'Sharing…' : (<><WhatsAppIcon /> WhatsApp</>)}
            </button>
          )}
        </div>
      </div>

      {doc.status === 'cancelled' && (
        <div className="bp-info-note amber" style={{ marginTop: 14 }}>
          <div>
            <strong>This document is Cancelled{doc.cancelled_at ? ` — ${formatDMYTime(doc.cancelled_at)}` : ''}</strong>
            {doc.cancellation_reason ? `Reason: ${doc.cancellation_reason}` : 'No reason recorded.'}
            <br />
            It remains available to view and download, and was never deleted.
          </div>
        </div>
      )}

      {/* Seller + Document Information side by side, Buyer full width below. */}
      <div className="dv-top">
        <section className="dv-card">
          <h3 className="dv-card-title"><span className="dv-dot dv-dot-blue" />From (Seller)</h3>
          <p className="dv-name">{doc.client_profile?.business_name || '—'}</p>
          <p className="dv-line">
            GSTIN: {doc.client_profile?.gstin || '—'} · PAN: {doc.client_profile?.pan || '—'}
          </p>
          <p className="dv-line">{doc.client_profile?.address || ''}</p>
          {(doc.client_profile?.email || doc.client_profile?.mobile) && (
            <p className="dv-line">
              {doc.client_profile?.email ? `Email: ${doc.client_profile.email}` : ''}
              {doc.client_profile?.email && doc.client_profile?.mobile ? ' | ' : ''}
              {doc.client_profile?.mobile ? `Mob: ${doc.client_profile.mobile}` : ''}
            </p>
          )}
        </section>

        <section className="dv-card dv-info">
          <dl>
            <div><dt>{docTypeLabel(doc.type)} No.</dt><dd>{doc.number}</dd></div>
            <div><dt>{docTypeLabel(doc.type)} Date</dt><dd>{formatDMY(doc.document_date)}</dd></div>
            <div><dt>Creation Date</dt><dd>{formatDMYTime(doc.created_at)}</dd></div>
            {['tax_invoice', 'bill_of_supply', 'debit_note', 'credit_note'].includes(doc.type) && (
              <div>
                <dt>GST Filed On</dt>
                <dd className={doc.gst_return_filed ? 'dv-ok' : 'dv-bad'}>{doc.gst_return_filed ? 'Filed' : 'Not Filed'}</dd>
              </div>
            )}
          </dl>
        </section>
      </div>

      <section className="dv-card dv-buyer">
        <h3 className="dv-card-title"><span className="dv-dot dv-dot-green" />To (Buyer)</h3>
        <p className="dv-name">{doc.customer?.name || '—'}</p>
        <p className="dv-line">
          <strong>GSTIN:</strong> {doc.customer?.gstin_display || doc.customer?.gstin || 'Unregistered'} | <strong>State:</strong> {doc.customer?.state || doc.customer?.state_code || '—'}
        </p>
        {(doc.customer?.email || doc.customer?.phone) && (
          <p className="dv-line">
            {doc.customer?.email || ''}{doc.customer?.email && doc.customer?.phone ? ' | ' : ''}{doc.customer?.phone || ''}
          </p>
        )}
        {doc.customer?.billing_address && <p className="dv-line"><strong>Address:</strong> {doc.customer.billing_address}</p>}
        <p className="dv-line">
          <strong>Place of Supply:</strong> {doc.place_of_supply || '—'} | {doc.is_inter_state ? 'Inter-state (IGST)' : 'Intra-state (CGST/SGST)'}
        </p>
      </section>

      {doc.reference_document && (
        <p style={{ marginTop: 12 }}>
          Linked original invoice:{' '}
          <Link to={billingDocPath(doc.reference_document.type, doc.reference_document.id)}>
            <strong>{doc.reference_document.number}</strong>
          </Link>
        </p>
      )}

      {doc.type === 'delivery_challan' && (
        <div className="bp-split" style={{ marginTop: 14 }}>
          <div>
            <h3 style={{ marginTop: 0 }}>Transportation Details</h3>
            <p style={{ margin: '4px 0', fontSize: 13 }}>
              <strong>Reason for Transportation:</strong>{' '}
              {doc.reason_for_transportation === 'other'
                ? (doc.reason_for_transportation_other || '—')
                : reasonForTransportLabel(doc.reason_for_transportation)}
            </p>
            <p style={{ margin: '4px 0', fontSize: 13 }}><strong>Vehicle No.:</strong> {doc.vehicle_no || '—'}</p>
            <p style={{ margin: '4px 0', fontSize: 13 }}><strong>Transporter Name:</strong> {doc.transporter_name || '—'}</p>
          </div>
          <div>
            <p style={{ margin: '4px 0', fontSize: 13 }}><strong>E-Way Bill No.:</strong> {doc.eway_bill_no || '—'}</p>
            <p style={{ margin: '4px 0', fontSize: 13 }}><strong>Receiver Name:</strong> {doc.receiver_name || '—'}</p>
            <p style={{ margin: '4px 0', fontSize: 13 }}>
              <strong>Receiver Signature — Date &amp; Time:</strong> {doc.receiver_signature_datetime ? formatDMYTime(doc.receiver_signature_datetime) : '—'}
            </p>
          </div>
        </div>
      )}

      {(doc.payment_terms || doc.notes) && (
        <div style={{ marginTop: 12, fontSize: 13 }}>
          {doc.payment_terms && <p><strong>Payment terms:</strong> {doc.payment_terms}</p>}
          {doc.notes && <p><strong>Notes:</strong> {doc.notes}</p>}
        </div>
      )}

      {/* Read-only, professional item table — same column set as the Create/Edit form
          (Invoice Item Table spec §3, Disc.% removed), just without the Action column
          and with no inputs/dropdowns of any kind. */}
      <div className="bp-table-wrapper dv-items" style={{ marginTop: 16 }}>
        <table className="bp-table bp-doc-table" style={{ marginTop: 0 }}>
          <thead>
            <tr>
              <th>Sr. No.</th><th>Particulars</th><th>HSN/SAC</th><th>Qty</th><th>UQC</th>
              <th>Rate (₹)</th><th>GST %</th><th>Taxable Value (₹)</th>
            </tr>
          </thead>
          <tbody>
            {(doc.line_items || []).map((l, i) => (
              <tr key={l.id}>
                <td>{i + 1}</td>
                <td>{l.description}</td>
                <td>{l.hsn_sac}</td>
                <td>{fmtQty(l.qty)}</td>
                <td>{l.unit}</td>
                <td>{money(l.rate)}</td>
                <td>{Number(l.gst_rate || 0)}%</td>
                <td className="bp-doc-total">{money(l.taxable_amount)}</td>
              </tr>
            ))}
            {!doc.line_items?.length && <tr><td colSpan={8} className="bp-table-empty">No line items</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="dv-summary">
        <div className="dv-summary-rows">
          {/* Disc.% is removed from item entry (Invoice Item Table spec §3) — new documents
              never carry a discount, so this row only shows for older documents that do. */}
          {Number(doc.discount_total) > 0 && (
            <div className="dv-row"><span>Discount</span><strong>{money(doc.discount_total)}</strong></div>
          )}
          <div className="dv-row"><span>Total Taxable Value</span><strong>{money(doc.taxable_amount)}</strong></div>
          {doc.is_inter_state ? (
            <div className="dv-row"><span>IGST</span><strong>{money(doc.igst_amount)}</strong></div>
          ) : (
            <>
              <div className="dv-row"><span>CGST</span><strong>{money(doc.cgst_amount)}</strong></div>
              <div className="dv-row"><span>SGST/UTGST</span><strong>{money(doc.sgst_amount)}</strong></div>
            </>
          )}
          {doc.tax_deduction_type ? (
            <>
              <div className="dv-row"><span>Total Value (Post GST)</span><strong>{money(doc.total_amount)}</strong></div>
              <div className="dv-row" style={{ color: doc.tax_deduction_type === 'tds' ? 'var(--bp-red)' : 'var(--bp-green)' }}>
                <span>
                  {doc.tax_deduction_type === 'tds' ? 'Less: TDS' : 'Add: TCS'}
                  {doc.tds_tcs_section ? ` (${Number(doc.tds_tcs_rate).toFixed(2)}% u/s ${doc.tds_tcs_section.code})` : ''}
                </span>
                <strong>{money(doc.tds_tcs_amount)}</strong>
              </div>
            </>
          ) : (
            <div className="dv-row"><span>Round Off</span><strong>{money(doc.round_off)}</strong></div>
          )}
        </div>
        <div className="dv-grand"><span>Grand Total</span><strong>{money(doc.grand_total || doc.total_amount)}</strong></div>
        {doc.amount_in_words && (
          <div className="dv-words">
            <small>Amount in Words</small>
            <strong>{doc.amount_in_words}</strong>
          </div>
        )}
      </div>
      {msg && <p style={{ color: 'var(--bp-green)' }}>{msg}</p>}
      {actionErr && <p style={{ color: 'var(--bp-red)' }}>{actionErr}</p>}
      {payModal?.type === 'paid' && (
        <MarkAsPaidModal
          doc={doc}
          onClose={() => setPayModal(null)}
          onSuccess={() => { setPayModal(null); setMsg('Marked Paid — removed from Outstanding'); load(); }}
        />
      )}
      {payModal?.type === 'unpaid' && (
        <UnmarkAsPaidModal
          doc={doc}
          log={payModal.log}
          onClose={() => setPayModal(null)}
          onSuccess={() => { setPayModal(null); setMsg('Marked Unpaid — appears in Outstanding'); load(); }}
        />
      )}
      {cancelling && (
        <CancelDocumentModal
          docLabel={`${docTypeLabel(doc.type)} ${doc.number}`}
          busy={cancelBusy}
          onCancel={() => setCancelling(false)}
          onConfirm={confirmCancel}
        />
      )}
    </div>
  );
}
