import { useState, useEffect } from 'react';
import { api } from '../../../../api/client';

/**
 * Trash / Delete Icon for modal header.
 */
function TrashIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

/**
 * AdminDeleteDocumentModal
 * Confirms soft deletion of a document with number reuse notice.
 */
export default function AdminDeleteDocumentModal({
  isOpen,
  onClose,
  onSuccess,
  clientId,
  docTypeKey,
  docId,
  docNumber,
  docLabel = 'Document',
  shortLabel,
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const shortTypeMap = {
    tax_invoice: 'Invoice',
    bill_of_supply: 'Bill',
    debit_note: 'Debit Note',
    credit_note: 'Credit Note',
    quotation: 'Quotation',
    delivery_challan: 'Challan',
  };
  const confirmTarget = shortLabel || shortTypeMap[docTypeKey] || docLabel || 'Document';

  useEffect(() => {
    if (isOpen) {
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDelete = async () => {
    setSubmitting(true);
    setError(null);

    try {
      await api(`/admin/billing/client-directory/${clientId}/documents/${docTypeKey}/${docId}`, {
        method: 'DELETE',
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      const msg = err.data?.message || err.message || 'Failed to delete document.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bp-modal-backdrop" role="presentation" onClick={submitting ? undefined : onClose}>
      <div
        className="bp-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Delete Document"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 480 }}
      >
        <button
          type="button"
          className="bp-modal-close"
          onClick={onClose}
          disabled={submitting}
          aria-label="Close"
        >
          ×
        </button>

        <div className="bp-modal-icon" style={{ background: '#fef2f2', color: '#dc2626' }}>
          <TrashIcon />
        </div>

        <p className="bp-modal-title" style={{ fontSize: 18, fontWeight: 750, color: '#0f172a', margin: '0 0 6px' }}>
          Delete {docLabel} {docNumber ? `• ${docNumber}` : ''}?
        </p>

        <p className="bp-modal-text" style={{ fontSize: 13, color: '#64748b', marginBottom: 16, lineHeight: 1.5 }}>
          This will remove the {docLabel.toLowerCase()} from all lists. Its number can be reused.
        </p>

        {error && (
          <div
            style={{
              padding: '9px 12px',
              borderRadius: 6,
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              fontSize: 12.5,
              marginBottom: 16,
              textAlign: 'left',
            }}
          >
            {error}
          </div>
        )}

        <div className="bp-modal-actions" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button
            type="button"
            className="bp-btn bp-btn-outline"
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#475569',
              fontSize: 13,
              fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="bp-btn bp-btn-danger"
            disabled={submitting}
            onClick={handleDelete}
            style={{
              padding: '8px 18px',
              borderRadius: 6,
              border: 'none',
              background: '#dc2626',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'Deleting…' : `Delete ${confirmTarget}`}
          </button>
        </div>
      </div>
    </div>
  );
}
