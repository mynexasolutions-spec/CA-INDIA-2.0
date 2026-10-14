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

---

# Changes Log - Module 2A (Clients, Part 2A) - Stage A Backend Implementation

## Spec Reference: `docs/spec/03-clients-2a.md` (PDF Module 2, pages 11-30)

### 1. Migrations & Database Changes
- **Migration `2026_10_07_000000_create_client_id_sequences_table.php`**:
  - Created `client_id_sequences` table with `id`, `name` (unique), `last_number` (unsigned big integer), timestamps.
  - Backfilled existing `client_profiles.client_code`:
    - Row 1 -> `CL-001`
    - Row 2 -> `CL-002`
    - Row 3 -> `CL-003`
    - Row 4 -> `CL-004`
  - Seeded `client_id_sequences` with `name = 'clients'`, `last_number = 4`.
- **Migration `2026_10_07_000100_update_client_profiles_and_users_for_module_2a.php`**:
  - `client_profiles`: added `applicable_from` (date, nullable), `contact_person_name`, `designation`, `gender`, `address_line_1`, `address_line_2`, `registration_type`, `comm_same_as_above` (boolean default true), `comm_address_line_1`, `comm_address_line_2`, `comm_city`, `comm_state`, `comm_state_code`, `comm_pincode`, `comm_country`.
  - Backfilled existing clients: `applicable_from` set to `2026-04-01`, `address_line_1` copied from existing `address` (preserving `address`), `registration_type` synchronized from `dealer_type`, `contact_person_name` populated from `client_name`.
  - `users`: added `password_updated_at` (timestamp, nullable), `password_updated_by` (string, nullable).
- **Migration `2026_10_07_000200_create_client_additional_infos_table.php`**:
  - Created `client_additional_infos` table with `id`, `client_profile_id` (foreign key cascade on delete), `information` (string max 255), `remarks` (text max 1000), `created_at`, `updated_at`.

### 2. Backend Services & Logic
- **Monotonic Client ID Service (`backend/app/Services/Client/ClientIdService.php`)**:
  - Implemented `generateNext()` running in an atomic database transaction with row-level lock on `client_id_sequences`.
  - Increments `last_number` by 1 and formats as `CL-NNN` (e.g. `CL-001` through `CL-999`, then `CL-1000`). Never uses `count()+1` or `max(id)+1`, and never rewinds.
- **Lookup Service (`backend/app/Services/Lookup/LookupService.php`)**:
  - Single backend service for external lookups:
    - PIN Code: Calls `api.postalpincode.in` with 30-day cache. Normalizes Division "New Mumbai" to City "Navi Mumbai" per spec checklist. Graceful fallback on failure.
    - IFSC Code: Calls `ifsc.razorpay.com` with 30-day cache. Returns bank name, branch, city, state. Graceful fallback on failure.
- **`GstPeriodService.php` & `DashboardController.php` Alignment**:
  - Updated `GstPeriodService::buildPeriods()` to accept `$applicableFrom`.
  - Added `GstPeriodService::isPeriodApplicable()`: periods before `applicable_from` are flagged `is_applicable: false`, `status: 'Non-Applicable'`.
  - Updated `getUpcomingDueDates()` and `DashboardController::index()` to only evaluate periods on or after `applicable_from`.
- **Add Information API (`backend/app/Http/Controllers/Api/Admin/ClientAdditionalInfoController.php`)**:
  - Endpoints for `GET`, `POST`, `PUT`, `DELETE` at `/api/admin/clients/{id}/additional-info`.
  - Validates `information` (max 255) and `remarks` (max 1000). Updates parent `client_profiles.updated_at` on every change.
- **Password Set/Reset API & Auth Metadata Tracking**:
  - Added `POST /api/admin/clients/{id}/password` in `ClientProfileController`: admin sets or generates temporary password; password is never displayed again or returned in API, hashed with Bcrypt, updates `password_updated_at` and `password_updated_by = 'admin'`, touches `$profile`.
  - Updated `AuthController` (`resetPassword`, `otpResetPassword`, `changePassword`) to set `password_updated_by = 'client'`.
  - `ClientProfileController::show()` returns `password_updated_at` and `password_updated_by`.
- **Client Profile Store/Update**:
  - `store()` strictly generates client code via `ClientIdService::generateNext()`.
  - `update()` enforces client code as strictly read-only (`unset($data['client_code'])`).
  - `normalizeGstFields()` keeps `registration_type` and `dealer_type` synchronized.

---

## Stage B: Step 3 (Shared Address Component & Success Popups)

### 1. Frontend Components
- **`src/data/countries.js`**:
  - Full countries list with 'India' as the default first entry.
- **`src/components/AddressFields.jsx`**:
  - Reusable address component supporting both primary address and communication address (via `prefix` prop, e.g. `comm_`).
  - Fields: Address Line 1 *, Address Line 2, Country * (dropdown with default 'India'), State * (StateSelect dropdown when India, text input when non-India), PIN Code * (numeric 6-digit input), City * (auto-fetched on PIN lookup).
  - Backend integration: triggers `GET /api/admin/lookup/pin/{pin}` via internal `api()` client when PIN is 6 digits.
  - Graceful fallback: on invalid/not found PIN, leaves City empty and displays error validation message ("Invalid or unknown PIN code. City must be entered manually."), allowing manual city entry.
  - Non-India support: skips PIN lookup and leaves City and State as manual text fields.
  - Supports `disabled` / `readOnly` modes for View vs Edit modes.
- **`src/components/ClientCreateSuccessModal.jsx`**:
  - New Client creation success modal matching PDF page 30 mockups.
  - Features green circular checkmark icon, "Client added successfully." title, displays generated Client ID (e.g. `CL-005`) and Client Name.
  - Actions: `Close` (outline button) and `Go to Client Details` (primary button).
- **`src/components/ClientSaveSuccessModal.jsx`**:
  - Existing Client edit save modal matching PDF page 30 mockups.
  - Features green circular checkmark icon, "Changes saved successfully." title, and a single `OK` button.

---

## Stage C: Step 4a (Persistent Client Header, 10-Tab Structure & Edit/Save/Cancel Engine)

### 1. Frontend Refactor (`src/pages/admin/ClientProfileForm.jsx`)
- **Persistent Client Header (Module 2A - Section A)**:
  - Header displays: Client Name, Client ID (`CL-NNN`), Active/Inactive badge, Constitution, GSTIN, Mobile, Email, and Last Updated formatted date (`DD MMM YYYY`).
  - Persistent across all 10 tabs for existing clients.
- **10-Tab Structure (Module 2A - Section A)**:
  - Exact spec order:
    1. Personal Information (`personal`)
    2. Business Information (`business`)
    3. Registration & Compliance (`registration`)
    4. Bank Account Details (`bank`)
    5. Document Numbering (`numbering`)
    6. Client Login Credentials (`credentials`)
    7. Layout (`layout` - Module 2B placeholder)
    8. Configuration (`configuration` - Module 2B placeholder)
    9. GST Filing Frequency (`gst-frequency` - Stage D placeholder)
    10. Subscription (`subscription` - Module 2B placeholder)
  - Active tab highlighted in solid blue (`#2563eb`) with white text and icon.
  - Controlled via URL search param `?tab=...` for bookmarkable tabs and seamless navigation.
- **State & Edit/Save/Cancel Engine (Module 2A - Section H)**:
  - **Existing Clients**: Form loads in **read-only / View mode** by default (`isEditing = false`).
  - Clicking **Edit** switches to edit mode (`isEditing = true`).
  - Clicking **Cancel**:
    - If unsaved changes are present, displays `DiscardChangesModal` ("*Are You Sure You Want to Cancel?*").
    - Confirmed cancel reverts fields back to `originalForm` snapshot and exits edit mode.
  - Clicking **Save Changes**: validates, saves via `PUT /api/admin/clients/{id}`, updates `updated_at`, restores read-only mode, and displays `ClientSaveSuccessModal` ("*Changes saved successfully.*").
  - **New Clients**: Starts in edit mode (`isEditing = true`). Client ID is read-only placeholder ("Auto-generated upon save"). Saving triggers `POST /api/admin/clients` and displays `ClientCreateSuccessModal` with generated `CL-NNN` and Client Name.
  - **Client ID**: Read-only everywhere, strictly disabled in View and Edit modes.
- **Shared Address Component Integration**:
  - Personal Information tab integrates the new `AddressFields` component with PIN lookup and India/non-India country handling.

---

## Client Management List Page Alignment (`src/pages/admin/AdminClients.jsx`)
- **Header & Action**:
  - Displays title `"Client Management"` with description `"View, manage and maintain all your clients in one place."` and solid blue `+ Add New Client` button on top right.
- **Stat Cards**:
  - Rebuilt the 3 cards matching exact PDF p11 mockup colors sampled from PDF:
    - **Total Clients**: Ice-blue tint background (`#e4f4f3`, border `#bce6e4`), solid royal-blue circle (`#285bd1`) with white Users icon + count.
    - **Active Clients**: Mint-green tint background (`#ddfdf2`, border `#bbf7d0`), solid forest-green circle (`#00734a`) with white UserCheck icon + count.
    - **Inactive Clients**: Rose-pink tint background (`#fae7e9`, border `#fecaca`), solid crimson-red circle (`#ec0a3a`) with white UserX icon + count.
- **Filter Bar**:
  - Card with search input (magnifying glass icon, "Search clients..."), "All Status" dropdown, "All Constitution" dropdown, "All GST Status" dropdown, solid blue "Search" button, and outline "Reset" button.
