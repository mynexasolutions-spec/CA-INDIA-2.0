# CA-India Admin Portal: Spec Overview

Shared context for every module file. Read this first, then only the one module file you are working on.

## Source
- Requirement PDF "All Module.pdf" (177 pages), split into modules. Each module restarts its footer as "Page 1 | N". Page footers may not extract cleanly, so split by PDF page ranges and keep `===== PDF PAGE N =====` markers in `mods/mod_NN.txt`.
- Module files live in `docs/spec/NN-name.md`.

## Stack
- Frontend: Vite + React 19 (repo root, `src/`)
- Backend: Laravel 13 + Sanctum (`backend/`)
- Local DB: SQLite. Prod: SQLite on EC2. Never touch prod DB; deploy is done by the senior.

## Global rules (apply to every module)
- Do NOT redesign existing UI. Preserve fonts, sizes, icons, spacing, alignment, colours, sidebar width, header design unless a module says otherwise.
- Do not add content the spec does not ask for (e.g. no extra dashboard widgets). Exception: see the mockup rule below.
- Reference images (mockups) in the PDF are the source of truth for VISUALS and layout only. The PDF text is the source of truth for behaviour, field lists, tab names and rules.
  - If a mockup shows something the text does not mention and does not contradict, it may stay (e.g. "Other Information" on Tab 3 of Clients).
  - If a mockup contradicts the text (e.g. extra tabs, renamed tabs, extra buttons), the TEXT wins.
  - Mockups contain small errors, do not copy them blindly (including their sample data and totals). Known ones: Overview tab, "Documents" (= Document Numbering), Forest Green / Burgundy colours, Reminder Preview button, duplicate "Layout" tab, "Document Credentials" label on p25. Billing mockups: see `05-billing.md`.
- Any DB change goes in a Laravel migration (SQLite and MySQL compatible: no raw SQL, no SQLite-only syntax) and is logged in `changes.md`.
- Work in stages. Stop after each stage and wait for "go". No work outside the planned stages.
- If something is not found in the code, say "not found". Do not guess.

## Admin shell (shared by all admin pages)
- Fixed dark-blue left sidebar, white icons/text. Main content on the right.
- Header (left): "Welcome Back to the Admin Portal".
- Header (right): Financial Year selector (e.g. 2026-27, 01 Apr 2026 - 31 Mar 2027), Refresh Data button, Last Login info, notification bell.

## Module index
| # | Module | PDF pages | Spec file | Status |
|---|--------|-----------|-----------|--------|
| 0 | Admin Portal Navigation & Dropdown Behaviour | 7 | `01-navigation.md` (+ `fix-restore-overview-cards.md`) | done, committed |
| 1 | Dashboard | 3 | `02-dashboard.md` | done, committed |
| 2A | Clients: ID, address, registration, GST filing frequency, bank, credentials, Add Information | 20 (shared with 2B) | `03-clients-2a.md` | done, committed (`modul2A`, 01519c4) |
| 2B | Clients: Document Numbering (align only), Layout, Configuration, Subscription, Service Access, document templates (4 layouts x 6 colours) | (same 20 pages) | `04-clients-2b.md` | done, committed on `feat/clients-module-2b` (Stages A-F5 and G) |
| 3 | Billing: Client List, Client Dashboard, 6 document types (Tax Invoice, Bill of Supply, Debit Note, Credit Note, Quotation, Delivery Challan) | 25 (pp 31-55) | `05-billing.md` | 3A, 3B (list, view, cancel/delete/edit creation date, full edit for Tax Invoice) done, committed. 3B-4 = admin edit (a/b). Next: tooltip-flags fix, then 3C-1 (Quotation + Delivery Challan). Email/WhatsApp parked. |
| 4+ | rest | - | - | not split yet |

### Carry-forward (from 2A / 2B, not blocking Module 3)
- Feature flag `config('invoice.new_renderer')` is default false (legacy fallback). Turn on at release.
- Before deploy: `changes.md` must list every migration/backfill from 2A and 2B, and the backfills must be tested on MySQL.
- Stage 5 of 2A (Add Information modal `Information *` as textarea; Tab 1 using shared `AddressFields`): not confirmed in the 2B summary. Verify in code.
- Parked lead decisions: prod client codes `CL-0001` -> `CL-001`, Tab 3 portal password reveal, 2FA/session timeout, prod GST clients' empty Date of Registration / State Jurisdiction, logout button and user name in the admin header.
- Local bank rows are test data, no cleanup needed (decision).
- Constitution Type list is duplicated in `ClientProfileForm.jsx` and `AdminClients.jsx` with overlapping values (Partnership / Partnership Firm, Private Limited / Private Limited Company); backend does not validate it. Module 3 works around it with alias groups in the Client List filter (no data or 2A form change). A canonical list and data migration is still a lead decision.
- QRMP: the client-portal invoice lock uses the quarterly period (`BillingPolicy::periodOf()`), so a QRMP invoice is not locked after GSTR-1 (monthly) is filed. Module 3 adds a separate admin-side check and leaves the client portal as is. Lead informed; must be in `changes.md`.
- 2A Stage 5 verified in code (Step 0): Add Information `Information *` is a textarea, Tab 1 uses shared `AddressFields`.

