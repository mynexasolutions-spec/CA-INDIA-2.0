<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\Admin\ClientsUnlockController;
use App\Models\ClientDocumentSetting;
use App\Models\ClientProfile;
use App\Models\ClientSubscription;
use App\Models\CommercialDocument;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ClientModule2bTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private ClientProfile $profile;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create([
            'role' => 'admin',
            'is_active' => true,
        ]);

        $clientUser = User::factory()->create([
            'role' => 'client',
            'is_active' => true,
        ]);

        $this->profile = ClientProfile::create([
            'user_id' => $clientUser->id,
            'client_code' => 'CL-001',
            'client_name' => 'Acme Corporation',
            'business_name' => 'Acme Corp',
            'has_gst' => true,
            'gst_compliance_enabled' => true,
            'default_layout_id' => 1,
            'default_colour_scheme' => 'slate_blue',
            'layout_applied_from' => null,
            'layout_updated_at' => null,
            'watermark_enabled' => false,
            'watermark_text' => null,
            'gst_reminder_enabled' => false,
        ]);

        // Unlock admin clients module session
        Cache::put(ClientsUnlockController::cacheKey($this->admin->id), now()->toIso8601String(), now()->addHours(1));

        // Sync client id sequence so next generated client code is CL-002
        \Illuminate\Support\Facades\DB::table('client_id_sequences')->updateOrInsert(
            ['name' => 'clients'],
            ['last_number' => 1]
        );
    }

    /**
     * Test 1: Layout Default Overwrite Transaction.
     * Saving a default layout + colour overwrites all 6 client_document_settings rows.
     */
    public function test_default_overwrite_transaction_updates_all_document_types(): void
    {
        Sanctum::actingAs($this->admin);

        // Pre-seed some document rows with layout 1 slate_blue
        foreach (array_keys(ClientDocumentSetting::DOCUMENT_TYPES) as $docType) {
            ClientDocumentSetting::create([
                'client_profile_id' => $this->profile->id,
                'document_type' => $docType,
                'layout_id' => 1,
                'colour_scheme' => 'slate_blue',
                'watermark_applies' => false,
            ]);
        }

        // Overwrite default layout to Layout 3 + deep_teal
        $response = $this->putJson("/api/admin/clients/{$this->profile->id}/layout", [
            'layout_id' => 3,
            'colour_scheme' => 'deep_teal',
            'applied_from' => '2026-05-01',
        ]);

        $response->assertOk()
            ->assertJsonPath('default_layout_id', 3)
            ->assertJsonPath('default_colour_scheme', 'deep_teal')
            ->assertJsonPath('layout_applied_from', '2026-05-01');

        $this->profile->refresh();
        $this->assertEquals(3, $this->profile->default_layout_id);
        $this->assertEquals('deep_teal', $this->profile->default_colour_scheme);
        $this->assertNotNull($this->profile->layout_updated_at);

        // Verify all 6 rows in client_document_settings were overwritten to Layout 3 + deep_teal
        $docSettings = ClientDocumentSetting::where('client_profile_id', $this->profile->id)->get();
        $this->assertCount(6, $docSettings);
        foreach ($docSettings as $doc) {
            $this->assertEquals(3, $doc->layout_id, "Document {$doc->document_type} must be layout 3");
            $this->assertEquals('deep_teal', $doc->colour_scheme, "Document {$doc->document_type} must be deep_teal");
        }
    }

    /**
     * Test 2: Bad Colour and Bad Layout Validation.
     * Colours outside the 6 approved slugs (including forest_green and burgundy) must be rejected with 422.
     * Layout IDs outside 1-4 must also be rejected.
     */
    public function test_bad_colour_and_bad_layout_are_rejected(): void
    {
        Sanctum::actingAs($this->admin);

        // Reject forest_green
        $this->putJson("/api/admin/clients/{$this->profile->id}/layout", [
            'layout_id' => 1,
            'colour_scheme' => 'forest_green',
        ])->assertStatus(422)
          ->assertJsonValidationErrors(['colour_scheme']);

        // Reject burgundy
        $this->putJson("/api/admin/clients/{$this->profile->id}/layout", [
            'layout_id' => 1,
            'colour_scheme' => 'burgundy',
        ])->assertStatus(422)
          ->assertJsonValidationErrors(['colour_scheme']);

        // Reject invalid layout_id
        $this->putJson("/api/admin/clients/{$this->profile->id}/layout", [
            'layout_id' => 5,
            'colour_scheme' => 'slate_blue',
        ])->assertStatus(422)
          ->assertJsonValidationErrors(['layout_id']);

        $this->putJson("/api/admin/clients/{$this->profile->id}/layout", [
            'layout_id' => 0,
            'colour_scheme' => 'slate_blue',
        ])->assertStatus(422)
          ->assertJsonValidationErrors(['layout_id']);
    }

    /**
     * (1) Test: Subscription PUT with inactive status does NOT modify/null existing fee fields in DB.
     * Stored values in database remain completely untouched.
     */
    public function test_subscription_put_inactive_preserves_stored_fee_fields_untouched(): void
    {
        Sanctum::actingAs($this->admin);

        // Seed an active subscription with real fees
        ClientSubscription::create([
            'client_profile_id' => $this->profile->id,
            'status' => 'active',
            'from_date' => '2026-04-01',
            'to_date' => '2027-03-31',
            'total_fees' => 50000.00,
            'amount_paid' => 30000.00,
            'amount_receivable' => 20000.00,
            'outstanding' => 20000.00,
        ]);

        // Send PUT with status = inactive and zero/null values in payload
        $resp = $this->putJson("/api/admin/clients/{$this->profile->id}/subscription", [
            'status' => 'inactive',
            'from_date' => '2026-04-01',
            'to_date' => '2027-03-31',
            'total_fees' => 0,
            'amount_paid' => 0,
            'amount_receivable' => 0,
            'outstanding' => 0,
        ]);

        $resp->assertOk()
            ->assertJsonPath('status', 'inactive')
            ->assertJsonPath('total_fees', 0)
            ->assertJsonPath('amount_paid', 0)
            ->assertJsonPath('amount_receivable', 0)
            ->assertJsonPath('outstanding', 0);

        // Verify that database table values were NOT changed to 0; original values remain untouched!
        $dbSub = ClientSubscription::where('client_profile_id', $this->profile->id)->firstOrFail();
        $this->assertEquals('inactive', $dbSub->status);
        $this->assertEquals('50000.00', (string) $dbSub->total_fees);
        $this->assertEquals('30000.00', (string) $dbSub->amount_paid);
        $this->assertEquals('20000.00', (string) $dbSub->amount_receivable);
        $this->assertEquals('20000.00', (string) $dbSub->outstanding);
    }

    /**
     * (2) Test: Creating a new client generates 6 client_document_settings rows + 1 client_subscriptions row
     * (active, from_date=today, fees null).
     */
    public function test_new_client_creation_initializes_document_settings_and_subscription(): void
    {
        Sanctum::actingAs($this->admin);

        $payload = [
            'client_name' => 'New Global Enterprise',
            'business_name' => 'New Global Ent',
            'email' => 'contact@globalent.com',
            'login_prefix' => 'globalent',
            'password' => 'SecurePass123!',
            'mobile' => '9876543210',
            'constitution_type' => 'Private Limited Company',
            'is_active' => true,
        ];

        $resp = $this->postJson('/api/admin/clients', $payload);
        $resp->assertStatus(201);
        $newClientId = $resp->json('id');
        $this->assertNotNull($newClientId);

        // Verify 6 client_document_settings rows created
        $docSettings = ClientDocumentSetting::where('client_profile_id', $newClientId)->get();
        $this->assertCount(6, $docSettings);
        $expectedTypes = array_keys(ClientDocumentSetting::DOCUMENT_TYPES);
        $this->assertEqualsCanonicalizing($expectedTypes, $docSettings->pluck('document_type')->all());

        foreach ($docSettings as $doc) {
            $this->assertEquals(1, $doc->layout_id);
            $this->assertEquals('slate_blue', $doc->colour_scheme);
            $this->assertFalse((bool) $doc->watermark_applies);
        }

        // Verify 1 client_subscriptions row created
        $sub = ClientSubscription::where('client_profile_id', $newClientId)->first();
        $this->assertNotNull($sub);
        $this->assertEquals('active', $sub->status);
        $this->assertEquals(now()->toDateString(), $sub->from_date->toDateString());
        $this->assertNull($sub->to_date);
        $this->assertNull($sub->total_fees);
        $this->assertNull($sub->amount_paid);
        $this->assertNull($sub->amount_receivable);
        $this->assertNull($sub->outstanding);
    }

    /**
     * (3) Test: Active + null fees returns null in API, not 0.
     */
    public function test_active_subscription_with_null_fees_returns_null_in_api(): void
    {
        Sanctum::actingAs($this->admin);

        ClientSubscription::create([
            'client_profile_id' => $this->profile->id,
            'status' => 'active',
            'from_date' => '2026-04-01',
            'to_date' => null,
            'total_fees' => null,
            'amount_paid' => null,
            'amount_receivable' => null,
            'outstanding' => null,
        ]);

        $resp = $this->getJson("/api/admin/clients/{$this->profile->id}/subscription");
        $resp->assertOk()
            ->assertJsonPath('status', 'active');

        $this->assertNull($resp->json('total_fees'));
        $this->assertNull($resp->json('amount_paid'));
        $this->assertNull($resp->json('amount_receivable'));
        $this->assertNull($resp->json('outstanding'));
    }

    /**
     * (4) Test: Service Access GST row is read directly from gst_compliance_enabled flag, not hard-coded.
     */
    public function test_service_access_gst_row_reads_from_gst_compliance_enabled_flag(): void
    {
        Sanctum::actingAs($this->admin);

        ClientSubscription::create([
            'client_profile_id' => $this->profile->id,
            'status' => 'active',
            'from_date' => '2026-04-01',
        ]);

        // Case A: gst_compliance_enabled is FALSE on profile
        $this->profile->update(['gst_compliance_enabled' => false]);
        $respFalse = $this->getJson("/api/admin/clients/{$this->profile->id}/service-access");
        $respFalse->assertOk();
        $servicesFalse = collect($respFalse->json('services'))->keyBy('service_key');
        $this->assertFalse($servicesFalse['gst_compliance']['access']);

        // Case B: Directly update profile flag to TRUE in DB
        $this->profile->update(['gst_compliance_enabled' => true]);
        $respTrue = $this->getJson("/api/admin/clients/{$this->profile->id}/service-access");
        $respTrue->assertOk();
        $servicesTrue = collect($respTrue->json('services'))->keyBy('service_key');
        $this->assertTrue($servicesTrue['gst_compliance']['access']);

        // Case C: Update via Service Access API
        $updateResp = $this->putJson("/api/admin/clients/{$this->profile->id}/service-access", [
            'gst_compliance_enabled' => false,
        ]);
        $updateResp->assertOk();
        $this->assertFalse((bool) $this->profile->fresh()->gst_compliance_enabled);
    }

    /**
     * (6) Test: Configuration PUT rejects duplicate or missing document_type with 422.
     */
    public function test_configuration_put_rejects_duplicate_or_missing_document_types(): void
    {
        Sanctum::actingAs($this->admin);

        // Case A: Missing document types (only 5 provided)
        $missingPayload = [
            'documents' => [
                ['document_type' => 'tax_invoice', 'layout_id' => 1, 'colour_scheme' => 'slate_blue'],
                ['document_type' => 'bill_of_supply', 'layout_id' => 1, 'colour_scheme' => 'slate_blue'],
                ['document_type' => 'credit_note', 'layout_id' => 1, 'colour_scheme' => 'slate_blue'],
                ['document_type' => 'debit_note', 'layout_id' => 1, 'colour_scheme' => 'slate_blue'],
                ['document_type' => 'quotation', 'layout_id' => 1, 'colour_scheme' => 'slate_blue'],
                // delivery_challan missing!
            ],
        ];
        $this->putJson("/api/admin/clients/{$this->profile->id}/configuration", $missingPayload)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['documents']);

        // Case B: Duplicate document types (two tax_invoice rows)
        $duplicatePayload = [
            'documents' => [
                ['document_type' => 'tax_invoice', 'layout_id' => 1, 'colour_scheme' => 'slate_blue'],
                ['document_type' => 'tax_invoice', 'layout_id' => 2, 'colour_scheme' => 'charcoal_grey'],
                ['document_type' => 'bill_of_supply', 'layout_id' => 1, 'colour_scheme' => 'slate_blue'],
                ['document_type' => 'credit_note', 'layout_id' => 1, 'colour_scheme' => 'slate_blue'],
                ['document_type' => 'debit_note', 'layout_id' => 1, 'colour_scheme' => 'slate_blue'],
                ['document_type' => 'quotation', 'layout_id' => 1, 'colour_scheme' => 'slate_blue'],
            ],
        ];
        $this->putJson("/api/admin/clients/{$this->profile->id}/configuration", $duplicatePayload)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['documents']);

        // Case C: Unapproved colour slug
        $badColourPayload = [
            'documents' => [
                ['document_type' => 'tax_invoice', 'layout_id' => 1, 'colour_scheme' => 'forest_green'],
                ['document_type' => 'bill_of_supply', 'layout_id' => 1, 'colour_scheme' => 'slate_blue'],
                ['document_type' => 'credit_note', 'layout_id' => 1, 'colour_scheme' => 'slate_blue'],
                ['document_type' => 'debit_note', 'layout_id' => 1, 'colour_scheme' => 'slate_blue'],
                ['document_type' => 'quotation', 'layout_id' => 1, 'colour_scheme' => 'slate_blue'],
                ['document_type' => 'delivery_challan', 'layout_id' => 1, 'colour_scheme' => 'slate_blue'],
            ],
        ];
        $this->putJson("/api/admin/clients/{$this->profile->id}/configuration", $badColourPayload)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['documents.0.colour_scheme']);
    }

    /**
     * Test: Configuration saves all 6 valid document rows, watermark, and reminder.
     */
    public function test_configuration_saves_per_document_settings_watermark_and_reminder(): void
    {
        Sanctum::actingAs($this->admin);

        $payload = [
            'watermark_enabled' => true,
            'watermark_text' => 'www.abkhanassociates.com',
            'gst_reminder_enabled' => true,
            'documents' => [
                [
                    'document_type' => 'tax_invoice',
                    'layout_id' => 1,
                    'colour_scheme' => 'charcoal_grey',
                    'watermark_applies' => true,
                ],
                [
                    'document_type' => 'bill_of_supply',
                    'layout_id' => 2,
                    'colour_scheme' => 'dusty_plum',
                    'watermark_applies' => false,
                ],
                [
                    'document_type' => 'credit_note',
                    'layout_id' => 3,
                    'colour_scheme' => 'mocha_brown',
                    'watermark_applies' => true,
                ],
                [
                    'document_type' => 'debit_note',
                    'layout_id' => 4,
                    'colour_scheme' => 'deep_teal',
                    'watermark_applies' => false,
                ],
                [
                    'document_type' => 'quotation',
                    'layout_id' => 1,
                    'colour_scheme' => 'antique_gold',
                    'watermark_applies' => true,
                ],
                [
                    'document_type' => 'delivery_challan',
                    'layout_id' => 2,
                    'colour_scheme' => 'slate_blue',
                    'watermark_applies' => false,
                ],
            ],
        ];

        $saveResp = $this->putJson("/api/admin/clients/{$this->profile->id}/configuration", $payload);
        $saveResp->assertOk()
            ->assertJsonPath('watermark_enabled', true)
            ->assertJsonPath('watermark_text', 'www.abkhanassociates.com')
            ->assertJsonPath('gst_reminder_enabled', true);

        // Reload GET
        $getResp = $this->getJson("/api/admin/clients/{$this->profile->id}/configuration");
        $getResp->assertOk()
            ->assertJsonPath('watermark_enabled', true)
            ->assertJsonPath('watermark_text', 'www.abkhanassociates.com')
            ->assertJsonPath('gst_reminder_enabled', true);

        $docs = collect($getResp->json('documents'))->keyBy('document_type');
        $this->assertEquals(1, $docs['tax_invoice']['layout_id']);
        $this->assertEquals('charcoal_grey', $docs['tax_invoice']['colour_scheme']);
        $this->assertTrue($docs['tax_invoice']['watermark_applies']);

        $this->assertEquals(2, $docs['bill_of_supply']['layout_id']);
        $this->assertEquals('dusty_plum', $docs['bill_of_supply']['colour_scheme']);
        $this->assertFalse($docs['bill_of_supply']['watermark_applies']);
    }
}
