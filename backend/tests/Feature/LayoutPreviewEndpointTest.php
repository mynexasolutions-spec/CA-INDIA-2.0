<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\Admin\ClientsUnlockController;
use App\Models\ClientProfile;
use App\Models\User;
use App\Services\DocumentTemplate\LayoutPreviewRenderer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LayoutPreviewEndpointTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private ClientProfile $profile;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        $clientUser = User::factory()->create(['role' => 'client', 'is_active' => true]);

        $this->profile = ClientProfile::create([
            'user_id' => $clientUser->id,
            'client_code' => 'CL-PREV-1',
            'client_name' => 'Preview Client Pvt Ltd',
            'business_name' => 'Preview Client',
            'invoice_tagline' => 'https://www.previewclient-tagline.test/',
            'has_gst' => false,
            'default_layout_id' => 1,
            'default_colour_scheme' => 'slate_blue',
            'watermark_enabled' => false,
            'watermark_text' => 'www.preview-watermark.test',
        ]);

        Cache::put(ClientsUnlockController::cacheKey($this->admin->id), now()->toIso8601String(), now()->addHours(1));
        Sanctum::actingAs($this->admin);
    }

    private function url(array $query): string
    {
        return "/api/admin/clients/{$this->profile->id}/layout-preview?" . http_build_query($query);
    }

    public function test_valid_params_return_inline_pdf_for_every_layout_and_doc_type(): void
    {
        foreach ([1, 2, 3, 4] as $layout) {
            $res = $this->get($this->url(['layout_id' => $layout, 'colour_scheme' => 'deep_teal']));
            $res->assertOk();
            $this->assertStringContainsString('application/pdf', $res->headers->get('Content-Type'));
            $this->assertStringContainsString('inline', $res->headers->get('Content-Disposition'));
            $this->assertStringStartsWith('%PDF', $res->getContent());
        }

        foreach (LayoutPreviewRenderer::DOCUMENT_TYPES as $type) {
            $res = $this->get($this->url(['layout_id' => 2, 'colour_scheme' => 'mocha_brown', 'document_type' => $type]));
            $res->assertOk();
            $this->assertStringStartsWith('%PDF', $res->getContent());
        }
    }

    public function test_invalid_params_return_422(): void
    {
        $this->get($this->url(['layout_id' => 1, 'colour_scheme' => 'forest_green']))->assertStatus(422);
        $this->get($this->url(['layout_id' => 5, 'colour_scheme' => 'slate_blue']))->assertStatus(422);
        $this->get($this->url(['layout_id' => 1, 'colour_scheme' => 'slate_blue', 'document_type' => 'proforma']))->assertStatus(422);
        $this->get($this->url(['colour_scheme' => 'slate_blue']))->assertStatus(422);
        $this->get($this->url(['layout_id' => 1, 'colour_scheme' => 'slate_blue', 'watermark' => 'maybe']))->assertStatus(422);
    }

    public function test_locked_clients_module_is_forbidden(): void
    {
        Cache::forget(ClientsUnlockController::cacheKey($this->admin->id));

        $this->get($this->url(['layout_id' => 1, 'colour_scheme' => 'slate_blue']))->assertStatus(403);
    }

    public function test_preview_creates_no_database_rows_and_no_stored_files(): void
    {
        $docs = DB::table('commercial_documents')->count();
        $lines = DB::table('document_line_items')->count();
        $customers = DB::table('customers')->count();
        $files = is_dir(storage_path('app/public/invoices')) ? count(glob(storage_path('app/public/invoices/*'))) : 0;

        $this->get($this->url(['layout_id' => 3, 'colour_scheme' => 'antique_gold', 'document_type' => 'credit_note']))->assertOk();

        $this->assertSame($docs, DB::table('commercial_documents')->count());
        $this->assertSame(0, DB::table('commercial_documents')->count());
        $this->assertSame($lines, DB::table('document_line_items')->count());
        $this->assertSame($customers, DB::table('customers')->count());
        $filesAfter = is_dir(storage_path('app/public/invoices')) ? count(glob(storage_path('app/public/invoices/*'))) : 0;
        $this->assertSame($files, $filesAfter);
    }

    public function test_watermark_param_controls_footer_text(): void
    {
        $on = $this->get($this->url(['layout_id' => 4, 'colour_scheme' => 'dusty_plum', 'watermark' => 1]));
        $on->assertOk();
        $this->assertStringContainsString('www.preview-watermark.test', $on->getContent());

        $off = $this->get($this->url(['layout_id' => 4, 'colour_scheme' => 'dusty_plum', 'watermark' => 0]));
        $off->assertOk();
        $this->assertStringNotContainsString('www.preview-watermark.test', $off->getContent());

        $default = $this->get($this->url(['layout_id' => 4, 'colour_scheme' => 'dusty_plum']));
        $this->assertStringNotContainsString('www.preview-watermark.test', $default->getContent());
    }

    public function test_tagline_is_rendered_only_in_layout_3(): void
    {
        foreach ([1, 2, 3, 4] as $layout) {
            $prepared = app(LayoutPreviewRenderer::class)->prepare($this->profile, $layout, 'deep_teal', 'tax_invoice');
            $html = view($prepared['view'], $prepared['viewData'])->render();

            if ($layout === 3) {
                $this->assertStringContainsString('https://www.previewclient-tagline.test/', $html);
            } else {
                $this->assertStringNotContainsString('https://www.previewclient-tagline.test/', $html);
            }
        }
    }

    public function test_demo_data_overrides_company_details_but_keeps_client_branding(): void
    {
        $prepared = app(LayoutPreviewRenderer::class)->prepare($this->profile, 1, 'slate_blue', 'tax_invoice');

        $this->assertSame('PREVIEW CLIENT', $prepared['data']['company_name']);
        $this->assertSame('TAX INVOICE', $prepared['data']['document_title']); // demo forces GST on
        $this->assertSame('27AABCD1234E1Z5', $prepared['data']['seller_gstin']);
    }

    public function test_renders_when_new_renderer_flag_is_off(): void
    {
        config(['invoice.new_renderer' => false]);

        $res = $this->get($this->url(['layout_id' => 2, 'colour_scheme' => 'charcoal_grey']));
        $res->assertOk();
        $this->assertStringStartsWith('%PDF', $res->getContent());
    }
}
