import React, { useEffect, useState } from 'react';
import { getAuthToken } from '../api/client';

const DEBOUNCE_MS = 400;

/**
 * Reusable layout preview component.
 *
 * Two modes:
 *  - `src`: static <img> (used for small thumbnails).
 *  - `previewUrl`: authenticated fetch of a PDF from the real renderer, shown
 *    in an <iframe> through a blob URL. Debounced, previous request aborted,
 *    blob URL revoked on change/unmount.
 *
 * @param {Object} props
 * @param {string} [props.src] - URL or imported asset path for a static preview image.
 * @param {string} [props.previewUrl] - API path (e.g. `/api/admin/clients/1/layout-preview?...`) returning a PDF.
 * @param {string} [props.alt='Layout preview'] - Alternative text / iframe title.
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
  const [blobUrl, setBlobUrl] = useState(null);
  const [status, setStatus] = useState(previewUrl ? 'loading' : 'idle');

  useEffect(() => {
    if (!previewUrl) return undefined;

    const controller = new AbortController();
    let createdUrl = null;
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
        const blob = await res.blob();
        if (controller.signal.aborted) return;
        createdUrl = URL.createObjectURL(blob);
        setBlobUrl(createdUrl);
        setStatus('ready');
      } catch (err) {
        if (err?.name === 'AbortError' || controller.signal.aborted) return;
        setBlobUrl(null);
        setStatus('error');
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
      if (createdUrl) URL.revokeObjectURL(createdUrl);
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
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '210 / 297',
        background: '#ffffff',
        ...style,
      }}
    >
      {status === 'ready' && blobUrl && (
        <iframe
          title={alt}
          src={`${blobUrl}#toolbar=0&navpanes=0`}
          style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
        />
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
