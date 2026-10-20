<?php

namespace App\Services\Billing;

use App\Models\ClientProfile;
use App\Models\CommercialDocument;
use App\Models\DocumentLineItem;
use App\Models\TdsTcsSection;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class InvoiceService
{
    public function create(ClientProfile $profile, array $data): CommercialDocument
    {
        return DB::transaction(function () use ($profile, $data) {
            $status = $data['status'] ?? 'draft';
            $type = $data['type'] ?? 'tax_invoice';
            BillingPolicy::assertDocumentType($profile, $type);
            $isInter = (bool) ($data['is_inter_state'] ?? false);
            $isRcm = BillingPolicy::rcmAllowed($profile) && (bool) ($data['is_reverse_charge'] ?? false);
            abort_if($isRcm && ! BillingPolicy::rcmAllowed($profile), 422, 'Reverse charge is only available for regular GST dealers.');
            BillingPolicy::assertReferenceDocument($profile, $type, $data['reference_document_id'] ?? null);
            [$taxDeductionType, $tdsSection, $tdsRate] = $this->resolveTdsTcs($data, $type);
            $calc = GstCalculator::calculate(
                $data['lines'] ?? [],
                $isInter,
                array_key_exists('round_off', $data) ? (float) $data['round_off'] : null,
                BillingPolicy::taxesEnabled($profile, $isRcm),
                $taxDeductionType,
                $tdsRate
            );

            $allocateNumber = $status === 'issued';
            // Manual numbering (an admin setting): the client types the number, nothing is generated.
            abort_if(
                $allocateNumber && empty($data['number']) && DocumentNumberingSettings::numberingType($profile, $type) === 'manual',
                422,
                'Enter the document number before issuing — this document type uses manual numbering.'
            );
            if (! empty($data['number'])) {
                $number = $data['number'];
            } elseif ($allocateNumber) {
                $number = $this->allocateNextNumber($profile, $type);
            } else {
                $number = $this->draftNumber($profile, $type, $data['document_date'] ?? null);
            }
            BillingPolicy::assertUniqueNumber($profile, $number);

            $doc = CommercialDocument::create($this->docPayload($profile, $data, $calc, $type, $number, $isInter, $isRcm, $status, $allocateNumber, $taxDeductionType, $tdsSection, $tdsRate));
            $this->syncLines($doc, $calc['lines']);

            return $doc->load(['lineItems', 'customer', 'clientProfile', 'referenceDocument']);
        });
    }

    /**
     * Billing / Edit Request spec — an issued document is directly editable, no
     * admin approval needed, as long as its month isn't locked (no GST Filing
     * Confirmation submitted, GST Return not yet filed). Once locked, only an
     * admin-approved Request Edit (edit_allowed) can unlock a single save.
     */
    public function updateDraft(CommercialDocument $doc, ClientProfile $profile, array $data): CommercialDocument
    {
        $isIssuedFamily = in_array($doc->status, ['issued', 'partial', 'paid'], true);
        $directEditable = $isIssuedFamily && ! BillingPolicy::isDirectEditLocked($profile, $doc->created_at?->toDateString());
        $unlockedIssued = $isIssuedFamily && $doc->edit_allowed;
        $keepIssued = $directEditable || $unlockedIssued;
        abort_unless($doc->status === 'draft' || $keepIssued, 422, 'This document is locked for direct edits — a GST Filing Confirmation has been submitted (or the GST Return filed) for its period. Please use Request Edit.');

        return DB::transaction(function () use ($doc, $profile, $data, $keepIssued, $unlockedIssued) {
            $isInter = (bool) ($data['is_inter_state'] ?? $doc->is_inter_state);
            $type = $doc->type; // type cannot change on update
            BillingPolicy::assertDocumentType($profile, $type);
            $isRcm = BillingPolicy::rcmAllowed($profile) && (bool) ($data['is_reverse_charge'] ?? $doc->is_reverse_charge);
            BillingPolicy::assertReferenceDocument($profile, $type, $data['reference_document_id'] ?? $doc->reference_document_id);
            $data = array_key_exists('tax_deduction_type', $data) ? $data : $data + ['tax_deduction_type' => $doc->tax_deduction_type, 'tds_tcs_section_id' => $doc->tds_tcs_section_id];
            $data = array_key_exists('currency', $data) ? $data : $data + ['currency' => $doc->currency];
            [$taxDeductionType, $tdsSection, $tdsRate] = $this->resolveTdsTcs($data, $type);
            $calc = GstCalculator::calculate(
                $data['lines'] ?? [],
                $isInter,
                array_key_exists('round_off', $data) ? (float) $data['round_off'] : null,
                BillingPolicy::taxesEnabled($profile, $isRcm),
                $taxDeductionType,
                $tdsRate
            );
            $status = $keepIssued ? $doc->status : 'draft';
            // Manual numbering: a draft may have its typed number changed (never an issued one).
            $number = $doc->number;
            if ($doc->status === 'draft' && ! empty($data['number']) && $data['number'] !== $doc->number) {
                BillingPolicy::assertUniqueNumber($profile, $data['number'], $doc->id);
                $number = $data['number'];
            }
            $payload = $this->docPayload($profile, $data, $calc, $type, $number, $isInter, $isRcm, $status, $keepIssued, $taxDeductionType, $tdsSection, $tdsRate);
            if ($unlockedIssued) {
                // The one-time admin-approved unlock is consumed on save; a direct edit
                // of an already-unlocked period doesn't touch edit_allowed at all.
                $payload['edit_allowed'] = false;
            }
            if ($keepIssued) {
                $payload['issued_at'] = $doc->issued_at;
            }
            $oldLines = $doc->lineItems()->orderBy('id')->get(['hsn_sac'])->map(fn ($l) => ['hsn_sac' => $l->hsn_sac])->all();
            $doc->update($payload);
            $doc->lineItems()->delete();
            $this->syncLines($doc, $calc['lines']);
            $this->cascadeHsnCorrectionToCreditNotes($doc, $oldLines, $calc['lines']);

            $doc = $doc->fresh()->load(['lineItems', 'customer', 'clientProfile', 'referenceDocument']);
            if ($keepIssued) {
                $this->generatePdf($doc);
            }

            return $doc->fresh()->load(['lineItems', 'customer', 'clientProfile', 'referenceDocument']);
        });
    }

    public function convertQuotation(CommercialDocument $quotation, ClientProfile $profile): CommercialDocument
    {
        abort_unless($quotation->type === 'quotation', 422, 'Only quotations can be converted.');
        abort_unless(! $quotation->converted_document_id, 422, 'Quotation already converted.');
        abort_unless(in_array($quotation->status, ['draft', 'issued'], true), 422, 'Quotation cannot be converted.');

        // Determine target type from GST registration type.
        // Composition taxpayers can only create Bill of Supply; Regular only Tax Invoice.
        $targetType = ($profile->dealer_type === 'composition') ? 'bill_of_supply' : 'tax_invoice';
        BillingPolicy::assertDocumentType($profile, $targetType);

        $quotation->loadMissing('lineItems');

        return DB::transaction(function () use ($quotation, $profile, $targetType) {
            $lines = $quotation->lineItems->map(fn ($l) => [
                'product_id' => $l->product_id,
                'description' => $l->description,
                'hsn_sac' => $l->hsn_sac,
                'qty' => $l->qty,
                'unit' => $l->unit,
                'rate' => $l->rate,
                'discount_percent' => $l->discount_percent,
                'discount_amount' => $l->discount_amount,
                'gst_rate' => $l->gst_rate,
            ])->all();

            $invoice = $this->create($profile, [
                'type' => $targetType,
                'customer_id' => $quotation->customer_id,
                'document_date' => now()->toDateString(),
                'due_date' => $quotation->due_date?->toDateString(),
                'place_of_supply' => $quotation->place_of_supply,
                'payment_terms' => $quotation->payment_terms,
                'is_inter_state' => $quotation->is_inter_state,
                'is_reverse_charge' => $quotation->is_reverse_charge,
                'notes' => trim(($quotation->notes ? $quotation->notes."\n" : '').'Converted from quotation '.$quotation->number),
                'terms' => $quotation->terms,
                'status' => 'issued',
                'lines' => $lines,
            ]);

            $quotation->update([
                'converted_document_id' => $invoice->id,
                'status' => 'cancelled',
                'notes' => trim(($quotation->notes ? $quotation->notes."\n" : '').'Converted to '.$invoice->number),
            ]);

            return $invoice;
        });
    }

    public function duplicate(CommercialDocument $source, ClientProfile $profile): CommercialDocument
    {
        BillingPolicy::assertDocumentType($profile, $source->type);
        $source->loadMissing('lineItems');

        $lines = $source->lineItems->map(fn ($l) => [
            'product_id' => $l->product_id,
            'description' => $l->description,
            'hsn_sac' => $l->hsn_sac,
            'qty' => $l->qty,
            'unit' => $l->unit,
            'rate' => $l->rate,
            'discount_percent' => $l->discount_percent,
            'discount_amount' => $l->discount_amount,
            'gst_rate' => $l->gst_rate,
        ])->all();

        return $this->create($profile, [
            'type' => $source->type,
            'customer_id' => $source->customer_id,
            'reference_document_id' => $source->type === 'amendment' ? $source->reference_document_id : (
                in_array($source->type, ['credit_note', 'debit_note'], true) ? $source->reference_document_id : null
            ),
            'document_date' => now()->toDateString(),
            'due_date' => $source->due_date?->toDateString(),
            'place_of_supply' => $source->place_of_supply,
            'payment_terms' => $source->payment_terms,
            'is_inter_state' => $source->is_inter_state,
            'is_reverse_charge' => $source->is_reverse_charge,
            'notes' => $source->notes,
            'terms' => $source->terms,
            'status' => 'draft',
            'lines' => $lines,
            'reason_for_transportation' => $source->reason_for_transportation,
            'reason_for_transportation_other' => $source->reason_for_transportation_other,
            'vehicle_no' => $source->vehicle_no,
            'transporter_name' => $source->transporter_name,
            'eway_bill_no' => $source->eway_bill_no,
            'receiver_name' => $source->receiver_name,
            'receiver_signature_datetime' => $source->receiver_signature_datetime,
        ]);
    }

    public function destroyQuotation(CommercialDocument $doc, ClientProfile $profile): void
    {
        abort_unless($doc->client_profile_id === $profile->id, 403);
        abort_unless($doc->type === 'quotation', 422, 'Only quotations can be deleted.');
        abort_unless(! $doc->converted_document_id, 422, 'Converted quotations cannot be deleted.');
        $doc->lineItems()->delete();
        $doc->delete();
    }

    /**
     * Admin-only hard delete of ANY document type — unlike the client-side cancel(),
     * which only ever changes status and keeps the document forever (by design, for GST
     * audit trail integrity). This exists so an admin can clean up demo/test documents
     * created while showing a prospective client the product, without having to delete
     * the entire client company just to remove a few sample bills.
     *
     * Deliberately more cautious than destroyQuotation() above: refuses to delete a
     * document that anything else still points to, rather than trying to null/repair
     * those references — a document with a Credit/Debit Note or Amendment against it, or
     * one already attached to a submitted GST Filing Request, should not be silently
     * deletable even by an admin.
     */
    public function adminDelete(CommercialDocument $doc): void
    {
        abort_if(
            CommercialDocument::where('reference_document_id', $doc->id)->exists(),
            422,
            'This document has a Credit Note, Debit Note, or Amendment issued against it — delete those first.'
        );
        abort_if(
            DB::table('gst_filing_request_document')->where('commercial_document_id', $doc->id)->exists(),
            422,
            'This document is attached to a GST Filing Request and cannot be deleted.'
        );

        DB::transaction(function () use ($doc) {
            // A quotation this doc was converted from (or that was converted into this
            // doc, for the quotation's own converted_document_id) would otherwise be left
            // pointing at a row that no longer exists.
            CommercialDocument::where('converted_document_id', $doc->id)->update(['converted_document_id' => null]);

            $doc->lineItems()->delete();
            if (DB::getSchemaBuilder()->hasTable('document_edit_requests')) {
                DB::table('document_edit_requests')->where('commercial_document_id', $doc->id)->delete();
            }
            if ($doc->pdf_path && Storage::disk('public')->exists($doc->pdf_path)) {
                Storage::disk('public')->delete($doc->pdf_path);
            }
            $doc->forceDelete();
        });
    }

    /**
     * Module 3 (Stage 3B): Admin soft delete.
     * Sets status='deleted' and soft deletes the document row.
     * Preserves line items for retention.
     * Writes ActivityLog 'deleted_document'.
     * Blocks when GST Filed, referenced by active documents, or attached to a filing request.
     */
    public function adminSoftDelete(CommercialDocument $doc, ?int $userId = null, ?string $ip = null): void
    {
        $lock = AdminBillingLockService::checkDocument($doc);
        abort_if(
            $lock['is_locked'],
            422,
            'GST Return for this document\'s period has already been filed. This document cannot be deleted.'
        );

        abort_if(
            CommercialDocument::where('reference_document_id', $doc->id)->exists(),
            422,
            'This document has a Credit Note, Debit Note, or Amendment issued against it — delete those first.'
        );

        abort_if(
            DB::table('gst_filing_request_document')->where('commercial_document_id', $doc->id)->exists(),
            422,
            'This document is attached to a GST Filing Request and cannot be deleted.'
        );

        $snapshot = [
            'number' => $doc->number,
            'type' => $doc->type,
            'client_profile_id' => $doc->client_profile_id,
            'client_business_name' => $doc->clientProfile?->business_name,
            'grand_total' => $doc->grand_total ?: $doc->total_amount,
        ];

        DB::transaction(function () use ($doc, $userId, $ip, $snapshot) {
            $doc->update(['status' => 'deleted']);
            $doc->delete(); // Soft delete sets deleted_at

            \App\Models\ActivityLog::create([
                'user_id' => $userId,
                'action' => 'deleted_document',
                'subject_type' => CommercialDocument::class,
                'subject_id' => $doc->id,
                'properties' => $snapshot,
                'ip_address' => $ip,
            ]);
        });
    }

    /**
     * Module 3 (Stage 3B-4a): Admin full update of an active, GST Not Filed Tax Invoice.
     * Replaces lines, recalculates GST, preserves number/status/type/issued_at, writes ActivityLog,
     * and triggers post-transaction PDF generation (non-fatal, sets pdf_path=null on failure).
     */
    public function adminFullUpdate(
        CommercialDocument $doc,
        ClientProfile $profile,
        array $data,
        ?int $userId = null,
        ?string $ip = null
    ): CommercialDocument {
        $lockedDoc = DB::transaction(function () use ($doc, $profile, $data, $userId, $ip) {
            $locked = CommercialDocument::withTrashed()->whereKey($doc->id)->lockForUpdate()->firstOrFail();

            // G1: Not deleted
            abort_if($locked->trashed() || $locked->status === 'deleted', 422, 'Deleted documents cannot be edited.');

            // G2: Status in issued, paid, partial
            abort_unless(
                in_array($locked->status, ['issued', 'paid', 'partial'], true),
                422,
                'Only active documents can be edited.'
            );

            // G3: GST Period lock
            $lock = AdminBillingLockService::checkDocument($locked);
            abort_if($lock['is_locked'], 422, 'GST Return for this document\'s period has already been filed. This document cannot be edited.');

            // G5: Not attached to filing request
            abort_if(
                DB::table('gst_filing_request_document')->where('commercial_document_id', $locked->id)->exists(),
                422,
                'This document is attached to a GST Filing Request and cannot be edited.'
            );

            // G6: Not referenced by another document
            abort_if(
                CommercialDocument::where('reference_document_id', $locked->id)->exists(),
                422,
                'This document has a Credit Note, Debit Note, or Amendment issued against it — delete those first.'
            );

            // Build merged data: omitted optional keys retain stored values; explicit nulls clear them
            $optionalDefaults = [
                'customer_id' => $locked->customer_id,
                'due_date' => $locked->due_date?->format('Y-m-d'),
                'payment_terms' => $locked->payment_terms,
                'notes' => $locked->notes,
                'terms' => $locked->terms,
                'place_of_supply' => $locked->place_of_supply,
                'currency' => $locked->currency,
                'tax_deduction_type' => $locked->tax_deduction_type,
                'tds_tcs_section_id' => $locked->tds_tcs_section_id,
                'reference_document_id' => $locked->reference_document_id,
                'reason_for_transportation' => $locked->reason_for_transportation,
                'reason_for_transportation_other' => $locked->reason_for_transportation_other,
                'vehicle_no' => $locked->vehicle_no,
                'transporter_name' => $locked->transporter_name,
                'eway_bill_no' => $locked->eway_bill_no,
                'receiver_name' => $locked->receiver_name,
                'receiver_signature_datetime' => $locked->receiver_signature_datetime,
            ];

            $mergedData = $data;
            foreach ($optionalDefaults as $key => $storedValue) {
                if (! array_key_exists($key, $data)) {
                    $mergedData[$key] = $storedValue;
                }
            }

            [$taxDeductionType, $tdsSection, $tdsRate] = $this->resolveTdsTcs($mergedData, $locked->type);

            $isInter = (bool) ($data['is_inter_state'] ?? $locked->is_inter_state);
            $type = $locked->type;
            $isRcm = BillingPolicy::rcmAllowed($profile) && (bool) ($data['is_reverse_charge'] ?? $locked->is_reverse_charge);

            $roundOff = array_key_exists('round_off', $data) && $data['round_off'] !== null
                ? (float) $data['round_off']
                : null;

            $calc = GstCalculator::calculate(
                $data['lines'] ?? [],
                $isInter,
                $roundOff,
                BillingPolicy::taxesEnabled($profile, $isRcm),
                $taxDeductionType,
                $tdsRate
            );

            $status = $locked->status;
            $keepIssued = true;
            $oldGrandTotal = $locked->grand_total ?: $locked->total_amount;

            // Mirror docPayload call from updateDraft (L84-93), positional args
            $payload = $this->docPayload(
                $profile,
                $mergedData,
                $calc,
                $type,
                $locked->number,
                $isInter,
                $isRcm,
                $status,
                $keepIssued,
                $taxDeductionType,
                $tdsSection,
                $tdsRate
            );
            $payload['issued_at'] = $locked->issued_at;
            // Keep the stored link (e.g. a Credit/Debit Note's original invoice) and the shared PDF link.
            $payload['reference_document_id'] = $locked->reference_document_id;
            $payload['share_token'] = $locked->share_token ?: $payload['share_token'];

            // If terms or place_of_supply are explicitly null (or stored as null), prevent fallback to profile defaults
            if (array_key_exists('terms', $mergedData) && $mergedData['terms'] === null) {
                $payload['terms'] = null;
            }
            if (array_key_exists('place_of_supply', $mergedData) && $mergedData['place_of_supply'] === null) {
                $payload['place_of_supply'] = null;
            }

            $locked->update($payload);
            $locked->lineItems()->delete();
            $this->syncLines($locked, $calc['lines']);

            $newGrandTotal = $locked->grand_total ?: $locked->total_amount;

            \App\Models\ActivityLog::create([
                'user_id' => $userId,
                'action' => 'admin_edited_document',
                'subject_type' => CommercialDocument::class,
                'subject_id' => $locked->id,
                'properties' => [
                    'number' => $locked->number,
                    'type' => $locked->type,
                    'client_profile_id' => $locked->client_profile_id,
                    'old_grand_total' => $oldGrandTotal,
                    'new_grand_total' => $newGrandTotal,
                ],
                'ip_address' => $ip,
            ]);

            return $locked;
        });

        // Post-transaction PDF generation (non-fatal)
        try {
            $freshForPdf = $lockedDoc->fresh(['lineItems', 'customer', 'clientProfile.user', 'clientProfile.documentSettings', 'tdsTcsSection']);
            $this->generatePdf($freshForPdf);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning("Admin edit PDF generation failed for doc {$lockedDoc->id}: " . $e->getMessage());
            $lockedDoc->update(['pdf_path' => null]);
        }

        return $lockedDoc->fresh(['lineItems', 'customer', 'clientProfile.user', 'cancelledBy']);
    }

    /**
     * Admin — Full Billing Access & Control spec: an admin can change any document's
     * Number, Date, or Status whenever required, bypassing the GST-period lock that
     * governs the client's own updateDraft(). Moving status to 'draft' clears the
     * cancellation/issue markers so the document behaves like a fresh draft the client
     * can edit or recreate through the normal client-side flow. Line items/amounts are
     * left untouched — this is a metadata correction, not a re-calculation.
     */
    public function adminUpdate(CommercialDocument $doc, array $data): CommercialDocument
    {
        return DB::transaction(function () use ($doc, $data) {
            $payload = [];

            if (! empty($data['number']) && $data['number'] !== $doc->number) {
                BillingPolicy::assertUniqueNumber($doc->clientProfile, $data['number'], $doc->id);
                $payload['number'] = $data['number'];
            }

            if (! empty($data['document_date'])) {
                $payload['document_date'] = $data['document_date'];
            }

            if (! empty($data['status']) && $data['status'] !== $doc->status) {
                $payload['status'] = $data['status'];
                if ($data['status'] === 'draft') {
                    $payload['cancellation_reason'] = null;
                    $payload['cancelled_at'] = null;
                    $payload['edit_allowed'] = false;
                    $payload['issued_at'] = null;
                } elseif ($data['status'] === 'cancelled') {
                    $payload['cancelled_at'] = $doc->cancelled_at ?: now();
                    $payload['cancellation_reason'] = $doc->cancellation_reason ?: 'Reverted by admin.';
                } elseif (in_array($data['status'], ['issued', 'paid', 'partial'], true) && ! $doc->issued_at) {
                    $payload['issued_at'] = now();
                }
            }

            if ($payload) {
                $doc->update($payload);
            }

            return $doc->fresh(['lineItems', 'customer', 'clientProfile', 'referenceDocument', 'tdsTcsSection']);
        });
    }

    /**
     * Cancellation is a status change only — the document, its number, dates,
     * amounts and line items are always preserved and remain viewable/downloadable.
     * Never call ->delete() here.
     */
    public function cancel(CommercialDocument $doc, string $reason): CommercialDocument
    {
        abort_if($doc->status === 'cancelled', 422, 'This document is already cancelled.');
        abort_if($doc->type === 'quotation' && $doc->converted_document_id, 422, 'A converted quotation cannot be cancelled.');

        $doc->update([
            'status' => 'cancelled',
            'cancellation_reason' => $reason,
            'cancelled_at' => now(),
        ]);

        return $doc->fresh(['lineItems', 'customer', 'referenceDocument']);
    }

    public function issue(CommercialDocument $doc, ClientProfile $profile): CommercialDocument
    {
        abort_unless($doc->status === 'draft', 422, 'Only drafts can be issued');

        return DB::transaction(function () use ($doc, $profile) {
            $wasDraftNumber = str_starts_with($doc->number, 'DRAFT-');
            abort_if(
                $wasDraftNumber && DocumentNumberingSettings::numberingType($profile, $doc->type) === 'manual',
                422,
                'Enter the document number before issuing — this document type uses manual numbering.'
            );
            $number = $wasDraftNumber ? $this->allocateNextNumber($profile, $doc->type) : $doc->number;
            BillingPolicy::assertUniqueNumber($profile, $number, $doc->id);

            $doc->update([
                'number' => $number,
                'status' => 'issued',
                'issued_at' => now(),
                'share_token' => $doc->share_token ?: Str::random(40),
            ]);

            $doc = $doc->fresh()->load(['lineItems', 'customer', 'clientProfile', 'referenceDocument']);
            $this->generatePdf($doc);

            return $doc->fresh()->load(['lineItems', 'customer', 'clientProfile', 'referenceDocument']);
        });
    }

    public function preview(ClientProfile $profile, array $data): array
    {
        $type = $data['type'] ?? 'tax_invoice';
        BillingPolicy::assertDocumentType($profile, $type);
        $isInter = (bool) ($data['is_inter_state'] ?? false);
        $isRcm = BillingPolicy::rcmAllowed($profile) && (bool) ($data['is_reverse_charge'] ?? false);
        [$taxDeductionType, , $tdsRate] = $this->resolveTdsTcs($data, $type);
        $calc = GstCalculator::calculate(
            $data['lines'] ?? [],
            $isInter,
            array_key_exists('round_off', $data) ? (float) $data['round_off'] : null,
            BillingPolicy::taxesEnabled($profile, $isRcm),
            $taxDeductionType,
            $tdsRate
        );

        return [
            'profile' => $profile,
            'customer_id' => $data['customer_id'] ?? null,
            'type' => $type,
            'document_date' => $data['document_date'] ?? now()->toDateString(),
            'place_of_supply' => $data['place_of_supply'] ?? null,
            'payment_terms' => $data['payment_terms'] ?? null,
            'is_inter_state' => $isInter,
            'is_reverse_charge' => $isRcm,
            'reference_document_id' => $data['reference_document_id'] ?? null,
            ...$calc,
        ];
    }

    public function nextNumber(ClientProfile $profile, string $type): string
    {
        $locked = ClientProfile::whereKey($profile->id)->lockForUpdate()->first();
        if ($locked) {
            $profile->setRawAttributes($locked->getAttributes());
            $profile->syncOriginal();
        }

        [$prefix, $separator, $position, $padLen] = $this->resolveNumberingConfig($profile, $type);
        $field = $this->nextNumberField($type);
        $seq = max(1, (int) ($profile->{$field} ?? 1));

        return $this->formatDocNumber($prefix, $seq, $separator, $position, $padLen);
    }

    /**
     * Suggested number for a manual-numbering type: the next in sequence that no document uses yet.
     * Purely informational — manual numbers never move the sequence counter.
     */
    public function suggestManualNumber(ClientProfile $profile, string $type): string
    {
        [$prefix, $separator, $position, $padLen] = $this->resolveNumberingConfig($profile, $type);
        $seq = max(1, (int) ($profile->{$this->nextNumberField($type)} ?? 1));

        for ($i = 0; $i < 1000; $i++, $seq++) {
            $candidate = $this->formatDocNumber($prefix, $seq, $separator, $position, $padLen);
            if (! CommercialDocument::where('client_profile_id', $profile->id)->where('number', $candidate)->exists()) {
                return $candidate;
            }
        }

        return $candidate;
    }

    /**
     * Atomically locks the profile row, allocates the current sequence number,
     * increments the sequence counter on the locked row, updates document_numbering_settings JSON,
     * and returns the formatted document number.
     * Must be executed within a DB::transaction.
     */
    public function allocateNextNumber(ClientProfile $profile, string $type): string
    {
        $locked = ClientProfile::whereKey($profile->id)->lockForUpdate()->first() ?? $profile;

        [$prefix, $separator, $position, $padLen] = $this->resolveNumberingConfig($locked, $type);
        $field = $this->nextNumberField($type);
        $seq = max(1, (int) ($locked->{$field} ?? 1));

        $formatted = $this->formatDocNumber($prefix, $seq, $separator, $position, $padLen);

        // Re-check inside lockForUpdate transaction: if the number is already used by a non-deleted document, abort 422
        abort_if(
            CommercialDocument::where('client_profile_id', $locked->id)->where('number', $formatted)->exists(),
            422,
            'Invoice number already exists for this client.'
        );

        $nextSeq = $seq + 1;
        $updates = [
            $field => $nextSeq,
        ];

        // Keep document_numbering_settings JSON in sync
        $settings = $locked->document_numbering_settings;
        if (! is_array($settings)) {
            $settings = [];
        }
        $docKey = self::typeToSettingsKey($type);
        if (! isset($settings[$docKey]) || ! is_array($settings[$docKey])) {
            $settings[$docKey] = [];
        }
        $settings[$docKey]['prefix'] = $prefix;
        $settings[$docKey]['separator'] = $separator;
        $settings[$docKey]['prefix_position'] = $position;
        $settings[$docKey]['next_number'] = str_pad((string) $nextSeq, max(2, $padLen), '0', STR_PAD_LEFT);
        if (! isset($settings[$docKey]['numbering_type'])) {
            $settings[$docKey]['numbering_type'] = 'auto';
        }
        if (! isset($settings[$docKey]['status'])) {
            $settings[$docKey]['status'] = true;
        }
        $updates['document_numbering_settings'] = $settings;

        $locked->update($updates);

        $profile->setRawAttributes($locked->getAttributes());
        $profile->syncOriginal();

        return $formatted;
    }

    /**
     * Resolves the prefix, separator, position and padding length for a document type.
     * Priority: document_numbering_settings JSON > client_profiles legacy column > default constant.
     */
    public function resolveNumberingConfig(ClientProfile $profile, string $type): array
    {
        $docKey = self::typeToSettingsKey($type);
        $settings = $profile->document_numbering_settings;
        $cfg = is_array($settings) && isset($settings[$docKey]) && is_array($settings[$docKey])
            ? $settings[$docKey]
            : [];

        $defaultPrefix = match ($type) {
            'credit_note' => 'CN',
            'debit_note' => 'DN',
            'bill_of_supply' => 'BOS',
            'quotation' => 'QT',
            'amendment' => 'AMD',
            'proforma' => 'PI',
            'delivery_challan' => 'DC',
            default => 'INV',
        };

        $legacyPrefix = match ($type) {
            'credit_note' => $profile->credit_note_prefix,
            'debit_note' => $profile->debit_note_prefix,
            'bill_of_supply' => $profile->bill_of_supply_prefix,
            'quotation' => $profile->quotation_prefix,
            'amendment' => $profile->amendment_prefix,
            'delivery_challan' => $profile->delivery_challan_prefix,
            default => $profile->invoice_prefix,
        };

        $prefix = ! empty($cfg['prefix']) ? (string) $cfg['prefix'] : ($legacyPrefix ?: $defaultPrefix);

        $defaultSep = match ($type) {
            'bill_of_supply', 'debit_note', 'delivery_challan' => '/',
            default => '-',
        };
        $separator = isset($cfg['separator']) && $cfg['separator'] !== '' ? (string) $cfg['separator'] : $defaultSep;

        $position = ($cfg['prefix_position'] ?? 'first') === 'last' ? 'last' : 'first';

        $rawNext = isset($cfg['next_number']) ? (string) $cfg['next_number'] : '01';
        $padLen = max(2, strlen($rawNext));

        return [$prefix, $separator, $position, $padLen];
    }

    public function formatDocNumber(string $prefix, int $seq, string $separator = '-', string $position = 'first', int $padLen = 2): string
    {
        $prefix = trim($prefix);
        if ($prefix === '') {
            $prefix = 'DOC';
        }
        $padded = str_pad((string) $seq, max(2, $padLen), '0', STR_PAD_LEFT);

        if ($position === 'last') {
            if (str_starts_with($prefix, '/') || str_starts_with($prefix, '-')) {
                return $padded . $prefix;
            }

            return $padded . $separator . $prefix;
        }

        if (str_ends_with($prefix, '/') || str_ends_with($prefix, '-')) {
            return $prefix . $padded;
        }

        return $prefix . $separator . $padded;
    }

    public static function typeToSettingsKey(string $type): string
    {
        return match ($type) {
            'tax_invoice' => 'invoice',
            default => $type,
        };
    }

    public static function settingsKeyToType(string $key): string
    {
        return match ($key) {
            'invoice' => 'tax_invoice',
            default => $key,
        };
    }

    /** Fixed short code per document type for draft numbers — distinct from the
     *  admin-configurable prefixes used for issued numbers (nextNumber()/prefixFor()). */
    private function draftPrefixFor(string $type): string
    {
        return match ($type) {
            'tax_invoice' => 'TAX',
            'debit_note' => 'DN',
            'credit_note' => 'CN',
            'bill_of_supply' => 'BOS',
            'quotation' => 'QT',
            'amendment' => 'AMD',
            'delivery_challan' => 'DC',
            default => strtoupper(substr($type, 0, 3)),
        };
    }

    /**
     * Draft number: DRAFT-{PREFIX}-NN, always exactly 2 digits (01-99), sequenced
     * independently per document type, scoped to the client and financial year.
     *
     * Reuses the lowest currently-unused number rather than an ever-incrementing
     * counter — once a draft is issued or deleted its slot is freed for reuse, so a
     * normal workflow (create → issue, repeat) never approaches the 99 ceiling.
     * Existing drafts are never renumbered; only a brand-new draft calls this.
     */
    public function draftNumber(ClientProfile $profile, string $type, ?string $documentDate = null): string
    {
        $prefix = $this->draftPrefixFor($type);
        $date = $documentDate ? \Carbon\Carbon::parse($documentDate) : now();
        $fyStartYear = $date->month >= 4 ? $date->year : $date->year - 1;
        $from = "{$fyStartYear}-04-01";
        $to = ($fyStartYear + 1).'-03-31';

        $used = CommercialDocument::where('client_profile_id', $profile->id)
            ->where('type', $type)
            ->where('status', 'draft')
            ->whereBetween('document_date', [$from, $to])
            ->pluck('number')
            ->map(function ($number) use ($prefix) {
                if (preg_match('/^DRAFT-'.preg_quote($prefix, '/').'-(\d+)$/', (string) $number, $m)) {
                    return (int) $m[1];
                }

                return null;
            })
            ->filter(fn ($n) => $n !== null)
            ->all();

        for ($seq = 1; $seq <= 99; $seq++) {
            if (! in_array($seq, $used, true)) {
                return sprintf('DRAFT-%s-%02d', $prefix, $seq);
            }
        }

        // Controlled business rule at the 99 boundary — never silently produce a 3-digit
        // draft number. 99 simultaneous open drafts of one type in one FY means existing
        // ones need to be issued or removed before another can be created.
        abort(422, "Draft {$prefix} numbers for this financial year are exhausted (DRAFT-{$prefix}-01 through DRAFT-{$prefix}-99 are all in use). Issue or delete an existing draft before creating another.");
    }

    public function prefixFor(ClientProfile $profile, string $type): string
    {
        [$prefix] = $this->resolveNumberingConfig($profile, $type);

        return $prefix;
    }

    /** Column that holds the next sequence for a document type (admin-settable). */
    private function nextNumberField(string $type): string
    {
        return match ($type) {
            'bill_of_supply' => 'bill_of_supply_next_number',
            'credit_note' => 'credit_note_next_number',
            'debit_note' => 'debit_note_next_number',
            'quotation' => 'quotation_next_number',
            'amendment' => 'amendment_next_number',
            'delivery_challan' => 'delivery_challan_next_number',
            default => 'invoice_next_number', // tax_invoice and fallbacks
        };
    }

    private function bumpNextNumber(ClientProfile $profile, string $type): void
    {
        $field = $this->nextNumberField($type);
        $locked = ClientProfile::whereKey($profile->id)->lockForUpdate()->first() ?? $profile;
        $nextSeq = max(1, (int) ($locked->{$field} ?? 1)) + 1;
        $locked->update([$field => $nextSeq]);
        $profile->setRawAttributes($locked->getAttributes());
    }

    private function formatNumber(string $prefix, int $seq): string
    {
        return $this->formatDocNumber($prefix, $seq);
    }

    /**
     * Resolve and validate the TDS/TCS selection against the master list.
     * TDS/TCS only applies to Tax Invoices and Bills of Supply; the rate is
     * always read from the server-side section master, never trusted from input.
     *
     * @return array{0: ?string, 1: ?TdsTcsSection, 2: ?float}
     */
    private function resolveTdsTcs(array $data, string $docType): array
    {
        $deductionType = $data['tax_deduction_type'] ?? null;
        if (! in_array($deductionType, ['tds', 'tcs'], true)) {
            return [null, null, null];
        }
        abort_unless(
            in_array($docType, ['tax_invoice', 'bill_of_supply'], true),
            422,
            'TDS/TCS only applies to Tax Invoices and Bills of Supply.'
        );
        $sectionId = $data['tds_tcs_section_id'] ?? null;
        abort_if(empty($sectionId), 422, 'Select a TDS/TCS section.');
        $section = TdsTcsSection::where('id', $sectionId)
            ->where('type', $deductionType)
            ->where('is_active', true)
            ->first();
        abort_unless($section, 422, 'Selected TDS/TCS section is invalid.');

        return [$deductionType, $section, (float) $section->rate];
    }

    private function docPayload(
        ClientProfile $profile,
        array $data,
        array $calc,
        string $type,
        string $number,
        bool $isInter,
        bool $isRcm,
        string $status,
        bool $issued,
        ?string $taxDeductionType = null,
        ?TdsTcsSection $tdsSection = null,
        ?float $tdsRate = null
    ): array {
        return [
            'client_profile_id' => $profile->id,
            'customer_id' => $data['customer_id'] ?? null,
            'reference_document_id' => $data['reference_document_id'] ?? null,
            'type' => $type,
            'number' => $number,
            'document_date' => $data['document_date'] ?? now()->toDateString(),
            'due_date' => $data['due_date'] ?? null,
            'place_of_supply' => $data['place_of_supply'] ?? $profile->place_of_supply_default,
            'is_inter_state' => $isInter,
            'is_reverse_charge' => $isRcm,
            'discount_total' => $calc['discount_total'],
            'taxable_amount' => $calc['taxable_amount'],
            'cgst_amount' => $calc['cgst_amount'],
            'sgst_amount' => $calc['sgst_amount'],
            'igst_amount' => $calc['igst_amount'],
            'total_amount' => $calc['total_amount'],
            'round_off' => $calc['round_off'],
            'tax_deduction_type' => $taxDeductionType,
            'tds_tcs_section_id' => $tdsSection?->id,
            'tds_tcs_rate' => $tdsRate,
            'tds_tcs_amount' => $calc['tds_tcs_amount'] ?? 0,
            'grand_total' => $calc['grand_total'],
            'amount_in_words' => $calc['amount_in_words'],
            'status' => $status,
            'issued_at' => $issued ? now() : null,
            'notes' => $data['notes'] ?? null,
            'terms' => $data['terms'] ?? $profile->terms_conditions,
            'payment_terms' => $data['payment_terms'] ?? null,
            'currency' => $data['currency'] ?? 'INR',
            'share_token' => $data['share_token'] ?? Str::random(40),
            'reason_for_transportation' => $data['reason_for_transportation'] ?? null,
            'reason_for_transportation_other' => $data['reason_for_transportation_other'] ?? null,
            'vehicle_no' => $data['vehicle_no'] ?? null,
            'transporter_name' => $data['transporter_name'] ?? null,
            'eway_bill_no' => $data['eway_bill_no'] ?? null,
            'receiver_name' => $data['receiver_name'] ?? null,
            'receiver_signature_datetime' => $data['receiver_signature_datetime'] ?? null,
        ];
    }

    private function syncLines(CommercialDocument $doc, array $lines): void
    {
        foreach ($lines as $line) {
            DocumentLineItem::create([
                'commercial_document_id' => $doc->id,
                'product_id' => $line['product_id'] ?? null,
                'description' => $line['description'] ?? 'Item',
                'hsn_sac' => $line['hsn_sac'] ?? null,
                'qty' => $line['qty'] ?? 1,
                'unit' => $line['unit'] ?? 'NOS',
                'rate' => $line['rate'] ?? 0,
                'discount_percent' => $line['discount_percent'] ?? 0,
                'discount_amount' => $line['discount_amount'] ?? 0,
                'gst_rate' => $line['gst_rate'] ?? 0,
                'taxable_amount' => $line['taxable_amount'] ?? 0,
                'cgst_amount' => $line['cgst_amount'] ?? 0,
                'sgst_amount' => $line['sgst_amount'] ?? 0,
                'igst_amount' => $line['igst_amount'] ?? 0,
                'total_amount' => $line['total_amount'] ?? 0,
                'sort_order' => $line['sort_order'] ?? 0,
            ]);
        }
    }

    /**
     * When an invoice/bill-of-supply line item's HSN/SAC is corrected via edit, any
     * already-issued Credit Notes raised against it still carry the OLD HSN as a
     * one-time snapshot taken at their own creation time (src/pages/billing/InvoiceForm.jsx's
     * mapDocLines() copies it once when the credit note form loads) — nothing keeps a
     * credit note's line in sync with its source invoice's line after that. Left alone,
     * this leaves the HSN/SAC Summary report (ReportController::build, 'hsn_summary')
     * with an orphaned negative row under the old code instead of netting against the
     * corrected one. This cascades the correction forward.
     *
     * Conservative by design: a credit note's line at position $i is only updated when it
     * still exactly matches the invoice's PRE-edit HSN there — a credit note whose lines
     * were customized differently after creation (different HSN, reordered, partial) is
     * left untouched rather than guessed at.
     */
    private function cascadeHsnCorrectionToCreditNotes(CommercialDocument $doc, array $oldLines, array $newLines): void
    {
        $changedByPosition = [];
        foreach ($newLines as $i => $newLine) {
            $oldHsn = $oldLines[$i]['hsn_sac'] ?? null;
            $newHsn = $newLine['hsn_sac'] ?? null;
            if ($oldHsn !== null && $newHsn !== null && $oldHsn !== $newHsn) {
                $changedByPosition[$i] = ['old' => $oldHsn, 'new' => $newHsn];
            }
        }
        if (! $changedByPosition) {
            return;
        }

        $creditNotes = CommercialDocument::where('reference_document_id', $doc->id)
            ->where('type', 'credit_note')
            ->with('lineItems')
            ->get();

        foreach ($creditNotes as $creditNote) {
            $lines = $creditNote->lineItems->sortBy('id')->values();
            $touched = false;
            foreach ($changedByPosition as $i => $change) {
                $line = $lines->get($i);
                if ($line && $line->hsn_sac === $change['old']) {
                    $line->update(['hsn_sac' => $change['new']]);
                    $touched = true;
                }
            }
            if ($touched) {
                try {
                    $this->generatePdf($creditNote->fresh()->load(['lineItems', 'customer', 'clientProfile', 'referenceDocument']));
                } catch (\Throwable $e) {
                    // Non-fatal — the DB correction still stands even if PDF regen fails.
                }
            }
        }
    }

    public function generatePdf(CommercialDocument $doc): string
    {
        $doc->loadMissing([
            'lineItems',
            'customer',
            'clientProfile.user',
            'clientProfile.documentSettings',
            'referenceDocument',
            'tdsTcsSection',
        ]);

        $profile = $doc->clientProfile;
        $isNewRendererEnabled = (bool) config('invoice.new_renderer', false);

        // Resolve layout and colour settings from client_document_settings
        $docSetting = $profile?->documentSettings?->firstWhere('document_type', $doc->type);
        $layoutId = $docSetting?->layout_id ?? $profile?->default_layout_id ?? 1;
        $colourScheme = $docSetting?->colour_scheme ?? $profile?->default_colour_scheme ?? 'slate_blue';
        $watermarkApplies = $profile?->watermark_enabled && ($docSetting?->watermark_applies ?? false);
        $watermarkText = $profile?->watermark_text;

        // Render using Layout 1, Layout 2, Layout 3, or Layout 4 if flag is on and layout_id is 1, 2, 3, or 4
        if ($isNewRendererEnabled && in_array($layoutId, [1, 2, 3, 4], true)) {
            try {
                $theme = \App\Services\DocumentTemplate\DocumentThemeTokens::get($colourScheme);
                $data = \App\Services\DocumentTemplate\DocumentPayloadBuilder::build($doc);

                $viewName = match ($layoutId) {
                    2 => 'pdf.layouts.layout2',
                    3 => 'pdf.layouts.layout3',
                    4 => 'pdf.layouts.layout4',
                    default => 'pdf.layouts.layout1',
                };
                $viewData = [
                    'data' => $data,
                    'theme' => $theme,
                ];
                if (in_array($layoutId, [1, 3], true)) {
                    $viewData['icons'] = \App\Services\DocumentTemplate\DocumentCanvasHelper::resolveIcons($theme['key']);
                }

                $pdf = Pdf::loadView($viewName, $viewData)
                    ->setPaper('a4', 'portrait')
                    ->setOption([
                        'isRemoteEnabled' => true,
                        'dpi' => 96,
                        'defaultFont' => 'DejaVu Sans',
                    ]);

                $pdf->render();
                $dompdf = $pdf->getDomPDF();

                // Frame / corner ribbons / footer for the chosen layout
                \App\Services\DocumentTemplate\DocumentCanvasHelper::decorate(
                    $dompdf->getCanvas(),
                    $dompdf->getFontMetrics(),
                    $theme,
                    (int) $layoutId,
                    (bool) $watermarkApplies,
                    $watermarkText
                );

                $dir = 'invoices/' . $doc->client_profile_id;
                $safeNumber = preg_replace('/[^A-Za-z0-9\-]/', '_', $doc->number);
                $path = $dir . '/' . $doc->type . '-' . $safeNumber . '.pdf';
                Storage::disk('public')->makeDirectory($dir);
                Storage::disk('public')->put($path, $pdf->output());
                $doc->update(['pdf_path' => $path]);

                return $path;
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning("Layout {$layoutId} PDF rendering failed for doc {$doc->id}: " . $e->getMessage() . ". Falling back to legacy invoice template.");
                // Fall back to legacy renderer below
            }
        }

        // Legacy invoice.blade.php renderer (Fallback for flag off, unsupported layout, or render error)
        $pdf = Pdf::loadView('pdf.invoice', ['doc' => $doc])
            ->setPaper('a4', 'portrait')
            ->setOption(['isRemoteEnabled' => true, 'dpi' => 96, 'defaultFont' => 'DejaVu Sans']);
        // Render first: page_script draws immediately over existing pages,
        // so it must run only after all pages have been laid out.
        $pdf->render();
        $dompdf = $pdf->getDomPDF();
        $canvas = $dompdf->getCanvas();
        $fontMetrics = $dompdf->getFontMetrics();
        $font = $fontMetrics->getFont('DejaVu Sans');
        $size = 8.5;
        $color = [0.4, 0.46, 0.55];
        $linkColor = [0.118, 0.251, 0.686];
        $canvas->page_script(function ($pageNumber, $pageCount, $canvas, $fontMetrics) use ($font, $size, $color, $linkColor) {
            // Rounded page frame on every page (HTML border cannot repeat per page)
            $frameColor = [0.118, 0.251, 0.686];
            $fw = 1.6;
            $r = 12;
            $x0 = 20;
            $y0 = 14;
            $x1 = $canvas->get_width() - 20;
            $y1 = $canvas->get_height() - 30;
            $canvas->line($x0 + $r, $y0, $x1 - $r, $y0, $frameColor, $fw);
            $canvas->line($x0 + $r, $y1, $x1 - $r, $y1, $frameColor, $fw);
            $canvas->line($x0, $y0 + $r, $x0, $y1 - $r, $frameColor, $fw);
            $canvas->line($x1, $y0 + $r, $x1, $y1 - $r, $frameColor, $fw);
            $canvas->arc($x0 + $r, $y0 + $r, $r, $r, 90, 180, $frameColor, $fw);
            $canvas->arc($x1 - $r, $y0 + $r, $r, $r, 0, 90, $frameColor, $fw);
            $canvas->arc($x1 - $r, $y1 - $r, $r, $r, 270, 360, $frameColor, $fw);
            $canvas->arc($x0 + $r, $y1 - $r, $r, $r, 180, 270, $frameColor, $fw);

            $y = $canvas->get_height() - 24;
            $prefix = 'Generated by ';
            $linkText = 'www.abkhanassociates.com';
            $prefixWidth = $fontMetrics->getTextWidth($prefix, $font, $size);
            $linkWidth = $fontMetrics->getTextWidth($linkText, $font, $size);
            $lineHeight = $fontMetrics->getFontHeight($font, $size);
            $canvas->text(28, $y, $prefix, $font, $size, $color);
            $canvas->text(28 + $prefixWidth, $y, $linkText, $font, $size, $linkColor);
            $canvas->add_link('https://www.abkhanassociates.com', 28 + $prefixWidth, $y, $linkWidth, $lineHeight);

            $text = "Page {$pageNumber} of {$pageCount}";
            $width = $fontMetrics->getTextWidth($text, $font, $size);
            $canvas->text($canvas->get_width() - 28 - $width, $y, $text, $font, $size, $color);
        });
        $dir = 'invoices/' . $doc->client_profile_id;
        $safeNumber = preg_replace('/[^A-Za-z0-9\-]/', '_', $doc->number);
        $path = $dir . '/' . $doc->type . '-' . $safeNumber . '.pdf';
        Storage::disk('public')->makeDirectory($dir);
        Storage::disk('public')->put($path, $pdf->output());
        $doc->update(['pdf_path' => $path]);

        return $path;
    }
}
