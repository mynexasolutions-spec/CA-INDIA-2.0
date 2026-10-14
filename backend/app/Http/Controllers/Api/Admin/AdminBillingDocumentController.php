<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClientProfile;
use App\Models\CommercialDocument;
use App\Services\Billing\AdminBillingCountService;
use App\Services\Billing\AdminBillingLockService;
use App\Services\Billing\InvoiceService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class AdminBillingDocumentController extends Controller
{
    public function __construct(
        private readonly AdminBillingCountService $countService,
        private readonly InvoiceService $invoiceService
    ) {}

    /**
     * Document List (PDF pp 40-46, Tax Invoice as base, documentType-driven).
     * Includes client strip, FY, cards, filtered totals, and paginated documents.
     */
    public function index(Request $request, int $clientId, string $docType): JsonResponse
    {
        $this->assertValidDocType($docType);

        $client = ClientProfile::with('user:id,name,email,phone,is_active')->findOrFail($clientId);
        $fyData = $this->countService->resolveFy($request->query('fy'));

        $cards = $this->countService->getDocumentCards($client->id, $docType, $fyData['from'], $fyData['to']);
        [$query, $filteredTotals] = $this->countService->getDocumentListQueryAndTotals(
            $client,
            $docType,
            $fyData['from'],
            $fyData['to'],
            $request
        );

        $perPage = min(max((int) $request->query('per_page', 10), 1), 100);
        $paginator = $query->select('commercial_documents.*')
            ->with('customer:id,name,gstin,gst_status')
            ->orderBy('commercial_documents.document_date', 'desc')
            ->orderBy('commercial_documents.id', 'desc')
            ->paginate($perPage);

        $transformed = $paginator->getCollection()->map(function (CommercialDocument $doc) {
            $customer = $doc->customer;
            $isB2b = AdminBillingCountService::isB2b($customer);

            return [
                'id' => $doc->id,
                'number' => $doc->number,
                'document_date' => $doc->document_date?->format('Y-m-d'),
                'created_at' => $doc->created_at?->timezone('Asia/Kolkata')->toIso8601String(),
                'customer_name' => $customer?->name,
                'customer_gstin' => ($customer && $customer->gst_status === 'registered') ? $customer->gstin : null,
                'customer_type' => $isB2b ? 'B2B' : 'B2C',
                'status' => $doc->status,
                'taxable_amount' => (float) ($doc->taxable_amount ?? 0),
                'igst_amount' => (float) ($doc->igst_amount ?? 0),
                'cgst_amount' => (float) ($doc->cgst_amount ?? 0),
                'sgst_amount' => (float) ($doc->sgst_amount ?? 0),
                'grand_total' => (float) ($doc->grand_total ?: $doc->total_amount),
            ];
        });

        $masked = $this->countService->maskGstFields($client);
        $isActive = (bool) ($client->user?->is_active ?? false);

        return response()->json([
            'client' => [
                'id' => $client->id,
                'client_code' => $client->client_code,
                'business_name' => $client->business_name,
                'client_name' => $client->client_name,
                'gstin' => $masked['gstin'],
                'pan' => $client->pan,
                'constitution_type' => $client->constitution_type,
                'registration_type' => $masked['registration_type'],
                'is_active' => $isActive,
                'has_gst' => $masked['has_gst'],
            ],
            'fy' => $fyData['fy'],
            'doc_type' => $docType,
            'cards' => $cards,
            'filtered_totals' => $filteredTotals,
            'documents' => [
                'current_page' => $paginator->currentPage(),
                'data' => $transformed,
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
        ]);
    }

    /**
     * View Document Screen (PDF pp 36-39, 47-52).
     */
    public function show(Request $request, int $clientId, string $docType, int $id): JsonResponse
    {
        $this->assertValidDocType($docType);

        $doc = CommercialDocument::withTrashed()
            ->where('client_profile_id', $clientId)
            ->where('type', $docType)
            ->where('id', $id)
            ->with([
                'lineItems',
                'customer',
                'clientProfile.user',
                'cancelledBy:id,name',
            ])
            ->firstOrFail();

        $lock = AdminBillingLockService::checkDocument($doc);
        $flags = AdminBillingCountService::computeDocumentFlags($doc, $lock);

        $paymentStatus = match ($doc->status) {
            'paid' => 'Paid',
            'partial' => 'Partial',
            'issued' => 'Unpaid',
            default => null,
        };
        if ($doc->trashed()) {
            $paymentStatus = null;
        }

        $c = $doc->customer;
        $customerData = $c ? [
            'id' => $c->id,
            'name' => $c->name,
            'proprietor_name' => $c->proprietor_name,
            'gstin' => $c->gst_status === 'registered' ? $c->gstin : null,
            'gst_status' => $c->gst_status,
            'pan' => ($c->gstin && strlen($c->gstin) === 15) ? substr($c->gstin, 2, 10) : null,
            'email' => $c->email,
            'phone' => $c->phone,
            'address' => $c->billing_address,
            'state' => $c->state,
            'state_code' => $c->state_code,
            'place_of_supply' => $c->place_of_supply ?: $doc->place_of_supply,
        ] : null;

        $sellerData = $this->countService->formatSeller($doc->clientProfile);

        $lineItems = $doc->lineItems->values()->map(function ($line, $idx) {
            return [
                'sr_no' => $idx + 1,
                'description' => $line->description ?: ($line->item_name ?: ''),
                'hsn_sac' => $line->hsn_sac,
                'qty' => (float) ($line->qty ?? $line->quantity ?? 0),
                'unit' => $line->unit ?: 'NOS',
                'rate' => (float) $line->rate,
                'gst_rate' => (float) $line->gst_rate,
                'taxable_amount' => (float) $line->taxable_amount,
            ];
        });

        $summary = [
            'taxable' => (float) ($doc->taxable_amount ?? 0),
            'cgst' => (float) ($doc->cgst_amount ?? 0),
            'sgst' => (float) ($doc->sgst_amount ?? 0),
            'igst' => (float) ($doc->igst_amount ?? 0),
            'round_off' => (float) ($doc->round_off ?? 0),
            'grand_total' => (float) ($doc->grand_total ?: $doc->total_amount),
            'amount_in_words' => \App\Services\DocumentTemplate\DocumentPayloadBuilder::formatAmountInWords($doc->amount_in_words),
        ];

        return response()->json([
            'document' => [
                'id' => $doc->id,
                'number' => $doc->number,
                'type' => $doc->type,
                'status' => $doc->status,
                'payment_status' => $paymentStatus,
                'document_date' => $doc->document_date?->format('Y-m-d'),
                'created_at' => $doc->created_at?->timezone('Asia/Kolkata')->toIso8601String(),
                'place_of_supply' => $doc->place_of_supply,
                'supply_type' => $doc->is_inter_state ? 'Inter-state' : 'Intra-state',
                'notes' => $doc->notes,
                'terms' => $doc->terms,
                'cancellation_reason' => $doc->cancellation_reason,
                'cancelled_at' => $doc->cancelled_at?->timezone('Asia/Kolkata')->toIso8601String(),
                'cancelled_by_name' => $doc->cancelledBy?->name,
            ],
            'gst' => [
                'status' => $lock['gst_status'],
                'filed_on' => $lock['filed_on'],
                'ack_no' => $lock['ack_no'],
            ],
            'flags' => $flags,
            'seller' => $sellerData,
            'customer' => $customerData,
            'line_items' => $lineItems,
            'summary' => $summary,
        ]);
    }

    /**
     * Download or view PDF for this document.
     */
    public function pdf(Request $request, int $clientId, string $docType, int $id)
    {
        $this->assertValidDocType($docType);

        $doc = CommercialDocument::withTrashed()
            ->where('client_profile_id', $clientId)
            ->where('type', $docType)
            ->where('id', $id)
            ->with(['clientProfile.documentSettings', 'clientProfile.user', 'customer', 'lineItems'])
            ->firstOrFail();

        $this->invoiceService->generatePdf($doc);
        $doc->refresh();

        $filePath = Storage::disk('public')->path($doc->pdf_path);

        return response()->file($filePath, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="' . ($doc->number ?: 'document') . '.pdf"',
        ]);
    }

    /**
     * Cancel an active document (Decision 6 / Rule 8).
     */
    public function cancel(Request $request, int $clientId, string $docType, int $id): JsonResponse
    {
        $this->assertValidDocType($docType);

        $doc = CommercialDocument::where('client_profile_id', $clientId)
            ->where('type', $docType)
            ->where('id', $id)
            ->firstOrFail();

        abort_if($doc->status === 'cancelled', 422, 'This document is already cancelled.');
        abort_unless(in_array($doc->status, ['issued', 'paid', 'partial'], true), 422, 'Only active documents can be cancelled.');

        $lock = AdminBillingLockService::checkDocument($doc);
        abort_if($lock['is_locked'], 422, 'GST Return for this document\'s period has already been filed. This document cannot be cancelled.');

        $data = $request->validate([
            'reason' => 'nullable|string|max:200',
        ]);

        $doc->update([
            'status' => 'cancelled',
            'cancellation_reason' => $data['reason'] ?? null,
            'cancelled_at' => now(),
            'cancelled_by' => $request->user()?->id,
        ]);

        return response()->json([
            'message' => 'Document cancelled successfully.',
            'document' => $doc->fresh(),
        ]);
    }

    /**
     * Soft delete an active or cancelled document (Decision 3 / Rule 9).
     */
    public function destroy(Request $request, int $clientId, string $docType, int $id): JsonResponse
    {
        $this->assertValidDocType($docType);

        $doc = CommercialDocument::withTrashed()
            ->where('client_profile_id', $clientId)
            ->where('type', $docType)
            ->where('id', $id)
            ->firstOrFail();

        abort_if($doc->trashed() || $doc->status === 'deleted', 422, 'This document is already deleted.');
        abort_unless(in_array($doc->status, ['issued', 'paid', 'partial', 'cancelled'], true), 422, 'Only active or cancelled documents can be deleted.');

        $this->invoiceService->adminSoftDelete($doc, $request->user()?->id, $request->ip());

        return response()->json(['message' => 'Document deleted successfully.']);
    }

    /**
     * Edit document creation date (Decision 7 / Rule 10).
     */
    public function updateCreationDate(Request $request, int $clientId, string $docType, int $id): JsonResponse
    {
        $this->assertValidDocType($docType);

        $doc = CommercialDocument::where('client_profile_id', $clientId)
            ->where('type', $docType)
            ->where('id', $id)
            ->with('clientProfile')
            ->firstOrFail();

        $validated = $request->validate([
            'new_creation_date' => 'required|date_format:Y-m-d',
            'fy' => 'nullable|string',
        ]);

        $fyData = $this->countService->resolveFy($validated['fy'] ?? null);

        abort_if($doc->trashed() || $doc->status === 'deleted', 422, 'Deleted documents cannot have their creation date edited.');
        abort_unless(in_array($doc->status, ['issued', 'paid', 'partial'], true), 422, 'Only active documents can have their creation date edited.');

        // Current period lock check
        $currentLock = AdminBillingLockService::checkDocument($doc);
        abort_if($currentLock['is_locked'], 422, 'GST Return for this document\'s period has already been filed. Creation date cannot be edited.');

        // Not in future (IST)
        $targetDateStr = $validated['new_creation_date'];
        $todayIst = Carbon::today('Asia/Kolkata');
        $targetDateIst = Carbon::createFromFormat('Y-m-d', $targetDateStr, 'Asia/Kolkata')->startOfDay();
        abort_if($targetDateIst->isAfter($todayIst), 422, 'Creation date cannot be in the future.');

        // Inside selected FY
        abort_if(
            $targetDateStr < $fyData['from'] || $targetDateStr > $fyData['to'],
            422,
            "Creation date must fall within the selected Financial Year ({$fyData['fy']})."
        );

        // Preserve existing time of day in IST
        $existingIst = $doc->created_at->copy()->timezone('Asia/Kolkata');
        $newDateTimeIst = Carbon::createFromFormat('Y-m-d', $targetDateStr, 'Asia/Kolkata')
            ->setTime($existingIst->hour, $existingIst->minute, $existingIst->second, $existingIst->microsecond);

        // Target period lock check
        $targetLock = AdminBillingLockService::check($doc->clientProfile, $newDateTimeIst, $doc->type);
        abort_if($targetLock['is_locked'], 422, 'GST Return for the target creation date period has already been filed.');

        $doc->created_at = $newDateTimeIst->copy()->utc();
        $doc->save();

        return response()->json([
            'message' => 'Creation date updated successfully.',
            'created_at' => $doc->created_at->timezone('Asia/Kolkata')->toIso8601String(),
        ]);
    }

    private function assertValidDocType(string $docType): void
    {
        abort_unless(
            in_array($docType, AdminBillingCountService::DOCUMENT_TYPES, true),
            404,
            "Document type '{$docType}' not found."
        );
    }
}
