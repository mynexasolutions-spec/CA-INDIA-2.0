function CheckIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/**
 * Modal shown after successfully saving changes on an existing client (Module 2A - Section A2 / PDF p30).
 * Displays "Changes saved successfully." with an OK button.
 */
export default function ClientSaveSuccessModal({
  isOpen = true,
  onClose,
}) {
  if (!isOpen) return null;

  return (
    <div className="bp-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="bp-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Changes saved successfully."
        onClick={(e) => e.stopPropagation()}
        style={{ textAlign: 'center', width: 'min(340px, 92vw)' }}
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
            marginBottom: 20,
          }}
        >
          Changes saved successfully.
        </h3>

        <div className="bp-modal-actions" style={{ display: 'flex' }}>
          <button
            type="button"
            className="bp-btn bp-btn-primary"
            style={{ width: '100%', padding: '10px 14px', fontSize: 13 }}
            onClick={onClose}
            autoFocus
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
