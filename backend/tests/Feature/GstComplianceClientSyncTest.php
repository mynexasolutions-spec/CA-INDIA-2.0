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
        // The Excel template tests build real .xlsx files; in a full-suite run (one process) the default 128 MB runs out.
        ini_set('memory_limit', '512M');
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

    public function test_gstr1_filing_confirmation_with_arn_saved_by_admin_shows_filed_with_arn_to_client(): void
    {
        $request = \App\Models\GstFilingRequest::create([
            'client_profile_id' => $this->profile->id, 'financial_year' => '2026-27', 'filing_period' => '2026-08',
            'return_type' => 'GSTR-1', 'status' => 'Pending CA Review',
        ]);

        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        Sanctum::actingAs($admin);
        $this->putJson("/api/admin/gst-filing/requests/{$request->id}/status", [
            'status' => 'GST Filed', 'filing_date' => '2026-09-10', 'ack_no' => 'AA2708261111111',
        ])->assertOk();

        Sanctum::actingAs($this->user);
        $res = $this->getJson('/api/client/gst-filing/periods?financial_year=2026-27&return_type=GSTR-1')->assertOk();
        $aug = $this->period($res->json('periods'), '2026-08');
        $this->assertSame('Filed Successfully', $aug['status']);
        $this->assertSame('AA2708261111111', $aug['ack_no']);
        $this->assertNotSame('Filed Successfully', $this->period($res->json('periods'), '2026-07')['status']);

        // GSTR-1 and GSTR-3B are separate returns: this save must not mark the GSTR-3B period filed.
        $b = $this->getJson('/api/client/gst-filing/periods?financial_year=2026-27&return_type=GSTR-3B')->assertOk();
        $this->assertNotSame('Filed Successfully', $this->period($b->json('periods'), '2026-08')['status']);
    }

    public function test_gstr3b_filing_confirmation_with_arn_saved_by_admin_shows_filed_with_arn_to_client(): void
    {
        $request = \App\Models\GstFilingRequest::create([
            'client_profile_id' => $this->profile->id, 'financial_year' => '2026-27', 'filing_period' => '2026-08',
            'return_type' => 'GSTR-3B', 'status' => 'Approved for Filing',
        ]);

        Sanctum::actingAs(User::factory()->create(['role' => 'admin', 'is_active' => true]));
        $this->putJson("/api/admin/gst-filing/requests/{$request->id}/status", [
            'status' => 'GST Filed', 'filing_date' => '2026-09-19', 'ack_no' => 'AA270826333',
        ])->assertOk();

        Sanctum::actingAs($this->user);
        $b = $this->getJson('/api/client/gst-filing/periods?financial_year=2026-27&return_type=GSTR-3B')->assertOk();
        $aug = $this->period($b->json('periods'), '2026-08');
        $this->assertSame('Filed Successfully', $aug['status']);
        $this->assertSame('AA270826333', $aug['ack_no']);
        $this->assertSame('2026-09-19', $aug['filed_on']);
        $this->assertNotSame('Filed Successfully', $this->period($b->json('periods'), '2026-07')['status']);

        $a = $this->getJson('/api/client/gst-filing/periods?financial_year=2026-27&return_type=GSTR-1')->assertOk();
        $this->assertNotSame('Filed Successfully', $this->period($a->json('periods'), '2026-08')['status']);
    }

    public function test_quarterly_gstr3b_filing_confirmation_saved_by_admin_shows_filed_on_that_quarter(): void
    {
        $this->profile->update(['gst_filing_frequency' => 'quarterly', 'gstr2b_filing_frequency' => 'quarterly']);
        $request = \App\Models\GstFilingRequest::create([
            'client_profile_id' => $this->profile->id, 'financial_year' => '2026-27', 'filing_period' => '2026-Q2',
            'return_type' => 'GSTR-3B', 'status' => 'Approved for Filing',
        ]);

        Sanctum::actingAs(User::factory()->create(['role' => 'admin', 'is_active' => true]));
        $this->putJson("/api/admin/gst-filing/requests/{$request->id}/status", [
            'status' => 'GST Filed', 'filing_date' => '2026-10-18', 'ack_no' => 'AA270926Q2X',
        ])->assertOk();

        Sanctum::actingAs($this->user);
        $res = $this->getJson('/api/client/gst-filing/periods?financial_year=2026-27&return_type=GSTR-3B')->assertOk();
        $q2 = $this->period($res->json('periods'), '2026-Q2');
        $this->assertSame('Filed Successfully', $q2['status']);
        $this->assertSame('AA270926Q2X', $q2['ack_no']);
        $this->assertNotSame('Filed Successfully', $this->period($res->json('periods'), '2026-Q1')['status']);
        $this->assertNotSame('Filed Successfully', $this->period($res->json('periods'), '2026-Q3')['status']);
    }

    private function loadTemplate(string $period): \PhpOffice\PhpSpreadsheet\Spreadsheet
    {
        $res = $this->get("/api/client/gstr2b/period/{$period}/projected/template")->assertOk();

        return \PhpOffice\PhpSpreadsheet\IOFactory::load($res->baseResponse->getFile()->getPathname());
    }

    private function uploadSheet(\PhpOffice\PhpSpreadsheet\Spreadsheet $book, string $period)
    {
        $path = tempnam(sys_get_temp_dir(), 'pitcup').'.xlsx';
        (new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($book))->save($path);
        $book->disconnectWorksheets();
        $file = new \Illuminate\Http\UploadedFile($path, 'projected.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);

        return $this->post("/api/client/gstr2b/period/{$period}/projected/import", ['file' => $file], ['Accept' => 'application/json']);
    }

    public function test_projected_itc_template_is_one_sheet_with_instructions_beside_the_data(): void
    {
        $book = $this->loadTemplate('2026-08');

        // A single sheet: the instructions live in column K, not on a second sheet.
        $this->assertSame(['Projected ITC'], $book->getSheetNames());
        $data = $book->getSheetByName('Projected ITC');
        $this->assertSame('Invoice Date *', $data->getCell('A1')->getValue());
        $this->assertSame('SGST/UTGST (₹)', $data->getCell('H1')->getValue());
        // No sample invoice in the data columns — it would be imported if left in.
        foreach (['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] as $col) {
            $this->assertNull($data->getCell($col.'2')->getValue());
        }
        $this->assertSame('HOW TO FILL THIS TEMPLATE', $data->getCell('K1')->getValue());
        // The worked example is dated inside the requested period.
        $this->assertStringStartsWith('15/08/2026', $data->getCell('K10')->getValue());

        $quarter = $this->loadTemplate('2026-Q3');
        $this->assertStringStartsWith('15/10/2026', $quarter->getSheetByName('Projected ITC')->getCell('K10')->getValue());
    }

    public function test_filled_projected_itc_template_imports_and_empty_template_is_rejected(): void
    {
        $empty = $this->uploadSheet($this->loadTemplate('2026-08'), '2026-08');
        $empty->assertStatus(422);
        $this->assertStringContainsString('no invoice rows', $empty->json('message'));

        $book = $this->loadTemplate('2026-08');
        $data = $book->getSheetByName('Projected ITC');
        $data->setCellValue('A2', \PhpOffice\PhpSpreadsheet\Shared\Date::PHPToExcel(strtotime('2026-08-15')));
        $data->setCellValue('B2', 'INV-001');
        $data->setCellValue('C2', 'ABC Traders Pvt Ltd');
        $data->setCellValue('D2', '27ABCDE1234F1Z5');
        $data->setCellValue('E2', 10000);
        $data->setCellValue('G2', 900);
        $data->setCellValue('H2', 900);
        $data->setCellValue('A3', '16-08-2026'); // DD-MM-YYYY typed as text is accepted too
        $data->setCellValue('B3', 'INV-002');
        $data->setCellValue('C3', 'XYZ Ltd');
        $data->setCellValue('D3', '27ABCDE1234F1Z5');
        $data->setCellValue('E3', 5000);
        $data->setCellValue('F3', 900);

        $this->uploadSheet($book, '2026-08')->assertStatus(201)->assertJsonPath('imported', 2);

        $rows = collect($this->getJson('/api/client/gstr2b/period/2026-08/projected')->assertOk()->json('data'));
        $this->assertSame(2, $rows->count());
        $this->assertSame(1800.0, (float) $rows->firstWhere('invoice_number', 'INV-001')['itc_amount']);
        $this->assertSame(900.0, (float) $rows->firstWhere('invoice_number', 'INV-002')['itc_amount']);
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
