<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\Admin\ClientsUnlockController;
use App\Models\ClientDocumentSetting;
use App\Models\ClientProfile;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Admin "Enable GST Return Reminder" toggle (Clients > Configuration) drives the client portal reminders. */
class GstReminderToggleTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $clientUser;
    private ClientProfile $profile;

    protected function setUp(): void
    {
        parent::setUp();

        // 5 Nov 2026: Oct-2026 GSTR-1 (due 11 Nov) and GSTR-3B (due 20 Nov) are inside the reminder window.
        Carbon::setTestNow(Carbon::parse('2026-11-05 10:00:00'));

        $this->admin = User::factory()->create(['role' => 'admin']);
        // The admin Clients module is password-locked; unlock it for this admin like the other client tests do.
        Cache::put(ClientsUnlockController::cacheKey($this->admin->id), now()->toIso8601String(), now()->addHours(1));
        $this->clientUser = User::factory()->create(['role' => 'client', 'is_active' => true]);
        $this->profile = ClientProfile::create([
            'user_id' => $this->clientUser->id,
            'client_code' => 'CL-REM-01',
            'business_name' => 'Reminder Co',
            'client_name' => 'Reminder Owner',
            'has_gst' => true,
            'dealer_type' => 'regular',
            'gstin' => '27ABCDE1234F1Z5',
            'pan' => 'ABCDE1234F',
            'constitution_type' => 'Private Limited Company',
            'state' => 'Maharashtra',
            'state_code' => '27',
            'city' => 'Mumbai',
            'address_line_1' => '1 Test Road',
            'pincode' => '400001',
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function adminSetsReminder(bool $enabled): void
    {
        Sanctum::actingAs($this->admin);
        $documents = [];
        foreach (array_keys(ClientDocumentSetting::DOCUMENT_TYPES) as $type) {
            $documents[] = ['document_type' => $type, 'layout_id' => 1, 'colour_scheme' => 'slate_blue', 'watermark_applies' => false];
        }
        $this->putJson("/api/admin/clients/{$this->profile->id}/configuration", [
            'gst_reminder_enabled' => $enabled,
            'documents' => $documents,
        ])->assertOk()->assertJsonPath('gst_reminder_enabled', $enabled);
    }

    private function clientReminders(): array
    {
        Sanctum::actingAs(User::find($this->clientUser->id)); // fresh instance: relations cached on a reused model would be stale

        return $this->getJson('/api/client/gst-filing/reminders')->assertOk()->json('reminders');
    }

    public function test_reminder_is_off_by_default_and_client_sees_nothing(): void
    {
        $this->assertFalse((bool) $this->profile->fresh()->gst_reminder_enabled);
        $this->assertSame([], $this->clientReminders());
    }

    public function test_admin_turning_it_on_shows_reminders_and_turning_it_off_hides_them(): void
    {
        $this->adminSetsReminder(true);
        $on = $this->clientReminders();
        $this->assertNotEmpty($on);
        $this->assertContains('GSTR-1', array_column($on, 'return_type'));

        $this->adminSetsReminder(false);
        $this->assertSame([], $this->clientReminders());
    }
}
