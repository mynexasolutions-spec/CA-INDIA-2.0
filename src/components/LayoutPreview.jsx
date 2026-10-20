import React, { useEffect, useRef, useState } from 'react';
import { getAuthToken } from '../api/client';
const pdfWorkerUrl = '/pdf.worker.min.mjs';

const DEBOUNCE_MS = 400;

// Rendering the PDF takes the server ~1.5 s, so each URL's request is shared and remembered for the session: a
// prefetch started while the user is still choosing a layout/colour makes the preview open instantly.
const pdfRequests = new Map();
const MAX_CACHED = 8;
const CACHE_TTL_MS = 5 * 60 * 1000;

// Only the client's own layout picker is shared/remembered. The admin previews are driven by live form values and
// must always be fetched fresh.
const isShareable = (url) => String(url).includes('/client/layout-preview');
const isCached = (url) => {
  const hit = pdfRequests.get(url);
  if (hit && Date.now() - hit.at > CACHE_TTL_MS) pdfRequests.delete(url);
  return pdfRequests.has(url);
};

function fetchPdf(url) {
  const shareable = isShareable(url);
  if (shareable && isCached(url)) return pdfRequests.get(url).promise;

  const token = getAuthToken();
  const promise = fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/pdf', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  }).then((res) => {
    if (!res.ok) throw new Error('Preview request failed');
    return res.arrayBuffer();
  });
  if (!shareable) return promise;

  pdfRequests.set(url, { promise, at: Date.now() });
  if (pdfRequests.size > MAX_CACHED) pdfRequests.delete(pdfRequests.keys().next().value);
  // A failed request must not be remembered, or the next attempt would replay the failure.
  promise.catch(() => { if (pdfRequests.get(url)?.promise === promise) pdfRequests.delete(url); });
  return promise;
}

/** Start loading a preview in the background (and warm up pdf.js) so it is ready when the user opens it. */
export function prefetchLayoutPreview(url) {
  if (!url || !isShareable(url)) return;
  import('pdfjs-dist').catch(() => {});
  fetchPdf(url).catch(() => {});
}

/**
 * Draws every page of a PDF into <canvas> elements that fill the container's width.
 *
 * The browser's own PDF viewer is unreliable inside an <iframe> (phones, iOS in particular, show nothing or a
 * fixed-size page and ignore our zoom), so the preview is rendered with pdf.js instead. The canvases are
 * re-drawn whenever the container's width changes (window resize, modal zoom), so the page always fits.
 */
function PdfCanvasPages({ data, onFail, onDrawn }) {
  const hostRef = useRef(null);
  const [width, setWidth] = useState(0);
  const docRef = useRef(null);
  const [docReady, setDocReady] = useState(false);

  // track the container width
  useEffect(() => {
    const el = hostRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    setWidth(Math.round(el.clientWidth));
    return () => ro.disconnect();
  }, []);

  // load the document once per PDF
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        const doc = await pdfjs.getDocument({ data: data.slice(0) }).promise;
        if (cancelled) { doc.destroy(); return; }
        docRef.current = doc;
        setDocReady(true);
      } catch (e) {
        if (!cancelled) onFail?.(e);
      }
    })();
    return () => {
      cancelled = true;
      docRef.current?.destroy();
      docRef.current = null;
      setDocReady(false);
    };
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // (re)draw the pages for the current width
  useEffect(() => {
    const doc = docRef.current;
    const host = hostRef.current;
    if (!docReady || !doc || !host || !width) return undefined;
    let cancelled = false;
    const cssW = Math.max(1, Math.floor(host.clientWidth || width));
    // sharp on retina screens, but never beyond ~4000 device pixels wide (phone canvas memory limits)
    const dpr = Math.min(window.devicePixelRatio || 1, 3, 4000 / cssW);

    (async () => {
      try {
        const canvases = [];
        for (let n = 1; n <= doc.numPages; n += 1) {
          const page = await doc.getPage(n);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const cssWidth = Math.floor(host.clientWidth || width);
          const viewport = page.getViewport({ scale: (cssWidth / base.width) * dpr });
          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.cssText = `display:block;width:${cssWidth}px;height:${Math.floor((canvas.height / dpr))}px;background:#fff;`;
          // eslint-disable-next-line no-await-in-loop
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
          if (cancelled) return;
          canvases.push(canvas);
        }
        if (!cancelled) { host.replaceChildren(...canvases); onDrawn?.(); }
      } catch (e) {
        if (!cancelled) onFail?.(e);
      }
    })();

    return () => { cancelled = true; };
  }, [width, data, docReady]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={hostRef} style={{ width: '100%', background: '#fff' }} />;
}