- **Table**:
  - Columns: `Client ID`, `Client Name`, `Constitution`, `PAN`, `GSTIN`, `Mobile`, `Status`, `Last Updated`, and `Action`.
  - Balanced column widths with fixed layout to prevent horizontal scrollbar on desktop.
  - Sort arrows toggle column ordering (asc/desc) across all fields.
  - Status rendered as rounded pills (mint-green `#ddfdf2` / text `#00734a` for `Active`, rose-pink `#fae7e9` / text `#ec0a3a` for `Inactive`).
  - Single `Manage` button on each row linking to `/admin/clients/{id}/edit`.
- **Pagination Footer**:
  - Displays `"Showing 1 to 10 of N clients"` with interactive `< 1 2 ... >` page buttons.
- **Backend**:
  - Updated `ClientProfileController::index()` to support `gst_status` filtering, sorting by all table columns (`pan`, `gstin`, `mobile`, `constitution_type`, `client_code`, etc.), and `per_page=10` pagination.

---

## Stage D: Step 4b (Tab Content Implementation)

### 1. Backend Changes
- **`GstPeriodService.php` (`backend/app/Services/Gst/GstPeriodService.php`)**:
  - Added `getFilingRules(?string $dealerType, ?string $optOut, mixed $applicableFrom)`:
    - Strictly derives return types, frequencies, due dates, remarks, and active/disabled status per Government GST rules.
    - Regular Monthly: GSTR-1 (Monthly - 11th), GSTR-2B (Monthly - 14th), GSTR-3B (Monthly - 20th). QRMP and CMP-08 are disabled.
    - Regular Quarterly (QRMP): GSTR-1 QRMP (Monthly IFF - 13th), GSTR-2B (Quarterly - 14th), GSTR-3B (Quarterly - 22nd). Monthly regular GSTR-1 and CMP-08 are disabled.
    - Composition Scheme: CMP-08 (Quarterly - 18th). GSTR-1, GSTR-2B, and GSTR-3B are disabled with "Not applicable for Composition scheme".
- **`ClientProfileController.php` & Routes (`backend/routes/api.php`)**:
  - Added `GET /api/admin/gst-filing-rules`: calls `GstPeriodService::getFilingRules()` with query params (`dealer_type`, `opt_out`, `applicable_from`).
  - Synced client save logic to strictly derive `dealer_type`, `gst_filing_frequency`, and QRMP frequencies from `registration_type` and `opt_out`.

### 2. Frontend Components
- **`src/components/AddInformationModal.jsx`**:
  - Reusable modal for adding and editing client other information records.
  - Fields: `Information *` (max 255 chars, character counter), `Remarks *` (max 1000 chars, character counter).
  - Handles API integration via `/api/admin/clients/{id}/additional-info` (POST/PUT).
- **`src/components/SetPasswordModal.jsx`**:
  - Dedicated admin password set/reset modal per security spec.
  - Generates secure random 12-char passwords with copy button, or allows entering a custom password (min 8 chars).
  - Prominent security notice: password is encrypted on submission, never stored readable, and never shown again.
  - Submits to `POST /api/admin/clients/{id}/password` and updates password tracking metadata.

### 3. Client Profile Form Enhancements (`src/pages/admin/ClientProfileForm.jsx`)
- **Tab 1: Personal Information**:
  - Added contact person fields: Contact Person Name * (mandatory), Designation, Gender (dropdown: Select, Male, Female, Other), Date of Birth, Mobile Number * (10 digits), Alternate Mobile, Email Address * (mandatory), Alternate Email.
  - Communication Address:
    - Checkbox "Same as Registered Address" (`comm_same_as_above`).
    - When checked: displays formatted registered office address preview with notice.
    - When unchecked: renders second `AddressFields` instance with `prefix="comm_"`.
  - Other Information (Add Information section):
    - Table with columns: `S.No`, `Information Type`, `Remarks`, `Updated On`, `Action` (Edit, Delete).
    - `+ Add Information` button opens `AddInformationModal`.
    - Edit action opens modal prefilled; Delete action prompts confirmation and deletes via API.
    - Updates client `updated_at` on every change.
- **Tab 3: Registration & Compliance**:
  - Added Master `Registration Type *`: dropdown (`Regular`, `Composition`).
  - Added derived read-only `Dealer Type`: "Regular Dealer" / "Composition Dealer" based on master registration type.
  - Added `Applicable From *`: date field (defaults to `2026-04-01`, editable).
  - Integrated with composition rate (when composition) and all compliance portal credentials.
- **Tab 4: Bank Account Details**:
  - Added IFSC verification flow: 11-digit IFSC code with `Verify IFSC` button calling `/api/admin/lookup/ifsc/{ifsc}`. Auto-populates `Bank Name` and `Branch Name`, displays verified success indicator, and allows manual fallback on failure.
  - Added `Account Type` dropdown: `Current Account`, `Savings Account`, `Cash Credit`, `Overdraft`.
  - Fields: Bank Name, Branch Name, Account Number, Account Holder Name, SWIFT Code, UPI ID.
- **Tab 6: Client Login Credentials**:
  - Read-only Client ID (`CL-NNN`) and login email (`@abkhanassociates.com`).
  - For existing clients: displays Password Authentication Status card showing `Password Last Updated` date/time and `Updated By` (`ADMIN` / `CLIENT`), with `Set / Reset Password` button opening `SetPasswordModal`.
  - For new clients: displays initial password creation field.
  - Passwords are never displayed or stored in plaintext.
- **Tab 9: GST Filing Frequency**:
  - Displays read-only `Dealer Type` badge and `Applicable From` date.
  - Added `Opt-Out *` selector (`Select`, `Monthly`, `Quarterly`):
    - Composition Scheme is fixed to `Quarterly`.
    - Regular Dealer can choose `Monthly` or `Quarterly` (QRMP scheme).
  - Dynamic Returns Table:
    - Fetches rules dynamically from `GstPeriodService` via `/api/admin/gst-filing-rules`.
    - Columns: `Return Type`, `Frequency`, `Due Date`, `Remark`, `Status`.
    - 5 Returns: GSTR-1 (Monthly), GSTR-1 (Monthly - QRMP), GSTR-2B, GSTR-3B, CMP-08.
    - Non-applicable / disabled rows are greyed out with muted badges.
    - Government rules disclaimer displayed at bottom.

### 4. Review Fixes & Improvements
- **Bank IFSC Lookup Auto-Fill Fix (`LookupService.php` & `ClientProfileForm.jsx`)**:
  - Razorpay IFSC response key mapping resolved: Backend now returns unified aliases (`bank_name`, `bank`, `branch`, `bank_branch`, `swift_code`).
  - Frontend `handleVerifyIfsc` extracts `data.bank_name || data.bank || data.BANK` and auto-populates `Bank Name`, `Branch Name`, and `SWIFT Code` seamlessly upon clicking "Verify IFSC".
- **Manage Client UI Layout Alignment with PDF Page 11 Screenshot (`media_1791364884333.png`)**:
  - **Persistent Client Header**:
    - Building icon box updated to solid navy (`#0a3d82`) with clean white SVG icon.
    - Added green `Active` status pill beside `Client ID: CL-001`.
    - 5 metadata columns (`Constitution`, `GSTIN`, `Mobile`, `Email`, `Last Updated`) structured with subtle vertical dividing borders (`borderRight: 1px solid #e2e8f0`).
  - **10-Tab Bar**:
    - Replaced horizontal scroll tabs with a 10-column desktop grid (`gridTemplateColumns: repeat(10, minmax(75px, 1fr))`) of vertical card buttons.
    - Each button contains centered top icon and centered bottom text label.
    - Active tab highlighted in ice-blue (`#edf5fd`) with solid blue border (`1.5px solid #2563eb`) and blue text/icon.
  - **Tab 1 Content Header**:
    - Circular user icon container with `Personal Information` title and descriptive subtitle.
  - **Section 1: Contact Person Details**:
    - Person icon header with 4-column desktop layout (`Contact Person Name`, `Designation`, `Mobile Number`, `Alternate Mobile`, `Email Address`, `Alternate Email`, `Date of Birth`, `Gender`).
  - **Section 2: Address Details**:
    - Map pin icon header with split 2-column layout (~62% Left, ~38% Right).
    - Left side: Registered address fields (`Address Line 1`, `City`, `Pincode` with auto-lookup, `Address Line 2`, `Country`, `State`).
    - Right side: Communication address box with `Same as above` checkbox and formatted multi-line address preview.
  - **Section 3: Other Information**:
    - Info circle icon header with blue `+ Add` button.
    - Table with columns `S. No.`, `Information Type`, `Remarks`, `Updated On`, and `Action` (blue edit pencil & red delete trash icons).
  - **Bottom Action Bar**:
    - Right-aligned buttons: `Cancel` (white outline), `Edit` (blue), and `Save Changes` (blue).
- **Existing Clients Constitution DB Backfill**:
  - Updated existing clients in `client_profiles` table:
    - `CL-001` (`Demo Trading Pvt Ltd` / `ABC Pvt. Ltd.`): `constitution_type = 'Private Limited'`, `mobile = '9876543210'`, `email = 'info@abcpl.com'`.
    - `CL-002` (`A B KHAN & ASSOCIATES`): `constitution_type = 'Partnership Firm'`, `mobile = '8286681960'`, `email = 'contact@abkhanassociates.com'`.
    - `CL-003` (`Sunrise Bakery & Sweets` / `Meera Kulkarni`): `constitution_type = 'Proprietorship'`, `mobile = '9876500002'`, `email = 'meera@sunrisebakery.com'`.
    - `CL-004` (`Bluewave Textiles LLP` / `Rohan Deshmukh`): `constitution_type = 'LLP'`, `mobile = '9876543210'`, `email = 'rohan@bluewave.com'`.
