<?php

namespace Tests\Feature;

use App\Models\ClientProfile;
use App\Models\CommercialDocument;
use App\Models\Customer;
use App\Models\TdsTcsSection;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminBillingPartyTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $staff;
    private User $clientUser;
    private ClientProfile $clientA;
    private ClientProfile $clientB;
    private Customer $partyA1;
    private Customer $partyA2;
    private Customer $partyAArchived;
    private Customer $partyB1;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create(['role' => 'admin', 'name' => 'Admin User']);
        $this->staff = User::factory()->create(['role' => 'staff', 'name' => 'Staff User']);

        $userA = User::factory()->create(['role' => 'client', 'name' => 'Client A User']);
        $this->clientUser = $userA;
        $this->clientA = ClientProfile::create([
            'user_id' => $userA->id,
            'client_code' => 'CL-PARTY-A',
            'business_name' => 'Alpha Corp',
            'client_name' => 'Alpha Legal',
            'has_gst' => true,
            'dealer_type' => 'regular',
            'gstin' => '27AAAAA0000A1Z5',
            'pan' => 'AAAAA0000A',
            'state' => 'Maharashtra',
            'state_code' => '27',
        ]);

        $userB = User::factory()->create(['role' => 'client', 'name' => 'Client B User']);
        $this->clientB = ClientProfile::create([
            'user_id' => $userB->id,
            'client_code' => 'CL-PARTY-B',
            'business_name' => 'Beta Ltd',
            'client_name' => 'Beta Legal',
            'has_gst' => true,
            'dealer_type' => 'regular',
            'gstin' => '29BBBBB1111B1Z2',
            'pan' => 'BBBBB1111B',
            'state' => 'Karnataka',
            'state_code' => '29',
        ]);

        $this->partyA1 = Customer::create([
            'client_profile_id' => $this->clientA->id,
            'name' => 'Alpha Customer One',
            'proprietor_name' => 'John Doe',
            'gstin' => '27ABCDE1234F1Z5',
            'gst_status' => 'registered',
            'phone' => '9876543210',
            'state' => 'Maharashtra',
            'state_code' => '27',
            'billing_address' => '123 Alpha St',
            'is_active' => true,
        ]);

        $this->partyA2 = Customer::create([
            'client_profile_id' => $this->clientA->id,
            'name' => 'Alpha Customer Two',
            'proprietor_name' => 'Jane Smith',
            'gstin' => '29FGHIJ5678K1Z3',
            'gst_status' => 'registered',
            'phone' => '9123456780',
            'state' => 'Karnataka',
            'state_code' => '29',
            'billing_address' => '456 Tech Park',
            'is_active' => true,
        ]);

        $this->partyAArchived = Customer::create([
            'client_profile_id' => $this->clientA->id,
            'name' => 'Alpha Old Vendor',
            'proprietor_name' => 'Old Vendor',
            'gst_status' => 'unregistered',
            'phone' => '9998887776',
            'state' => 'Maharashtra',
            'state_code' => '27',
            'billing_address' => '789 Old Lane',
            'is_active' => false,
        ]);

        $this->partyB1 = Customer::create([
            'client_profile_id' => $this->clientB->id,
            'name' => 'Beta Customer One',
            'proprietor_name' => 'Robert Bruce',
            'gstin' => '29KLMNO9012P1Z4',
            'gst_status' => 'registered',
            'phone' => '9811122233',
            'state' => 'Karnataka',
            'state_code' => '29',
            'billing_address' => '321 Beta Blvd',
            'is_active' => true,
        ]);
    }

    public function test_unauthenticated_request_is_rejected(): void
    {
        $this->getJson("/api/admin/billing/client-directory/{$this->clientA->id}/parties")
            ->assertStatus(401);

        $this->getJson("/api/admin/billing/client-directory/{$this->clientA->id}/parties/recent")
            ->assertStatus(401);

        $this->getJson("/api/admin/billing/client-directory/{$this->clientA->id}/parties/{$this->partyA1->id}")
            ->assertStatus(401);

        $this->getJson("/api/admin/billing/client-directory/{$this->clientA->id}/tds-tcs-sections")
            ->assertStatus(401);
    }

    public function test_client_role_is_forbidden_under_role_staff(): void
    {
        Sanctum::actingAs($this->clientUser);

        $this->getJson("/api/admin/billing/client-directory/{$this->clientA->id}/parties")
            ->assertStatus(403);

        $this->getJson("/api/admin/billing/client-directory/{$this->clientA->id}/parties/recent")
            ->assertStatus(403);

        $this->getJson("/api/admin/billing/client-directory/{$this->clientA->id}/parties/{$this->partyA1->id}")
            ->assertStatus(403);

        $this->getJson("/api/admin/billing/client-directory/{$this->clientA->id}/tds-tcs-sections")
            ->assertStatus(403);
    }

    public function test_staff_role_is_allowed(): void
    {
        Sanctum::actingAs($this->staff);

        $this->getJson("/api/admin/billing/client-directory/{$this->clientA->id}/parties")
            ->assertStatus(200);

        $this->getJson("/api/admin/billing/client-directory/{$this->clientA->id}/parties/recent")
            ->assertStatus(200);

        $this->getJson("/api/admin/billing/client-directory/{$this->clientA->id}/parties/{$this->partyA1->id}")
            ->assertStatus(200);

        $this->getJson("/api/admin/billing/client-directory/{$this->clientA->id}/tds-tcs-sections")
            ->assertStatus(200);
    }

    public function test_non_existent_client_returns_404(): void
    {
        Sanctum::actingAs($this->admin);

        $this->getJson('/api/admin/billing/client-directory/999999/parties')
            ->assertStatus(404);

        $this->getJson('/api/admin/billing/client-directory/999999/parties/recent')
            ->assertStatus(404);

        $this->getJson('/api/admin/billing/client-directory/999999/parties/1')
            ->assertStatus(404);

        $this->getJson('/api/admin/billing/client-directory/999999/tds-tcs-sections')
            ->assertStatus(404);
    }

    public function test_parties_list_is_strictly_scoped_to_client_id(): void
    {
        Sanctum::actingAs($this->admin);

        // Fetch Client A parties
        $resA = $this->getJson("/api/admin/billing/client-directory/{$this->clientA->id}/parties");
        $resA->assertStatus(200);
        $idsA = collect($resA->json('data'))->pluck('id')->all();

        $this->assertContains($this->partyA1->id, $idsA);
        $this->assertContains($this->partyA2->id, $idsA);
        $this->assertNotContains($this->partyB1->id, $idsA);

        // Fetch Client B parties
        $resB = $this->getJson("/api/admin/billing/client-directory/{$this->clientB->id}/parties");
        $resB->assertStatus(200);
        $idsB = collect($resB->json('data'))->pluck('id')->all();

        $this->assertContains($this->partyB1->id, $idsB);
        $this->assertNotContains($this->partyA1->id, $idsB);
        $this->assertNotContains($this->partyA2->id, $idsB);
    }

    public function test_parties_search_and_filters(): void
    {
        Sanctum::actingAs($this->admin);

        // Search by name
        $res = $this->getJson("/api/admin/billing/client-directory/{$this->clientA->id}/parties?q=One");
        $res->assertStatus(200);
        $this->assertCount(1, $res->json('data'));
        $this->assertEquals($this->partyA1->id, $res->json('data.0.id'));

        // Search by gstin
        $resGst = $this->getJson("/api/admin/billing/client-directory/{$this->clientA->id}/parties?q=FGHIJ");
        $resGst->assertStatus(200);
        $this->assertCount(1, $resGst->json('data'));
        $this->assertEquals($this->partyA2->id, $resGst->json('data.0.id'));

        // Search by phone
        $resPhone = $this->getJson("/api/admin/billing/client-directory/{$this->clientA->id}/parties?q=9876543210");
        $resPhone->assertStatus(200);
        $this->assertCount(1, $resPhone->json('data'));
        $this->assertEquals($this->partyA1->id, $resPhone->json('data.0.id'));

        // Filter by state
        $resState = $this->getJson("/api/admin/billing/client-directory/{$this->clientA->id}/parties?state=Karnataka");
        $resState->assertStatus(200);
        $this->assertCount(1, $resState->json('data'));
        $this->assertEquals($this->partyA2->id, $resState->json('data.0.id'));

        // Filter status=active excludes archived
        $resActive = $this->getJson("/api/admin/billing/client-directory/{$this->clientA->id}/parties?status=active");
        $resActive->assertStatus(200);
        $idsActive = collect($resActive->json('data'))->pluck('id')->all();
        $this->assertContains($this->partyA1->id, $idsActive);
        $this->assertContains($this->partyA2->id, $idsActive);
        $this->assertNotContains($this->partyAArchived->id, $idsActive);

        // Filter status=archived returns only archived
        $resArchived = $this->getJson("/api/admin/billing/client-directory/{$this->clientA->id}/parties?status=archived");
        $resArchived->assertStatus(200);
        $idsArchived = collect($resArchived->json('data'))->pluck('id')->all();
        $this->assertEquals([$this->partyAArchived->id], $idsArchived);
    }

    public function test_parties_show_returns_party_and_enforces_cross_tenant_isolation(): void
    {
        Sanctum::actingAs($this->admin);

        // Client A viewing own party -> 200
        $res = $this->getJson("/api/admin/billing/client-directory/{$this->clientA->id}/parties/{$this->partyA1->id}");
        $res->assertStatus(200)
            ->assertJson([
                'id' => $this->partyA1->id,
                'name' => 'Alpha Customer One',
                'gstin' => '27ABCDE1234F1Z5',
            ]);

        // CROSS-TENANT ISOLATION: Client A viewing Client B's party -> 404
        $this->getJson("/api/admin/billing/client-directory/{$this->clientA->id}/parties/{$this->partyB1->id}")
            ->assertStatus(404);

        // CROSS-TENANT ISOLATION: Client B viewing Client A's party -> 404
        $this->getJson("/api/admin/billing/client-directory/{$this->clientB->id}/parties/{$this->partyA1->id}")
            ->assertStatus(404);
    }

    public function test_recent_parties_scoped_and_ordered(): void
    {
        Sanctum::actingAs($this->admin);

        // Create documents for Client A:
        // doc 1: party A1
        // doc 2: party A2
        // Most recent should be A2, then A1
        CommercialDocument::create([
            'client_profile_id' => $this->clientA->id,
            'customer_id' => $this->partyA1->id,
            'type' => 'tax_invoice',
            'number' => 'INV-A-01',
            'document_date' => '2026-05-01',
            'status' => 'issued',
            'is_inter_state' => false,
            'is_reverse_charge' => false,
            'taxable_amount' => 1000,
            'total_amount' => 1180,
            'grand_total' => 1180,
        ]);

        CommercialDocument::create([
            'client_profile_id' => $this->clientA->id,
            'customer_id' => $this->partyA2->id,
            'type' => 'tax_invoice',
            'number' => 'INV-A-02',
            'document_date' => '2026-05-02',
            'status' => 'issued',
            'is_inter_state' => true,
            'is_reverse_charge' => false,
            'taxable_amount' => 2000,
            'total_amount' => 2360,
            'grand_total' => 2360,
        ]);

        // Document for Client B with Party B1
        CommercialDocument::create([
            'client_profile_id' => $this->clientB->id,
            'customer_id' => $this->partyB1->id,
            'type' => 'tax_invoice',
            'number' => 'INV-B-01',
            'document_date' => '2026-05-03',
            'status' => 'issued',
            'is_inter_state' => false,
            'is_reverse_charge' => false,
            'taxable_amount' => 500,
            'total_amount' => 590,
            'grand_total' => 590,
        ]);

        $res = $this->getJson("/api/admin/billing/client-directory/{$this->clientA->id}/parties/recent");
        $res->assertStatus(200);

        $recentIds = collect($res->json('data'))->pluck('id')->all();
        // Should have partyA2 first (id 2 is later), then partyA1
        $this->assertEquals([$this->partyA2->id, $this->partyA1->id], $recentIds);
        // Cross-tenant: Client B party must never appear in Client A recent parties
        $this->assertNotContains($this->partyB1->id, $recentIds);

        // Client B recent parties
        $resB = $this->getJson("/api/admin/billing/client-directory/{$this->clientB->id}/parties/recent");
        $resB->assertStatus(200);
        $this->assertEquals([$this->partyB1->id], collect($resB->json('data'))->pluck('id')->all());
    }

    public function test_tds_tcs_sections_endpoint(): void
    {
        Sanctum::actingAs($this->admin);

        TdsTcsSection::create([
            'type' => 'tds',
            'code' => '194C',
            'description' => 'Payment to Contractors',
            'rate' => 2.0,
            'sort_order' => 1,
            'is_active' => true,
        ]);

        TdsTcsSection::create([
            'type' => 'tcs',
            'code' => '206C(1H)',
            'description' => 'Sale of Goods',
            'rate' => 0.1,
            'sort_order' => 2,
            'is_active' => true,
        ]);

        TdsTcsSection::create([
            'type' => 'tds',
            'code' => '194J-INACTIVE',
            'description' => 'Fees for Professional Services',
            'rate' => 10.0,
            'sort_order' => 3,
            'is_active' => false,
        ]);

        // Client-scoped endpoint
        $res = $this->getJson("/api/admin/billing/client-directory/{$this->clientA->id}/tds-tcs-sections");
        $res->assertStatus(200);
        $codes = collect($res->json('data'))->pluck('code')->all();
        $this->assertContains('194C', $codes);
        $this->assertContains('206C(1H)', $codes);
        $this->assertNotContains('194J-INACTIVE', $codes);

        // Filter by type=tds
        $resTds = $this->getJson("/api/admin/billing/client-directory/{$this->clientA->id}/tds-tcs-sections?type=tds");
        $resTds->assertStatus(200);
        $tdsCodes = collect($resTds->json('data'))->pluck('code')->all();
        $this->assertContains('194C', $tdsCodes);
        $this->assertNotContains('206C(1H)', $tdsCodes);

        // Filter by type=tcs
        $resTcs = $this->getJson("/api/admin/billing/client-directory/{$this->clientA->id}/tds-tcs-sections?type=tcs");
        $resTcs->assertStatus(200);
        $tcsCodes = collect($resTcs->json('data'))->pluck('code')->all();
        $this->assertContains('206C(1H)', $tcsCodes);
        $this->assertNotContains('194C', $tcsCodes);

        // Global admin endpoint /api/admin/billing/tds-tcs-sections
        $resGlobal = $this->getJson('/api/admin/billing/tds-tcs-sections');
        $resGlobal->assertStatus(200);
        $this->assertContains('194C', collect($resGlobal->json('data'))->pluck('code')->all());
    }
}
