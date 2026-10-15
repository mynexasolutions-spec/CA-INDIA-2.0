<?php

namespace Tests\Feature;

use App\Models\ClientGstReturn;
use App\Models\ClientProfile;
use App\Models\CommercialDocument;
use App\Models\Customer;
use App\Models\DocumentLineItem;
use App\Models\GstFilingRequest;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminBilling3BEndpointsTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private ClientProfile $client;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['role' => 'admin', 'name' => 'Admin User']);
        Sanctum::actingAs($this->admin);

        $clientUser = User::factory()->create(['role' => 'client', 'is_active' => true, 'name' => 'Test Legal Name']);
        $this->client = ClientProfile::create([
            'user_id' => $clientUser->id,
            'client_code' => 'CL-001',
            'business_name' => 'Acme Corporation',
            'client_name' => 'Test Legal Name',
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
    }

    public function test_404_on_invalid_doc_type_or_wrong_client(): void
    {
        // 1. Invalid docType
        $res = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/invalid_type");
        $res->assertStatus(404);

        // 2. Non-existent client
        $res2 = $this->getJson("/api/admin/billing/client-directory/99999/documents/tax_invoice");
        $res2->assertStatus(404);

        // 3. Document belonging to another client
        $otherClient = ClientProfile::create([
            'user_id' => User::factory()->create(['role' => 'client'])->id,
            'business_name' => 'Other Client',
            'has_gst' => true,
        ]);
        $otherDoc = CommercialDocument::create([
            'client_profile_id' => $otherClient->id,
            'type' => 'tax_invoice',
            'number' => 'INV-OTHER',
            'document_date' => '2026-05-10',
            'status' => 'issued',
        ]);

        $res3 = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$otherDoc->id}");
        $res3->assertStatus(404);

        // 4. Document of mismatched type (credit note accessed via tax_invoice URL)
        $cnDoc = CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'type' => 'credit_note',
            'number' => 'CN-001',
            'document_date' => '2026-05-10',
            'status' => 'issued',
        ]);
        $res4 = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$cnDoc->id}");
        $res4->assertStatus(404);
    }

    public function test_fy_param_validation(): void
    {
        $resInvalid = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice?fy=bad-format");
        $resInvalid->assertStatus(422)->assertJsonValidationErrors(['fy']);

        $resPast = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice?fy=2024-25");
        $resPast->assertStatus(422)->assertJsonValidationErrors(['fy']);

        $resWrongSuffix = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice?fy=2026-28");
        $resWrongSuffix->assertStatus(422)->assertJsonValidationErrors(['fy']);

        $resValid = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice?fy=2026-27");
        $resValid->assertStatus(200)
            ->assertJsonPath('fy', '2026-27')
            ->assertJsonPath('doc_type', 'tax_invoice');
    }

    public function test_drafts_are_never_shown_and_not_counted_in_cards(): void
    {
        // Create draft
        CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'type' => 'tax_invoice',
            'number' => 'DRAFT-INV-01',
            'document_date' => '2026-04-10',
            'status' => 'draft',
            'grand_total' => 5000,
        ]);

        // Create issued
        CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'type' => 'tax_invoice',
            'number' => 'INV-001',
            'document_date' => '2026-04-12',
            'status' => 'issued',
            'grand_total' => 1000,
        ]);

        $res = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice?fy=2026-27");
        $res->assertStatus(200);

        // Cards: total should be 1, not 2
        $res->assertJsonPath('cards.total', 1);
        $res->assertJsonPath('documents.total', 1);
        $res->assertJsonPath('documents.data.0.number', 'INV-001');
    }

    public function test_deleted_documents_shown_only_in_deleted_tab_or_status_deleted(): void
    {
        $doc = CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'type' => 'tax_invoice',
            'number' => 'INV-DEL',
            'document_date' => '2026-04-10',
            'status' => 'issued',
            'grand_total' => 2000,
        ]);

        $service = app(\App\Services\Billing\InvoiceService::class);
        $service->adminSoftDelete($doc, $this->admin->id);

        // Tab=all must NOT return deleted doc
        $resAll = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice?fy=2026-27&tab=all");
        $resAll->assertJsonPath('cards.total', 0);
        $resAll->assertJsonPath('cards.deleted', 1);
        $resAll->assertJsonPath('documents.total', 0);

        // Tab=deleted MUST return deleted doc
        $resDeletedTab = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice?fy=2026-27&tab=deleted");
        $resDeletedTab->assertJsonPath('documents.total', 1);
        $resDeletedTab->assertJsonPath('documents.data.0.number', 'INV-DEL');
        $resDeletedTab->assertJsonPath('documents.data.0.status', 'deleted');

        // status=deleted in all tab also switches to trashed
        $resStatusDeleted = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice?fy=2026-27&status=deleted");
        $resStatusDeleted->assertJsonPath('documents.total', 1);
        $resStatusDeleted->assertJsonPath('documents.data.0.number', 'INV-DEL');
    }

    public function test_cancelled_documents_shown_and_counted_in_all_and_b2b(): void
    {
        $b2bCustomer = Customer::create([
            'client_profile_id' => $this->client->id,
            'name' => 'B2B Client Corp',
            'gst_status' => 'registered',
            'gstin' => '27ABCDE9999F1Z1',
        ]);

        CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'customer_id' => $b2bCustomer->id,
            'type' => 'tax_invoice',
            'number' => 'INV-CANC',
            'document_date' => '2026-04-15',
            'status' => 'cancelled',
            'grand_total' => 4500,
        ]);

        // In cards: total=1, b2b=1, b2c=0, cancelled=1
        $res = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice?fy=2026-27&tab=all");
        $res->assertJsonPath('cards.total', 1);
        $res->assertJsonPath('cards.b2b', 1);
        $res->assertJsonPath('cards.b2c', 0);
        $res->assertJsonPath('cards.cancelled', 1);

        // Shows in All tab
        $res->assertJsonPath('documents.total', 1);
        $res->assertJsonPath('documents.data.0.number', 'INV-CANC');
        $res->assertJsonPath('documents.data.0.customer_type', 'B2B');

        // Shows in B2B tab
        $resB2b = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice?fy=2026-27&tab=b2b");
        $resB2b->assertJsonPath('documents.total', 1);

        // Shows in Cancelled tab
        $resCanc = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice?fy=2026-27&tab=cancelled");
        $resCanc->assertJsonPath('documents.total', 1);

        // Does NOT show in B2C tab
        $resB2c = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice?fy=2026-27&tab=b2c");
        $resB2c->assertJsonPath('documents.total', 0);
    }

    public function test_b2b_plus_b2c_equals_all_including_null_gst_status_and_no_customer(): void
    {
        // 1. B2B: registered + valid gstin
        $c1 = Customer::create([
            'client_profile_id' => $this->client->id,
            'name' => 'Cust 1 Registered',
            'gst_status' => 'registered',
            'gstin' => '27REG12345678Z1',
        ]);
        CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'customer_id' => $c1->id,
            'type' => 'tax_invoice',
            'number' => 'INV-B2B',
            'document_date' => '2026-04-10',
            'status' => 'issued',
        ]);

        // 2. B2C: unregistered
        $c2 = Customer::create([
            'client_profile_id' => $this->client->id,
            'name' => 'Cust 2 Unregistered',
            'gst_status' => 'unregistered',
            'gstin' => null,
        ]);
        CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'customer_id' => $c2->id,
            'type' => 'tax_invoice',
            'number' => 'INV-UNREG',
            'document_date' => '2026-04-11',
            'status' => 'issued',
        ]);

        // 3. B2C: empty gst_status or null status handling
        $this->assertFalse(\App\Services\Billing\AdminBillingCountService::isB2b(new Customer(['gst_status' => null, 'gstin' => null])));
        $c3 = Customer::create([
            'client_profile_id' => $this->client->id,
            'name' => 'Cust 3 Empty GST',
            'gst_status' => '',
            'gstin' => null,
        ]);
        CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'customer_id' => $c3->id,
            'type' => 'tax_invoice',
            'number' => 'INV-EMPTY-STATUS',
            'document_date' => '2026-04-12',
            'status' => 'issued',
        ]);

        // 4. B2C: registered but empty gstin
        $c4 = Customer::create([
            'client_profile_id' => $this->client->id,
            'name' => 'Cust 4 Empty GSTIN',
            'gst_status' => 'registered',
            'gstin' => '',
        ]);
        CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'customer_id' => $c4->id,
            'type' => 'tax_invoice',
            'number' => 'INV-EMPTY-GSTIN',
            'document_date' => '2026-04-13',
            'status' => 'issued',
        ]);

        // 5. B2C: No customer at all
        CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'customer_id' => null,
            'type' => 'tax_invoice',
            'number' => 'INV-NO-CUSTOMER',
            'document_date' => '2026-04-14',
            'status' => 'issued',
        ]);

        $res = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice?fy=2026-27&tab=all");
        $cards = $res->json('cards');

        // B2B = 1, B2C = 4, Total = 5
        $this->assertEquals(1, $cards['b2b']);
        $this->assertEquals(4, $cards['b2c']);
        $this->assertEquals(5, $cards['total']);
        $this->assertEquals($cards['total'], $cards['b2b'] + $cards['b2c']);

        // Check tabs counts
        $resB2b = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice?fy=2026-27&tab=b2b");
        $this->assertEquals(1, $resB2b->json('documents.total'));

        $resB2c = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice?fy=2026-27&tab=b2c");
        $this->assertEquals(4, $resB2c->json('documents.total'));
    }

    public function test_cards_unaffected_by_search_date_and_status_filters(): void
    {
        CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'type' => 'tax_invoice',
            'number' => 'INV-MATCH',
            'document_date' => '2026-05-10',
            'status' => 'issued',
        ]);
        CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'type' => 'tax_invoice',
            'number' => 'INV-OTHER',
            'document_date' => '2026-06-10',
            'status' => 'issued',
        ]);

        // Baseline cards
        $baseRes = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice?fy=2026-27");
        $baseCards = $baseRes->json('cards');
        $this->assertEquals(2, $baseCards['total']);

        // Filter by search
        $filteredRes = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice?fy=2026-27&q=MATCH");
        $this->assertEquals(1, $filteredRes->json('documents.total'));
        // Cards must remain 2
        $this->assertEquals($baseCards, $filteredRes->json('cards'));

        // Filter by date
        $dateRes = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice?fy=2026-27&invoice_date_from=2026-06-01");
        $this->assertEquals(1, $dateRes->json('documents.total'));
        $this->assertEquals($baseCards, $dateRes->json('cards'));
    }

    public function test_filtered_totals_across_pages_and_per_tab(): void
    {
        // 3 active documents (taxable 1000 each, total 1180 each)
        for ($i = 1; $i <= 3; $i++) {
            CommercialDocument::create([
                'client_profile_id' => $this->client->id,
                'type' => 'tax_invoice',
                'number' => "INV-00{$i}",
                'document_date' => '2026-05-10',
                'status' => 'issued',
                'taxable_amount' => 1000,
                'cgst_amount' => 90,
                'sgst_amount' => 90,
                'igst_amount' => 0,
                'grand_total' => 1180,
            ]);
        }

        // 1 cancelled document (taxable 5000, grand total 5900)
        CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'type' => 'tax_invoice',
            'number' => 'INV-CANC-TOTAL',
            'document_date' => '2026-05-12',
            'status' => 'cancelled',
            'taxable_amount' => 5000,
            'cgst_amount' => 450,
            'sgst_amount' => 450,
            'igst_amount' => 0,
            'grand_total' => 5900,
        ]);

        // 1 deleted document (taxable 2000, grand total 2360)
        $delDoc = CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'type' => 'tax_invoice',
            'number' => 'INV-DEL-TOTAL',
            'document_date' => '2026-05-15',
            'status' => 'issued',
            'taxable_amount' => 2000,
            'cgst_amount' => 180,
            'sgst_amount' => 180,
            'igst_amount' => 0,
            'grand_total' => 2360,
        ]);
        app(\App\Services\Billing\InvoiceService::class)->adminSoftDelete($delDoc, $this->admin->id);

        // 1. In tab=all with per_page=2:
        // Even though only page 1 (2 docs) is returned, filtered_totals must sum all 3 active docs (3000 taxable, 3540 total)
        // and MUST EXCLUDE the cancelled and deleted amounts!
        $resAll = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice?fy=2026-27&tab=all&per_page=2");
        $resAll->assertStatus(200);
        $totalsAll = $resAll->json('filtered_totals');
        $this->assertEquals(3000.0, $totalsAll['taxable']);
        $this->assertEquals(270.0, $totalsAll['cgst']);
        $this->assertEquals(270.0, $totalsAll['sgst']);
        $this->assertEquals(3540.0, $totalsAll['grand_total']);

        // 2. In tab=cancelled:
        // Filtered totals sums its own rows (5000 taxable, 5900 grand total)
        $resCanc = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice?fy=2026-27&tab=cancelled");
        $totalsCanc = $resCanc->json('filtered_totals');
        $this->assertEquals(5000.0, $totalsCanc['taxable']);
        $this->assertEquals(5900.0, $totalsCanc['grand_total']);

        // 3. In tab=deleted:
        // Filtered totals sums its own rows (2000 taxable, 2360 grand total)
        $resDel = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice?fy=2026-27&tab=deleted");
        $totalsDel = $resDel->json('filtered_totals');
        $this->assertEquals(2000.0, $totalsDel['taxable']);
        $this->assertEquals(2360.0, $totalsDel['grand_total']);
    }

    public function test_search_by_number_customer_and_gstin_with_wildcard_escaping(): void
    {
        $c = Customer::create([
            'client_profile_id' => $this->client->id,
            'name' => 'Special_Name%Client',
            'gst_status' => 'registered',
            'gstin' => '27_SPEC%1234F1Z1',
        ]);

        CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'customer_id' => $c->id,
            'type' => 'tax_invoice',
            'number' => 'INV_100%X',
            'document_date' => '2026-05-10',
            'status' => 'issued',
        ]);

        // Search document number with _ and % (query string percent-encoded)
        $q1 = http_build_query(['fy' => '2026-27', 'q' => 'INV_100%X']);
        $resNum = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice?{$q1}");
        $this->assertEquals(1, $resNum->json('documents.total'));

        // Search customer name with _ and %
        $q2 = http_build_query(['fy' => '2026-27', 'q' => 'Special_Name%Client']);
        $resCust = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice?{$q2}");
        $this->assertEquals(1, $resCust->json('documents.total'));

        // Search GSTIN with _ and %
        $q3 = http_build_query(['fy' => '2026-27', 'q' => '27_SPEC%1234F1Z1']);
        $resGstin = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice?{$q3}");
        $this->assertEquals(1, $resGstin->json('documents.total'));
    }

    public function test_date_ranges_and_fy_boundary_dates(): void
    {
        // 31 Mar 2026: prior FY 2025-26
        CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'type' => 'tax_invoice',
            'number' => 'INV-PRIOR',
            'document_date' => '2026-03-31',
            'status' => 'issued',
        ]);

        // 01 Apr 2026: first day of FY 2026-27
        CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'type' => 'tax_invoice',
            'number' => 'INV-APR1',
            'document_date' => '2026-04-01',
            'status' => 'issued',
        ]);

        // 31 Mar 2027: last day of FY 2026-27
        CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'type' => 'tax_invoice',
            'number' => 'INV-MAR31',
            'document_date' => '2027-03-31',
            'status' => 'issued',
        ]);

        // 01 Apr 2027: next FY 2027-28
        CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'type' => 'tax_invoice',
            'number' => 'INV-NEXT',
            'document_date' => '2027-04-01',
            'status' => 'issued',
        ]);

        $res = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice?fy=2026-27");
        $this->assertEquals(2, $res->json('documents.total'));
        $numbers = collect($res->json('documents.data'))->pluck('number')->all();
        $this->assertContains('INV-APR1', $numbers);
        $this->assertContains('INV-MAR31', $numbers);
        $this->assertNotContains('INV-PRIOR', $numbers);
        $this->assertNotContains('INV-NEXT', $numbers);

        // Additional date filter: invoice_date_from = 2026-04-02
        $resFilter = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice?fy=2026-27&invoice_date_from=2026-04-02");
        $this->assertEquals(1, $resFilter->json('documents.total'));
        $this->assertEquals('INV-MAR31', $resFilter->json('documents.data.0.number'));
    }

    public function test_creation_date_filter_uses_ist_day_boundaries(): void
    {
        // Document created on 31 Oct 2026 at 23:30 IST (18:00 UTC)
        $doc = CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'type' => 'tax_invoice',
            'number' => 'INV-OCT31',
            'document_date' => '2026-10-31',
            'status' => 'issued',
        ]);
        $doc->created_at = Carbon::parse('2026-10-31 23:30:00', 'Asia/Kolkata')->utc();
        $doc->saveQuietly();

        // Query filtering creation_date_from = 2026-10-31 and creation_date_to = 2026-10-31
        $res = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice?fy=2026-27&creation_date_from=2026-10-31&creation_date_to=2026-10-31");
        $this->assertEquals(1, $res->json('documents.total'));
        $this->assertEquals('INV-OCT31', $res->json('documents.data.0.number'));

        // Query filtering creation_date_from = 2026-11-01 -> should NOT match
        $resNext = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice?fy=2026-27&creation_date_from=2026-11-01");
        $this->assertEquals(0, $resNext->json('documents.total'));
    }

    public function test_view_response_shape_regular_client_gst_status_and_action_flags(): void
    {
        $doc = CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'type' => 'tax_invoice',
            'number' => 'INV-VIEW-01',
            'document_date' => '2026-04-10',
            'status' => 'issued',
            'place_of_supply' => 'Maharashtra (27)',
            'is_inter_state' => false,
            'taxable_amount' => 1000,
            'cgst_amount' => 90,
            'sgst_amount' => 90,
            'grand_total' => 1180,
            'amount_in_words' => 'Rupees One Thousand One Hundred Eighty Only.',
        ]);
        $doc->created_at = Carbon::parse('2026-04-15 10:00:00');
        $doc->saveQuietly();

        DocumentLineItem::create([
            'commercial_document_id' => $doc->id,
            'description' => 'Accounting Services',
            'hsn_sac' => '998222',
            'qty' => 1,
            'unit' => 'NOS',
            'rate' => 1000,
            'gst_rate' => 18,
            'taxable_amount' => 1000,
        ]);

        // 1. Initial state: Not Filed
        $res1 = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$doc->id}");
        $res1->assertStatus(200);
        $res1->assertJsonPath('document.payment_status', 'Unpaid');
        $res1->assertJsonPath('gst.status', 'Not Filed');
        $res1->assertJsonPath('flags.can_cancel', true);
        $res1->assertJsonPath('flags.can_delete', true);
        $res1->assertJsonPath('flags.can_edit_creation_date', true);
        $res1->assertJsonMissing(['can_edit']); // can_edit not exposed

        // 2. Mark GSTR3B as filed only -> must NOT lock
        ClientGstReturn::create([
            'client_profile_id' => $this->client->id,
            'return_type' => 'GSTR3B',
            'tax_period' => '2026-04',
            'status' => 'filed',
            'filed_on' => '2026-05-20',
            'ack_no' => 'ARN-3B',
        ]);

        $res2 = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$doc->id}");
        $this->assertEquals('Not Filed', $res2->json('gst.status'));
        $this->assertTrue($res2->json('flags.can_cancel'));

        // 3. Mark GSTR1 as filed -> locks
        ClientGstReturn::create([
            'client_profile_id' => $this->client->id,
            'return_type' => 'GSTR1',
            'tax_period' => '2026-04',
            'status' => 'filed',
            'filed_on' => '2026-05-11',
            'ack_no' => 'ARN-GSTR1',
        ]);

        $res3 = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$doc->id}");
        $this->assertEquals('Filed', $res3->json('gst.status'));
        $this->assertEquals('ARN-GSTR1', $res3->json('gst.ack_no'));
        $this->assertFalse($res3->json('flags.can_cancel'));
        $this->assertFalse($res3->json('flags.can_delete'));
        $this->assertFalse($res3->json('flags.can_edit_creation_date'));
    }

    public function test_view_composition_client_cmp08_locks(): void
    {
        $compClient = ClientProfile::create([
            'user_id' => User::factory()->create(['role' => 'client'])->id,
            'business_name' => 'Composition Trader',
            'has_gst' => true,
            'dealer_type' => 'composition',
        ]);

        $doc = CommercialDocument::create([
            'client_profile_id' => $compClient->id,
            'type' => 'bill_of_supply',
            'number' => 'BOS-001',
            'document_date' => '2026-05-10',
            'status' => 'issued',
        ]);
        $doc->created_at = Carbon::parse('2026-05-15 10:00:00');
        $doc->saveQuietly();

        // Initially not filed
        $res1 = $this->getJson("/api/admin/billing/client-directory/{$compClient->id}/documents/bill_of_supply/{$doc->id}");
        $this->assertEquals('Not Filed', $res1->json('gst.status'));
        $this->assertTrue($res1->json('flags.can_cancel'));

        // File CMP08 for Q1
        ClientGstReturn::create([
            'client_profile_id' => $compClient->id,
            'return_type' => 'CMP08',
            'tax_period' => '2026-Q1',
            'status' => 'filed',
            'filed_on' => '2026-07-18',
            'ack_no' => 'ARN-CMP-Q1',
        ]);

        $res2 = $this->getJson("/api/admin/billing/client-directory/{$compClient->id}/documents/bill_of_supply/{$doc->id}");
        $this->assertEquals('Filed', $res2->json('gst.status'));
        $this->assertFalse($res2->json('flags.can_cancel'));
    }

    public function test_view_gst_off_client_never_locks_and_shows_dash(): void
    {
        $gstOffClient = ClientProfile::create([
            'user_id' => User::factory()->create(['role' => 'client'])->id,
            'business_name' => 'GST OFF Merchant',
            'has_gst' => false,
        ]);

        $doc = CommercialDocument::create([
            'client_profile_id' => $gstOffClient->id,
            'type' => 'tax_invoice',
            'number' => 'BILL-001',
            'document_date' => '2026-05-10',
            'status' => 'issued',
        ]);

        $res = $this->getJson("/api/admin/billing/client-directory/{$gstOffClient->id}/documents/tax_invoice/{$doc->id}");
        $this->assertEquals('-', $res->json('gst.status'));
        $this->assertTrue($res->json('flags.can_cancel'));
        $this->assertTrue($res->json('flags.can_delete'));
        $this->assertTrue($res->json('flags.can_edit_creation_date'));
    }

    public function test_cancel_endpoint(): void
    {
        $doc = CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'type' => 'tax_invoice',
            'number' => 'INV-CANCEL-TEST',
            'document_date' => '2026-04-10',
            'status' => 'issued',
        ]);
        $doc->created_at = Carbon::parse('2026-04-15 10:00:00');
        $doc->saveQuietly();

        // 1. Reason too long (> 200) -> 422
        $resLong = $this->postJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$doc->id}/cancel", [
            'reason' => str_repeat('a', 201),
        ]);
        $resLong->assertStatus(422)->assertJsonValidationErrors(['reason']);

        // 2. Successful cancellation with reason <= 200
        $resSuccess = $this->postJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$doc->id}/cancel", [
            'reason' => 'Customer requested order cancellation.',
        ]);
        $resSuccess->assertStatus(200);

        $refreshed = $doc->fresh();
        $this->assertEquals('cancelled', $refreshed->status);
        $this->assertEquals('Customer requested order cancellation.', $refreshed->cancellation_reason);
        $this->assertEquals($this->admin->id, $refreshed->cancelled_by);
        $this->assertNotNull($refreshed->cancelled_at);

        // 3. Attempt to cancel already cancelled document -> 422
        $resAlready = $this->postJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$doc->id}/cancel", [
            'reason' => 'Again',
        ]);
        $resAlready->assertStatus(422);

        // 4. Attempt to cancel when GST is filed -> 422
        $doc2 = CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'type' => 'tax_invoice',
            'number' => 'INV-CANCEL-LOCKED',
            'document_date' => '2026-04-10',
            'status' => 'issued',
        ]);
        $doc2->created_at = Carbon::parse('2026-04-15 10:00:00');
        $doc2->saveQuietly();

        ClientGstReturn::create([
            'client_profile_id' => $this->client->id,
            'return_type' => 'GSTR1',
            'tax_period' => '2026-04',
            'status' => 'filed',
            'filed_on' => '2026-05-11',
            'ack_no' => 'ARN-1',
        ]);

        $resLocked = $this->postJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$doc2->id}/cancel");
        $resLocked->assertStatus(422);
    }

    public function test_delete_endpoint(): void
    {
        // 1. Delete active invoice -> 200 soft delete
        $activeDoc = CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'type' => 'tax_invoice',
            'number' => 'INV-DEL-1',
            'document_date' => '2026-04-10',
            'status' => 'issued',
        ]);
        $resActive = $this->deleteJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$activeDoc->id}");
        $resActive->assertStatus(200);
        $this->assertEquals('deleted', $activeDoc->fresh()->status);
        $this->assertNotNull($activeDoc->fresh()->deleted_at);

        // 2. Delete already deleted document -> 422
        $resAlready = $this->deleteJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$activeDoc->id}");
        $resAlready->assertStatus(422);

        // 3. Delete cancelled invoice -> allowed
        $cancelledDoc = CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'type' => 'tax_invoice',
            'number' => 'INV-DEL-CANC',
            'document_date' => '2026-04-10',
            'status' => 'cancelled',
        ]);
        $resCanc = $this->deleteJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$cancelledDoc->id}");
        $resCanc->assertStatus(200);
        $this->assertEquals('deleted', $cancelledDoc->fresh()->status);

        // 4. Delete blocked when referenced by another document
        $parent = CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'type' => 'tax_invoice',
            'number' => 'INV-DEL-PARENT',
            'document_date' => '2026-04-10',
            'status' => 'issued',
        ]);
        CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'type' => 'credit_note',
            'number' => 'CN-REF-1',
            'document_date' => '2026-04-11',
            'status' => 'issued',
            'reference_document_id' => $parent->id,
        ]);
        $resRef = $this->deleteJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$parent->id}");
        $resRef->assertStatus(422);

        // 5. Delete blocked when GST is filed
        $docFiled = CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'type' => 'tax_invoice',
            'number' => 'INV-DEL-FILED',
            'document_date' => '2026-04-10',
            'status' => 'issued',
        ]);
        $docFiled->created_at = Carbon::parse('2026-04-15 10:00:00');
        $docFiled->saveQuietly();

        ClientGstReturn::create([
            'client_profile_id' => $this->client->id,
            'return_type' => 'GSTR1',
            'tax_period' => '2026-04',
            'status' => 'filed',
            'filed_on' => '2026-05-11',
            'ack_no' => 'ARN-GSTR1-DEL',
        ]);

        $resFiled = $this->deleteJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$docFiled->id}");
        $resFiled->assertStatus(422);
    }

    public function test_creation_date_patch_endpoint(): void
    {
        // Create document on 15 Apr 2026 at 23:30:45 IST
        $doc = CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'type' => 'tax_invoice',
            'number' => 'INV-CREATION-DATE',
            'document_date' => '2026-04-10',
            'status' => 'issued',
        ]);
        $doc->created_at = Carbon::parse('2026-04-15 23:30:45', 'Asia/Kolkata')->utc();
        $doc->saveQuietly();

        // 1. Future date in IST -> 422
        $futureDate = Carbon::now('Asia/Kolkata')->addDays(5)->format('Y-m-d');
        $resFuture = $this->patchJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$doc->id}/creation-date", [
            'new_creation_date' => $futureDate,
            'fy' => '2026-27',
        ]);
        $resFuture->assertStatus(422);

        // 2. Outside FY (e.g. 2026-03-31) -> 422
        $resOutside = $this->patchJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$doc->id}/creation-date", [
            'new_creation_date' => '2026-03-31',
            'fy' => '2026-27',
        ]);
        $resOutside->assertStatus(422);

        // 3. Target period already filed -> 422
        // Mark May 2026 as filed
        ClientGstReturn::create([
            'client_profile_id' => $this->client->id,
            'return_type' => 'GSTR1',
            'tax_period' => '2026-05',
            'status' => 'filed',
            'filed_on' => '2026-06-11',
            'ack_no' => 'ARN-MAY',
        ]);

        $resTargetFiled = $this->patchJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$doc->id}/creation-date", [
            'new_creation_date' => '2026-05-10',
            'fy' => '2026-27',
        ]);
        $resTargetFiled->assertStatus(422);

        // 4. Current period filed -> 422
        ClientGstReturn::create([
            'client_profile_id' => $this->client->id,
            'return_type' => 'GSTR1',
            'tax_period' => '2026-04',
            'status' => 'filed',
            'filed_on' => '2026-05-11',
            'ack_no' => 'ARN-APR',
        ]);

        $resCurrentFiled = $this->patchJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$doc->id}/creation-date", [
            'new_creation_date' => '2026-04-20',
            'fy' => '2026-27',
        ]);
        $resCurrentFiled->assertStatus(422);

        // 5. Successful patch: doc2 in unfiled period (e.g. 2026-06)
        $doc2 = CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'type' => 'tax_invoice',
            'number' => 'INV-SUCCESS-CD',
            'document_date' => '2026-06-15',
            'status' => 'issued',
        ]);
        $doc2->created_at = Carbon::parse('2026-06-15 23:30:45', 'Asia/Kolkata')->utc();
        $doc2->saveQuietly();

        // Target date earlier than document_date is allowed (Decision 7): 2026-06-05
        $resOk = $this->patchJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$doc2->id}/creation-date", [
            'new_creation_date' => '2026-06-05',
            'fy' => '2026-27',
        ]);
        $resOk->assertStatus(200);

        // Verify date updated and time-of-day in IST preserved (23:30:45)
        $refreshed = $doc2->fresh();
        $refreshedIst = $refreshed->created_at->timezone('Asia/Kolkata');
        $this->assertEquals('2026-06-05', $refreshedIst->format('Y-m-d'));
        $this->assertEquals('23:30:45', $refreshedIst->format('H:i:s'));
    }

    public function test_per_page_cap_at_100(): void
    {
        $res = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice?fy=2026-27&per_page=500");
        $res->assertStatus(200);
        $this->assertEquals(100, $res->json('documents.per_page'));

        $resZero = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice?fy=2026-27&per_page=0");
        $resZero->assertStatus(200);
        $this->assertEquals(1, $resZero->json('documents.per_page'));
    }

    public function test_show_and_pdf_work_for_deleted_document_and_flags_are_all_false(): void
    {
        Storage::fake('public');

        $doc = CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'type' => 'tax_invoice',
            'number' => 'INV-TRASHED-01',
            'document_date' => '2026-05-10',
            'status' => 'issued',
            'taxable_amount' => 1000,
            'grand_total' => 1180,
            'amount_in_words' => 'Rupees One Thousand One Hundred Eighty Only.',
        ]);

        DocumentLineItem::create([
            'commercial_document_id' => $doc->id,
            'description' => 'Item Trash',
            'hsn_sac' => '998311',
            'qty' => 1,
            'unit' => 'NOS',
            'rate' => 1000,
            'gst_rate' => 18,
            'taxable_amount' => 1000,
        ]);

        app(\App\Services\Billing\InvoiceService::class)->adminSoftDelete($doc, $this->admin->id);

        $this->assertTrue($doc->fresh()->trashed());

        // 1. show works for deleted document and all flags are false
        $resShow = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$doc->id}");
        $resShow->assertStatus(200);
        $resShow->assertJsonPath('document.id', $doc->id);
        $resShow->assertJsonPath('document.status', 'deleted');
        $resShow->assertJsonPath('document.payment_status', null);
        $resShow->assertJsonPath('flags.can_edit_creation_date', false);
        $resShow->assertJsonPath('flags.can_cancel', false);
        $resShow->assertJsonPath('flags.can_delete', false);
        $this->assertStringContainsString('Rupees One Thousand One Hundred Eighty Only.', $resShow->json('summary.amount_in_words'));

        // 2. pdf works for deleted document and returns application/pdf stream
        $resPdf = $this->get("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$doc->id}/pdf");
        $resPdf->assertStatus(200);
        $resPdf->assertHeader('content-type', 'application/pdf');
    }

    public function test_cancelled_documents_flags_can_delete_true_and_others_false(): void
    {
        $doc = CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'type' => 'tax_invoice',
            'number' => 'INV-CANC-FLAGS',
            'document_date' => '2026-05-10',
            'status' => 'cancelled',
            'cancellation_reason' => 'Wrong invoice details',
        ]);
        $doc->created_at = Carbon::parse('2026-05-10 10:00:00');
        $doc->saveQuietly();

        // 1. Unlocked cancelled document: can_edit_creation_date: false, can_cancel: false, can_delete: true, payment_status: null
        $res = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$doc->id}");
        $res->assertStatus(200);
        $res->assertJsonPath('document.payment_status', null);
        $res->assertJsonPath('flags.can_edit_creation_date', false);
        $res->assertJsonPath('flags.can_cancel', false);
        $res->assertJsonPath('flags.can_delete', true);

        // 2. When period is filed: can_delete becomes false
        ClientGstReturn::create([
            'client_profile_id' => $this->client->id,
            'return_type' => 'GSTR1',
            'tax_period' => '2026-05',
            'status' => 'filed',
            'filed_on' => '2026-06-11',
            'ack_no' => 'ARN-CANC-MAY',
        ]);

        $resFiled = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$doc->id}");
        $resFiled->assertStatus(200);
        $resFiled->assertJsonPath('flags.can_delete', false);
    }

    public function test_pdf_endpoint_streams_application_pdf_for_own_document_and_404_for_another_clients(): void
    {
        Storage::fake('public');

        $doc = CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'type' => 'tax_invoice',
            'number' => 'INV-PDF-01',
            'document_date' => '2026-05-10',
            'status' => 'issued',
            'taxable_amount' => 1000,
            'grand_total' => 1180,
        ]);

        DocumentLineItem::create([
            'commercial_document_id' => $doc->id,
            'description' => 'PDF Item',
            'hsn_sac' => '998311',
            'qty' => 1,
            'unit' => 'NOS',
            'rate' => 1000,
            'gst_rate' => 18,
            'taxable_amount' => 1000,
        ]);

        // 1. Direct or JSON request streams application/pdf file directly
        $resFile = $this->get("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$doc->id}/pdf");
        $resFile->assertStatus(200);
        $resFile->assertHeader('content-type', 'application/pdf');

        $resJsonHeader = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$doc->id}/pdf");
        $resJsonHeader->assertStatus(200);
        $resJsonHeader->assertHeader('content-type', 'application/pdf');

        // 2. Other client's doc -> 404
        $otherClient = ClientProfile::create([
            'user_id' => User::factory()->create(['role' => 'client'])->id,
            'business_name' => 'Foreign Corp',
            'has_gst' => true,
        ]);
        $otherDoc = CommercialDocument::create([
            'client_profile_id' => $otherClient->id,
            'type' => 'tax_invoice',
            'number' => 'INV-FOREIGN',
            'document_date' => '2026-05-10',
            'status' => 'issued',
        ]);

        $resOther = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$otherDoc->id}/pdf");
        $resOther->assertStatus(404);
    }

    public function test_show_response_returns_tooltip_flags(): void
    {
        $doc = CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'type' => 'tax_invoice',
            'number' => 'INV-FLAGS-01',
            'document_date' => '2026-05-10',
            'status' => 'issued',
        ]);
        $doc->created_at = Carbon::parse('2026-05-10 10:00:00');
        $doc->saveQuietly();

        // 1. Initial state
        $res1 = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$doc->id}");
        $res1->assertStatus(200);
        $res1->assertJsonPath('flags.is_referenced', false);
        $res1->assertJsonPath('flags.referencing_document', null);
        $res1->assertJsonPath('flags.is_attached', false);
        $res1->assertJsonPath('flags.can_edit', true);
        $res1->assertJsonPath('flags.can_delete', true);

        // 2. Add referencing debit note
        $dn = CommercialDocument::create([
            'client_profile_id' => $this->client->id,
            'type' => 'debit_note',
            'number' => 'DN-FLAGS-01',
            'document_date' => '2026-05-12',
            'status' => 'issued',
            'reference_document_id' => $doc->id,
        ]);

        $res2 = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$doc->id}");
        $res2->assertStatus(200);
        $res2->assertJsonPath('flags.is_referenced', true);
        $res2->assertJsonPath('flags.referencing_document.id', $dn->id);
        $res2->assertJsonPath('flags.referencing_document.type', 'debit_note');
        $res2->assertJsonPath('flags.referencing_document.number', 'DN-FLAGS-01');
        $res2->assertJsonPath('flags.can_delete', false);
        $res2->assertJsonPath('flags.can_edit', false);

        // Remove referencing doc
        $dn->delete(); // hard delete for test or remove reference
        $dn->update(['reference_document_id' => null]);

        // 3. Attach to filing request document
        $requestId = DB::table('gst_filing_requests')->insertGetId([
            'client_profile_id' => $this->client->id,
            'financial_year' => '2026-27',
            'filing_period' => 'May 2026',
            'return_type' => 'GSTR1',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('gst_filing_request_document')->insert([
            'gst_filing_request_id' => $requestId,
            'commercial_document_id' => $doc->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $res3 = $this->getJson("/api/admin/billing/client-directory/{$this->client->id}/documents/tax_invoice/{$doc->id}");
        $res3->assertStatus(200);
        $res3->assertJsonPath('flags.is_referenced', false);
        $res3->assertJsonPath('flags.is_attached', true);
        $res3->assertJsonPath('flags.can_delete', false);
        $res3->assertJsonPath('flags.can_edit', false);
    }
}