## Existing code map (from Antigravity, snapshot taken BEFORE Module 0/1. Some items below have changed since, e.g. the admin GST items are now a dropdown, and Clients changed in 2A/2B. Re-check in the code before relying on it.)

Routes (`src/App.jsx`):
- Admin Portal, layout `AdminPortalLayout`, base `/admin`: `/admin`, `/admin/clients` (+ `/new`, `/:id/edit`, `/:id/billing`, `/:id/gstr-2b`), `/admin/billing`, `/admin/gstr-2b`, `/admin/gst-returns`, `/admin/gst-filing-requests` (+ `/:id`), `/admin/edit-requests` (+ `/:id`), `/admin/pending-approval` (+ `/:id`, alias `/admin/change-requests`), `/admin/configuration`, `/admin/settings`, `/admin/staff`, `/admin/enquiries`, `/admin/articles`, `/admin/due-dates`, `/admin/appointments`, `/admin/compliance`, `/admin/activity`
- Firm Billing, layout `AdminBillingLayout`, base `/admin/firm-billing`: invoices, debit-notes, credit-notes (each with `/:id`), reports, gst-summary, hsn-summary
- `/admin/login` redirects to `/login`

Sidebar: `src/components/portal/PortalShell.jsx` (`<aside className="bp-sidebar">` inside `PortalFrame`). Shared by Admin and Client portals, so scope every change to admin only.
- `NavGroup` (internal): collapsible accordion with React `open` state, auto-opens when a child route is active. Used in the Client Portal for GST Compliance.
- Admin today: GST items are a dropdown (changed in Module 0). Settings is a flat link to `/admin/settings`.
- Client portal: Settings lives in the topbar avatar menu (`ClientAvatarMenu`). Do not touch.
- Logo: wrapped in `<Link to="/" className="bp-brand-link">` (about lines 502-508).

## Notes carried over from Module 0/1
- Shared GST due-date logic lives in `backend/app/Services/Gst/GstPeriodService.php`. Do not duplicate it. It has no date-to-period function: that is `BillingPolicy::periodOf()` (see Billing code map).
- QRMP is stored as `dealer_type=regular`, `gst_filing_frequency=quarterly`, `gstr1_filing_frequency=monthly`.
- `gst_filing_requests` has ONE status column: 'Pending CA Review', 'Correction Required', 'Approved for Filing', 'GST Filed'.
- Old admin pages removed from the sidebar but still reachable by URL: Enquiries, Articles, Due Dates, Appointments, Compliance, Activity, Edit Requests, Pending Approval, Firm Billing.

## Notes carried over from Module 2A
- Client page has 10 tabs: Personal Information, Business Information, Registration & Compliance, Bank Account Details, Document Numbering, Client Login Credentials, Layout, Configuration, GST Filing Frequency, Subscription. No Overview tab.
- Registration Type (Tab 3) is the master. Dealer Type is read-only. Tab 9 editable fields: Opt-Out and Applicable From only.
- GST toggle works only in Edit mode. OFF keeps GSTIN/PAN but nulls `dealer_type`, `registration_type` and the filing frequencies. The dashboard only picks clients with `has_gst = true`.
- Applicable From is required when GST is ON. `GstPeriodService`: `applicable_from` null = all periods applicable; earlier periods are Non-Applicable. Existing clients backfilled to 2026-04-01.
- "Other Information" stays (Tab 1 and Tab 3 share `client_additional_infos`).
- Edit / Save / Cancel pattern, success popup and client tab structure are reused by later modules.

## Notes carried over from Module 2B
- Per-client layout (4 layouts) and colour (6: Slate Blue, Charcoal Grey, Dusty Plum, Mocha Brown, Deep Teal, Antique Gold) live on `client_profiles`; `client_document_settings` holds 6 rows per client (one per document type) with layout, colour and watermark flag (unique per client + document_type). The numbering JSON is NOT there: it lives on `client_profiles.document_numbering_settings`. `client_subscriptions` holds subscription data (inactive subscription = fees 0 in the API, stored values kept).
- Document numbering: `InvoiceService` reads the JSON settings (prefix, separator, prefix position); allocation runs in one `lockForUpdate` transaction. Exact duplicate numbers are a hard block (422); an unused gap gives a warning (409 + `confirm_gap`), but only when saving Tab 5 settings (`ClientProfileController::validateDocumentNumberingSettings`), not on invoice create/issue. No FY reset. New settings apply only to future documents. Legacy columns are synced on save.
- PDFs use DomPDF: `DocumentThemeTokens` (6 colours x 4 tokens), `DocumentCanvasHelper`, `DocumentPayloadBuilder`, Blade per layout with shared `pdf/partials/`. Layout 3 shows a per-client tagline (`invoice_tagline`). Preview endpoint `GET /api/admin/clients/{id}/layout-preview` (throttle 30/min, saves nothing).
- Issued invoices render live (not stored PDFs). React `InvoiceDetail.jsx` is the old view and stays as is.