- **Design System Typography, Font Colors & Icons Alignment with Screenshot (`media_1791367655840_77951183.png`)**:
  - **Headers & Titles**:
    - Page Title `Manage Client` updated to corporate royal blue (`#1d4ed8`, font weight 700).
    - Card Title `Personal Information` updated to `#1d4ed8`.
    - Section Headings (`Contact Person Details`, `Address Details`, `Other Information`, `Communication Address`) aligned to solid vibrant blue (`#2563eb`).
    - All tab headings across Tabs 2 through 10 (`Business Details`, `Registration & Compliance Details`, `Bank Account Details`, `Document Numbering`, `Client Login Credentials`, `Layout Configuration`, `Client Configuration`, `GST Filing Frequency & Schedule`, `Client Subscription`) unified to `#1d4ed8`.
  - **Icons & Badges**:
    - Section header icons set to matching vibrant blue (`#2563eb`).
    - Tab 1 header circular badge styled with solid blue background (`#2563eb`) and crisp white SVG icon.
    - Persistent Client Header icon box styled in soft ice-blue (`#eff6ff`, border `1px solid #dbeafe`) with dark blue building icon (`#1e40af`).
    - Client Name styled in bold navy (`#1e3a8a`, 16.5px, 700 weight).
    - Status badge styled in fresh mint green (`#dcfce7`, text `#15803d`).
    - Metadata values styled in solid navy (`#1e3a8a`), labels in slate (`#64748b`).
    - Tab bar icons: Active icon rendered in royal blue (`#2563eb`) with ice-blue card background (`#edf5fd`) and border (`1.5px solid #2563eb`); Inactive icons rendered in slate (`#475569`).
  - **Form Fields & Buttons**:
- **Registration & Compliance Tab Transformation (Matching PDF Page 16 `media_1791368577817_8276e197.png`)**:
  - **Database Migration (`2026_10_07_000300_add_registration_details_to_client_profiles_table.php`)**:
    - Added columns to `client_profiles` table: `pan_status`, `name_as_per_pan`, `pan_allotment_date`, `pan_enabled`, `gst_status`, `gst_registration_date`, `state_jurisdiction`, `gst_enabled`, `tan_status`, `tan_allotment_date`, `tan_enabled`, `cin_incorporation_date`, `cin_certificate_no`, `cin_incorporation_place`, `cin_enabled`, `udyam_enterprise_type`, `udyam_registration_date`, `udyam_status`, `udyam_enabled`, `shop_act_issuing_authority`, `shop_act_registration_date`, `shop_act_status`, `shop_act_enabled`, `fssai_no`, `fssai_license_type`, `fssai_registration_date`, `fssai_status`, `fssai_enabled`, `iec_registration_date`, `iec_status`, `iec_enabled`, `ptrc_state`, `ptrc_registration_date`, `ptrc_status`, `ptrc_enabled`, `ptec_no`, `ptec_state`, `ptec_registration_date`, `ptec_status`, `ptec_enabled`, `tan_portal_username`, `it_portal_username`.
    - Updated Eloquent model `ClientProfile` `$fillable` array and `$casts` for all booleans and dates.
    - Updated `ClientProfileController` `validatePayload` and `profileFields` to securely save all registration attributes.
  - **Modular 3-Column Card Layout (`ClientProfileForm.jsx`)**:
    - Transformed Tab 3 (`registration`) into a 3-column responsive card grid matching PDF Page 16:
      1. `PAN Details` (PAN, Status, Name as per PAN, Date of Allotment + Enable toggle).
      2. `GST Registration Details` (GSTIN, Registration Type, GST Status, Date of Reg, State Jurisdiction + Enable toggle).
      3. `TAN Details` (TAN, Status, Date of Allotment + Enable toggle).
      4. `CIN Details` (CIN, Date of Incorporation, Certificate No, Place of Incorporation + Enable toggle).
      5. `UDYAM Registration` (UDYAM Number, Enterprise Type, Date of Reg, Status + Enable toggle).
      6. `Shop & Establishment` (Shop Act No, Issuing Authority, Date of Reg, Status + Enable/Disable toggle).
      7. `FSSAI Registration` (FSSAI No, License Type, Date of Reg, Status + Enable toggle).
      8. `IEC (Import Export Code)` (IEC No, Date of Reg, Status + Enable/Disable toggle).
      9. `PTRC (Professional Tax)` (PTRC No, State, Date of Reg, Status + Enable/Disable toggle).
      10. `PTEC (Professional Tax Enrollment)` (PTEC No, State, Date of Reg, Status + Enable toggle).
      11. `Portal Credentials` (Span 2 columns: GST Portal, TAN Portal, and Income Tax Portal user IDs and passwords with show/hide eye toggle and last updated timestamps).
    - Added `Other Information` table connected to `client_additional_infos` table with `+ Add`, edit pencil, and delete trash modals.
    - Styled every card with clean headers, colored SVG icons, and reactive `Enable` / `Disable` toggle switches that gray out fields when disabled.
- **Bank Account Details Tab Transformation (Matching PDF Page 21 `media_1791371651524_94589370.png`)**:
  - **Database Migration (`2026_10_07_000400_create_client_bank_accounts_table.php`)**:
    - Created `client_bank_accounts` table: `id`, `client_profile_id`, `bank_name`, `account_holder_name`, `account_number`, `ifsc_code`, `branch`, `account_type`, `is_primary`, `status`, `remarks`, `created_at`, `updated_at`.
  - **Eloquent Model (`backend/app/Models/ClientBankAccount.php`)**:
    - Created `ClientBankAccount` model with fillable fields and boolean/timestamps casting.
    - Added `bankAccounts()` relationship in `ClientProfile.php`.
  - **REST Controller & Sync (`backend/app/Http/Controllers/Api/Admin/ClientBankAccountController.php`)**:
    - Implemented `index`, `store`, `update`, `destroy` with clients-unlock protection.
    - Primary Account Switch: setting an account as primary automatically unsets others and syncs `bank_name`, `bank_branch`, `bank_account`, `account_holder_name`, `bank_ifsc`, `account_type` to parent `client_profiles` table so invoices, receipts, and PDF generation retain full compatibility.
  - **UI & Interaction Design (`ClientProfileForm.jsx`)**:
    - **Header Banner**: Blue bank circle icon (`#1d4ed8`), title `Bank Account Details` (`#1d4ed8`), subtitle `Manage bank accounts used for invoices, payments and other business transactions.`, and `+ Add Bank Account` button.
    - **Bank Accounts Table**: Shows all client accounts with `#`, `Bank Name` (`#1e40af` bold), `Account Holder Name`, `Account Number` (monospace), `IFSC Code` (`#1e40af` monospace), `Branch`, `Account Type`, `Primary` pill (`Yes` green / `No` slate), `Status` pill (`Active` green / `Inactive` red), and `Action` (Edit pencil / Delete trash).
    - **Add / Edit Bank Account Box**:
      - Row 1: `Bank Name *`, `Account Holder Name *`, `Account Number *`, `Confirm Account Number *`.
      - Row 2: `IFSC Code *` with integrated `Verify IFSC` button (auto-filling bank and branch upon lookup), `Branch Name *`, `Account Type *`, and `Set as Primary Account` toggle switch.
      - Row 3: `Remarks (Optional)` full width.
      - Additional Row: `SWIFT Code` & `UPI ID` for international / QR code billing.
      - Actions: `Cancel` and `Save Bank Account` / `Update Bank Account`.
  - **Cancel & Interactivity Button Fixes (`ClientProfileForm.jsx`)**:
    - **Page-level Cancel (`handleCancel`)**: Previously, when viewing a client profile in read-only mode (`isEditing === false`), clicking Cancel called `setIsEditing(false)`, which resulted in a no-op with zero visual response. Now correctly routes to `navigate('/admin/clients')` when viewing, exits edit mode if editing without changes, and triggers `DiscardChangesModal` if dirty.
    - **Bank Form Cancel (`handleCancelBankForm`)**: Wired to reset the form inputs, clear errors/IFSC notices, smoothly collapse the `Add / Edit Bank Account` box when accounts exist (`showBankForm = false`), and scroll up to `#bank-accounts-table-card`.
    - **Header & Add Account Buttons**: Top banner `+ Add Bank Account` and inline collapse button open `showBankForm = true`, reset form, scroll down to `#bank-form-card`, and auto-focus `#bank-name-input`.
    - **Card Close Button (✕)**: Added an explicit close icon in the top-right corner of the Add / Edit card for seamless closing.
    - **Success Banner**: Added green confirmation toast (`bankSuccessMsg`) above the bank accounts table upon save, edit, or delete actions.
    - **IFSC Verification Accuracy**: Validated API lookup response (`data.success && (data.bank_name || data.bank)`) to accurately show verified status or appropriate error notice.
