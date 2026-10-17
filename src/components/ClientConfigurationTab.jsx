import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api/client';
import LayoutPreview from './LayoutPreview';
import { layoutPreviewUrl } from '../api/layoutPreview';
import ClientSaveSuccessModal from './ClientSaveSuccessModal';
import DiscardChangesModal from './DiscardChangesModal';

import layout1Img from '../assets/layout-previews/layout-1.png';
import layout2Img from '../assets/layout-previews/layout-2.png';
import layout3Img from '../assets/layout-previews/layout-3.png';
import layout4Img from '../assets/layout-previews/layout-4.png';

// Strict document types in exact spec order
const DOCUMENT_TYPES = [
  { key: 'tax_invoice', label: 'Tax Invoice' },
  { key: 'bill_of_supply', label: 'Bill of Supply' },
  { key: 'credit_note', label: 'Credit Note' },
  { key: 'debit_note', label: 'Debit Note' },
  { key: 'quotation', label: 'Quotation' },
  { key: 'delivery_challan', label: 'Delivery Challan' },
];

// Layout template options for dropdown
const LAYOUT_OPTIONS = [
  { id: 1, label: 'Layout 1 - Modern Professional' },
  { id: 2, label: 'Layout 2 - Clean & Simple' },
  { id: 3, label: 'Layout 3 - Structured & Detailed' },
  { id: 4, label: 'Layout 4 - Modern Boxed' },
];

// Strict 6 colour schemes (NO Forest Green, NO Burgundy)
const COLOUR_SCHEMES = [
  { id: 'slate_blue', name: 'Slate Blue', hex: '#2563eb' },
  { id: 'charcoal_grey', name: 'Charcoal Grey', hex: '#334155' },
  { id: 'dusty_plum', name: 'Dusty Plum', hex: '#703058' },
  { id: 'mocha_brown', name: 'Mocha Brown', hex: '#6c4a38' },
  { id: 'deep_teal', name: 'Deep Teal', hex: '#0f766e' },
  { id: 'antique_gold', name: 'Antique Gold', hex: '#c59b27' },
];

const LAYOUT_IMAGES = {
  1: layout1Img,
  2: layout2Img,
  3: layout3Img,
  4: layout4Img,
};

/**
 * Full-size preview modal for a document layout.
 */
function ConfigFullPreviewModal({ clientId, layoutId, colourScheme, documentType, watermark, documentTitle, onClose }) {
  const imgSrc = LAYOUT_IMAGES[layoutId] || LAYOUT_IMAGES[1];
  const layout = LAYOUT_OPTIONS.find((l) => l.id === layoutId);

  return (
    <div className="bp-modal-backdrop" role="presentation" onClick={onClose} style={{ zIndex: 99999 }}>
      <div
        className="bp-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Layout Full Size Preview"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(920px, 95vw)',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid #e2e8f0',
            background: '#f8fafc',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
              {documentTitle ? `${documentTitle} - ` : ''}{layout ? layout.label : `Layout ${layoutId}`}
            </h3>
            <span style={{ fontSize: 12, color: '#64748b' }}>Full size document template sample</span>
          </div>
          <button
            type="button"
            className="bp-modal-close"
            onClick={onClose}
            aria-label="Close"
            style={{ position: 'static' }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 20,
            background: '#e2e8f0',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              borderRadius: 4,
              overflow: 'hidden',
              maxWidth: 820,
              width: '100%',
            }}
          >
            <LayoutPreview
              previewUrl={layoutPreviewUrl(clientId, { layoutId, colourScheme, documentType, watermark })}
              src={imgSrc}
              alt="Full Size Layout Preview"
            />
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: '12px 20px',
            borderTop: '1px solid #e2e8f0',
            background: '#f8fafc',
          }}
        >
          <button type="button" className="bp-btn bp-btn-outline" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Toggle Switch Component
 */
