# CA-India Admin Portal: Spec Overview

Shared context for every module file. Read this first, then only the one module file you are working on.

## Source
- Requirement PDF "All Module.pdf" (177 pages), split into modules. Each module restarts its footer as "Page 1 | N".
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
  - Mockups contain small errors, do not copy them blindly. Known ones: Overview tab, "Documents" (= Document Numbering), Forest Green / Burgundy colours, Reminder Preview button, duplicate "Layout" tab, "Document Credentials" label on p25.
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
| 2A | Clients: ID, address, registration, GST filing frequency, bank, credentials, Add Information | 20 (shared with 2B) | `03-clients-2a.md` | implemented, audited in 4 stages, committed. Leftovers open (see below) |
| 2B | Clients: Document Numbering (align only), Layout, Configuration, Subscription, Service Access, document templates (4 layouts x 6 colours) | (same 20 pages) | `04-clients-2b.md` | spec written, Step 0 (map) next |
| 3+ | rest | - | - | not split yet |

### 2A leftovers (not blocking 2B)
- Browser test of the 2A stages, Module 1 dashboard regression, and a GST-OFF client opened in GST Returns, client portal and filing requests (null `dealer_type` must not error).
- Bank cleanup: fake local `client_bank_accounts` rows AND the profile bank fields, together (otherwise the primary-account sync re-creates them).
- Stage 5: Add Information modal needs `Information *` as a textarea; Tab 1 should use the shared `AddressFields` component.
- Verify: persistent client header on every tab; client list page; `GstPeriodService` treats periods before `applicable_from` as Non-Applicable; existing clients' `applicable_from` backfill (decision: 01/04/2026; null must behave as "applies to all periods").
- Open Module 1 item: logout button and user name in the admin header.

## Existing code map (from Antigravity, snapshot taken BEFORE Module 0/1. Some items below have changed since, e.g. the admin GST items are now a dropdown, and Clients changed in 2A. Re-check in the code before relying on it.)

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
- Applicable From is required when GST is ON.
- "Other Information" stays (Tab 1 and Tab 3 share `client_additional_infos`).
- Document Numbering (Tab 5) was already built during 2A. 2B only aligns it to the spec, no rebuild.
- Edit / Save / Cancel pattern, success popup and client tab structure from 2A are reused by 2B.

## Git hygiene
- One branch per module. Never commit: `mods/`, `split.py`, `report.md`, `vite.config.js` (local proxy only).
- `changes.md` logs every DB change for deploy.
