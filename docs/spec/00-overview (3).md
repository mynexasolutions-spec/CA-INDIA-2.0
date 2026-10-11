# CA-India Admin Portal: Spec Overview

Shared context for every module file. Read this first, then only the one module file you are working on.

## Source
- Requirement PDF "All Module.pdf" (177 pages), split into modules. Each module restarts its footer as "Page 1 | N". Page footers may not extract cleanly, so split by PDF page ranges and keep `===== PDF PAGE N =====` markers in `mods/mod_NN.txt`.
- Module files live in `docs/spec/NN-name.md`.

## Stack
- Frontend: Vite + React 19 (repo root, `src/`)
- Backend: Laravel 13 + Sanctum (`backend/`)
- Local DB: SQLite. Prod: MySQL (`abkhanassociates`). Never touch prod DB.

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
| 3 | Billing: Client List, Client Dashboard, 6 document types (Tax Invoice, Bill of Supply, Debit Note, Credit Note, Quotation, Delivery Challan) | 25 (pp 31-55) | `05-billing.md` | spec written, all decisions settled except Email/WhatsApp (parked). Step 0 (code map) next |
| 4+ | rest | - | - | not split yet |

### Carry-forward (from 2A / 2B, not blocking Module 3)
- Feature flag `config('invoice.new_renderer')` is default false (legacy fallback). Turn on at release.
- Before deploy: `changes.md` must list every migration/backfill from 2A and 2B, and the backfills must be tested on MySQL.
- Stage 5 of 2A (Add Information modal `Information *` as textarea; Tab 1 using shared `AddressFields`): not confirmed in the 2B summary. Verify in code.
- Parked lead decisions: prod client codes `CL-0001` -> `CL-001`, Tab 3 portal password reveal, 2FA/session timeout, prod GST clients' empty Date of Registration / State Jurisdiction, logout button and user name in the admin header.
- Local bank rows are test data, no cleanup needed (decision).

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
- Shared GST due-date logic lives in `backend/app/Services/Gst/GstPeriodService.php`. Do not duplicate it.
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
- Per-client layout (4 layouts) and colour (6: Slate Blue, Charcoal Grey, Dusty Plum, Mocha Brown, Deep Teal, Antique Gold) live on `client_profiles`; `client_document_settings` holds 6 rows per client (one per document type) with layout, colour and numbering JSON. `client_subscriptions` holds subscription data (inactive subscription = fees 0 in the API, stored values kept).
- Document numbering: `InvoiceService` reads the JSON settings (prefix, separator, prefix position); allocation runs in one `lockForUpdate` transaction. Exact duplicate numbers are a hard block (422); an unused gap gives a warning (409 + `confirm_gap`). No FY reset. New settings apply only to future documents. Legacy columns are synced on save.
- PDFs use DomPDF: `DocumentThemeTokens` (6 colours x 4 tokens), `DocumentCanvasHelper`, `DocumentPayloadBuilder`, Blade per layout with shared `pdf/partials/`. Layout 3 shows a per-client tagline (`invoice_tagline`). Preview endpoint `GET /api/admin/clients/{id}/layout-preview` (throttle 30/min, saves nothing).
- Issued invoices render live (not stored PDFs). React `InvoiceDetail.jsx` is the old view and stays as is.

## Notes for Module 3 (Billing)
- Full spec and decisions: `05-billing.md`. Billing counts and lists follow the selected Financial Year by Invoice/Document Date; Cancelled counts, Deleted does not.
- Build common billing components `documentType`-driven; never hard-code "Tax Invoice".
- Quotation default numbering prefix changes `QUO` -> `QT` for new clients only.

## Git hygiene
- One branch per module. Never commit: `mods/`, `split.py`, `report.md`, `vite.config.js` (local proxy only).
- `changes.md` logs every DB change for deploy.
