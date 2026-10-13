# Module 3: Billing (PDF pages 31-55)

Read `00-overview.md` first. This file covers Billing only. PDF text is the source of truth for behaviour; mockups are for visuals only (known mockup errors listed at the bottom).

## Flow
Billing -> Client List -> Client Dashboard -> Document Type -> Document List -> View Document.
Six document types: Tax Invoice, Bill of Supply, Debit Note, Credit Note, Quotation, Delivery Challan.
All data is client-wise and follows the selected Financial Year.

## Stages
- **Step 0 / 0b (map, no code):** done 11 Oct 2026. Findings are folded into the Decisions below and into the Billing code map in `00-overview.md`.
- **3A:** Client List + Client Dashboard (cards, donut, monthly bar chart). PDF pp 31-35. Starts with 3A-0: make the admin header Financial Year real shared state (new admin FY context, API param `fy`, e.g. `2026-27`), then the shared count source and new admin endpoints.
- **3B:** Tax Invoice list + View screen, built `documentType`-driven from day one. PDF pp 40-52. Starts with a read-only check of how `BillingPolicy::isPeriodFiled` treats `return_type`.
- **3C:** Quotation + Delivery Challan view (pp 35-39), then rollout to Bill of Supply, Debit Note, Credit Note (pp 53-55).
- Stop after each stage and wait for "go".

## Global rules for this module
- Do not hard-code "Tax Invoice" in common billing components. Every label, breadcrumb, card, tab, placeholder, popup, empty state, PDF and message comes from `documentType`.
- Tax Invoice behaviour is the base for all six types.
- Reuse the 2B DomPDF renderer and the 2B per-client numbering. Do not duplicate `GstPeriodService`.
- Any DB change is a Laravel migration (SQLite and MySQL safe) and goes in `changes.md`.

## Decisions (settled; 2, 3, 5, 6, 7, 11 revised after Step 0/0b)
1. **Numbering:** 2B configurable numbering stays. View header shows the allocated number. Quotation default prefix `QUO` -> `QT` for new clients only: the only place still on `QUO` is the fallback in `InvoiceService::resolveNumberingConfig`; the legacy column default and draft prefix are already `QT`. Existing clients keep saved settings. PDF examples (`INV-001`, `QT-001`, ...) are examples only.
2. **GST Status (Filed / Not Filed), Filed on, ARN:** read from `client_gst_returns` (`status='filed'`, `filed_on`, `ack_no`), the same table the existing billing lock uses. No new invoice columns, no migration for this.
   - Period is computed from the document's creation date (`created_at`), as the lock does today. Do not change `BillingPolicy::periodOf()` (client portal depends on it). Add a new admin-side method that picks the period shape from `gstr1_filing_frequency` (QRMP = monthly GSTR-1) and reuses the same period formatting.
   - Return type: Regular and QRMP clients -> `GSTR1`; Composition -> `CMP08`. GST-OFF clients: GST Status shows `-` and the document is never locked.
   - The admin-side backend block for Edit / Edit Creation Date / Cancel / Delete must use this same new method, not `assertNotLocked()` (which uses `periodOf()` and gives the wrong period for QRMP). Otherwise the screen would say Filed while the API still allows the change.
   - Known gap (decided, not fixed here): the client-portal lock still uses the quarterly period for QRMP, so a QRMP invoice can stay editable there after GSTR-1 is filed. Existing behaviour, not caused by Module 3. Must be in `changes.md` and Parked; lead informed by message.
   - Known drift: `GstReturnController::store` can delete a `client_gst_returns` row while `gst_filing_requests` still says "GST Filed". `client_gst_returns` wins (it is what locks edits).
