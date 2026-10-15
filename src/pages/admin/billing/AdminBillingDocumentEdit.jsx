import { useState, useEffect, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAdminFy } from '../../../context/AdminFyContext';
import InvoiceForm from '../../billing/InvoiceForm';
import { getDocTypeConfig, getDocumentActionDisabledReason } from './billingConstants';

export default function AdminBillingDocumentEdit() {
  const { clientId, docType: docTypeParam, id } = useParams();
  const navigate = useNavigate();
  const adminFy = useAdminFy();

  const docConfig = useMemo(() => getDocTypeConfig(docTypeParam), [docTypeParam]);
  const docTypeKey = docConfig?.key || docTypeParam;
  const docTypeSlug = docConfig?.slug || docTypeParam;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [errorBanner, setErrorBanner] = useState('');
  const [docData, setDocData] = useState(null);
  const [initialDocument, setInitialDocument] = useState(null);

  const partiesEndpointBase = `/admin/billing/client-directory/${clientId}/parties`;
  const backPath = `/admin/billing/${clientId}/${docTypeSlug}/${id}`;

  useEffect(() => {
    if (docTypeKey !== 'tax_invoice') {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    async function loadData() {
      try {
        const data = await api(`/admin/billing/client-directory/${clientId}/documents/${docTypeKey}/${id}`);
        if (cancelled) return;

        setDocData(data);

        // Party prefill: fetch ${partiesEndpointBase}/${document.customer_id} and pass it as the selected party.
        // If customer_id is null, there is no prefill and no error.
        let party = null;
        if (data.document?.customer_id) {
          try {
            const p = await api(`${partiesEndpointBase}/${data.document.customer_id}`);
            if (!cancelled && p) party = p;
          } catch {
            party = data.customer || null;
          }
        }

        if (cancelled) return;

        // Memoized, stable initialDocument so applyDoc never overwrites user edits on re-renders
        setInitialDocument({
          ...data,
          customer: party || data.customer,
        });
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load document.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [clientId, docTypeKey, id, partiesEndpointBase]);

  // ClientProfile built from billing_profile: has_gst, dealer_type, state_code (no hardcoding)
  const clientProfile = useMemo(() => {
    if (!docData?.billing_profile) return null;
    return {
      has_gst: Boolean(docData.billing_profile.has_gst),
      dealer_type: docData.billing_profile.dealer_type || 'regular',
      state_code: docData.billing_profile.state_code || '',
    };
  }, [docData?.billing_profile]);

  const handleSave = async (formData) => {
    setErrorBanner('');
    if (!adminFy?.fy) {
      setErrorBanner('Financial Year is required. Please select a Financial Year.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    try {
      const body = {
        ...formData,
        fy: adminFy.fy,
      };
      await api(`/admin/billing/client-directory/${clientId}/documents/${docTypeKey}/${id}`, {
        method: 'PUT',
        body,
      });
      // On success navigate to admin detail screen with cache-buster
      navigate(`${backPath}?t=${Date.now()}`);
    } catch (err) {
      setErrorBanner(err.message || 'Failed to update document.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Only tax_invoice is supported; any other docType shows a "not available yet" message
  if (docTypeKey !== 'tax_invoice') {
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 60 }}>
        <div style={{ fontSize: 13, color: '#2563eb', marginBottom: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Link to="/admin/billing" style={{ color: '#2563eb', textDecoration: 'none' }}>Billing</Link>
          <span style={{ color: '#94a3b8' }}>&gt;</span>
          <Link to={`/admin/billing/${clientId}`} style={{ color: '#2563eb', textDecoration: 'none' }}>Client Dashboard</Link>
          <span style={{ color: '#94a3b8' }}>&gt;</span>
          <Link to={backPath} style={{ color: '#2563eb', textDecoration: 'none' }}>Document Detail</Link>
          <span style={{ color: '#94a3b8' }}>&gt;</span>
          <span style={{ color: '#64748b' }}>Edit</span>
        </div>

        <div className="bp-card" style={{ padding: '24px 28px', background: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0' }}>
          <h2 style={{ marginTop: 0, fontSize: 18, color: '#1e293b' }}>Edit Document</h2>
          <p style={{ color: '#b91c1c', fontSize: 14, margin: '12px 0 20px' }}>
            Editing is not available yet for this document type. Only Tax Invoices can be edited.
          </p>
          <Link
            className="bp-btn bp-btn-outline"
            to={backPath}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              textDecoration: 'none',
              color: '#334155',
              fontWeight: 600,
            }}
          >
            ← Back to Document
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 0', textAlign: 'center' }}>
        <p style={{ color: '#64748b', fontSize: 14 }}>Loading document details…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 60 }}>
        <div className="bp-card" style={{ padding: '24px 28px', background: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0' }}>
          <h2 style={{ marginTop: 0, fontSize: 18, color: '#1e293b' }}>Error Loading Document</h2>
          <p style={{ color: '#b91c1c', fontSize: 14, margin: '12px 0 20px' }}>{error}</p>
          <Link
            className="bp-btn bp-btn-outline"
            to={backPath}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              textDecoration: 'none',
              color: '#334155',
              fontWeight: 600,
            }}
          >
            ← Back to Document
          </Link>
        </div>
      </div>
    );
  }

  // Check flags.can_edit: if false show reason and Back link
  if (docData && !docData?.flags?.can_edit) {
    const reason = getDocumentActionDisabledReason('edit', docData, docTypeKey) || 'This document cannot be edited because it is locked or referenced by another record.';

    return (
      <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 60 }}>
        <div style={{ fontSize: 13, color: '#2563eb', marginBottom: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Link to="/admin/billing" style={{ color: '#2563eb', textDecoration: 'none' }}>Billing</Link>
          <span style={{ color: '#94a3b8' }}>&gt;</span>
          <Link to={`/admin/billing/${clientId}`} style={{ color: '#2563eb', textDecoration: 'none' }}>Client Dashboard</Link>
          <span style={{ color: '#94a3b8' }}>&gt;</span>
          <Link to={backPath} style={{ color: '#2563eb', textDecoration: 'none' }}>Document Detail</Link>
          <span style={{ color: '#94a3b8' }}>&gt;</span>
          <span style={{ color: '#64748b' }}>Edit</span>
        </div>

        <div className="bp-card" style={{ padding: '24px 28px', background: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0' }}>
          <h2 style={{ marginTop: 0, fontSize: 18, color: '#1e293b' }}>Document Cannot Be Edited</h2>
          <p style={{ color: '#b91c1c', fontSize: 14, margin: '12px 0 20px' }}>{reason}</p>
          <Link
            className="bp-btn bp-btn-outline"
            to={backPath}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              textDecoration: 'none',
              color: '#334155',
              fontWeight: 600,
            }}
          >
            ← Back to Document
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 60 }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: 13, color: '#2563eb', marginBottom: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <Link to="/admin/billing" style={{ color: '#2563eb', textDecoration: 'none' }}>Billing</Link>
        <span style={{ color: '#94a3b8' }}>&gt;</span>
        <Link to={`/admin/billing/${clientId}`} style={{ color: '#2563eb', textDecoration: 'none' }}>Client Dashboard</Link>
        <span style={{ color: '#94a3b8' }}>&gt;</span>
        <Link to={`/admin/billing/${clientId}/${docTypeSlug}`} style={{ color: '#2563eb', textDecoration: 'none' }}>{docConfig?.pluralLabel || 'Tax Invoices'}</Link>
        <span style={{ color: '#94a3b8' }}>&gt;</span>
        <Link to={backPath} style={{ color: '#2563eb', textDecoration: 'none' }}>{docData?.document?.number || 'Document'}</Link>
        <span style={{ color: '#94a3b8' }}>&gt;</span>
        <span style={{ color: '#64748b' }}>Edit</span>
      </div>

      {/* Top Error Banner */}
      {errorBanner && (
        <div
          role="alert"
          style={{
            marginBottom: 16,
            padding: '12px 16px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 8,
            color: '#b91c1c',
            fontSize: 14,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          }}
        >
          <span>{errorBanner}</span>
          <button
            type="button"
            onClick={() => setErrorBanner('')}
            style={{
              background: 'none',
              border: 'none',
              color: '#b91c1c',
              cursor: 'pointer',
              fontSize: 16,
              fontWeight: 700,
              padding: '0 4px',
            }}
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {initialDocument && (
        <InvoiceForm
          docType={docTypeKey}
          title="Edit Tax Invoice"
          clientProfile={clientProfile}
          initialDocument={initialDocument}
          readOnlyNumber={docData?.document?.number || ''}
          staffEditMode={true}
          hideNewParty={true}
          partiesEndpointBase={partiesEndpointBase}
          tdsTcsEndpoint="/admin/billing/tds-tcs-sections"
          backPath={backPath}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
