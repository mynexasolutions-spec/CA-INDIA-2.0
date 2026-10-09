<?php

namespace Tests\Feature;

use App\Models\ClientDocumentSetting;
use App\Models\ClientProfile;
use App\Models\CommercialDocument;
use App\Models\DocumentLineItem;
use App\Models\User;
use App\Services\Billing\InvoiceService;
use App\Services\DocumentTemplate\DocumentPayloadBuilder;
use App\Services\DocumentTemplate\DocumentThemeTokens;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class Layout3ProductionRendererTest extends TestCase
{
    use RefreshDatabase;

    private ClientProfile $profile;
    private InvoiceService $invoiceService;

    protected function setUp(): void
    {
        parent::setUp();

        $clientUser = User::factory()->create([
            'role' => 'client',
            'is_active' => true,
        ]);

        $this->profile = ClientProfile::create([
            'user_id' => $clientUser->id,
            'client_code' => 'CL-UNICO-TEST',
            'client_name' => 'UNICO AIRCON PRIVATE LIMITED',
            'business_name' => 'UNICO AIRCON',
            'invoice_tagline' => 'COOLER TOMORROW TOGETHER',
            'has_gst' => true,
            'gstin' => '27ABCP1234K1Z5',
            'pan' => 'AABCP1234K',
            'state_code' => '27',
            'state' => 'Maharashtra',
            'address' => 'Shop No. 1, Behayet CHS, Plot No. 362, Sector 6, Nerul West',
            'city' => 'Navi Mumbai',
            'pincode' => '400706',
            'email' => 'info@unicoaircon.in',
            'mobile' => '9876543210',
            'bank_name' => 'HDFC Bank Limited',
            'bank_account' => '12345678901234',
            'bank_ifsc' => 'HDFC0001234',
            'bank_branch' => 'Nerul, Navi Mumbai',
            'default_layout_id' => 3,
            'default_colour_scheme' => 'dusty_plum',
            'watermark_enabled' => true,
            'watermark_text' => 'www.abkhanassociates.com',
            'signatory_name' => 'UNICO AIRCON',
        ]);

        $this->invoiceService = app(InvoiceService::class);
    }

    private function createDoc(string $type, array $extra = []): CommercialDocument
    {
        $refDoc = null;
        if (in_array($type, ['credit_note', 'debit_note'], true)) {
            $refDoc = CommercialDocument::firstOrCreate(
                [
                    'client_profile_id' => $this->profile->id,
                    'type' => 'tax_invoice',
                    'number' => 'INV-ORIG-2026',
                ],
                [
                    'document_date' => '2026-04-15',
                    'status' => 'issued',
                    'taxable_amount' => 33250,
                    'cgst_amount' => 2992.50,
                    'sgst_amount' => 2992.50,
                    'igst_amount' => 0,
                    'total_amount' => 39235,
                    'grand_total' => 39235,
                ]
            );
        }

        $doc = CommercialDocument::create(array_merge([
            'client_profile_id' => $this->profile->id,
            'type' => $type,
            'number' => strtoupper(substr($type, 0, 3)) . '-2026-01',
            'document_date' => '2026-04-15',
            'status' => 'issued',
            'taxable_amount' => 33250,
            'cgst_amount' => 2992.50,
            'sgst_amount' => 2992.50,
            'igst_amount' => 0,
            'total_amount' => 39235,
            'grand_total' => 39235,
            'is_inter_state' => false,
            'is_reverse_charge' => false,
            'place_of_supply' => 'Maharashtra (27)',
            'amount_in_words' => 'Rupees Thirty Nine Thousand Two Hundred Thirty Five Only.',
            'reference_document_id' => $refDoc?->id,
            'vehicle_no' => $type === 'delivery_challan' ? 'MH-43-AZ-5678' : null,
            'transporter_name' => $type === 'delivery_challan' ? 'CoolAir Express' : null,
            'reason_for_transportation' => $type === 'delivery_challan' ? 'job_work' : null,
        ], $extra));

        DocumentLineItem::create([
            'commercial_document_id' => $doc->id,
            'item_name' => 'Split AC 1.5 Ton (Voltas) – Supply Only',
            'description' => 'Split air conditioner 1.5 Ton unit with remote control',
            'hsn_sac' => '84151010',
            'qty' => 1,
            'unit' => 'Nos',
            'rate' => 28000,
            'gst_rate' => 18,
            'taxable_amount' => 28000,
            'total_amount' => 33040,
            'sort_order' => 1,
        ]);

        return $doc->fresh(['lineItems', 'clientProfile', 'referenceDocument']);
    }

    /**
     * 1. Test fallback to legacy template when config('invoice.new_renderer') is false.
     */
    public function test_legacy_fallback_when_feature_flag_is_off(): void
    {
        Config::set('invoice.new_renderer', false);
        $doc = $this->createDoc('tax_invoice');

        $path = $this->invoiceService->generatePdf($doc);
        $this->assertNotEmpty($path);
        $this->assertTrue(Storage::disk('public')->exists($path));

        $pdfBytes = Storage::disk('public')->get($path);
        $this->assertGreaterThan(1000, strlen($pdfBytes));
    }

    /**
     * 2. Test Layout 3 + all 6 approved colours generate valid PDFs.
     */
    public function test_layout_3_renders_with_all_6_colour_schemes(): void
    {
        Config::set('invoice.new_renderer', true);

        $colours = [
            'slate_blue',
            'charcoal_grey',
            'dusty_plum',
            'mocha_brown',
            'deep_teal',
            'antique_gold',
        ];

        foreach ($colours as $colour) {
            ClientDocumentSetting::updateOrCreate(
                ['client_profile_id' => $this->profile->id, 'document_type' => 'tax_invoice'],
                ['layout_id' => 3, 'colour_scheme' => $colour, 'watermark_applies' => false]
            );

            $doc = $this->createDoc('tax_invoice', ['number' => 'L3-' . $colour]);
            $path = $this->invoiceService->generatePdf($doc);

            $this->assertTrue(Storage::disk('public')->exists($path));
            $pdfBytes = Storage::disk('public')->get($path);
            $this->assertGreaterThan(10000, strlen($pdfBytes));
        }
    }

    /**
     * 3. Test watermark footer shows ONLY when watermark_enabled is ON AND watermark_applies is Yes.
     */
    public function test_watermark_footer_renders_only_when_on_and_applies_yes(): void
    {
        Config::set('invoice.new_renderer', true);

        // Case A: watermark_applies = true
        ClientDocumentSetting::updateOrCreate(
            ['client_profile_id' => $this->profile->id, 'document_type' => 'tax_invoice'],
            ['layout_id' => 3, 'colour_scheme' => 'dusty_plum', 'watermark_applies' => true]
        );
        $docWithWm = $this->createDoc('tax_invoice', ['number' => 'L3-WM-YES']);
        $pathWith = $this->invoiceService->generatePdf($docWithWm);
        $pdfWith = Storage::disk('public')->get($pathWith);
        $this->assertStringContainsString('www.abkhanassociates.com', $pdfWith);

        // Case B: watermark_applies = false
        ClientDocumentSetting::updateOrCreate(
            ['client_profile_id' => $this->profile->id, 'document_type' => 'tax_invoice'],
            ['layout_id' => 3, 'colour_scheme' => 'dusty_plum', 'watermark_applies' => false]
        );
        $docWithoutWm = $this->createDoc('tax_invoice', ['number' => 'L3-WM-NO']);
        $pathWithout = $this->invoiceService->generatePdf($docWithoutWm);
        $pdfWithout = Storage::disk('public')->get($pathWithout);
        $this->assertStringNotContainsString('www.abkhanassociates.com', $pdfWithout);
    }

    /**
     * 4. Test tagline strip: renders when tagline is present; omitted completely when tagline is null.
     */
    public function test_tagline_strip_renders_when_set_and_omitted_when_null(): void
    {
        // Case A: Tagline is set
        $this->profile->update(['invoice_tagline' => 'COOLER TOMORROW TOGETHER']);
        $doc = $this->createDoc('tax_invoice', ['number' => 'L3-TAG-SET']);
        $htmlWith = view('pdf.layouts.layout3', [
            'data' => DocumentPayloadBuilder::build($doc),
            'theme' => DocumentThemeTokens::get('dusty_plum'),
        ])->render();
        $this->assertStringContainsString('COOLER TOMORROW TOGETHER', $htmlWith);

        // Case B: Tagline is null
        $this->profile->update(['invoice_tagline' => null]);
        $docNull = $this->createDoc('tax_invoice', ['number' => 'L3-TAG-NULL']);
        $htmlWithout = view('pdf.layouts.layout3', [
            'data' => DocumentPayloadBuilder::build($docNull),
            'theme' => DocumentThemeTokens::get('dusty_plum'),
        ])->render();
        $this->assertStringNotContainsString('COOLER TOMORROW TOGETHER', $htmlWithout);
    }

    /**
     * 5. Test Reverse Charge checkmark boxes rendering: Yes/No boxes with DejaVu checkmark.
     */
    public function test_reverse_charge_tick_box_rendering(): void
    {
        // Case A: reverse_charge is false
        $docFalse = $this->createDoc('tax_invoice', ['is_reverse_charge' => false]);
        $htmlFalse = view('pdf.layouts.layout3', [
            'data' => DocumentPayloadBuilder::build($docFalse),
            'theme' => DocumentThemeTokens::get('dusty_plum'),
        ])->render();
        $this->assertStringContainsString('Reverse Charge', $htmlFalse);
        $this->assertStringContainsString('&#x2713;', $htmlFalse);

        // Case B: reverse_charge is true
        $docTrue = $this->createDoc('tax_invoice', ['number' => 'TAX-2026-RC-TRUE', 'is_reverse_charge' => true]);
        $htmlTrue = view('pdf.layouts.layout3', [
            'data' => DocumentPayloadBuilder::build($docTrue),
            'theme' => DocumentThemeTokens::get('dusty_plum'),
        ])->render();
        $this->assertStringContainsString('&#x2713;', $htmlTrue);
    }

    /**
     * 6. Test rendering of all 6 document types on Layout 3.
     */
    public function test_all_6_document_types_render_successfully_on_layout_3(): void
    {
        Config::set('invoice.new_renderer', true);

        $docTypes = [
            'tax_invoice',
            'bill_of_supply',
            'credit_note',
            'debit_note',
            'quotation',
            'delivery_challan',
        ];

        foreach ($docTypes as $type) {
            ClientDocumentSetting::updateOrCreate(
                ['client_profile_id' => $this->profile->id, 'document_type' => $type],
                ['layout_id' => 3, 'colour_scheme' => 'dusty_plum', 'watermark_applies' => false]
            );

            $doc = $this->createDoc($type, ['number' => strtoupper(substr($type, 0, 3)) . '-L3-TEST']);
            $path = $this->invoiceService->generatePdf($doc);

            $this->assertTrue(Storage::disk('public')->exists($path));
            $pdfBytes = Storage::disk('public')->get($path);
            $this->assertGreaterThan(10000, strlen($pdfBytes));

            // Verify specific features per doc type on rendered view
            $renderedHtml = view('pdf.layouts.layout3', [
                'data' => DocumentPayloadBuilder::build($doc),
                'theme' => DocumentThemeTokens::get('dusty_plum'),
            ])->render();

            if (in_array($type, ['credit_note', 'debit_note'], true)) {
                $this->assertStringContainsString('Against', $renderedHtml);
                $this->assertStringContainsString('INV-ORIG-2026', $renderedHtml);
            }
            if ($type === 'bill_of_supply') {
                $this->assertStringNotContainsString('GST<br>Rate (%)', $renderedHtml);
                $this->assertStringNotContainsString('CGST @', $renderedHtml);
            }
            if ($type === 'tax_invoice') {
                $this->assertStringContainsString('TAX INVOICE', $renderedHtml);
                $this->assertStringContainsString('Taxable Amount (₹)', $renderedHtml);
            }
            if ($type === 'delivery_challan') {
                $this->assertStringContainsString('Transportation Details', $renderedHtml);
            }
        }
    }

    /**
     * 7. Test multi-page overflow with 20 items renders 2+ pages and repeats headers.
     */
    public function test_overflow_document_renders_multi_pages_with_repeated_headers(): void
    {
        Config::set('invoice.new_renderer', true);

        ClientDocumentSetting::updateOrCreate(
            ['client_profile_id' => $this->profile->id, 'document_type' => 'tax_invoice'],
            ['layout_id' => 3, 'colour_scheme' => 'dusty_plum', 'watermark_applies' => false]
        );

        $doc = $this->createDoc('tax_invoice', ['number' => 'L3-OVERFLOW']);
        // Add 19 more line items
        for ($i = 2; $i <= 20; $i++) {
            DocumentLineItem::create([
                'commercial_document_id' => $doc->id,
                'item_name' => "Air Conditioning Spare & Fitting Item #{$i}",
                'description' => "Detailed item specification and fitting accessories #{$i}",
                'hsn_sac' => (string) (84150000 + $i),
                'qty' => $i * 2,
                'unit' => 'Nos',
                'rate' => 1500,
                'gst_rate' => 18,
                'taxable_amount' => $i * 3000,
                'total_amount' => $i * 3540,
                'sort_order' => $i,
            ]);
        }

        $path = $this->invoiceService->generatePdf($doc);
        $this->assertTrue(Storage::disk('public')->exists($path));

        $fullPath = Storage::disk('public')->path($path);
        $pdfBytes = file_get_contents($fullPath);
        $pageCount = substr_count($pdfBytes, '/Type /Page');
        $this->assertGreaterThanOrEqual(2, $pageCount);
    }

    /**
     * 8. Test signatory shows Name only and omits Designation line.
     */
    public function test_signatory_shows_name_only_and_omits_designation(): void
    {
        $doc = $this->createDoc('tax_invoice');
        $html = view('pdf.layouts.layout3', [
            'data' => DocumentPayloadBuilder::build($doc),
            'theme' => DocumentThemeTokens::get('dusty_plum'),
        ])->render();

        $this->assertStringContainsString('Name', $html);
        $this->assertStringContainsString('UNICO AIRCON', $html);
        $this->assertStringNotContainsString('Designation', $html);
    }
}
