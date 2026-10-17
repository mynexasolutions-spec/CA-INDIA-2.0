export default function Spinner({ size = 20, color = '#2563eb', thickness = 2.5, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="spin" style={{ flexShrink: 0, ...style }}>
      <circle cx="12" cy="12" r="9.25" stroke={color} strokeOpacity="0.15" strokeWidth={thickness} />
      <path d="M21.25 12a9.25 9.25 0 0 0-9.25-9.25" stroke={color} strokeWidth={thickness} strokeLinecap="round" />
    </svg>
  );
}

const LOADER_CSS = `
@keyframes ldr-spin { to { transform: rotate(360deg); } }
@keyframes ldr-spin-rev { to { transform: rotate(-360deg); } }
@keyframes ldr-pulse { 0%, 100% { transform: scale(.82); opacity: .75; } 50% { transform: scale(1); opacity: 1; } }
@keyframes ldr-dot { 0%, 80%, 100% { transform: translateY(0); opacity: .35; } 40% { transform: translateY(-4px); opacity: 1; } }
.ldr { position: relative; display: inline-block; }
.ldr-ring { position: absolute; inset: 0; border-radius: 50%; border: 3px solid transparent; }
.ldr-ring.a { border-top-color: #1d5fe0; border-right-color: rgba(29,95,224,.35); animation: ldr-spin 1s cubic-bezier(.55,.15,.45,.85) infinite; }
.ldr-ring.b { inset: 9px; border-bottom-color: #4f8df5; border-left-color: rgba(79,141,245,.35); animation: ldr-spin-rev 1.4s linear infinite; }
.ldr-core { position: absolute; inset: 20px; border-radius: 50%; background: linear-gradient(135deg, #2f6fe8, #0f2a5f); box-shadow: 0 0 16px rgba(29,95,224,.55); animation: ldr-pulse 1.4s ease-in-out infinite; }
.ldr-dots { display: inline-flex; gap: 3px; margin-left: 4px; }
.ldr-dots i { width: 4px; height: 4px; border-radius: 50%; background: currentColor; animation: ldr-dot 1.2s infinite; }
.ldr-dots i:nth-child(2) { animation-delay: .15s; } .ldr-dots i:nth-child(3) { animation-delay: .3s; }
@media (prefers-reduced-motion: reduce) { .ldr-ring, .ldr-core, .ldr-dots i { animation-duration: 3s; } }
`;

/** Branded loader: counter-rotating rings around a pulsing core. */
export function FancyLoader({ size = 64 }) {
  return (
    <span className="ldr" style={{ width: size, height: size }} role="status" aria-label="Loading">
      <style>{LOADER_CSS}</style>
      <span className="ldr-ring a" />
      <span className="ldr-ring b" />
      <span className="ldr-core" style={{ inset: Math.round(size * 0.31) }} />
    </span>
  );
}

/** Centered loader + label — the standard "loading this section" block. */
export function LoadingBlock({ label = 'Loading…', size = 22, minHeight = 160, style }) {
  const text = String(label).replace(/[….]+$/, '');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, minHeight, padding: '32px 16px', color: '#475569', fontSize: 14, fontWeight: 600, letterSpacing: '.2px', ...style }}>
      <FancyLoader size={Math.max(48, Math.round(size * 2.4))} />
      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
        {text}
        <span className="ldr-dots"><i /><i /><i /></span>
      </span>
    </div>
  );
}

/** Inline spinner + label for tight spaces (e.g. next to a button or a one-line status). */
export function LoadingInline({ label = 'Loading…', size = 14, color, style }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--bp-muted, #6b8499)', fontSize: 13, fontWeight: 600, ...style }}>
      <Spinner size={size} color={color} />
      {label}
    </span>
  );
}
