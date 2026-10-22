import { useEffect, useState } from 'react';
import LayoutPreview from './LayoutPreview';

const ZOOM_MIN = 60;
const ZOOM_MAX = 250;
const ZOOM_STEP = 20;

// Colour schemes a document can use (matches the backend's DocumentThemeTokens). A caller that only knows the
// scheme id (e.g. an admin page showing a client on a scheme its own picker no longer offers) still gets a proper
// name and colour in the header chip instead of the raw id.
const SCHEMES = {
  simple: ['Simple', '#111111'],
  royal_blue: ['Royal Blue', '#1D40AF'],
  slate_blue: ['Slate Blue', '#2563EB'],
  charcoal_grey: ['Charcoal Grey', '#3F4650'],
  dusty_plum: ['Dusty Plum', '#8C2F5F'],
  mocha_brown: ['Mocha Brown', '#793312'],
  deep_teal: ['Deep Teal', '#036070'],
  antique_gold: ['Antique Gold', '#A8832F'],
};

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/**
 * Larger preview of a layout + colour, rendered by the real document renderer, with zoom.
 * One modal for the client portal (Settings → Layouts) and the admin portal (Clients → Layout /
 * Configuration), so both look and behave the same.
 *
 * @param {string} title        Heading, e.g. "Layout 1".
 * @param {string} chipColor    Hex of the colour-scheme dot in the header chip.
 * @param {string} chipLabel    Name of the colour scheme.
 * @param {string} subtitle     Small line under the heading.
 * @param {string} previewUrl   API path returning the preview PDF.
 * @param {string} fallbackSrc  Static image shown if the live preview is unavailable.
 */
