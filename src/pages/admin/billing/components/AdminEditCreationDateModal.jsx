import { useState, useEffect } from 'react';
import { api } from '../../../../api/client';

/**
 * Calendar Icon for modal header.
 */
function CalendarIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

/**
 * AdminEditCreationDateModal
 * Allows changing the creation date of a document within the active FY up to today (IST).
 * Backend preserves the existing creation time.
 */
export default function AdminEditCreationDateModal({
  isOpen,
  onClose,
  onSuccess,
  clientId,
  docTypeKey,
  docId,
  currentCreatedAt,
  fy,
  docLabel = 'Document',
}) {
  const [date, setDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Compute minDate from FY start and maxDate (today in IST)
  const startYear = parseInt(String(fy || '').split('-')[0], 10) || 2026;
  const minDate = `${startYear}-04-01`;
  const maxDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (currentCreatedAt) {
        setDate(currentCreatedAt.slice(0, 10));
      } else {
        setDate('');
      }
    }
  }, [isOpen, currentCreatedAt]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!date) {
      setError('Please select a valid creation date.');
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const res = await api(`/admin/billing/client-directory/${clientId}/documents/${docTypeKey}/${docId}/creation-date`, {
        method: 'PATCH',
        body: {
          new_creation_date: date,
          fy,
        },
      });
      if (onSuccess) onSuccess(res);
      onClose();
    } catch (err) {
      const msg = err.data?.errors?.new_creation_date?.[0] || err.message || 'Failed to update creation date.';
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
        aria-label="Edit Creation Date"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 460 }}
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

        <div className="bp-modal-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
          <CalendarIcon />
        </div>

        <p className="bp-modal-title" style={{ fontSize: 18, fontWeight: 750, color: '#0f172a', margin: '0 0 6px' }}>
          Edit Creation Date
        </p>
        <p className="bp-modal-text" style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
          Update the creation date for this {docLabel.toLowerCase()}. The existing timestamp will be preserved.
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
          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 650, color: '#334155', marginBottom: 6 }}>
            New Creation Date <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="date"
            value={date}
            min={minDate}
            max={maxDate}
            onChange={(e) => setDate(e.target.value)}
            disabled={submitting}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              fontSize: 13.5,
              boxSizing: 'border-box',
              marginBottom: 10,
            }}
            required
            autoFocus
          />
          <div style={{ fontSize: 11.5, color: '#94a3b8', marginBottom: 20 }}>
            Allowed range: <strong>{minDate}</strong> to <strong>{maxDate}</strong> (FY {fy || `${startYear}-${String(startYear + 1).slice(-2)}`})
          </div>

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
              Cancel
            </button>
            <button
              type="submit"
              className="bp-btn bp-btn-primary"
              disabled={submitting || !date}
              style={{
                padding: '8px 18px',
                borderRadius: 6,
                border: 'none',
                background: '#2563eb',
                color: '#ffffff',
                fontSize: 13,
                fontWeight: 700,
                cursor: submitting || !date ? 'not-allowed' : 'pointer',
                opacity: submitting || !date ? 0.7 : 1,
              }}
            >
              {submitting ? 'Updating…' : 'Update Date'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
