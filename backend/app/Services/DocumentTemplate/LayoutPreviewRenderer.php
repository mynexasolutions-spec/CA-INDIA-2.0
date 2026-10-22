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
 * Everything that is not the client's own data (customer, items, amounts, document number, and the company details in
 * the admin previews) is plainly labelled "Sample", so a preview can never be mistaken for a real user's data. The
 * page also carries a small "Sample data" note in its footer.
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

    public const DEFAULT_WEBSITE = 'www.abkhanassociates.com';

    private const DEMO_NUMBERS = [
        'tax_invoice' => 'INV-SAMPLE',
        'bill_of_supply' => 'BOS-SAMPLE',
        'credit_note' => 'CN-SAMPLE',
        'debit_note' => 'DN-SAMPLE',
        'quotation' => 'QT-SAMPLE',
        'delivery_challan' => 'DC-SAMPLE',
    ];

    /**
     * Build the Blade view name and data for a preview.
     *
     * @return array{view: string, data: array, theme: array, viewData: array}
     */
    public function prepare(ClientProfile $profile, int $layoutId, string $colourScheme, string $documentType, bool $clientDetails = false): array
    {
        $doc = $this->buildDemoDocument($profile, $documentType, $clientDetails);
        $theme = DocumentThemeTokens::get($colourScheme);
        $data = DocumentPayloadBuilder::build($doc);
        // A preview shows every component of the layout: the PO No. / Against boxes and every tax / TDS / round-off row
        // (those that do not apply to the sample read "(If Applicable)"). Real documents list only what applies.
        $data['sample_all'] = true;
        $data['po_number'] = 'SAMPLE-PO';
        $data['against_number'] = 'SAMPLE-INV';

        $view = match ($layoutId) {
            2 => 'pdf.layouts.layout2',
            3 => 'pdf.layouts.layout3',
            4 => 'pdf.layouts.layout4',
            default => 'pdf.layouts.layout1',
        };

        $viewData = ['data' => $data, 'theme' => $theme];
        if (in_array($layoutId, [1, 3], true)) {
            $viewData['icons'] = DocumentCanvasHelper::resolveIcons($theme['key']);
        }

        return ['view' => $view, 'data' => $data, 'theme' => $theme, 'viewData' => $viewData];
    }

    /**
     * Bump whenever the rendered output changes for the same inputs (a template, the sample data, the footer ...), so
     * cached previews made by older code are not reused.
     */
    private const CACHE_VERSION = 'v41';

    /**
     * render(), served from a small file cache shared by the client and admin previews. Rendering costs a second or
     * more (dompdf), so identical requests are answered from disk. The key covers everything the output depends on: the
     * whole profile row (any edit bumps it), the login account's email/phone (the contact fallback), the layout,
     * colour, document type, watermark flag, client-details mode, and today's date (the sample shows the current
     * date). Files expire after a day; expired ones are swept whenever a new preview is written.
     */
    public function renderCached(
        ClientProfile $profile,
        int $layoutId,
        string $colourScheme,
        string $documentType,
        bool $watermark,
        bool $clientDetails = false
    ): string {
        $disk = \Illuminate\Support\Facades\Storage::disk('local');
        $key = md5(json_encode([
            $profile->getAttributes(), $profile->user?->email, $profile->user?->phone,
            $layoutId, $colourScheme, $documentType, $watermark, $clientDetails, now()->toDateString(), self::CACHE_VERSION,
        ]));
        $path = "layout-preview-cache/{$key}.pdf";

        if ($disk->exists($path) && $disk->lastModified($path) > now()->subDay()->getTimestamp()) {
            return $disk->get($path);
        }

        $pdf = $this->render($profile, $layoutId, $colourScheme, $documentType, $watermark, $clientDetails);

        try {
            foreach ($disk->files('layout-preview-cache') as $old) {
                if ($disk->lastModified($old) < now()->subDay()->getTimestamp()) {
                    $disk->delete($old);
                }
            }
            $disk->put($path, $pdf);
        } catch (\Throwable $e) {
            // The cache is an optimisation only: a write failure must never break the preview.
            \Illuminate\Support\Facades\Log::notice('Layout preview cache write failed: '.$e->getMessage());
        }

        return $pdf;
    }

    /**
     * Render the preview and return raw PDF bytes (not stored anywhere).
     */
    public function render(
        ClientProfile $profile,
        int $layoutId,
        string $colourScheme,
        string $documentType,
        bool $watermark,
        bool $clientDetails = false
    ): string {
        $prepared = $this->prepare($profile, $layoutId, $colourScheme, $documentType, $clientDetails);

        $pdf = Pdf::loadView($prepared['view'], $prepared['viewData'])
            ->setPaper('a4', 'portrait')
            ->setOption([
                'isRemoteEnabled' => true,
                'dpi' => 96,
                'defaultFont' => 'DejaVu Sans',
            ]);

        // Layout 3: rounded boxes drawn on the canvas. Layout 1: the header and totals divider lines, extended to the bottom of their cells.
        $rounded = $layoutId === 3 ? DocumentCanvasHelper::roundedBorders($prepared['theme'])
            : (in_array($layoutId, [1, 2], true) ? DocumentCanvasHelper::layout1Dividers() : null);
        if ($rounded) {
            $pdf->getDomPDF()->setCallbacks($rounded['callbacks']);
        }

        $pdf->render();
        $dompdf = $pdf->getDomPDF();
        if ($rounded) {
            $rounded['paint']($dompdf->getCanvas());
        }

        // A preview that shows the "Generated by …" footer needs a website to show: use the client's own if set.
        $watermarkText = trim((string) $profile->watermark_text);
        if ($watermark && $watermarkText === '') {
            $watermarkText = self::DEFAULT_WEBSITE;
        }

        // Same page furniture as InvoiceService::generatePdf()
        DocumentCanvasHelper::decorate(
            $dompdf->getCanvas(),
            $dompdf->getFontMetrics(),
            $prepared['theme'],
            $layoutId,
            $watermark,
            $watermarkText
        );

        // Small centred note in the footer line (between "Generated by" and the page number), at the same height.
        $footerFromBottom = [1 => 33, 2 => 36][$layoutId] ?? 20;
        $dompdf->getCanvas()->page_script(function ($pageNumber, $pageCount, $canvas, $fontMetrics) use ($footerFromBottom) {
            $font = $fontMetrics->getFont('DejaVu Sans');
            $text = 'Sample data - for preview only';
            $w = $fontMetrics->getTextWidth($text, $font, 7.5);
            $canvas->text(($canvas->get_width() - $w) / 2, $canvas->get_height() - $footerFromBottom + 1, $text, $font, 7.5, [0.45, 0.45, 0.5]);
        });

        return $pdf->output();
    }

    private function buildDemoDocument(ClientProfile $real, string $type, bool $clientDetails = false): CommercialDocument
    {
        // In-memory copy of the profile: sample company details (admin previews), real branding.
        $profile = $real->replicate();
        $demo = [
            'has_gst' => true,
            'dealer_type' => 'regular',
            'gstin' => 'SAMPLE-GSTIN',
            'pan' => 'SAMPLE-PAN',
            'address' => 'Sample Address, Sample Street',
            'address_line_1' => 'Sample Address, Sample Street',
            'address_line_2' => null,
            'city' => 'Sample City',
            'state' => 'Maharashtra',
            'state_code' => '27',
            'pincode' => '000000',
            'email' => 'sample@example.com',
            'mobile' => '0000000000',
            'bank_name' => 'Sample Bank',
            'account_holder_name' => 'Sample Account Holder',
            'bank_account' => '000000000000',
            'bank_ifsc' => 'SAMPLE00000',
            'bank_branch' => 'Sample Branch',
            'terms_conditions' => null,
            'signatory_name' => null,
        ];

        if ($clientDetails) {
            // The client's own preview is built from their registered profile only, exactly as their invoices are: name,
            // GSTIN/PAN, address, email, mobile, bank details, terms and signatory (plus the logo, seal and signature,
            // which are never replaced). An empty field stays empty (or gets the same default an invoice would get);
            // nothing is filled in from the sample set. Email/mobile fall back to the login account like invoices.
            foreach ([
                'has_gst', 'dealer_type', 'gstin', 'pan',
                'address', 'address_line_1', 'address_line_2', 'city', 'state', 'state_code', 'pincode',
                'bank_name', 'account_holder_name', 'bank_account', 'bank_ifsc', 'bank_branch',
                'terms_conditions', 'signatory_name',
            ] as $k) {
                $demo[$k] = $real->{$k};
            }
            $demo['email'] = $real->email ?: $real->user?->email;
            $demo['mobile'] = $real->mobile ?: $real->user?->phone;
        }

        $profile->forceFill($demo);
        $profile->setRelation('user', null);

        $customer = new Customer([
            'name' => 'Sample Customer',
            'gstin' => 'SAMPLE-GSTIN',
            'gst_status' => 'registered',
            'state_code' => '27',
            'state' => 'Maharashtra',
            'place_of_supply' => 'Maharashtra',
            'billing_address' => 'Sample Address, Sample City - 000000',
            'shipping_address' => 'Sample Address, Sample City - 000000',
            'phone' => '0000000000',
            'email' => 'sample@example.com',
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
            'vehicle_no' => $type === 'delivery_challan' ? 'SAMPLE' : null,
            'transporter_name' => $type === 'delivery_challan' ? 'Sample Transporter' : null,
            'reason_for_transportation' => $type === 'delivery_challan' ? 'job_work' : null,
        ]);

        $items = collect([
            new DocumentLineItem([
                'description' => 'Sample Item 1',
                'hsn_sac' => 'SAMPLE',
                'qty' => 1,
                'unit' => 'NOS',
                'rate' => 25000,
                'gst_rate' => $gstRate,
                'taxable_amount' => 25000,
                'total_amount' => 25000 * (1 + $gstRate / 100),
                'sort_order' => 1,
            ]),
            new DocumentLineItem([
                'description' => 'Sample Item 2',
                'hsn_sac' => 'SAMPLE',
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
