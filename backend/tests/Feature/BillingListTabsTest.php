<?php

namespace Tests\Feature;

use App\Models\ClientProfile;
use App\Models\CommercialDocument;
use App\Models\Customer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BillingListTabsTest extends TestCase
{
    use RefreshDatabase;

    private User $user;
    private ClientProfile $profile;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create(['role' => 'client', 'is_active' => true]);
        $this->profile = ClientProfile::create([
            'user_id' => $this->user->id,
            'client_name' => 'Tabs Corp',
            'business_name' => 'Tabs Corp',
            'client_code' => 'TBC001',
            'has_gst' => true,
            'dealer_type' => 'regular',
        ]);
    }

    private function doc(string $type, string $number, ?Customer $customer, string $status = 'issued'): CommercialDocument
    {
        return CommercialDocument::create([
            'client_profile_id' => $this->profile->id,
            'customer_id' => $customer?->id,
            'type' => $type,
            'number' => $number,
            'status' => $status,
            'document_date' => now()->toDateString(),
            'taxable_amount' => 100,
            'igst_amount' => 18,
            'grand_total' => 118,
        ]);
    }

    public function test_every_document_type_gets_correct_tab_records_counts_and_totals(): void
    {
        $b2b = Customer::create(['client_profile_id' => $this->profile->id, 'name' => 'Reg Co', 'gst_status' => 'registered', 'gstin' => '27AAACR5055K1Z7']);
        $b2c = Customer::create(['client_profile_id' => $this->profile->id, 'name' => 'Walk In', 'gst_status' => 'unregistered']);

        foreach (['quotation', 'debit_note'] as $type) {
            $this->doc($type, strtoupper($type).'-1', $b2b);
            $this->doc($type, strtoupper($type).'-2', $b2c);
            $this->doc($type, strtoupper($type).'-3', null); // walk-in with no party counts as B2C
            $this->doc($type, strtoupper($type).'-4', $b2b, 'cancelled');
            $gone = $this->doc($type, strtoupper($type).'-5', $b2c);
            $gone->update(['status' => 'deleted']);
            $gone->delete();
        }

        Sanctum::actingAs($this->user);

        $all = $this->getJson('/api/billing/documents?type=quotation&per_page=10')->assertOk();
        $this->assertSame(['all' => 3, 'b2b' => 1, 'b2c' => 2, 'cancelled' => 1, 'deleted' => 1], $all->json('tab_counts'));
        $this->assertSame(3, $all->json('total'));
        $this->assertEquals(300, $all->json('totals.taxable_amount'));
        $this->assertEquals(54, $all->json('totals.igst_amount'));

        $this->assertSame(1, $this->getJson('/api/billing/documents?type=quotation&gst_type=b2b')->json('total'));
        $this->assertSame(2, $this->getJson('/api/billing/documents?type=quotation&gst_type=b2c')->json('total'));

        $cancelled = $this->getJson('/api/billing/documents?type=quotation&status=cancelled')->json();
        $this->assertSame(1, $cancelled['total']);
        $this->assertSame('QUOTATION-4', $cancelled['data'][0]['number']);

        $deleted = $this->getJson('/api/billing/documents?type=quotation&deleted=1')->json();
        $this->assertSame(1, $deleted['total']);
        $this->assertSame('QUOTATION-5', $deleted['data'][0]['number']);

        // The deleted row never leaks into the normal views, and other types are counted separately.
        $this->assertNotContains('QUOTATION-5', array_column($all->json('data'), 'number'));
        $this->assertSame(3, $this->getJson('/api/billing/documents?type=debit_note')->json('tab_counts.all'));
    }
}
