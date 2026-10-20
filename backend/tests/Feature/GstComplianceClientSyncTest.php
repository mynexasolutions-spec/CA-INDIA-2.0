<?php

namespace Tests\Feature;

use App\Models\ClientGstr2bRecord;
use App\Models\ClientGstReturn;
use App\Models\ClientProfile;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class GstComplianceClientSyncTest extends TestCase
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
            'client_name' => 'Gst Sync Corp',
            'business_name' => 'Gst Sync Corp',
            'client_code' => 'GSC001',
            'has_gst' => true,
            'gst_compliance_enabled' => true,
            'dealer_type' => 'regular',
            'gst_filing_frequency' => 'monthly',
        ]);
        Sanctum::actingAs($this->user);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function period(array $rows, string $key): array
    {
        return collect($rows)->firstWhere('period', $key);
    }

    public function test_gstr1_marked_filed_by_admin_shows_filed_with_arn_for_that_month(): void
    {
        // Admin "Mark as Filed" on the GSTR-1 review screen writes client_gst_returns only.
        ClientGstReturn::create([
            'client_profile_id' => $this->profile->id, 'tax_period' => '2026-08', 'return_type' => 'GSTR1',
            'status' => 'filed', 'filed_on' => '2026-09-10', 'ack_no' => 'AA2708261234567',
        ]);

        $res = $this->getJson('/api/client/gst-filing/periods?financial_year=2026-27&return_type=GSTR-1')->assertOk();

        $aug = $this->period($res->json('periods'), '2026-08');
        $this->assertSame('Filed Successfully', $aug['status']);
        $this->assertSame('AA2708261234567', $aug['ack_no']);
        $this->assertSame('2026-09-10', $aug['filed_on']);
        // Other months are unaffected, and the summary card carries the ARN too.
        $this->assertNotSame('Filed Successfully', $this->period($res->json('periods'), '2026-09')['status']);
        $this->assertSame('AA2708261234567', $res->json('summary.last_filed.ack_no'));
        $this->assertSame('Aug 2026', $res->json('summary.last_filed.period_label'));
    }

    public function test_gstr3b_marked_filed_by_admin_shows_filed_and_does_not_leak_into_gstr1(): void
    {
        ClientGstReturn::create([
            'client_profile_id' => $this->profile->id, 'tax_period' => '2026-08', 'return_type' => 'GSTR3B',
            'status' => 'filed', 'filed_on' => '2026-09-19', 'ack_no' => 'AA270826999',
        ]);

        $b = $this->getJson('/api/client/gst-filing/periods?financial_year=2026-27&return_type=GSTR-3B')->assertOk();
        $this->assertSame('Filed Successfully', $this->period($b->json('periods'), '2026-08')['status']);
        $this->assertSame('AA270826999', $this->period($b->json('periods'), '2026-08')['ack_no']);

        $a = $this->getJson('/api/client/gst-filing/periods?financial_year=2026-27&return_type=GSTR-1')->assertOk();
        $this->assertNotSame('Filed Successfully', $this->period($a->json('periods'), '2026-08')['status']);
    }

    public function test_quarterly_gstr3b_filed_against_the_quarter_end_month_shows_on_that_quarter(): void
    {
        $this->profile->update(['gst_filing_frequency' => 'quarterly', 'gstr2b_filing_frequency' => 'quarterly']);
        ClientGstReturn::create([
            'client_profile_id' => $this->profile->id, 'tax_period' => '2026-09', 'return_type' => 'GSTR3B',
            'status' => 'filed', 'filed_on' => '2026-10-18', 'ack_no' => 'AA270926Q2',
        ]);

        $res = $this->getJson('/api/client/gst-filing/periods?financial_year=2026-27&return_type=GSTR-3B')->assertOk();
        $q2 = $this->period($res->json('periods'), '2026-Q2');
        $this->assertSame('Filed Successfully', $q2['status']);
        $this->assertSame('AA270926Q2', $q2['ack_no']);
        $this->assertNotSame('Filed Successfully', $this->period($res->json('periods'), '2026-Q1')['status']);
    }

    public function test_monthly_gstr2b_period_opens_on_the_first_day_of_the_month(): void
    {
        Carbon::setTestNow('2026-11-01 09:00:00');
        ClientGstr2bRecord::create(['client_profile_id' => $this->profile->id, 'financial_year' => '2026-27', 'tax_period' => '2026-09', 'no_bills' => false]);

        $periods = $this->getJson('/api/client/gstr2b/periods?financial_year=2026-27')->assertOk()->json('periods');

        $this->assertSame('available', $this->period($periods, '2026-09')['status']);   // official data loaded
        $this->assertSame('open', $this->period($periods, '2026-10')['status']);        // earlier month stays accessible
        $this->assertSame('open', $this->period($periods, '2026-11')['status']);        // 1 Nov -> November opens
        $this->assertSame('upcoming', $this->period($periods, '2026-12')['status']);
    }

    public function test_monthly_gstr2b_period_is_still_upcoming_the_day_before(): void
    {
        Carbon::setTestNow('2026-10-31 23:00:00');
        $periods = $this->getJson('/api/client/gstr2b/periods?financial_year=2026-27')->assertOk()->json('periods');
        $this->assertSame('upcoming', $this->period($periods, '2026-11')['status']);
        $this->assertSame('open', $this->period($periods, '2026-10')['status']);
    }

    public function test_quarterly_gstr2b_quarter_opens_on_the_first_day_of_the_quarter(): void
    {
        $this->profile->update(['gstr2b_filing_frequency' => 'quarterly']);
        Carbon::setTestNow('2026-10-01 08:00:00');

        $periods = $this->getJson('/api/client/gstr2b/periods?financial_year=2026-27')->assertOk()->json('periods');

        $this->assertSame('open', $this->period($periods, '2026-Q2')['status']);
        $this->assertSame('open', $this->period($periods, '2026-Q3')['status']);        // Oct-Dec opens on 1 Oct
        $this->assertSame('upcoming', $this->period($periods, '2026-Q4')['status']);
    }

    public function test_projected_itc_can_be_added_for_an_open_quarter_under_the_right_financial_year(): void
    {
        $this->profile->update(['gstr2b_filing_frequency' => 'quarterly']);
        Carbon::setTestNow('2026-10-01 08:00:00');

        $this->postJson('/api/client/gstr2b/period/2026-Q3/projected', [
            'invoice_date' => '2026-10-05', 'invoice_number' => 'PRJ-1', 'party_name' => 'Supplier',
            'gstin' => '27AAACR5055K1Z7', 'taxable_value' => 1000, 'igst' => 0, 'cgst' => 90, 'sgst_utgst' => 90,
        ])->assertStatus(201)->assertJsonPath('financial_year', '2026-27')->assertJsonPath('tax_period', '2026-Q3');
    }
}
