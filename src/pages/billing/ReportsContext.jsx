import { createContext, useContext } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { billingDocPath } from './billingUtils';
import { DOC_TYPE_BY_KEY } from '../admin/billing/billingConstants';

/**
 * Where the Reports screens get their data and where their links go.
 *
 * The Report Dashboard and every report page are ONE set of components shared by the Client
 * Portal and the Admin Portal. Only this environment differs:
 *   - Client Portal: the logged-in client's own profile, the client report endpoints.
 *   - Admin Portal:  the selected client's profile, and the admin routes of the SAME report
 *                    controllers (read-only) — so the Admin always sees exactly what that client sees.
 */
const ReportsCtx = createContext(null);
export const ReportsProvider = ReportsCtx.Provider;

export function adminReportsEnv(clientId, profile) {
  const root = `/admin/clients/${clientId}`;

  return {
    isAdmin: true,
    clientId,
    profile,
    reportsApi: `${root}/billing-reports`,
    exportUrl: `/api${root}/billing-reports/export`,
    drillApi: `${root}/billing-reports/drill-down`,
    docsApi: `${root}/billing-documents`,
    paymentLogApi: (docId) => `${root}/billing-documents/${docId}/payment-log`,
    basePath: `/admin/reports/${clientId}`,
    rootCrumbTo: '/admin/reports',
    docLink: (type, id) => `/admin/billing/${clientId}/${DOC_TYPE_BY_KEY[type]?.slug ?? 'tax-invoice'}/${id}`,
    // Reports are for viewing: recording / reversing a payment stays a client action.
    canMarkPayment: false,
  };
}

export function useReportsEnv() {
  const ctx = useContext(ReportsCtx);
  const { user } = useAuth();
  if (ctx) return ctx;

  return {
    isAdmin: false,
    clientId: null,
    profile: user?.client_profile,
    reportsApi: '/billing/reports',
    exportUrl: '/api/billing/reports/export',
    drillApi: '/billing/reports/drill-down',
    docsApi: '/billing/documents',
    paymentLogApi: (docId) => `/billing/documents/${docId}/payment-log`,
    basePath: '/portal/reports',
    rootCrumbTo: '/portal/reports',
    docLink: billingDocPath,
    canMarkPayment: true,
  };
}
