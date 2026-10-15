<?php

namespace App\Services\DocumentTemplate;

use App\Models\ClientProfile;
use App\Models\CommercialDocument;
use App\Models\Customer;
use App\Models\DocumentLineItem;
use Barryvdh\DomPDF\Facade\Pdf;

/**
 * Renders a layout preview PDF using demo document data.
 *
 * Nothing is persisted: the document, customer, line items and the profile
 * copy are all in-memory models. Only the client's branding (logo, signature,
 * seal, company name, tagline, watermark text) is carried over from the real
 * profile. Uses the same DocumentPayloadBuilder, layout Blade views and
 * DocumentCanvasHelper as InvoiceService::generatePdf().
 */
class LayoutPreviewRenderer
{
    public const DOCUMENT_TYPES = [
        'tax_invoice',
        'bill_of_supply',
        'credit_note',
        'debit_note',
        'quotation',
        'delivery_challan',
    ];

    private const DEMO_NUMBERS = [
        'tax_invoice' => 'INV-001',
        'bill_of_supply' => 'BOS-001',
        'credit_note' => 'CN-001',
        'debit_note' => 'DN-001',
        'quotation' => 'QT-001',
        'delivery_challan' => 'DC-001',
    ];

    /**
     * Build the Blade view name and data for a preview.
     *
     * @return array{view: string, data: array, theme: array, viewData: array}
     */
    public function prepare(ClientProfile $profile, int $layoutId, string $colourScheme, string $documentType): array
    {
        $doc = $this->buildDemoDocument($profile, $documentType);
        $theme = DocumentThemeTokens::get($colourScheme);
        $data = DocumentPayloadBuilder::build($doc);

        $view = match ($layoutId) {
            2 => 'pdf.layouts.layout2',
            3 => 'pdf.layouts.layout3',
            4 => 'pdf.layouts.layout4',
            default => 'pdf.layouts.layout1',
        };

        $viewData = ['data' => $data, 'theme' => $theme];
        if ($layoutId === 1) {
            $viewData['icons'] = DocumentCanvasHelper::resolveIcons($theme['key']);
        }

        return ['view' => $view, 'data' => $data, 'theme' => $theme, 'viewData' => $viewData];
    }

    /**
     * Render the preview and return raw PDF bytes (not stored anywhere).
     */
    public function render(
        ClientProfile $profile,
        int $layoutId,
        string $colourScheme,
        string $documentType,
        bool $watermark
    ): string {
        $prepared = $this->prepare($profile, $layoutId, $colourScheme, $documentType);

        $pdf = Pdf::loadView($prepared['view'], $prepared['viewData'])
            ->setPaper('a4', 'portrait')
            ->setOption([
                'isRemoteEnabled' => true,
                'dpi' => 96,
                'defaultFont' => 'DejaVu Sans',
            ]);

        $pdf->render();
        $dompdf = $pdf->getDomPDF();

        // Same frame rules as InvoiceService::generatePdf()
        $borderRadius = in_array($layoutId, [2, 3], true) ? 0 : 11;
        $drawFrame = $layoutId !== 4;

        DocumentCanvasHelper::attachFrameAndFooter(
            $dompdf->getCanvas(),
            $dompdf->getFontMetrics(),
            $prepared['theme'],
            $watermark,
            $profile->watermark_text,
            $borderRadius,
            $drawFrame
        );

        return $pdf->output();
    }

    private function buildDemoDocument(ClientProfile $real, string $type): CommercialDocument
    {
        // In-memory copy of the profile: demo company details, real branding.
        $profile = $real->replicate();
        $profile->forceFill([
            'has_gst' => true,
            'dealer_type' => 'regular',
            'gstin' => '27AABCD1234E1Z5',
            'pan' => 'AABCD1234E',
            'address' => '12, Sample Business Park, MG Road',
            'address_line_1' => '12, Sample Business Park, MG Road',
            'address_line_2' => null,
            'city' => 'Mumbai',
            'state' => 'Maharashtra',
            'state_code' => '27',
            'pincode' => '400001',
            'email' => 'accounts@example.com',
            'mobile' => '9876543210',
            'bank_name' => 'Sample Bank',
            'account_holder_name' => null,
            'bank_account' => '123456789012',
            'bank_ifsc' => 'SAMP0001234',
            'bank_branch' => 'Mumbai Main Branch',
            'terms_conditions' => null,
            'signatory_name' => null,
        ]);
        $profile->setRelation('user', null);

        $customer = new Customer([
            'name' => 'Sample Customer Pvt Ltd',
            'gstin' => '27AAACS9876F1Z2',
            'gst_status' => 'registered',
            'state_code' => '27',
            'state' => 'Maharashtra',
            'place_of_supply' => 'Maharashtra',
            'billing_address' => '45, Demo Tower, Andheri East, Mumbai - 400069',
            'shipping_address' => '45, Demo Tower, Andheri East, Mumbai - 400069',
            'phone' => '9123456780',
        ]);

        $hasTax = $type !== 'bill_of_supply';
        $taxable = 40000.00;
        $cgst = $hasTax ? 3600.00 : 0.00;
        $sgst = $hasTax ? 3600.00 : 0.00;
        $grand = $taxable + $cgst + $sgst;
        $gstRate = $hasTax ? 18 : 0;

        $doc = new CommercialDocument([
            'type' => $type,
            'number' => self::DEMO_NUMBERS[$type] ?? 'INV-001',
            'document_date' => now()->toDateString(),
            'status' => 'issued',
            'place_of_supply' => 'Maharashtra (27)',
            'is_inter_state' => false,
            'is_reverse_charge' => false,
            'taxable_amount' => $taxable,
            'cgst_amount' => $cgst,
            'sgst_amount' => $sgst,
            'igst_amount' => 0,
            'total_amount' => $grand,
            'round_off' => 0,
            'grand_total' => $grand,
            'amount_in_words' => $hasTax
                ? 'Forty Seven Thousand Two Hundred Rupees Only'
                : 'Forty Thousand Rupees Only',
            'vehicle_no' => $type === 'delivery_challan' ? 'MH-01-AB-1234' : null,
            'transporter_name' => $type === 'delivery_challan' ? 'Sample Logistics' : null,
            'reason_for_transportation' => $type === 'delivery_challan' ? 'job_work' : null,
        ]);

        $items = collect([
            new DocumentLineItem([
                'item_name' => 'Professional Services',
                'description' => 'Monthly consulting and compliance support',
                'hsn_sac' => '998311',
                'qty' => 1,
                'unit' => 'NOS',
                'rate' => 25000,
                'gst_rate' => $gstRate,
                'taxable_amount' => 25000,
                'total_amount' => 25000 * (1 + $gstRate / 100),
                'sort_order' => 1,
            ]),
            new DocumentLineItem([
                'item_name' => 'Support Hours',
                'description' => null,
                'hsn_sac' => '998313',
                'qty' => 2,
                'unit' => 'HRS',
                'rate' => 7500,
                'gst_rate' => $gstRate,
                'taxable_amount' => 15000,
                'total_amount' => 15000 * (1 + $gstRate / 100),
                'sort_order' => 2,
            ]),
        ]);

        $doc->setRelation('clientProfile', $profile);
        $doc->setRelation('customer', $customer);
        $doc->setRelation('lineItems', $items);

        if (in_array($type, ['credit_note', 'debit_note'], true)) {
            $doc->setRelation('referenceDocument', new CommercialDocument([
                'type' => 'tax_invoice',
                'number' => 'INV-000',
            ]));
        } else {
            $doc->setRelation('referenceDocument', null);
        }

        return $doc;
    }
}
