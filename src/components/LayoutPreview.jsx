import React from 'react';

/**
 * Reusable layout preview component.
 * Currently renders an <img> preview from static placeholder images.
 * In Stage F, this will be swapped for an <iframe> / real template renderer.
 *
 * @param {Object} props
 * @param {string} props.src - URL or imported asset path for the layout preview.
 * @param {string} [props.alt='Layout preview'] - Alternative text.
 * @param {string} [props.className=''] - Additional CSS classes.
 * @param {Object} [props.style={}] - Custom inline styles.
 * @param {Function} [props.onClick] - Optional click handler.
 */
export default function LayoutPreview({
  src,
  alt = 'Layout preview',
  className = '',
  style = {},
  onClick,
}) {
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
