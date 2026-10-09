/**
 * Build the API path for the real-renderer layout preview PDF.
 * All values are the current (possibly unsaved) UI selection.
 */
export function layoutPreviewUrl(clientId, { layoutId, colourScheme, documentType, watermark } = {}) {
  if (!clientId || !layoutId || !colourScheme) return null;
  const params = new URLSearchParams({
    layout_id: String(layoutId),
    colour_scheme: colourScheme,
  });
  if (documentType) params.set('document_type', documentType);
  if (watermark !== undefined) params.set('watermark', watermark ? '1' : '0');
  return `/api/admin/clients/${clientId}/layout-preview?${params.toString()}`;
}
