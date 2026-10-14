<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\Admin\ClientsUnlockController;
use App\Models\ActivityLog;
use App\Models\ClientGstReturn;
use App\Models\ClientProfile;
use App\Models\CommercialDocument;
use App\Models\Customer;
use App\Models\DocumentEditRequest;
use App\Models\DocumentLineItem;
use App\Models\GstFilingRequest;
use App\Models\User;
use App\Services\Billing\AdminBillingLockService;
use App\Services\Billing\BillingPolicy;
use App\Services\Billing\InvoiceService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class AdminBilling3BMigrationAndModelTest extends TestCase
{
    use RefreshDatabase;

    private ClientProfile $profile;
    private User $admin;
    private InvoiceService $invoiceService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['role' => 'admin']);
        $user = User::factory()->create(['role' => 'client']);
        $this->profile = ClientProfile::create([
            'user_id' => $user->id,
            'business_name' => 'Acme Test Corp',
            'has_gst' => true,
            'dealer_type' => 'regular',
            'gstin' => '27ABCDE1234F1Z5',
        ]);
        $this->invoiceService = app(InvoiceService::class);
    }

    private function unlockAdmin(): void
    {
        Sanctum::actingAs($this->admin);
        Cache::put(
            ClientsUnlockController::cacheKey($this->admin->id),
            now()->toIso8601String(),
            now()->addHours(1)
        );
    }

    public function test_soft_deletes_trait_hides_trashed_records_from_standard_query(): void
    {
        $doc1 = CommercialDocument::create([
            'client_profile_id' => $this->profile->id,
            'type' => 'tax_invoice',
            'number' => 'INV-001',
            'document_date' => '2026-04-10',
            'status' => 'issued',
        ]);

        $doc2 = CommercialDocument::create([
            'client_profile_id' => $this->profile->id,
            'type' => 'tax_invoice',
            'number' => 'INV-002',
            'document_date' => '2026-04-11',
            'status' => 'issued',
        ]);

        $doc2->delete();

        $all = CommercialDocument::where('client_profile_id', $this->profile->id)->get();
        $this->assertCount(1, $all);
        $this->assertEquals('INV-001', $all->first()->number);

        $trashed = CommercialDocument::onlyTrashed()->where('client_profile_id', $this->profile->id)->get();
        $this->assertCount(1, $trashed);
        $this->assertEquals('INV-002', $trashed->first()->number);
        $this->assertNotNull($trashed->first()->deleted_at);
    }

    public function test_legacy_admin_delete_still_hard_deletes_completely(): void
    {
        $doc = CommercialDocument::create([
            'client_profile_id' => $this->profile->id,
            'type' => 'tax_invoice',
            'number' => 'INV-LEGACY',
            'document_date' => '2026-04-10',
            'status' => 'issued',
        ]);

        DocumentLineItem::create([
            'commercial_document_id' => $doc->id,
            'description' => 'Item 1',
            'qty' => 1,
            'rate' => 100,
            'taxable_amount' => 100,
            'total_amount' => 118,
        ]);

        // Legacy delete call
        $this->invoiceService->adminDelete($doc);

        // Record must be completely gone from DB (not even in withTrashed)
        $this->assertNull(CommercialDocument::withTrashed()->find($doc->id));
        $this->assertEquals(0, DocumentLineItem::where('commercial_document_id', $doc->id)->count());
    }

    public function test_admin_soft_delete_sets_status_deleted_and_retains_line_items_and_writes_activity_log(): void
    {
        $doc = CommercialDocument::create([
            'client_profile_id' => $this->profile->id,
            'type' => 'tax_invoice',
            'number' => 'INV-SOFT',
            'document_date' => '2026-04-10',
            'status' => 'issued',
            'grand_total' => 1180,
        ]);

        $item = DocumentLineItem::create([
            'commercial_document_id' => $doc->id,
            'description' => 'Item Soft',
            'qty' => 1,
            'rate' => 1000,
            'taxable_amount' => 1000,
            'total_amount' => 1180,
        ]);

        $this->invoiceService->adminSoftDelete($doc, $this->admin->id, '127.0.0.1');

        // Document is soft-deleted
        $found = CommercialDocument::withTrashed()->find($doc->id);
        $this->assertNotNull($found);
        $this->assertNotNull($found->deleted_at);
        $this->assertEquals('deleted', $found->status);

        // Line items are NOT purged yet (retained for retention period)
        $this->assertEquals(1, DocumentLineItem::where('commercial_document_id', $doc->id)->count());

        // Activity log is written
        $log = ActivityLog::where('action', 'deleted_document')->where('subject_id', $doc->id)->first();
        $this->assertNotNull($log);
        $this->assertEquals($this->admin->id, $log->user_id);
        $this->assertEquals('INV-SOFT', $log->properties['number']);
    }

    public function test_admin_soft_delete_blocked_when_gst_is_filed(): void
    {
        $doc = CommercialDocument::create([
            'client_profile_id' => $this->profile->id,
            'type' => 'tax_invoice',
            'number' => 'INV-FILED',
            'document_date' => '2026-04-10',
            'status' => 'issued',
        ]);
        $doc->created_at = Carbon::parse('2026-04-15 10:00:00');
        $doc->saveQuietly();

        ClientGstReturn::create([
            'client_profile_id' => $this->profile->id,
            'return_type' => 'GSTR1',
            'tax_period' => '2026-04',
            'status' => 'filed',
            'filed_on' => '2026-05-11',
            'ack_no' => 'ARN12345',
        ]);

        $this->expectException(HttpException::class);
        $this->expectExceptionMessage('GST Return for this document\'s period has already been filed.');

        $this->invoiceService->adminSoftDelete($doc, $this->admin->id);
    }

    public function test_admin_soft_delete_blocked_when_referenced_by_another_document(): void
    {
        $parent = CommercialDocument::create([
            'client_profile_id' => $this->profile->id,
            'type' => 'tax_invoice',
            'number' => 'INV-PARENT',
            'document_date' => '2026-04-10',
            'status' => 'issued',
        ]);

        $child = CommercialDocument::create([
            'client_profile_id' => $this->profile->id,
            'type' => 'credit_note',
            'number' => 'CN-001',
            'document_date' => '2026-04-11',
            'status' => 'issued',
            'reference_document_id' => $parent->id,
        ]);

        try {
            $this->invoiceService->adminSoftDelete($parent, $this->admin->id);
            $this->fail('Expected HttpException 422 was not thrown.');
        } catch (HttpException $e) {
            $this->assertEquals(422, $e->getStatusCode());
            $this->assertStringContainsString('This document has a Credit Note, Debit Note, or Amendment issued against it', $e->getMessage());
        }

        $fresh = $parent->fresh();
        $this->assertEquals('issued', $fresh->status);
        $this->assertNull($fresh->deleted_at);
    }

    public function test_admin_soft_delete_blocked_when_attached_to_gst_filing_request(): void
    {
        $doc = CommercialDocument::create([
            'client_profile_id' => $this->profile->id,
            'type' => 'tax_invoice',
            'number' => 'INV-ATTACHED',
            'document_date' => '2026-04-10',
            'status' => 'issued',
        ]);

        $filingReq = GstFilingRequest::create([
            'client_profile_id' => $this->profile->id,
            'financial_year' => '2026-2027',
            'filing_period' => '2026-04',
            'return_type' => 'GSTR1',
            'status' => 'submitted',
        ]);

        DB::table('gst_filing_request_document')->insert([
            'gst_filing_request_id' => $filingReq->id,
            'commercial_document_id' => $doc->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        try {
            $this->invoiceService->adminSoftDelete($doc, $this->admin->id);
            $this->fail('Expected HttpException 422 was not thrown.');
        } catch (HttpException $e) {
            $this->assertEquals(422, $e->getStatusCode());
            $this->assertStringContainsString('This document is attached to a GST Filing Request and cannot be deleted.', $e->getMessage());
        }

        $fresh = $doc->fresh();
        $this->assertEquals('issued', $fresh->status);
        $this->assertNull($fresh->deleted_at);
    }

    public function test_deleted_document_number_can_be_reused_without_unique_constraint_violation(): void
    {
        $doc = CommercialDocument::create([
            'client_profile_id' => $this->profile->id,
            'type' => 'tax_invoice',
            'number' => 'INV-REUSE',
            'document_date' => '2026-04-10',
            'status' => 'issued',
        ]);

        $this->invoiceService->adminSoftDelete($doc, $this->admin->id);

        // assertUniqueNumber should not throw on the deleted number
        BillingPolicy::assertUniqueNumber($this->profile, 'INV-REUSE');

        // Creating a new document with the exact same number must succeed without SQL 23000 error
        $newDoc = CommercialDocument::create([
            'client_profile_id' => $this->profile->id,
            'type' => 'tax_invoice',
            'number' => 'INV-REUSE',
            'document_date' => '2026-04-15',
            'status' => 'issued',
        ]);

        $this->assertNotNull($newDoc->id);
        $this->assertEquals('INV-REUSE', $newDoc->number);
    }

    public function test_cancelled_document_number_cannot_be_reused(): void
    {
        CommercialDocument::create([
            'client_profile_id' => $this->profile->id,
            'type' => 'tax_invoice',
            'number' => 'INV-CANCELLED',
            'document_date' => '2026-04-10',
            'status' => 'cancelled',
        ]);

        $this->expectException(HttpException::class);
        $this->expectExceptionMessage('Invoice number already exists for this client.');

        BillingPolicy::assertUniqueNumber($this->profile, 'INV-CANCELLED');
    }

    public function test_allocate_next_number_recheck_aborts_422_if_non_deleted_number_already_exists(): void
    {
        CommercialDocument::create([
            'client_profile_id' => $this->profile->id,
            'type' => 'tax_invoice',
            'number' => 'INV-001',
            'document_date' => '2026-04-10',
            'status' => 'issued',
        ]);

        $this->profile->update([
            'tax_invoice_next_number' => 1,
            'document_numbering_settings' => [
                'invoice' => [
                    'prefix' => 'INV',
                    'separator' => '-',
                    'prefix_position' => 'prefix',
                    'next_number' => '001',
                    'numbering_type' => 'auto',
                    'status' => true,
                ],
            ],
        ]);

        DB::beginTransaction();
        try {
            $this->expectException(HttpException::class);
            $this->expectExceptionMessage('Invoice number already exists for this client.');

            $this->invoiceService->allocateNextNumber($this->profile, 'tax_invoice');
        } finally {
            DB::rollBack();
        }
    }

    public function test_purge_command_removes_eligible_records_relative_to_previous_month(): void
    {
        Storage::fake('public');

        // Create document deleted on 15 Apr 2026
        $doc = CommercialDocument::create([
            'client_profile_id' => $this->profile->id,
            'type' => 'tax_invoice',
            'number' => 'INV-PURGE-1',
            'document_date' => '2026-04-10',
            'status' => 'deleted',
            'pdf_path' => 'invoices/test_purge.pdf',
        ]);
        $doc->deleted_at = Carbon::parse('2026-04-15 12:00:00');
        $doc->saveQuietly();

        Storage::disk('public')->put('invoices/test_purge.pdf', 'dummy pdf content');

        DocumentLineItem::create([
            'commercial_document_id' => $doc->id,
            'description' => 'Item to purge',
            'qty' => 1,
            'rate' => 100,
            'taxable_amount' => 100,
            'total_amount' => 118,
        ]);

        DocumentEditRequest::create([
            'commercial_document_id' => $doc->id,
            'client_profile_id' => $this->profile->id,
            'document_type' => 'tax_invoice',
            'bill_number' => 'INV-PURGE-1',
            'reason' => 'Rate error',
            'status' => 'pending',
        ]);

        // Test 1: On 31 May 2026 (cutoff is 2026-04-01 00:00:00) -> 15 Apr is NOT < 1 Apr -> NOT purged
        Carbon::setTestNow(Carbon::parse('2026-05-31 23:59:59'));
        Artisan::call('billing:purge-trashed-documents');

        $this->assertNotNull(CommercialDocument::withTrashed()->find($doc->id));
        $this->assertEquals(1, DocumentLineItem::where('commercial_document_id', $doc->id)->count());
        $this->assertTrue(Storage::disk('public')->exists('invoices/test_purge.pdf'));

        // Test 2: On 1 Jun 2026 (cutoff is 2026-05-01 00:00:00) -> 15 Apr IS < 1 May -> PURGED
        Carbon::setTestNow(Carbon::parse('2026-06-01 00:00:01'));
        Artisan::call('billing:purge-trashed-documents');

        $this->assertNull(CommercialDocument::withTrashed()->find($doc->id));
        $this->assertEquals(0, DocumentLineItem::where('commercial_document_id', $doc->id)->count());
        $this->assertEquals(0, DocumentEditRequest::where('commercial_document_id', $doc->id)->count());
        $this->assertFalse(Storage::disk('public')->exists('invoices/test_purge.pdf'));

        Carbon::setTestNow(null);
    }

    public function test_admin_billing_lock_service_timezone_ist_oct_31_23_30(): void
    {
        // 31 Oct 23:30 IST is 31 Oct 18:00 UTC
        $createdAtUtc = Carbon::create(2026, 10, 31, 18, 0, 0, 'UTC');

        // Mark 2026-10 filed for GSTR1
        ClientGstReturn::create([
            'client_profile_id' => $this->profile->id,
            'return_type' => 'GSTR1',
            'tax_period' => '2026-10',
            'status' => 'filed',
            'filed_on' => '2026-11-10',
            'ack_no' => 'ARN-OCT',
        ]);

        $res = AdminBillingLockService::check($this->profile, $createdAtUtc);

        $this->assertTrue($res['is_locked']);
        $this->assertEquals('Filed', $res['gst_status']);
        $this->assertEquals('2026-10', $res['tax_period']);
        $this->assertEquals('ARN-OCT', $res['ack_no']);
    }

    public function test_admin_billing_lock_service_regular_locks_on_gstr1_and_not_on_gstr3b_only(): void
    {
        $createdAt = Carbon::parse('2026-05-15 10:00:00');

        // Seed GSTR-3B filed only
        ClientGstReturn::create([
            'client_profile_id' => $this->profile->id,
            'return_type' => 'GSTR3B',
            'tax_period' => '2026-05',
            'status' => 'filed',
            'filed_on' => '2026-06-20',
            'ack_no' => 'ARN-3B-ONLY',
        ]);

        $res = AdminBillingLockService::check($this->profile, $createdAt);
        $this->assertFalse($res['is_locked']);
        $this->assertEquals('Not Filed', $res['gst_status']);

        // Now seed GSTR-1 filed
        ClientGstReturn::create([
            'client_profile_id' => $this->profile->id,
            'return_type' => 'GSTR1',
            'tax_period' => '2026-05',
            'status' => 'filed',
            'filed_on' => '2026-06-11',
            'ack_no' => 'ARN-GSTR1',
        ]);

        $res2 = AdminBillingLockService::check($this->profile, $createdAt);
        $this->assertTrue($res2['is_locked']);
        $this->assertEquals('Filed', $res2['gst_status']);
        $this->assertEquals('ARN-GSTR1', $res2['ack_no']);
    }

    public function test_admin_billing_lock_service_qrmp_locks_on_gstr1_monthly(): void
    {
        $qrmpClient = ClientProfile::create([
            'user_id' => User::factory()->create(['role' => 'client'])->id,
            'business_name' => 'QRMP Dealer',
            'has_gst' => true,
            'dealer_type' => 'regular',
            'gst_filing_frequency' => 'quarterly',
            'gstr1_filing_frequency' => 'monthly',
        ]);

        // Invoice created in April
        $createdAt = Carbon::parse('2026-04-20 10:00:00');

        ClientGstReturn::create([
            'client_profile_id' => $qrmpClient->id,
            'return_type' => 'GSTR1',
            'tax_period' => '2026-04',
            'status' => 'filed',
            'filed_on' => '2026-05-13',
            'ack_no' => 'ARN-QRMP-M1',
        ]);

        $res = AdminBillingLockService::check($qrmpClient, $createdAt);
        $this->assertTrue($res['is_locked']);
        $this->assertEquals('Filed', $res['gst_status']);
        $this->assertEquals('2026-04', $res['tax_period']);
    }

    public function test_admin_billing_lock_service_composition_locks_on_cmp08_fy_quarters(): void
    {
        $compClient = ClientProfile::create([
            'user_id' => User::factory()->create(['role' => 'client'])->id,
            'business_name' => 'Composition Dealer',
            'has_gst' => true,
            'dealer_type' => 'composition',
        ]);

        // Boundary tests for FY quarters:
        // 31 Mar 2026 -> 2026-Q4
        $this->assertEquals('2026-Q4', AdminBillingLockService::formatFyQuarter(Carbon::parse('2026-03-31')));
        // 01 Apr 2026 -> 2026-Q1
        $this->assertEquals('2026-Q1', AdminBillingLockService::formatFyQuarter(Carbon::parse('2026-04-01')));
        // 30 Jun 2026 -> 2026-Q1
        $this->assertEquals('2026-Q1', AdminBillingLockService::formatFyQuarter(Carbon::parse('2026-06-30')));
        // 01 Jul 2026 -> 2026-Q2
        $this->assertEquals('2026-Q2', AdminBillingLockService::formatFyQuarter(Carbon::parse('2026-07-01')));
        // 30 Sep 2026 -> 2026-Q2
        $this->assertEquals('2026-Q2', AdminBillingLockService::formatFyQuarter(Carbon::parse('2026-09-30')));
        // 01 Oct 2026 -> 2026-Q3
        $this->assertEquals('2026-Q3', AdminBillingLockService::formatFyQuarter(Carbon::parse('2026-10-01')));
        // 31 Dec 2026 -> 2026-Q3
        $this->assertEquals('2026-Q3', AdminBillingLockService::formatFyQuarter(Carbon::parse('2026-12-31')));
        // 01 Jan 2027 -> 2027-Q4
        $this->assertEquals('2027-Q4', AdminBillingLockService::formatFyQuarter(Carbon::parse('2027-01-01')));
        // 31 Mar 2027 -> 2027-Q4
        $this->assertEquals('2027-Q4', AdminBillingLockService::formatFyQuarter(Carbon::parse('2027-03-31')));

        // Mark 2026-Q1 filed for CMP08
        ClientGstReturn::create([
            'client_profile_id' => $compClient->id,
            'return_type' => 'CMP08',
            'tax_period' => '2026-Q1',
            'status' => 'filed',
            'filed_on' => '2026-07-18',
            'ack_no' => 'ARN-CMP-Q1',
        ]);

        $resQ1 = AdminBillingLockService::check($compClient, Carbon::parse('2026-05-15'));
        $this->assertTrue($resQ1['is_locked']);
        $this->assertEquals('Filed', $resQ1['gst_status']);
        $this->assertEquals('2026-Q1', $resQ1['tax_period']);

        // Q2 is not filed
        $resQ2 = AdminBillingLockService::check($compClient, Carbon::parse('2026-07-15'));
        $this->assertFalse($resQ2['is_locked']);
        $this->assertEquals('Not Filed', $resQ2['gst_status']);
    }

    public function test_admin_billing_lock_service_gst_off_never_locks_and_shows_dash(): void
    {
        $gstOffClient = ClientProfile::create([
            'user_id' => User::factory()->create(['role' => 'client'])->id,
            'business_name' => 'GST OFF Dealer',
            'has_gst' => false,
        ]);

        $res = AdminBillingLockService::check($gstOffClient, Carbon::parse('2026-05-15'));
        $this->assertFalse($res['is_locked']);
        $this->assertEquals('-', $res['gst_status']);
    }

    public function test_tab5_put_client_allows_soft_deleted_number_as_next_number_with_gap_confirmation(): void
    {
        $this->unlockAdmin();

        // 1. Highest issued document is INV-02
        CommercialDocument::create([
            'client_profile_id' => $this->profile->id,
            'type' => 'tax_invoice',
            'number' => 'INV-02',
            'document_date' => '2026-04-10',
            'status' => 'issued',
            'taxable_amount' => 1000,
            'total_amount' => 1180,
        ]);

        // 2. INV-01 is created and soft-deleted
        $softDoc = CommercialDocument::create([
            'client_profile_id' => $this->profile->id,
            'type' => 'tax_invoice',
            'number' => 'INV-01',
            'document_date' => '2026-04-05',
            'status' => 'issued',
            'taxable_amount' => 500,
            'total_amount' => 590,
        ]);
        $this->invoiceService->adminSoftDelete($softDoc, $this->admin->id);

        $basePayload = [
            'client_name' => 'Acme Test Corp',
            'business_name' => 'Acme Test Corp',
            'email' => 'client@acme.test',
            'login_prefix' => 'acmetest',
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
        ];

        // Without confirm_gap, setting next_number to 01 when highest issued is 02 triggers 409
        $res409 = $this->putJson("/api/admin/clients/{$this->profile->id}", $basePayload);
        $res409->assertStatus(409)
            ->assertJsonPath('requires_confirmation', true)
            ->assertJsonPath('highest_issued', 2);

        // With confirm_gap => true, soft-deleted INV-01 does not trigger exact-duplicate 422, succeeds with 200
        $res200 = $this->putJson(
            "/api/admin/clients/{$this->profile->id}",
            array_merge($basePayload, ['confirm_gap' => true])
        );
        $res200->assertStatus(200);

        $refreshed = $this->profile->fresh();
        $this->assertEquals('01', $refreshed->document_numbering_settings['invoice']['next_number']);
    }

    public function test_tab5_put_client_rejects_cancelled_number_as_next_number_with_422(): void
    {
        $this->unlockAdmin();

        // Cancelled document (deleted_at is null)
        CommercialDocument::create([
            'client_profile_id' => $this->profile->id,
            'type' => 'tax_invoice',
            'number' => 'INV-03',
            'document_date' => '2026-04-10',
            'status' => 'cancelled',
            'taxable_amount' => 1000,
            'total_amount' => 1180,
        ]);

        $payload = [
            'client_name' => 'Acme Test Corp',
            'business_name' => 'Acme Test Corp',
            'email' => 'client@acme.test',
            'login_prefix' => 'acmetest',
            'confirm_gap' => true,
            'document_numbering_settings' => [
                'invoice' => [
                    'prefix' => 'INV',
                    'separator' => '-',
                    'next_number' => '03',
                    'prefix_position' => 'first',
                    'numbering_type' => 'auto',
                    'status' => true,
                ],
            ],
        ];

        $response = $this->putJson("/api/admin/clients/{$this->profile->id}", $payload);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['document_numbering_settings.invoice.next_number']);
    }
}
