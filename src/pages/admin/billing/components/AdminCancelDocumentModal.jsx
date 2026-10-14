import { useState, useEffect } from 'react';
import { api } from '../../../../api/client';

/**
 * Cancel / Warning Icon for modal header.
 */
function CancelIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  );
}

/**
 * AdminCancelDocumentModal
 * Prompts for an optional cancellation reason (max 200 chars with counter)
 * and marks the document as Cancelled.
 */
export default function AdminCancelDocumentModal({
  isOpen,
  onClose,
  onSuccess,
  clientId,
  docTypeKey,
  docId,
  docNumber,
  docLabel = 'Document',
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await api(`/admin/billing/client-directory/${clientId}/documents/${docTypeKey}/${docId}/cancel`, {
        method: 'POST',
        body: {
          reason: reason.trim() || undefined,
        },
      });
      if (onSuccess) onSuccess(res);
      onClose();
    } catch (err) {
      const msg = err.data?.errors?.reason?.[0] || err.message || 'Failed to cancel document.';
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
        aria-label="Cancel Document"
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

        <div className="bp-modal-icon" style={{ background: '#fef2f2', color: '#ef4444' }}>
          <CancelIcon />
        </div>

        <p className="bp-modal-title" style={{ fontSize: 18, fontWeight: 750, color: '#0f172a', margin: '0 0 6px' }}>
          Cancel {docLabel} {docNumber ? `• ${docNumber}` : ''}?
        </p>
        <p className="bp-modal-text" style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
          This will permanently mark this {docLabel.toLowerCase()} as <strong>Cancelled</strong>. The record and audit trail remain preserved.
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
              marginBottom: 14,
              textAlign: 'left',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ fontSize: 12.5, fontWeight: 650, color: '#334155' }}>
              Cancellation Reason (Optional)
            </label>
            <span style={{ fontSize: 11.5, color: reason.length > 200 ? '#ef4444' : '#94a3b8' }}>
              {reason.length} / 200
            </span>
          </div>

          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 200))}
            disabled={submitting}
            placeholder="e.g. Order cancelled by buyer, duplicate entry, incorrect amount…"
            rows={3}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              fontSize: 13,
              boxSizing: 'border-box',
              resize: 'vertical',
              marginBottom: 20,
            }}
            autoFocus
          />

          <div className="bp-modal-actions" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
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
              Keep Document
            </button>
            <button
              type="submit"
              className="bp-btn bp-btn-danger"
              disabled={submitting}
              style={{
                padding: '8px 18px',
                borderRadius: 6,
                border: 'none',
                background: '#ef4444',
                color: '#ffffff',
                fontSize: 13,
                fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? 'Cancelling…' : 'Confirm Cancel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
