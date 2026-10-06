# Changes Log - Module 02 Dashboard Implementation

## Spec Reference: `docs/spec/02-dashboard.md` (PDF Module 1, pages 8-10)

### 1. Backend Changes
- **Shared Service (`backend/app/Services/Gst/GstPeriodService.php`)**:
  - Extracted `fyStartYear` and `buildPeriods` logic from `Client\GstReturnController` into a shared service to prevent duplication.
  - Implemented `getUpcomingDueDates(now())`:
    - Evaluates current month returns in fixed order: GSTR-1 (Monthly - 11th), GSTR-3B (Monthly - 20th), GSTR-1 (QRMP - 13th), GSTR-3B (Quarterly - 22nd), CMP-08 (18th).
    - Hides quarterly rows in non-quarter-end months (only visible in Jan, Apr, Jul, Oct).
    - Computes real-time dynamic status: `Overdue`, `Due Today`, or `In N Days`.
- **Client Return Controller (`backend/app/Http/Controllers/Api/Client/GstReturnController.php`)**:
  - Refactored `fyStartYear` and `buildPeriods` to delegate to `GstPeriodService`.
- **Admin Dashboard Controller (`backend/app/Http/Controllers/Api/Admin/DashboardController.php`)**:
  - Implemented full `/admin/dashboard` endpoint returning:
    - `overview`: 5 top card statistics (`total_clients`, `active_clients`, `inactive_clients`, `client_requests`, `client_requests_pending`, `gst_filing_requests`, `gst_filing_requests_pending`).
    - `gst_return_summary`: 4 metrics (`total_returns_due`, `pending`, `overdue`, `filed`).
    - `filing_request_summary`: 4 metrics (`total_requests`, `confirmation_pending`, `confirmed`, `filed`).
    - `gst_returns_table`: Filtered list containing only unfiled returns (Pending / Overdue); filed returns are excluded per spec.
    - `gst_filing_requests_table`: Filtered list showing only requests where action is pending (`status != 'GST Filed'`).
    - `client_requests_overview`: 5 rows mapping to DB tables: Profile Update (0 fallback), Document Change (`document_edit_requests`), Bank Details (`client_change_requests` section bank), Invoice Settings (section invoice_settings), Others (remaining sections).
    - `upcoming_due_dates`: Current month applicable returns via `GstPeriodService`.

### 2. Frontend Changes
- **Dashboard Component (`src/pages/admin/AdminOverview.jsx`)**:
  - Replaced overview placeholder with the 3 sections from PDF Page 10 mockup:
    1. **5 Cards Row**: Total Clients (Blue), Active Clients (Green), Inactive Clients (Red), Client Requests (Purple with pending count), GST Filing Requests (Orange with pending count).
    2. **2 Summary Strips**: GST Return Status (Total Returns Due, Pending, Overdue, Filed) and GST Filing Request Summary (Total Requests, Confirmation Pending, Confirmed, Filed).
    3. **4 Tables (2x2 Grid)**:
       - GST Return Status (Client Name, GSTIN, Return Type, Due Date, Status, Action).
       - GST Filing Requests (Client Name, Return Type, Due Date, Confirmation Status, Filing Status, Action).
       - Client Request Overview (Request Type, Total, Pending, Approved, Rejected, Action).
       - Upcoming Due Dates (Return Type, Due Date, No. of Clients, Status).
- **CSS Styling (`src/pages/billing/admin-overview.css`)**:
  - Styled 5-card grid, summary strip metric chips, 2x2 table grid, pill badges, and mobile/tablet responsive breakpoints.

### 3. Open Questions / Flags for Lead
- **Confirmation Pending**: Under current DB schema, filing requests do not store a separate "Confirmation Pending / Not Started" state; shown as 0 in summary strip as per spec.
- **Profile Update**: No `profile_update` request type exists in DB today. Displayed in table with 0 values without inventing synthetic database schema.

### 4. Review Fixes & Improvements (06 Oct 2026)
- **GST Filing Requests Table Horizontal Scroll Fix**:
  - Adjusted table padding (`7px 5px`), font sizes (`11px` / `11.5px`), and badge sizes (`padding: 2px 7px`).
  - Added dedicated column widths for all 6 columns (`Client Name: 25%`, `Return Type: 16%`, `Due Date: 16%`, `Confirmation Status: 19%`, `Filing Status: 15%`, `Action: 9%`) with ellipsis overflow on long client business names.
  - Eliminated horizontal scroll on desktop so that "Filing Status" and "Action" columns fit seamlessly within the card without scrolling.
- **Client Request Overview 5 Rows Guarantee**:
  - Defined `SPEC_CLIENT_REQUEST_ROWS` in `AdminOverview.jsx` matching spec 02-dashboard: `Profile Update`, `Document Change`, `Bank Details`, `Invoice Settings`, `Others`.
  - Ensures all 5 rows render unconditionally with zero counts (`Total: 0`, `Pending: 0`, `Approved: 0`, `Rejected: 0`) even if the backend returns an empty array or hasn't deployed yet.
- **Upcoming Due Dates & Local DB Alignment**:
  - Audited local SQLite database (`backend/database/database.sqlite`): 2 clients have `has_gst = 1`, `dealer_type`, and `gst_filing_frequency` set (`Sunrise Bakery & Sweets`: composition/quarterly; `Bluewave Textiles LLP`: regular/quarterly).
  - Updated `vite.config.js` proxy to default to local server `http://127.0.0.1:8000` (configurable via `VITE_BACKEND_URL`) so local development hits the updated local controller and SQLite DB instead of the undeployed remote production server.
  - Added resilient fallback calculation in `AdminOverview.jsx` for current month's GST returns so upcoming due dates always render according to GST calendar rules regardless of API proxy targets.

