import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import StateSelect from '../../components/StateSelect';
import { LoadingBlock } from '../../components/Spinner';
import ActionConfirmationModal from '../../components/ActionConfirmationModal';
import DiscardChangesModal from '../../components/DiscardChangesModal';

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const empty = {
  name: '', proprietor_name: '', contact_person: '', email: '', phone: '',
  gst_status: 'registered', gstin: '',
  state: '', state_code: '', billing_address: '', shipping_address: '', branch_name: '',
};

const ICON_PROPS = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
function PeopleIcon() {
  return <svg {...ICON_PROPS} width="20" height="20"><circle cx="9" cy="8" r="3" /><path d="M2.5 19c.6-3.4 3-5.3 6.5-5.3S15 15.6 15.5 19" /><circle cx="17" cy="9" r="2.3" /><path d="M15.3 13.9c2.4.3 3.9 2 4.5 4.6" /></svg>;
}
function SaveIcon() {
  return <svg {...ICON_PROPS}><path d="M5 4h11l3 3v13H5z" /><path d="M8 4v5h8V4M8 14h8v6H8z" /></svg>;
}

function Field({ label, required, help, style, children }) {
  return (
    <label style={style}>
      <strong className="bp-field-title">{label}{required && ' *'}</strong>
      {children}
      {help && <span style={{ display: 'block', fontSize: 11, color: 'var(--bp-muted)', marginTop: 5 }}>{help}</span>}
    </label>
  );
}

/** Add New Company / Edit Company — a routed page (not a modal), so "Cancel" genuinely
 * navigates back to the Parties dashboard rather than just closing an overlay.
 * Parties Module UI Cleanup spec: no surrounding help/navigation panels here — just the
 * breadcrumb, the full-width Company Details form, and the Save/Cancel actions. */
