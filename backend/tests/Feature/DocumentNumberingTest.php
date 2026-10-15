<?php

namespace Tests\Feature;

use App\Models\ClientProfile;
use App\Models\CommercialDocument;
use App\Models\User;
use App\Services\Billing\InvoiceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DocumentNumberingTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private ClientProfile $profile;
    private InvoiceService $invoiceService;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create([
            'role' => 'admin',
            'email' => 'admin@test.com',
            'is_active' => true,
        ]);

        $clientUser = User::factory()->create([
            'role' => 'client',
            'is_active' => true,
        ]);

        $this->profile = ClientProfile::create([
            'user_id' => $clientUser->id,
            'client_name' => 'Numbering Test Corp',
            'business_name' => 'Numbering Test Corp',
            'client_code' => 'NTC001',
            'invoice_prefix' => 'INV',
            'invoice_next_number' => 1,
            'quotation_prefix' => 'QUO',
            'quotation_next_number' => 1,
            'delivery_challan_prefix' => 'CHL', // Test custom delivery challan column
            'delivery_challan_next_number' => 1,
            'has_gst' => true,
            'dealer_type' => 'regular',
        ]);

        $this->invoiceService = app(InvoiceService::class);
    }

    private function unlockAdmin(): void
    {
        Sanctum::actingAs($this->admin);
        \Illuminate\Support\Facades\Cache::put(
            \App\Http\Controllers\Api\Admin\ClientsUnlockController::cacheKey($this->admin->id),
            now()->toIso8601String(),
            now()->addHours(1)
        );
    }

    public function test_default_prefixes_and_custom_columns(): void
    {
        // Quotation default prefix should be 'QUO'
        $quoNum = $this->invoiceService->nextNumber($this->profile, 'quotation');
        $this->assertStringStartsWith('QUO-', $quoNum);

        // Delivery Challan should read profile delivery_challan_prefix column ('CHL')
        $dcNum = $this->invoiceService->nextNumber($this->profile, 'delivery_challan');
        $this->assertStringStartsWith('CHL/', $dcNum);

        // Tax invoice default
        $invNum = $this->invoiceService->nextNumber($this->profile, 'tax_invoice');
        $this->assertEquals('INV-01', $invNum);
    }

    public function test_custom_separator_and_prefix_last_formatting(): void
    {
        $this->profile->update([
            'document_numbering_settings' => [
                'invoice' => [
                    'prefix' => 'BILL',
                    'separator' => '/',
                    'next_number' => '05',
                    'prefix_position' => 'first',
                    'numbering_type' => 'auto',
                    'status' => true,
                ],
                'quotation' => [
                    'prefix' => 'EST',
                    'separator' => '-',
                    'next_number' => '09',
                    'prefix_position' => 'last',
                    'numbering_type' => 'auto',
                    'status' => true,
                ],
            ],
        ]);

        $invNum = $this->invoiceService->nextNumber($this->profile, 'tax_invoice');
        $this->assertEquals('BILL/01', $invNum); // Reads profile sequence 1 formatted with settings

        $quoNum = $this->invoiceService->nextNumber($this->profile, 'quotation');
        $this->assertEquals('01-EST', $quoNum); // Prefix last
    }

    public function test_atomic_allocation_prevents_race_duplicates(): void
    {
        // Issue two documents sequentially via allocateNextNumber
        $num1 = $this->invoiceService->allocateNextNumber($this->profile, 'tax_invoice');
        $this->assertEquals('INV-01', $num1);

        $this->profile->refresh();
        $this->assertEquals(2, $this->profile->invoice_next_number);
        $this->assertEquals('02', $this->profile->document_numbering_settings['invoice']['next_number']);

        $num2 = $this->invoiceService->allocateNextNumber($this->profile, 'tax_invoice');
        $this->assertEquals('INV-02', $num2);

        $this->profile->refresh();
        $this->assertEquals(3, $this->profile->invoice_next_number);
        $this->assertEquals('03', $this->profile->document_numbering_settings['invoice']['next_number']);

        $this->assertNotEquals($num1, $num2);
    }

    public function test_exact_duplicate_hard_block_422(): void
    {
        $this->unlockAdmin();

        // Create an existing document with number INV-01
        CommercialDocument::create([
            'client_profile_id' => $this->profile->id,
            'type' => 'tax_invoice',
            'number' => 'INV-01',
            'status' => 'issued',
            'document_date' => '2026-04-15',
            'taxable_amount' => 1000,
            'total_amount' => 1180,
        ]);

        // Attempting to set next_number = '01' for invoice should fail with 422
        $response = $this->putJson("/api/admin/clients/{$this->profile->id}", [
            'document_numbering_settings' => [
                'invoice' => [
                    'prefix' => 'INV',
                    'separator' => '-',
                    'next_number' => '01',
                    'prefix_position' => 'first',
                    'numbering_type' => 'auto',
                    'status' => true,
                ],
            ],
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['document_numbering_settings.invoice.next_number']);
    }

    public function test_exact_duplicate_checks_drafts_too(): void
    {
        $this->unlockAdmin();

        // Create a draft document with manual number INV-05
        CommercialDocument::create([
            'client_profile_id' => $this->profile->id,
            'type' => 'tax_invoice',
            'number' => 'INV-05',
            'status' => 'draft',
            'document_date' => '2026-04-15',
            'taxable_amount' => 1000,
            'total_amount' => 1180,
        ]);

        // Attempting to set next_number = '05' should fail with 422
        $response = $this->putJson("/api/admin/clients/{$this->profile->id}", [
            'document_numbering_settings' => [
                'invoice' => [
                    'prefix' => 'INV',
                    'separator' => '-',
                    'next_number' => '05',
                    'prefix_position' => 'first',
                    'numbering_type' => 'auto',
                    'status' => true,
                ],
            ],
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['document_numbering_settings.invoice.next_number']);
    }

    public function test_gap_check_returns_409_warning_and_confirms(): void
    {
        $this->unlockAdmin();

        // Create issued document with number INV-10
        CommercialDocument::create([
            'client_profile_id' => $this->profile->id,
            'type' => 'tax_invoice',
            'number' => 'INV-10',
            'status' => 'issued',
            'document_date' => '2026-04-15',
            'taxable_amount' => 1000,
            'total_amount' => 1180,
        ]);

        // Setting next_number = '04' (which is lower than 10, but unused) triggers 409
        $response = $this->putJson("/api/admin/clients/{$this->profile->id}", [
            'document_numbering_settings' => [
                'invoice' => [
                    'prefix' => 'INV',
                    'separator' => '-',
                    'next_number' => '04',
                    'prefix_position' => 'first',
                    'numbering_type' => 'auto',
                    'status' => true,
                ],
            ],
        ]);

        $response->assertStatus(409)
            ->assertJson([
                'requires_confirmation' => true,
                'doc_key' => 'invoice',
                'proposed_number' => 4,
                'highest_issued' => 10,
            ]);

        // Passing confirm_gap: true should successfully save
        $confirmResponse = $this->putJson("/api/admin/clients/{$this->profile->id}", [
            'confirm_gap' => true,
            'document_numbering_settings' => [
                'invoice' => [
                    'prefix' => 'INV',
                    'separator' => '-',
                    'next_number' => '04',
                    'prefix_position' => 'first',
                    'numbering_type' => 'auto',
                    'status' => true,
                ],
            ],
        ]);

        $confirmResponse->assertOk();

        $this->profile->refresh();
        $this->assertEquals(4, $this->profile->invoice_next_number);
    }

    public function test_gap_check_ignores_drafts(): void
    {
        $this->unlockAdmin();

        // Create a draft with DRAFT-TAX-01 (should NOT count towards highest issued)
        CommercialDocument::create([
            'client_profile_id' => $this->profile->id,
            'type' => 'tax_invoice',
            'number' => 'DRAFT-TAX-01',
            'status' => 'draft',
            'document_date' => '2026-04-15',
            'taxable_amount' => 1000,
            'total_amount' => 1180,
        ]);

        // Setting next_number = '01' when no issued documents exist should NOT trigger 409
        $response = $this->putJson("/api/admin/clients/{$this->profile->id}", [
            'document_numbering_settings' => [
                'invoice' => [
                    'prefix' => 'INV',
                    'separator' => '-',
                    'next_number' => '01',
                    'prefix_position' => 'first',
                    'numbering_type' => 'auto',
                    'status' => true,
                ],
            ],
        ]);

        $response->assertOk();
    }

    public function test_legacy_columns_sync_on_save(): void
    {
        $this->unlockAdmin();

        $response = $this->putJson("/api/admin/clients/{$this->profile->id}", [
            'document_numbering_settings' => [
                'quotation' => [
                    'prefix' => 'ESTIMATE',
                    'separator' => '-',
                    'next_number' => '25',
                    'prefix_position' => 'first',
                    'numbering_type' => 'auto',
                    'status' => true,
                ],
            ],
        ]);

        $response->assertOk();

        $this->profile->refresh();
        $this->assertEquals('ESTIMATE', $this->profile->quotation_prefix);
        $this->assertEquals(25, $this->profile->quotation_next_number);
    }

    public function test_create_issued_and_draft_issue_workflows(): void
    {
        // 1. Create with status = 'issued'
        $issuedDoc = $this->invoiceService->create($this->profile, [
            'type' => 'tax_invoice',
            'status' => 'issued',
            'document_date' => '2026-04-15',
            'lines' => [
                ['description' => 'Item 1', 'qty' => 1, 'rate' => 100, 'gst_rate' => 18],
            ],
        ]);

        $this->assertEquals('INV-01', $issuedDoc->number);
        $this->assertEquals('issued', $issuedDoc->status);
        $this->profile->refresh();
        $this->assertEquals(2, $this->profile->invoice_next_number);

        // 2. Create with status = 'draft'
        $draftDoc = $this->invoiceService->create($this->profile, [
            'type' => 'tax_invoice',
            'status' => 'draft',
            'document_date' => '2026-04-15',
            'lines' => [
                ['description' => 'Item 2', 'qty' => 1, 'rate' => 200, 'gst_rate' => 18],
            ],
        ]);

        $this->assertStringStartsWith('DRAFT-TAX-', $draftDoc->number);
        $this->assertEquals('draft', $draftDoc->status);
        $this->profile->refresh();
        // Counter shouldn't have changed on draft creation
        $this->assertEquals(2, $this->profile->invoice_next_number);

        // 3. Issue the draft
        $finalDoc = $this->invoiceService->issue($draftDoc, $this->profile);
        $this->assertEquals('INV-02', $finalDoc->number);
        $this->assertEquals('issued', $finalDoc->status);
        $this->profile->refresh();
        $this->assertEquals(3, $this->profile->invoice_next_number);
    }

    public function test_fallback_prefixes_when_profile_columns_empty(): void
    {
        $dummyProfile = new ClientProfile();
        $dummyProfile->invoice_prefix = null;
        $dummyProfile->quotation_prefix = null;
        $dummyProfile->delivery_challan_prefix = null;

        $this->assertEquals('INV', $this->invoiceService->prefixFor($dummyProfile, 'tax_invoice'));
        $this->assertEquals('QT', $this->invoiceService->prefixFor($dummyProfile, 'quotation'));
        $this->assertEquals('DC', $this->invoiceService->prefixFor($dummyProfile, 'delivery_challan'));
    }

    public function test_form_data_multipart_confirm_gap_variations(): void
    {
        $this->unlockAdmin();

        // Create issued document with number INV-10 so highest issued is 10
        CommercialDocument::create([
            'client_profile_id' => $this->profile->id,
            'type' => 'tax_invoice',
            'number' => 'INV-10',
            'status' => 'issued',
            'document_date' => '2026-04-15',
            'taxable_amount' => 1000,
            'total_amount' => 1180,
        ]);

        $settingsJson = json_encode([
            'invoice' => [
                'prefix' => 'INV',
                'separator' => '-',
                'next_number' => '04',
                'prefix_position' => 'first',
                'numbering_type' => 'auto',
                'status' => true,
            ],
        ]);

        $basePayload = [
            '_method' => 'PUT',
            'document_numbering_settings' => $settingsJson,
            'invoice_prefix' => 'INV',
            'invoice_next_number' => 4,
        ];

        // (a) Bina confirm_gap ke gap par 409
        $resA = $this->post("/api/admin/clients/{$this->profile->id}", $basePayload, [
            'Accept' => 'application/json',
        ]);
        $resA->assertStatus(409)
            ->assertJsonPath('requires_confirmation', true)
            ->assertJsonPath('proposed_number', 4)
            ->assertJsonPath('highest_issued', 10);

        // (b) confirm_gap='1' string ke saath 200 aur settings save
        $payloadB = array_merge($basePayload, ['confirm_gap' => '1']);
        $resB = $this->post("/api/admin/clients/{$this->profile->id}", $payloadB, [
            'Accept' => 'application/json',
        ]);
        $resB->assertOk();

        $this->profile->refresh();
        $this->assertEquals(4, $this->profile->invoice_next_number);
        $this->assertEquals('04', $this->profile->document_numbering_settings['invoice']['next_number']);

        // (c) confirm_gap='0' string par phir 409
        $settingsJsonC = json_encode([
            'invoice' => [
                'prefix' => 'INV',
                'separator' => '-',
                'next_number' => '02',
                'prefix_position' => 'first',
                'numbering_type' => 'auto',
                'status' => true,
            ],
        ]);
        $payloadC = [
            '_method' => 'PUT',
            'document_numbering_settings' => $settingsJsonC,
            'invoice_prefix' => 'INV',
            'invoice_next_number' => 2,
            'confirm_gap' => '0',
        ];
        $resC = $this->post("/api/admin/clients/{$this->profile->id}", $payloadC, [
            'Accept' => 'application/json',
        ]);
        $resC->assertStatus(409)
            ->assertJsonPath('requires_confirmation', true)
            ->assertJsonPath('proposed_number', 2)
            ->assertJsonPath('highest_issued', 10);
    }
}

