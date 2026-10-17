import { Component } from 'react';

/**
 * React Error Boundary — catches runtime rendering errors and
 * shows a user-friendly recovery screen instead of a blank white page.
 *
 * - A stale/missing lazy-loaded module (typical right after a deploy or a dev-server restart)
 *   is fixed by a single automatic reload, so the user never even sees the error screen.
 * - Anything else shows the recovery screen with the technical details one click away
 *   (and a Copy button, so the error can be sent to support as-is).
 */
const STALE_MODULE_RE = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk \d+ failed/i;
const RELOAD_GUARD_KEY = 'eb_auto_reload_at';

function tryAutoReload(error) {
  if (!STALE_MODULE_RE.test(String(error?.message || error))) return false;
  try {
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0);
    if (Date.now() - last < 30000) return false; // already tried moments ago — show the screen instead of looping
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

function homeFor(pathname) {
  if (pathname.startsWith('/admin')) return { href: '/admin', label: 'Go to Dashboard' };
  if (pathname.startsWith('/portal')) return { href: '/portal', label: 'Go to Dashboard' };
  return { href: '/', label: 'Go Home' };
}

const CSS = `
.eb-wrap{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;
  background:radial-gradient(1200px 500px at 50% -10%,#e6f0ff 0%,transparent 60%),#f3f8fc;
  font-family:'Manrope','Inter',system-ui,sans-serif;}
.eb-card{width:100%;max-width:520px;background:#fff;border:1px solid #e6edf6;border-radius:22px;
  padding:40px 36px 30px;text-align:center;box-shadow:0 30px 70px -28px rgba(15,42,95,.35);
  animation:eb-pop .25s cubic-bezier(.2,.9,.3,1.15);}
.eb-icon{width:76px;height:76px;margin:0 auto 18px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  color:#dc2626;background:radial-gradient(circle at 30% 25%,#fff1f1 0%,#fee2e2 70%);
  box-shadow:0 0 0 8px rgba(254,226,226,.55),0 12px 24px -10px rgba(220,38,38,.55);}
.eb-title{margin:0 0 8px;font-size:22px;font-weight:800;letter-spacing:-.01em;color:#0f2a5f;}
.eb-text{margin:0 0 22px;font-size:14px;line-height:1.65;color:#64748b;}
.eb-details{text-align:left;margin:0 0 24px;border:1px solid #e8eef6;border-radius:12px;background:#f8fafc;overflow:hidden;}
.eb-details summary{cursor:pointer;padding:11px 14px;font-size:12.5px;font-weight:700;color:#475569;list-style:none;
  display:flex;align-items:center;justify-content:space-between;}
.eb-details summary::-webkit-details-marker{display:none;}
.eb-details summary::after{content:'';width:8px;height:8px;border-right:2px solid #94a3b8;border-bottom:2px solid #94a3b8;
  transform:rotate(45deg);transition:transform .15s ease;margin-right:4px;}
.eb-details[open] summary::after{transform:rotate(-135deg);}
.eb-pre{margin:0;padding:12px 14px;max-height:180px;overflow:auto;border-top:1px solid #e8eef6;background:#0f172a;color:#e2e8f0;
  font:12px/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre-wrap;word-break:break-word;}
.eb-copy{display:block;width:100%;padding:9px;border:none;border-top:1px solid #e8eef6;background:#fff;color:#2563eb;
  font-weight:700;font-size:12px;cursor:pointer;}
.eb-copy:hover{background:#f5f9ff;}
.eb-actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;}
.eb-btn{height:44px;padding:0 22px;border-radius:12px;font-weight:700;font-size:13.5px;cursor:pointer;
  display:inline-flex;align-items:center;gap:8px;transition:transform .15s ease,box-shadow .15s ease,background .15s ease;}
.eb-btn-ghost{background:#f8fafc;border:1px solid #dbe3ef;color:#334155;}
.eb-btn-ghost:hover{background:#eef2f8;}
.eb-btn-primary{border:none;color:#fff;background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);box-shadow:0 10px 20px -8px rgba(29,78,216,.7);}
.eb-btn-primary:hover{transform:translateY(-1px);box-shadow:0 14px 24px -8px rgba(29,78,216,.75);}
@keyframes eb-pop{from{opacity:0;transform:translateY(8px) scale(.97);}to{opacity:1;transform:none;}}
@media (prefers-reduced-motion:reduce){.eb-card{animation:none;}}
`;

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, stack: '', copied: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log to console in dev; in production you'd send to Sentry / LogRocket
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
    this.setState({ stack: info?.componentStack || '' });
    tryAutoReload(error);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, stack: '', copied: false });
  };

  handleCopy = async () => {
    const { error, stack } = this.state;
    const text = `${error?.name || 'Error'}: ${error?.message || ''}\n${error?.stack || ''}\n${stack}`.trim();
    try {
      await navigator.clipboard.writeText(`${text}\n\nURL: ${window.location.href}`);
      this.setState({ copied: true });
      window.setTimeout(() => this.setState({ copied: false }), 1800);
    } catch {
      /* clipboard unavailable — the details stay selectable */
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { error, stack, copied } = this.state;
    const home = homeFor(window.location.pathname);
    const detail = `${error?.name || 'Error'}: ${error?.message || 'Unknown error'}${error?.stack ? `\n\n${error.stack.split('\n').slice(0, 6).join('\n')}` : ''}${stack ? `\n\nComponent stack:${stack.split('\n').slice(0, 6).join('\n')}` : ''}`;

    return (
      <div className="eb-wrap" role="alert">
        <style>{CSS}</style>
        <div className="eb-card">
          <div className="eb-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <h2 className="eb-title">Something went wrong</h2>
          <p className="eb-text">
            This page hit an unexpected problem. Your data is safe — try again, reload the page, or head back to the dashboard.
          </p>

          {error && (
            <details className="eb-details">
              <summary>Error details</summary>
              <pre className="eb-pre">{detail}</pre>
              <button type="button" className="eb-copy" onClick={this.handleCopy}>
                {copied ? 'Copied to clipboard' : 'Copy error details'}
              </button>
            </details>
          )}

          <div className="eb-actions">
            <button type="button" className="eb-btn eb-btn-ghost" onClick={this.handleReset}>Try Again</button>
            <button type="button" className="eb-btn eb-btn-ghost" onClick={() => window.location.reload()}>Reload Page</button>
            <button type="button" className="eb-btn eb-btn-primary" onClick={() => { window.location.href = home.href; }}>{home.label}</button>
          </div>
        </div>
      </div>
    );
  }
}
