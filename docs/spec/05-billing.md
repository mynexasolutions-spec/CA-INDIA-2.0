# Module 3: Billing (PDF pages 31-55)

Read `00-overview.md` first. This file covers Billing only. PDF text is the source of truth for behaviour; mockups are for visuals only (known mockup errors listed at the bottom).

## Flow
Billing -> Client List -> Client Dashboard -> Document Type -> Document List -> View Document.
Six document types: Tax Invoice, Bill of Supply, Debit Note, Credit Note, Quotation, Delivery Challan.
All data is client-wise and follows the selected Financial Year.

## Stages
- **Step 0 (map, no code):** see checklist at the end.
- **3A:** Client List + Client Dashboard (cards, donut, monthly bar chart). PDF pp 31-35.
- **3B:** Tax Invoice list + View screen, built `documentType`-driven from day one. PDF pp 40-52.
- **3C:** Quotation + Delivery Challan view (pp 35-39), then rollout to Bill of Supply, Debit Note, Credit Note (pp 53-55).
- Stop after each stage and wait for "go".

## Global rules for this module
- Do not hard-code "Tax Invoice" in common billing components. Every label, breadcrumb, card, tab, placeholder, popup, empty state, PDF and message comes from `documentType`.
- Tax Invoice behaviour is the base for all six types.
- Reuse the 2B DomPDF renderer and the 2B per-client numbering. Do not duplicate `GstPeriodService`.
- Any DB change is a Laravel migration (SQLite and MySQL safe) and goes in `changes.md`.

## Decisions (settled)
1. **Numbering:** 2B configurable numbering stays. View header shows the allocated number. Quotation default prefix changes `QUO` -> `QT` for new clients only; existing clients keep saved settings. PDF examples (`INV-001`, `QT-001`, `DC-001`, `DN-001`, `CN-001`, `BOS-001`) are examples only.
2. **GST Status (Filed / Not Filed), Filed on, ARN:** derived from the filing request of the invoice's period (no new invoice columns). QRMP: GSTR-1 filing is the relevant one. Step 0 must confirm `gst_filing_requests` stores ARN and filed-on date; if not, a small migration is needed.
3. **Delete:** status `Deleted` + `deleted_at`. Daily scheduled command hard-deletes (with line items) after the end of the next calendar month. No audit log. Deleted numbers can be reused: check at allocation time (inside the existing `lockForUpdate` transaction), not via a DB unique index that covers deleted rows. Cancelled numbers are never reused. Scheduler must be in the `changes.md` deploy checklist.
4. **Email / WhatsApp: PARKED** until the repo is checked (mail config, recipient email/mobile fields, PDF templates for non-invoice types). Leaning: Laravel Mail with PDF attachment + `wa.me` link; WhatsApp Business API later.
5. **List, cards, totals:**
   - Column 1 is a serial `#`.
   - Cancelled rows show in All/B2B/B2C and count in Total/B2B/B2C cards (red badge).
   - Deleted rows show only in the Deleted tab (or Status = Deleted) and are not in Total.
   - Filtered Totals in All/B2B/B2C exclude Cancelled and Deleted amounts. Cancelled and Deleted tabs total their own rows.
6. **Cancel:** confirmation popup with an optional reason textarea (max 200). Store `cancelled_at`, `cancelled_by`, optional reason. Status Active -> Cancelled, number and original data preserved. Reason shown on View when present.
7. **Edit Creation Date:** no separate permission; uses existing invoice-edit access. Enabled only for Active + GST Not Filed. Disabled for Filed, Cancelled, Deleted (backend blocks too). Creation Date: not in the future, inside the selected FY, may be earlier than Invoice Date. No extra audit beyond `updated_at`. Step 0: check staff access levels.
8. **Financial Year:** selected FY filters by Invoice Date (list, cards, tab counts, filtered totals, Cancelled/Deleted tabs). Invoice Date / Creation Date range filters are additional to FY, not overriding.
9. **Counts everywhere** (Client List cards, Client Dashboard cards, donut, monthly bar): by Document Date in selected FY, include Cancelled, exclude Deleted, from one shared source so they always match the document list cards. Bar chart stacked vs grouped: decide from mockup.
10. **Quotation / Delivery Challan:** no GST Status, Filed on or ARN anywhere. Active: Edit, Edit Creation Date, Cancel, Delete, PDF, Email, WhatsApp always enabled. Cancelled: Edit, Edit Creation Date, Cancel disabled; Delete allowed. Deleted tab view-only. B2B/B2C tabs stay (by customer GSTIN). DC has optional E-Way Bill No. and Remarks. Quotation Terms & Conditions: per-document textarea for now (client-level default later).
11. **Client List scope:** all clients (GST ON/OFF, Active/Inactive). GST-OFF clients show `-` for GSTIN and Registration Type and appear only under Registration Type = All. QRMP counts as Regular. Constitution Type filter options come from the 2A dropdown values. Null `dealer_type` / `registration_type` must not error.

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

## Step 0 checklist (code map, no changes)
- What already exists for billing: `/admin/billing`, `/admin/clients/:id/billing`, `/admin/firm-billing/*`; which pages, components, controllers, tables.
- Tables/models for Tax Invoice, Bill of Supply, Debit/Credit Note, Quotation, Delivery Challan: which exist, columns, statuses, soft delete.
- Does `gst_filing_requests` store ARN and filed-on date; how period maps to an invoice date (`GstPeriodService`).
- 2B DomPDF templates: which document types have one; state of `invoice.new_renderer`.
- Mail config in `.env`/config; customer email and mobile fields on invoices.
- Staff access levels (`/admin/staff`) and how invoice edit access is checked.
- Laravel scheduler/cron setup for the daily purge command.
- Unique indexes on document numbers that would block reuse.

## Parked
- Decision 4 (Email / WhatsApp), after Step 0.
- Client-level default Terms & Conditions.
- WhatsApp Business API.