3. **Delete:** migration adds `deleted_at`; `CommercialDocument` gets the `SoftDeletes` trait and `status='deleted'` is set on delete (`status` is a plain string, no enum migration). The trait hides Deleted rows from client-portal queries; the admin Deleted tab uses `onlyTrashed()`. Keep the existing blocks (referenced by other documents, attached to a `gst_filing_request_document`). Daily scheduled command force-deletes (with line items) after the end of the next calendar month. No extra audit log: the existing `audit` middleware and the `ActivityLog` write (`deleted_document`) stay; the purge writes nothing. Legacy Firm Billing hard delete is left untouched. `routes/console.php` only schedules `backup:run` and no cron is documented, so the purge command and a `schedule:run` cron entry go in the `changes.md` deploy checklist.
4. **Email / WhatsApp: PARKED.** Findings: client-portal only, `Mail::raw` (PDF attachment not confirmed), `MAIL_MAILER=log`, `wa.me` links only, no admin endpoint, email/phone only on `customers`. Plan when unparked: separate small stage after 3B, admin endpoint reusing the email logic with PDF attached (Mailable), `wa.me` with the existing `share_token` link, buttons disabled with a message when customer email/phone is missing. Needs real SMTP details from the lead for testing.
5. **List, cards, totals:**
   - Column 1 is a serial `#`.
   - Status mapping on `status`: Active = issued + paid + partial; Cancelled = cancelled; Deleted = deleted. Drafts (`DRAFT-...` numbers) never appear in admin billing lists, cards or counts.
   - Cancelled rows show in All/B2B/B2C and count in Total/B2B/B2C cards (red badge).
   - Deleted rows show only in the Deleted tab (or Status = Deleted) and are not in Total.
   - Filtered Totals in All/B2B/B2C exclude Cancelled and Deleted amounts. Cancelled and Deleted tabs total their own rows.
   - Amount columns: Taxable = `taxable_amount`, IGST/CGST/SGST = `igst_amount`/`cgst_amount`/`sgst_amount`, Total = `grand_total` (includes round-off and TDS/TCS). All stored positive; Credit Note shows positive in its own list. Bill of Supply tax columns are 0 and show `-`. 2B PDFs have no TDS/TCS row, so list Total can differ from the printed amount when TDS/TCS is used (accepted).
6. **Cancel:** confirmation popup with an optional reason textarea (max 200). Migration adds `cancelled_by` (users FK, nullable); `cancelled_at` and `cancellation_reason` already exist. New admin cancel endpoint; the client-portal cancel (reason required, max 500) is unchanged. Status -> cancelled, number and original data preserved. Reason shown on View when present. For 3C: `InvoiceService::convert()` sets a converted Quotation to `cancelled`; a converted quotation must not look user-cancelled (use `converted_document_id`). Decide at 3C.
7. **Edit Creation Date:** no separate permission. Any staff/admin can edit billing today and there are no per-feature permissions, so this matches. Edits `created_at`. Enabled only for Active + GST Not Filed; disabled for Filed, Cancelled, Deleted (backend blocks too). New date: not in the future, inside the selected FY, may be earlier than the Invoice Date, and its filing period must not be already filed (otherwise the bill would move into a locked period). No extra audit beyond `updated_at`.
8. **Financial Year:** selected FY filters by Invoice Date (`document_date`) in the list, cards, tab counts, filtered totals, Cancelled/Deleted tabs. Invoice Date / Creation Date range filters are additional to FY, not overriding. The client-portal list still filters by `created_at`; that stays untouched. New admin endpoints use `document_date`.
9. **Counts everywhere** (Client List cards, Client Dashboard cards, donut, monthly bar): by `document_date` in selected FY, include Cancelled, exclude Deleted and Draft, from one shared query/service used by all admin billing endpoints so they always match the document list cards. Bar chart stacked vs grouped: decide from mockup.
10. **Quotation / Delivery Challan:** no GST Status, Filed on or ARN anywhere. Active: Edit, Edit Creation Date, Cancel, Delete, PDF, Email, WhatsApp always enabled. Cancelled: Edit, Edit Creation Date, Cancel disabled; Delete allowed. Deleted tab view-only. B2B/B2C tabs stay (by customer GSTIN). DC has optional E-Way Bill No. (`eway_bill_no` exists) and Remarks (no column; use `notes`). Quotation Terms & Conditions: per-document textarea (`terms`) for now.
11. **Client List scope:** all clients (GST ON/OFF, Active/Inactive). GST-OFF clients show `-` for GSTIN and Registration Type and appear only under Registration Type = All. QRMP counts as Regular. Null `dealer_type` / `registration_type` must not error. Columns: `client_code`, `business_name` (fallback `client_name`), `gstin`, `pan`, `constitution_type`, `registration_type`, status from `users.is_active` (eager load), `mobile`, `email`, address. The existing `billingDirectory` is too thin, so build a new endpoint. Constitution Type filter: the 2A list has overlapping values (Partnership / Partnership Firm, Private Limited / Private Limited Company). Decision: do not touch stored data or the 2A forms. The filter uses alias groups: "Partnership Firm" matches both `Partnership` and `Partnership Firm`; "Private Limited Company" matches both `Private Limited` and `Private Limited Company`. The dropdown shows 8 options, the table shows the stored value as is. Options and alias groups live in one place (backend, returned with the Client List response) so the frontend has no third copy of the list. A canonical list plus data migration is a later lead decision (Parked).
12. **Number reuse (supports 3):** the DB unique `commercial_documents(client_profile_id, type, number)` also covers Deleted rows and would crash a reused number (SQLSTATE 23000). Migration drops it and adds a plain index on the same columns (no partial/filtered unique, not MySQL/SQLite portable). Uniqueness moves to the app: `BillingPolicy::assertUniqueNumber` and the Tab 5 exact-duplicate check ignore Deleted rows (Cancelled rows still block, so Cancelled numbers are never reused), and `allocateNextNumber()` re-checks inside its `lockForUpdate` transaction (it does not call `assertUniqueNumber` today). Reuse happens when Next Number is set in Tab 5 (existing 409 gap warning stays). No automatic counter rollback on delete (default).
13. **Customers (B2B/B2C):** B2B = customer with `gst_status='registered'` and a `gstin`; everything else is B2C (existing `Customer` rule). Documents keep only `customer_id` (nullOnDelete), no snapshot: editing a customer changes old documents, deleting one blanks name/GSTIN and moves the document to B2C. Accepted for Module 3, listed in Parked.