/**
 * Reusable layout preview component.
 *
 * Two modes:
 *  - `src`: static <img> (used for small thumbnails).
 *  - `previewUrl`: authenticated fetch of a PDF from the real renderer, drawn page by page with pdf.js so it
 *    fits the container width on every device. Debounced, previous request aborted.
 *
 * @param {Object} props
 * @param {string} [props.src] - URL or imported asset path for a static preview image.
 * @param {string} [props.previewUrl] - API path (e.g. `/api/admin/clients/1/layout-preview?...`) returning a PDF.
 * @param {string} [props.alt='Layout preview'] - Alternative text.
 * @param {string} [props.className=''] - Additional CSS classes.
 * @param {Object} [props.style={}] - Custom inline styles.
 * @param {Function} [props.onClick] - Optional click handler (static mode).
 */
export default function LayoutPreview({
  src,
  previewUrl,
  alt = 'Layout preview',
  className = '',
  style = {},
  onClick,
  debounceMs = DEBOUNCE_MS,
  onBusyChange,
}) {
  const [pdfData, setPdfData] = useState(null);
  const [status, setStatus] = useState(previewUrl ? 'loading' : 'idle');
  // 'ready' only means the PDF bytes arrived; pdf.js still has to load and draw the pages after that.
  const [drawn, setDrawn] = useState(false);

  const busy = Boolean(previewUrl) && (status === 'loading' || (status === 'ready' && !drawn));
  useEffect(() => { onBusyChange?.(busy); }, [busy]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!previewUrl) return undefined;

    let cancelled = false;
    setStatus('loading');
    setDrawn(false);

    // The debounce only protects against a burst of URL changes; a request that is already in flight or cached
    // (e.g. prefetched while choosing the layout) needs no waiting.
    const wait = isShareable(previewUrl) && isCached(previewUrl) ? 0 : debounceMs;
    const timer = setTimeout(async () => {
      try {
        const buf = await fetchPdf(previewUrl);
        if (cancelled) return;
        setPdfData(buf);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setPdfData(null);
        setStatus('error');
      }
    }, wait);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [previewUrl, debounceMs]);

  if (!previewUrl) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        style={{
          width: '100%',
          height: 'auto',
          display: 'block',
          objectFit: 'contain',
          ...style,
        }}
        onClick={onClick}
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={className}
      role="img"
      aria-label={alt}
      style={{
        position: 'relative',
        width: '100%',
        // reserve an A4 page until the canvases are drawn; after that they set the height
        ...(status === 'ready' && drawn ? {} : { aspectRatio: '210 / 297' }),
        background: '#ffffff',
        ...style,
      }}
    >
      {status === 'ready' && pdfData && (
        <PdfCanvasPages data={pdfData} onFail={() => setStatus('error')} onDrawn={() => setDrawn(true)} />
      )}
      {busy && (
        <div
          role="status"
          aria-label="Loading preview"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            // Near the top of the page, not its centre: the page is taller than the visible area, so a centred
            // spinner sat below the fold and the preview looked like it was doing nothing.
            justifyContent: 'flex-start',
            paddingTop: 'min(150px, 22vh)',
            gap: 14,
            background: 'rgba(255,255,255,0.85)',
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              border: '4px solid #dbe6f7',
              borderTopColor: '#2563eb',
              borderRadius: '50%',
              animation: 'layout-preview-spin 0.8s linear infinite',
            }}
          />
          <div style={{ textAlign: 'center', lineHeight: 1.4 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0f2a5f' }}>Preparing your preview…</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>This can take a few seconds the first time.</div>
          </div>
          <style>{'@keyframes layout-preview-spin { to { transform: rotate(360deg); } }'}</style>
        </div>
      )}
      {status === 'error' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            color: '#64748b',
          }}
        >
          Preview unavailable
        </div>
      )}
    </div>
  );
}
