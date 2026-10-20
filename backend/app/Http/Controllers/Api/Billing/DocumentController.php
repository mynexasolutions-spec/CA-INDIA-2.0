<?php

namespace App\Http\Controllers\Api\Billing;

use App\Http\Controllers\Api\Billing\Concerns\ResolvesBillingProfile;
use App\Http\Controllers\Controller;
use App\Models\CommercialDocument;
use App\Models\Customer;
use App\Models\DocumentPaymentLog;
use App\Models\Product;
use App\Services\Billing\BillingPolicy;
use App\Services\Billing\DocumentNumberingSettings;
use App\Services\Billing\InvoiceService;
use Carbon\Carbon;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class DocumentController extends Controller
{
    use ResolvesBillingProfile;

    public function __construct(private InvoiceService $invoices) {}

    private function profile(Request $request)
    {
        return $this->resolveBillingProfile($request);
    }

    /** Applies every list filter except `type` — shared by the row query and the
     *  type-breakdown summary cards, so cards reflect the same FY/date/status/search
     *  filters without being narrowed by the Document Type filter itself (spec §24). */
    private function applyCommonFilters($q, Request $request, bool $ignoreStatus = false)
    {
        // Listing/filtering/GST-period counting spec — driven by Date of Creation
        // (created_at), not the document's back-dated Document Date. whereDate() on
        // both ends keeps this portable/correct against the created_at timestamp
        // column even though the bound values below are date-only strings.
        // Billing launched at FY 2026-27 — an unconditional floor, independent of
        // whatever from/fy filter (or none) the request sends.
        $q->whereDate('created_at', '>=', BillingPolicy::MIN_BILLING_FY_START_DATE);

        // Amendment versions live in Amendment History only: they never appear in the normal billing
        // lists, counts or totals (only an explicit type=amendment request, used by that module, sees them).
        if ($request->input('type') !== 'amendment') {
            $q->where('type', '!=', 'amendment');
        }

        if ($ignoreStatus) {
            // Tab counts apply their own status condition per tab.
        } elseif ($request->filled('status')) {
            $q->where('status', $request->status);
        } else {
            // Cancelled documents move out of the normal working views (§18/§19) —
            // they stay fully searchable/viewable via an explicit status=cancelled filter.
            $q->where('status', '!=', 'cancelled');
        }
        if ($request->filled('party_id')) {
            $q->where('customer_id', $request->party_id);
        }
        if ($request->filled('from')) {
            $q->whereDate('created_at', '>=', $request->from);
        }
        if ($request->filled('to')) {
            $q->whereDate('created_at', '<=', $request->to);
        }
        // Document Date (Invoice Date) range — separate from Creation Date above.
        if ($request->filled('doc_from')) {
            $q->whereDate('document_date', '>=', $request->doc_from);
        }
        if ($request->filled('doc_to')) {
            $q->whereDate('document_date', '<=', $request->doc_to);
        }
        if ($request->filled('month')) {
            // YYYY-MM — real date bounds instead of a MySQL-only DATE_FORMAT() compare,
            // so this works identically on SQLite (current) and MySQL (per README).
            $start = Carbon::createFromFormat('Y-m-d', $request->month.'-01')->startOfMonth();
            $q->whereDate('created_at', '>=', $start->toDateString())
                ->whereDate('created_at', '<=', $start->copy()->endOfMonth()->toDateString());
        }
        if ($request->filled('fy')) {
            // FY like 2025-26 → Apr 1 2025 – Mar 31 2026
            [$y1] = explode('-', $request->fy);
            $start = sprintf('%d-04-01', (int) $y1);
            $end = sprintf('%d-03-31', (int) $y1 + 1);
            $q->whereDate('created_at', '>=', $start)->whereDate('created_at', '<=', $end);
        }
        if ($request->filled('q')) {
            $s = $request->q;
            $q->where(function ($w) use ($s) {
                $w->where('number', 'like', "%{$s}%")
                    ->orWhereHas('customer', fn ($c) => $c->where('name', 'like', "%{$s}%")
                        ->orWhere('gstin', 'like', "%{$s}%"));
            });
        }

        return $q;
    }

    public function index(Request $request)
    {
        $profile = $this->profile($request);
        // The "Deleted" tab reads the soft-deleted rows (deleted=1); every other view excludes them.
        $deletedTab = $request->boolean('deleted');
        $liveBase = $this->applyCommonFilters(
            CommercialDocument::where('client_profile_id', $profile->id),
            $request
        );
        $base = $deletedTab
            ? $this->applyCommonFilters(CommercialDocument::onlyTrashed()->where('client_profile_id', $profile->id), $request, true)
            : $liveBase;

        // Per-tab record counts for the list's tab bar (All / B2B / B2C / Cancelled / Deleted), using the same
        // date/search filters as the list but not the tab itself.
        $tabCounts = null;
        if ($request->filled('type')) {
            $docType = $request->input('type');
            $scoped = fn ($qq) => $this->applyCommonFilters($qq->where('client_profile_id', $profile->id)->where('type', $docType), $request, true);
            $live = fn () => $scoped(CommercialDocument::query())->where('status', '!=', 'cancelled');
            $registered = fn ($c) => $c->where('gst_status', 'registered');
            $tabCounts = [
                'all' => $live()->count(),
                'b2b' => $live()->whereHas('customer', $registered)->count(),
                'b2c' => $live()->whereDoesntHave('customer', $registered)->count(),
                'cancelled' => $scoped(CommercialDocument::query())->where('status', 'cancelled')->count(),
                'deleted' => $scoped(CommercialDocument::onlyTrashed())->count(),
            ];
        }

        // Per-type summary counts — computed from the FULL filtered set, not just the current page.
        $summaryTypes = ['tax_invoice', 'bill_of_supply', 'debit_note', 'credit_note', 'quotation', 'delivery_challan'];
        $typeCounts = [];
        foreach ($summaryTypes as $t) {
            $typeCounts[$t] = (clone $liveBase)->where('type', $t)->count();
        }
        // B2B (registered) vs B2C (unregistered) breakdown for tax invoices.
        $taxBase = (clone $liveBase)->where('type', 'tax_invoice');
        $typeCounts['tax_invoice_b2b'] = (clone $taxBase)
            ->whereHas('customer', fn ($q) => $q->where('gst_status', 'registered'))->count();
        $typeCounts['tax_invoice_b2c'] = (clone $taxBase)
            ->whereHas('customer', fn ($q) => $q->where('gst_status', 'unregistered'))->count();

        $q = clone $base;
        if ($request->filled('type')) {
            $q->where('type', $request->type);
        }
        // B2B/B2C tab filter — applied to the row query only, not to $base, so
        // type_counts (summary tiles) always reflect the full un-filtered set.
        if ($request->filled('gst_type')) {
            if ($request->gst_type === 'b2b') {
                $q->whereHas('customer', fn ($c) => $c->where('gst_status', 'registered'));
            } elseif ($request->gst_type === 'b2c') {
                // B2C = everything that is not a registered (B2B) party, including walk-in sales with no party.
                $q->whereDoesntHave('customer', fn ($c) => $c->where('gst_status', 'registered'));
            }
            // GSTR-1 lists show the GST % of each document.
            $q->with('lineItems:id,commercial_document_id,gst_rate');
        }

        // Filtered aggregate totals (spec §24) — over every row the list is currently showing (all pages,
        // current tab included), not just the visible page. Credit Notes reduce value, everything else adds
        // to it, but the sign only flips when the totals mix document types (no single type filter); a
        // filtered "Credit Notes" view shows its own plain positive total.
        $signed = fn (string $expr) => $request->filled('type')
            ? $expr
            : "CASE WHEN type = 'credit_note' THEN -($expr) ELSE ($expr) END";
        $totals = [
            'count' => (clone $q)->count(),
            'taxable_amount' => (float) (clone $q)->sum(DB::raw($signed('taxable_amount'))),
            'igst_amount' => (float) (clone $q)->sum(DB::raw($signed('igst_amount'))),
            'cgst_amount' => (float) (clone $q)->sum(DB::raw($signed('cgst_amount'))),
            'sgst_amount' => (float) (clone $q)->sum(DB::raw($signed('sgst_amount'))),
            'gst_amount' => (float) (clone $q)->sum(DB::raw($signed('cgst_amount + sgst_amount + igst_amount'))),
            'grand_total' => (float) (clone $q)->sum(DB::raw($signed('COALESCE(NULLIF(grand_total, 0), total_amount)'))),
        ];

        $q->with('customer:id,name,gstin,gst_status')->latest('created_at')->latest('id');
        if ($request->input('type') === 'amendment') {
            $q->with('referenceDocument:id,number,type');
        }

        $perPage = min(500, max(1, (int) $request->input('per_page', 25)));
        $paginated = $q->paginate($perPage);

        $filedPeriods = BillingPolicy::filedPeriods($profile);
        $submittedPeriods = BillingPolicy::submittedFilingPeriods($profile->id);
        $paginated->getCollection()->each(function (CommercialDocument $doc) use ($profile, $filedPeriods, $submittedPeriods) {
            // GST-period counting spec — a document's GST period is its Date of
            // Creation, not its (possibly back-dated) Document Date.
            $filed = $doc->created_at
                && in_array(BillingPolicy::periodOf($profile, $doc->created_at->toDateString()), $filedPeriods, true);
            $confirmationSubmitted = $doc->created_at
                && in_array($doc->created_at->format('Y-m'), $submittedPeriods, true);
            $doc->gst_return_filed = $filed;
            $doc->direct_edit_locked = $filed || $confirmationSubmitted;
        });

        $result = $paginated->toArray();
        $result['totals'] = $totals;
        $result['type_counts'] = $typeCounts;
        $result['tab_counts'] = $tabCounts;

        return response()->json($result);
    }

    /** Read-only preview of the number that will be allocated on Generate/Issue.
     *  Never increments the sequence — purely informational for the Create form. */
    public function nextNumber(Request $request)
    {
        $profile = $this->profile($request);
        $data = $request->validate([
            'type' => 'required|in:tax_invoice,bill_of_supply,credit_note,debit_note,quotation,amendment,proforma,delivery_challan',
        ]);
        BillingPolicy::assertDocumentType($profile, $data['type']);

        // Manual types: the client types the number, so suggest the next one that is still free.
        $manual = DocumentNumberingSettings::numberingType($profile, $data['type']) === 'manual';

        return response()->json([
            'number' => $manual
                ? $this->invoices->suggestManualNumber($profile, $data['type'])
                : $this->invoices->nextNumber($profile, $data['type']),
            'numbering_type' => $manual ? 'manual' : 'auto',
        ]);
    }

    /**
     * A typed document number is only honoured for document types an admin switched to manual
     * numbering; for auto types it is discarded so a client can never bypass the sequence.
     */
    private function guardManualNumber($profile, array $data, string $type): array
    {
        $number = isset($data['number']) ? trim((string) $data['number']) : '';
        if ($number === '' || DocumentNumberingSettings::numberingType($profile, $type) !== 'manual') {
            unset($data['number']);
        } else {
            $data['number'] = $number;
        }

        return $data;
    }

    public function store(Request $request)
    {
        $profile = $this->profile($request);
        $data = $this->validated($request, true, BillingPolicy::mode($profile) !== 'retail');
        $data = $this->guardManualNumber($profile, $data, $data['type'] ?? 'tax_invoice');
        // GST-period counting spec — a new document's period is its Date of Creation
        // (i.e. now), not whatever back-dated Document Date is being submitted.
        BillingPolicy::assertNotLocked($profile, now()->toDateString());
        $this->assertOwnedRelations($profile, $data, $data['type'] ?? 'tax_invoice');
        BillingPolicy::assertReferenceDocument($profile, $data['type'] ?? 'tax_invoice', $data['reference_document_id'] ?? null);
        $doc = $this->invoices->create($profile, $data);
        if (($data['status'] ?? 'draft') === 'issued') {
            try {
                $this->invoices->generatePdf($doc);
            } catch (\Throwable $e) {
            }
        }

        return response()->json($doc->fresh(['lineItems', 'customer', 'referenceDocument', 'tdsTcsSection']), 201);
    }

    public function update(Request $request, int $id)
    {
        $profile = $this->profile($request);
        $doc = CommercialDocument::where('client_profile_id', $profile->id)->findOrFail($id);
        // GST-period counting spec — locking is based on the document's own Date of
        // Creation (unchanged by this edit), not the Document Date being submitted.
        BillingPolicy::assertNotLocked($profile, $doc->created_at?->toDateString());

        $data = $this->validated($request, false, BillingPolicy::mode($profile) !== 'retail');
        $data = $this->guardManualNumber($profile, $data, $doc->type);

        $this->assertOwnedRelations($profile, $data, $doc->type);
        $doc = $this->invoices->updateDraft($doc, $profile, $data);

        return response()->json($doc);
    }

    public function convert(Request $request, int $id)
    {
        $profile = $this->profile($request);
        $doc = CommercialDocument::where('client_profile_id', $profile->id)->findOrFail($id);

        // The conversion target is fixed by the GST registration type. A request that asks for the
        // other document is rejected here (not just hidden in the UI).
        $data = $request->validate(['target_type' => 'nullable|string|in:tax_invoice,bill_of_supply']);
        $isComposition = $profile->dealer_type === 'composition';
        $expected = $isComposition ? 'bill_of_supply' : 'tax_invoice';
        if (! empty($data['target_type']) && $data['target_type'] !== $expected) {
            return response()->json([
                'message' => $isComposition
                    ? 'A Composition taxpayer can convert a quotation only to a Bill of Supply.'
                    : 'A Regular taxpayer can convert a quotation only to a Tax Invoice.',
            ], 422);
        }

        $invoice = $this->invoices->convertQuotation($doc, $profile);
        try {
            $this->invoices->generatePdf($invoice);
        } catch (\Throwable $e) {
        }

        return response()->json($invoice->fresh(['lineItems', 'customer', 'referenceDocument']));
    }

    public function duplicate(Request $request, int $id)
    {
        $profile = $this->profile($request);
        $doc = CommercialDocument::where('client_profile_id', $profile->id)->with('lineItems')->findOrFail($id);
        $copy = $this->invoices->duplicate($doc, $profile);

        return response()->json($copy, 201);
    }

    public function destroy(Request $request, int $id)
    {
        $profile = $this->profile($request);
        $doc = CommercialDocument::where('client_profile_id', $profile->id)->findOrFail($id);
        BillingPolicy::assertNotLocked($profile, $doc->created_at?->toDateString());

        $this->invoices->destroyQuotation($doc, $profile);

        return response()->json(['message' => 'Quotation deleted']);
    }

    public function cancel(Request $request, int $id)
    {
        $profile = $this->profile($request);
        $doc = CommercialDocument::where('client_profile_id', $profile->id)->findOrFail($id);
        $data = $request->validate(['reason' => 'required|string|max:500']);
        $doc = $this->invoices->cancel($doc, $data['reason']);

        return response()->json($doc);
    }

    public function amendments(Request $request, int $id)
    {
        $profile = $this->profile($request);
        $doc = CommercialDocument::where('client_profile_id', $profile->id)->findOrFail($id);
        $rows = CommercialDocument::where('client_profile_id', $profile->id)
            ->where('type', 'amendment')
            ->where('reference_document_id', $doc->id)
            ->with('customer:id,name,gstin,gst_status')
            ->latest('id')
            ->get();

        return response()->json(['original' => $doc->only(['id', 'number', 'type', 'status', 'document_date', 'grand_total']), 'data' => $rows]);
    }

    public function issue(Request $request, int $id)
    {
        $profile = $this->profile($request);
        $doc = CommercialDocument::where('client_profile_id', $profile->id)->findOrFail($id);
        BillingPolicy::assertNotLocked($profile, $doc->created_at?->toDateString());

        $doc = $this->invoices->issue($doc, $profile);

        return response()->json($doc);
    }

    public function setPaymentStatus(Request $request, int $id)
    {
        $profile = $this->profile($request);
        $doc = CommercialDocument::where('client_profile_id', $profile->id)->findOrFail($id);
        abort_unless(in_array($doc->status, ['issued', 'partial', 'paid'], true), 422, 'Only issued documents can be marked paid/unpaid');

        $data = $request->validate([
            'status'           => 'required|in:paid,unpaid,partial',
            'paid_on'          => 'nullable|date',
            'payment_mode'     => 'nullable|string|max:30',
            'reference_number' => 'nullable|string|max:120',
            'received_by'      => 'nullable|string|max:200',
            'paid_amount'      => 'nullable|numeric|min:0',
            'remarks'          => 'nullable|string|max:500',
            'unmark_reason'    => 'nullable|string|max:500',
        ]);

        // The status never changes without the information that justifies it — enforced here so every caller
        // (Billing -> Document View and Reports -> Outstanding) follows the same rules as the pop-ups.
        if ($data['status'] === 'paid') {
            $request->validate([
                'paid_on'          => 'required|date',
                'payment_mode'     => ['required', Rule::in(['UPI', 'Bank Transfer', 'Cheque', 'Cash', 'Others'])],
                'reference_number' => [Rule::requiredIf(fn () => in_array($request->input('payment_mode'), ['UPI', 'Bank Transfer', 'Cheque'], true)), 'nullable', 'string', 'max:120'],
                'received_by'      => [Rule::requiredIf(fn () => $request->input('payment_mode') === 'Cash'), 'nullable', 'string', 'max:200'],
            ], [
                'paid_on.required'          => 'Payment date is required.',
                'payment_mode.required'     => 'Payment mode is required.',
                'reference_number.required' => 'Reference number is required for UPI, Bank Transfer and Cheque payments.',
                'received_by.required'      => "'Received By' is required for Cash payments.",
            ]);
        } elseif ($data['status'] === 'unpaid') {
            $request->validate(
                ['unmark_reason' => ['required', 'string', 'max:500', 'regex:/\S/']],
                ['unmark_reason.required' => 'Reason for unmarking is required.', 'unmark_reason.regex' => 'Reason for unmarking is required.']
            );
        }

        $newStatus = $data['status'] === 'unpaid' ? 'issued' : $data['status'];

        $now = now();
        $action = $data['status'] === 'paid' ? 'mark_paid' : 'unmark_paid';

        DocumentPaymentLog::create([
            'commercial_document_id' => $doc->id,
            'client_profile_id'      => $profile->id,
            'action'                 => $action,
            'paid_on'                => $data['paid_on'] ?? null,
            'payment_time'           => $action === 'mark_paid' ? $now->format('h:i A') : null,
            'payment_mode'           => $data['payment_mode'] ?? null,
            'reference_number'       => $data['reference_number'] ?? null,
            'received_by'            => $data['received_by'] ?? null,
            'paid_amount'            => $data['paid_amount'] ?? ($doc->grand_total ?: $doc->total_amount),
            'remarks'                => $data['remarks'] ?? null,
            'unmark_reason'          => $data['unmark_reason'] ?? null,
            'recorded_by'            => $request->user()?->id,
        ]);

        $doc->update(['status' => $newStatus]);

        return response()->json($doc->fresh(['customer', 'lineItems']));
    }

    public function paymentLog(Request $request, int $id)
    {
        $profile = $this->profile($request);
        $doc = CommercialDocument::where('client_profile_id', $profile->id)->findOrFail($id);

        $logs = DocumentPaymentLog::where('commercial_document_id', $doc->id)
            ->orderBy('created_at', 'desc')
            ->get();

        $latest = $logs->where('action', 'mark_paid')->first();

        return response()->json([
            'latest'  => $latest,
            'history' => $logs->values(),
        ]);
    }

    public function preview(Request $request)
    {
        $profile = $this->profile($request);
        $data = $this->validated($request, false, BillingPolicy::mode($profile) !== 'retail');
        $this->assertOwnedRelations($profile, $data, $data['type'] ?? 'tax_invoice');
        $preview = $this->invoices->preview($profile, $data);
        if (! empty($data['customer_id'])) {
            $preview['customer'] = Customer::where('client_profile_id', $profile->id)
                ->find($data['customer_id']);
        }

        return response()->json($preview);
    }

    public function show(Request $request, int $id)
    {
        $profile = $this->profile($request);
        $doc = CommercialDocument::where('client_profile_id', $profile->id)
            ->with(['lineItems', 'customer', 'clientProfile', 'referenceDocument', 'tdsTcsSection'])
            ->findOrFail($id);
        $doc->gst_return_filed = BillingPolicy::isPeriodFiled($profile, $doc->created_at?->toDateString());
        $doc->direct_edit_locked = BillingPolicy::isDirectEditLocked($profile, $doc->created_at?->toDateString());

        return response()->json($doc);
    }

    public function pdf(Request $request, int $id)
    {
        $doc = CommercialDocument::where('client_profile_id', $this->profile($request)->id)->findOrFail($id);
        // Always regenerate so branding/bank/terms and template updates reflect live client data.
        $this->invoices->generatePdf($doc);
        $doc->refresh();

        return response()->json(['url' => '/storage/'.$doc->pdf_path, 'path' => $doc->pdf_path]);
    }

    public function emailDocument(Request $request, int $id)
    {
        $doc = CommercialDocument::where('client_profile_id', $this->profile($request)->id)
            ->with(['customer', 'clientProfile'])->findOrFail($id);
        $data = $request->validate(['email' => 'nullable|email']);
        $to = $data['email'] ?? $doc->customer?->email;
        abort_unless($to, 422, 'No email address available');
        // Regenerate so the attached PDF reflects live branding/bank/terms, same as the
        // Download PDF action.
        $this->invoices->generatePdf($doc);
        $doc->refresh();
        $pdfAbsolutePath = Storage::disk('public')->path($doc->pdf_path);
        $pdfFilename = $doc->number.'.pdf';
        try {
            Mail::raw(
                "Please find your {$doc->type} {$doc->number} attached. Total: INR ".($doc->grand_total ?: $doc->total_amount),
                function ($m) use ($to, $doc, $pdfAbsolutePath, $pdfFilename) {
                    $m->to($to)
                        ->subject(strtoupper(str_replace('_', ' ', $doc->type)).' '.$doc->number)
                        ->attach($pdfAbsolutePath, ['as' => $pdfFilename, 'mime' => 'application/pdf']);
                }
            );
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Mailer: '.$e->getMessage(), 'pdf' => '/storage/'.$doc->pdf_path]);
        }

        return response()->json(['message' => 'Invoice emailed to '.$to]);
    }

    public function share(Request $request, string $token)
    {
        $doc = CommercialDocument::where('share_token', $token)
            ->with(['lineItems', 'customer', 'clientProfile', 'referenceDocument'])
            ->firstOrFail();

        // Optional JSON for API clients: /api/billing/share/{token}?format=json
        if ($request->query('format') === 'json') {
            return response()->json($doc);
        }

        if (! $doc->pdf_path || ! Storage::disk('public')->exists($doc->pdf_path)) {
            $this->invoices->generatePdf($doc);
            $doc->refresh();
        }

        $path = Storage::disk('public')->path($doc->pdf_path);
        $filename = preg_replace('/[^A-Za-z0-9\-_.]/', '_', $doc->number).'.pdf';

        return response()->file($path, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$filename.'"',
        ]);
    }

    private function validated(Request $request, bool $requireLines = true, bool $requireHsn = true): array
    {
        $rules = [
            'type' => 'nullable|in:tax_invoice,bill_of_supply,credit_note,debit_note,quotation,amendment,proforma,delivery_challan',
            // Only used for manual-numbering types (see guardManualNumber). GST: max 16 chars, letters/digits/-//.
            'number' => ['nullable', 'string', 'max:16', 'regex:/^[A-Za-z0-9\/\-]+$/'],
            'customer_id' => 'nullable|integer',
            'reference_document_id' => 'nullable|integer',
            'document_date' => 'nullable|date',
            'due_date' => 'nullable|date',
            'place_of_supply' => 'nullable|string|max:120',
            'payment_terms' => 'nullable|string|max:200',
            'currency' => 'nullable|string|max:3',
            'is_inter_state' => 'boolean',
            'is_reverse_charge' => 'boolean',
            'notes' => 'nullable|string',
            'terms' => 'nullable|string',
            'status' => 'nullable|in:draft,issued,cancelled,paid,partial',
            'round_off' => 'nullable|numeric',
            'tax_deduction_type' => 'nullable|in:tds,tcs',
            'tds_tcs_section_id' => 'nullable|integer|exists:tds_tcs_sections,id',
            'lines' => ($requireLines ? 'required|' : 'nullable|').'array|min:1',
            'lines.*.description' => 'required_with:lines|string|max:255',
            'lines.*.qty' => 'required_with:lines|numeric',
            'lines.*.rate' => 'required_with:lines|numeric',
            'lines.*.gst_rate' => ['nullable', 'numeric', Rule::in(BillingPolicy::GST_RATES)],
            'lines.*.hsn_sac' => array_merge(
                [$requireHsn ? 'required' : 'nullable', 'string'],
                [Rule::exists('hsn_sac_codes', 'code')]
            ),
            'lines.*.unit' => 'nullable|string',
            'lines.*.discount_percent' => 'nullable|numeric',
            'lines.*.discount_amount' => 'nullable|numeric',
            'lines.*.product_id' => 'nullable|integer',
            // Delivery Challan spec — only meaningful when type = delivery_challan, but kept
            // nullable/unconditional so other document types never trip this validation.
            'reason_for_transportation' => 'nullable|in:job_work,repair,returnable_goods,branch_transfer,other',
            'reason_for_transportation_other' => 'nullable|required_if:reason_for_transportation,other|string|max:200',
            'vehicle_no' => 'nullable|string|max:20',
            'transporter_name' => 'nullable|string|max:150',
            'eway_bill_no' => 'nullable|string|max:30',
            'receiver_name' => 'nullable|string|max:150',
            'receiver_signature_datetime' => 'nullable|date',
        ];

        return $request->validate($rules);
    }

    private function assertOwnedRelations($profile, array $data, ?string $fallbackType = null): void
    {
        $type = $data['type'] ?? $fallbackType ?? 'tax_invoice';

        if (! empty($data['customer_id'])) {
            abort_unless(
                Customer::where('client_profile_id', $profile->id)->where('id', $data['customer_id'])->exists(),
                422,
                'Selected party does not belong to your account.'
            );
        }

        if (! empty($data['reference_document_id'])) {
            $ref = CommercialDocument::where('client_profile_id', $profile->id)
                ->where('id', $data['reference_document_id'])->first();
            abort_unless($ref, 422, 'Selected reference invoice does not belong to your account.');
            if (in_array($type, ['credit_note', 'debit_note', 'amendment'], true)) {
                BillingPolicy::assertReferenceDocument($profile, $type, $data['reference_document_id'], $ref);
            }
        } elseif (in_array($type, ['credit_note', 'debit_note', 'amendment'], true)) {
            abort(422, $type === 'amendment'
                ? 'Original bill is required for amendments.'
                : 'Original invoice number and date are required for credit/debit notes.');
        }

        foreach ($data['lines'] ?? [] as $line) {
            if (empty($line['product_id'])) {
                continue;
            }
            abort_unless(
                Product::where('client_profile_id', $profile->id)->where('id', $line['product_id'])->exists(),
                422,
                'Selected product does not belong to your account.'
            );
        }
    }
}
