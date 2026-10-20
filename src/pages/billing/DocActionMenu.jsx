import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * Billing Module spec §6/§10 — a single three-dot action menu component reused
 * across every document table row. `actions` is an ordered array of:
 *   { label, to } — internal Link
 *   { label, onClick } — button action
 *   { divider: true } — visual separator
 * Falsy entries are skipped so callers can conditionally include an action.
 */
export default function DocActionMenu({ actions }) {
  const [open, setOpen] = useState(false);
  // Table wrappers use overflow:auto, which clips an absolutely-positioned popover, so the menu is
  // fixed-positioned from the trigger's on-screen rect (and flips upward near the bottom edge).
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const items = (actions || []).filter(Boolean);
  if (!items.length) return null;

  const toggle = () => {
    if (open) { setOpen(false); return; }
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) {
      const estHeight = items.length * 38 + 16;
      const flipUp = r.bottom + 4 + estHeight > window.innerHeight && r.top > estHeight;
      setPos({
        position: 'fixed',
        right: Math.max(8, window.innerWidth - r.right),
        left: 'auto',
        ...(flipUp ? { bottom: window.innerHeight - r.top + 4, top: 'auto' } : { top: r.bottom + 4 }),
        zIndex: 1000,
      });
    }
    setOpen(true);
  };

  return (
    <div className="bp-action-menu" ref={ref}>
      <button
        type="button"
        ref={triggerRef}
        className="bp-action-menu-trigger"
        aria-label="Actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        ⋮
      </button>
      {open && (
        <div className="bp-action-menu-popover" role="menu" style={pos || undefined}>
          {items.map((a, i) => {
            if (a.divider) return <div key={`d${i}`} className="bp-action-menu-divider" />;
            const className = `bp-action-menu-item${a.danger ? ' danger' : ''}`;
            if (a.disabled) {
              return (
                <span key={a.label} className={`${className} disabled`} role="menuitem" aria-disabled="true" title={a.disabledReason}>
                  {a.label}
                </span>
              );
            }
            if (a.to) {
              return (
                <Link key={a.label} to={a.to} className={className} role="menuitem" onClick={() => setOpen(false)}>
                  {a.label}
                </Link>
              );
            }
            return (
              <button
                key={a.label}
                type="button"
                className={className}
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  a.onClick?.();
                }}
              >
                {a.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
