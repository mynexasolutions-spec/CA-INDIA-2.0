import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api/client';
import ClientSaveSuccessModal from './ClientSaveSuccessModal';

// Switch toggle component matching ClientConfigurationTab styling
function SwitchToggle({ checked, disabled, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => {
        if (!disabled && onChange) onChange(!checked);
      }}
      style={{
        width: 38,
        height: 22,
        borderRadius: 11,
        background: checked ? '#10b981' : '#cbd5e1',
        border: 'none',
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? (checked ? 0.8 : 0.6) : 1,
        padding: 0,
        transition: 'background 0.2s ease',
        flexShrink: 0,
        outline: 'none',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 18 : 2,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#ffffff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          transition: 'left 0.2s ease',
        }}
      />
    </button>
  );
}

// 6 default service items per spec (PDF s20, Mockup p27)
const DEFAULT_SERVICES = [
  {
    service_key: 'client_data_management',
    service_name: 'Client Data Management',
    access: true,
    disabled: true,
    remarks: 'Always enabled for all clients.',
    iconColor: '#1e293b',
  },
  {
    service_key: 'billing',
    service_name: 'Billing',
    access: true,
    disabled: true,
    remarks: 'Enabled with active subscription',
    iconColor: '#ea580c',
  },
  {
    service_key: 'document_change',
    service_name: 'Document Change',
    access: true,
    disabled: true,
    remarks: 'Enabled with active subscription',
    iconColor: '#e11d48',
  },
  {
    service_key: 'requests',
    service_name: 'Requests',
    access: true,
    disabled: true,
    remarks: 'Enabled with active subscription',
    iconColor: '#0284c7',
  },
  {
    service_key: 'gst_compliance',
    service_name: 'GST Compliance',
    access: true,
    disabled: false,
    remarks: 'GST filing and compliance management',
    iconColor: '#3b82f6',
  },
  {
    service_key: 'reports',
    service_name: 'Reports',
    access: true,
    disabled: true,
    remarks: 'Enabled with active subscription',
    iconColor: '#10b981',
  },
];

function ServiceIcon({ serviceKey }) {
  switch (serviceKey) {
    case 'client_data_management':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
    case 'billing':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      );
    case 'document_change':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" y1="18" x2="12" y2="12" />
          <line x1="9" y1="15" x2="15" y2="15" />
        </svg>
      );
    case 'requests':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case 'gst_compliance':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <polyline points="9 12 11 14 15 10" />
        </svg>
      );
    case 'reports':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      );
    default:
      return null;
  }
}

/**
 * STAGE E: Subscription Tab Component (Tab 10)
 * Subscription Details + Usage + Service Access
 */
