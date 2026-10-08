import { useEffect, useState } from 'react';

export default function AddClientNoteModal({ isOpen, onClose, onSave, editNote, loading }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (editNote) {
      setNote(editNote.note || '');
    } else {
      setNote('');
    }
    setError('');
  }, [editNote, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!note.trim()) {
      setError('Note description is required.');
      return;
    }
    setError('');
    onSave(note.trim());
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 15,
              }}
            >
              📝
            </div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
              {editNote ? 'Edit Note' : 'Add Note'}
            </h3>
          </div>
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

          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                Note Description <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <span style={{ fontSize: 11, color: note.length > 1000 ? '#dc2626' : '#64748b' }}>
                {note.length}/1000
              </span>
            </div>
            <textarea
              className="bp-input"
              rows={4}
              maxLength={1000}
              placeholder="e.g. Client prefers to reset password every 3 months."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={loading}
              autoFocus
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                fontSize: 13,
                lineHeight: 1.5,
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Footer actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '8px 18px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                color: '#475569',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '8px 20px',
                background: '#2563eb',
                border: '1px solid #2563eb',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                color: '#ffffff',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? (editNote ? 'Updating…' : 'Saving…') : (editNote ? 'Update Note' : 'Add Note')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
