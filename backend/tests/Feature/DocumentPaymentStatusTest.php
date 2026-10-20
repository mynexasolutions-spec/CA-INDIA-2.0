<?php

namespace Tests\Feature;

use App\Models\ClientProfile;
use App\Models\CommercialDocument;
use App\Models\DocumentPaymentLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DocumentPaymentStatusTest extends TestCase
{
    use RefreshDatabase;

    private User $user;
    private CommercialDocument $doc;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create(['role' => 'client', 'is_active' => true]);
        $profile = ClientProfile::create([
            'user_id' => $this->user->id,
            'client_name' => 'Pay Corp',
            'business_name' => 'Pay Corp',
            'client_code' => 'PAY001',
            'has_gst' => true,
            'dealer_type' => 'regular',
        ]);
        $this->doc = CommercialDocument::create([
            'client_profile_id' => $profile->id,
            'type' => 'tax_invoice',
            'number' => 'INV-01',
            'status' => 'issued',
            'document_date' => now()->toDateString(),
            'grand_total' => 1180,
        ]);
        Sanctum::actingAs($this->user);
    }

    private function setStatus(array $body)
    {
        return $this->postJson("/api/billing/documents/{$this->doc->id}/payment-status", $body);
    }

    public function test_marking_paid_without_payment_details_is_rejected_and_status_is_unchanged(): void
    {
        $this->setStatus(['status' => 'paid'])->assertStatus(422)->assertJsonValidationErrors(['paid_on', 'payment_mode']);
        $this->assertSame('issued', $this->doc->fresh()->status);
        $this->assertSame(0, DocumentPaymentLog::count());
    }

    public function test_reference_number_is_required_for_upi_bank_transfer_and_cheque(): void
    {
        foreach (['UPI', 'Bank Transfer', 'Cheque'] as $mode) {
            $this->setStatus(['status' => 'paid', 'paid_on' => '2026-10-20', 'payment_mode' => $mode])
                ->assertStatus(422)->assertJsonValidationErrors(['reference_number']);
        }
        $this->assertSame('issued', $this->doc->fresh()->status);
    }

    public function test_cash_requires_received_by(): void
    {
        $this->setStatus(['status' => 'paid', 'paid_on' => '2026-10-20', 'payment_mode' => 'Cash'])
            ->assertStatus(422)->assertJsonValidationErrors(['received_by']);
    }

    public function test_paid_with_full_details_saves_every_field(): void
    {
        $this->setStatus([
            'status' => 'paid', 'paid_on' => '2026-10-20', 'payment_mode' => 'UPI',
            'reference_number' => 'UPI-998877', 'received_by' => 'Ravi', 'paid_amount' => 1180, 'remarks' => 'Advance cleared',
        ])->assertOk();

        $this->assertSame('paid', $this->doc->fresh()->status);
        $log = DocumentPaymentLog::first();
        $this->assertSame('mark_paid', $log->action);
        $this->assertSame('UPI', $log->payment_mode);
        $this->assertSame('UPI-998877', $log->reference_number);
        $this->assertSame('Ravi', $log->received_by);
        $this->assertSame('Advance cleared', $log->remarks);
        $this->assertEquals(1180, $log->paid_amount);
    }

    public function test_marking_unpaid_requires_a_reason_and_saves_it(): void
    {
        $this->doc->update(['status' => 'paid']);

        $this->setStatus(['status' => 'unpaid'])->assertStatus(422)->assertJsonValidationErrors(['unmark_reason']);
        $this->setStatus(['status' => 'unpaid', 'unmark_reason' => '   '])->assertStatus(422)->assertJsonValidationErrors(['unmark_reason']);
        $this->assertSame('paid', $this->doc->fresh()->status);

        $this->setStatus(['status' => 'unpaid', 'unmark_reason' => 'Cheque bounced'])->assertOk();
        $this->assertSame('issued', $this->doc->fresh()->status);
        $this->assertSame('Cheque bounced', DocumentPaymentLog::where('action', 'unmark_paid')->first()->unmark_reason);
    }
}
