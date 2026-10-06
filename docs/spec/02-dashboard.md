# 02 - Dashboard (PDF Module 1, pages 8-10)

Scope: Admin Dashboard data logic only. Do NOT redesign the layout, add new pages or invent new widgets.
Step 1: map existing code for each section below and answer the Open Questions. Step 2: implement only what is marked CHANGE.

## 1. GST Return Status - CHANGE
- Show only returns with status Pending / Due / Overdue.
- Never show Filed returns. When a return gets filed it disappears from this table automatically.

## 2. GST Filing Requests - CHANGE
Show a request only if action is still pending:
| Confirmation | Filing       | Show? |
|--------------|--------------|-------|
| Received     | Pending      | YES   |
| Pending      | Not Started  | YES   |
| Received     | Filed        | NO    |
Any other combination: see Open Question Q2.

## 3. Client Request Overview - CHANGE
- Per request type show: Total, Pending, Approved, Rejected.
- Example: Profile Update = Total 18, Pending 12, Approved 5, Rejected 1.
- Counts come from actual request status (dynamic, no hardcoded numbers).
- New request = Pending. Admin approves = Approved. Admin rejects = Rejected.
- Approved/Rejected must not count in Pending. Total = all requests in the selected period.

## 4. Upcoming Due Dates - CHANGE
Show only applicable returns whose due date falls in the CURRENT month. Do not list every return every month.
Applicability depends on: client type, GST registration type (Regular/Composition), filing frequency (Monthly / QRMP), current FY, current month, due date.

Fixed row order (never change):
1. GSTR-1 (Monthly)    - due 11th of next month
2. GSTR-3B (Monthly)   - due 20th of next month
3. GSTR-1 (QRMP)       - due 13th of next month
4. GSTR-3B (Quarterly) - due 22nd of the month after quarter end (Apr-Jun -> 22 Jul)
5. CMP-08              - due 18th of the month after quarter end (Apr-Jun -> 18 Jul)

Rules:
- Monthly clients: rows 1, 2 every month.
- QRMP clients: row 3 monthly, row 4 only in Jan / Apr / Jul / Oct.
- Composition clients: only row 5, only in Jan / Apr / Jul / Oct.
- Quarterly rows are hidden in all other months.
- Table layout: see crop image of PDF page 10 (to be attached).

## Dependency on Module 2 (Clients)
Registration Type, Filing Frequency and Applicable From date are specified in Module 2 (GST Filing Frequency).
Use whatever fields already exist. If a field does not exist yet, do NOT build the Module 2 screens here: report it and use a clearly marked fallback.

## Open Questions (answer from code, do not guess)
Q1. Where does each of the 4 dashboard sections get its data (endpoint/controller + component)? Do status fields exist for return status, confirmation status, filing status, request status?
Q2. Filing Requests: what should happen for Confirmation=Pending + Filing=Filed, or Received + Not Started? (Proposed: hide only when Filing = Filed.) Needs lead confirmation.
Q3. Client Request Overview: is there a "selected period" filter today? Which request types exist in the DB?
Q4. Does the client record already store registration type and filing frequency (Monthly / QRMP / Composition)? Under what column names?
Q5. Is there any existing due-date calculation (backend or frontend)? Reuse it instead of writing a second one.
Q6. Any backend change must be a migration (SQLite + MySQL compatible) and logged in changes.md. Never touch prod DB.

## Flag for lead (PDF ambiguity)
- Item 7 text is garbled ("GSTR-1 should follow whose filing frequency is Monthly"). Real GST rule: QRMP GSTR-1 is quarterly, due 13th after the quarter. This spec follows the PDF (monthly row, due 13th) and Module 2 (QRMP -> GSTR-1 QRMP = Monthly). Confirm with lead.

## DECISIONS (after code map)
- None of the 4 sections exist on /admin yet. Build them as NEW widgets in AdminOverview.jsx, below the existing 3 client cards. Do not touch the cards.
- Reuse existing endpoints/logic where possible. Add new admin endpoints only if needed.
- Filing Requests: show every request where status != 'GST Filed'.
- Client Request Overview: 3 groups (Profile/Settings Changes, Document Edit Requests, GST Filing Requests), each with Total/Pending/Approved/Rejected. All-time counts, no period filter for now.
- Upcoming Due Dates: reuse buildPeriods from Api/Client/GstReturnController (extract into a shared service, do not duplicate). Applicable From is missing, skip it for now.
- Change log file is changes.md (not DATA_CHANGES.md). Local DB only, never prod.

## MOCKUP CORRECTIONS (PDF page 10 screenshot). These override DECISIONS above where they conflict.
- Layout reference: the full dashboard screenshot of PDF page 10. Follow its layout and order.
- Top card row = 5 cards: Total Clients, Active Clients, Inactive Clients (existing, do not change) + NEW Client Requests (total, "N Pending") + NEW GST Filing Requests (total, "N Pending"), each with a "View ..." link.
- Below cards: 2 summary strips.
  - GST Return Status: Total Returns Due, Pending, Overdue, Filed (counts).
  - GST Filing Request Summary: Total Requests, Confirmation Pending, Confirmed, Filed (counts).
- Then 4 tables in a 2x2 grid: GST Return Status, GST Filing Requests, Client Request Overview, Upcoming Due Dates. Each has a "View All" link.
- Mockup rows are SAMPLE data. The text rules win: do not list Filed returns/requests in the tables (Filed only appears in strip counts). Quarterly rows appear only in their due month.
- Upcoming Due Dates columns: Return Type, Due Date, No. of Clients, Status (Overdue / In N Days).
- GST Return Status columns: Client Name, GSTIN, Return Type, Due Date, Status, Action (View).
- GST Filing Requests columns: Client Name, Return Type, Due Date, Confirmation Status, Filing Status, Action (View).
  DB has a single status column. Derive: Confirmation = Received if client_declaration is true. Filing = Filed if status = 'GST Filed', else Pending.
  "Confirmation Pending / Not Started" cannot exist today. Show 0 for it in the strip and flag it for the lead.
- Client Request Overview rows (replaces the 3-group decision): Profile Update, Document Change, Bank Details, Invoice Settings, Others.
  Mapping: Document Change = document_edit_requests. Bank Details = client_change_requests section 'bank'. Invoice Settings = section 'invoice_settings'. Others = 'branding', 'numbering' and anything else.
  Profile Update: no matching section exists today. Show the row with 0 and flag it for the lead. Do not invent a new request type.
- Top card "Client Requests" = sum of all request rows above. Card "GST Filing Requests" = total filing requests.

## KNOWN LIMITATION (revisit after Module 2)
- Overdue/Pending currently check only the previous filing cycle (last month, or last quarter for quarterly clients). Unfiled returns from older periods in the FY are not counted.
- Fix needs the "Applicable From" date (Module 2, GST Filing Frequency), so periods before a client's start date are not wrongly counted as overdue. Once that field exists, extend the check to all applicable unfiled periods in the FY.
- Lead question: should the dashboard count all older unfiled periods as Overdue?
