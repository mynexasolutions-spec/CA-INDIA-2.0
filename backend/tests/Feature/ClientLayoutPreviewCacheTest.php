<?php

namespace Tests\Feature;

use App\Models\ClientProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ClientLayoutPreviewCacheTest extends TestCase
{
    use RefreshDatabase;

    private ClientProfile $profile;
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        $this->user = User::factory()->create(['role' => 'client', 'is_active' => true]);
        $this->profile = ClientProfile::create([
            'user_id' => $this->user->id, 'client_name' => 'Preview Corp', 'business_name' => 'Preview Corp',
            'client_code' => 'PRV001', 'has_gst' => true, 'dealer_type' => 'regular',
        ]);
        Sanctum::actingAs($this->user);
    }

    private function preview(int $layout = 1, string $colour = 'simple')
    {
        return $this->get("/api/client/layout-preview?layout_id={$layout}&colour_scheme={$colour}")->assertOk();
    }

    public function test_identical_previews_are_served_from_the_cache(): void
    {
        $first = $this->preview();
        $this->assertSame('application/pdf', $first->headers->get('Content-Type'));
        $this->assertCount(1, Storage::disk('local')->files('layout-preview-cache'));

        $second = $this->preview();
        $this->assertSame($first->getContent(), $second->getContent());
        $this->assertCount(1, Storage::disk('local')->files('layout-preview-cache'));
    }

    public function test_client_preview_shows_the_clients_real_details_and_falls_back_to_demo_for_blanks(): void
    {
        $this->profile->update([
            'gstin' => '27QWERT1234Q1Z2', 'pan' => 'QWERT1234Q', 'email' => 'real@client.test',
            'bank_name' => 'Kotak Mahindra Bank Ltd', 'bank_account' => '012310110001234',
            'signatory_name' => 'Tom & Jerry',
        ]);
        $profile = $this->profile->fresh();
        $renderer = app(\App\Services\DocumentTemplate\LayoutPreviewRenderer::class);

        $real = $renderer->prepare($profile, 3, 'royal_blue', 'tax_invoice', true)['data'];
        $this->assertSame('27QWERT1234Q1Z2', $real['seller_gstin']);
        $this->assertSame('real@client.test', $real['seller_email']);
        $this->assertSame('Kotak Mahindra Bank Ltd', $real['bank']['name']);
        // No address saved: the whole address group falls back to the demo address, never a half-real mix.
        $this->assertStringContainsString('Sample Business Park', $real['seller_address']);

        // Admin previews keep the demo company.
        $demo = $renderer->prepare($profile, 3, 'royal_blue', 'tax_invoice')['data'];
        $this->assertSame('27AABCD1234E1Z5', $demo['seller_gstin']);
        $this->assertSame('Sample Bank', $demo['bank']['name']);
    }

    public function test_a_different_layout_or_colour_gets_its_own_cache_entry(): void
    {
        $this->preview(1, 'simple');
        $this->preview(3, 'royal_blue');

        $this->assertCount(2, Storage::disk('local')->files('layout-preview-cache'));
    }

    public function test_changing_the_profile_does_not_serve_a_stale_preview(): void
    {
        $before = $this->preview()->getContent();
        $this->profile->update(['business_name' => 'Renamed Preview Corporation Limited']);
        // A real request loads the user fresh; in-process the old user object still carries the stale profile relation.
        Sanctum::actingAs(User::find($this->user->id));
        $after = $this->preview()->getContent();

        $this->assertCount(2, Storage::disk('local')->files('layout-preview-cache'));
        $this->assertNotSame($before, $after);
    }
}
