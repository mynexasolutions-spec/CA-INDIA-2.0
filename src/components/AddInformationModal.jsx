import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function AddInformationModal({ isOpen, onClose, onSaved, clientId, editItem }) {
  const [information, setInformation] = useState('');
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editItem) {
      setInformation(editItem.information || '');
      setRemarks(editItem.remarks || '');
    } else {
      setInformation('');
      setRemarks('');
    }
    setError('');
  }, [editItem, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!information.trim()) {
      setError('Information is required.');
      return;
    }
    if (!remarks.trim()) {
      setError('Remarks are required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (editItem && editItem.id) {
        const res = await api(`/admin/clients/${clientId}/additional-info/${editItem.id}`, {
          method: 'PUT',
          body: {
            information: information.trim(),
            remarks: remarks.trim(),
          },
        });
        onSaved(res);
      } else {
        const res = await api(`/admin/clients/${clientId}/additional-info`, {
          method: 'POST',
          body: {
            information: information.trim(),
            remarks: remarks.trim(),
          },
        });
        onSaved(res);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save information.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 14,
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
          maxWidth: 520,
          width: '100%',
          overflow: 'hidden',
          animation: 'fadeInScale 0.15s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--bp-navy, #0a3d82)' }}>
            {editItem ? 'Edit Information' : 'Add Information'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 18,
              cursor: 'pointer',
              color: '#64748b',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 24px' }}>
          {error && (
            <div
              style={{
                marginBottom: 16,
                padding: '10px 14px',
                borderRadius: 8,
                background: '#fee2e2',
                color: '#dc2626',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {error}
            </div>
          )}

          {/* Information Type / Title */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                Information <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <span style={{ fontSize: 11, color: information.length > 255 ? '#dc2626' : '#64748b' }}>
                {information.length}/255
              </span>
            </div>
            <textarea
              className="bp-input"
              required
              rows={3}
              maxLength={255}
              placeholder="e.g. Billing Cycle, Communication Preference, Key Account Manager"
              value={information}
              onChange={(e) => setInformation(e.target.value)}
              disabled={loading}
              autoFocus
              style={{ resize: 'vertical', minHeight: 70 }}
            />
          </div>

          {/* Remarks */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                Remarks <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <span style={{ fontSize: 11, color: remarks.length > 1000 ? '#dc2626' : '#64748b' }}>
                {remarks.length}/1000
              </span>
            </div>
            <textarea
              className="bp-input"
              required
              rows={4}
              maxLength={1000}
              placeholder="Provide detailed notes or remarks for this information item..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              disabled={loading}
              style={{ resize: 'vertical', minHeight: 90 }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button"
              className="bp-btn bp-btn-outline"
              disabled={loading}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bp-btn bp-btn-primary"
              disabled={loading || !information.trim() || !remarks.trim()}
              style={{ background: 'var(--bp-blue, #2563eb)' }}
            >
              {loading ? 'Saving…' : editItem ? 'Update Information' : 'Add Information'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
