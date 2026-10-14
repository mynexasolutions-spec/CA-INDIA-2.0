<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\ClientGstReturn;
use App\Models\ClientProfile;
use App\Models\CommercialDocument;
use App\Models\Customer;
use App\Models\DocumentLineItem;
use App\Models\Product;
use App\Models\TdsTcsSection;
use App\Models\User;
use App\Services\Billing\AdminBillingCountService;
use App\Services\Billing\AdminBillingLockService;
use App\Services\Billing\InvoiceService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminBillingFullEditTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $staff;
    private ClientProfile $client;
    private Customer $customer;
    private CommercialDocument $invoice;

    protected function setUp(): void
    {
        parent::setUp();

        // Seed an HSN code
        DB::table('hsn_sac_codes')->insertOrIgnore([
            'type' => 'hsn',
            'code' => '998222',
            'description' => 'Accounting and Bookkeeping',
            'code_length' => 6,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->admin = User::factory()->create(['role' => 'admin', 'name' => 'Admin User']);
        $this->staff = User::factory()->create(['role' => 'staff', 'name' => 'Staff User']);

        $clientUser = User::factory()->create(['role' => 'client', 'is_active' => true, 'name' => 'Client Legal Name']);
        $this->client = ClientProfile::create([
            'user_id' => $clientUser->id,
            'client_code' => 'CL-EDIT-01',
            'business_name' => 'Acme Corporation',
            'client_name' => 'Client Legal Name',
            'has_gst' => true,
            'dealer_type' => 'regular',
            'gstin' => '27ABCDE1234F1Z5',
            'pan' => 'ABCDE1234F',
            'constitution_type' => 'Private Limited Company',
            'state' => 'Maharashtra',
            'state_code' => '27',
            'city' => 'Mumbai',
            'address_line_1' => '100 Marine Lines',
            'pincode' => '400020',
        ]);

        $this->customer = Customer::create([
            'client_profile_id' => $this->client->id,
            'name' => 'Test Customer',
            'gst_status' => 'registered',
            'gstin' => '27XYZAB5678C1Z2',
            'state' => 'Maharashtra',
            'state_code' => '27',
        ]);

        $this->invoice = CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'customer_id' => $this->customer->id,
            'type' => 'tax_invoice',
            'number' => 'INV-2026-001',
            'document_date' => '2026-05-10',
            'status' => 'issued',
            'place_of_supply' => 'Maharashtra (27)',
            'is_inter_state' => false,
            'is_reverse_charge' => false,
            'taxable_amount' => 1000,
            'cgst_amount' => 90,
            'sgst_amount' => 90,
            'igst_amount' => 0,
            'total_amount' => 1180,
            'grand_total' => 1180,
            'amount_in_words' => 'Rupees One Thousand One Hundred Eighty Only.',
            'issued_at' => Carbon::parse('2026-05-10 10:00:00'),
        ]);
        $this->invoice->created_at = Carbon::parse('2026-05-10 10:00:00', 'Asia/Kolkata')->utc();
        $this->invoice->saveQuietly();

        DocumentLineItem::create([
            'commercial_document_id' => $this->invoice->id,
            'description' => 'Original Item',
            'hsn_sac' => '998222',
            'qty' => 1,
            'unit' => 'NOS',
            'rate' => 1000,
            'gst_rate' => 18,
            'taxable_amount' => 1000,
            'cgst_amount' => 90,
            'sgst_amount' => 90,
            'total_amount' => 1180,
            'sort_order' => 0,
        ]);
    }

    private function validPayload(array $overrides = []): array
    {
        return array_merge([
            'fy' => '2026-27',
            'document_date' => '2026-05-15',
            'is_inter_state' => false,
            'is_reverse_charge' => false,
            'customer_id' => $this->customer->id,
            'place_of_supply' => 'Maharashtra (27)',
            'payment_terms' => 'Net 30',
            'currency' => 'INR',
            'notes' => 'Updated notes',
            'terms' => 'Updated terms',
            'lines' => [
                [
                    'description' => 'Consulting Services',
                    'hsn_sac' => '998222',
                    'qty' => 2,
                    'rate' => 1500,
                    'gst_rate' => 18,
                    'unit' => 'HRS',
                    'discount_percent' => 10,
                ],
            ],
        ], $overrides);
    }

    public function test_unauthenticated_request_is_rejected_401(): void
    {
        $res = $this->putJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$this->invoice->id}", $this->validPayload());
        $res->assertStatus(401);
    }

    public function test_non_staff_role_is_rejected_403(): void
    {
        $clientUser = User::factory()->create(['role' => 'client']);
        Sanctum::actingAs($clientUser);

        $res = $this->putJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$this->invoice->id}", $this->validPayload());
        $res->assertStatus(403);
    }

    public function test_staff_role_can_edit(): void
    {
        Sanctum::actingAs($this->staff);

        $res = $this->putJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$this->invoice->id}", $this->validPayload());
        $res->assertStatus(200);
        $res->assertJsonPath('message', 'Document updated successfully.');
    }

    public function test_doctype_other_than_tax_invoice_returns_422(): void
    {
        Sanctum::actingAs($this->admin);

        foreach (['bill_of_supply', 'credit_note', 'debit_note', 'quotation', 'delivery_challan'] as $docType) {
            $res = $this->putJson("/api/admin/billing/client-directory/{$this->client->id}/documents/{$docType}/{$this->invoice->id}", $this->validPayload());
            $res->assertStatus(422);
            $this->assertStringContainsString('Only Tax Invoices can be edited', $res->json('message'));
        }
    }

    public function test_unknown_doctype_returns_404_from_assert_valid_doctype(): void
    {
        Sanctum::actingAs($this->admin);

        $res = $this->putJson("/api/admin/billing/client-directory/{$this->client->id}/documents/invalid_type/{$this->invoice->id}", $this->validPayload());
        $res->assertStatus(404);
    }

    public function test_missing_fy_returns_422(): void
    {
        Sanctum::actingAs($this->admin);

        $payload = $this->validPayload();
        unset($payload['fy']);

        $res = $this->putJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$this->invoice->id}", $payload);
        $res->assertStatus(422)->assertJsonValidationErrors(['fy']);
    }

    public function test_invalid_fy_format_or_range_returns_422_from_resolve_fy(): void
    {
        Sanctum::actingAs($this->admin);

        $res1 = $this->putJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$this->invoice->id}", $this->validPayload(['fy' => 'bad-fy']));
        $res1->assertStatus(422)->assertJsonValidationErrors(['fy']);

        $res2 = $this->putJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$this->invoice->id}", $this->validPayload(['fy' => '2024-25']));
        $res2->assertStatus(422)->assertJsonValidationErrors(['fy']);

        $res3 = $this->putJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$this->invoice->id}", $this->validPayload(['fy' => '2026-28']));
        $res3->assertStatus(422)->assertJsonValidationErrors(['fy']);
    }

    public function test_guard_g1_soft_deleted_document_returns_422(): void
    {
        Sanctum::actingAs($this->admin);

        $this->invoice->delete();

        $res = $this->putJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$this->invoice->id}", $this->validPayload());
        $res->assertStatus(422);
        $this->assertStringContainsString('Deleted documents cannot be edited', $res->json('message'));
    }

    public function test_guard_g1_status_deleted_document_returns_422(): void
    {
        Sanctum::actingAs($this->admin);

        $this->invoice->update(['status' => 'deleted']);

        $res = $this->putJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$this->invoice->id}", $this->validPayload());
        $res->assertStatus(422);
        $this->assertStringContainsString('Deleted documents cannot be edited', $res->json('message'));
    }

    public function test_guard_g2_cancelled_document_returns_422(): void
    {
        Sanctum::actingAs($this->admin);

        $this->invoice->update(['status' => 'cancelled']);

        $res = $this->putJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$this->invoice->id}", $this->validPayload());
        $res->assertStatus(422);
        $this->assertStringContainsString('Only active documents can be edited', $res->json('message'));
    }

    public function test_guard_g2_draft_document_returns_422(): void
    {
        Sanctum::actingAs($this->admin);

        $this->invoice->update(['status' => 'draft']);

        $res = $this->putJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$this->invoice->id}", $this->validPayload());
        $res->assertStatus(422);
        $this->assertStringContainsString('Only active documents can be edited', $res->json('message'));
    }

    public function test_guard_g3_gst_filed_period_returns_422(): void
    {
        Sanctum::actingAs($this->admin);

        ClientGstReturn::create([
            'client_profile_id' => $this->client->id,
            'return_type' => 'GSTR1',
            'tax_period' => '2026-05',
            'status' => 'filed',
            'filed_on' => '2026-06-11',
            'ack_no' => 'ARN-12345',
        ]);

        $res = $this->putJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$this->invoice->id}", $this->validPayload());
        $res->assertStatus(422);
        $this->assertStringContainsString('GST Return for this document\'s period has already been filed', $res->json('message'));
    }

    public function test_guard_g4_document_date_in_future_returns_422(): void
    {
        Sanctum::actingAs($this->admin);

        $futureDate = Carbon::today('Asia/Kolkata')->addDays(2)->format('Y-m-d');
        $fyStart = Carbon::today('Asia/Kolkata')->month >= 4 ? Carbon::today('Asia/Kolkata')->year : Carbon::today('Asia/Kolkata')->year - 1;
        $fyStr = sprintf('%04d-%02d', $fyStart, ($fyStart + 1) % 100);

        $res = $this->putJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$this->invoice->id}", $this->validPayload([
            'fy' => $fyStr,
            'document_date' => $futureDate,
        ]));
        $res->assertStatus(422);
        $this->assertStringContainsString('Document date cannot be in the future', $res->json('message'));
    }

    public function test_guard_g4_document_date_outside_selected_fy_returns_422(): void
    {
        Sanctum::actingAs($this->admin);

        // Selected FY is 2027-28, document_date is 2026-05-10 (not in future, but outside 2027-28)
        $res = $this->putJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$this->invoice->id}", $this->validPayload([
            'fy' => '2027-28',
            'document_date' => '2026-05-10',
        ]));
        $res->assertStatus(422);
        $this->assertStringContainsString('Document date must fall within the selected Financial Year', $res->json('message'));
    }

    public function test_guard_g4_non_ymd_document_date_returns_422(): void
    {
        Sanctum::actingAs($this->admin);

        $res = $this->putJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$this->invoice->id}", $this->validPayload([
            'document_date' => '10/05/2026',
        ]));
        $res->assertStatus(422)->assertJsonValidationErrors(['document_date']);
    }

    public function test_guard_g5_document_attached_to_gst_filing_request_returns_422(): void
    {
        Sanctum::actingAs($this->admin);

        $req = \App\Models\GstFilingRequest::create([
            'client_profile_id' => $this->client->id,
            'financial_year' => '2026-27',
            'filing_period' => '2026-05',
            'return_type' => 'GSTR1',
            'status' => 'submitted',
        ]);

        DB::table('gst_filing_request_document')->insert([
            'commercial_document_id' => $this->invoice->id,
            'gst_filing_request_id' => $req->id,
        ]);

        $res = $this->putJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$this->invoice->id}", $this->validPayload());
        $res->assertStatus(422);
        $this->assertStringContainsString('attached to a GST Filing Request', $res->json('message'));
    }

    public function test_guard_g6_document_referenced_by_active_credit_note_returns_422(): void
    {
        Sanctum::actingAs($this->admin);

        CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'type' => 'credit_note',
            'number' => 'CN-001',
            'reference_document_id' => $this->invoice->id,
            'document_date' => '2026-05-12',
            'status' => 'issued',
        ]);

        $res = $this->putJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$this->invoice->id}", $this->validPayload());
        $res->assertStatus(422);
        $this->assertStringContainsString('Credit Note, Debit Note, or Amendment issued against it', $res->json('message'));
    }

    public function test_guard_g6_document_referenced_by_soft_deleted_credit_note_is_allowed_to_edit(): void
    {
        Sanctum::actingAs($this->admin);

        $cn = CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'type' => 'credit_note',
            'number' => 'CN-001',
            'reference_document_id' => $this->invoice->id,
            'document_date' => '2026-05-12',
            'status' => 'issued',
        ]);
        $cn->delete(); // Soft-delete the referencing doc

        $res = $this->putJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$this->invoice->id}", $this->validPayload());
        $res->assertStatus(200);
        $res->assertJsonPath('message', 'Document updated successfully.');
    }

    public function test_validation_stricter_qty_zero_or_negative_returns_422(): void
    {
        Sanctum::actingAs($this->admin);

        $payload1 = $this->validPayload();
        $payload1['lines'][0]['qty'] = 0;
        $res1 = $this->putJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$this->invoice->id}", $payload1);
        $res1->assertStatus(422)->assertJsonValidationErrors(['lines.0.qty']);

        $payload2 = $this->validPayload();
        $payload2['lines'][0]['qty'] = -2;
        $res2 = $this->putJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$this->invoice->id}", $payload2);
        $res2->assertStatus(422)->assertJsonValidationErrors(['lines.0.qty']);
    }

    public function test_validation_stricter_rate_negative_returns_422(): void
    {
        Sanctum::actingAs($this->admin);

        $payload = $this->validPayload();
        $payload['lines'][0]['rate'] = -50;
        $res = $this->putJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$this->invoice->id}", $payload);
        $res->assertStatus(422)->assertJsonValidationErrors(['lines.0.rate']);
    }

    public function test_validation_stricter_discount_percent_negative_or_exceeding_100_returns_422(): void
    {
        Sanctum::actingAs($this->admin);

        $payload1 = $this->validPayload();
        $payload1['lines'][0]['discount_percent'] = -5;
        $res1 = $this->putJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$this->invoice->id}", $payload1);
        $res1->assertStatus(422)->assertJsonValidationErrors(['lines.0.discount_percent']);

        $payload2 = $this->validPayload();
        $payload2['lines'][0]['discount_percent'] = 105;
        $res2 = $this->putJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$this->invoice->id}", $payload2);
        $res2->assertStatus(422)->assertJsonValidationErrors(['lines.0.discount_percent']);
    }

    public function test_validation_stricter_discount_amount_negative_returns_422(): void
    {
        Sanctum::actingAs($this->admin);

        $payload = $this->validPayload();
        $payload['lines'][0]['discount_amount'] = -100;
        $res = $this->putJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$this->invoice->id}", $payload);
        $res->assertStatus(422)->assertJsonValidationErrors(['lines.0.discount_amount']);
    }

    public function test_customer_belonging_to_another_client_returns_422(): void
    {
        Sanctum::actingAs($this->admin);

        $otherClient = ClientProfile::create([
            'user_id' => User::factory()->create(['role' => 'client'])->id,
            'business_name' => 'Foreign Client',
            'has_gst' => true,
        ]);
        $otherCustomer = Customer::create([
            'client_profile_id' => $otherClient->id,
            'name' => 'Other Customer',
        ]);

        $res = $this->putJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$this->invoice->id}", $this->validPayload([
            'customer_id' => $otherCustomer->id,
        ]));
        $res->assertStatus(422);
        $this->assertStringContainsString('Selected party does not belong to this client', $res->json('message'));
    }

    public function test_product_belonging_to_another_client_returns_422(): void
    {
        Sanctum::actingAs($this->admin);

        $otherClient = ClientProfile::create([
            'user_id' => User::factory()->create(['role' => 'client'])->id,
            'business_name' => 'Foreign Client 2',
            'has_gst' => true,
        ]);
        $otherProduct = Product::create([
            'client_profile_id' => $otherClient->id,
            'name' => 'Other Product',
            'rate' => 100,
        ]);

        $payload = $this->validPayload();
        $payload['lines'][0]['product_id'] = $otherProduct->id;

        $res = $this->putJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$this->invoice->id}", $payload);
        $res->assertStatus(422);
        $this->assertStringContainsString('Selected product does not belong to this client', $res->json('message'));
    }

    public function test_rcm_true_on_non_rcm_client_returns_422(): void
    {
        Sanctum::actingAs($this->admin);

        $compClient = ClientProfile::create([
            'user_id' => User::factory()->create(['role' => 'client'])->id,
            'business_name' => 'Composition Trader',
            'has_gst' => true,
            'dealer_type' => 'composition',
        ]);
        $compInvoice = CommercialDocument::create([
            'client_profile_id' => $compClient->id,
            'type' => 'tax_invoice',
            'number' => 'INV-COMP-01',
            'document_date' => '2026-05-10',
            'status' => 'issued',
        ]);

        $res = $this->putJson("/api/admin/billing/client-directory/{$compClient->id}/documents/tax_invoice/{$compInvoice->id}", $this->validPayload([
            'is_reverse_charge' => true,
        ]));
        $res->assertStatus(422);
        $this->assertStringContainsString('Reverse charge is only available for regular GST dealers', $res->json('message'));
    }

    public function test_happy_path_replaces_lines_and_recalculates_all_taxes(): void
    {
        Sanctum::actingAs($this->admin);

        // Lines: 2 qty * 1500 rate = 3000 gross. 10% discount = 300 discount. Taxable = 2700.
        // CGST (9%) = 243, SGST (9%) = 243. Grand total = 3186.
        $payload = $this->validPayload([
            'document_date' => '2026-05-20',
            'lines' => [
                [
                    'description' => 'Updated Advisory Service',
                    'hsn_sac' => '998222',
                    'qty' => 2,
                    'rate' => 1500,
                    'gst_rate' => 18,
                    'discount_percent' => 10,
                ],
            ],
        ]);

        $res = $this->putJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$this->invoice->id}", $payload);
        $res->assertStatus(200);

        // Verify flat Option 2 shape
        $res->assertJsonStructure([
            'message',
            'document' => ['id', 'number', 'type', 'status', 'payment_status', 'document_date', 'created_at', 'place_of_supply', 'supply_type'],
            'gst' => ['status', 'filed_on', 'ack_no'],
            'flags' => ['can_edit', 'can_edit_creation_date', 'can_cancel', 'can_delete'],
            'seller',
            'customer',
            'line_items',
            'summary' => ['taxable', 'cgst', 'sgst', 'igst', 'round_off', 'grand_total', 'amount_in_words'],
        ]);

        $this->assertEquals(2700.0, $res->json('summary.taxable'));
        $this->assertEquals(243.0, $res->json('summary.cgst'));
        $this->assertEquals(243.0, $res->json('summary.sgst'));
        $this->assertEquals(0.0, $res->json('summary.igst'));
        $this->assertEquals(3186.0, $res->json('summary.grand_total'));
        $this->assertCount(1, $res->json('line_items'));
        $this->assertEquals('Updated Advisory Service', $res->json('line_items.0.description'));

        // Verify DB updates
        $this->invoice->refresh();
        $this->assertEquals('2026-05-20', $this->invoice->document_date->format('Y-m-d'));
        $this->assertEquals(2700.0, (float) $this->invoice->taxable_amount);
        $this->assertEquals(3186.0, (float) $this->invoice->grand_total);
        $this->assertCount(1, $this->invoice->lineItems);
    }

    public function test_body_submitting_immutable_fields_does_not_modify_stored_values(): void
    {
        Sanctum::actingAs($this->admin);

        $originalNumber = $this->invoice->number;
        $originalStatus = $this->invoice->status;
        $originalCreatedAt = $this->invoice->created_at->toIso8601String();
        $originalIssuedAt = $this->invoice->issued_at->toIso8601String();

        $payload = $this->validPayload([
            'number' => 'HACKED-NUMBER',
            'status' => 'draft',
            'type' => 'credit_note',
            'created_at' => '2020-01-01',
            'issued_at' => '2020-01-01',
            'reference_document_id' => 9999,
            'client_profile_id' => 8888,
        ]);

        $res = $this->putJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$this->invoice->id}", $payload);
        $res->assertStatus(200);

        $this->invoice->refresh();
        $this->assertEquals($originalNumber, $this->invoice->number);
        $this->assertEquals($originalStatus, $this->invoice->status);
        $this->assertEquals('tax_invoice', $this->invoice->type);
        $this->assertEquals($this->client->id, $this->invoice->client_profile_id);
        $this->assertNull($this->invoice->reference_document_id);
        $this->assertEquals($originalCreatedAt, $this->invoice->created_at->toIso8601String());
        $this->assertEquals($originalIssuedAt, $this->invoice->issued_at->toIso8601String());
    }

    public function test_customer_change_with_is_inter_state_flipped_follows_body_flag(): void
    {
        Sanctum::actingAs($this->admin);

        $interCustomer = Customer::create([
            'client_profile_id' => $this->client->id,
            'name' => 'Gujarat Customer',
            'gst_status' => 'registered',
            'gstin' => '24ABCDE1234F1Z1',
            'state' => 'Gujarat',
            'state_code' => '24',
        ]);

        $payload = $this->validPayload([
            'customer_id' => $interCustomer->id,
            'is_inter_state' => true,
            'lines' => [
                [
                    'description' => 'Inter-state Item',
                    'hsn_sac' => '998222',
                    'qty' => 1,
                    'rate' => 2000,
                    'gst_rate' => 18,
                ],
            ],
        ]);

        $res = $this->putJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$this->invoice->id}", $payload);
        $res->assertStatus(200);

        $res->assertJsonPath('document.supply_type', 'Inter-state');
        $this->assertEquals(2000.0, $res->json('summary.taxable'));
        $this->assertEquals(0.0, $res->json('summary.cgst'));
        $this->assertEquals(0.0, $res->json('summary.sgst'));
        $this->assertEquals(360.0, $res->json('summary.igst'));
        $this->assertEquals(2360.0, $res->json('summary.grand_total'));

        $this->invoice->refresh();
        $this->assertTrue($this->invoice->is_inter_state);
        $this->assertEquals(360.0, (float) $this->invoice->igst_amount);
        $this->assertEquals(0.0, (float) $this->invoice->cgst_amount);
    }

    public function test_activity_log_row_created_with_admin_edited_document_and_totals(): void
    {
        Sanctum::actingAs($this->admin);

        $oldTotal = (float) $this->invoice->grand_total;

        $payload = $this->validPayload([
            'lines' => [
                [
                    'description' => 'New Service',
                    'hsn_sac' => '998222',
                    'qty' => 1,
                    'rate' => 5000,
                    'gst_rate' => 18,
                ],
            ],
        ]);

        $res = $this->putJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$this->invoice->id}", $payload);
        $res->assertStatus(200);

        $log = ActivityLog::where('action', 'admin_edited_document')
            ->where('subject_type', CommercialDocument::class)
            ->where('subject_id', $this->invoice->id)
            ->latest('id')
            ->first();

        $this->assertNotNull($log);
        $this->assertEquals($this->admin->id, $log->user_id);
        $this->assertEquals($this->invoice->number, $log->properties['number']);
        $this->assertEquals('tax_invoice', $log->properties['type']);
        $this->assertEquals($this->client->id, $log->properties['client_profile_id']);
        $this->assertEquals($oldTotal, (float) $log->properties['old_grand_total']);
        $this->assertEquals(5900.0, (float) $log->properties['new_grand_total']);
    }

    public function test_pdf_failure_retains_db_edits_logs_warning_and_sets_pdf_path_null(): void
    {
        Sanctum::actingAs($this->admin);

        // Pre-populate pdf_path
        $this->invoice->update(['pdf_path' => 'invoices/sample.pdf']);

        // Mock generatePdf to throw
        $mockInvoiceService = $this->partialMock(InvoiceService::class, function ($mock) {
            $mock->shouldReceive('generatePdf')->andThrow(new \RuntimeException('PDF Engine Down'));
        });
        $this->app->instance(InvoiceService::class, $mockInvoiceService);

        Log::shouldReceive('warning')->once()->withArgs(function ($message) {
            return str_contains($message, 'Admin edit PDF generation failed');
        });

        $payload = $this->validPayload([
            'lines' => [
                [
                    'description' => 'Service without PDF',
                    'hsn_sac' => '998222',
                    'qty' => 1,
                    'rate' => 2000,
                    'gst_rate' => 18,
                ],
            ],
        ]);

        $res = $this->putJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$this->invoice->id}", $payload);
        $res->assertStatus(200);

        // Edit is persisted in DB
        $this->invoice->refresh();
        $this->assertEquals(2000.0, (float) $this->invoice->taxable_amount);
        $this->assertNull($this->invoice->pdf_path); // set to null on failure
    }

    public function test_gst_off_client_edit(): void
    {
        Sanctum::actingAs($this->admin);

        $retailClient = ClientProfile::create([
            'user_id' => User::factory()->create(['role' => 'client'])->id,
            'business_name' => 'Retail Grocery Shop',
            'has_gst' => false,
            'pan' => 'BBBBB1234B',
        ]);
        $retailInvoice = CommercialDocument::create([
            'client_profile_id' => $retailClient->id,
            'type' => 'tax_invoice',
            'number' => 'RET-001',
            'document_date' => '2026-05-10',
            'status' => 'issued',
            'taxable_amount' => 500,
            'total_amount' => 500,
            'grand_total' => 500,
        ]);

        // HSN not required for retail mode
        $payload = [
            'fy' => '2026-27',
            'document_date' => '2026-05-15',
            'is_inter_state' => false,
            'is_reverse_charge' => false,
            'lines' => [
                [
                    'description' => 'Retail Item without HSN',
                    'qty' => 3,
                    'rate' => 200,
                    'unit' => 'NOS',
                ],
            ],
        ];

        $res = $this->putJson("/api/admin/billing/client-directory/{$retailClient->id}/documents/tax_invoice/{$retailInvoice->id}", $payload);
        $res->assertStatus(200);

        // Taxes disabled for retail -> no CGST/SGST/IGST
        $this->assertEquals(600.0, $res->json('summary.taxable'));
        $this->assertEquals(0.0, $res->json('summary.cgst'));
        $this->assertEquals(0.0, $res->json('summary.sgst'));
        $this->assertEquals(600.0, $res->json('summary.grand_total'));
    }

    public function test_tds_tcs_edit(): void
    {
        Sanctum::actingAs($this->admin);

        $tdsSection = TdsTcsSection::create([
            'type' => 'tds',
            'code' => '194C',
            'description' => 'Contractor',
            'rate' => 2.0,
            'is_active' => true,
        ]);

        $payload = $this->validPayload([
            'tax_deduction_type' => 'tds',
            'tds_tcs_section_id' => $tdsSection->id,
            'lines' => [
                [
                    'description' => 'Works Contract',
                    'hsn_sac' => '998222',
                    'qty' => 1,
                    'rate' => 10000,
                    'gst_rate' => 18,
                ],
            ],
        ]);

        $res = $this->putJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$this->invoice->id}", $payload);
        $res->assertStatus(200);

        // Taxable = 10000, GST = 1800, subtotal = 11800.
        // TDS = 2% on 10000 = 200. Grand total = 11800 - 200 = 11600.
        $this->assertEquals(10000.0, $res->json('summary.taxable'));
        $this->assertEquals(11600.0, $res->json('summary.grand_total'));

        $this->invoice->refresh();
        $this->assertEquals('tds', $this->invoice->tax_deduction_type);
        $this->assertEquals($tdsSection->id, $this->invoice->tds_tcs_section_id);
        $this->assertEquals(2.0, (float) $this->invoice->tds_tcs_rate);
        $this->assertEquals(200.0, (float) $this->invoice->tds_tcs_amount);
        $this->assertEquals(11600.0, (float) $this->invoice->grand_total);
    }

    public function test_paid_and_partial_invoices_preserve_status_and_payment_status(): void
    {
        Sanctum::actingAs($this->admin);

        // 1. Paid invoice
        $this->invoice->update(['status' => 'paid']);

        $resPaid = $this->putJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$this->invoice->id}", $this->validPayload([
            'lines' => [
                [
                    'description' => 'Paid Invoice Edit',
                    'hsn_sac' => '998222',
                    'qty' => 1,
                    'rate' => 4000,
                    'gst_rate' => 18,
                ],
            ],
        ]));
        $resPaid->assertStatus(200);
        $resPaid->assertJsonPath('document.status', 'paid');
        $resPaid->assertJsonPath('document.payment_status', 'Paid');

        $this->invoice->refresh();
        $this->assertEquals('paid', $this->invoice->status);

        // 2. Partial invoice
        $this->invoice->update(['status' => 'partial']);

        $resPartial = $this->putJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$this->invoice->id}", $this->validPayload([
            'lines' => [
                [
                    'description' => 'Partial Invoice Edit',
                    'hsn_sac' => '998222',
                    'qty' => 1,
                    'rate' => 4500,
                    'gst_rate' => 18,
                ],
            ],
        ]));
        $resPartial->assertStatus(200);
        $resPartial->assertJsonPath('document.status', 'partial');
        $resPartial->assertJsonPath('document.payment_status', 'Partial');

        $this->invoice->refresh();
        $this->assertEquals('partial', $this->invoice->status);
    }

    public function test_show_output_remains_unchanged_with_can_edit_flag(): void
    {
        Sanctum::actingAs($this->admin);

        $res = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$this->invoice->id}");
        $res->assertStatus(200);

        $res->assertJsonStructure([
            'document',
            'gst',
            'flags' => ['can_edit', 'can_edit_creation_date', 'can_cancel', 'can_delete'],
            'seller',
            'customer',
            'line_items',
            'summary',
        ]);
        $this->assertTrue($res->json('flags.can_edit'));
    }

    public function test_can_edit_flag_variations_in_compute_document_flags(): void
    {
        // 1. Active unfiled unattached tax_invoice -> true
        $lockUnfiled = ['is_locked' => false];
        $flags1 = AdminBillingCountService::computeDocumentFlags($this->invoice, $lockUnfiled);
        $this->assertTrue($flags1['can_edit']);

        // 2. GST filed -> false
        $lockFiled = ['is_locked' => true];
        $flags2 = AdminBillingCountService::computeDocumentFlags($this->invoice, $lockFiled);
        $this->assertFalse($flags2['can_edit']);

        // 3. Cancelled doc -> false
        $this->invoice->update(['status' => 'cancelled']);
        $flags3 = AdminBillingCountService::computeDocumentFlags($this->invoice, $lockUnfiled);
        $this->assertFalse($flags3['can_edit']);

        // 4. Draft doc -> false
        $this->invoice->update(['status' => 'draft']);
        $flags4 = AdminBillingCountService::computeDocumentFlags($this->invoice, $lockUnfiled);
        $this->assertFalse($flags4['can_edit']);

        // 5. Soft-deleted / trashed doc -> false
        $this->invoice->update(['status' => 'deleted']);
        $flags5 = AdminBillingCountService::computeDocumentFlags($this->invoice, $lockUnfiled);
        $this->assertFalse($flags5['can_edit']);

        // 6. Quotation / delivery challan -> false
        $quotation = CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'type' => 'quotation',
            'number' => 'QUO-001',
            'document_date' => '2026-05-10',
            'status' => 'issued',
        ]);
        $flags6 = AdminBillingCountService::computeDocumentFlags($quotation, $lockUnfiled);
        $this->assertFalse($flags6['can_edit']);
    }

    public function test_minimal_body_keeps_stored_values_for_omitted_keys_and_recalculates_with_stored_tds(): void
    {
        Sanctum::actingAs($this->admin);

        $tdsSection = TdsTcsSection::create([
            'type' => 'tds',
            'code' => '194J',
            'description' => 'Professional fees',
            'rate' => 10.0,
            'is_active' => true,
        ]);

        $this->invoice->update([
            'notes' => 'Original Stored Notes',
            'terms' => 'Original Stored Terms',
            'payment_terms' => 'Net 45 Days',
            'due_date' => '2026-06-30',
            'place_of_supply' => 'Karnataka (29)',
            'tax_deduction_type' => 'tds',
            'tds_tcs_section_id' => $tdsSection->id,
            'currency' => 'INR',
        ]);

        // Minimal body with ONLY required keys: fy, document_date, is_inter_state, is_reverse_charge, lines
        $minimalPayload = [
            'fy' => '2026-27',
            'document_date' => '2026-05-20',
            'is_inter_state' => false,
            'is_reverse_charge' => false,
            'lines' => [
                [
                    'description' => 'Consulting Service',
                    'qty' => 1,
                    'rate' => 2000,
                    'gst_rate' => 18,
                    'hsn_sac' => '998222',
                ],
            ],
        ];

        $res = $this->putJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$this->invoice->id}", $minimalPayload);
        $res->assertStatus(200);

        $this->invoice->refresh();

        // Kept stored values
        $this->assertEquals($this->customer->id, $this->invoice->customer_id);
        $this->assertEquals('Original Stored Notes', $this->invoice->notes);
        $this->assertEquals('Original Stored Terms', $this->invoice->terms);
        $this->assertEquals('Net 45 Days', $this->invoice->payment_terms);
        $this->assertEquals('2026-06-30', $this->invoice->due_date->format('Y-m-d'));
        $this->assertEquals('Karnataka (29)', $this->invoice->place_of_supply);
        $this->assertEquals('tds', $this->invoice->tax_deduction_type);
        $this->assertEquals($tdsSection->id, $this->invoice->tds_tcs_section_id);
        $this->assertEquals('INR', $this->invoice->currency);

        // Recalculated with kept TDS (10% on 2000 taxable = 200 TDS deduction):
        // Taxable: 2000, CGST: 180, SGST: 180, Subtotal: 2360, TDS deduction: -200 -> Grand Total: 2160
        $this->assertEquals(2000.0, (float) $this->invoice->taxable_amount);
        $this->assertEquals(200.0, (float) $this->invoice->tds_tcs_amount);
        $this->assertEquals(2160.0, (float) $this->invoice->grand_total);
    }

    public function test_explicit_null_clears_stored_values_and_terms_does_not_fallback_to_profile_default(): void
    {
        Sanctum::actingAs($this->admin);

        // Set profile default terms and place of supply
        $this->client->update([
            'terms_conditions' => 'Profile Default Terms',
            'place_of_supply_default' => 'Maharashtra (27)',
        ]);

        $this->invoice->update([
            'notes' => 'Some existing notes',
            'terms' => 'Some existing terms',
            'place_of_supply' => 'Goa (30)',
        ]);

        $payload = $this->validPayload([
            'customer_id' => null,
            'notes' => null,
            'terms' => null,
            'place_of_supply' => null,
        ]);

        $res = $this->putJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$this->invoice->id}", $payload);
        $res->assertStatus(200);

        $this->invoice->refresh();

        $this->assertNull($this->invoice->customer_id);
        $this->assertNull($this->invoice->notes);
        $this->assertNull($this->invoice->terms); // MUST NOT fall back to 'Profile Default Terms'
        $this->assertNull($this->invoice->place_of_supply); // MUST NOT fall back to 'Maharashtra (27)'
    }

    public function test_round_off_omitted_is_auto_recalculated_not_kept_from_stored_value(): void
    {
        Sanctum::actingAs($this->admin);

        // Seed with a specific stored round_off value
        $this->invoice->update(['round_off' => 0.45]);

        // Payload with round_off omitted, using rates that cause decimal amounts:
        // 1 item * 100.33 @ 18% GST -> Taxable: 100.33, CGST: 9.03, SGST: 9.03, Subtotal: 118.39
        // Auto round-off should be -0.39 to reach 118.00 (not the stored 0.45)
        $payload = $this->validPayload([
            'lines' => [
                [
                    'description' => 'Precision Item',
                    'qty' => 1,
                    'rate' => 100.33,
                    'gst_rate' => 18,
                    'hsn_sac' => '998222',
                ],
            ],
        ]);
        unset($payload['round_off']);

        $res = $this->putJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$this->invoice->id}", $payload);
        $res->assertStatus(200);

        $this->invoice->refresh();

        $this->assertEquals(-0.39, (float) $this->invoice->round_off);
        $this->assertEquals(118.0, (float) $this->invoice->grand_total);
    }
}
