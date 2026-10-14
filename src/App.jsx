import { lazy, Suspense } from 'react';
import { Route, Routes, Navigate, useParams } from 'react-router-dom';
import Layout from './components/Layout';
import HtmlPage from './components/HtmlPage';
import Spinner from './components/Spinner';
import { AdminPortalLayout, AdminBillingLayout, ClientPortalLayout, ClientBillingLayout, ClientReportsLayout, RequireAuth } from './components/portal/PortalShell';
import { AdminFyProvider } from './context/AdminFyContext';
import GstComplianceGate from './components/GstComplianceGate';
import { PAGE_SLUGS } from './data/nav';

/* ── Marketing pages (eagerly loaded — they're the landing pages) ── */
import HomePage from './pages/marketing/HomePage';
import BillingManagement from './pages/marketing/BillingManagement';
import KnowledgeCentre from './pages/marketing/KnowledgeCentre';
import ArticleDetail from './pages/marketing/ArticleDetail';
import DueDates from './pages/marketing/DueDates';
import { CookiePolicy, PrivacyPolicy, TermsAndConditions } from './pages/marketing/LegalPages';
import NotFound from './pages/marketing/NotFound';
import LoginPage from './pages/marketing/LoginPage';
import ResetPasswordPage from './pages/marketing/ResetPasswordPage';

/* ── Client Portal pages (lazy-loaded — only fetched when user logs in) ── */
const ClientPages = lazy(() => import('./pages/portal/ClientPages'));
const ClientDashboard = lazy(() => import('./pages/portal/ClientPages').then(m => ({ default: m.ClientDashboard })));
const ClientProfile = lazy(() => import('./pages/portal/ClientPages').then(m => ({ default: m.ClientProfile })));
const ClientResetPassword = lazy(() => import('./pages/portal/ClientPages').then(m => ({ default: m.ClientResetPassword })));
const BillingDashboard = lazy(() => import('./pages/billing/BillingDashboard'));
const PartiesPage = lazy(() => import('./pages/billing/PartiesPage'));
const PartyForm = lazy(() => import('./pages/billing/PartyForm'));
const InvoiceForm = lazy(() => import('./pages/billing/InvoiceForm'));
const InvoiceList = lazy(() => import('./pages/billing/InvoiceList'));
const InvoiceDetail = lazy(() => import('./pages/billing/InvoiceDetail'));
const BillingReports = lazy(() => import('./pages/billing/BillingReports'));
const OutstandingPage = lazy(() => import('./pages/billing/OutstandingPage'));
const GstSummaryPage = lazy(() => import('./pages/billing/GstSummaryPage'));
const GstLiabilityReport = lazy(() => import('./pages/billing/GstLiabilityReport'));
const HsnSummaryPage = lazy(() => import('./pages/billing/HsnSummaryPage'));
const PartyWisePage = lazy(() => import('./pages/billing/PartyWisePage'));
const PartyDocumentDetailPage = lazy(() => import('./pages/billing/PartyDocumentDetailPage'));
const BusinessSettings = lazy(() => import('./pages/billing/BusinessSettings'));
const ChangeRequestHistory = lazy(() => import('./pages/billing/BusinessSettings').then((m) => ({ default: m.ChangeRequestHistory })));
const ReportsDashboard = lazy(() => import('./pages/billing/ReportsDashboard'));
const EditRequestPage = lazy(() => import('./pages/portal/EditRequestPage'));
const AmendmentsPage = lazy(() => import('./pages/portal/AmendmentsPage'));
const ClientGstr2b = lazy(() => import('./pages/portal/ClientGstr2b'));
const GstReturnsWorkspace = lazy(() => import('./pages/portal/GstReturnsWorkspace'));
const GstFilingConfirmation = lazy(() => import('./pages/portal/GstFilingConfirmation'));