## Billing code map (Step 0 / 0b, 11 Oct 2026)
- All six document types share table `commercial_documents` (model `CommercialDocument`), column `type`; line items in `document_line_items`. `status` is a plain string: draft, issued, paid, partial, cancelled (no Active / Deleted today). No `deleted_at`, no `cancelled_by`; `cancelled_at` and `cancellation_reason` exist. Amounts are stored positive. DC fields (`eway_bill_no`, vehicle, transporter...) exist; there is no Remarks column (`notes` is closest).
- Documents store only `customer_id` (nullOnDelete). Email/mobile/GSTIN live on `customers` (`email`, `phone`, `gstin`, `gst_status`). Customers belong to exactly one client. No snapshot on the document.
- Numbering: `InvoiceService::allocateNextNumber()` (lockForUpdate on `client_profiles`, counter columns per type, JSON in `client_profiles.document_numbering_settings`). DB unique `commercial_documents(client_profile_id, type, number)`. `BillingPolicy::assertUniqueNumber` checks per client across all types and is called from create, issue and adminUpdate, not from allocation. Quotation fallback prefix `QUO` is in `InvoiceService::resolveNumberingConfig` only; legacy column default and draft prefix are already `QT`.
- GST filed state: `gst_filing_requests` (client confirmation workflow; has `filing_date`, `ack_no`, pivot `gst_filing_request_document`) and `client_gst_returns` (tax_period `YYYY-MM` or `YYYY-Qn`, return_type GSTR1/GSTR3B/CMP08/GSTR4, status `filed`, `filed_on`, `ack_no`). `Admin\GstFilingController::updateStatus` upserts `client_gst_returns` when a request becomes "GST Filed"; `Admin\GstReturnController::store` can also toggle/delete rows, so the two can drift. `BillingPolicy::isPeriodFiled` / `assertNotLocked` use `client_gst_returns`.
- Filing period: `BillingPolicy::periodOf()` uses `gst_filing_frequency` only (QRMP gets quarterly) and every caller passes `created_at`, deliberately (back-dated Document Date must not move a bill to another period).
- Client-portal billing (`/api/billing/*`, `Billing\DocumentController`, UI in `src/pages/billing/`) lists by `created_at`, shows drafts, excludes cancelled by default. Admin billing (`BillingMonitorController`, `ClientProfileController::billingDirectory/billingDashboard`) is tax_invoice + issued only and not client-scoped. No admin list/view exists for Bill of Supply, Quotation, Delivery Challan.
- Roles: super_admin / admin / staff all pass `role.staff` and behave identically on billing routes; no per-feature permissions. `audit` middleware logs method, path, status (no body); `BillingMonitorController::destroyDocument` also writes `ActivityLog` `deleted_document`.
- Admin header Financial Year (`AdminTopbarControls` in `PortalShell.jsx`) is local state only; nothing reads it. Client portal has a real context (`ClientPortalCtx`), do not touch.
- PDF: layouts 1-4 + shared partials, one layout for all six types (per-type output not verified). `INVOICE_NEW_RENDERER` is true in local `.env`, default false in code.
- Mail: `MAIL_MAILER=log`, no Mailable classes, `Mail::raw` in `DocumentController::emailDocument` (client portal only; PDF attachment not confirmed). WhatsApp: `wa.me` links only, client portal. No admin-side email/WhatsApp.
- Scheduler: `routes/console.php` registers only `backup:run`. No cron documentation.
- B2B/B2C is derived from the customer: `gst_status='registered'` and a `gstin` = B2B, otherwise B2C (`Customer` model).
- Update (after 3A/3B): new admin endpoints under /api/admin/billing/client-directory/{clientId}/... (documents, parties) and /api/admin/billing/tds-tcs-sections exist, open for tax_invoice only (other 5 types return 422 until 3C). Admin lock logic is `AdminBillingLockService`; `BillingPolicy::periodOf()/isPeriodFiled()` are untouched. Legacy /api/admin/billing/clients and old pickers are untouched.

## Notes for Module 3 (Billing)
- Full spec and decisions: `05-billing.md`. Billing counts and lists follow the selected Financial Year by Invoice/Document Date; Cancelled counts, Deleted does not. GST lock/status uses the creation date (`created_at`), see Decision 2.
- Build common billing components `documentType`-driven; never hard-code "Tax Invoice".
- Quotation default numbering prefix changes `QUO` -> `QT` for new clients only.

## Git hygiene
- One branch per module. Never commit: `mods/`, `split.py`, `report.md`, `vite.config.js` (local proxy only).
- `changes.md` logs every DB change for deploy.
