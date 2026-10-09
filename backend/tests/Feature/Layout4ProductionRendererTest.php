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

class Layout4ProductionRendererTest extends TestCase
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
            'client_code' => 'CL-MODERN-BOXED-TEST',
            'client_name' => 'BOARDWALA ADVERTISING SOLUTIONS PRIVATE LIMITED',
            'business_name' => 'BOARDWALA.IN',
            'invoice_tagline' => 'https://www.boardwala.in/',
            'has_gst' => true,
            'gstin' => '27EFWPK7843N1Z9',
            'pan' => 'EFWPK7843N',
            'state_code' => '27',
            'state' => 'Maharashtra',
            'address' => 'Office No. 02, Su-Swapna Apartment, Plot No. C7, Sector - 23',
            'city' => 'Navi Mumbai',
            'pincode' => '400706',
            'email' => 'boardwala.in@gmail.com',
            'mobile' => '8779225668',
            'bank_name' => 'Axis Bank',
            'bank_account' => '923020041664177',
            'bank_ifsc' => 'UTIB0001365',
            'bank_branch' => 'NERUL EAST NAVI MUMBAI',
            'default_layout_id' => 4,
            'default_colour_scheme' => 'dusty_plum',
            'watermark_enabled' => true,
            'watermark_text' => 'www.abkhanassociates.com',
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
                    'document_date' => '2026-08-15',
                    'status' => 'issued',
                    'taxable_amount' => 50000,
                    'cgst_amount' => 4500,
                    'sgst_amount' => 4500,
                    'igst_amount' => 0,
                    'total_amount' => 59000,
                    'grand_total' => 59000,
                ]
            );
        }

        $doc = CommercialDocument::create(array_merge([
            'client_profile_id' => $this->profile->id,
            'type' => $type,
            'number' => strtoupper(substr($type, 0, 3)) . '-2026-01',
            'document_date' => '2026-09-30',
            'status' => 'issued',
            'taxable_amount' => 170000,
            'cgst_amount' => 15300,
            'sgst_amount' => 15300,
            'igst_amount' => 0,
            'total_amount' => 200600,
            'grand_total' => 200600,
            'is_inter_state' => false,
            'place_of_supply' => 'Maharashtra (27)',
            'amount_in_words' => 'Two Lakh Six Hundred Rupees Only',
            'reference_document_id' => $refDoc?->id,
            'vehicle_no' => $type === 'delivery_challan' ? 'MH-43-AZ-1234' : null,
            'transporter_name' => $type === 'delivery_challan' ? 'FastTrack Logistics' : null,
            'reason_for_transportation' => $type === 'delivery_challan' ? 'job_work' : null,
        ], $extra));

        DocumentLineItem::create([
            'commercial_document_id' => $doc->id,
            'item_name' => 'ALUMINIUM CHANNEL LETTERS',
            'description' => 'English Letters Details :- ( Height 4.5 ft ) 108mm Embossed Imported Aluminium Channel Letters.',
            'hsn_sac' => '94056090',
            'qty' => 486,
            'unit' => 'IN',
            'rate' => 380,
            'gst_rate' => 18,
            'taxable_amount' => 190295.91,
            'total_amount' => 200600,
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
     * 2. Test Layout 4 + all 6 approved colours generate valid PDFs.
     */
    public function test_layout_4_renders_with_all_6_colour_schemes(): void
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
                ['layout_id' => 4, 'colour_scheme' => $colour, 'watermark_applies' => false]
            );

            $doc = $this->createDoc('tax_invoice', ['number' => 'L4-' . $colour]);
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
            ['layout_id' => 4, 'colour_scheme' => 'dusty_plum', 'watermark_applies' => true]
        );
        $docWithWm = $this->createDoc('tax_invoice', ['number' => 'L4-WM-YES']);
        $pathWith = $this->invoiceService->generatePdf($docWithWm);
        $pdfWith = Storage::disk('public')->get($pathWith);
        $this->assertStringContainsString('www.abkhanassociates.com', $pdfWith);

        // Case B: watermark_applies = false
        ClientDocumentSetting::updateOrCreate(
            ['client_profile_id' => $this->profile->id, 'document_type' => 'tax_invoice'],
            ['layout_id' => 4, 'colour_scheme' => 'dusty_plum', 'watermark_applies' => false]
        );
        $docWithoutWm = $this->createDoc('tax_invoice', ['number' => 'L4-WM-NO']);
        $pathWithout = $this->invoiceService->generatePdf($docWithoutWm);
        $pdfWithout = Storage::disk('public')->get($pathWithout);
        $this->assertStringNotContainsString('www.abkhanassociates.com', $pdfWithout);
    }

    /**
     * 4. Test rendering of all 6 document types on Layout 4.
     */
    public function test_all_6_document_types_render_successfully_on_layout_4(): void
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
                ['layout_id' => 4, 'colour_scheme' => 'dusty_plum', 'watermark_applies' => false]
            );

            $doc = $this->createDoc($type, ['number' => strtoupper(substr($type, 0, 3)) . '-L4-TEST']);
            $path = $this->invoiceService->generatePdf($doc);

            $this->assertTrue(Storage::disk('public')->exists($path));
            $pdfBytes = Storage::disk('public')->get($path);
            $this->assertGreaterThan(10000, strlen($pdfBytes));

            // Verify specific features per doc type on rendered view
            $renderedHtml = view('pdf.layouts.layout4', [
                'data' => DocumentPayloadBuilder::build($doc),
                'theme' => DocumentThemeTokens::get('dusty_plum'),
            ])->render();

            if (in_array($type, ['credit_note', 'debit_note'], true)) {
                $this->assertStringContainsString('Against', $renderedHtml);
                $this->assertStringContainsString('INV-ORIG-2026', $renderedHtml);
            }
            if ($type === 'bill_of_supply') {
                $this->assertStringNotContainsString('GST (%)', $renderedHtml);
                $this->assertStringNotContainsString('CGST @', $renderedHtml);
            }
            if ($type === 'tax_invoice') {
                $this->assertStringContainsString('TAX INVOICE', $renderedHtml);
                $this->assertStringNotContainsString('Against', $renderedHtml);
            }
            if ($type === 'quotation') {
                $this->assertStringContainsString('QUOTATION', $renderedHtml);
                $this->assertStringContainsString('Quotation No.', $renderedHtml);
            }
            if ($type === 'delivery_challan') {
                $this->assertStringContainsString('DELIVERY CHALLAN', $renderedHtml);
                $this->assertStringContainsString('TRANSPORTATION DETAILS', $renderedHtml);
            }
        }
    }

    /**
     * 5. Test multi-page overflow with 20 items renders 2+ pages and repeats headers.
     */
    public function test_overflow_document_renders_multi_pages_with_repeated_headers(): void
    {
        Config::set('invoice.new_renderer', true);

        ClientDocumentSetting::updateOrCreate(
            ['client_profile_id' => $this->profile->id, 'document_type' => 'tax_invoice'],
            ['layout_id' => 4, 'colour_scheme' => 'dusty_plum', 'watermark_applies' => false]
        );

        $doc = $this->createDoc('tax_invoice', ['number' => 'L4-OVERFLOW']);
        // Add 19 more line items
        for ($i = 2; $i <= 20; $i++) {
            DocumentLineItem::create([
                'commercial_document_id' => $doc->id,
                'item_name' => "Custom Fabricated Acrylic Signage Panel Item #{$i}",
                'description' => "Detailed item description for signage board letter fabrication #{$i}",
                'hsn_sac' => (string) (94050000 + $i),
                'qty' => $i * 10,
                'unit' => 'NOS',
                'rate' => 1200,
                'gst_rate' => 18,
                'taxable_amount' => $i * 12000,
                'total_amount' => $i * 14160,
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
     * 6. Test signatory shows Name only and omits Designation line.
     */
    public function test_signatory_shows_name_only_and_omits_designation(): void
    {
        $doc = $this->createDoc('tax_invoice');
        $html = view('pdf.layouts.layout4', [
            'data' => DocumentPayloadBuilder::build($doc),
            'theme' => DocumentThemeTokens::get('dusty_plum'),
        ])->render();

        $this->assertStringContainsString('AUTHORISED SIGNATORY FOR', $html);
        $this->assertStringContainsString('BOARDWALA.IN', $html);
        $this->assertStringNotContainsString('Designation', $html);
    }

    /**
     * 7. Test Thank-you strip renders centered italic text with theme lines.
     */
    public function test_thank_you_strip_renders(): void
    {
        $doc = $this->createDoc('tax_invoice');
        $html = view('pdf.layouts.layout4', [
            'data' => DocumentPayloadBuilder::build($doc),
            'theme' => DocumentThemeTokens::get('dusty_plum'),
        ])->render();

        $this->assertStringContainsString('Thank you for your business!', $html);
    }

    /**
     * 8. Test canvas frame is disabled for Layout 4.
     */
    public function test_canvas_frame_is_disabled_for_layout_4(): void
    {
        Config::set('invoice.new_renderer', true);

        ClientDocumentSetting::updateOrCreate(
            ['client_profile_id' => $this->profile->id, 'document_type' => 'tax_invoice'],
            ['layout_id' => 4, 'colour_scheme' => 'dusty_plum', 'watermark_applies' => false]
        );

        $doc = $this->createDoc('tax_invoice', ['number' => 'L4-FRAME-TEST']);
        $path = $this->invoiceService->generatePdf($doc);
        $this->assertTrue(Storage::disk('public')->exists($path));
        $pdfBytes = Storage::disk('public')->get($path);
        $this->assertGreaterThan(10000, strlen($pdfBytes));

        // Directly verify DocumentCanvasHelper behavior: with drawFrame = false, line() is never called
        $capturedCallback = null;
        $mockCanvas = $this->createMock(\Dompdf\Canvas::class);
        $mockCanvas->expects($this->once())
            ->method('page_script')
            ->willReturnCallback(function ($callback) use (&$capturedCallback) {
                $capturedCallback = $callback;
            });

        $theme = DocumentThemeTokens::get('dusty_plum');
        $fontMetrics = $this->createMock(\Dompdf\FontMetrics::class);
        $fontMetrics->method('getFont')->willReturn('DejaVu Sans');
        $fontMetrics->method('getTextWidth')->willReturn(50.0);
        $fontMetrics->method('getFontHeight')->willReturn(10.0);

        \App\Services\DocumentTemplate\DocumentCanvasHelper::attachFrameAndFooter(
            $mockCanvas,
            $fontMetrics,
            $theme,
            false,
            null,
            0,
            false // Frame disabled
        );

        $this->assertNotNull($capturedCallback);

        // When invoking the page_script closure, verify line() is never called for the frame
        $frameCanvas = $this->createMock(\Dompdf\Canvas::class);
        $frameCanvas->method('get_width')->willReturn(595.28);
        $frameCanvas->method('get_height')->willReturn(841.89);
        $frameCanvas->expects($this->never())->method('line');

        $capturedCallback(1, 1, $frameCanvas, $fontMetrics);
    }
}
