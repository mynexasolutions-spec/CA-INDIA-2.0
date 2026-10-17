<?php

namespace Tests\Feature;

use App\Models\ClientGstr2bInvoice;
use App\Models\ClientGstr2bRecord;
use App\Models\ClientProfile;
use App\Models\CommercialDocument;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class GstLiabilityReportTest extends TestCase
{
    use RefreshDatabase;

    public function test_regular_gst_client_receives_monthly_and_quarterly_liability(): void
    {
        $user = User::factory()->create(['role' => 'client']);
        $profile = ClientProfile::create([
            'user_id' => $user->id,
            'business_name' => 'Regular GST Client',
            'has_gst' => true,
            'dealer_type' => 'regular',
        ]);

        $documents = [
            ['number' => 'INV-001', 'type' => 'tax_invoice', 'status' => 'issued', 'cgst_amount' => 100.25, 'sgst_amount' => 100.25, 'igst_amount' => 0],
            ['number' => 'INV-002', 'type' => 'tax_invoice', 'status' => 'paid', 'cgst_amount' => 0, 'sgst_amount' => 0, 'igst_amount' => 300.20],
            ['number' => 'DN-001', 'type' => 'debit_note', 'status' => 'partial', 'cgst_amount' => 0, 'sgst_amount' => 0, 'igst_amount' => 50.05],
            ['number' => 'CN-001', 'type' => 'credit_note', 'status' => 'issued', 'cgst_amount' => 0, 'sgst_amount' => 0, 'igst_amount' => 75.25],
            ['number' => 'DRAFT-001', 'type' => 'tax_invoice', 'status' => 'draft', 'cgst_amount' => 500, 'sgst_amount' => 500, 'igst_amount' => 0],
            ['number' => 'BOS-001', 'type' => 'bill_of_supply', 'status' => 'issued', 'cgst_amount' => 500, 'sgst_amount' => 500, 'igst_amount' => 0],
        ];

        foreach ($documents as $document) {
            CommercialDocument::create([
                'client_profile_id' => $profile->id,
                'document_date' => '2026-04-15',
                'taxable_amount' => 1000,
                'total_amount' => 1000,
                ...$document,
            ]);
        }

        // The GST period counts by the day the document was created in the portal.
        CommercialDocument::query()->update(['created_at' => '2026-04-15 10:00:00']);

        $record = ClientGstr2bRecord::create([
            'client_profile_id' => $profile->id,
            'financial_year' => '2026-27',
            'tax_period' => '2026-04',
            'file_path' => 'gstr2b/april.json',
            'file_name' => 'april.json',
            'uploaded_by' => $user->id,
        ]);

        $itcRows = [
            ['invoice_number' => 'PUR-001', 'tax_period' => '2026-04', 'total_gst' => 200.25, 'itc_eligibility' => 'eligible', 'match_status' => 'matched'],
            ['invoice_number' => 'PUR-002', 'tax_period' => '2026-04', 'total_gst' => 100, 'itc_eligibility' => 'ineligible', 'match_status' => 'matched'],
            ['invoice_number' => 'PUR-003', 'tax_period' => '2026-04', 'total_gst' => 50, 'itc_eligibility' => 'eligible', 'match_status' => 'unmatched'],
            ['invoice_number' => 'PUR-004', 'tax_period' => '2026-05', 'total_gst' => 300, 'itc_eligibility' => 'eligible', 'match_status' => 'matched'],
        ];

        foreach ($itcRows as $itcRow) {
            ClientGstr2bInvoice::create([
                'client_profile_id' => $profile->id,
                'gstr2b_record_id' => $record->id,
                'financial_year' => '2026-27',
                ...$itcRow,
            ]);
        }

        Sanctum::actingAs($user);

        $monthQuery = 'type=gst_liability&from=2026-04-01&to=2026-04-30';
        $this->getJson('/api/billing/reports?'.$monthQuery)
            ->assertOk()
            ->assertJsonPath('from', '2026-04-01')
            ->assertJsonPath('to', '2026-04-30')
            ->assertJsonPath('data.total_output_gst', 475.5)
            ->assertJsonPath('data.total_eligible_itc', 200.25)
            ->assertJsonPath('data.net_gst_liability', 275.25)
            ->assertJsonPath('data.result', 'gst_payable')
            ->assertJsonPath('data.gst_payable', 275.25)
            ->assertJsonPath('data.itc_carry_forward', 0);

        $quarterQuery = 'type=gst_liability&from=2026-04-01&to=2026-06-30';
        $this->getJson('/api/billing/reports?'.$quarterQuery)
            ->assertOk()
            ->assertJsonPath('from', '2026-04-01')
            ->assertJsonPath('to', '2026-06-30')
            ->assertJsonPath('data.total_output_gst', 475.5)
            ->assertJsonPath('data.total_eligible_itc', 500.25)
            ->assertJsonPath('data.net_gst_liability', -24.75)
            ->assertJsonPath('data.result', 'excess_itc')
            ->assertJsonPath('data.gst_payable', 0)
            ->assertJsonPath('data.itc_carry_forward', 24.75);

        $this->get('/api/billing/reports/export?'.$monthQuery.'&format=xlsx')
            ->assertOk()
            ->assertHeader('content-type', 'application/vnd.ms-excel');

        $this->get('/api/billing/reports/export?'.$monthQuery.'&format=pdf')
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');
    }

    public function test_composition_client_cannot_access_the_liability_report(): void
    {
        $user = User::factory()->create(['role' => 'client']);
        ClientProfile::create([
            'user_id' => $user->id,
            'business_name' => 'Composition Client',
            'has_gst' => true,
            'dealer_type' => 'composition',
        ]);
        Sanctum::actingAs($user);

        $this->getJson('/api/billing/reports?type=gst_liability&period_type=financial_year&financial_year=2026-27')
            ->assertUnprocessable()
            ->assertJsonPath('message', 'GST Liability Report is available only for regular GST dealers.');
    }
}
