function CheckIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/**
 * Modal shown after successfully creating a new client (Module 2A - Section A2 / PDF p30).
 * Displays generated Client ID, Client Name, and buttons to Close or Go to Client Details.
 */
export default function ClientCreateSuccessModal({
  isOpen = true,
  clientId,
  clientName,
  onClose,
  onGoToDetails,
}) {
  if (!isOpen) return null;

  return (
    <div className="bp-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="bp-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Client added successfully."
        onClick={(e) => e.stopPropagation()}
        style={{ textAlign: 'center', width: 'min(380px, 94vw)' }}
      >
        <button type="button" className="bp-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div
          className="bp-modal-icon"
          style={{
            margin: '0 auto 16px',
            background: '#22c55e',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CheckIcon />
        </div>

        <h3
          className="bp-modal-title"
          style={{
            fontSize: 17,
            fontWeight: 800,
            color: 'var(--bp-text, #0f172a)',
            marginBottom: 10,
          }}
        >
          Client added successfully.
        </h3>

        {(clientId || clientName) && (
          <div
            style={{
              marginBottom: 20,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '10px 14px',
            }}
          >
            {clientId && (
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--bp-navy, #0a3d82)', marginBottom: 2 }}>
                Client ID: {clientId}
              </div>
            )}
            {clientName && (
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--bp-text, #0f172a)' }}>
                {clientName}
              </div>
            )}
          </div>
        )}

        <div className="bp-modal-actions" style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="bp-btn bp-btn-outline"
            style={{ flex: 1, padding: '10px 14px', fontSize: 13 }}
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            className="bp-btn bp-btn-primary"
            style={{ flex: 1, padding: '10px 14px', fontSize: 13 }}
            onClick={onGoToDetails}
            autoFocus
          >
            Go to Client Details
          </button>
        </div>
      </div>
    </div>
  );
}