export default function PartyForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);

  const [form, setForm] = useState(empty);
  const [loaded, setLoaded] = useState(!editing);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [gstinError, setGstinError] = useState('');
  const [confirmModal, setConfirmModal] = useState(null);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  // Shipping Address auto-fills from Billing Address until the user types into Shipping
  // Address directly — after that, Billing Address edits no longer overwrite it.
  const [shippingTouched, setShippingTouched] = useState(false);

  useEffect(() => {
    if (!editing) return;
    api(`/billing/parties/${id}`).then((p) => {
      setForm({ ...empty, ...p, gst_status: p.gst_status || (p.gstin ? 'registered' : 'unregistered'), gstin: p.gstin || '' });
      setShippingTouched(Boolean(p.shipping_address) && p.shipping_address !== p.billing_address);
      setLoaded(true);
    }).catch((e) => setErr(e.message));
  }, [id, editing]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onSave = async (e) => {
    e.preventDefault();
    setErr('');
    setGstinError('');
    if (form.gst_status === 'registered') {
      const gstin = (form.gstin || '').trim().toUpperCase();
      if (!gstin) {
        setGstinError('GSTIN is required for a registered party.');
        return;
      }
      if (!GSTIN_REGEX.test(gstin)) {
        setGstinError('Enter a valid 15-character GSTIN (e.g. 27ABCDE1234F1Z5).');
        return;
      }
    }
    setBusy(true);
    try {
      const payload = { ...form, gstin: form.gst_status === 'registered' ? form.gstin.trim().toUpperCase() : '' };
      if (editing) await api(`/billing/parties/${id}`, { method: 'PUT', body: payload });
      else {
        try {
          await api('/billing/parties', { method: 'POST', body: payload });
        } catch (dupErr) {
          if (dupErr.status === 409 && dupErr.data?.duplicate) {
            // eslint-disable-next-line no-alert
            if (!window.confirm(dupErr.message)) { setBusy(false); return; }
            await api('/billing/parties', { method: 'POST', body: { ...payload, confirm_duplicate: true } });
          } else {
            throw dupErr;
          }
        }
      }
      setConfirmModal(editing
        ? { title: 'Company Updated Successfully', message: 'The company details have been updated successfully.' }
        : { title: 'Company Saved Successfully', message: 'The new company has been successfully created and saved.' });
    } catch (ex) {
      setErr(ex.message || 'Could not save this company.');
    } finally {
      setBusy(false);
    }
  };

  const closeConfirmModal = () => {
    setConfirmModal(null);
    navigate('/portal/billing/parties');
  };

  if (!loaded) return <LoadingBlock />;

  return (
    <div className="bp-section-wrap">
      <div style={{ fontSize: 12, color: 'var(--bp-muted)', fontWeight: 600 }}>
        <Link to="/portal" style={{ color: 'var(--bp-blue)', textDecoration: 'none' }}>Client Portal</Link>
        <span style={{ margin: '0 6px', opacity: 0.5 }}>›</span>
        <Link to="/portal/billing/parties" style={{ color: 'var(--bp-blue)', textDecoration: 'none' }}>Parties</Link>
        <span style={{ margin: '0 6px', opacity: 0.5 }}>›</span>
        {editing ? 'Edit Company' : 'Add New Company'}
      </div>

      <div className="bp-section-head">
        <div>
          <div className="bp-section-kicker">{editing ? 'Edit Company' : 'Add New Company'}</div>
          <p className="bp-section-desc">
            {editing ? 'Update this company’s (party’s) GST compliance and billing details.' : 'Add a new company (party) to manage GST compliance and billing.'}
          </p>
        </div>
      </div>

      <form className="bp-card" onSubmit={onSave}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--bp-navy)', display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 14, marginBottom: 18, borderBottom: '1px solid var(--bp-border)' }}>
          <span style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--bp-blue)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><PeopleIcon /></span>
          <span>
            Company Details
            <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--bp-muted)', marginTop: 2 }}>Fields marked with * are required.</span>
          </span>
        </h3>

        {err && <p className="bp-alert bp-alert-error">{err}</p>}

        <div className="bp-form two">
          <Field label="GST Registration Status" required>
            <div className="bp-gst-radio-row">
              <label className="bp-gst-radio">
                <input type="radio" name="gst_status" checked={form.gst_status === 'registered'} onChange={() => { set('gst_status', 'registered'); setGstinError(''); }} />
                Registered
              </label>
              <label className="bp-gst-radio">
                <input type="radio" name="gst_status" checked={form.gst_status === 'unregistered'} onChange={() => { set('gst_status', 'unregistered'); set('gstin', ''); setGstinError(''); }} />
                Unregistered
              </label>
            </div>
          </Field>

          {form.gst_status === 'registered' ? (
            <Field label="GSTIN" required help="Enter 15 digit GST Identification Number">
              <input
                className="bp-input"
                value={form.gstin}
                maxLength={15}
                placeholder="E.g. 27ABCDE1234F1Z5"
                style={{ textTransform: 'uppercase' }}
                onChange={(e) => { set('gstin', e.target.value.toUpperCase()); setGstinError(''); }}
                required
              />
              {gstinError && <span className="bp-gstin-error">{gstinError}</span>}
            </Field>
          ) : <div />}

          <Field label="Company Name" required help="Enter the legal name of the company">
            <input className="bp-input" placeholder="Enter company name" value={form.name} onChange={(e) => set('name', e.target.value)} required />
          </Field>
          <Field label="Proprietor / Authorised Signatory" required help="Enter the name of proprietor or authorised signatory">
            <input className="bp-input" placeholder="Enter proprietor / authorised signatory name" value={form.proprietor_name} onChange={(e) => set('proprietor_name', e.target.value)} required />
          </Field>

          <Field label="Contact Person" help="Contact Detail of Proprietor/Authorised Signatory">
            <input className="bp-input" placeholder="Enter contact person name" value={form.contact_person} onChange={(e) => set('contact_person', e.target.value)} />
          </Field>
          <Field label="Phone" help="Company Official Contact No.">
            <input className="bp-input" placeholder="Enter phone number" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </Field>

          <Field label="Email" help="Company Official Email ID">
            <input className="bp-input" type="email" placeholder="Enter email address" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </Field>
          <Field label="State" required help="Select the state">
            <StateSelect value={form.state_code} onChange={(code, name) => setForm((f) => ({ ...f, state_code: code, state: name }))} required />
          </Field>

          <Field label="Billing Address" required help={`Registered / billing address of the company (${(form.billing_address || '').length}/100)`} style={{ gridColumn: '1 / -1' }}>
            <input
              className="bp-input"
              placeholder="Enter complete billing address"
              value={form.billing_address || ''}
              onChange={(e) => {
                const v = e.target.value;
                setForm((f) => ({ ...f, billing_address: v, shipping_address: shippingTouched ? f.shipping_address : v }));
              }}
              maxLength={100}
              required
            />
          </Field>
          <Field label="Branch (If any)" help="Enter the branch name of the company (if applicable)">
            <input className="bp-input" placeholder="Enter branch name (if any)" value={form.branch_name || ''} onChange={(e) => set('branch_name', e.target.value)} maxLength={100} />
          </Field>
          <Field label="Shipping Address (If any)" help={`Shipping address if different from billing address (${(form.shipping_address || '').length}/100)`}>
            <input
              className="bp-input"
              placeholder="Enter shipping address (if any)"
              value={form.shipping_address || ''}
              onChange={(e) => { setShippingTouched(true); set('shipping_address', e.target.value); }}
              maxLength={100}
            />
          </Field>
        </div>

        <div className="bp-actions" style={{ marginTop: 20 }}>
          <button type="submit" className="bp-btn bp-btn-blue" disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <SaveIcon /> {busy ? 'Saving…' : editing ? 'Save Changes' : 'Save Company'}
          </button>
          <button type="button" className="bp-btn bp-btn-outline" onClick={() => setShowDiscardModal(true)}>Cancel</button>
        </div>
      </form>

      {confirmModal && (
        <ActionConfirmationModal
          title={confirmModal.title}
          message={confirmModal.message}
          onClose={closeConfirmModal}
        />
      )}
      {showDiscardModal && (
        <DiscardChangesModal
          onContinueEditing={() => setShowDiscardModal(false)}
          onConfirmCancel={() => navigate('/portal/billing/parties')}
        />
      )}
    </div>
  );
}