export default function ClientSubscriptionTab({
  clientId,
  isNewClient = false,
  onDirtyChange,
  discardRef,
}) {
  // Server saved data
  const [savedSub, setSavedSub] = useState({
    status: 'active',
    from_date: '',
    to_date: '',
    total_fees: null,
    amount_paid: null,
    amount_receivable: null,
    outstanding: null,
    documents_count: 0,
    storage_used: null,
    inactive_alert: null,
  });

  const [savedGstCompliance, setSavedGstCompliance] = useState(true);
  const [serviceAccessRows, setServiceAccessRows] = useState(DEFAULT_SERVICES);

  // Form working state
  const [formData, setFormData] = useState({
    status: 'active',
    from_date: '',
    to_date: '',
    total_fees: '',
    amount_paid: '',
    amount_receivable: '',
    outstanding: '',
  });

  const [gstComplianceEnabled, setGstComplianceEnabled] = useState(true);

  // States
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  // Helper to normalize subscription data from API
  const normalizeSubData = (res) => {
    const isInactive = (res?.status || '').toLowerCase() === 'inactive';
    return {
      status: isInactive ? 'inactive' : 'active',
      from_date: res?.from_date || '',
      to_date: res?.to_date || '',
      total_fees: res?.total_fees !== undefined && res?.total_fees !== null ? res.total_fees : null,
      amount_paid: res?.amount_paid !== undefined && res?.amount_paid !== null ? res.amount_paid : null,
      amount_receivable: res?.amount_receivable !== undefined && res?.amount_receivable !== null ? res.amount_receivable : null,
      outstanding: res?.outstanding !== undefined && res?.outstanding !== null ? res.outstanding : null,
      documents_count: res?.usage?.documents_count ?? 0,
      storage_used: res?.usage?.storage_used ?? null,
      inactive_alert: res?.inactive_alert || null,
    };
  };

  const subDataToForm = (sub) => ({
    status: sub.status,
    from_date: sub.from_date || '',
    to_date: sub.to_date || '',
    total_fees: sub.total_fees !== null ? String(sub.total_fees) : '',
    amount_paid: sub.amount_paid !== null ? String(sub.amount_paid) : '',
    amount_receivable: sub.amount_receivable !== null ? String(sub.amount_receivable) : '',
    outstanding: sub.outstanding !== null ? String(sub.outstanding) : '',
  });

  // Fresh load on mount or clientId change
  const fetchData = async () => {
    if (!clientId || isNewClient) return;
    setLoading(true);
    setErrorMsg('');
    try {
      // Parallel fresh fetch for Subscription and Service Access
      const [subRes, serviceRes] = await Promise.all([
        api(`/admin/clients/${clientId}/subscription`),
        api(`/admin/clients/${clientId}/service-access`),
      ]);

      if (subRes) {
        const normSub = normalizeSubData(subRes);
        setSavedSub(normSub);
        setFormData(subDataToForm(normSub));
      }

      if (serviceRes && Array.isArray(serviceRes.services)) {
        setServiceAccessRows(serviceRes.services);
        const gstRow = serviceRes.services.find((s) => s.service_key === 'gst_compliance');
        if (gstRow) {
          const gstVal = Boolean(gstRow.access);
          setSavedGstCompliance(gstVal);
          setGstComplianceEnabled(gstVal);
        }
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load subscription or service access details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [clientId, isNewClient]);

  // Dirty state calculation
  const isDirty = useMemo(() => {
    if (formData.status !== savedSub.status) return true;
    if ((formData.from_date || '') !== (savedSub.from_date || '')) return true;
    if ((formData.to_date || '') !== (savedSub.to_date || '')) return true;

    // Only compare fees and gst if status is active
    if (formData.status === 'active') {
      const savedTotal = savedSub.total_fees !== null ? String(savedSub.total_fees) : '';
      const savedPaid = savedSub.amount_paid !== null ? String(savedSub.amount_paid) : '';
      const savedRec = savedSub.amount_receivable !== null ? String(savedSub.amount_receivable) : '';
      const savedOut = savedSub.outstanding !== null ? String(savedSub.outstanding) : '';

      if (formData.total_fees !== savedTotal) return true;
      if (formData.amount_paid !== savedPaid) return true;
      if (formData.amount_receivable !== savedRec) return true;
      if (formData.outstanding !== savedOut) return true;
      if (gstComplianceEnabled !== savedGstCompliance) return true;
    }

    return false;
  }, [formData, savedSub, gstComplianceEnabled, savedGstCompliance]);

  // Notify parent of dirty state for tab switching guard
  useEffect(() => {
    if (onDirtyChange) {
      onDirtyChange(isEditing && isDirty);
    }
  }, [isEditing, isDirty, onDirtyChange]);

  // Cancel handler: restores saved values with NO confirm popup
  const handleCancel = () => {
    setFormData(subDataToForm(savedSub));
    setGstComplianceEnabled(savedGstCompliance);
    setValidationErrors({});
    setErrorMsg('');
    setIsEditing(false);
  };

  // Expose discard method to parent ref
  useEffect(() => {
    if (discardRef) {
      discardRef.current = () => {
        handleCancel();
      };
    }
  }, [discardRef, savedSub, savedGstCompliance]);

  // Start edit
  const handleStartEdit = () => {
    if (isNewClient) return;
    setIsEditing(true);
    setErrorMsg('');
    setValidationErrors({});
  };

  // UI Validation
  const validate = () => {
    const errs = {};
    if (!formData.status) {
      errs.status = 'Status is required.';
    }
    if (!formData.from_date) {
      errs.from_date = 'From Date is required.';
    }
    if (formData.from_date && formData.to_date) {
      if (formData.to_date < formData.from_date) {
        errs.to_date = 'To Date must be greater than or equal to From Date.';
      }
    }

    if (formData.status === 'active') {
      const feeFields = [
        { key: 'total_fees', label: 'Total Fees' },
        { key: 'amount_paid', label: 'Amount Paid' },
        { key: 'amount_receivable', label: 'Amount Receivable' },
        { key: 'outstanding', label: 'Outstanding' },
      ];

      feeFields.forEach(({ key, label }) => {
        const val = formData[key];
        if (val !== '' && val !== null && val !== undefined) {
          const num = Number(val);
          if (isNaN(num)) {
            errs[key] = `${label} must be a valid number.`;
          } else if (num < 0) {
            errs[key] = `${label} cannot be negative.`;
          }
        }
      });
    }

    return errs;
  };

  // Save handler: strict save order per prompt
  const handleSave = async () => {
    setErrorMsg('');
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setValidationErrors(errs);
      setErrorMsg('Please correct the validation errors below.');
      return;
    }
    setValidationErrors({});
    setSaving(true);

    const isInactive = formData.status === 'inactive';

    // Step 1: Prepare subscription PUT payload
    // Inactive par save: PUT mein fee fields mat bhejo (backend ignores them)
    const subPayload = {
      status: formData.status,
      from_date: formData.from_date,
      to_date: formData.to_date || null,
    };

    if (!isInactive) {
      subPayload.total_fees = formData.total_fees === '' ? null : Number(formData.total_fees);
      subPayload.amount_paid = formData.amount_paid === '' ? null : Number(formData.amount_paid);
      subPayload.amount_receivable = formData.amount_receivable === '' ? null : Number(formData.amount_receivable);
      subPayload.outstanding = formData.outstanding === '' ? null : Number(formData.outstanding);
    }

    try {
      // 1. Send subscription PUT first
      const subRes = await api(`/admin/clients/${clientId}/subscription`, {
        method: 'PUT',
        body: subPayload,
      });

      // Update saved subscription snapshot immediately upon success
      // (ensures that if service-access PUT fails, Cancel will NOT revert to old subscription values)
      const freshSub = normalizeSubData(subRes);
      setSavedSub(freshSub);

      let updatedGst = savedGstCompliance;

      // 2. Phir (agar GST toggle badla ho aur final status Active ho) service-access PUT
      if (!isInactive && gstComplianceEnabled !== savedGstCompliance) {
        try {
          await api(`/admin/clients/${clientId}/service-access`, {
            method: 'PUT',
            body: { gst_compliance_enabled: gstComplianceEnabled },
          });
          updatedGst = gstComplianceEnabled;
        } catch (serviceErr) {
          // If first succeeded but second failed: stay in edit mode, show error
          // Note: savedSub is already updated to freshSub so Cancel keeps the newly saved subscription values
          setErrorMsg(serviceErr.message || 'Subscription updated, but failed to update Service Access.');
          setSaving(false);
          return;
        }
      }

      // Success for all operations: update state, exit edit mode, show single success modal
      setFormData(subDataToForm(freshSub));
      setSavedGstCompliance(updatedGst);
      setGstComplianceEnabled(updatedGst);

      // Refresh service list display
      try {
        const serviceRes = await api(`/admin/clients/${clientId}/service-access`);
        if (serviceRes && Array.isArray(serviceRes.services)) {
          setServiceAccessRows(serviceRes.services);
        }
      } catch {
        // Non-blocking refresh
      }

      setIsEditing(false);
      setShowSaveSuccess(true);
    } catch (err) {
      // Pehla fail ho to doosra mat bhejo, error dikhao, edit mode mein raho
      setErrorMsg(err.message || 'Failed to update subscription details.');
    } finally {
      setSaving(false);
    }
  };

  // Effective status currently displayed (in edit mode or view mode)
  const currentStatus = isEditing ? formData.status : savedSub.status;
  const isCurrentInactive = currentStatus === 'inactive';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* New Client Alert Banner */}
      {isNewClient && (
        <div
          style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            color: '#1e40af',
            padding: '12px 16px',
            borderRadius: 8,
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          <strong>Notice:</strong> Client profile must be saved first before subscription and service access can be configured. Default subscription settings will be assigned automatically upon saving.
        </div>
      )}

      {/* Global API Error Banner */}
      {errorMsg && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            padding: '10px 14px',
            borderRadius: 6,
            fontSize: 12.5,
            lineHeight: 1.5,
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* Main Top Grid: Subscription Details (Left) + Usage (Right) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)',
          gap: 20,
          alignItems: 'start',
        }}
      >
        {/* Card 1: Subscription Details */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '18px 20px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {/* Card Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: '#2563eb',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
            </div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
              Subscription Details
            </h3>
          </div>

          {/* Row 1: Status Dropdown + Inactive Alert Box */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isCurrentInactive ? 'minmax(200px, 1fr) minmax(280px, 1.4fr)' : 'minmax(200px, 1fr)',
              gap: 16,
              alignItems: 'center',
            }}
          >
            {/* Status Field */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                Subscription Status <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                {/* Red dot indicator strictly for Inactive */}
                {currentStatus === 'inactive' && (
                  <span
                    style={{
                      position: 'absolute',
                      left: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: '#ef4444',
                      pointerEvents: 'none',
                      zIndex: 1,
                    }}
                  />
                )}
                <select
                  className="bp-select"
                  disabled={!isEditing || isNewClient}
                  value={isEditing ? formData.status : savedSub.status}
                  onChange={(e) => {
                    const newStatus = e.target.value;
                    setFormData((prev) => ({ ...prev, status: newStatus }));
                    if (validationErrors.status) {
                      setValidationErrors((prev) => ({ ...prev, status: '' }));
                    }
                  }}
                  style={{
                    width: '100%',
                    paddingLeft: currentStatus === 'inactive' ? 28 : 12,
                    fontWeight: 500,
                  }}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              {validationErrors.status && (
                <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{validationErrors.status}</div>
              )}
            </div>

            {/* Inactive Alert Box (only visible when Inactive) */}
            {isCurrentInactive && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fee2e2',
                  borderRadius: 6,
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: '#ef4444',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  !
                </div>
                <div style={{ fontSize: 11.5, color: '#991b1b', lineHeight: 1.4 }}>
                  Subscription is inactive for this client. No paid services are enabled. Client record is maintained for data management purposes only.
                </div>
              </div>
            )}
          </div>

          {/* Row 2: From Date & To Date */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 16,
            }}
          >
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                From Date <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="date"
                className="bp-input"
                disabled={!isEditing || isNewClient}
                value={isEditing ? formData.from_date : (savedSub.from_date || '')}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, from_date: e.target.value }));
                  if (validationErrors.from_date) {
                    setValidationErrors((prev) => ({ ...prev, from_date: '' }));
                  }
                }}
                style={{ width: '100%' }}
              />
              {validationErrors.from_date && (
                <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{validationErrors.from_date}</div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                To Date
              </label>
              <input
                type="date"
                className="bp-input"
                disabled={!isEditing || isNewClient}
                value={isEditing ? formData.to_date : (savedSub.to_date || '')}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, to_date: e.target.value }));
                  if (validationErrors.to_date) {
                    setValidationErrors((prev) => ({ ...prev, to_date: '' }));
                  }
                }}
                style={{ width: '100%' }}
              />
              {validationErrors.to_date && (
                <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{validationErrors.to_date}</div>
              )}
            </div>
          </div>

          {/* Row 3: 4 Fee Fields */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 12,
            }}
          >
            {/* Total Fees */}
            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                Total Fees (₹)
              </label>
              <input
                type="text"
                className="bp-input"
                disabled={!isEditing || isNewClient || isCurrentInactive}
                value={
                  isCurrentInactive
                    ? '0'
                    : isEditing
                    ? formData.total_fees
                    : (savedSub.total_fees !== null ? savedSub.total_fees : '')
                }
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, total_fees: e.target.value }));
                  if (validationErrors.total_fees) {
                    setValidationErrors((prev) => ({ ...prev, total_fees: '' }));
                  }
                }}
                style={{
                  width: '100%',
                  background: isCurrentInactive ? '#f8fafc' : undefined,
                  fontWeight: 500,
                }}
              />
              {validationErrors.total_fees && (
                <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{validationErrors.total_fees}</div>
              )}
            </div>

            {/* Amount Paid */}
            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                Amount Paid (₹)
              </label>
              <input
                type="text"
                className="bp-input"
                disabled={!isEditing || isNewClient || isCurrentInactive}
                value={
                  isCurrentInactive
                    ? '0'
                    : isEditing
                    ? formData.amount_paid
                    : (savedSub.amount_paid !== null ? savedSub.amount_paid : '')
                }
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, amount_paid: e.target.value }));
                  if (validationErrors.amount_paid) {
                    setValidationErrors((prev) => ({ ...prev, amount_paid: '' }));
                  }
                }}
                style={{
                  width: '100%',
                  background: isCurrentInactive ? '#f8fafc' : undefined,
                  fontWeight: 500,
                }}
              />
              {validationErrors.amount_paid && (
                <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{validationErrors.amount_paid}</div>
              )}
            </div>

            {/* Amount Receivable */}
            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                Amount Receivable (₹)
              </label>
              <input
                type="text"
                className="bp-input"
                disabled={!isEditing || isNewClient || isCurrentInactive}
                value={
                  isCurrentInactive
                    ? '0'
                    : isEditing
                    ? formData.amount_receivable
                    : (savedSub.amount_receivable !== null ? savedSub.amount_receivable : '')
                }
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, amount_receivable: e.target.value }));
                  if (validationErrors.amount_receivable) {
                    setValidationErrors((prev) => ({ ...prev, amount_receivable: '' }));
                  }
                }}
                style={{
                  width: '100%',
                  background: isCurrentInactive ? '#f8fafc' : undefined,
                  fontWeight: 500,
                }}
              />
              {validationErrors.amount_receivable && (
                <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{validationErrors.amount_receivable}</div>
              )}
            </div>

            {/* Outstanding */}
            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                Outstanding (₹)
              </label>
              <input
                type="text"
                className="bp-input"
                disabled={!isEditing || isNewClient || isCurrentInactive}
                value={
                  isCurrentInactive
                    ? '0'
                    : isEditing
                    ? formData.outstanding
                    : (savedSub.outstanding !== null ? savedSub.outstanding : '')
                }
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, outstanding: e.target.value }));
                  if (validationErrors.outstanding) {
                    setValidationErrors((prev) => ({ ...prev, outstanding: '' }));
                  }
                }}
                style={{
                  width: '100%',
                  background: isCurrentInactive ? '#f8fafc' : undefined,
                  fontWeight: 500,
                }}
              />
              {validationErrors.outstanding && (
                <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{validationErrors.outstanding}</div>
              )}
            </div>
          </div>

          {/* Row 4: Inactive Info Note Banner (only visible when Inactive) */}
          {isCurrentInactive && (
            <div
              style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: 6,
                padding: '9px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: '#2563eb',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                i
              </div>
              <div style={{ fontSize: 12, color: '#1e40af', lineHeight: 1.45 }}>
                Since the subscription is inactive, all financial fields are set to zero. Client data is retained in the system for future reference.
              </div>
            </div>
          )}
        </div>

        {/* Card 2: Usage Panel */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '18px 20px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {/* Usage Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ color: '#2563eb', display: 'flex', alignItems: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
              Usage
            </h3>
          </div>

          {/* Usage List items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Documents count */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #f1f5f9',
                borderRadius: 8,
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    background: '#1e3a8a',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                </div>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: '#334155' }}>
                  Documents
                </span>
              </div>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
                {savedSub.documents_count ?? 0}
              </span>
            </div>

            {/* Storage Used */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #f1f5f9',
                borderRadius: 8,
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    background: '#2563eb',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <ellipse cx="12" cy="5" rx="9" ry="3" />
                    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                  </svg>
                </div>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: '#334155' }}>
                  Storage Used
                </span>
              </div>
              <span style={{ fontSize: 15, fontWeight: 600, color: savedSub.storage_used ? '#1e293b' : '#64748b' }}>
                {savedSub.storage_used || '-'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Bottom Section: Service Access Card */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: '18px 20px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* Header */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ color: '#2563eb', display: 'flex', alignItems: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
              Service Access
            </h3>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#64748b' }}>
            Enable or disable the services available for this client.
          </p>
        </div>

        {/* Table of 6 Services */}
        <div style={{ overflowX: 'auto', border: '1px solid #f1f5f9', borderRadius: 6 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600, color: '#475569', width: '35%' }}>
                  Service
                </th>
                <th style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600, color: '#475569', width: '15%', textAlign: 'center' }}>
                  Access
                </th>
                <th style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600, color: '#475569', width: '50%' }}>
                  Remarks
                </th>
              </tr>
            </thead>
            <tbody>
              {DEFAULT_SERVICES.map((defService) => {
                const sKey = defService.service_key;

                // Match with API returned service if available
                const apiService = serviceAccessRows.find((s) => s.service_key === sKey);

                let isChecked = false;
                let isDisabled = true;
                let remarks = defService.remarks;

                if (sKey === 'client_data_management') {
                  // Always ON + disabled
                  isChecked = true;
                  isDisabled = true;
                  remarks = 'Always enabled for all clients.';
                } else if (isCurrentInactive) {
                  // Inactive par baaki 5 OFF + disabled + "Not Applicable (Subscription Inactive)"
                  isChecked = false;
                  isDisabled = true;
                  remarks = 'Not Applicable (Subscription Inactive)';
                } else {
                  // Active subscription
                  if (sKey === 'gst_compliance') {
                    // Only GST Compliance toggle editable in edit mode
                    isChecked = isEditing ? gstComplianceEnabled : savedGstCompliance;
                    isDisabled = !isEditing || isNewClient;
                    remarks = apiService?.remarks || 'GST filing and compliance management';
                  } else {
                    // Other services (Billing, Document Change, Requests, Reports) remain display-only
                    isChecked = apiService ? Boolean(apiService.access) : true;
                    isDisabled = true;
                    remarks = apiService?.remarks || 'Enabled with active subscription';
                  }
                }

                return (
                  <tr
                    key={sKey}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    {/* Service Column */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 6,
                            background: defService.iconColor,
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <ServiceIcon serviceKey={sKey} />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#1e293b' }}>
                          {defService.service_name}
                        </span>
                      </div>
                    </td>

                    {/* Access Toggle Column */}
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <SwitchToggle
                          checked={isChecked}
                          disabled={isDisabled}
                          onChange={(newChecked) => {
                            if (sKey === 'gst_compliance' && isEditing && !isCurrentInactive) {
                              setGstComplianceEnabled(newChecked);
                            }
                          }}
                        />
                      </div>
                    </td>

                    {/* Remarks Column */}
                    <td style={{ padding: '12px 14px', fontSize: 12.5, color: '#64748b' }}>
                      {remarks}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 12,
          paddingTop: 8,
          borderTop: '1px solid #e2e8f0',
        }}
      >
        {!isEditing ? (
          <button
            type="button"
            className="bp-btn bp-btn-primary"
            disabled={isNewClient || loading}
            onClick={handleStartEdit}
            style={{
              padding: '8px 24px',
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 6,
              cursor: isNewClient || loading ? 'not-allowed' : 'pointer',
              opacity: isNewClient || loading ? 0.6 : 1,
            }}
          >
            Edit
          </button>
        ) : (
          <>
            <button
              type="button"
              className="bp-btn bp-btn-outline"
              disabled={saving}
              onClick={handleCancel}
              style={{
                padding: '8px 20px',
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 6,
                color: '#334155',
                borderColor: '#cbd5e1',
                background: '#ffffff',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="bp-btn bp-btn-primary"
              disabled={saving}
              onClick={handleSave}
              style={{
                padding: '8px 22px',
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 6,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.75 : 1,
              }}
            >
              {saving ? 'Saving Changes…' : 'Save Changes'}
            </button>
          </>
        )}
      </div>

      {/* Save Success Modal (Module 2A pattern) */}
      {showSaveSuccess && (
        <ClientSaveSuccessModal
          isOpen={showSaveSuccess}
          onClose={() => setShowSaveSuccess(false)}
        />
      )}
    </div>
  );
}
