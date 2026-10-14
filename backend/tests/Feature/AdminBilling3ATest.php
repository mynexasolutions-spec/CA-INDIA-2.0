<?php

namespace Tests\Feature;

use App\Models\ClientProfile;
use App\Models\CommercialDocument;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminBilling3ATest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($this->admin);
    }

    private function createClient(array $attributes = [], bool $isActive = true): ClientProfile
    {
        $user = User::factory()->create(['role' => 'client', 'is_active' => $isActive]);

        return ClientProfile::create(array_merge([
            'user_id' => $user->id,
            'business_name' => 'Test Business',
            'has_gst' => true,
        ], $attributes));
    }

    public function test_fy_date_boundaries_include_april_1st_and_march_31st(): void
    {
        $client = $this->createClient(['business_name' => 'Boundary Client']);

        // Prior to FY 2026-27
        CommercialDocument::create([
            'client_profile_id' => $client->id,
            'type' => 'tax_invoice',
            'number' => 'INV-BEFORE',
            'document_date' => '2026-03-31',
            'status' => 'issued',
        ]);

        // First day of FY 2026-27
        CommercialDocument::create([
            'client_profile_id' => $client->id,
            'type' => 'tax_invoice',
            'number' => 'INV-FIRST',
            'document_date' => '2026-04-01',
            'status' => 'issued',
        ]);

        // Last day of FY 2026-27
        $last = CommercialDocument::create([
            'client_profile_id' => $client->id,
            'type' => 'tax_invoice',
            'number' => 'INV-LAST',
            'document_date' => '2027-03-31',
            'status' => 'issued',
        ]);
        DB::table('commercial_documents')->where('id', $last->id)->update(['document_date' => '2027-03-31']);

        // After FY 2026-27
        CommercialDocument::create([
            'client_profile_id' => $client->id,
            'type' => 'tax_invoice',
            'number' => 'INV-AFTER',
            'document_date' => '2027-04-01',
            'status' => 'issued',
        ]);

        $response = $this->getJson('/api/admin/billing/client-directory?fy=2026-27')
            ->assertOk();

        // Exactly 2 documents in FY 2026-27
        $this->assertSame(2, $response->json('cards.tax_invoice'));
    }

    public function test_status_inclusion_and_exclusion(): void
    {
        $client = $this->createClient(['business_name' => 'Status Client']);

        $statuses = [
            'draft' => false,
            'deleted' => false,
            'issued' => true,
            'paid' => true,
            'partial' => true,
            'cancelled' => true,
        ];

        $i = 1;
        foreach ($statuses as $st => $shouldCount) {
            CommercialDocument::create([
                'client_profile_id' => $client->id,
                'type' => 'bill_of_supply',
                'number' => "BOS-{$i}",
                'document_date' => '2026-06-15',
                'status' => $st,
            ]);
            $i++;
        }

        $response = $this->getJson('/api/admin/billing/client-directory?fy=2026-27')
            ->assertOk();

        // 4 included statuses (issued, paid, partial, cancelled)
        $this->assertSame(4, $response->json('cards.bill_of_supply'));
    }

    public function test_inactive_client_documents_counted_in_global_cards(): void
    {
        $client = $this->createClient(['business_name' => 'Inactive Corp'], false);

        CommercialDocument::create([
            'client_profile_id' => $client->id,
            'type' => 'debit_note',
            'number' => 'DN-001',
            'document_date' => '2026-05-10',
            'status' => 'issued',
        ]);

        $response = $this->getJson('/api/admin/billing/client-directory?fy=2026-27')
            ->assertOk();

        $this->assertSame(1, $response->json('cards.debit_note'));
    }

    public function test_client_list_cards_are_global_and_unaffected_by_filters(): void
    {
        $c1 = $this->createClient([
            'business_name' => 'Alpha Industries',
            'constitution_type' => 'Proprietorship',
        ], true);

        $c2 = $this->createClient([
            'business_name' => 'Beta Trading',
            'constitution_type' => 'LLP',
        ], false);

        CommercialDocument::create([
            'client_profile_id' => $c1->id,
            'type' => 'credit_note',
            'number' => 'CN-1',
            'document_date' => '2026-07-01',
            'status' => 'issued',
        ]);

        CommercialDocument::create([
            'client_profile_id' => $c2->id,
            'type' => 'credit_note',
            'number' => 'CN-2',
            'document_date' => '2026-07-02',
            'status' => 'issued',
        ]);

        // Filter by constitution_type = Proprietorship
        $response = $this->getJson('/api/admin/billing/client-directory?fy=2026-27&constitution_type=Proprietorship')
            ->assertOk();

        // Table only has 1 client
        $this->assertCount(1, $response->json('clients.data'));
        // But global cards still show both credit notes (2)
        $this->assertSame(2, $response->json('cards.credit_note'));
    }

    public function test_constitution_alias_filter(): void
    {
        $this->createClient([
            'business_name' => 'Firm A',
            'constitution_type' => 'Partnership Firm',
        ]);

        $this->createClient([
            'business_name' => 'Firm B',
            'constitution_type' => 'Partnership',
        ]);

        $this->createClient([
            'business_name' => 'Company C',
            'constitution_type' => 'Private Limited Company',
        ]);

        $this->createClient([
            'business_name' => 'Company D',
            'constitution_type' => 'Private Limited',
        ]);

        $this->createClient([
            'business_name' => 'Solo E',
            'constitution_type' => 'Proprietorship',
        ]);

        // Filtering by 'Partnership Firm' should match both 'Partnership Firm' and 'Partnership'
        $resPartnership = $this->getJson('/api/admin/billing/client-directory?fy=2026-27&constitution_type=Partnership Firm')
            ->assertOk();
        $this->assertCount(2, $resPartnership->json('clients.data'));

        // Filtering by 'Private Limited Company' should match both
        $resPvtLtd = $this->getJson('/api/admin/billing/client-directory?fy=2026-27&constitution_type=Private Limited Company')
            ->assertOk();
        $this->assertCount(2, $resPvtLtd->json('clients.data'));
    }

    public function test_registration_type_regular_includes_qrmp(): void
    {
        $this->createClient([
            'business_name' => 'Regular Client',
            'has_gst' => true,
            'registration_type' => 'Regular',
            'dealer_type' => 'regular',
        ]);

        $this->createClient([
            'business_name' => 'QRMP Client',
            'has_gst' => true,
            'registration_type' => 'Regular',
            'dealer_type' => 'regular',
            'gst_filing_frequency' => 'quarterly',
        ]);

        $this->createClient([
            'business_name' => 'Comp Client',
            'has_gst' => true,
            'registration_type' => 'Composition',
            'dealer_type' => 'composition',
        ]);

        $res = $this->getJson('/api/admin/billing/client-directory?fy=2026-27&registration_type=Regular')
            ->assertOk();

        $this->assertCount(2, $res->json('clients.data'));
    }

    public function test_registration_type_composition_filter(): void
    {
        $this->createClient([
            'business_name' => 'Regular Client',
            'has_gst' => true,
            'registration_type' => 'Regular',
        ]);

        $this->createClient([
            'business_name' => 'Comp Client',
            'has_gst' => true,
            'registration_type' => 'Composition',
        ]);

        $res = $this->getJson('/api/admin/billing/client-directory?fy=2026-27&registration_type=Composition')
            ->assertOk();

        $this->assertCount(1, $res->json('clients.data'));
        $this->assertSame('Comp Client', $res->json('clients.data.0.business_name'));
    }

    public function test_gst_off_client_returns_null_and_search_excludes_stored_gstin(): void
    {
        $client = $this->createClient([
            'business_name' => 'GST OFF Store',
            'has_gst' => false,
            'gstin' => '27ABCDE1234F1Z5',
            'registration_type' => 'Regular',
        ]);

        $res = $this->getJson('/api/admin/billing/client-directory?fy=2026-27')
            ->assertOk();

        $row = collect($res->json('clients.data'))->firstWhere('id', $client->id);
        $this->assertNotNull($row);
        $this->assertNull($row['gstin']);
        $this->assertNull($row['registration_type']);
        $this->assertFalse($row['has_gst']);

        // Search by the stored GSTIN must yield 0 results
        $searchRes = $this->getJson('/api/admin/billing/client-directory?fy=2026-27&q=27ABCDE1234F1Z5')
            ->assertOk();
        $this->assertCount(0, $searchRes->json('clients.data'));
    }

    public function test_gst_on_client_with_null_registration_type_keeps_gstin_no_error(): void
    {
        $client = $this->createClient([
            'business_name' => 'GST ON Null Reg Type',
            'has_gst' => true,
            'gstin' => '27AABCT1234A1Z9',
            'registration_type' => null,
            'dealer_type' => null,
        ]);

        $res = $this->getJson('/api/admin/billing/client-directory?fy=2026-27')
            ->assertOk();

        $row = collect($res->json('clients.data'))->firstWhere('id', $client->id);
        $this->assertNotNull($row);
        $this->assertSame('27AABCT1234A1Z9', $row['gstin']);
        $this->assertNull($row['registration_type']);
        $this->assertTrue($row['has_gst']);
    }

    public function test_registration_type_filter_requires_has_gst_true(): void
    {
        // GST-OFF client with leftover registration_type = Regular
        $this->createClient([
            'business_name' => 'Off Client with Stored Reg',
            'has_gst' => false,
            'registration_type' => 'Regular',
        ]);

        // GST-ON client
        $this->createClient([
            'business_name' => 'Real Regular',
            'has_gst' => true,
            'registration_type' => 'Regular',
        ]);

        $res = $this->getJson('/api/admin/billing/client-directory?fy=2026-27&registration_type=Regular')
            ->assertOk();

        $this->assertCount(1, $res->json('clients.data'));
        $this->assertSame('Real Regular', $res->json('clients.data.0.business_name'));
    }

    public function test_client_status_active_and_inactive_filters(): void
    {
        $activeClient = $this->createClient([
            'business_name' => 'Active Client',
        ], true);

        $inactiveClient = $this->createClient([
            'business_name' => 'Inactive Client',
        ], false);

        // Active filter
        $activeRes = $this->getJson('/api/admin/billing/client-directory?fy=2026-27&status=Active')
            ->assertOk();
        $this->assertCount(1, $activeRes->json('clients.data'));
        $this->assertSame('Active Client', $activeRes->json('clients.data.0.business_name'));

        // Inactive filter
        $inactiveRes = $this->getJson('/api/admin/billing/client-directory?fy=2026-27&status=Inactive')
            ->assertOk();
        $this->assertCount(1, $inactiveRes->json('clients.data'));
        $this->assertSame('Inactive Client', $inactiveRes->json('clients.data.0.business_name'));
    }

    public function test_search_by_code_pan_name_and_escapes_like_wildcards(): void
    {
        $this->createClient([
            'business_name' => 'Test_Name 100%',
            'client_code' => 'CL%01',
            'pan' => 'ABCDE1234F',
        ]);

        $this->createClient([
            'business_name' => 'TestXName other',
            'client_code' => 'CL901',
            'pan' => 'ZZZZZ9999Z',
        ]);

        // Search specifically for 'Test_' - should NOT match 'TestX'
        $res = $this->getJson('/api/admin/billing/client-directory?fy=2026-27&q=Test_')
            ->assertOk();
        $this->assertCount(1, $res->json('clients.data'));
        $this->assertSame('Test_Name 100%', $res->json('clients.data.0.business_name'));

        // Search for '100%'
        $res2 = $this->getJson('/api/admin/billing/client-directory?fy=2026-27&q=100%')
            ->assertOk();
        $this->assertCount(1, $res2->json('clients.data'));

        // Search for 'CL%'
        $res3 = $this->getJson('/api/admin/billing/client-directory?fy=2026-27&q=CL%')
            ->assertOk();
        $this->assertCount(1, $res3->json('clients.data'));
    }

    public function test_per_page_cap(): void
    {
        for ($i = 1; $i <= 5; $i++) {
            $this->createClient(['business_name' => "Client {$i}"]);
        }

        $res = $this->getJson('/api/admin/billing/client-directory?fy=2026-27&per_page=999')
            ->assertOk();

        $this->assertSame(100, $res->json('clients.per_page'));
    }

    public function test_default_per_page_is_10(): void
    {
        for ($i = 1; $i <= 15; $i++) {
            $this->createClient(['business_name' => "Client {$i}"]);
        }

        $res = $this->getJson('/api/admin/billing/client-directory?fy=2026-27')
            ->assertOk();

        $this->assertSame(10, $res->json('clients.per_page'));
    }

    public function test_invalid_fy_returns_422(): void
    {
        // 2025-26 is earlier than min FY (2026-27)
        $this->getJson('/api/admin/billing/client-directory?fy=2025-26')
            ->assertStatus(422)
            ->assertJsonValidationErrors(['fy']);

        // Inconsistent range
        $this->getJson('/api/admin/billing/client-directory?fy=2026-28')
            ->assertStatus(422)
            ->assertJsonValidationErrors(['fy']);

        // Malformed string
        $this->getJson('/api/admin/billing/client-directory?fy=abc')
            ->assertStatus(422)
            ->assertJsonValidationErrors(['fy']);
    }

    public function test_missing_fy_defaults_to_current_fy_in_asia_kolkata(): void
    {
        $res = $this->getJson('/api/admin/billing/client-directory')
            ->assertOk();

        $this->assertSame('2026-27', $res->json('fy'));
        $this->assertSame('2026-04-01', $res->json('from'));
        $this->assertSame('2027-03-31', $res->json('to'));
    }

    public function test_client_dashboard_returns_404_for_missing_client(): void
    {
        $this->getJson('/api/admin/billing/client-directory/999999/dashboard?fy=2026-27')
            ->assertNotFound();
    }

    public function test_client_dashboard_monthly_shape_spans_all_12_months(): void
    {
        $client = $this->createClient([
            'business_name' => 'Monthly Trend Client',
        ]);

        $res = $this->getJson("/api/admin/billing/client-directory/{$client->id}/dashboard?fy=2026-27")
            ->assertOk();

        $monthly = $res->json('monthly_trend');
        $this->assertCount(12, $monthly);
        $this->assertSame('2026-04', $monthly[0]['month']);
        $this->assertSame('Apr', $monthly[0]['short_month']);
        $this->assertSame('2027-03', $monthly[11]['month']);
        $this->assertSame('Mar', $monthly[11]['short_month']);
    }

    public function test_dashboard_total_equals_sum_of_six_types_and_donut_center(): void
    {
        $client = $this->createClient([
            'business_name' => 'Sum Client',
        ]);

        CommercialDocument::create([
            'client_profile_id' => $client->id,
            'type' => 'tax_invoice',
            'number' => 'TI-1',
            'document_date' => '2026-04-10',
            'status' => 'issued',
        ]);

        CommercialDocument::create([
            'client_profile_id' => $client->id,
            'type' => 'bill_of_supply',
            'number' => 'BOS-1',
            'document_date' => '2026-05-10',
            'status' => 'issued',
        ]);

        CommercialDocument::create([
            'client_profile_id' => $client->id,
            'type' => 'quotation',
            'number' => 'QT-1',
            'document_date' => '2026-06-10',
            'status' => 'issued',
        ]);

        $res = $this->getJson("/api/admin/billing/client-directory/{$client->id}/dashboard?fy=2026-27")
            ->assertOk();

        $cards = $res->json('cards');
        $expectedTotal = $cards['tax_invoice'] + $cards['bill_of_supply'] + $cards['debit_note'] +
            $cards['credit_note'] + $cards['quotation'] + $cards['delivery_challan'];

        $this->assertSame(3, $cards['total']);
        $this->assertSame($expectedTotal, $cards['total']);

        // Donut items sum to the same total
        $donutTotal = collect($res->json('donut'))->sum('count');
        $this->assertSame($cards['total'], $donutTotal);
    }

    public function test_address_join_has_no_stray_dashes(): void
    {
        // Client with state only, no pincode
        $c1 = $this->createClient([
            'business_name' => 'State Only',
            'address_line_1' => 'Plot 10',
            'city' => 'Pune',
            'state' => 'Maharashtra',
            'pincode' => null,
        ]);

        $res1 = $this->getJson("/api/admin/billing/client-directory/{$c1->id}/dashboard?fy=2026-27")
            ->assertOk();
        $this->assertSame('Plot 10, Pune, Maharashtra', $res1->json('client.address'));
        $this->assertStringNotContainsString('-', $res1->json('client.address'));

        // Client with pincode only, no state
        $c2 = $this->createClient([
            'business_name' => 'Pin Only',
            'address_line_1' => 'Plot 20',
            'city' => 'Thane',
            'state' => null,
            'pincode' => '400601',
        ]);

        $res2 = $this->getJson("/api/admin/billing/client-directory/{$c2->id}/dashboard?fy=2026-27")
            ->assertOk();
        $this->assertSame('Plot 20, Thane, 400601', $res2->json('client.address'));
        $this->assertStringNotContainsString('-', $res2->json('client.address'));

        // Client with both state and pincode
        $c3 = $this->createClient([
            'business_name' => 'Both',
            'address_line_1' => 'Flat 1',
            'city' => 'Mumbai',
            'state' => 'Maharashtra',
            'pincode' => '400001',
        ]);

        $res3 = $this->getJson("/api/admin/billing/client-directory/{$c3->id}/dashboard?fy=2026-27")
            ->assertOk();
        $this->assertSame('Flat 1, Mumbai, Maharashtra - 400001', $res3->json('client.address'));
    }

    public function test_converted_quotations_count_as_cancelled(): void
    {
        $client = $this->createClient([
            'business_name' => 'Quotation Client',
        ]);

        $invoice = CommercialDocument::create([
            'client_profile_id' => $client->id,
            'type' => 'tax_invoice',
            'number' => 'INV-CONV',
            'document_date' => '2026-05-01',
            'status' => 'issued',
        ]);

        CommercialDocument::create([
            'client_profile_id' => $client->id,
            'type' => 'quotation',
            'number' => 'QT-CONVERTED',
            'document_date' => '2026-05-01',
            'status' => 'cancelled',
            'converted_document_id' => $invoice->id,
        ]);

        $res = $this->getJson("/api/admin/billing/client-directory/{$client->id}/dashboard?fy=2026-27")
            ->assertOk();

        $this->assertSame(1, $res->json('cards.quotation'));
    }

    public function test_exact_six_keys_in_global_cards_and_dashboard(): void
    {
        $client = $this->createClient(['business_name' => 'Six Keys Client']);

        $res = $this->getJson('/api/admin/billing/client-directory?fy=2026-27')
            ->assertOk();

        $expectedSixKeys = [
            'tax_invoice',
            'bill_of_supply',
            'debit_note',
            'credit_note',
            'quotation',
            'delivery_challan',
        ];

        $globalCardKeys = array_keys($res->json('cards'));
        $this->assertSame($expectedSixKeys, $globalCardKeys);

        $dashRes = $this->getJson("/api/admin/billing/client-directory/{$client->id}/dashboard?fy=2026-27")
            ->assertOk();

        $dashCardKeys = array_keys($dashRes->json('cards'));
        $expectedDashKeys = array_merge($expectedSixKeys, ['total']);
        sort($dashCardKeys);
        sort($expectedDashKeys);
        $this->assertSame($expectedDashKeys, $dashCardKeys);

        $donutTypes = collect($dashRes->json('donut'))->pluck('type')->all();
        $this->assertSame($expectedSixKeys, $donutTypes);
    }

    public function test_search_by_client_code_pan_and_gstin_gst_off_isolation(): void
    {
        $gstOn = $this->createClient([
            'client_code' => 'CL-777',
            'business_name' => 'Solar Energy Corp',
            'client_name' => 'Vikram Sarabhai',
            'pan' => 'AAACS1234D',
            'gstin' => '27AAACS1234D1ZP',
            'has_gst' => true,
        ]);

        $gstOff = $this->createClient([
            'client_code' => 'CL-888',
            'business_name' => 'Lunar Books',
            'client_name' => 'Homi Bhabha',
            'pan' => 'BBBCB5678E',
            'gstin' => '27BBBCB5678E1ZQ', // Stored in DB but has_gst is false
            'has_gst' => false,
        ]);

        // 1. Search by client code
        $resCode = $this->getJson('/api/admin/billing/client-directory?fy=2026-27&q=CL-777')->assertOk();
        $this->assertCount(1, $resCode->json('clients.data'));
        $this->assertSame($gstOn->id, $resCode->json('clients.data.0.id'));

        // 2. Search by PAN
        $resPan = $this->getJson('/api/admin/billing/client-directory?fy=2026-27&q=BBBCB5678E')->assertOk();
        $this->assertCount(1, $resPan->json('clients.data'));
        $this->assertSame($gstOff->id, $resPan->json('clients.data.0.id'));

        // 3. Search by GSTIN for GST-ON client
        $resGstin = $this->getJson('/api/admin/billing/client-directory?fy=2026-27&q=27AAACS1234D1ZP')->assertOk();
        $this->assertCount(1, $resGstin->json('clients.data'));
        $this->assertSame($gstOn->id, $resGstin->json('clients.data.0.id'));

        // 4. Search by GSTIN for GST-OFF client returns NO match
        $resGstinOff = $this->getJson('/api/admin/billing/client-directory?fy=2026-27&q=27BBBCB5678E1ZQ')->assertOk();
        $this->assertCount(0, $resGstinOff->json('clients.data'));
    }

    public function test_seeded_status_deleted_is_excluded_from_counts(): void
    {
        $client = $this->createClient(['business_name' => 'Deleted Seed Client']);

        CommercialDocument::create([
            'client_profile_id' => $client->id,
            'type' => 'delivery_challan',
            'number' => 'DC-DEL',
            'document_date' => '2026-06-01',
            'status' => 'deleted',
        ]);

        CommercialDocument::create([
            'client_profile_id' => $client->id,
            'type' => 'delivery_challan',
            'number' => 'DC-ACT',
            'document_date' => '2026-06-02',
            'status' => 'issued',
        ]);

        $res = $this->getJson('/api/admin/billing/client-directory?fy=2026-27')->assertOk();
        $this->assertSame(1, $res->json('cards.delivery_challan'));
    }

    public function test_default_sort_is_client_code_ascending(): void
    {
        $this->createClient(['client_code' => 'CL-099', 'business_name' => 'Zeta Corp']);
        $this->createClient(['client_code' => 'CL-001', 'business_name' => 'Alpha Corp']);
        $this->createClient(['client_code' => 'CL-050', 'business_name' => 'Beta Corp']);

        $res = $this->getJson('/api/admin/billing/client-directory?fy=2026-27')->assertOk();
        $codes = collect($res->json('clients.data'))->pluck('client_code')->all();

        $this->assertSame(['CL-001', 'CL-050', 'CL-099'], $codes);
    }

    public function test_final_response_contract_and_metadata(): void
    {
        $client = $this->createClient([
            'client_code' => 'CL-100',
            'business_name' => 'Contract Corp',
            'client_name' => 'Legal Entity Ltd',
            'pan' => 'AAACX1234F',
            'constitution_type' => 'Partnership Firm',
            'registration_type' => 'Regular',
            'has_gst' => true,
            'gstin' => '27AAACX1234F1Z8',
            'address_line_1' => 'Plot 5',
            'city' => 'Pune',
            'state' => 'Maharashtra',
            'pincode' => '411001',
        ]);

        $res = $this->getJson('/api/admin/billing/client-directory?fy=2026-27')->assertOk();

        // 1. Response wrapper keys: Keep only fy, from, to, cards, filter_options, clients
        $wrapperKeys = array_keys($res->json());
        sort($wrapperKeys);
        $expectedWrapperKeys = ['cards', 'clients', 'filter_options', 'from', 'fy', 'to'];
        $this->assertSame($expectedWrapperKeys, $wrapperKeys);

        // Verify removed keys: filters, data, alias_mapping
        $this->assertArrayNotHasKey('filters', $res->json());
        $this->assertArrayNotHasKey('data', $res->json());
        $this->assertArrayNotHasKey('alias_mapping', $res->json());

        // Verify clients paginator structure
        $this->assertArrayHasKey('current_page', $res->json('clients'));
        $this->assertArrayHasKey('data', $res->json('clients'));
        $this->assertArrayHasKey('per_page', $res->json('clients'));
        $this->assertArrayHasKey('total', $res->json('clients'));
        $this->assertArrayHasKey('last_page', $res->json('clients'));
        $this->assertArrayHasKey('from', $res->json('clients'));
        $this->assertArrayHasKey('to', $res->json('clients'));

        // 2. Client list row fields
        $row = $res->json('clients.data.0');
        $expectedFields = [
            'id', 'client_code', 'business_name', 'client_name', 'gstin', 'pan',
            'constitution_type', 'registration_type', 'is_active', 'mobile', 'email',
            'address', 'has_gst',
        ];
        $actualFields = array_keys($row);
        sort($expectedFields);
        sort($actualFields);
        $this->assertSame($expectedFields, $actualFields);

        // Explicitly verify removed row fields
        foreach (['name', 'user', 'user_id', 'dealer_type', 'status'] as $removed) {
            $this->assertArrayNotHasKey($removed, $row, "Row should not contain {$removed}");
        }

        // 3. Filter options shapes
        $this->assertIsArray($res->json('filter_options.constitution_types'));
        $this->assertIsArray($res->json('filter_options.registration_types'));
        $this->assertIsArray($res->json('filter_options.statuses'));

        // 4. Dashboard cards total & dropped total_documents
        $dashRes = $this->getJson("/api/admin/billing/client-directory/{$client->id}/dashboard?fy=2026-27")
            ->assertOk();
        $this->assertArrayHasKey('total', $dashRes->json('cards'));
        $this->assertArrayNotHasKey('total_documents', $dashRes->json('cards'));

        // Dashboard client object exact fields
        $dashClient = $dashRes->json('client');
        $actualDashFields = array_keys($dashClient);
        sort($actualDashFields);
        $this->assertSame($expectedFields, $actualDashFields);
    }

    public function test_legacy_billing_clients_endpoint_remains_untouched(): void
    {
        $user = User::factory()->create([
            'role' => 'client',
            'is_active' => true,
            'email' => 'legacy@example.com',
        ]);

        $client = ClientProfile::create([
            'user_id' => $user->id,
            'client_code' => 'CL-LEGACY',
            'business_name' => 'Legacy Firm',
            'client_name' => 'Legacy Owner',
            'gstin' => '27LEGAC1234F1Z1',
            'has_gst' => true,
            'dealer_type' => 'regular',
        ]);

        $res = $this->getJson('/api/admin/billing/clients')->assertOk();

        // 1. Root-level data array from standard Laravel paginator
        $this->assertArrayHasKey('data', $res->json());
        $this->assertArrayHasKey('current_page', $res->json());
        $this->assertArrayHasKey('per_page', $res->json());
        $this->assertSame(50, $res->json('per_page'));

        // 2. Contains the created client with legacy shape (user.email, user.is_active, dealer_type, user_id)
        $row = collect($res->json('data'))->firstWhere('id', $client->id);
        $this->assertNotNull($row, 'Legacy row should be present');
        $this->assertSame('CL-LEGACY', $row['client_code']);
        $this->assertSame('Legacy Firm', $row['business_name']);
        $this->assertSame('legacy@example.com', $row['user']['email']);
        $this->assertTrue($row['user']['is_active']);
        $this->assertSame('regular', $row['dealer_type']);
        $this->assertSame($user->id, $row['user_id']);
    }
}