- **Client Login Credentials Tab Transformation (Matching PDF Page 23 `media_1791373658558_4ea5cae1.png`)**:
  - **Database Migration (`2026_10_07_000500_add_credentials_settings_to_client_profiles_table.php`)**:
    - Added columns to `client_profiles` table: `two_factor_enabled` (boolean, default false), `session_timeout_minutes` (integer, default 30).
    - Created `client_notes` table: `id`, `client_profile_id`, `note`, `timestamps`.
  - **Eloquent Models & Relationships**:
    - Created `backend/app/Models/ClientNote.php` with fillable `client_profile_id`, `note`.
    - Added `notes()` relationship (`hasMany(ClientNote::class)->latest()`) to `ClientProfile.php`.
    - Added `two_factor_enabled` and `session_timeout_minutes` to `ClientProfile` `$fillable` and `$casts`.
  - **REST API & Controller**:
    - Created `backend/app/Http/Controllers/Api/Admin/ClientNoteController.php` implementing `index`, `store`, `update`, `destroy` guarded with clients-unlock token.
    - Registered routes in `backend/routes/api.php`:
      - `GET /api/admin/clients/{id}/notes`
      - `POST /api/admin/clients/{id}/notes`
      - `PUT /api/admin/clients/{id}/notes/{noteId}`
      - `DELETE /api/admin/clients/{id}/notes/{noteId}`
    - Updated `ClientProfileController.php` to eager load `notes` in `show()` and validate/persist `two_factor_enabled` & `session_timeout_minutes`.
  - **UI Layout & Styling (`ClientProfileForm.jsx`)**:
    1. **Header Banner**: Purple circle avatar badge (`#8b5cf6`), title `Client Login Credentials`, subtitle `Manage client portal access and account settings.`, and yellow/amber notice callout box: *"The password shown here will always reflect the latest password set by the client. If the client resets or updates the password from the portal, it will be updated here automatically."*
    2. **2-Column Responsive Layout**:
       - **Card 1: Login Details (Left Column)**:
         - Card header with user icon + `Login Details`, and reactive `Account Status` toggle switch (`Active` green / `Inactive` red).
         - `User ID (Default)` input with `Edit` pencil button, copy button, and subtext *"User ID is based on the business name. Spaces are removed automatically."*
         - `Password *` masked with bullet characters (`••••••••••••`), show/hide toggle eye, and blue `Update Password` button opening `SetPasswordModal`.
         - `Last Login` with clock icon and formatted timestamp.
         - `Two-Factor Authentication (Optional)` toggle switch with label *"Enable 2FA (OTP on Email)"*.
       - **Card 2: Additional Settings (Left Column)**:
         - Header with cog icon + `Additional Settings`.
         - Field: `Session Timeout (Minutes)` input (default 30) with subtext *"Client will be logged out automatically after the specified time."*
       - **Card 3: Login Activity (Right Column)**:
         - Header with clock icon + `Login Activity`.
         - Activity table: `#`, `Login Date & Time`, `IP Address`, and `Status` (`Success` in green / `Failed` in red).
         - Connects to `/admin/clients/{id}/login-history` with graceful fallback to default activity logs.
         - Footer link `View All Logs →` linking to billing/audit logs.
       - **Card 4: Notes (Full Width Bottom Card)**:
         - Header with notepad icon + `Notes` and `+ Add` button.
         - Table: `S. No.`, `Note`, `Updated On`, and `Action` (Edit pencil / Delete trash).
         - Modal component: `src/components/AddClientNoteModal.jsx` for creating and editing client notes.
- **GST Filing Frequency Tab Transformation (Matching PDF Page 19 `media_1791374978532_280a0478.png`)**:
  - **Header Banner**:
    - Purple calendar/sheet icon badge (`#8b5cf6`), title `GST Filing Frequency`, subtitle `Set and manage GST return filing frequency for this client.`.
    - Right-side light blue callout notice box with circular info icon: *"Filing frequency will be applicable from the selected date. Returns for periods before this date will be marked as Non-Applicable."*
  - **Horizontal Configuration Bar (3 Fields in a Row)**:
    - `Dealer Type *`: Select dropdown (`Regular` / `Composition`). Changing dealer type automatically adjusts applicable returns and frequencies.
    - `Opt-Out *`: Select dropdown (`Select`, `Monthly`, `Quarterly`). Controls regular dealer QRMP selection.
    - `Applicable From *`: HTML5 date input (`01/04/2026`) with calendar picker.
  - **Return Schedule Table (Exact 4 Columns Matching PDF Page 19)**:
    - Columns: `GST Return`, `Filing Frequency`, `Due Date (As per Govt. Rules)`, `Remarks`. (Eliminated redundant Status column).
    - 5 Returns:
      1. `GSTR-1 (Monthly)`: Frequency `Monthly ▼`, Due Date `11th of next month`, Remark `Outward supplies return`. Active for Regular Monthly.
      2. `GSTR-1 (Monthly - QRMP)`: Frequency `Quarterly ▼`, Due Date `13th of next month after quarter`, Remark `For QRMP scheme (Quarterly return with monthly upload)`. Active for Regular Quarterly (QRMP), muted for Monthly.
      3. `GSTR-2B`: Frequency `Monthly ▼` (or `Quarterly ▼`), Due Date `14th of next month`, Remark `Auto-generated ITC statement`.
      4. `GSTR-3B`: Frequency `Monthly ▼` (or `Quarterly ▼`), Due Date `20th of next month` (or `22nd of next month after quarter`), Remark `Summary return and tax payment`.
      5. `CMP-08`: Frequency `Quarterly ▼`, Due Date `18th of next month after quarter`, Remark `For Composition Scheme (Quarterly return)`. Active for Composition, muted for Regular.
    - Rows styled with dropdown-styled frequency containers (`▼` chevron) and muted disabled row states matching the PDF design.
  - **Bottom Note Callout Box**:
    - Light blue callout container (`#eff6ff`, border `#bfdbfe`) with `i` badge, bold `Note:`, and 3 bullets:
      - Dynamic cutoff date: `Returns for periods before DD/MM/YYYY will be marked as Non-Applicable.`
      - `Due dates are as per current Government rules and may be subject to change.`
      - `If you change the client type or applicable date, the return frequency and due dates will be updated accordingly.`
  - **Backend Alignment (`backend/app/Services/Gst/GstPeriodService.php`)**:
    - Updated `getFilingRules()` to output exact frequencies (`Monthly`/`Quarterly`) and standardized remarks casing matching PDF Page 19.
- **Cancel & Edit Button Toast Notifications (`ClientProfileForm.jsx`)**:
  - Added lightweight, floating reactive Toast Notification system:
    - Auto-dismisses after 3.5 seconds with dismiss (✕) button and smooth slide-in animation (`@keyframes toastSlideIn`).
    - Styled with clean border-left accents and badges: blue for info, amber for warning/cancellation, and green for success.
  - **Edit Button**: Displays info toast: *"Edit mode enabled. You can now modify client details."*
  - **Cancel Button**:
    - When exiting edit mode without changes: *"Edit mode cancelled. No changes were made."* (warning/amber).
    - When confirming discard in `DiscardChangesModal`: *"Changes discarded. Exited edit mode."* (warning/amber).
    - When closing bank account form: *"Bank account form closed."* (info/blue).
- **Document Numbering Tab Transformation (Matching PDF Page 23 / 177 `media_1791376915767_a7224314.png`)**:
  - **Header Banner**:
    - Rose/crimson circular `#` badge (`#f43f5e`), title `Document Numbering`, subtitle `Set and manage prefixes, numbering and format for all billing and other documents.`.
    - Right-side light blue notice callout box:
      - • You can set automatic numbering or allow manual numbering for each document type.
      - • You can enter any separator between prefix and number (e.g. -, /, space etc.).
  - **2-Column Layout (10-Column Left Table + Right Format Preview Card)**:
    - **Left Document Types Table**:
      - 6 Document Types: `Tax Invoice` (`INV`), `Bill of Supply` (`BOS`), `Credit Note` (`CN`), `Debit Note` (`DN`), `Quotation` (`QUO`), `Delivery Challan` (`DC`).
      - 10 Columns:
        1. `#` (Index 1-6)
        2. `Document Type` (Bold name)
        3. `Prefix` (Text input box with default prefix)
        4. `Separator` (Text input box with default separator `/` or `-`)
        5. `Next Number` (Text input box with default `01`)
        6. `Prefix Position` (Radio options: `Prefix First` / `Prefix Last`)
        7. `Numbering Type` (Radio options: `Auto` / `Manual`)
        8. `Number Format (Preview)` (Live reactive preview chip e.g. `INV-01`, `BOS/01`, `CN-01`, `DN/01`, `QUO-01`, `DC/01`)
        9. `Status` (Interactive active/inactive toggle switch)
        10. `Actions` (`👁 View Sample` button syncing current selection with format preview card)
    - **Right Format Preview Card**:
      - Card header with eye icon + `Format Preview`.
      - Document Type dropdown selector (`Tax Invoice`, `Bill of Supply`, `Credit Note`, `Debit Note`, `Quotation`, `Delivery Challan`).
      - Dashed border card container showing:
        - Uppercase document label.
        - Large bold sample number formatted based on prefix, separator, next number, and prefix position (e.g. `INV-01`, `24px`).
        - Subtitle: `Next number will be`.
        - Pill badge displaying next incremented document number (e.g. `INV-02`).
  - **Bottom Info / Notice Callout Box**:
    - Light blue callout container (`#eff6ff`, border `#bfdbfe`) with circular `i` icon:
      - • If you select 'Auto', the next number will be automatically incremented after each document is generated.
      - • If you select 'Manual', you can enter the document number at the time of creating the document.
      - • You can edit the prefix, separator, next number or prefix position at any time.
  - **Backend Database & Persistence**:
    - Migration `2026_10_07_000600_add_document_numbering_settings_to_client_profiles_table.php` added `delivery_challan_prefix`, `delivery_challan_next_number`, and `document_numbering_settings` JSON column.
    - Updated `ClientProfile.php` model with casts and fillables.
    - Updated `ClientProfileController.php` with validation rules, payload parsing, and JSON persistence.

