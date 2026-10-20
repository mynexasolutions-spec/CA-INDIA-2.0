<?php

namespace Tests\Feature;

use App\Models\ClientProfile;
use App\Models\CommercialDocument;
use App\Models\User;
use App\Services\Billing\DocumentNumberingSettings;
use App\Services\Billing\InvoiceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class ClientNumberingSettingsTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $clientUser;
    private ClientProfile $profile;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        $this->clientUser = User::factory()->create(['role' => 'client', 'is_active' => true]);
        $this->profile = ClientProfile::create([
            'user_id' => $this->clientUser->id,
            'client_name' => 'Client Numbering Corp',
            'business_name' => 'Client Numbering Corp',
            'client_code' => 'CNC001',
            'invoice_prefix' => 'INV',
            'invoice_next_number' => 5,
            'has_gst' => true,
            'dealer_type' => 'regular',
            'document_numbering_settings' => [
                'invoice' => ['prefix' => 'INV', 'separator' => '-', 'next_number' => '05', 'prefix_position' => 'first', 'numbering_type' => 'auto', 'status' => true],
            ],
        ]);
    }

    private function submitAsClient(array $fields)
    {
        Sanctum::actingAs($this->clientUser);

        return $this->postJson('/api/client/change-requests', array_merge(['section' => 'numbering'], $fields));
    }

    public function test_unchanged_numbering_fields_are_left_out_of_the_request(): void
    {
        $res = $this->submitAsClient([
            'invoice_prefix' => 'INV',          // unchanged
            'invoice_separator' => '/',         // changed
            'invoice_next_number' => '05',      // unchanged
            'invoice_prefix_position' => 'first', // unchanged
        ])->assertStatus(201);

        $this->assertSame(['invoice_separator' => '/'], $res->json('pending.payload'));
    }

    public function test_numbering_type_cannot_be_sent_by_the_client(): void
    {
        $res = $this->submitAsClient([
            'invoice_separator' => '/',
            'invoice_numbering_type' => 'manual',
        ])->assertStatus(201);

        $this->assertArrayNotHasKey('invoice_numbering_type', $res->json('pending.payload'));
        $this->assertSame('auto', DocumentNumberingSettings::numberingType($this->profile->fresh(), 'tax_invoice'));
    }

    public function test_invalid_separator_and_next_number_are_rejected(): void
    {
        $this->submitAsClient(['invoice_separator' => '#'])->assertStatus(422);
        $this->submitAsClient(['invoice_next_number' => 'abc'])->assertStatus(422);
        $this->submitAsClient(['invoice_prefix_position' => 'middle'])->assertStatus(422);
    }

    public function test_next_number_that_collides_with_an_existing_document_is_rejected(): void
    {
        CommercialDocument::create([
            'client_profile_id' => $this->profile->id,
            'type' => 'tax_invoice',
            'number' => 'INV-10',
            'status' => 'issued',
            'document_date' => now()->toDateString(),
        ]);

        $this->submitAsClient(['invoice_next_number' => '10'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['invoice_next_number']);
        // Stepping back below an already used number is rejected too.
        $this->submitAsClient(['invoice_next_number' => '07'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['invoice_next_number']);
        // A higher number is fine.
        $this->submitAsClient(['invoice_next_number' => '11'])->assertStatus(201);
    }

    public function test_admin_approval_applies_the_numbering_fields_but_not_the_type(): void
    {
        $id = $this->submitAsClient([
            'invoice_prefix' => 'TX',
            'invoice_separator' => '/',
            'invoice_next_number' => '20',
            'invoice_prefix_position' => 'last',
            'invoice_status' => 'inactive',
        ])->assertStatus(201)->json('pending.id');

        Sanctum::actingAs($this->admin);
        $this->postJson("/api/admin/change-requests/{$id}/approve", [])->assertOk();

        $profile = $this->profile->fresh();
        $cfg = $profile->document_numbering_settings['invoice'];
        $this->assertSame('TX', $cfg['prefix']);
        $this->assertSame('/', $cfg['separator']);
        $this->assertSame('20', $cfg['next_number']);
        $this->assertSame('last', $cfg['prefix_position']);
        $this->assertFalse($cfg['status']);
        $this->assertSame('auto', $cfg['numbering_type']);
        $this->assertSame(20, (int) $profile->invoice_next_number);
        $this->assertSame('TX', $profile->invoice_prefix);

        // The generated number follows the approved format: 20/TX
        $this->assertSame('20/TX', app(InvoiceService::class)->nextNumber($profile, 'tax_invoice'));
    }

    public function test_manual_numbering_requires_a_typed_number_to_issue(): void
    {
        $settings = $this->profile->document_numbering_settings;
        $settings['invoice']['numbering_type'] = 'manual';
        $this->profile->update(['document_numbering_settings' => $settings]);

        $this->assertSame('manual', DocumentNumberingSettings::numberingType($this->profile->fresh(), 'tax_invoice'));

        try {
            app(InvoiceService::class)->create($this->profile->fresh(), [
                'type' => 'tax_invoice',
                'status' => 'issued',
                'document_date' => now()->toDateString(),
                'lines' => [['description' => 'Item', 'qty' => 1, 'rate' => 100, 'gst_rate' => 18]],
            ]);
            $this->fail('Issuing without a number must be rejected for manual numbering.');
        } catch (HttpException $e) {
            $this->assertSame(422, $e->getStatusCode());
        }
    }

    public function test_manual_number_suggestion_skips_numbers_already_used(): void
    {
        CommercialDocument::create([
            'client_profile_id' => $this->profile->id,
            'type' => 'tax_invoice',
            'number' => 'INV-05',
            'status' => 'issued',
            'document_date' => now()->toDateString(),
        ]);

        $this->assertSame('INV-06', app(InvoiceService::class)->suggestManualNumber($this->profile->fresh(), 'tax_invoice'));
    }
}