## Screens (from PDF text)
### Client List (pp 31-33)
- Title "Client List", subtitle "View and manage all clients for billing and document generation."
- 6 cards (Tax Invoice, Bill of Supply, Debit Note, Credit Note, Quotation, Delivery Challan), dynamic counts.
- Search: Client Name / GSTIN / PAN / Client ID. Filters: Status (All/Active/Inactive), Constitution Type, Registration Type (All/Regular/Composition). Buttons: Search, Reset.
- Table: Client ID, Client Name, GSTIN, Constitution Type, Registration Type, Status, Action (View -> Client Dashboard).
- Pagination: "Showing 1 to 10 of 25 clients", Previous | 1 | 2 | 3 | Next.

### Client Dashboard (pp 33-35)
- Info card: Business Name, status, Client ID, GSTIN, Constitution Type, Registration Type, Mobile, Email, Address.
- 7 cards: Total Documents + six types, each with count and "View [Document] ->" opening that document list.
- Charts: Document Distribution (donut, centre = Total Documents) and Monthly Document Trend (bar, Apr to Mar of selected FY). Both follow selected client and FY.

### Document list (pp 40-46, Tax Invoice as base)
- Breadcrumb, client info strip, 5 cards (Total, B2B, B2C, Cancelled, Deleted), tabs with counts (All, B2B, B2C, Cancelled, Deleted).
- Search: document number, customer name, GSTIN; works together with tab, Invoice Date, Creation Date and Status filters.
- Status dropdown (All/Active/Cancelled/Deleted); Cancelled and Deleted tabs force it.
- Table: #, number, date, creation date, customer, GSTIN, type, taxable value, IGST, CGST, SGST, total, status, View.
- Filtered Totals (Taxable, IGST, CGST, SGST, Total). 10 per page; pagination works after filters/search. "Showing 1 to 10 of 45 invoices (B2B)".
- Indian number grouping, `-` for zero tax.

### View Document (pp 36-39, 47-52)
- Header "<Document> • <number>", date/time. Buttons: Back, Edit, Edit Creation Date, Download PDF, Email, WhatsApp, Cancel, Delete.
- Sender, Recipient, Document Information, item table (Sr, Particulars, HSN/SAC, QTY, UQC, Rate, GST %, Taxable Value), summary (taxable, CGST, SGST/IGST, grand total, amount in words), Terms & Conditions.
- Tax Invoice, Bill of Supply, Debit Note, Credit Note also show GST Status (Filed on, ARN when Filed). When Filed: Edit, Edit Creation Date, Cancel, Delete disabled; Back, Download PDF, Email, WhatsApp stay active.

## Mockup errors (do not copy)
- INV-006 is Cancelled in All/Cancelled tabs but Active in B2B tab; INV-014 is Active (Stellar Marketing) in B2B tab but Deleted (Old Customer) in Deleted tab.
- All-tab filtered total (Taxable 5,55,000) is smaller than the B2B-tab total (7,60,000). Totals come from the rules above, not the mockup.
- Mixed `0` and `-` for zero tax: use `-`.

## Open items
- 3C: how a converted Quotation is shown (Decision 6).
- 3B start: confirm whether `BillingPolicy::isPeriodFiled` filters by `return_type` (Decision 2 needs GSTR1 / CMP08 specifically).

## Parked
- Decision 4 (Email / WhatsApp), after 3B.
- Client-portal QRMP lock (`periodOf()` uses the quarterly period): fix later, needs lead's go because some invoices would become locked.
- Canonical Constitution Type list and migration of existing values (lead decision).
- Customer snapshot on documents (or blocking customer delete when documents exist).
- Client-level default Terms & Conditions.
- WhatsApp Business API.
- Automatic counter rollback when the latest document is deleted.