---

# Changes Log - Module 2A - Stage 3 Migration Hardening & Bank Account Cleanup

### 1. Migration `2026_10_07_000400_create_client_bank_accounts_table.php` (Real Bank Account Data Only)
- Removed synthetic fallback values (`'HDFC Bank'`, `'50200012345678'`, `'HDFC0001234'`, `'Seawoods, Navi Mumbai'`).
- Enforced strict condition: only insert a row into `client_bank_accounts` if the client profile has an actual account number (`!empty($p->bank_account)`). No invented data.

### 2. Local DB Fake Bank Accounts Audit (Awaiting User OK for Deletion)
- Audited `client_bank_accounts` in local SQLite database for rows where `bank_name = 'HDFC Bank'` and `account_number = '50200012345678'`.
- Identified 2 synthetic rows:
  - `id: 1, client_id: 1` (`ABC Pvt. Ltd.`)
  - `id: 4, client_id: 4` (`Rohan Deshmukh`)
- Reported to user; awaiting explicit confirmation before running one-off tinker delete command.

### 3. Migration `2026_10_07_000600_add_document_numbering_settings_to_client_profiles_table.php` (Fix `down()`)
- Updated `down()` method in migration `2026_10_07_000600` to drop `delivery_challan_next_number` alongside `delivery_challan_prefix` and `document_numbering_settings`.
- Tested rollback (`php artisan migrate:rollback --step=1`) and re-migration (`php artisan migrate`) on an isolated copy of the SQLite database (`database_test_copy.sqlite`), successfully verifying that all added columns roll back and re-apply cleanly without errors while leaving the primary SQLite database completely intact.

---

# Changes Log - Module 2A - Stage 4 Toggle Defaults Fix

### 1. Migration `2026_10_07_000300_add_registration_details_to_client_profiles_table.php`
- Changed default for all 10 `*_enabled` columns from `default(true)` to `default(false)` (`pan_enabled`, `gst_enabled`, `tan_enabled`, `cin_enabled`, `udyam_enabled`, `shop_act_enabled`, `fssai_enabled`, `iec_enabled`, `ptrc_enabled`, `ptec_enabled`).
- Implemented automatic data-presence backfill inside the migration using Eloquent Query Builder (`DB::table('client_profiles')`):
  - `pan_enabled`: `!empty($p->pan)`
  - `gst_enabled`: `!empty($p->has_gst) || !empty($p->gstin)`
  - `tan_enabled`: `!empty($p->tan)`
  - `cin_enabled`: `!empty($p->cin)`
  - `udyam_enabled`: `!empty($p->udyam)`
  - `shop_act_enabled`: `!empty($p->shop_establishment)`
  - `fssai_enabled`: `!empty($p->fssai_no)`
  - `iec_enabled`: `!empty($p->iec)`
  - `ptrc_enabled`: `!empty($p->pt_reg)`
  - `ptec_enabled`: `!empty($p->ptec_no)`
- For clients where GST is active and `registration_type` is empty, populated `registration_type` from `dealer_type` (`'regular'` -> `'Regular'`, `'composition'` -> `'Composition'`). No synthetic data invented. Compatible with both SQLite and MySQL without raw SQL.

### 2. Frontend Hydration (`src/pages/admin/ClientProfileForm.jsx`)
- Existing clients now hydrate toggles directly from stored database values (`Boolean(d.*_enabled)`), allowing cards to be disabled when stored as `0` / `false`.
- New-client form defaults in `empty()` were kept intact without modifications.

### 3. Local DB Tinker Preparation
- Prepared simulation and diff of proposed one-off tinker command to update local SQLite database without `migrate:fresh`.
- Stopping for user confirmation before applying the updates to the local database.

---

# Changes Log - Module 2B (Clients, Part 2B) - Stage A Backend & Schema Implementation

## Spec Reference: `docs/spec/04-clients-2b.md` (PDF Module 2, sections 17-20, mockups p25-p27)

### 1. Migrations & Database Changes (SQLite + MySQL Compatible, No Raw SQL)
- **Database Backup Created**:
  - `backend/database/database.sqlite.bak_20261008_111309` created prior to running migrations.
- **Migration `2026_10_08_000100_add_layout_and_watermark_to_client_profiles_table.php`**:
  - Added columns to `client_profiles`:
    - `default_layout_id` (unsigned tinyint, default `1`)
    - `default_colour_scheme` (string 50, default `'slate_blue'`)
    - `layout_applied_from` (date, nullable)
    - `layout_updated_at` (timestamp, nullable)
    - `watermark_enabled` (boolean, default `false`)
    - `watermark_text` (string 255, nullable)
    - `gst_reminder_enabled` (boolean, default `false`)
  - Backfill: Existing 4 client profiles set to `default_layout_id = 1` and `default_colour_scheme = 'slate_blue'`.
- **Migration `2026_10_08_000200_create_client_document_settings_table.php`**:
  - Created `client_document_settings` table:
    - `id` (bigint auto-increment PK)
    - `client_profile_id` (FK to `client_profiles.id`, cascade on delete)
    - `document_type` (string 50: `tax_invoice`, `bill_of_supply`, `credit_note`, `debit_note`, `quotation`, `delivery_challan`)
    - `layout_id` (unsigned tinyint, default `1`)
    - `colour_scheme` (string 50, default `'slate_blue'`)
    - `watermark_applies` (boolean, default `false`)
    - `created_at`, `updated_at` (timestamps)
    - Unique constraint: `['client_profile_id', 'document_type']`
  - Backfill: Seeded 6 document rows for every existing client profile (4 clients x 6 document types = 24 rows).
- **Migration `2026_10_08_000300_create_client_subscriptions_table.php`**:
  - Created `client_subscriptions` table:
    - `id` (bigint auto-increment PK)
    - `client_profile_id` (unique FK to `client_profiles.id`, cascade on delete)
    - `status` (string 20: `active` / `inactive`, default `'active'`)
    - `from_date` (date)
    - `to_date` (date, nullable)
    - `total_fees` (decimal 12,2 nullable)
    - `amount_paid` (decimal 12,2 nullable)
    - `amount_receivable` (decimal 12,2 nullable)
    - `outstanding` (decimal 12,2 nullable)
    - `created_at`, `updated_at` (timestamps)
  - Backfill: Seeded 1 row per existing client profile (4 clients = 4 rows) with `status = 'active'`, `from_date = client.created_at` (date portion), `to_date = null`, and real fee columns set to `null` (Option A).

### 2. Eloquent Models
- **`App\Models\ClientDocumentSetting`**:
  - Constants for `DOCUMENT_TYPES` (6 types), `LAYOUTS` (1-4), `COLOUR_SCHEMES` (6 approved slugs: `slate_blue`, `charcoal_grey`, `dusty_plum`, `mocha_brown`, `deep_teal`, `antique_gold`).
  - Casts: `layout_id => integer`, `watermark_applies => boolean`.
  - Relationship: `clientProfile()` belongsTo.
- **`App\Models\ClientSubscription`**:
  - Constants for `STATUS_ACTIVE` and `STATUS_INACTIVE`.
  - Casts: `from_date => date`, `to_date => date`, decimal casts for fee columns.
  - Relationship: `clientProfile()` belongsTo.
- **`App\Models\ClientProfile`**:
  - Added fillables and casts for layout and watermark fields.
  - Added relationships `documentSettings()` (hasMany) and `subscription()` (hasOne).

### 3. Backend Controllers & API Endpoints
- **Layout Controller (`backend/app/Http/Controllers/Api/Admin/ClientLayoutController.php`)**:
  - `GET /api/admin/clients/{id}/layout`: returns client layout default, applied from date, updated at timestamp, labels.
  - `PUT|POST /api/admin/clients/{id}/layout`:
    - Strict validation: `layout_id` must be in `1,2,3,4`; `colour_scheme` must be one of the 6 approved slugs (rejects `forest_green`, `burgundy`, etc.).
    - Overwrite transaction: In a single database transaction, updates client profile defaults and overwrites all 6 rows in `client_document_settings` for that client.
  - `initializeDefaultsForProfile()`: utility to ensure new clients created via `ClientProfileController::store` immediately receive default layout and document settings.
- **Configuration Controller (`backend/app/Http/Controllers/Api/Admin/ClientConfigurationController.php`)**:
  - `GET /api/admin/clients/{id}/configuration`: returns watermark toggle, watermark text, GST return reminder toggle, and all 6 document type settings.
  - `PUT|POST /api/admin/clients/{id}/configuration`: validates each document row, watermark text, and reminder toggle; updates in a transaction.
- **Subscription Controller (`backend/app/Http/Controllers/Api/Admin/ClientSubscriptionController.php`)**:
  - `GET /api/admin/clients/{id}/subscription`: returns subscription details and real-time usage (`documents_count` counted directly from `CommercialDocument`, `storage_used` as `null` placeholder).
  - Inactive subscription masking: If `status === 'inactive'`, the API returns `0` (`0.00`) for `total_fees`, `amount_paid`, `amount_receivable`, and `outstanding`, while the database table preserves the actual real stored values. Includes alert notice for inactive state.
  - `PUT|POST /api/admin/clients/{id}/subscription`: stores real values provided without inventing formulas.
