<?php

namespace App\Services\DocumentTemplate;

use App\Models\CommercialDocument;

class DocumentPayloadBuilder
{
    /**
     * Map a CommercialDocument model and its relationships into a normalized view data array.
     */
    public static function build(CommercialDocument $doc): array
    {
        $doc->loadMissing([
            'lineItems',
            'customer',
            'clientProfile.user',
            'referenceDocument',
            'tdsTcsSection',
        ]);

        $p = $doc->clientProfile;
        $c = $doc->customer;

        $phone = $p->mobile ?: ($p->user?->phone ?? null);
        $email = $p->email ?: ($p->user?->email ?? null);
        $business = $p->business_name ?: ($p->client_name ?: 'Business');

        // Document title mapping
        $docTitle = match ($doc->type) {
            'bill_of_supply' => 'BILL OF SUPPLY',
            'credit_note' => 'CREDIT NOTE',
            'debit_note' => 'DEBIT NOTE',
            'quotation' => 'QUOTATION',
            'delivery_challan' => 'DELIVERY CHALLAN',
            'amendment' => 'AMENDMENT',
            'proforma' => 'PROFORMA INVOICE',
            default => 'TAX INVOICE',
        };
        if ($doc->type === 'tax_invoice' && ! $p->has_gst) {
            $docTitle = 'BILL / RECEIPT';
        }

        // Meta labels
        $docNumberLabel = match ($doc->type) {
            'quotation' => 'Quotation No.',
            'credit_note' => 'Credit Note No.',
            'debit_note' => 'Debit Note No.',
            'delivery_challan' => 'Challan No.',
            'bill_of_supply' => 'Bill No.',
            default => 'Tax Invoice No.',
        };
        $docDateLabel = match ($doc->type) {
            'quotation' => 'Quotation Date',
            'credit_note' => 'Credit Note Date',
            'debit_note' => 'Debit Note Date',
            'delivery_challan' => 'Challan Date',
            'bill_of_supply' => 'Bill Date',
            default => 'Tax Invoice Date',
        };

        // Address resolution
        $addressParts = array_filter([
            $p->address_line_1 ?: $p->address,
            $p->address_line_2,
            $p->city,
            trim(($p->state ?: '') . ($p->pincode ? ' - ' . $p->pincode : '')),
        ], fn ($part) => filled($part));
        $sellerAddress = implode(', ', $addressParts);

        // State line formatting
        $gstStateNames = [
            '01' => 'Jammu & Kashmir', '02' => 'Himachal Pradesh', '03' => 'Punjab', '04' => 'Chandigarh',
            '05' => 'Uttarakhand', '06' => 'Haryana', '07' => 'Delhi', '08' => 'Rajasthan', '09' => 'Uttar Pradesh',
            '10' => 'Bihar', '11' => 'Sikkim', '12' => 'Arunachal Pradesh', '13' => 'Nagaland', '14' => 'Manipur',
            '15' => 'Mizoram', '16' => 'Tripura', '17' => 'Meghalaya', '18' => 'Assam', '19' => 'West Bengal',
            '20' => 'Jharkhand', '21' => 'Odisha', '22' => 'Chhattisgarh', '23' => 'Madhya Pradesh', '24' => 'Gujarat',
            '25' => 'Daman & Diu', '26' => 'Dadra & Nagar Haveli', '27' => 'Maharashtra', '28' => 'Andhra Pradesh',
            '29' => 'Karnataka', '30' => 'Goa', '31' => 'Lakshadweep', '32' => 'Kerala', '33' => 'Tamil Nadu',
            '34' => 'Puducherry', '35' => 'Andaman & Nicobar Islands', '36' => 'Telangana', '37' => 'Andhra Pradesh',
            '38' => 'Ladakh', '97' => 'Other Territory', '99' => 'Centre Jurisdiction',
        ];
        $stateLine = function ($state, $code) use ($gstStateNames) {
            $state = $state ?: ($code ? ($gstStateNames[str_pad((string) $code, 2, '0', STR_PAD_LEFT)] ?? null) : null);
            if ($state && $code) return $state . ' (State Code: ' . $code . ')';
            if ($state) return $state;
            if ($code) return 'State Code: ' . $code;
            return '';
        };

        $sellerStateLine = $stateLine($p->state, $p->state_code);

        // Bill to and Ship to
        $billAddr = $c?->billing_address;
        $shipAddr = $c?->shipping_address ?: $billAddr;
        $billStateLine = $stateLine($c?->state, $c?->state_code);
        $shipStateLine = $doc->is_inter_state && filled($doc->place_of_supply)
            ? $doc->place_of_supply
            : $billStateLine;

        // Place of Supply
        $pos = trim((string) ($doc->place_of_supply ?: ''));
        if ($pos === '') {
            $posLine = '—';
        } elseif (preg_match('/\(\s*\d{1,2}\s*\)/', $pos) || stripos($pos, 'state code') !== false) {
            $posLine = $pos;
        } elseif ($c?->state_code && $c?->state && stripos($pos, (string) $c->state) !== false) {
            $posLine = $c->state . ' (' . $c->state_code . ')';
        } elseif ($p->state_code && $p->state && stripos($pos, (string) $p->state) !== false) {
            $posLine = $p->state . ' (' . $p->state_code . ')';
        } else {
            $posLine = $pos;
        }

        // Financial year
        $fyStartYear = $doc->document_date ? ($doc->document_date->month >= 4 ? $doc->document_date->year : $doc->document_date->year - 1) : null;
        $financialYear = $fyStartYear ? ($fyStartYear . '-' . substr((string) ($fyStartYear + 1), -2)) : '—';

        // Tax applicability: Bill of Supply has NO tax columns. Composition dealer has NO tax columns.
        $hasTax = $doc->type !== 'bill_of_supply' && $p->has_gst && $p->dealer_type !== 'composition';
        $showHsn = $hasTax || $p->has_gst;

        // Lines mapping
        $items = [];
        $cgstRate = null;
        $sgstRate = null;
        $igstRate = null;

        foreach ($doc->lineItems as $idx => $line) {
            $ratePct = $line->gst_rate > 0 ? rtrim(rtrim(number_format((float) $line->gst_rate, 2), '0'), '.') . '%' : '0%';
            if ($line->gst_rate > 0 && $igstRate === null && $cgstRate === null) {
                if ($doc->is_inter_state) {
                    $igstRate = rtrim(rtrim(number_format((float) $line->gst_rate, 2), '0'), '.');
                } else {
                    $half = round(((float) $line->gst_rate) / 2, 2);
                    $cgstRate = rtrim(rtrim(number_format($half, 2), '0'), '.');
                    $sgstRate = rtrim(rtrim(number_format($half, 2), '0'), '.');
                }
            }

            $rawQty = $line->qty ?? $line->quantity;
            $qtyDisplay = $rawQty !== null
                ? (fmod((float) $rawQty, 1) == 0.0 ? (int) $rawQty : (float) $rawQty)
                : null;

            $items[] = [
                'sr_no' => $idx + 1,
                'particulars' => $line->item_name ?: $line->description ?: 'Item',
                'description' => ($line->item_name && $line->description && $line->description !== $line->item_name) ? $line->description : null,
                'hsn_sac' => $line->hsn_sac,
                'qty' => $qtyDisplay,
                'uqc' => $line->unit ?: 'NOS',
                'rate' => (float) $line->rate,
                'gst_pct' => $ratePct,
                'taxable_value' => (float) ($line->taxable_amount ?: ($line->total ?: 0)),
            ];
        }

        // Amount in words
        $wordsDisplay = self::formatAmountInWords($doc->amount_in_words);

        // Asset paths
        $logoPath = ($p->logo_path && file_exists(public_path('storage/' . $p->logo_path)))
            ? public_path('storage/' . $p->logo_path)
            : (file_exists(public_path('pdf-assets/website-logo.png')) ? public_path('pdf-assets/website-logo.png') : null);
        $sigPath = ($p->signature_path && file_exists(public_path('storage/' . $p->signature_path)))
            ? public_path('storage/' . $p->signature_path)
            : null;
        $sealPath = ($p->seal_path && file_exists(public_path('storage/' . $p->seal_path)))
            ? public_path('storage/' . $p->seal_path)
            : null;

        // Terms
        $termsSource = $doc->terms ?: ($p->terms_conditions ?: '');
        $termsLines = [];
        if ($doc->payment_terms) {
            $termsLines[] = $doc->payment_terms;
        }
        if ($termsSource) {
            foreach (preg_split("/\r\n|\n|\r/", (string) $termsSource) as $tLine) {
                $tLine = trim(preg_replace('/^\d+[\.\)]\s*/', '', $tLine));
                if ($tLine !== '') $termsLines[] = $tLine;
            }
        }
        if (! $termsLines) {
            $termsLines = [
                'Payment is expected within 7 days from the invoice issuance date; otherwise 18% interest will be charged on overdue payment.',
                'All disputes are subject to Mumbai Jurisdiction.',
            ];
        }

        // Challan reasons
        $reasonForTransportLabel = match ($doc->reason_for_transportation) {
            'job_work' => 'Job Work',
            'repair' => 'Repair',
            'returnable_goods' => 'Returnable Goods',
            'branch_transfer' => 'Branch Transfer',
            'other' => $doc->reason_for_transportation_other ?: 'Other',
            default => '—',
        };

        return [
            'doc_type' => $doc->type,
            'document_title' => $docTitle,
            'doc_number_label' => $docNumberLabel,
            'doc_date_label' => $docDateLabel,
            'company_name' => strtoupper($business),
            'company_name_title_case' => ucwords(strtolower($business)),
            'tagline' => $p->invoice_tagline,
            'logo_path' => $logoPath,
            'seller_address' => $sellerAddress,
            'seller_gstin' => ($p->has_gst && $p->gstin) ? $p->gstin : null,
            'seller_pan' => $p->pan,
            'seller_email' => $email,
            'seller_phone' => $phone,
            'seller_state' => $sellerStateLine,
            'invoice_no' => $doc->number,
            'invoice_date' => $doc->document_date?->format('d/m/Y') ?: '—',
            'financial_year' => $financialYear,
            'place_of_supply' => $posLine,
            'reverse_charge' => (bool) $doc->is_reverse_charge,
            'against_number' => $doc->referenceDocument?->number,
            'bill_to' => [
                'name' => $c?->name ?: '—',
                'address' => $billAddr,
                'gstin' => $c?->gstin_display,
                'pan' => ($c?->gstin && strlen($c->gstin) === 15) ? substr($c->gstin, 2, 10) : null,
                'state' => $billStateLine,
                'place_of_supply' => $c?->place_of_supply ?: ($c?->state ?: null),
                'mobile' => $c?->phone,
                'email' => $c?->email,
            ],
            'ship_to' => [
                'name' => $c?->name ?: '—',
                'address' => $shipAddr,
                'gstin' => $c?->gstin_display,
                'pan' => ($c?->gstin && strlen($c->gstin) === 15) ? substr($c->gstin, 2, 10) : null,
                'state' => $shipStateLine,
                'place_of_supply' => $c?->place_of_supply ?: ($c?->state ?: null),
                'mobile' => $c?->phone,
                'email' => $c?->email,
            ],
            'has_tax' => $hasTax,
            'show_hsn' => $showHsn,
            'items' => $items,
            'amount_in_words' => $wordsDisplay,
            'bank' => [
                'name' => $p->bank_name,
                'account_name' => $p->account_holder_name ?: $business,
                'account_no' => $p->bank_account,
                'ifsc' => $p->bank_ifsc,
                'branch' => $p->bank_branch,
            ],
            'terms' => $termsLines,
            'is_delivery_challan' => $doc->type === 'delivery_challan',
            'challan' => [
                'reason' => $reasonForTransportLabel,
                'vehicle_no' => $doc->vehicle_no,
                'transporter_name' => $doc->transporter_name,
                'eway_bill_no' => $doc->eway_bill_no,
                'receiver_name' => $doc->receiver_name,
            ],
            'summary' => [
                'taxable_value' => (float) ($doc->taxable_amount ?: ($doc->total_amount ?: $doc->grand_total)),
                'show_split_tax' => $hasTax && ! $doc->is_inter_state,
                'cgst_rate' => $cgstRate,
                'cgst_amount' => (float) $doc->cgst_amount,
                'sgst_rate' => $sgstRate,
                'sgst_amount' => (float) $doc->sgst_amount,
                'igst_rate' => $igstRate,
                'igst_amount' => (float) $doc->igst_amount,
                'round_off' => (float) $doc->round_off,
                'tds_tcs_type' => $doc->tax_deduction_type ?: null,
                'tds_tcs_amount' => (float) ($doc->tds_tcs_amount ?? 0),
                'tds_tcs_rate' => $doc->tds_tcs_rate !== null ? (float) $doc->tds_tcs_rate : null,
                'tds_tcs_section' => $doc->tdsTcsSection?->code,
                'grand_total' => (float) ($doc->grand_total ?: $doc->total_amount),
            ],
            'seal_path' => $sealPath,
            'signature_path' => $sigPath,
            'signatory_name' => $p->signatory_name ?: $business,
        ];
    }

