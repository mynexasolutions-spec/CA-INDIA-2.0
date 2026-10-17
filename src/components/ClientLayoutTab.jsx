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

// Strict 4 layout templates from spec
const LAYOUT_TEMPLATES = [
  {
    id: 1,
    name: 'Layout 1',
    title: 'Modern Professional',
    subtitle: '(Top Header Style)',
  },
  {
    id: 2,
    name: 'Layout 2',
    title: 'Classic Corporate',
    subtitle: '(Clean & Simple)',
  },
  {
    id: 3,
    name: 'Layout 3',
    title: 'Structured & Detailed',
    subtitle: '(Table Focused)',
  },
  {
    id: 4,
    name: 'Layout 4',
    title: 'Modern Boxed',
    subtitle: '(Panel Style)',
  },
];

// Strict 6 colour schemes from spec (NO Forest Green, NO Burgundy)
const COLOUR_SCHEMES = [
  { id: 'slate_blue', name: 'Slate Blue', line1: 'Slate', line2: 'Blue', hex: '#2563eb' },
  { id: 'charcoal_grey', name: 'Charcoal Grey', line1: 'Charcoal', line2: 'Grey', hex: '#334155' },
  { id: 'dusty_plum', name: 'Dusty Plum', line1: 'Dusty', line2: 'Plum', hex: '#703058' },
  { id: 'mocha_brown', name: 'Mocha Brown', line1: 'Mocha', line2: 'Brown', hex: '#6c4a38' },
  { id: 'deep_teal', name: 'Deep Teal', line1: 'Deep', line2: 'Teal', hex: '#0f766e' },
  { id: 'antique_gold', name: 'Antique Gold', line1: 'Antique', line2: 'Gold', hex: '#c59b27' },
];

const LAYOUT_IMAGES = {
  1: layout1Img,
  2: layout2Img,
  3: layout3Img,
  4: layout4Img,
};

/**
 * Format date strictly as "10 Sep 2025". Returns "-" if null/empty.
 */