- **Service Access Controller (`backend/app/Http/Controllers/Api/Admin/ClientServiceAccessController.php`)**:
  - No database table created: service access state is dynamically derived in API from subscription status.
  - Active subscription:
    - Client Data Management: always ON (`access = true`, `disabled = true`, remark "Always enabled for all clients").
    - Billing, Document Change, Requests, Reports: ON (`access = true`).
    - GST Compliance: reads `client_profiles.gst_compliance_enabled`.
  - Inactive subscription:
    - Client Data Management: ON (`access = true`, `disabled = true`).
    - Remaining 5 services (Billing, Document Change, Requests, GST Compliance, Reports): all OFF (`access = false`), disabled (`disabled = true`), with remark `"Not Applicable (Subscription Inactive)"`.
  - `PUT|POST|PATCH /api/admin/clients/{id}/service-access`: writes directly to `client_profiles.gst_compliance_enabled` when subscription is active; returns 422 error if subscription is inactive.
- **Route Registration (`backend/routes/api.php`)**:
  - Registered all 4 resource routes inside the admin role/audit middleware group with clients unlock authentication guards.

### 4. Automated Feature Tests (`backend/tests/Feature/ClientModule2bTest.php`)
- `test_default_overwrite_transaction_updates_all_document_types`: verifies saving default layout/colour updates `client_profiles` and overwrites all 6 `client_document_settings` rows in a single atomic transaction.
- `test_bad_colour_and_bad_layout_are_rejected`: verifies 422 validation errors for invalid layouts (`0`, `5`) and unapproved colours (`forest_green`, `burgundy`).
- `test_subscription_put_inactive_preserves_stored_fee_fields_untouched`: verifies that sending PUT with status `inactive` does NOT modify or null out existing stored fee values in DB; stored values remain completely untouched.
- `test_new_client_creation_initializes_document_settings_and_subscription`: verifies that creating a new client (`POST /api/admin/clients`) automatically initializes 6 rows in `client_document_settings` and 1 row in `client_subscriptions` (`status = 'active'`, `from_date = today`, `to_date = null`, `total_fees = null`, `amount_paid = null`, `amount_receivable = null`, `outstanding = null`).
- `test_active_subscription_with_null_fees_returns_null_in_api`: verifies that active subscriptions with null fees strictly return `null` in the API, not `0`.
- `test_service_access_gst_row_reads_from_gst_compliance_enabled_flag`: verifies that the GST compliance row in Service Access dynamically reflects the `gst_compliance_enabled` flag on the client profile in the DB and is never hard-coded.
- `test_configuration_put_rejects_duplicate_or_missing_document_types`: verifies that `PUT /api/admin/clients/{id}/configuration` rejects missing document types (e.g. only 5 provided) or duplicate document types with `422 Unprocessable Entity`.
- `test_configuration_saves_per_document_settings_watermark_and_reminder`: verifies custom per-document layout and colour settings, watermark text, and GST reminder toggle saving and reloading.
- Result: **8 passed, 108 assertions, 0 errors**.

### 5. Production Backfill & Deployment Note (`abkhanassociates` MySQL)
When deploying Module 2B migrations to production:
1. **Pre-requisite / Pre-flight**:
   - Ensure a complete mysqldump backup of the production database is taken prior to running migrations.
2. **Migration Order & Backfill Execution**:
   - All migrations are standard Laravel Schema builder calls without raw SQL or SQLite-specific syntax, fully compatible with MySQL 8.x.
   - **`2026_10_08_000100_add_layout_and_watermark_to_client_profiles_table.php`**:
     - Adds layout columns (`default_layout_id`, `default_colour_scheme`, `layout_applied_from`, `layout_updated_at`, `watermark_enabled`, `watermark_text`, `gst_reminder_enabled`).
     - Backfills all existing clients to `default_layout_id = 1` and `default_colour_scheme = 'slate_blue'`.
     - Explicitly sets `layout_updated_at = null` and leaves `layout_applied_from = null` for existing records (dates only populate when an administrator explicitly saves changes in the Layout tab).
   - **`2026_10_08_000200_create_client_document_settings_table.php`**:
     - Creates table with unique index `(client_profile_id, document_type)`.
     - Automatically backfills exactly 6 rows for each client in `client_profiles` (`tax_invoice`, `bill_of_supply`, `credit_note`, `debit_note`, `quotation`, `delivery_challan`), defaulting to Layout 1 and Slate Blue (`watermark_applies = false`).
     - Uses `insertOrIgnore` with timestamps for idempotence.
   - **`2026_10_08_000300_create_client_subscriptions_table.php`**:
     - Creates table with unique foreign key `client_profile_id`.
     - Automatically backfills 1 row for each client in `client_profiles` with `status = 'active'`, `from_date = client.created_at` date, `to_date = null`, and real fee fields as `null` (Option A).
     - Uses `insertOrIgnore` with timestamps for idempotence.
3. **Service Access**:
   - Requires **no database backfill**, as service access is derived in real-time by the API based on subscription status (`active` vs `inactive`) and the existing `client_profiles.gst_compliance_enabled` flag.

---

## Stage D1: Document Numbering Alignment (Backend & Race Fix)

### 1. Atomic Allocation & Race Fix (`InvoiceService.php`)
- `allocateNextNumber(ClientProfile $profile, string $type)`:
  - Executes inside a pessimistic row lock (`lockForUpdate()`) within the active database transaction.
  - Reads sequence number, prefix, separator, prefix position, and padding from `document_numbering_settings` JSON with legacy column fallback.
  - Increments the sequence directly on the locked row in the same transaction.
  - Synchronizes `document_numbering_settings` JSON (`next_number` padded string) and legacy sequence column (`<type>_next_number` integer).
  - Replaces separate `bumpNextNumber` calls in `create()` and `issue()`, eliminating race conditions between concurrent issues.
- `nextNumber(ClientProfile $profile, string $type)`:
  - Formats the next document number preview without incrementing the counter.
- `resolveNumberingConfig(ClientProfile $profile, string $type)`:
  - Resolution precedence: `document_numbering_settings` JSON > legacy columns > default constants.
  - Fallback defaults: Quotation defaults to `'QUO'` (matching frontend Tab 5); Delivery Challan reads from profile column `delivery_challan_prefix` with fallback to `'DC'`.
- `formatDocNumber(string $prefix, int $seq, string $separator = '-', string $position = 'first', int $padLen = 2)`:
  - Formats document numbers according to `prefix_position` (`first` vs `last`), user-configured separator, and zero-padded sequence length.

### 2. Guard C Implementation (`ClientProfileController.php`)
- `validateDocumentNumberingGuard(Request $request, ClientProfile $profile, array $settings)`:
  - **Check 1 (Exact Collision - Hard Block 422)**:
    - Checks proposed formatted number for each document type against all existing `CommercialDocument` records for that client (including drafts, issued, cancelled, paid).
    - If exact collision exists, returns HTTP 422 Unprocessable Entity with validation error field key: `document_numbering_settings.<doc_key>.next_number`.
  - **Check 2 (Sequence Gap Warning - HTTP 409)**:
    - Scoped strictly to non-draft (`status != 'draft'`) documents matching the current prefix pattern.
    - If proposed `next_number` is lower than the highest issued document sequence:
      - If `confirm_gap: true` is NOT passed, returns HTTP 409 with:
        `requires_confirmation: true`, `doc_key`, `proposed_number`, `highest_issued`, `message`.
      - If `confirm_gap: true` IS passed, bypasses the warning and saves the sequence.
- **Legacy Columns Sync**:
  - Saving `document_numbering_settings` automatically synchronizes flat legacy columns (`invoice_prefix`, `invoice_next_number`, `quotation_prefix`, etc.).
  - Status toggle (`status`) preserved in JSON as Option 1 configuration state without disrupting billing.

### 3. Automated Feature Tests (`backend/tests/Feature/DocumentNumberingTest.php`)
- `test_default_prefixes_and_custom_columns`: tests default prefix `'QUO'` for quotation, custom column for delivery challan, and standard invoice formatting.
- `test_custom_separator_and_prefix_last_formatting`: tests custom separator (`/`) and `prefix_position = 'last'` (`01-EST`).
- `test_atomic_allocation_prevents_race_duplicates`: verifies atomic increment on sequential allocation without duplicates.
- `test_exact_duplicate_hard_block_422`: verifies hard 422 error on exact collision with issued document.
- `test_exact_duplicate_checks_drafts_too`: verifies hard 422 error on exact collision with draft document.
- `test_gap_check_returns_409_warning_and_confirms`: verifies 409 response on gap and successful save with `confirm_gap: true`.
- `test_gap_check_ignores_drafts`: verifies drafts are excluded when computing highest issued sequence.
- `test_legacy_columns_sync_on_save`: verifies flat columns sync on Tab 5 JSON save.
- `test_create_issued_and_draft_issue_workflows`: tests direct create issued and draft-to-issue workflows.
- `test_fallback_prefixes_when_profile_columns_empty`: tests fallback defaults when profile columns are null.
- Result: **10 passed, 38 assertions, 0 errors**.

---

## Stage F1: Foundation + Layout 1 Production Template

### 1. Database Migrations
- **Migration `2026_10_08_120904_add_invoice_tagline_to_client_profiles_table.php`**:
  - Added nullable string column `invoice_tagline` (length 120) to `client_profiles` table.
  - UI is deferred for future stages per spec; field is available for client profile models and document headers.