/* ── Admin pages (lazy-loaded — only fetched when admin logs in) ── */
const AdminGstFilingRequests = lazy(() => import('./pages/admin/AdminGstFilingRequests'));
const AdminGstFilingReview = lazy(() => import('./pages/admin/AdminGstFilingReview'));
const AdminEditRequests = lazy(() => import('./pages/admin/AdminEditRequests'));
const AdminEditRequestList = lazy(() => import('./pages/admin/AdminEditRequests').then(m => ({ default: m.AdminEditRequestList })));
const AdminEditRequestDetail = lazy(() => import('./pages/admin/AdminEditRequests').then(m => ({ default: m.AdminEditRequestDetail })));
const AdminConfiguration = lazy(() => import('./pages/admin/AdminConfiguration'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));
const AdminOverview = lazy(() => import('./pages/admin/AdminOverview'));
const AdminClients = lazy(() => import('./pages/admin/AdminClients'));
const ClientProfileForm = lazy(() => import('./pages/admin/ClientProfileForm'));
const AdminClientBilling = lazy(() => import('./pages/admin/AdminClientBilling'));
const AdminChangeRequests = lazy(() => import('./pages/admin/AdminChangeRequests'));
const AdminChangeRequestList = lazy(() => import('./pages/admin/AdminChangeRequests').then(m => ({ default: m.AdminChangeRequestList })));
const AdminChangeRequestDetail = lazy(() => import('./pages/admin/AdminChangeRequests').then(m => ({ default: m.AdminChangeRequestDetail })));
const AdminBillingClientList = lazy(() => import('./pages/admin/billing/AdminBillingClientList'));
const AdminBillingClientDashboard = lazy(() => import('./pages/admin/billing/AdminBillingClientDashboard'));
const AdminBillingDocumentList = lazy(() => import('./pages/admin/billing/AdminBillingDocumentList'));
const AdminBillingDocPlaceholder = lazy(() => import('./pages/admin/billing/AdminBillingDocPlaceholder'));
const AdminGstr2bClientPicker = lazy(() => import('./pages/admin/AdminGstr2bClientPicker'));
const AdminClientGstr2b = lazy(() => import('./pages/admin/AdminClientGstr2b'));
const AdminGstReturns = lazy(() => import('./pages/admin/AdminGstReturns'));
const ClientsUnlockGate = lazy(() => import('./pages/admin/ClientsUnlockGate'));
const AdminPages = lazy(() => import('./pages/admin/AdminPages'));
const AdminActivity = lazy(() => import('./pages/admin/AdminPages').then(m => ({ default: m.AdminActivity })));
const AdminAppointments = lazy(() => import('./pages/admin/AdminPages').then(m => ({ default: m.AdminAppointments })));
const AdminArticles = lazy(() => import('./pages/admin/AdminPages').then(m => ({ default: m.AdminArticles })));
const AdminCompliance = lazy(() => import('./pages/admin/AdminPages').then(m => ({ default: m.AdminCompliance })));
const AdminDueDates = lazy(() => import('./pages/admin/AdminPages').then(m => ({ default: m.AdminDueDates })));
const AdminEnquiries = lazy(() => import('./pages/admin/AdminPages').then(m => ({ default: m.AdminEnquiries })));
const AdminStaff = lazy(() => import('./pages/admin/AdminPages').then(m => ({ default: m.AdminStaff })));
const AdminBillingPages = lazy(() => import('./pages/admin/AdminBillingPages'));
const AdminBillingDashboard = lazy(() => import('./pages/admin/AdminBillingPages').then(m => ({ default: m.AdminBillingDashboard })));
const AdminBillingInvoices = lazy(() => import('./pages/admin/AdminBillingPages').then(m => ({ default: m.AdminBillingInvoices })));
const AdminBillingReports = lazy(() => import('./pages/admin/AdminBillingPages').then(m => ({ default: m.AdminBillingReports })));
const AdminGstSummary = lazy(() => import('./pages/admin/AdminBillingPages').then(m => ({ default: m.AdminGstSummary })));
const AdminHsnSummary = lazy(() => import('./pages/admin/AdminBillingPages').then(m => ({ default: m.AdminHsnSummary })));
const AdminInvoiceDetail = lazy(() => import('./pages/admin/AdminBillingPages').then(m => ({ default: m.AdminInvoiceDetail })));

