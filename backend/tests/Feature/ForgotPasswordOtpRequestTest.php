<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class ForgotPasswordOtpRequestTest extends TestCase
{
    use RefreshDatabase;

    public function test_unknown_email_returns_user_does_not_exist(): void
    {
        Mail::fake();

        $res = $this->postJson('/api/auth/otp/request', ['email' => 'nobody@example.com']);

        $res->assertStatus(422)->assertJsonPath('message', 'User does not exist.');
        $this->assertDatabaseMissing('password_reset_otps', ['email' => 'nobody@example.com']);
    }

    public function test_registered_email_stores_otp_and_succeeds(): void
    {
        $user = User::factory()->create(['email' => 'known@example.com']);

        $res = $this->postJson('/api/auth/otp/request', ['email' => $user->email]);

        $res->assertOk();
        $this->assertDatabaseHas('password_reset_otps', ['email' => 'known@example.com']);
    }
}
