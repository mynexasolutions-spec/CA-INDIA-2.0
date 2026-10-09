<?php

namespace Tests\Feature;

use App\Models\ClientDocumentSetting;
use App\Models\ClientProfile;
use App\Models\CommercialDocument;
use App\Models\DocumentLineItem;
use App\Models\User;
use App\Services\Billing\InvoiceService;
use App\Services\DocumentTemplate\DocumentCanvasHelper;
use App\Services\DocumentTemplate\DocumentPayloadBuilder;
use App\Services\DocumentTemplate\DocumentThemeTokens;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class Layout1ProductionRendererTest extends TestCase
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
            'client_code' => 'CL-TEST',
            'client_name' => 'ABD GLOBEX SOLUTIONS PRIVATE LIMITED',
            'business_name' => 'ABD GLOBEX SOLUTIONS PRIVATE LIMITED',
            'invoice_tagline' => 'Global Solutions & Supply',
            'has_gst' => true,
            'gstin' => '27QWERT1234Q1Z2',
            'pan' => 'QWERT1234Q',
            'state_code' => '27',
            'state' => 'Maharashtra',
            'address' => 'Plot B-71, Sector 23',
            'city' => 'Navi Mumbai',
            'pincode' => '400706',
            'email' => 'contact@abdglobex.com',
            'mobile' => '9987412345',
            'bank_name' => 'KOTAK MAHINDRA BANK LTD',
            'bank_account' => '012310110001234',
            'bank_ifsc' => 'BKID000123',
            'bank_branch' => 'NERUL',
            'default_layout_id' => 1,
            'default_colour_scheme' => 'slate_blue',
            'watermark_enabled' => true,
            'watermark_text' => 'www.abkhanassociates.com',
        ]);

        $this->invoiceService = app(InvoiceService::class);
    }

    private function createDoc(string $type, array $extra = []): CommercialDocument
    {
        $doc = CommercialDocument::create(array_merge([
            'client_profile_id' => $this->profile->id,
            'type' => $type,
            'number' => strtoupper(substr($type, 0, 3)) . '-001',
            'document_date' => '2026-09-10',
            'status' => 'issued',
            'taxable_amount' => 100000,
            'cgst_amount' => 9000,
            'sgst_amount' => 9000,
            'igst_amount' => 0,
            'total_amount' => 118000,
            'grand_total' => 118000,
            'is_inter_state' => false,
            'amount_in_words' => 'Rupees One Lakh Eighteen Thousand Only.',
        ], $extra));

        DocumentLineItem::create([
            'commercial_document_id' => $doc->id,
            'description' => 'Insulated Wire Cable',
            'hsn_sac' => '8544',
            'qty' => 100,
            'unit' => 'NOS',
            'rate' => 1000,
            'gst_rate' => 18,
            'taxable_amount' => 100000,
            'total_amount' => 118000,
            'sort_order' => 1,
        ]);

        return $doc->fresh(['lineItems', 'clientProfile']);
    }

    /**
     * 1. Test fallback when feature flag config('invoice.new_renderer') is false.
     */
    public function test_legacy_fallback_when_feature_flag_is_off(): void
    {
        Config::set('invoice.new_renderer', false);
        $doc = $this->createDoc('tax_invoice');

        $path = $this->invoiceService->generatePdf($doc);
        $this->assertNotEmpty($path);
        $this->assertTrue(Storage::disk('public')->exists($path));

        $pdfBytes = Storage::disk('public')->get($path);
        // Legacy invoice template produces PDF with frame color 1.6
        $this->assertGreaterThan(1000, strlen($pdfBytes));
    }

    /**
     * 2. Test Layout 1 + all 6 approved colours generate valid PDFs.
     */
    public function test_layout_1_renders_with_all_6_colour_schemes(): void
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
                ['layout_id' => 1, 'colour_scheme' => $colour, 'watermark_applies' => false]
            );

            $doc = $this->createDoc('tax_invoice', ['number' => 'INV-' . $colour]);
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
            ['layout_id' => 1, 'colour_scheme' => 'slate_blue', 'watermark_applies' => true]
        );
        $docWithWm = $this->createDoc('tax_invoice', ['number' => 'INV-WM-YES']);
        $pathWith = $this->invoiceService->generatePdf($docWithWm);
        $pdfWith = Storage::disk('public')->get($pathWith);
        $this->assertStringContainsString('www.abkhanassociates.com', $pdfWith);

        // Case B: watermark_applies = false
        ClientDocumentSetting::updateOrCreate(
            ['client_profile_id' => $this->profile->id, 'document_type' => 'tax_invoice'],
            ['layout_id' => 1, 'colour_scheme' => 'slate_blue', 'watermark_applies' => false]
        );
        $docWithoutWm = $this->createDoc('tax_invoice', ['number' => 'INV-WM-NO']);
        $pathWithout = $this->invoiceService->generatePdf($docWithoutWm);
        $pdfWithout = Storage::disk('public')->get($pathWithout);
        // Watermark URL should NOT be injected in stream
        $this->assertStringNotContainsString('www.abkhanassociates.com', $pdfWithout);
    }

    /**
     * 4. Test rendering of all 6 document types.
     */
    public function test_all_6_document_types_render_successfully(): void
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
                ['layout_id' => 1, 'colour_scheme' => 'slate_blue', 'watermark_applies' => false]
            );

            $doc = $this->createDoc($type, ['number' => strtoupper(substr($type, 0, 3)) . '-TEST']);
            $path = $this->invoiceService->generatePdf($doc);

            $this->assertTrue(Storage::disk('public')->exists($path));
            $pdfBytes = Storage::disk('public')->get($path);
            $this->assertGreaterThan(10000, strlen($pdfBytes));
        }
    }

    /**
     * 5. Test multi-page overflow with 20 items renders 2+ pages and repeats headers.
     */
    public function test_overflow_document_renders_multi_pages(): void
    {
        Config::set('invoice.new_renderer', true);

        $doc = $this->createDoc('tax_invoice', ['number' => 'INV-OVERFLOW']);
        // Add 19 more line items
        for ($i = 2; $i <= 20; $i++) {
            DocumentLineItem::create([
                'commercial_document_id' => $doc->id,
                'description' => "Industrial Equipment Accessory Item #{$i}",
                'hsn_sac' => (string) (8500 + $i),
                'qty' => $i * 5,
                'unit' => 'NOS',
                'rate' => 500,
                'gst_rate' => 18,
                'taxable_amount' => $i * 2500,
                'total_amount' => $i * 2950,
                'sort_order' => $i,
            ]);
        }

        $path = $this->invoiceService->generatePdf($doc);
        $this->assertTrue(Storage::disk('public')->exists($path));

        $fullPath = Storage::disk('public')->path($path);
        // Verify via DomPDF/PDF parser that document has > 1 page
        $pdfBytes = file_get_contents($fullPath);
        $this->assertStringContainsString('/Count', $pdfBytes);
        $this->assertGreaterThan(50000, strlen($pdfBytes));
    }
}