    /**
     * Shared seller formatting builder reusing 2B PDF seller data.
     */
    public static function buildSeller(\App\Models\ClientProfile $p): array
    {
        $phone = $p->mobile ?: ($p->user?->phone ?? null);
        $email = $p->email ?: ($p->user?->email ?? null);
        $business = $p->business_name ?: ($p->client_name ?: 'Business');

        $addressParts = array_filter([
            $p->address_line_1 ?: $p->address,
            $p->address_line_2,
            $p->city,
            trim(($p->state ?: '') . ($p->pincode ? ' - ' . $p->pincode : '')),
        ], fn ($part) => filled($part));
        $sellerAddress = implode(', ', $addressParts);

        $gstStateNames = [
            '01' => 'Jammu & Kashmir', '02' => 'Himachal Pradesh', '03' => 'Punjab', '04' => 'Chandigarh',
            '05' => 'Uttarakhand', '06' => 'Haryana', '07' => 'Delhi', '08' => 'Rajasthan', '09' => 'Uttar Pradesh',
            '10' => 'Bihar', '11' => 'Sikkim', '12' => 'Arunachal Pradesh', '13' => 'Nagaland', '14' => 'Manipur',
            '15' => 'Mizoram', '16' => 'Tripura', '17' => 'Meghalaya', '18' => 'Assam', '19' => 'West Bengal',
            '20' => 'Jharkhand', '21' => 'Odisha', '22' => 'Chhattisgarh', '23' => 'Madhya Pradesh', '24' => 'Gujarat',
            '25' => 'Daman & Diu', '26' => 'Dadra & Nagar Haveli', '27' => 'Maharashtra', '28' => 'Andhra Pradesh',
            '29' => 'Karnataka', '30' => 'Goa', '31' => 'Lakshadweep', '32' => 'Kerala', '33' => 'Tamil Nadu',
            '34' => 'Puducherry', '35' => 'Andaman & Nicobar Islands', '36' => 'Telangana', '37' => 'Andhra Pradesh',
            '38' => 'Ladakh', '97' => 'Other Territory', '99' => 'Centre Jurisdiction',
        ];
        $state = $p->state ?: ($p->state_code ? ($gstStateNames[str_pad((string) $p->state_code, 2, '0', STR_PAD_LEFT)] ?? null) : null);
        $sellerStateLine = '';
        if ($state && $p->state_code) {
            $sellerStateLine = $state . ' (State Code: ' . $p->state_code . ')';
        } elseif ($state) {
            $sellerStateLine = $state;
        } elseif ($p->state_code) {
            $sellerStateLine = 'State Code: ' . $p->state_code;
        }

        $logoPath = ($p->logo_path && file_exists(public_path('storage/' . $p->logo_path)))
            ? public_path('storage/' . $p->logo_path)
            : (file_exists(public_path('pdf-assets/website-logo.png')) ? public_path('pdf-assets/website-logo.png') : null);

        return [
            'business_name' => $business,
            'company_name' => strtoupper($business),
            'company_name_title_case' => ucwords(strtolower($business)),
            'tagline' => $p->invoice_tagline,
            'logo_path' => $logoPath,
            'logo_url' => $p->logo_path ? ('/storage/' . $p->logo_path) : null,
            'address' => $sellerAddress,
            'gstin' => ($p->has_gst && $p->gstin) ? $p->gstin : null,
            'pan' => $p->pan,
            'email' => $email,
            'phone' => $phone,
            'state' => $p->state,
            'state_code' => $p->state_code,
            'state_line' => $sellerStateLine,
        ];
    }

    /**
     * Exact canonical amount in words formatter used by the 2B renderer.
     */
    public static function formatAmountInWords(?string $raw): string
    {
        $wordsRaw = trim((string) ($raw ?: ''));
        if ($wordsRaw === '') {
            return '—';
        }
        $core = preg_replace('/\s*Only\.?$/i', '', $wordsRaw);
        $core = preg_replace('/\s*Rupees?\s*/i', ' ', $core);
        $core = trim(preg_replace('/\s+/', ' ', $core));

        return 'Rupees ' . $core . ' Only.';
    }
}
