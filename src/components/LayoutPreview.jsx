import React, { useEffect, useRef, useState } from 'react';
import { getAuthToken } from '../api/client';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

const DEBOUNCE_MS = 400;

/**
 * Draws every page of a PDF into <canvas> elements that fill the container's width.
 *
 * The browser's own PDF viewer is unreliable inside an <iframe> (phones, iOS in particular, show nothing or a
 * fixed-size page and ignore our zoom), so the preview is rendered with pdf.js instead. The canvases are
 * re-drawn whenever the container's width changes (window resize, modal zoom), so the page always fits.
 */
function PdfCanvasPages({ data, onFail }) {
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
        if (!cancelled) host.replaceChildren(...canvases);
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
}) {
  const [pdfData, setPdfData] = useState(null);
  const [status, setStatus] = useState(previewUrl ? 'loading' : 'idle');

  useEffect(() => {
    if (!previewUrl) return undefined;

    const controller = new AbortController();
    setStatus('loading');

    const timer = setTimeout(async () => {
      try {
        const token = getAuthToken();
        const res = await fetch(previewUrl, {
          method: 'GET',
          headers: {
            Accept: 'application/pdf',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('Preview request failed');
        const buf = await res.arrayBuffer();
        if (controller.signal.aborted) return;
        setPdfData(buf);
        setStatus('ready');
      } catch (err) {
        if (err?.name === 'AbortError' || controller.signal.aborted) return;
        setPdfData(null);
        setStatus('error');
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [previewUrl]);

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
        // reserve an A4 page while loading; once drawn the canvases set the height
        ...(status === 'ready' ? {} : { aspectRatio: '210 / 297' }),
        background: '#ffffff',
        ...style,
      }}
    >
      {status === 'ready' && pdfData && (
        <PdfCanvasPages data={pdfData} onFail={() => setStatus('error')} />
      )}
      {status === 'loading' && (
        <div
          role="status"
          aria-label="Loading preview"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.7)',
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              border: '3px solid #e2e8f0',
              borderTopColor: '#2563eb',
              borderRadius: '50%',
              animation: 'layout-preview-spin 0.8s linear infinite',
            }}
          />
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