---

## Stage F2: Layout 2 Production (Classic Corporate)

### 1. Architecture & Design
- **No Database Migrations**: Uses existing SQLite schema without any modifications or synthetic tables.
- **Colour Tokens Update (`DocumentThemeTokens.php`)**:
  - Slate Blue: `#4A5F7A` / `#34455C` / `#E6EBF2`, Canvas RGB: `[0.290, 0.373, 0.478]`.
  - Mocha Brown: `#6B4F3F` / `#4A342A` / `#F0E8E3`, Canvas RGB: `[0.420, 0.310, 0.247]`.
  - Deep Teal: `#1F6F6F` / `#14504F` / `#E0F0EF`, Canvas RGB: `[0.122, 0.435, 0.435]`.
  - Antique Gold: `#A8832F` / `#7A5E1E` / `#F6EEDA`, Canvas RGB: `[0.659, 0.514, 0.184]`.
  - Charcoal Grey and Dusty Plum retained as previously defined.
- **Canvas Helper Square Outer Frame (`DocumentCanvasHelper.php`)**:
  - Added `$borderRadius` parameter to `attachFrameAndFooter()` (default: 11 for Layout 1, 0 for Layout 2).
  - Draws crisp square lines for outer frame when `$borderRadius === 0`.
  - Outer frame automatically repeats across all pages on canvas.
  - Footer rendered outside frame at `y = height - 20`:
    - "Generated by <text>" on bottom-left (only when watermark is enabled + applies to doc type).
    - "Page X of Y" on bottom-right.
- **Renderer Selection (`InvoiceService.php`)**:
  - `generatePdf()` branches to `pdf.layouts.layout2` when `config('invoice.new_renderer')` is enabled and `layout_id === 2`.
  - Layout 3 and 4 remain safely on legacy fallback.
  - Fail-safe try/catch logs warnings and falls back to legacy invoice template.

### 2. Blade Modular Partials (`pdf/partials/`)
- Shared partials created for reusability with Layout 4:
  - `pdf/partials/parties.blade.php`: Side-by-side Bill To & Ship To blocks with solid theme header bars and party metadata.
  - `pdf/partials/items_table.blade.php`: Table with theme header, repeatable `thead`, line items, and shaded `SUBTOTAL` row (total qty + total amount).
  - `pdf/partials/bank_details.blade.php`: Bank Details card with solid theme header bar and aligned key-values.
  - `pdf/partials/terms.blade.php`: Terms and conditions card with solid theme header bar and numbered list.
  - `pdf/partials/summary.blade.php`: Summary / Tax Bifurcation card, shaded `Total Amount (₹)` bar, and `Amount in words`.
  - `pdf/partials/signatory.blade.php`: Authorised Signatory for company block with seal and signature.
- Strict table-based layout (no flexbox/grid), zero icons (per reference image).

### 3. Decisions Implemented
- Logo displayed in clean white box (not theme-colour box).
- TDS / TCS row omitted from summary.
- "Against" field rendered strictly on Credit Note and Debit Note; hidden on Tax Invoice, Bill of Supply, Quotation, and Delivery Challan.
- Signatory displays name and "Authorised Signatory for <Company Name>" without inventing unpersisted fields.
- Bill of Supply hides all GST columns and tax bifurcation rows.

### 4. Automated Tests (`tests/Feature/Layout2ProductionRendererTest.php`)
- All 5 test suites passing (38 assertions):
  1. `test_legacy_fallback_when_feature_flag_is_off`: passes.
  2. `test_layout_2_renders_with_all_6_colour_schemes`: all 6 schemes render valid PDFs.
  3. `test_watermark_footer_renders_only_when_on_and_applies_yes`: verified.
  4. `test_all_6_document_types_render_successfully_on_layout_2`: verified for Tax Invoice, Bill of Supply, Credit Note, Debit Note, Quotation, Delivery Challan.
  5. `test_overflow_document_renders_multi_pages_with_repeated_headers`: 20 items overflow correctly across pages with repeated thead.
- Combined suite run with Layout 1 (`Layout1ProductionRendererTest` + `Layout2ProductionRendererTest`): 10 passed, 70 assertions, 0 errors.

### 5. Artifact Generation Command (`GenerateF2ArtifactsCommand.php`)
- `php artisan spike:f2-artifacts` generates all 9 reference PDFs in `storage/app/spike/f2/`:
  - 6 colours Tax Invoice: `slate_blue`, `charcoal_grey`, `dusty_plum`, `mocha_brown`, `deep_teal`, `antique_gold`
  - 20-item overflow: `tax-invoice-overflow.pdf`
  - Bill of Supply: `bill-of-supply.pdf`
  - Credit Note: `credit-note.pdf`


---

## Stage 3A: Admin Billing Client Directory & Shared Count Infrastructure

### 1. Backend Service & Endpoints
- **Service (`AdminBillingCountService.php`)**:
  - Financial Year validation and resolution: rejects any start year earlier than `2026-27` with HTTP 422; resolves missing/null FY parameter to current financial year computed in `Asia/Kolkata`.
  - Global card counts: queries commercial documents using `whereBetween('document_date', [$from, $to])` and whitelisted statuses (`issued`, `paid`, `partial`, `cancelled`). Counts exact six types: `tax_invoice`, `bill_of_supply`, `debit_note`, `credit_note`, `quotation`, `delivery_challan`.
  - Client dashboard counts: computes 7 card counts (six types + `total` and `total_documents`), donut distribution (sum matches total), and DB-portable 12-month document trend bucketing (Apr–Mar).
  - Address join logic: formats address lines, city, and state-pincode without trailing delimiters or stray dashes when state or pincode is missing.
  - GST field masking: masks `gstin` and `registration_type` to null for GST-OFF clients (`has_gst = false`).
- **Controller (`AdminBillingController.php`)**:
  - `GET /api/admin/billing/clients`:
    - Default sort by `client_code` ascending.
    - Search (`q`): searches `client_code`, `business_name` (Trade Name), `client_name` (Legal Name), `pan`, and `gstin` (only when `has_gst = true`). Escapes SQL wildcards with uniform `ESCAPE '!'` syntax across MySQL and SQLite.
    - Filters: `status` (`Active` / `Inactive`), `constitution_type` (alias matching for Partnership and Private Limited), `registration_type` (`Regular` including QRMP, `Composition`; enforces `has_gst = true`).
    - Exposes filter metadata: `filter_options` and `alias_mapping`.
    - Pagination capped at 100 per page.
  - `GET /api/admin/billing/clients/{clientId}/dashboard`:
    - Returns client profile card, 7 cards, donut breakdown, and 12-month trend.

### 2. Frontend State
- **Context (`src/context/AdminFyContext.jsx`)**:
  - In-memory shared state for admin financial year.
  - Generates `fyOptions` iterating strictly downwards from current FY down to `2026-27` (no future FYs).
  - Hook `useAdminFy()` consumed by admin topbar controls; `AdminFyProvider` wraps only `<AdminPortalLayout />`.

### 3. Parked Notes / Known Baseline Test Issues
- **`DocumentNumberingTest` (6 failing tests)**:
  - Tests: `test_exact_duplicate_hard_block_422`, `test_exact_duplicate_checks_drafts_too`, `test_gap_check_returns_409_warning_and_confirms`, `test_gap_check_ignores_drafts`, `test_legacy_columns_sync_on_save`, `test_form_data_multipart_confirm_gap_variations`.
  - Cause: Updating a client via `PUT /api/admin/clients/{id}` now triggers validation requiring `email` and `login_prefix`, which were omitted in earlier test payloads. Pre-existing on baseline; not touched here.
- **`GstLiabilityReportTest` (1 failing test)**:
  - Test: `test_regular_gst_client_receives_monthly_and_quarterly_liability`.
  - Cause: Hard-coded date expectation (`2026-04-30` vs `2027-03-31`) sensitive to current runtime system date. Pre-existing on baseline; not touched here.

---

## Stage 3B-0: Schema Migrations, SoftDeletes, Admin Lock Infrastructure & Number Reuse

### 1. Database Migration (`2026_10_14_000100_update_commercial_documents_for_stage_3b.php`)
- **Schema Alterations on `commercial_documents`**:
  - `deleted_at`: Added nullable indexed timestamp column via `$table->softDeletes()->after('status')->index()`.
  - `cancelled_by`: Added nullable unsigned big integer column. Handled conditionally: on SQLite added as plain nullable column to avoid table rebuild; on MySQL constrained to `users(id)` with `nullOnDelete`.
  - Composite Unique Index Dropped: Dropped `commercial_documents_client_profile_id_type_number_unique` on `(client_profile_id, type, number)`.
  - Plain Composite Index Added: Replaced with `commercial_documents_client_profile_id_type_number_index` on `(client_profile_id, type, number)`.
  - Idempotent / Safe `down()`: Drops index on `deleted_at` first (preventing SQLite index drop errors), guards re-adding unique index against existing duplicate numbers, drops foreign key and column safely.
- **SQLite PRAGMA Verification**:
  - Tested on copy of local database (`database_copy.sqlite`) and migrated on local `database.sqlite`.
  - `PRAGMA index_list('commercial_documents')`: Unique composite index replaced by non-unique composite index; `deleted_at` index created.
  - `PRAGMA foreign_key_list('commercial_documents')`: 5 pre-existing foreign keys remain intact.
  - `PRAGMA foreign_key_check('commercial_documents')`: 0 violations.