/** Suspense fallback shown while a lazy chunk loads */
function LazyFallback() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      minHeight: 200, color: '#6b8499', fontSize: 14, fontWeight: 600,
    }}>
      <Spinner size={22} />
      Loading…
    </div>
  );
}

function Page({ path }) {
  const slug = PAGE_SLUGS[path];
  return <HtmlPage slug={slug} />;
}

function PendingApprovalIdRedirect() {
  const { id } = useParams();
  return <Navigate to={`/admin/pending-approval/${id}`} replace />;
}

export default function App() {
  return (
    <Suspense fallback={<LazyFallback />}>
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<Page path="/about" />} />
        <Route path="/services" element={<Page path="/services" />} />
        <Route path="/contact" element={<Page path="/contact" />} />
        <Route path="/business-registration" element={<Page path="/business-registration" />} />
        <Route path="/billing-management" element={<BillingManagement />} />
        <Route path="/knowledge-centre" element={<KnowledgeCentre />} />
        <Route path="/knowledge-centre/due-dates" element={<DueDates />} />
        <Route path="/knowledge-centre/:slug" element={<ArticleDetail />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
        <Route path="/cookie-policy" element={<CookiePolicy />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/portal/login" element={<Navigate to="/login" replace />} />
        <Route path="/admin/login" element={<Navigate to="/login" replace />} />
        <Route path="/portal/reset-password" element={<ResetPasswordPage />} />

        <Route path="/services/accounting" element={<Page path="/services/accounting" />} />
        <Route path="/services/audit" element={<Page path="/services/audit" />} />
        <Route path="/services/income-tax" element={<Page path="/services/income-tax" />} />
        <Route path="/services/gst" element={<Page path="/services/gst" />} />
        <Route path="/services/roc-compliance" element={<Page path="/services/roc-compliance" />} />
        <Route path="/services/payroll" element={<Page path="/services/payroll" />} />
        <Route path="/services/financial-advisory" element={<Page path="/services/financial-advisory" />} />
        <Route path="/services/business-consultancy" element={<Page path="/services/business-consultancy" />} />
        <Route path="/services/virtual-cfo" element={<Page path="/services/virtual-cfo" />} />

        <Route path="/business-registration/proprietorship" element={<Page path="/business-registration/proprietorship" />} />
        <Route path="/business-registration/partnership-firm" element={<Page path="/business-registration/partnership-firm" />} />
        <Route path="/business-registration/llp" element={<Page path="/business-registration/llp" />} />
        <Route path="/business-registration/private-limited" element={<Page path="/business-registration/private-limited" />} />
        <Route path="/business-registration/public-limited" element={<Page path="/business-registration/public-limited" />} />
        <Route path="/business-registration/one-person-company" element={<Page path="/business-registration/one-person-company" />} />
        <Route path="/business-registration/trust" element={<Page path="/business-registration/trust" />} />
        <Route path="/business-registration/section-8" element={<Page path="/business-registration/section-8" />} />
        <Route path="/business-registration/msme" element={<Page path="/business-registration/msme" />} />
        <Route path="/business-registration/iec" element={<Page path="/business-registration/iec" />} />
        <Route path="/business-registration/dsc" element={<Page path="/business-registration/dsc" />} />
        <Route path="/business-registration/trademark" element={<Page path="/business-registration/trademark" />} />

        <Route path="*" element={<NotFound />} />
      </Route>

      <Route element={<RequireAuth roles={['client']} />}>
        <Route path="/portal" element={<ClientPortalLayout />}>
          <Route index element={<ClientDashboard />} />
          <Route path="profile" element={<ClientProfile />} />
          <Route path="profile/reset-password" element={<ClientResetPassword />} />
          <Route path="quotation" element={<Navigate to="/portal/billing/quotation" replace />} />
          <Route path="quotation/*" element={<Navigate to="/portal/billing/quotation" replace />} />
          <Route path="edit-requests" element={<EditRequestPage />} />
          <Route path="amendments">
            <Route index element={<AmendmentsPage />} />
            <Route path="new" element={<InvoiceForm docType="amendment" title="Create Amendment" />} />
            <Route path=":id" element={<InvoiceDetail />} />
            <Route path=":id/edit" element={<InvoiceForm docType="amendment" title="Edit Amendment" />} />
          </Route>
          <Route path="billing/parties" element={<PartiesPage />} />
          <Route path="billing/parties/new" element={<PartyForm />} />
          <Route path="billing/parties/:id/edit" element={<PartyForm />} />
          <Route path="gstr-2b" element={<GstComplianceGate><ClientGstr2b /></GstComplianceGate>} />
          <Route path="gst-returns" element={<GstComplianceGate><GstReturnsWorkspace /></GstComplianceGate>} />
          <Route path="gst-filing" element={<GstComplianceGate><GstFilingConfirmation /></GstComplianceGate>} />
          <Route path="billing" element={<ClientBillingLayout />}>
            <Route index element={<BillingDashboard />} />
            <Route path="quotation">
              <Route index element={<InvoiceList type="quotation" title="Quotations" newPath="/portal/billing/quotation/new" />} />
              <Route path="new" element={<InvoiceForm docType="quotation" title="Create Quotation" />} />
              <Route path=":id" element={<InvoiceDetail />} />
              <Route path=":id/edit" element={<InvoiceForm docType="quotation" title="Edit Quotation" />} />
            </Route>
            <Route path="invoices" element={<InvoiceList type="tax_invoice" title="Tax Invoices" newPath="/portal/billing/invoices/new" />} />
            <Route path="invoices/new" element={<InvoiceForm docType="tax_invoice" title="Create Tax Invoice" />} />
            <Route path="invoices/:id" element={<InvoiceDetail />} />
            <Route path="invoices/:id/edit" element={<InvoiceForm docType="tax_invoice" title="Edit Tax Invoice" />} />
            <Route path="debit-notes" element={<InvoiceList type="debit_note" title="Debit Note" newPath="/portal/billing/debit-notes/new" createLabel="+ Create Debit Note" />} />
            <Route path="debit-notes/new" element={<InvoiceForm docType="debit_note" title="Create Debit Note" />} />
            <Route path="debit-notes/:id" element={<InvoiceDetail />} />
            <Route path="debit-notes/:id/edit" element={<InvoiceForm docType="debit_note" title="Edit Debit Note" />} />
            <Route path="credit-notes" element={<InvoiceList type="credit_note" title="Credit Note" newPath="/portal/billing/credit-notes/new" createLabel="+ Create Credit Note" />} />
            <Route path="credit-notes/new" element={<InvoiceForm docType="credit_note" title="Create Credit Note" />} />
            <Route path="credit-notes/:id" element={<InvoiceDetail />} />
            <Route path="credit-notes/:id/edit" element={<InvoiceForm docType="credit_note" title="Edit Credit Note" />} />
            <Route path="bill-of-supply" element={<InvoiceList type="bill_of_supply" title="Bill of Supply" newPath="/portal/billing/bill-of-supply/new" />} />
            <Route path="bill-of-supply/new" element={<InvoiceForm docType="bill_of_supply" title="Create Bill of Supply" />} />
            <Route path="bill-of-supply/:id" element={<InvoiceDetail />} />
            <Route path="bill-of-supply/:id/edit" element={<InvoiceForm docType="bill_of_supply" title="Edit Bill of Supply" />} />
            <Route path="delivery-challan" element={<InvoiceList type="delivery_challan" title="Delivery Challan" newPath="/portal/billing/delivery-challan/new" createLabel="+ Create Delivery Challan" />} />
            <Route path="delivery-challan/new" element={<InvoiceForm docType="delivery_challan" title="Create Delivery Challan" />} />
            <Route path="delivery-challan/:id" element={<InvoiceDetail />} />
            <Route path="delivery-challan/:id/edit" element={<InvoiceForm docType="delivery_challan" title="Edit Delivery Challan" />} />
            <Route path="settings" element={<Navigate to="/portal/settings" replace />} />
            <Route path="reports" element={<Navigate to="/portal/reports" replace />} />
          </Route>
          <Route path="settings" element={<BusinessSettings />} />
          <Route path="settings/history" element={<ChangeRequestHistory />} />
          <Route path="reports" element={<ClientReportsLayout />}>
            <Route index element={<ReportsDashboard />} />
            <Route path="gst-summary" element={<GstSummaryPage />} />
            <Route path="gst-liability" element={<GstLiabilityReport />} />
            <Route path="hsn-summary" element={<HsnSummaryPage />} />
            <Route path="party-wise" element={<PartyWisePage />} />
            <Route path="party-wise/:partyId" element={<PartyDocumentDetailPage />} />
            <Route path="sales-register" element={<BillingReports defaultType="sales_register" title="Sales Register" />} />
            <Route path="outstanding" element={<OutstandingPage />} />
          </Route>
        </Route>
      </Route>

      <Route element={<RequireAuth roles={['super_admin', 'admin', 'staff']} />}>
        <Route path="/admin" element={<AdminFyProvider><AdminPortalLayout /></AdminFyProvider>}>
          <Route index element={<AdminOverview />} />
          <Route path="clients" element={<ClientsUnlockGate />}>
            <Route index element={<AdminClients />} />
            <Route path="new" element={<ClientProfileForm />} />
            <Route path=":id/edit" element={<ClientProfileForm />} />
          </Route>
          <Route path="clients/:id/billing" element={<AdminClientBilling />} />
          <Route path="billing" element={<AdminBillingClientList />} />
          <Route path="billing/:clientId" element={<AdminBillingClientDashboard />} />
          <Route path="billing/:clientId/:docType" element={<AdminBillingDocumentList />} />
          <Route path="billing/:clientId/:docType/:id" element={<AdminBillingDocPlaceholder />} />
          <Route path="clients/:id/gstr-2b" element={<AdminClientGstr2b />} />
          <Route path="gstr-2b" element={<AdminGstr2bClientPicker />} />
          <Route path="gst-returns" element={<AdminGstReturns />} />
          <Route path="gst-filing-requests" element={<AdminGstFilingRequests />} />
          <Route path="gst-filing-requests/:id" element={<AdminGstFilingReview />} />
          <Route path="edit-requests" element={<AdminEditRequestList />} />
          <Route path="edit-requests/:id" element={<AdminEditRequestDetail />} />
          <Route path="pending-approval" element={<AdminChangeRequestList />} />
          <Route path="pending-approval/:id" element={<AdminChangeRequestDetail />} />
          <Route path="configuration" element={<AdminConfiguration />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="change-requests" element={<Navigate to="/admin/pending-approval" replace />} />
          <Route path="change-requests/:id" element={<PendingApprovalIdRedirect />} />
          <Route path="staff" element={<AdminStaff />} />
          <Route path="enquiries" element={<AdminEnquiries />} />
          <Route path="articles" element={<AdminArticles />} />
          <Route path="due-dates" element={<AdminDueDates />} />
          <Route path="appointments" element={<AdminAppointments />} />
          <Route path="compliance" element={<AdminCompliance />} />
          <Route path="activity" element={<AdminActivity />} />
        </Route>
        <Route path="/admin/firm-billing" element={<AdminBillingLayout />}>
          <Route index element={<AdminBillingDashboard />} />
          <Route path="invoices" element={<AdminBillingInvoices type="tax_invoice" title="Tax Invoice/Bill of Supply" />} />
          <Route path="invoices/:id" element={<AdminInvoiceDetail />} />
          <Route path="debit-notes" element={<AdminBillingInvoices type="debit_note" title="Debit Notes" />} />
          <Route path="debit-notes/:id" element={<AdminInvoiceDetail />} />
          <Route path="credit-notes" element={<AdminBillingInvoices type="credit_note" title="Credit Notes" />} />
          <Route path="credit-notes/:id" element={<AdminInvoiceDetail />} />
          <Route path="reports" element={<AdminBillingReports />} />
          <Route path="gst-summary" element={<AdminGstSummary />} />
          <Route path="hsn-summary" element={<AdminHsnSummary />} />
        </Route>
      </Route>
    </Routes>
    </Suspense>
  );
}
