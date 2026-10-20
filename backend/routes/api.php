<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\Admin\AdminBillingController;
use App\Http\Controllers\Api\Admin\AdminBillingDocumentController;
use App\Http\Controllers\Api\Admin\BillingMonitorController;
use App\Http\Controllers\Api\Admin\ClientProfileController;
use App\Http\Controllers\Api\Admin\DashboardController as AdminDashboard;
use App\Http\Controllers\Api\Admin\GstReturnController;
use App\Http\Controllers\Api\Admin\Gstr2bController;
use App\Http\Controllers\Api\Admin\Gstr3bController;
use App\Http\Controllers\Api\Admin\OpsController;
use App\Http\Controllers\Api\Client\GstReturnController as ClientGstReturnController;
use App\Http\Controllers\Api\Client\Gstr2bController as ClientGstr2bController;
use App\Http\Controllers\Api\Client\ClientCmp08Controller;
use App\Http\Controllers\Api\Client\AmendmentRequestController;
use App\Http\Controllers\Api\Client\OtherRequestController;
use App\Http\Controllers\Api\Admin\ResourceController;
use App\Http\Controllers\Api\Billing\DashboardController as BillingDashboard;
use App\Http\Controllers\Api\Billing\DocumentController;
use App\Http\Controllers\Api\Billing\MasterController;
use App\Http\Controllers\Api\Billing\ReportController;
use App\Http\Controllers\Api\Client\ChangeRequestController as ClientChangeRequestController;
use App\Http\Controllers\Api\Admin\ChangeRequestController as AdminChangeRequestController;
use App\Http\Controllers\Api\Client\DocumentEditRequestController as ClientDocumentEditRequestController;
use App\Http\Controllers\Api\Admin\DocumentEditRequestController as AdminDocumentEditRequestController;
use App\Http\Controllers\Api\Admin\MasterConfigController;
use App\Http\Controllers\Api\Admin\ClientsUnlockController;
use App\Http\Controllers\Api\Admin\LookupController;
use App\Http\Controllers\Api\Admin\ClientAdditionalInfoController;
use App\Http\Controllers\Api\Client\DashboardController as ClientDashboard;
use App\Http\Controllers\Api\Public\ContactController;
use App\Http\Controllers\Api\Public\ContentController;
use Illuminate\Support\Facades\Route;

Route::post('/contact', [ContactController::class, 'contact']);
Route::post('/newsletter', [ContactController::class, 'newsletter']);
Route::post('/appointments', [ContactController::class, 'appointment']);
Route::post('/consultations', [ContactController::class, 'consultation']);

Route::get('/articles', [ContentController::class, 'articles']);
Route::get('/articles/{slug}', [ContentController::class, 'article']);
Route::get('/categories', [ContentController::class, 'categories']);
Route::get('/due-dates', [ContentController::class, 'dueDates']);
Route::get('/home-updates', [ContentController::class, 'homeUpdates']);
Route::get('/testimonials', [ContentController::class, 'testimonials']);
Route::get('/faqs', [ContentController::class, 'faqs']);