export default function LayoutPreviewModal({
  title,
  chipColor,
  chipLabel,
  subtitle,
  previewUrl,
  fallbackSrc,
  alt = 'Layout preview',
  onClose,
}) {
  const [zoom, setZoom] = useState(100);
  const [busy, setBusy] = useState(true); // true while the preview PDF is being fetched / drawn
  const clamp = (z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

  // Keyboard: Esc closes, +/- zoom, 0 resets.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === '+' || e.key === '=') setZoom((z) => clamp(z + ZOOM_STEP));
      else if (e.key === '-' || e.key === '_') setZoom((z) => clamp(z - ZOOM_STEP));
      else if (e.key === '0') setZoom(100);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const known = SCHEMES[chipLabel];
  const chipName = known ? known[0] : chipLabel;
  const chipHex = known ? known[1] : chipColor;

  const pill = { height: 34, border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };

  return (
    <div className="bp-modal-backdrop" role="presentation" onClick={onClose}
      style={{ zIndex: 99999, backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', background: 'rgba(10, 25, 60, 0.55)' }}>
      <style>{`
        .lpm-load { position: relative; flex: 0 0 4px; height: 4px; overflow: hidden; background: rgba(29, 78, 216, 0.12); transition: opacity .25s ease; }
        .lpm-load::before { content: ""; position: absolute; top: 0; bottom: 0; left: 0; width: 38%; border-radius: 4px; background: linear-gradient(90deg, #60a5fa, #1d4ed8, #60a5fa); animation: lpm-slide 1.1s ease-in-out infinite; }
        @keyframes lpm-slide { 0% { transform: translateX(-100%); } 100% { transform: translateX(270%); } }
        .lpm-frame iframe { margin: -8px !important; width: calc(100% + 16px) !important; height: calc(100% + 16px) !important; }
        .lpm-range { -webkit-appearance: none; appearance: none; width: 120px; min-width: 0; height: 4px !important; padding: 0 !important; margin: 0 !important; border: 0 !important; border-radius: 4px; background: rgba(255,255,255,.35) !important; box-shadow: none !important; outline: none; }
        .lpm-pill button { flex-shrink: 0; }
        .lpm-frame { width: calc(900px * var(--z)); min-width: 320px; }
        /* The modal renders inside whichever page opened it. The admin client pages carry global heading rules
           (e.g. ".cp-page .cp-panel h3 { color: navy !important }") that would otherwise turn the white title navy
           on the blue header, so the header text styles are pinned here with a more specific selector. */
        .bp-modal.lpm-modal { text-align: left; }
        .bp-modal.lpm-modal .lpm-titles h3 { color: #fff !important; font-weight: 800 !important; letter-spacing: -0.01em !important; margin: 0 !important; }
        .bp-modal.lpm-modal .lpm-sub { color: rgba(255,255,255,0.78) !important; text-align: left !important; }
        @media (max-width: 760px) {
          .bp-modal.lpm-modal { width: 100vw !important; max-width: 100vw !important; height: 100dvh !important; max-height: 100dvh !important; padding: 0 !important; margin: 0 !important; border-radius: 0 !important; border: 0 !important; box-sizing: border-box; }
          .lpm-modal h3 { font-size: 15px !important; }
          .bp-modal.lpm-modal { text-align: left !important; }
          .lpm-head { position: relative; display: flex !important; flex-direction: column !important; flex-wrap: nowrap !important; align-items: stretch !important; justify-content: flex-start !important; gap: 10px !important; padding: 12px 14px 12px !important; overflow: visible; }
          .lpm-icon, .lpm-sub { display: none !important; }
          .lpm-titles { width: 100%; padding-right: 44px; box-sizing: border-box; min-height: 34px; display: flex; align-items: center; }
          /* the full name wraps onto a second line instead of being cut off; the colour chip drops below it if needed */
          .lpm-titles > div { flex-wrap: wrap !important; gap: 4px 8px !important; min-width: 0; }
          .lpm-chip { font-size: 11.5px !important; }
          .lpm-titles h3 { white-space: normal; overflow: visible; text-overflow: clip; overflow-wrap: anywhere; line-height: 1.25; max-width: 100%; }
          .lpm-chip { flex: 0 0 auto; width: auto; height: auto; }
          .bp-modal.lpm-modal .lpm-close { position: absolute !important; top: 12px; right: 12px; left: auto; width: 34px !important; min-width: 34px !important; height: 34px !important; flex: 0 0 34px; padding: 0; border-radius: 50% !important; }
          .lpm-controls { display: flex !important; justify-content: flex-end; width: 100%; height: auto; }
          .lpm-pill { display: inline-flex !important; align-items: center; justify-content: center; gap: 10px !important; width: auto !important; flex: 0 0 auto !important; height: 42px; padding: 3px 8px !important; border-radius: 21px !important; box-sizing: border-box; overflow: hidden; }
          .lpm-range { display: none !important; }
          .bp-modal.lpm-modal .lpm-pill button { height: 34px !important; max-width: none; font-size: 20px !important; }
          .bp-modal.lpm-modal .lpm-pill button:first-child { order: 1; flex: 0 0 38px; width: 38px !important; min-width: 38px !important; }
          .bp-modal.lpm-modal .lpm-pill button:last-child { order: 2; flex: 0 0 auto; width: 96px !important; min-width: 96px !important; margin: 0; font-size: 13px !important; }
          .bp-modal.lpm-modal .lpm-pill button:nth-child(3) { order: 3; flex: 0 0 38px; width: 38px !important; min-width: 38px !important; }
          .lpm-area { padding: 14px 10px !important; }
          .lpm-frame { width: calc(100% * var(--z)); min-width: 0; }
          .lpm-foot { padding: 10px 14px !important; }
          .lpm-keys { display: none !important; }
          .lpm-foot button { width: 100%; }
        }
        .lpm-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 2px 6px rgba(0,0,0,.35); cursor: pointer; }
        .lpm-range::-moz-range-thumb { width: 16px; height: 16px; border: none; border-radius: 50%; background: #fff; box-shadow: 0 2px 6px rgba(0,0,0,.35); cursor: pointer; }
        .lpm-pill button:hover:not(:disabled) { background: rgba(255,255,255,.16); }
        .lpm-pill button:disabled { opacity: .4; cursor: not-allowed; }
      `}</style>
      <div
        className="bp-modal lpm-modal" role="dialog" aria-modal="true" aria-label="Layout Preview"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(1180px, 97vw)', height: '95vh', maxHeight: '95vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', borderRadius: 22, boxShadow: '0 40px 90px -20px rgba(8, 20, 60, 0.65)', border: '1px solid rgba(255,255,255,0.25)' }}
      >
        {/* header */}
        <div className="lpm-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', padding: '16px 22px', background: 'linear-gradient(120deg, #0f2a5f 0%, #1d4ed8 100%)', color: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
            <span className="lpm-icon" style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(255,255,255,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <EyeIcon />
            </span>
            <div className="lpm-titles" style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>{title}</h3>
                {chipName && (
                  <span className="lpm-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '3px 11px 3px 6px', borderRadius: 999, background: 'rgba(255,255,255,0.16)', fontSize: 12, fontWeight: 700 }}>
                    <span style={{ width: 14, height: 14, borderRadius: '50%', background: chipHex, boxShadow: '0 0 0 2px rgba(255,255,255,0.9)' }} />
                    {chipName}
                  </span>
                )}
              </div>
              {subtitle && <span className="lpm-sub" style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.78)' }}>{subtitle}</span>}
            </div>
          </div>

          <div className="lpm-controls" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="lpm-pill" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.22)' }}>
              <button type="button" style={{ ...pill, width: 32, borderRadius: '50%', fontSize: 20, fontWeight: 700 }} onClick={() => setZoom((z) => clamp(z - ZOOM_STEP))} disabled={zoom <= ZOOM_MIN} aria-label="Zoom out" title="Zoom out (-)">−</button>
              <input className="lpm-range" type="range" min={ZOOM_MIN} max={ZOOM_MAX} step={10} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="Zoom" />
              <button type="button" style={{ ...pill, width: 32, borderRadius: '50%', fontSize: 20, fontWeight: 700 }} onClick={() => setZoom((z) => clamp(z + ZOOM_STEP))} disabled={zoom >= ZOOM_MAX} aria-label="Zoom in" title="Zoom in (+)">+</button>
              <button type="button" onClick={() => setZoom(100)} title="Reset zoom (0)"
                style={{ ...pill, minWidth: 58, padding: '0 10px', borderRadius: 999, fontSize: 13, fontWeight: 800, background: 'rgba(255,255,255,0.2)' }}>{zoom}%</button>
            </div>
            <button type="button" className="lpm-close" onClick={onClose} aria-label="Close"
              style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.18)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
        </div>

        {/* slim progress bar under the header — always in view, unlike the page below it which scrolls */}
        <div className="lpm-load" role="progressbar" aria-busy={busy} aria-label="Loading preview" style={{ opacity: busy ? 1 : 0 }} />

        {/* page area — the page is `900px × zoom` wide; the area scrolls in both directions */}
        <div className="lpm-area" style={{ flex: 1, overflow: 'auto', padding: '28px 24px', background: 'radial-gradient(circle at 1px 1px, rgba(15,42,95,0.09) 1px, transparent 0) 0 0 / 18px 18px, #eaf0fa' }}>
          <div className="lpm-frame" style={{ '--z': zoom / 100, margin: '0 auto', background: '#fff', boxShadow: '0 24px 50px -18px rgba(15, 42, 95, 0.5), 0 0 0 1px rgba(15, 42, 95, 0.08)', borderRadius: 6, overflow: 'hidden' }}>
            <LayoutPreview previewUrl={previewUrl} debounceMs={0} onBusyChange={setBusy} src={fallbackSrc} alt={alt} />
          </div>
        </div>

        {/* footer */}
        <div className="lpm-foot" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 22px', borderTop: '1px solid #dbe5f3', background: '#fff' }}>
          <div className="lpm-keys" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11.5, color: '#64748b' }}>
            {[['+ / −', 'Zoom'], ['0', 'Reset'], ['Esc', 'Close']].map(([k, t]) => (
              <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <kbd style={{ padding: '2px 7px', borderRadius: 6, border: '1px solid #cbd5e1', borderBottomWidth: 2, background: '#f8fafc', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, color: '#334155' }}>{k}</kbd>{t}
              </span>
            ))}
          </div>
          <button type="button" onClick={onClose}
            style={{ height: 40, padding: '0 26px', borderRadius: 11, border: 'none', background: 'linear-gradient(135deg, #1e3a8a, #1d4ed8)', color: '#fff', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', boxShadow: '0 10px 18px -10px rgba(29,78,216,.8)' }}>
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}
