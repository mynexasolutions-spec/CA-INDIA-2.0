import { createContext, useContext } from 'react';

/**
 * Financial Year + Refresh Data are global controls, shared by every Client Portal page via this
 * context (provided by ClientPortalLayout, rendered in the shared topbar).
 *
 * It lives in its own tiny module on purpose: when it was defined inside PortalShell.jsx, every
 * hot-reload of that big file created a brand-new context object, so pages still holding the old
 * one read `null` and crashed ("Cannot destructure property 'fy' of useClientPortal(...)").
 */
export const ClientPortalCtx = createContext(null);

export function useClientPortal() {
  return useContext(ClientPortalCtx);
}