### 2. Model & Service Enhancements
- **Model (`CommercialDocument.php`)**:
  - Added `Illuminate\Database\Eloquent\SoftDeletes` trait.
  - Added `'cancelled_by'` to `$fillable`.
  - Added `cancelledBy()` relationship method returning `$this->belongsTo(User::class, 'cancelled_by')`.
- **Lock Service (`AdminBillingLockService.php`)**:
  - Created dedicated admin lock service calculating periods from document `created_at` converted explicitly to `Asia/Kolkata` timezone (independent of app `UTC` timezone setting).
  - Regular & QRMP clients: Return type `GSTR1`, tax period `YYYY-MM`. Document locked only when a matching `GSTR1` return row has `status = 'filed'` (filing of GSTR-3B does NOT lock).
  - Composition clients: Return type `CMP08`, tax period Indian FY quarter `YYYY-Qn` using `GstPeriodService::fyQuarterOf()` (Apr-Jun = Q1, Jul-Sep = Q2, Oct-Dec = Q3, Jan-Mar = Q4).
  - GST-OFF clients: Never locked; GST status returns `'-'`.
  - Quotations & Delivery Challans: Never locked; GST status returns `'-'` (Decision 10).
- **Service (`InvoiceService.php`)**:
  - `adminDelete()`: Preserved legacy hard-delete behavior by switching `$doc->delete()` to `$doc->forceDelete()`, keeping existing checks (Decision 3: legacy untouched).
  - `adminSoftDelete()`: New method for Module 3. In a transaction, verifies GST is not filed under `AdminBillingLockService`, checks reference documents and filing requests, sets `status = 'deleted'`, performs soft delete (`deleted_at`), preserves line items, and logs `ActivityLog` `'deleted_document'`.
  - `allocateNextNumber()`: Added collision check inside `lockForUpdate` transaction. If the formatted number already exists in non-deleted documents, aborts with HTTP 422 (`'Invoice number already exists for this client.'`). No auto-increment/skip.
  - Concurrency Note: In SQLite, `lockForUpdate` is ignored by the engine and the unique index is removed, so concurrent creation collisions under high SQLite concurrency are an accepted engine limitation.
- **Purge Command & Schedule (`PurgeTrashedCommercialDocumentsCommand.php`)**:
  - Artisan command: `billing:purge-trashed-documents`.
  - Purge rule: Records eligible when `deleted_at < first day of the PREVIOUS calendar month relative to now` (e.g. deleted 15 Apr -> purged from 1 Jun when cutoff is 1 May; retained on 31 May when cutoff is 1 Apr).
  - Removes line items, edit requests, and stored PDF files; permanently force-deletes the document; writes no activity log.
  - Scheduled daily at `03:00` in `backend/routes/console.php`.

### 3. Automated Tests (`tests/Feature/AdminBilling3BMigrationAndModelTest.php`)
- 17 comprehensive feature tests (73 assertions) covering:
  1. Soft deletes hides trashed records from standard Eloquent queries.
  2. Soft deletes queryable via `onlyTrashed()`.
  3. Legacy `adminDelete()` performs complete hard delete.
  4. `adminSoftDelete()` sets `status = 'deleted'`, sets `deleted_at`, retains line items, writes `ActivityLog`.
  5. `adminSoftDelete()` blocked with 422 when return period is filed.
  6. `adminSoftDelete()` blocked with 422 when referenced by another document via `reference_document_id`.
  7. `adminSoftDelete()` blocked with 422 when attached to a `GstFilingRequest` via `gst_filing_request_document`.
  8. Number reuse allowed for soft-deleted documents without SQLSTATE 23000 error.
  9. Cancelled document numbers cannot be reused.
  10. `allocateNextNumber()` re-check aborts 422 if number already exists.
  11. Purge command boundary testing with `Carbon::setTestNow` (31 May vs 1 Jun for April deletion).
  12. Admin lock IST timezone conversion test with `created_at` on 31 Oct 23:30 IST.
  13. Regular client locks on GSTR-1 and does not lock on GSTR-3B only.
  14. QRMP client locks on GSTR-1 monthly period.
  15. Composition client FY quarter boundaries (31 Mar, 1 Apr, 30 Jun, 1 Jul, 30 Sep, 1 Oct, 31 Dec, 1 Jan) and CMP-08 filing lock.
  16. GST-OFF client returns `'-'` and never locks.
  17. Tab 5 `PUT /api/admin/clients/{id}` document numbering: soft-deleted number allowed as Next Number (gap warning 409 verified and bypassed with `confirm_gap`), cancelled number rejected with 422.

---

## Stage 3B-1: Admin Billing Document Endpoints (Tax Invoice & Shared Types Backend)

### 1. Routes Registered (`routes/api.php`)
Added under `Route::middleware(['role.staff', 'audit'])->prefix('admin')->group(...)`:
- `GET    /api/admin/billing/client-directory/{clientId}/documents/{docType}`: Document list with client strip, cards, filtered totals, and pagination.
- `GET    /api/admin/billing/client-directory/{clientId}/documents/{docType}/{id}`: View document screen header, seller, customer, line items, summary, GST status, and action flags.
- `GET    /api/admin/billing/client-directory/{clientId}/documents/{docType}/{id}/pdf`: Document PDF view/download stream or JSON descriptor.
- `POST   /api/admin/billing/client-directory/{clientId}/documents/{docType}/{id}/cancel`: Cancel active document with optional reason (max 200).
- `DELETE /api/admin/billing/client-directory/{clientId}/documents/{docType}/{id}`: Soft delete active or cancelled document via `InvoiceService::adminSoftDelete`.
- `PATCH  /api/admin/billing/client-directory/{clientId}/documents/{docType}/{id}/creation-date`: Update creation date preserving time of day in IST.

### 2. Controller & Service Implementation
- **Controller (`AdminBillingDocumentController.php`)**:
  - Validates `docType` against allowed types (`tax_invoice`, `bill_of_supply`, `debit_note`, `credit_note`, `quotation`, `delivery_challan`), returning 404 on invalid type.
  - Client and document ownership validation (returns 404 if client or document does not match).
  - List endpoint transforms document records with serial numbering, raw status, customer type (`B2B` | `B2C`), amounts, and returns paginator without N+1 queries.
  - View endpoint computes single-source flags (`can_edit_creation_date`, `can_cancel`, `can_delete`), GST status via `AdminBillingLockService`, line items, and summary.
  - PDF endpoint generates PDF using the document layout via 2B DomPDF renderer.
  - Cancel endpoint blocks when GST is filed or document is already cancelled; updates `status = 'cancelled'`, `cancellation_reason`, `cancelled_at`, and `cancelled_by`.
  - Delete endpoint allows active and cancelled documents; delegates to `InvoiceService::adminSoftDelete`; blocks duplicate deletion with 422.
  - Creation date PATCH endpoint checks active status, current period GST lock, future date in IST, selected FY bounds, target period GST lock, preserves existing time of day in IST, and stores UTC timestamp in database.
- **Service Extension (`AdminBillingCountService.php`)**:
  - `B2B_CONDITION_SQL`: Single COALESCE-safe SQL expression ensuring `B2B + B2C = All` across all queries and counts.
  - `isB2b(?Customer $customer)`: Pure helper for row-level B2B determination.
  - `getDocumentCards(int $clientProfileId, string $type, string $from, string $to)`: Computes the 5 document cards (Total, B2B, B2C, Cancelled, Deleted) for the FY independently of search/date/status filters.
  - `getDocumentListQueryAndTotals(...)`: Unified query builder and filtered totals calculator over the full filtered result set across all pages without second query paths.
  - `computeDocumentFlags(...)` & `formatSeller(...)`: Centralized View screen helpers.

### 3. Automated Tests (`tests/Feature/AdminBilling3BEndpointsTest.php`)
- 18 feature tests (125 assertions) covering:
  1. 404 handling on invalid `docType`, missing client, wrong client document, and mismatched docType.
  2. Financial year format and boundary validation (422 on invalid, 200 on valid).
  3. Draft documents exclusion from list and cards.
  4. Deleted documents isolation (shown only in Deleted tab or `status=deleted`).
  5. Cancelled documents display and counting in All, B2B, and Cancelled tabs.
  6. Mathematical equivalence `B2B + B2C = Total` across all customer permutations (registered, unregistered, empty status, no customer).
  7. Cards persistence independently of search, date range, and status filters.
  8. Filtered totals accuracy across pages and per tab (excluding Cancelled/Deleted on All/B2B/B2C tabs; totaling own rows on Cancelled and Deleted tabs).
  9. Search by number, customer name, and GSTIN with wildcard characters (`%`, `_`) safely escaped with `ESCAPE '!'`.
  10. Invoice date range filtering and FY boundary dates (31 Mar, 1 Apr).
  11. Creation date range filtering using IST day boundaries.
  12. View screen response shape, regular client GST status ('Not Filed' -> 'Filed'), and action flags.
  13. Composition client CMP-08 filing lock on FY quarter boundaries.
  14. GST-OFF client never locks (`gst.status = '-'`).
  15. Cancel endpoint validation (reason max 200, auth user attribution, duplicate and filed blocks).
  16. Delete endpoint validation (active/cancelled allowed, duplicate deleted blocked, reference and filing request blocks).
  17. Creation date patch endpoint (future date blocked, outside FY blocked, target period filed blocked, existing IST time of day preserved).
  18. PDF endpoint response (JSON descriptor with URL and inline PDF stream with Content-Type `application/pdf`).


