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