function SwitchToggle({ checked, onChange, disabled }) {
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
        background: checked ? '#2563eb' : '#cbd5e1',
        border: 'none',
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
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

/**
 * STAGE C: Configuration Tab Component (Tab 8)
 */
export default function ClientConfigurationTab({
  clientId,
  isNewClient = false,
  onDirtyChange,
  discardRef,
}) {
  // Saved server state
  const [savedConfig, setSavedConfig] = useState({
    invoice_tagline: '',
    watermark_enabled: false,
    watermark_text: '',
    gst_reminder_enabled: false,
    documents: DOCUMENT_TYPES.map((dt) => ({
      document_type: dt.key,
      layout_id: 1,
      colour_scheme: 'slate_blue',
      watermark_applies: false,
    })),
  });

  // Current working state in form
  const [invoiceTagline, setInvoiceTagline] = useState('');
  const [watermarkEnabled, setWatermarkEnabled] = useState(false);
  const [watermarkText, setWatermarkText] = useState('');
  const [gstReminderEnabled, setGstReminderEnabled] = useState(false);
  const [docRows, setDocRows] = useState(
    DOCUMENT_TYPES.map((dt) => ({
      document_type: dt.key,
      layout_id: 1,
      colour_scheme: 'slate_blue',
      watermark_applies: false,
    }))
  );

  // Mode and loaders
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [watermarkError, setWatermarkError] = useState('');

  // Modals
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [previewModalDoc, setPreviewModalDoc] = useState(null); // { layoutId, title }

  // Fresh load on mount or clientId change
  const fetchConfiguration = async () => {
    if (!clientId || isNewClient) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await api(`/admin/clients/${clientId}/configuration`);
      if (res) {
        const tagline = res.invoice_tagline || '';
        const wmEnabled = Boolean(res.watermark_enabled);
        const wmText = res.watermark_text || '';
        const gstReminder = Boolean(res.gst_reminder_enabled);

        // Normalize 6 rows in correct spec order
        const docsMap = {};
        if (Array.isArray(res.documents)) {
          res.documents.forEach((d) => {
            docsMap[d.document_type] = {
              document_type: d.document_type,
              layout_id: Number(d.layout_id) || 1,
              colour_scheme: d.colour_scheme || 'slate_blue',
              watermark_applies: Boolean(d.watermark_applies),
            };
          });
        }

        const normalizedDocs = DOCUMENT_TYPES.map((dt) => {
          return (
            docsMap[dt.key] || {
              document_type: dt.key,
              layout_id: 1,
              colour_scheme: 'slate_blue',
              watermark_applies: false,
            }
          );
        });

        const stateObj = {
          invoice_tagline: tagline,
          watermark_enabled: wmEnabled,
          watermark_text: wmText,
          gst_reminder_enabled: gstReminder,
          documents: normalizedDocs,
        };

        setSavedConfig(stateObj);
        setInvoiceTagline(tagline);
        setWatermarkEnabled(wmEnabled);
        setWatermarkText(wmText);
        setGstReminderEnabled(gstReminder);
        setDocRows(normalizedDocs);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load configuration settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfiguration();
  }, [clientId, isNewClient]);

  // Dirty state detection
  const isDirty = useMemo(() => {
    if (invoiceTagline !== (savedConfig.invoice_tagline || '')) return true;
    if (watermarkEnabled !== savedConfig.watermark_enabled) return true;
    if (watermarkText !== (savedConfig.watermark_text || '')) return true;
    if (gstReminderEnabled !== savedConfig.gst_reminder_enabled) return true;

    if (docRows.length !== savedConfig.documents.length) return true;
    for (let i = 0; i < docRows.length; i++) {
      const cur = docRows[i];
      const saved = savedConfig.documents[i];
      if (!saved) return true;
      if (cur.layout_id !== saved.layout_id) return true;
      if (cur.colour_scheme !== saved.colour_scheme) return true;
      if (cur.watermark_applies !== saved.watermark_applies) return true;
    }
    return false;
  }, [invoiceTagline, watermarkEnabled, watermarkText, gstReminderEnabled, docRows, savedConfig]);

  // Notify parent of dirty status for tab switching guard
  useEffect(() => {
    if (onDirtyChange) {
      onDirtyChange(isEditing && isDirty);
    }
  }, [isEditing, isDirty, onDirtyChange]);

  // Discard handler for parent ref
  useEffect(() => {
    if (discardRef) {
      discardRef.current = () => {
        setInvoiceTagline(savedConfig.invoice_tagline || '');
        setWatermarkEnabled(savedConfig.watermark_enabled);
        setWatermarkText(savedConfig.watermark_text || '');
        setGstReminderEnabled(savedConfig.gst_reminder_enabled);
        setDocRows(JSON.parse(JSON.stringify(savedConfig.documents)));
        setIsEditing(false);
        setErrorMsg('');
        setWatermarkError('');
      };
    }
  }, [discardRef, savedConfig]);

  // Enter edit mode
  const handleStartEdit = () => {
    if (isNewClient) return;
    setIsEditing(true);
    setErrorMsg('');
    setWatermarkError('');
  };

  // Click Cancel
  const handleCancel = () => {
    if (isDirty) {
      setShowDiscardModal(true);
    } else {
      setIsEditing(false);
      setErrorMsg('');
      setWatermarkError('');
    }
  };

  // Confirm discard unsaved changes
  const handleConfirmDiscard = () => {
    setInvoiceTagline(savedConfig.invoice_tagline || '');
    setWatermarkEnabled(savedConfig.watermark_enabled);
    setWatermarkText(savedConfig.watermark_text || '');
    setGstReminderEnabled(savedConfig.gst_reminder_enabled);
    setDocRows(JSON.parse(JSON.stringify(savedConfig.documents)));
    setIsEditing(false);
    setShowDiscardModal(false);
    setErrorMsg('');
    setWatermarkError('');
  };

  // Update a single document row field
  const updateDocRow = (docType, field, value) => {
    setDocRows((prev) =>
      prev.map((r) => (r.document_type === docType ? { ...r, [field]: value } : r))
    );
  };

  // Save changes via PUT
  const handleSave = async () => {
    setErrorMsg('');
    setWatermarkError('');

    // UI-only validation per spec: "Show Watermark ON aur text khali ho to Save par inline error"
    if (watermarkEnabled && !watermarkText.trim()) {
      setWatermarkError('Watermark text is required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        invoice_tagline: invoiceTagline.trim(),
        watermark_enabled: watermarkEnabled,
        watermark_text: watermarkEnabled ? watermarkText.trim() : (watermarkText.trim() || null),
        gst_reminder_enabled: gstReminderEnabled,
        documents: docRows.map((r) => ({
          document_type: r.document_type,
          layout_id: Number(r.layout_id),
          colour_scheme: r.colour_scheme,
          watermark_applies: Boolean(r.watermark_applies),
        })),
      };

      const res = await api(`/admin/clients/${clientId}/configuration`, {
        method: 'PUT',
        body: payload,
      });

      // Update saved configuration state
      const updatedConfig = {
        invoice_tagline: res.invoice_tagline || '',
        watermark_enabled: Boolean(res.watermark_enabled),
        watermark_text: res.watermark_text || '',
        gst_reminder_enabled: Boolean(res.gst_reminder_enabled),
        documents: Array.isArray(res.documents)
          ? res.documents.map((d) => ({
              document_type: d.document_type,
              layout_id: Number(d.layout_id),
              colour_scheme: d.colour_scheme,
              watermark_applies: Boolean(d.watermark_applies),
            }))
          : docRows,
      };

      setSavedConfig(updatedConfig);
      setInvoiceTagline(res.invoice_tagline || '');
      setIsEditing(false);
      setShowSaveSuccess(true);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save configuration settings.');
      // Stay in edit mode on error
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>Loading client configuration settings…</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Error alert banner */}
      {errorMsg && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            padding: '12px 16px',
            borderRadius: 8,
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg('')}
            style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: 16 }}
          >
            ×
          </button>
        </div>
      )}

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
          <strong>Notice:</strong> Client profile must be saved first before custom document configuration can be applied. Default document settings will be assigned automatically upon saving.
        </div>
      )}

      {/* 1. Header Card (Mockup p26) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          padding: '16px 20px',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              flexShrink: 0,
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1e3a8a' }}>
              Configuration
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#64748b' }}>
              Manage client-specific settings and preferences for billing and documents.
            </p>
          </div>
        </div>

        <div
          style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: 6,
            padding: '8px 14px',
            maxWidth: 480,
            fontSize: 12,
            color: '#1e40af',
            lineHeight: 1.45,
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
          <span>
            These settings will be applied only for this client. You can modify the configuration at any time.
          </span>
        </div>
      </div>

      {/* 2. Main Two Columns (Left: Document Layout Settings, Right: Watermark Settings) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 0.85fr)',
          gap: 18,
          alignItems: 'start',
        }}
      >
        {/* Left Column: Document Layout Settings */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '16px 18px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
                <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
                <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
                <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
              </svg>
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: '#1e293b' }}>
                Document Layout Settings
              </h4>
              <p style={{ margin: '2px 0 0', fontSize: 11.5, color: '#64748b' }}>
                Select layout template and colour scheme for each document type.
              </p>
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table className="cp-compact-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Document Type</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Layout Template</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Colour Scheme</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'center' }}>Preview</th>
                </tr>
              </thead>
              <tbody>
                {DOCUMENT_TYPES.map((dt) => {
                  const row = docRows.find((r) => r.document_type === dt.key) || {
                    layout_id: 1,
                    colour_scheme: 'slate_blue',
                  };
                  const currentColour = COLOUR_SCHEMES.find((c) => c.id === row.colour_scheme) || COLOUR_SCHEMES[0];

                  return (
                    <tr key={dt.key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      {/* Document Type */}
                      <td style={{ padding: '8px 10px', fontWeight: 600, color: '#0f172a' }}>
                        {dt.label}
                      </td>

                      {/* Layout Template Dropdown */}
                      <td style={{ padding: '8px 10px' }}>
                        <select
                          className="bp-select"
                          value={row.layout_id}
                          disabled={!isEditing || isNewClient}
                          onChange={(e) => updateDocRow(dt.key, 'layout_id', Number(e.target.value))}
                          style={{
                            height: 32,
                            fontSize: 12,
                            padding: '4px 8px',
                            borderRadius: 6,
                            width: '100%',
                            minWidth: 160,
                          }}
                        >
                          {LAYOUT_OPTIONS.map((lo) => (
                            <option key={lo.id} value={lo.id}>
                              {lo.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Colour Scheme Dropdown (Colour dot + name) */}
                      <td style={{ padding: '8px 10px' }}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <span
                            style={{
                              position: 'absolute',
                              left: 10,
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              background: currentColour.hex,
                              pointerEvents: 'none',
                              zIndex: 1,
                            }}
                          />
                          <select
                            className="bp-select"
                            value={row.colour_scheme}
                            disabled={!isEditing || isNewClient}
                            onChange={(e) => updateDocRow(dt.key, 'colour_scheme', e.target.value)}
                            style={{
                              height: 32,
                              fontSize: 12,
                              padding: '4px 8px 4px 26px',
                              borderRadius: 6,
                              width: '100%',
                              minWidth: 130,
                            }}
                          >
                            {COLOUR_SCHEMES.map((cs) => (
                              <option key={cs.id} value={cs.id}>
                                {cs.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>

                      {/* Preview Thumbnail + Eye Icon */}
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <div
                            style={{
                              width: 26,
                              height: 34,
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: 3,
                              overflow: 'hidden',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <LayoutPreview
                              src={LAYOUT_IMAGES[row.layout_id] || LAYOUT_IMAGES[1]}
                              alt={`${dt.label} Preview`}
                              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            />
                          </div>

                          <button
                            type="button"
                            title={`Preview ${dt.label} Full Size`}
                            onClick={() =>
                              setPreviewModalDoc({
                                layoutId: row.layout_id,
                                colourScheme: row.colour_scheme,
                                documentType: dt.key,
                                watermark: false,
                                title: dt.label,
                              })
                            }
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#2563eb',
                              cursor: 'pointer',
                              padding: 2,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Watermark Settings + Invoice Tagline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Watermark Settings Card */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '16px 18px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
              </svg>
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: '#1e293b' }}>
                Watermark Settings
              </h4>
              <p style={{ margin: '2px 0 0', fontSize: 11.5, color: '#64748b' }}>
                Configure watermark for your billing documents.
              </p>
            </div>
          </div>

          {/* Toggle + Watermark Text Controls */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              padding: '12px 14px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              marginBottom: 16,
            }}
          >
            {/* Show Watermark row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                Show Watermark
              </span>
              <SwitchToggle
                checked={watermarkEnabled}
                disabled={!isEditing || isNewClient}
                onChange={(val) => {
                  setWatermarkEnabled(val);
                  if (watermarkError) setWatermarkError('');
                }}
              />
            </div>

            {/* Watermark Text Input */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#475569', marginBottom: 4 }}>
                Watermark Text
              </div>
              <input
                type="text"
                className="bp-input"
                value={watermarkText}
                disabled={!isEditing || isNewClient || !watermarkEnabled}
                placeholder="www.abkhanassociates.com"
                onChange={(e) => {
                  setWatermarkText(e.target.value);
                  if (watermarkError) setWatermarkError('');
                }}
                style={{
                  height: 34,
                  fontSize: 12.5,
                  padding: '6px 10px',
                  borderRadius: 6,
                  borderColor: watermarkError ? '#dc2626' : undefined,
                  background: !watermarkEnabled ? '#f1f5f9' : '#ffffff',
                }}
              />
              {watermarkError && (
                <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4, fontWeight: 500 }}>
                  {watermarkError}
                </div>
              )}
            </div>
          </div>

          {/* Watermark per-document table */}
          <div style={{ overflowX: 'auto' }}>
            <table className="cp-compact-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Document Type</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'center' }}>Apply Watermark</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'center' }}>Preview</th>
                </tr>
              </thead>
              <tbody>
                {DOCUMENT_TYPES.map((dt) => {
                  const row = docRows.find((r) => r.document_type === dt.key) || {
                    layout_id: 1,
                    watermark_applies: true,
                  };
                  const isRadiosDisabled = !isEditing || isNewClient || !watermarkEnabled;

                  return (
                    <tr key={dt.key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      {/* Document Type */}
                      <td style={{ padding: '8px 10px', fontWeight: 600, color: '#0f172a' }}>
                        {dt.label}
                      </td>

                      {/* Yes / No Radios */}
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
                          <label
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              cursor: isRadiosDisabled ? 'default' : 'pointer',
                              fontSize: 12,
                              color: isRadiosDisabled ? '#94a3b8' : '#1e293b',
                            }}
                          >
                            <input
                              type="radio"
                              name={`wm_${dt.key}`}
                              checked={Boolean(row.watermark_applies)}
                              disabled={isRadiosDisabled}
                              onChange={() => updateDocRow(dt.key, 'watermark_applies', true)}
                              style={{ margin: 0, accentColor: '#2563eb', cursor: isRadiosDisabled ? 'default' : 'pointer' }}
                            />
                            Yes
                          </label>

                          <label
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              cursor: isRadiosDisabled ? 'default' : 'pointer',
                              fontSize: 12,
                              color: isRadiosDisabled ? '#94a3b8' : '#1e293b',
                            }}
                          >
                            <input
                              type="radio"
                              name={`wm_${dt.key}`}
                              checked={!row.watermark_applies}
                              disabled={isRadiosDisabled}
                              onChange={() => updateDocRow(dt.key, 'watermark_applies', false)}
                              style={{ margin: 0, accentColor: '#2563eb', cursor: isRadiosDisabled ? 'default' : 'pointer' }}
                            />
                            No
                          </label>
                        </div>
                      </td>

                      {/* Preview Thumbnail + Eye */}
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <div
                            style={{
                              width: 26,
                              height: 34,
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: 3,
                              overflow: 'hidden',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <LayoutPreview
                              src={LAYOUT_IMAGES[row.layout_id] || LAYOUT_IMAGES[1]}
                              alt={`${dt.label} Preview`}
                              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            />
                          </div>

                          <button
                            type="button"
                            title={`Preview ${dt.label} Full Size`}
                            onClick={() =>
                              setPreviewModalDoc({
                                layoutId: row.layout_id,
                                colourScheme: row.colour_scheme,
                                documentType: dt.key,
                                watermark: Boolean(watermarkEnabled && row.watermark_applies),
                                title: dt.label,
                              })
                            }
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#2563eb',
                              cursor: 'pointer',
                              padding: 2,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

          {/* Invoice Tagline Card (used in Layout 3) */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '16px 18px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label
                htmlFor="config-invoice-tagline"
                style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}
              >
                Invoice Tagline (used in Layout 3)
              </label>
              <span style={{ fontSize: 11, color: '#64748b' }}>
                {invoiceTagline.length}/120
              </span>
            </div>
            <input
              id="config-invoice-tagline"
              type="text"
              className="bp-input"
              value={invoiceTagline}
              onChange={(e) => setInvoiceTagline(e.target.value.slice(0, 120))}
              placeholder="Cooler Tomorrow Together"
              maxLength={120}
              disabled={!isEditing || isNewClient || !docRows.some((r) => Number(r.layout_id) === 3)}
              style={{ width: '100%', fontSize: 13 }}
            />
            <p style={{ margin: '6px 0 0', fontSize: 11.5, color: '#64748b', lineHeight: 1.4 }}>
              Shown in the footer strip of Layout 3 only. Leave empty to hide the strip.
            </p>
          </div>
        </div>
      </div>

      {/* 3. GST Return Reminder Settings (Full Width below columns) */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: '16px 18px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: '#1e293b' }}>
              GST Return Reminder Settings
            </h4>
            <p style={{ margin: '2px 0 0', fontSize: 11.5, color: '#64748b' }}>
              Manage reminders for GST return filing requests.
            </p>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
            padding: '12px 14px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
          }}
        >
          {/* Toggle control */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
              Enable GST Return Reminder
            </span>
            <SwitchToggle
              checked={gstReminderEnabled}
              disabled={!isEditing || isNewClient}
              onChange={(val) => setGstReminderEnabled(val)}
            />
          </div>

          {/* Info callout note */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              color: '#1e40af',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              padding: '6px 12px',
              borderRadius: 6,
            }}
          >
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: '#2563eb',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10.5,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              i
            </div>
            <span>Reminder will continue until the filing request is submitted.</span>
          </div>
        </div>
      </div>

      {/* 4. Bottom Action Bar: Edit | Cancel + Save Changes */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 12,
          paddingTop: 16,
          borderTop: '1px solid #e2e8f0',
        }}
      >
        {!isEditing ? (
          <button
            type="button"
            className="bp-btn bp-btn-primary"
            disabled={isNewClient}
            onClick={handleStartEdit}
            style={{
              padding: '8px 24px',
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 6,
              cursor: isNewClient ? 'not-allowed' : 'pointer',
              opacity: isNewClient ? 0.6 : 1,
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
              }}
            >
              {saving ? 'Saving Changes…' : 'Save Changes'}
            </button>
          </>
        )}
      </div>

      {/* Discard Changes Modal Guard */}
      {showDiscardModal && (
        <DiscardChangesModal
          onContinueEditing={() => setShowDiscardModal(false)}
          onConfirmCancel={handleConfirmDiscard}
        />
      )}

      {/* Save Success Modal (Module 2A pattern) */}
      {showSaveSuccess && (
        <ClientSaveSuccessModal
          isOpen={showSaveSuccess}
          onClose={() => setShowSaveSuccess(false)}
        />
      )}

      {/* Full Size Preview Modal */}
      {previewModalDoc && (
        <ConfigFullPreviewModal
          clientId={isNewClient ? null : clientId}
          layoutId={previewModalDoc.layoutId}
          colourScheme={previewModalDoc.colourScheme}
          documentType={previewModalDoc.documentType}
          watermark={previewModalDoc.watermark}
          documentTitle={previewModalDoc.title}
          onClose={() => setPreviewModalDoc(null)}
        />
      )}
    </div>
  );
}