Route::get('/billing/share/{token}', [DocumentController::class, 'share']);

Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword']);
Route::post('/auth/reset-password', [AuthController::class, 'resetPassword']);
Route::post('/auth/login/verify-otp', [AuthController::class, 'verifyLoginOtp'])->middleware('throttle:10,1');
Route::post('/auth/login/resend-otp', [AuthController::class, 'resendLoginOtp'])->middleware('throttle:6,1');
Route::post('/auth/otp/request', [AuthController::class, 'otpRequest'])->middleware('throttle:6,1');
Route::post('/auth/otp/verify', [AuthController::class, 'otpVerify'])->middleware('throttle:10,1');
Route::post('/auth/otp/reset-password', [AuthController::class, 'otpResetPassword'])->middleware('throttle:10,1');

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::post('/auth/change-password', [AuthController::class, 'changePassword']);

    Route::middleware('role.client')->group(function () {
        Route::prefix('client')->group(function () {
            Route::get('/dashboard', [ClientDashboard::class, 'index']);
            Route::get('/profile', [ClientDashboard::class, 'profile']);
            Route::put('/profile', [ClientDashboard::class, 'updateProfile']);
            Route::get('/lookup/ifsc/{ifsc}', [LookupController::class, 'ifsc'])->middleware('throttle:30,1');
            Route::get('/change-requests/current', [ClientChangeRequestController::class, 'current']);
            Route::get('/change-requests/history', [ClientChangeRequestController::class, 'history']);
            Route::post('/change-requests', [ClientChangeRequestController::class, 'store']);
            Route::post('/change-requests/assets/{field}', [ClientChangeRequestController::class, 'uploadAsset']);
            Route::get('/layout-preview', [ClientChangeRequestController::class, 'layoutPreview'])->middleware('throttle:30,1');
            Route::get('/edit-requests', [ClientDocumentEditRequestController::class, 'index']);
            Route::get('/edit-requests/lookup', [ClientDocumentEditRequestController::class, 'lookup']);
            Route::post('/edit-requests', [ClientDocumentEditRequestController::class, 'store']);
            Route::get('/amendment-requests', [AmendmentRequestController::class, 'index']);
            Route::get('/amendment-requests/lookup', [AmendmentRequestController::class, 'lookup']);
            Route::post('/amendment-requests', [AmendmentRequestController::class, 'store']);
            Route::get('/amendment-requests/{id}', [AmendmentRequestController::class, 'show']);
            Route::get('/other-requests', [OtherRequestController::class, 'index']);
            Route::post('/other-requests', [OtherRequestController::class, 'store']);
            Route::get('/other-requests/{id}', [OtherRequestController::class, 'show']);
            Route::get('/gstr3b/requests', [\App\Http\Controllers\Api\Client\Gstr3bRequestController::class, 'index']);
            Route::post('/gstr3b/requests', [\App\Http\Controllers\Api\Client\Gstr3bRequestController::class, 'store']);
            Route::post('/gstr3b/requests/{id}/accept', [\App\Http\Controllers\Api\Client\Gstr3bRequestController::class, 'accept']);
            Route::post('/gstr3b/requests/{id}/reject', [\App\Http\Controllers\Api\Client\Gstr3bRequestController::class, 'reject']);
            Route::post('/logo', [ClientDashboard::class, 'uploadLogo']);
            Route::post('/signature', [ClientDashboard::class, 'uploadSignature']);
            Route::post('/seal', [ClientDashboard::class, 'uploadSeal']);
            Route::post('/qr-code', [ClientDashboard::class, 'uploadQrCode']);
            Route::get('/documents', [ClientDashboard::class, 'documents']);
            Route::post('/documents', [ClientDashboard::class, 'uploadDocument']);
            Route::get('/documents/{id}', [ClientDashboard::class, 'downloadDocument']);
            Route::get('/compliance', [ClientDashboard::class, 'compliance']);

            // Not gated by gst.subscribed — a locked-out client still needs these to
            // populate the "GST Compliance Not Subscribed" popup itself.
            Route::get('/gst-compliance/admin-contact', [\App\Http\Controllers\Api\Client\GstComplianceAccessController::class, 'adminContact']);
            Route::post('/gst-compliance/request-access', [\App\Http\Controllers\Api\Client\GstComplianceAccessController::class, 'requestAccess']);

            // GST Compliance (GSTR-2B, GST Returns, GST Filing Confirmation) is a
            // separate subscription add-on from core Billing — gated by gst.subscribed.
            Route::middleware('gst.subscribed')->group(function () {
                Route::get('/gstr2b', [ClientGstr2bController::class, 'index']);
                Route::get('/gstr2b/export', [ClientGstr2bController::class, 'export']);
                Route::get('/gstr2b/periods', [ClientGstr2bController::class, 'periods']);
                Route::get('/gstr2b/period/{period}/invoices', [ClientGstr2bController::class, 'periodInvoices']);
                Route::get('/gstr2b/period/{period}/projected', [ClientGstr2bController::class, 'projectedIndex']);
                Route::post('/gstr2b/period/{period}/projected', [ClientGstr2bController::class, 'projectedStore']);
                Route::get('/gstr2b/period/{period}/projected/template', [ClientGstr2bController::class, 'projectedTemplate']);
                Route::post('/gstr2b/period/{period}/projected/import', [ClientGstr2bController::class, 'projectedImport']);
                Route::put('/gstr2b/period/{period}/projected/{id}', [ClientGstr2bController::class, 'projectedUpdate']);
                Route::delete('/gstr2b/period/{period}/projected/{id}', [ClientGstr2bController::class, 'projectedDestroy']);
                Route::patch('/gstr2b/invoices/{invoiceId}/match-status', [ClientGstr2bController::class, 'updateMatchStatus']);
                Route::post('/gstr2b/invoices/bulk-match-status', [ClientGstr2bController::class, 'bulkMatchStatus']);
                Route::get('/gst-returns', [ClientGstReturnController::class, 'index']);
                Route::get('/gst-compliance', [ClientGstReturnController::class, 'compliance']);

                Route::get('/gst-filing/preview', [\App\Http\Controllers\Api\Client\GstFilingController::class, 'preview']);
                Route::post('/gst-filing/request', [\App\Http\Controllers\Api\Client\GstFilingController::class, 'store']);
                Route::get('/gst-filing/requests', [\App\Http\Controllers\Api\Client\GstFilingController::class, 'index']);
                Route::get('/gst-filing/requests/{id}', [\App\Http\Controllers\Api\Client\GstFilingController::class, 'show']);
                // GST Returns workspace (GSTR-1 / GSTR-3B tabs) — Filing Periods table data source.
                Route::get('/gst-filing/periods', [\App\Http\Controllers\Api\Client\GstFilingController::class, 'periods']);
                // GSTR-1 outward supplies data — document type summary + HSN/SAC summary for a period.
                Route::get('/gst-filing/gstr1-summary', [\App\Http\Controllers\Api\Client\GstFilingController::class, 'gstr1Summary']);
                Route::get('/gst-filing/gstr3b-summary', [\App\Http\Controllers\Api\Client\GstFilingController::class, 'gstr3bSummary']);
                Route::get('/gst-filing/reminders', [\App\Http\Controllers\Api\Client\GstFilingReminderController::class, 'reminders']);

                Route::get('/cmp08/periods', [ClientCmp08Controller::class, 'periods']);
                Route::get('/cmp08/period/{period}', [ClientCmp08Controller::class, 'periodData']);
                Route::post('/cmp08/period/{period}/confirm', [ClientCmp08Controller::class, 'confirm']);
                Route::get('/cmp08/period/{period}/download', [ClientCmp08Controller::class, 'download']);
            });
        });

        Route::prefix('billing')->group(function () {
            Route::get('/dashboard', [BillingDashboard::class, 'index']);

            Route::get('/parties/gstin-lookup', [MasterController::class, 'gstinLookup']);
            Route::get('/parties', [MasterController::class, 'parties']);
            Route::post('/parties', [MasterController::class, 'storeParty']);
            Route::get('/parties/recent', [MasterController::class, 'recentParties']);
            Route::get('/parties/{id}', [MasterController::class, 'showParty']);
            Route::put('/parties/{id}', [MasterController::class, 'updateParty']);
            Route::delete('/parties/{id}', [MasterController::class, 'destroyParty']);
            Route::post('/parties/{id}/restore', [MasterController::class, 'restoreParty']);

            Route::get('/customers', [MasterController::class, 'customers']);
            Route::post('/customers', [MasterController::class, 'storeCustomer']);
            Route::put('/customers/{id}', [MasterController::class, 'updateCustomer']);
            Route::get('/hsn-sac-codes', [MasterController::class, 'hsnSacCodes']);
            Route::get('/hsn-sac-codes/verify', [MasterController::class, 'verifyHsnSac']);
            Route::get('/tds-tcs-sections', [MasterController::class, 'tdsTcsSections']);

            Route::get('/products', [MasterController::class, 'products']);
            Route::post('/products', [MasterController::class, 'storeProduct']);
            Route::put('/products/{id}', [MasterController::class, 'updateProduct']);

            Route::get('/documents', [DocumentController::class, 'index']);
            Route::post('/documents', [DocumentController::class, 'store']);
            Route::post('/documents/preview', [DocumentController::class, 'preview']);
            Route::get('/documents/next-number', [DocumentController::class, 'nextNumber']);
            Route::get('/documents/{id}', [DocumentController::class, 'show']);
            Route::put('/documents/{id}', [DocumentController::class, 'update']);
            Route::delete('/documents/{id}', [DocumentController::class, 'destroy']);
            Route::post('/documents/{id}/issue', [DocumentController::class, 'issue']);
            Route::post('/documents/{id}/convert', [DocumentController::class, 'convert']);
            Route::post('/documents/{id}/duplicate', [DocumentController::class, 'duplicate']);
            Route::post('/documents/{id}/cancel', [DocumentController::class, 'cancel']);
            Route::get('/documents/{id}/amendments', [DocumentController::class, 'amendments']);
            Route::post('/documents/{id}/payment-status', [DocumentController::class, 'setPaymentStatus']);
            Route::get('/documents/{id}/payment-log', [DocumentController::class, 'paymentLog']);
            Route::get('/documents/{id}/pdf', [DocumentController::class, 'pdf']);
            Route::post('/documents/{id}/email', [DocumentController::class, 'emailDocument']);

            Route::get('/reports', [ReportController::class, 'index']);
            Route::get('/reports/export', [ReportController::class, 'export']);
            Route::get('/reports/drill-down', [ReportController::class, 'drillDown']);
        });
    });

    Route::middleware(['role.staff', 'audit'])->prefix('admin')->group(function () {
        Route::get('/dashboard', [AdminDashboard::class, 'index']);
        Route::get('/clients/unlock-status', [ClientsUnlockController::class, 'status']);
        Route::post('/clients/unlock', [ClientsUnlockController::class, 'unlock']);
        Route::post('/clients/unlock/otp', [ClientsUnlockController::class, 'sendOtp'])->middleware('throttle:6,1');
        Route::get('/settings/security', [\App\Http\Controllers\Api\Admin\AdminSecurityController::class, 'show']);
        Route::put('/settings/security', [\App\Http\Controllers\Api\Admin\AdminSecurityController::class, 'update']);
        Route::post('/settings/secondary-password', [\App\Http\Controllers\Api\Admin\AdminSecurityController::class, 'setSecondaryPassword']);
        Route::post('/clients/lock', [ClientsUnlockController::class, 'lock']);
        Route::get('/clients', [ClientProfileController::class, 'index']);
        Route::post('/clients', [ClientProfileController::class, 'store']);
        Route::get('/gst-returns/dashboard', [GstReturnController::class, 'dashboard']);
        Route::get('/gst-returns/clients', [GstReturnController::class, 'index']);
        Route::get('/gst-returns/{clientId}/periods', [GstReturnController::class, 'clientPeriods']);
        Route::get('/gst-returns/{clientId}/review/{period}', [GstReturnController::class, 'reviewPeriod']);
        // GSTR-3B routes
        // Request Module routes
        Route::get('/requests/clients', [\App\Http\Controllers\Api\Admin\AdminRequestController::class, 'clientList']);
        Route::get('/requests/clients/{id}', [\App\Http\Controllers\Api\Admin\AdminRequestController::class, 'clientRequests']);
        Route::post('/requests/{id}/complete', [\App\Http\Controllers\Api\Admin\AdminRequestController::class, 'complete']);
        Route::post('/requests/{id}/reject', [\App\Http\Controllers\Api\Admin\AdminRequestController::class, 'reject']);
        Route::get('/requests/{id}/attachment', [\App\Http\Controllers\Api\Admin\AdminRequestController::class, 'attachment']);

        // CMP-08 routes
        Route::get('/cmp08/clients', [\App\Http\Controllers\Api\Admin\Cmp08Controller::class, 'clientList']);
        Route::get('/clients/{id}/cmp08/period/{period}', [\App\Http\Controllers\Api\Admin\Cmp08Controller::class, 'periodData']);
        Route::post('/clients/{id}/cmp08/period/{period}', [\App\Http\Controllers\Api\Admin\Cmp08Controller::class, 'saveData']);
        Route::post('/clients/{id}/cmp08/period/{period}/mark-filed', [\App\Http\Controllers\Api\Admin\Cmp08Controller::class, 'markAsFiled']);
        Route::get('/clients/{id}/cmp08/period/{period}/request', [\App\Http\Controllers\Api\Admin\Cmp08Controller::class, 'getRequest']);
        Route::post('/clients/{id}/cmp08/period/{period}/request', [\App\Http\Controllers\Api\Admin\Cmp08Controller::class, 'initiateRequest']);
        Route::post('/clients/{id}/cmp08/period/{period}/request/reject', [\App\Http\Controllers\Api\Admin\Cmp08Controller::class, 'rejectRequest']);

        Route::get('/clients/{id}/gstr3b/periods', [Gstr3bController::class, 'clientPeriods']);
        Route::get('/clients/{id}/gstr3b/period/{period}', [Gstr3bController::class, 'periodData']);
        Route::post('/clients/{id}/gstr3b/period/{period}/mark-filed', [Gstr3bController::class, 'markAsFiled']);
        Route::get('/clients/{id}/gstr3b/period/{period}/tab-data', [Gstr3bController::class, 'getTabData']);
        Route::post('/clients/{id}/gstr3b/period/{period}/tab-data', [Gstr3bController::class, 'saveTabData']);
        Route::get('/clients/{id}/gstr3b/period/{period}/request', [Gstr3bController::class, 'getRequest']);
        Route::post('/clients/{id}/gstr3b/period/{period}/request', [Gstr3bController::class, 'initiateRequest']);
        Route::post('/clients/{id}/gstr3b/period/{period}/request/reject', [Gstr3bController::class, 'rejectRequest']);

        Route::get('/gst-returns/{clientId}/b2b/{period}', [GstReturnController::class, 'b2bDocuments']);
        Route::get('/gst-returns/{clientId}/b2c/{period}', [GstReturnController::class, 'b2cDocuments']);
        Route::get('/gst-returns/{clientId}/b2c-summary/{period}', [GstReturnController::class, 'b2cStateSummary']);
        Route::post('/gst-returns/{clientId}', [GstReturnController::class, 'store']);
        Route::get('/clients/{id}', [ClientProfileController::class, 'show']);
        Route::put('/clients/{id}', [ClientProfileController::class, 'update']);
        Route::post('/clients/{id}', [ClientProfileController::class, 'update']);
        Route::delete('/clients/{id}', [ClientProfileController::class, 'destroy']);
        Route::post('/clients/{id}/password', [ClientProfileController::class, 'setPassword']);
        Route::get('/clients/{id}/additional-info', [ClientAdditionalInfoController::class, 'index']);
        Route::post('/clients/{id}/additional-info', [ClientAdditionalInfoController::class, 'store']);
        Route::put('/clients/{id}/additional-info/{infoId}', [ClientAdditionalInfoController::class, 'update']);
        Route::delete('/clients/{id}/additional-info/{infoId}', [ClientAdditionalInfoController::class, 'destroy']);
        Route::get('/clients/{id}/bank-accounts', [\App\Http\Controllers\Api\Admin\ClientBankAccountController::class, 'index']);
        Route::post('/clients/{id}/bank-accounts', [\App\Http\Controllers\Api\Admin\ClientBankAccountController::class, 'store']);
        Route::put('/clients/{id}/bank-accounts/{bankId}', [\App\Http\Controllers\Api\Admin\ClientBankAccountController::class, 'update']);
        Route::delete('/clients/{id}/bank-accounts/{bankId}', [\App\Http\Controllers\Api\Admin\ClientBankAccountController::class, 'destroy']);
        Route::get('/clients/{id}/notes', [\App\Http\Controllers\Api\Admin\ClientNoteController::class, 'index']);
        Route::post('/clients/{id}/notes', [\App\Http\Controllers\Api\Admin\ClientNoteController::class, 'store']);
        Route::put('/clients/{id}/notes/{noteId}', [\App\Http\Controllers\Api\Admin\ClientNoteController::class, 'update']);
        Route::delete('/clients/{id}/notes/{noteId}', [\App\Http\Controllers\Api\Admin\ClientNoteController::class, 'destroy']);

        Route::get('/clients/{id}/layout', [\App\Http\Controllers\Api\Admin\ClientLayoutController::class, 'show']);
        Route::get('/clients/{id}/layout-preview', [\App\Http\Controllers\Api\Admin\ClientLayoutController::class, 'preview'])->middleware('throttle:30,1');
        Route::match(['put', 'post'], '/clients/{id}/layout', [\App\Http\Controllers\Api\Admin\ClientLayoutController::class, 'update']);
        Route::get('/clients/{id}/configuration', [\App\Http\Controllers\Api\Admin\ClientConfigurationController::class, 'show']);
        Route::match(['put', 'post'], '/clients/{id}/configuration', [\App\Http\Controllers\Api\Admin\ClientConfigurationController::class, 'update']);
        Route::get('/clients/{id}/subscription', [\App\Http\Controllers\Api\Admin\ClientSubscriptionController::class, 'show']);
        Route::match(['put', 'post'], '/clients/{id}/subscription', [\App\Http\Controllers\Api\Admin\ClientSubscriptionController::class, 'update']);
        Route::get('/clients/{id}/service-access', [\App\Http\Controllers\Api\Admin\ClientServiceAccessController::class, 'show']);
        Route::match(['put', 'post', 'patch'], '/clients/{id}/service-access', [\App\Http\Controllers\Api\Admin\ClientServiceAccessController::class, 'update']);

        Route::get('/lookup/pin/{pin}', [LookupController::class, 'pin']);
        Route::get('/lookup/ifsc/{ifsc}', [LookupController::class, 'ifsc']);
        Route::get('/gst-filing-rules', [ClientProfileController::class, 'getGstFilingRules']);
        
        Route::get('/gst-filing/requests', [\App\Http\Controllers\Api\Admin\GstFilingController::class, 'index']);
        Route::get('/gst-filing/requests/{id}', [\App\Http\Controllers\Api\Admin\GstFilingController::class, 'show']);
        Route::put('/gst-filing/requests/{id}/status', [\App\Http\Controllers\Api\Admin\GstFilingController::class, 'updateStatus']);
        Route::get('/notifications', [\App\Http\Controllers\Api\Admin\AdminNotificationController::class, 'index']);
        Route::post('/notifications/read-all', [\App\Http\Controllers\Api\Admin\AdminNotificationController::class, 'markAllRead']);
        Route::post('/notifications/{id}/read', [\App\Http\Controllers\Api\Admin\AdminNotificationController::class, 'markRead']);

        Route::get('/change-requests', [AdminChangeRequestController::class, 'index']);
        Route::get('/change-requests/{id}', [AdminChangeRequestController::class, 'show']);
        Route::post('/change-requests/{id}/approve', [AdminChangeRequestController::class, 'approve']);
        Route::post('/change-requests/{id}/reject', [AdminChangeRequestController::class, 'reject']);
        Route::get('/edit-requests', [AdminDocumentEditRequestController::class, 'index']);
        Route::get('/edit-requests/{id}', [AdminDocumentEditRequestController::class, 'show']);
        Route::post('/edit-requests/{id}/approve', [AdminDocumentEditRequestController::class, 'approve']);
        Route::post('/edit-requests/{id}/reject', [AdminDocumentEditRequestController::class, 'reject']);
        Route::get('/billing/clients', [ClientProfileController::class, 'billingDirectory']);
        Route::get('/billing/client-directory', [AdminBillingController::class, 'clients']);
        Route::get('/billing/client-directory/{clientId}/dashboard', [AdminBillingController::class, 'clientDashboard']);
        Route::get('/billing/client-directory/{clientId}/documents/{docType}', [AdminBillingDocumentController::class, 'index']);
        Route::get('/billing/client-directory/{clientId}/documents/{docType}/{id}', [AdminBillingDocumentController::class, 'show']);
        Route::get('/billing/client-directory/{clientId}/documents/{docType}/{id}/pdf', [AdminBillingDocumentController::class, 'pdf']);
        Route::post('/billing/client-directory/{clientId}/documents/{docType}/{id}/cancel', [AdminBillingDocumentController::class, 'cancel']);
        Route::delete('/billing/client-directory/{clientId}/documents/{docType}/{id}', [AdminBillingDocumentController::class, 'destroy']);
        Route::patch('/billing/client-directory/{clientId}/documents/{docType}/{id}/creation-date', [AdminBillingDocumentController::class, 'updateCreationDate']);
        Route::put('/billing/client-directory/{clientId}/documents/{docType}/{id}', [AdminBillingDocumentController::class, 'update']);
        Route::get('/billing/client-directory/{clientId}/parties', [\App\Http\Controllers\Api\Admin\AdminBillingPartyController::class, 'index']);
        Route::get('/billing/client-directory/{clientId}/parties/recent', [\App\Http\Controllers\Api\Admin\AdminBillingPartyController::class, 'recent']);
        Route::get('/billing/client-directory/{clientId}/parties/{id}', [\App\Http\Controllers\Api\Admin\AdminBillingPartyController::class, 'show']);
        Route::get('/billing/tds-tcs-sections', [\App\Http\Controllers\Api\Admin\AdminBillingPartyController::class, 'tdsTcsSections']);
        Route::get('/clients/{id}/billing/dashboard', [ClientProfileController::class, 'billingDashboard']);
        Route::get('/clients/{id}/billing/export', [ClientProfileController::class, 'exportBilling']);
        Route::get('/clients/{id}/billing/zip', [ClientProfileController::class, 'downloadZip']);
        Route::post('/clients/{id}/active', [BillingMonitorController::class, 'setClientActive']);
        Route::post('/clients/{id}/reset-password', [BillingMonitorController::class, 'resetClientPassword']);
        Route::get('/clients/{id}/login-history', [BillingMonitorController::class, 'loginHistory']);
        Route::get('/clients/{id}/gstr2b', [Gstr2bController::class, 'index']);
        Route::get('/clients/{id}/gstr2b/periods', [Gstr2bController::class, 'periods']);
        Route::get('/clients/{id}/gstr2b/period/{period}', [Gstr2bController::class, 'periodDetail']);
        Route::post('/clients/{id}/gstr2b/period/{period}/adjustment', [Gstr2bController::class, 'saveAdjustment']);
        Route::get('/clients/{id}/gstr2b/period/{period}/invoices', [Gstr2bController::class, 'invoiceList']);
        Route::post('/clients/{id}/gstr2b/invoices/bulk-status', [Gstr2bController::class, 'bulkUpdateStatus']);
        Route::post('/clients/{id}/gstr2b', [Gstr2bController::class, 'upload']);
        Route::post('/clients/{id}/gstr2b/no-bills', [Gstr2bController::class, 'markNoBills']);
        Route::delete('/clients/{id}/gstr2b/{recordId}', [Gstr2bController::class, 'destroy']);
        Route::get('/clients/{id}/gstr2b/{recordId}/invoices', [Gstr2bController::class, 'invoices']);
        Route::post('/clients/{id}/gstr2b/{recordId}/invoices/bulk', [Gstr2bController::class, 'bulkStoreInvoices']);
        Route::patch('/clients/{id}/gstr2b/invoices/{invoiceId}/eligibility', [Gstr2bController::class, 'updateEligibility']);
        Route::delete('/clients/{id}/gstr2b/period/{period}/projected', [Gstr2bController::class, 'destroyProjected']);
        // Staff/Sub-User management
        Route::get('/staff', [\App\Http\Controllers\Api\Admin\StaffController::class, 'index']);
        Route::post('/staff', [\App\Http\Controllers\Api\Admin\StaffController::class, 'store']);
        Route::put('/staff/{id}', [\App\Http\Controllers\Api\Admin\StaffController::class, 'update']);
        Route::post('/staff/{id}/reset-password', [\App\Http\Controllers\Api\Admin\StaffController::class, 'resetPassword']);
        Route::delete('/staff/{id}', [\App\Http\Controllers\Api\Admin\StaffController::class, 'destroy']);
        Route::get('/staff/{id}/assignments', [\App\Http\Controllers\Api\Admin\StaffController::class, 'getAssignments']);
        Route::post('/staff/{id}/assignments', [\App\Http\Controllers\Api\Admin\StaffController::class, 'saveAssignments']);

        // Company Deletion
        Route::get('/company-deletion/clients', [\App\Http\Controllers\Api\Admin\CompanyDeletionController::class, 'clientList']);
        Route::get('/company-deletion/summary', [\App\Http\Controllers\Api\Admin\CompanyDeletionController::class, 'summary']);
        Route::post('/company-deletion/request-otp', [\App\Http\Controllers\Api\Admin\CompanyDeletionController::class, 'requestOtp']);
        Route::post('/company-deletion/resend-otp', [\App\Http\Controllers\Api\Admin\CompanyDeletionController::class, 'resendOtp']);
        Route::post('/company-deletion/verify-and-delete', [\App\Http\Controllers\Api\Admin\CompanyDeletionController::class, 'verifyAndDelete']);
        Route::get('/company-deletion/history', [\App\Http\Controllers\Api\Admin\CompanyDeletionController::class, 'history']);

        Route::get('/activity', [ResourceController::class, 'activity']);
        Route::post('/client-documents/upload', [OpsController::class, 'uploadClientDocument']);
        Route::post('/compliance/assign', [OpsController::class, 'assignCompliance']);
        Route::get('/backups', [OpsController::class, 'backups']);
        Route::post('/backups/run', [OpsController::class, 'runBackup']);

        Route::get('/billing/dashboard', [BillingMonitorController::class, 'dashboard']);
        Route::get('/billing/invoices', [BillingMonitorController::class, 'invoices']);
        Route::get('/billing/invoices/{id}', [BillingMonitorController::class, 'showInvoice']);
        Route::get('/billing/invoices/{id}/pdf', [BillingMonitorController::class, 'pdfInvoice']);
        Route::put('/billing/invoices/{id}', [BillingMonitorController::class, 'updateDocument']);
        Route::delete('/billing/invoices/{id}', [BillingMonitorController::class, 'destroyDocument']);
        Route::get('/billing/reports', [BillingMonitorController::class, 'report']);
        Route::get('/clients/{id}/reports', [BillingMonitorController::class, 'report']);

        // A client's Report Dashboard as the Admin sees it: the SAME controllers the Client Portal
        // uses (so the numbers, exports and drill-downs are identical), read-only, for one client.
        Route::get('/clients/{clientId}/billing-reports', [\App\Http\Controllers\Api\Billing\ReportController::class, 'index']);
        Route::get('/clients/{clientId}/billing-reports/export', [\App\Http\Controllers\Api\Billing\ReportController::class, 'export']);
        Route::get('/clients/{clientId}/billing-reports/drill-down', [\App\Http\Controllers\Api\Billing\ReportController::class, 'drillDown']);
        Route::get('/clients/{clientId}/billing-documents', [\App\Http\Controllers\Api\Billing\DocumentController::class, 'index']);
        Route::get('/clients/{clientId}/billing-documents/{id}/payment-log', [\App\Http\Controllers\Api\Billing\DocumentController::class, 'paymentLog']);

        // Legacy combined endpoints (kept for backward compat)
        Route::get('/master-config/hsn-sac', [MasterConfigController::class, 'hsnSacList']);
        Route::post('/master-config/hsn-sac', [MasterConfigController::class, 'hsnSacStore']);
        Route::put('/master-config/hsn-sac/{id}', [MasterConfigController::class, 'hsnSacUpdate']);
        Route::delete('/master-config/hsn-sac/{id}', [MasterConfigController::class, 'hsnSacDestroy']);
        Route::get('/master-config/tds-tcs', [MasterConfigController::class, 'tdsTcsList']);
        Route::post('/master-config/tds-tcs', [MasterConfigController::class, 'tdsTcsStore']);
        Route::put('/master-config/tds-tcs/{id}', [MasterConfigController::class, 'tdsTcsUpdate']);
        Route::delete('/master-config/tds-tcs/{id}', [MasterConfigController::class, 'tdsTcsDestroy']);

        // New per-master endpoints
        Route::post('/master-config/{master}/import', [MasterConfigController::class, 'importRows']);
        Route::get('/master-config/hsn', [MasterConfigController::class, 'hsnList']);
        Route::post('/master-config/hsn', [MasterConfigController::class, 'hsnStore']);
        Route::put('/master-config/hsn/{id}', [MasterConfigController::class, 'hsnUpdate']);
        Route::delete('/master-config/hsn/{id}', [MasterConfigController::class, 'hsnDestroy']);

        Route::get('/master-config/sac', [MasterConfigController::class, 'sacList']);
        Route::post('/master-config/sac', [MasterConfigController::class, 'sacStore']);
        Route::put('/master-config/sac/{id}', [MasterConfigController::class, 'sacUpdate']);
        Route::delete('/master-config/sac/{id}', [MasterConfigController::class, 'sacDestroy']);

        Route::get('/master-config/gst-rate', [MasterConfigController::class, 'gstRateList']);
        Route::post('/master-config/gst-rate', [MasterConfigController::class, 'gstRateStore']);
        Route::put('/master-config/gst-rate/{id}', [MasterConfigController::class, 'gstRateUpdate']);
        Route::delete('/master-config/gst-rate/{id}', [MasterConfigController::class, 'gstRateDestroy']);

        Route::get('/master-config/uqc', [MasterConfigController::class, 'uqcList']);
        Route::post('/master-config/uqc', [MasterConfigController::class, 'uqcStore']);
        Route::put('/master-config/uqc/{id}', [MasterConfigController::class, 'uqcUpdate']);
        Route::delete('/master-config/uqc/{id}', [MasterConfigController::class, 'uqcDestroy']);

        Route::get('/master-config/tds', [MasterConfigController::class, 'tdsList']);
        Route::post('/master-config/tds', [MasterConfigController::class, 'tdsStore']);
        Route::put('/master-config/tds/{id}', [MasterConfigController::class, 'tdsUpdate']);
        Route::delete('/master-config/tds/{id}', [MasterConfigController::class, 'tdsDestroy']);

        Route::get('/master-config/tcs', [MasterConfigController::class, 'tcsList']);
        Route::post('/master-config/tcs', [MasterConfigController::class, 'tcsStore']);
        Route::put('/master-config/tcs/{id}', [MasterConfigController::class, 'tcsUpdate']);
        Route::delete('/master-config/tcs/{id}', [MasterConfigController::class, 'tcsDestroy']);

        Route::get('/{resource}', [ResourceController::class, 'index']);
        Route::post('/{resource}', [ResourceController::class, 'store']);
        Route::get('/{resource}/{id}', [ResourceController::class, 'show']);
        Route::put('/{resource}/{id}', [ResourceController::class, 'update']);
        Route::delete('/{resource}/{id}', [ResourceController::class, 'destroy']);
    });
});
