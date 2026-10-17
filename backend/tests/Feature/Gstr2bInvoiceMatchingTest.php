<?php

namespace Tests\Feature;

use App\Models\ClientGstr2bInvoice;
use App\Models\ClientGstr2bRecord;
use App\Models\ClientProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class Gstr2bInvoiceMatchingTest extends TestCase
{
    use RefreshDatabase;

    public function test_client_can_update_owned_invoice_and_summary_recalculates(): void
    {
        $user = User::factory()->create(['role' => 'client']);
        $profile = ClientProfile::create([
            'user_id' => $user->id,
            'business_name' => 'Test Client',
        ]);
        $record = ClientGstr2bRecord::create([
            'client_profile_id' => $profile->id,
            'financial_year' => '2026-27',
            'tax_period' => '2026-04',
            'file_path' => 'gstr2b/test.json',
            'file_name' => 'test.json',
            'uploaded_by' => $user->id,
        ]);

        ClientGstr2bInvoice::create([
            'client_profile_id' => $profile->id,
            'gstr2b_record_id' => $record->id,
            'financial_year' => '2026-27',
            'tax_period' => '2026-04',
            'invoice_number' => 'INV-001',
            'total_gst' => 1000.50,
            'match_status' => ClientGstr2bInvoice::MATCH_STATUS_MATCHED,
        ]);
        $unmatchedInvoice = ClientGstr2bInvoice::create([
            'client_profile_id' => $profile->id,
            'gstr2b_record_id' => $record->id,
            'financial_year' => '2026-27',
            'tax_period' => '2026-04',
            'invoice_number' => 'INV-002',
            'total_gst' => 250.25,
        ]);

        Sanctum::actingAs($user);

        $this->getJson('/api/client/gstr2b?financial_year=2026-27')
            ->assertOk()
            ->assertJsonPath('summary.total_invoices', 2)
            ->assertJsonPath('summary.matched_invoices', 1)
            ->assertJsonPath('summary.unmatched_invoices', 1)
            ->assertJsonPath('summary.matched_itc_amount', 1000.5)
            ->assertJsonPath('summary.unmatched_itc_amount', 250.25);

        $this->patchJson("/api/client/gstr2b/invoices/{$unmatchedInvoice->id}/match-status", [
            'match_status' => ClientGstr2bInvoice::MATCH_STATUS_MATCHED,
        ])
            ->assertOk()
            ->assertJsonPath('match_status', ClientGstr2bInvoice::MATCH_STATUS_MATCHED);

        $this->getJson('/api/client/gstr2b?financial_year=2026-27')
            ->assertOk()
            ->assertJsonPath('summary.total_invoices', 2)
            ->assertJsonPath('summary.matched_invoices', 2)
            ->assertJsonPath('summary.unmatched_invoices', 0)
            ->assertJsonPath('summary.matched_itc_amount', 1250.75)
            ->assertJsonPath('summary.unmatched_itc_amount', 0);
    }

    public function test_client_cannot_update_another_clients_invoice(): void
    {
        $owner = User::factory()->create(['role' => 'client']);
        $ownerProfile = ClientProfile::create([
            'user_id' => $owner->id,
            'business_name' => 'Owner Client',
        ]);
        $record = ClientGstr2bRecord::create([
            'client_profile_id' => $ownerProfile->id,
            'financial_year' => '2026-27',
            'tax_period' => '2026-04',
            'file_path' => 'gstr2b/owner.json',
            'file_name' => 'owner.json',
            'uploaded_by' => $owner->id,
        ]);
        $invoice = ClientGstr2bInvoice::create([
            'client_profile_id' => $ownerProfile->id,
            'gstr2b_record_id' => $record->id,
            'financial_year' => '2026-27',
            'tax_period' => '2026-04',
            'invoice_number' => 'PRIVATE-001',
            'total_gst' => 500,
        ]);

        $otherUser = User::factory()->create(['role' => 'client']);
        ClientProfile::create([
            'user_id' => $otherUser->id,
            'business_name' => 'Other Client',
        ]);
        Sanctum::actingAs($otherUser);

        $this->patchJson("/api/client/gstr2b/invoices/{$invoice->id}/match-status", [
            'match_status' => ClientGstr2bInvoice::MATCH_STATUS_MATCHED,
        ])->assertNotFound();

        $this->assertDatabaseHas('client_gstr2b_invoices', [
            'id' => $invoice->id,
            'match_status' => ClientGstr2bInvoice::MATCH_STATUS_PENDING,
        ]);
    }
}