function formatDateDisplay(dateStr) {
  if (!dateStr) return '-';
  try {
    if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      const parts = dateStr.substring(0, 10).split('-');
      const year = parseInt(parts[0], 10);
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${String(day).padStart(2, '0')} ${months[monthIdx]} ${year}`;
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return '-';
  }
}

/**
 * Confirmation popup when saving a changed layout/colour.
 */
function ConfirmResetModal({ onCancel, onConfirm, isSaving }) {
  return (
    <div className="bp-modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="bp-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Confirm Layout Reset"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(420px, 92vw)', textAlign: 'center' }}
      >
        <button type="button" className="bp-modal-close" onClick={onCancel} aria-label="Close">
          ×
        </button>

        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: '#fef3c7',
            color: '#d97706',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>

        <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>
          Reset Document Layouts?
        </h3>

        <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.5, margin: '0 0 24px' }}>
          This will reset the layout and colour of all document types
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            type="button"
            className="bp-btn bp-btn-outline"
            onClick={onCancel}
            disabled={isSaving}
            style={{ minWidth: 100 }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="bp-btn bp-btn-primary"
            onClick={onConfirm}
            disabled={isSaving}
            style={{ minWidth: 110 }}
          >
            {isSaving ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Full-size preview modal.
 */
function FullSizePreviewModal({ clientId, layoutId, colourScheme, onClose }) {
  const imgSrc = LAYOUT_IMAGES[layoutId] || LAYOUT_IMAGES[1];
  const layout = LAYOUT_TEMPLATES.find((l) => l.id === layoutId);

  return (
    <div className="bp-modal-backdrop" role="presentation" onClick={onClose} style={{ zIndex: 99999 }}>
      <div
        className="bp-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Full Size Preview"
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
              {layout ? `${layout.name} - ${layout.title} ${layout.subtitle}` : 'Layout Preview'}
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
              previewUrl={layoutPreviewUrl(clientId, { layoutId, colourScheme })}
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
 * STAGE B: Layout Tab Component (Tab 7)
 */
export default function ClientLayoutTab({
  clientId,
  isNewClient = false,
  onDirtyChange,
  discardRef,
}) {
  // Saved server state
  const [savedData, setSavedData] = useState({
    layout_id: 1,
    colour_scheme: 'slate_blue',
    applied_from: null,
    updated_at: null,
  });

  // Current working state (in edit mode or viewed)
  const [selectedLayoutId, setSelectedLayoutId] = useState(1);
  const [selectedColourScheme, setSelectedColourScheme] = useState('slate_blue');

  // Modes and loaders
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Modals
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [showFullPreview, setShowFullPreview] = useState(false);

  // Dirty detection
  const isDirty = useMemo(() => {
    return (
      selectedLayoutId !== savedData.layout_id ||
      selectedColourScheme !== savedData.colour_scheme
    );
  }, [selectedLayoutId, selectedColourScheme, savedData]);

  // Report dirty state to parent for tab switching guard
  useEffect(() => {
    if (onDirtyChange) {
      onDirtyChange(isEditing && isDirty);
    }
  }, [isEditing, isDirty, onDirtyChange]);

  // Expose discard method to parent ref
  useEffect(() => {
    if (discardRef) {
      discardRef.current = () => {
        setSelectedLayoutId(savedData.layout_id);
        setSelectedColourScheme(savedData.colour_scheme);
        setIsEditing(false);
        setErrorMsg('');
      };
    }
  }, [discardRef, savedData]);

  // Fetch client layout on mount
  useEffect(() => {
    if (!clientId || isNewClient) return;

    let mounted = true;
    const fetchLayout = async () => {
      setLoading(true);
      setErrorMsg('');
      try {
        const res = await api(`/admin/clients/${clientId}/layout`);
        if (mounted && res) {
          const lId = Number(res.layout_id ?? res.default_layout_id) || 1;
          const cScheme = res.colour_scheme || res.default_colour_scheme || 'slate_blue';
          const appliedFrom = res.applied_from || res.layout_applied_from || null;
          const updatedAt = res.updated_at || res.layout_updated_at || null;
          setSavedData({
            layout_id: lId,
            colour_scheme: cScheme,
            applied_from: appliedFrom,
            updated_at: updatedAt,
          });
          setSelectedLayoutId(lId);
          setSelectedColourScheme(cScheme);
        }
      } catch (err) {
        if (mounted) {
          setErrorMsg(err.message || 'Failed to load client layout settings.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchLayout();
    return () => {
      mounted = false;
    };
  }, [clientId, isNewClient]);

  // User initiates edit mode
  const handleStartEdit = () => {
    if (isNewClient) return;
    setIsEditing(true);
    setErrorMsg('');
  };

  // User clicks Cancel
  const handleCancel = () => {
    if (isDirty) {
      setShowDiscardModal(true);
    } else {
      setIsEditing(false);
      setErrorMsg('');
    }
  };

  // Confirm discard of unsaved changes
  const handleConfirmDiscard = () => {
    setSelectedLayoutId(savedData.layout_id);
    setSelectedColourScheme(savedData.colour_scheme);
    setIsEditing(false);
    setShowDiscardModal(false);
    setErrorMsg('');
  };

  // User clicks Save Changes
  const handleSaveClick = () => {
    setErrorMsg('');
    if (!isDirty) {
      // "Selection nahi badla to bina popup edit mode se bahar."
      setIsEditing(false);
      return;
    }
    // "Save par, agar selection badla ho, confirm popup:
    // 'This will reset the layout and colour of all document types' + Cancel / Confirm."
    setShowConfirmReset(true);
  };

  // Execute PUT request after confirmation
  const handleConfirmSave = async () => {
    setSaving(true);
    setErrorMsg('');
    try {
      const payload = {
        layout_id: selectedLayoutId,
        colour_scheme: selectedColourScheme,
      };
      const res = await api(`/admin/clients/${clientId}/layout`, {
        method: 'PUT',
        body: payload,
      });

      const updatedLayoutId = Number(res.layout_id ?? res.default_layout_id) || selectedLayoutId;
      const updatedColour = res.colour_scheme || res.default_colour_scheme || selectedColourScheme;
      const updatedAppliedFrom = res.applied_from || res.layout_applied_from || null;
      const updatedUpdatedAt = res.updated_at || res.layout_updated_at || null;

      setSavedData({
        layout_id: updatedLayoutId,
        colour_scheme: updatedColour,
        applied_from: updatedAppliedFrom,
        updated_at: updatedUpdatedAt,
      });
      setSelectedLayoutId(updatedLayoutId);
      setSelectedColourScheme(updatedColour);

      setShowConfirmReset(false);
      setShowSaveSuccess(true);
      setIsEditing(false);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update layout settings.');
      // "API error par error message dikhao aur edit mode mein raho."
      setShowConfirmReset(false);
    } finally {
      setSaving(false);
    }
  };

  // Find colour metadata for display
  const savedColourObj = useMemo(() => {
    return COLOUR_SCHEMES.find((c) => c.id === savedData.colour_scheme) || COLOUR_SCHEMES[0];
  }, [savedData.colour_scheme]);

  if (loading) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>Loading client layout settings…</div>
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
          <strong>Notice:</strong> Client profile must be saved first before custom layout changes can be applied. Default Layout 1 (Modern Professional) and Slate Blue will be assigned automatically upon saving.
        </div>
      )}

      {/* 1. Header Card (Mockup p25) */}
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
              <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
              <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
              <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
              <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
              <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
            </svg>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1e3a8a' }}>
              Layout
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#64748b' }}>
              Choose and manage invoice layouts, colour schemes and branding for this client.
            </p>
          </div>
        </div>

        <div
          style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: 6,
            padding: '8px 14px',
            maxWidth: 460,
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
            Select a layout and colour that will be used for all invoices and documents generated for this client.
          </span>
        </div>
      </div>

      {/* 2. Main Two-Column Layout (Left: Selection Cards, Right: Preview) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.6fr) minmax(280px, 1fr)',
          gap: 20,
          alignItems: 'start',
        }}
      >
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Card A: Select Layout Template */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '16px 18px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 4,
                  background: '#eff6ff',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="9" y1="21" x2="9" y2="9" />
                </svg>
              </div>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
                Select Layout Template
              </h4>
            </div>

            {/* 4 Cards Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 10,
              }}
            >
              {LAYOUT_TEMPLATES.map((tpl) => {
                const isSelected = selectedLayoutId === tpl.id;
                const canSelect = isEditing && !isNewClient;

                return (
                  <div
                    key={tpl.id}
                    onClick={() => {
                      if (canSelect) {
                        setSelectedLayoutId(tpl.id);
                      }
                    }}
                    style={{
                      border: `1.5px solid ${isSelected ? '#2563eb' : '#e2e8f0'}`,
                      background: isSelected ? '#f8faff' : '#ffffff',
                      borderRadius: 6,
                      padding: '8px 6px',
                      cursor: canSelect ? 'pointer' : 'default',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 0 0 2px rgba(37,99,235,0.1)' : 'none',
                    }}
                  >
                    {/* Thumbnail */}
                    <div
                      style={{
                        width: '100%',
                        height: 115,
                        background: '#f8fafc',
                        border: '1px solid #f1f5f9',
                        borderRadius: 4,
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 10,
                      }}
                    >
                      <LayoutPreview
                        src={LAYOUT_IMAGES[tpl.id]}
                        alt={tpl.name}
                        style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                      />
                    </div>

                    {/* Radio & Labels */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 2 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <input
                          type="radio"
                          name="layout_template"
                          checked={isSelected}
                          disabled={!canSelect}
                          onChange={() => {
                            if (canSelect) setSelectedLayoutId(tpl.id);
                          }}
                          style={{ margin: 0, accentColor: '#2563eb', cursor: canSelect ? 'pointer' : 'default' }}
                        />
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>
                          {tpl.name}
                        </span>
                      </div>
                      <span style={{ fontSize: 10.5, fontWeight: 500, color: '#334155', lineHeight: 1.25 }}>
                        {tpl.title}
                      </span>
                      <span style={{ fontSize: 10, color: '#64748b', lineHeight: 1.2 }}>
                        {tpl.subtitle}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Row: Select Colour Scheme + Current Selection */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.55fr) minmax(0, 1fr)',
              gap: 14,
            }}
          >
            {/* Box 1: Select Colour Scheme */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '14px 12px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                overflow: 'hidden',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 4,
                    background: '#eff6ff',
                    color: '#2563eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="4" />
                  </svg>
                </div>
                <h4 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: '#1e293b' }}>
                  Select Colour Scheme
                </h4>
              </div>

              {/* 6 Swatches in a strictly separated grid */}
              <div
                className="cp-swatches"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(6, 1fr)',
                  gap: 4,
                  width: '100%',
                }}
              >
                {COLOUR_SCHEMES.map((scheme) => {
                  const isSelected = selectedColourScheme === scheme.id;
                  const canSelect = isEditing && !isNewClient;

                  return (
                    <div
                      key={scheme.id}
                      onClick={() => {
                        if (canSelect) {
                          setSelectedColourScheme(scheme.id);
                        }
                      }}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 5,
                        cursor: canSelect ? 'pointer' : 'default',
                        padding: '5px 2px',
                        borderRadius: 6,
                        border: isSelected ? '1.5px solid #2563eb' : '1.5px solid transparent',
                        background: isSelected ? '#eff6ff' : 'transparent',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          background: scheme.hex,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                          flexShrink: 0,
                        }}
                      >
                        {isSelected && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: isSelected ? 700 : 500,
                          color: isSelected ? '#1e40af' : '#475569',
                          textAlign: 'center',
                          lineHeight: 1.15,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                        }}
                      >
                        <span>{scheme.line1}</span>
                        <span>{scheme.line2}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Box 2: Current Selection */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '14px 14px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 4,
                      background: '#eff6ff',
                      color: '#2563eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                  </div>
                  <h4 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: '#1e293b' }}>
                    Current Selection
                  </h4>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginTop: 6,
                    flexWrap: 'wrap',
                  }}
                >
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: savedColourObj.hex,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>
                    Layout {savedData.layout_id} | {savedColourObj.name}
                  </span>
                  <span
                    style={{
                      background: '#dcfce7',
                      color: '#15803d',
                      padding: '2px 7px',
                      borderRadius: 12,
                      fontSize: 10.5,
                      fontWeight: 600,
                    }}
                  >
                    Active
                  </span>
                </div>
              </div>

              <div
                style={{
                  fontSize: 10.5,
                  color: '#64748b',
                  lineHeight: 1.45,
                  marginTop: 10,
                  paddingTop: 8,
                  borderTop: '1px solid #f1f5f9',
                }}
              >
                <div>
                  Applied From : <strong>{formatDateDisplay(savedData.applied_from)}</strong>
                </div>
                <div>
                  Last Updated : <strong>{formatDateDisplay(savedData.updated_at)}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Preview Panel */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
            overflow: 'hidden',
          }}
        >
          {/* Preview Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderBottom: '1px solid #f1f5f9',
              background: '#f8fafc',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <h4 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: '#1e293b' }}>
                Preview
              </h4>
            </div>

            <button
              type="button"
              onClick={() => setShowFullPreview(true)}
              style={{
                background: 'none',
                border: 'none',
                color: '#2563eb',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 6px',
                borderRadius: 4,
              }}
            >
              <span>View Full Size</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </button>
          </div>

          {/* Preview Image Frame */}
          <div
            style={{
              padding: 14,
              background: '#f8fafc',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: 380,
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 6,
                overflow: 'hidden',
                boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <LayoutPreview
                previewUrl={layoutPreviewUrl(isNewClient ? null : clientId, {
                  layoutId: selectedLayoutId,
                  colourScheme: selectedColourScheme,
                })}
                src={LAYOUT_IMAGES[selectedLayoutId] || LAYOUT_IMAGES[1]}
                alt={`Layout ${selectedLayoutId} Preview`}
              />

            </div>
          </div>
        </div>
      </div>

      {/* 3. Bottom Bar: Info Note + Action Buttons (Mockup p25) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          paddingTop: 16,
          borderTop: '1px solid #e2e8f0',
        }}
      >
        {/* Left: Info note */}
        <div
          style={{
            flex: '1 1 500px',
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: 6,
            padding: '10px 14px',
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
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: '#2563eb',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            i
          </div>
          <span>
            The selected layout and colour will be applied to all invoices, bills of supply, credit notes, debit notes and other billing documents for this client. You can change the layout or colour at any time.
          </span>
        </div>

        {/* Right: Buttons (View: Edit | Edit: Cancel + Save Changes) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
                onClick={handleSaveClick}
                style={{
                  padding: '8px 22px',
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: 6,
                }}
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Confirmation Reset Modal */}
      {showConfirmReset && (
        <ConfirmResetModal
          onCancel={() => setShowConfirmReset(false)}
          onConfirm={handleConfirmSave}
          isSaving={saving}
        />
      )}

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
      {showFullPreview && (
        <FullSizePreviewModal
          clientId={isNewClient ? null : clientId}
          layoutId={selectedLayoutId}
          colourScheme={selectedColourScheme}
          onClose={() => setShowFullPreview(false)}
        />
      )}
    </div>
  );
}
