<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\User;
use App\Services\EmailOtp;
use Illuminate\Support\Facades\Cache;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    private const OTP_TTL_MINUTES = 10;
    private const OTP_MAX_ATTEMPTS = 5;
    private const OTP_RESET_TOKEN_TTL_MINUTES = 10;

    /**
     * Resolve a user by their system email, client profile contact email,
     * user ID prefix, or client code (e.g. CL-005).
     */
    private function findUserByIdentifier(?string $identifier): ?User
    {
        if (!$identifier) {
            return null;
        }

        $idClean = trim($identifier);
        if ($idClean === '') {
            return null;
        }

        // 1. Direct match on users.email
        $user = User::where('email', $idClean)->first();
        if ($user) {
            return $user;
        }

        // 2. Match on client_profiles.email (client's registered contact email)
        $profile = \App\Models\ClientProfile::where('email', $idClean)->first();
        if ($profile && $profile->user) {
            return $profile->user;
        }

        // 3. Match on users.email with domain appended if user typed user-id without domain
        if (! str_contains($idClean, '@')) {
            $user = User::where('email', strtolower($idClean) . '@abkhanassociates.com')->first();
            if ($user) {
                return $user;
            }
        }

        // 4. Match on client_profiles.client_code (e.g. CL-005)
        $profile = \App\Models\ClientProfile::where('client_code', strtoupper($idClean))->first();
        if ($profile && $profile->user) {
            return $profile->user;
        }

        // 5. Match on client_profiles.alt_email
        $profile = \App\Models\ClientProfile::where('alt_email', $idClean)->first();
        if ($profile && $profile->user) {
            return $profile->user;
        }

        return null;
    }

    public function login(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|string',
            'password' => 'required',
            'portal' => 'nullable|in:admin,client',
        ]);

        $user = $this->findUserByIdentifier($data['email']);
        if (!$user || !Hash::check($data['password'], $user->password) || !$user->is_active) {
            throw ValidationException::withMessages(['email' => ['Invalid credentials.']]);
        }

        $portal = $data['portal'] ?? null;
        if (! $portal) {
            $portal = $user->isClient() ? 'client' : 'admin';
        }
        if ($portal === 'admin' && ! $user->isStaff()) {
            throw ValidationException::withMessages(['email' => ['This account is not authorized for the admin portal.']]);
        }
        if ($portal === 'client' && ! $user->isClient()) {
            throw ValidationException::withMessages(['email' => ['This account is not authorized for the client portal.']]);
        }

        // Settings -> Admin Security -> "Two-Factor Authentication (Email OTP)": the password alone is not
        // enough — no session is issued until the emailed code is verified.
        if ($portal === 'admin' && $user->login_2fa_enabled) {
            $challenge = bin2hex(random_bytes(20));
            $dev = EmailOtp::send("login_{$challenge}", $user, 'admin login', ['portal' => $portal]);

            return response()->json([
                'two_factor' => true,
                'challenge'  => $challenge,
                'email'      => EmailOtp::mask($user->email),
                'expires_in' => EmailOtp::TTL_MINUTES * 60,
                '_dev_otp'   => $dev,
            ]);
        }

        return $this->startSession($request, $user, $portal);
    }

    /** Second step of a two-factor login: the code that was emailed after the password was accepted. */
    public function verifyLoginOtp(Request $request)
    {
        $data = $request->validate(['challenge' => 'required|string|size:40', 'otp' => 'required|string|size:6']);

        $res = EmailOtp::check("login_{$data['challenge']}", $data['otp']);
        if (! $res['ok']) {
            throw ValidationException::withMessages(['otp' => [$res['error']]]);
        }

        $user = User::find($res['data']['user_id']);
        if (! $user || ! $user->is_active || ! $user->isStaff()) {
            throw ValidationException::withMessages(['otp' => ['This account cannot sign in.']]);
        }

        return $this->startSession($request, $user, $res['data']['portal'] ?? 'admin');
    }

    /** Sends a fresh code for a pending two-factor login (the old one stops working). */
    public function resendLoginOtp(Request $request)
    {
        $data = $request->validate(['challenge' => 'required|string|size:40']);

        $pending = Cache::get("email_otp_login_{$data['challenge']}");
        $user = $pending ? User::find($pending['user_id']) : null;
        if (! $user) {
            throw ValidationException::withMessages(['otp' => ['This sign-in has expired. Please sign in again.']]);
        }

        $dev = EmailOtp::send("login_{$data['challenge']}", $user, 'admin login', ['portal' => $pending['portal'] ?? 'admin']);

        return response()->json(['sent' => true, 'email' => EmailOtp::mask($user->email), '_dev_otp' => $dev]);
    }

    private function startSession(Request $request, User $user, string $portal)
    {
        $user->update(['last_login_at' => now()]);
        ActivityLog::create([
            'user_id' => $user->id,
            'action' => 'login',
            'ip_address' => $request->ip(),
        ]);

        $token = $user->createToken($portal . '-token')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $this->userPayload($user),
        ]);
    }

    public function me(Request $request)
    {
        return response()->json(['user' => $this->userPayload($request->user())]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        \Illuminate\Support\Facades\Cache::forget(
            \App\Http\Controllers\Api\Admin\ClientsUnlockController::cacheKey($request->user()->id)
        );
        return response()->json(['message' => 'Logged out']);
    }

    public function forgotPassword(Request $request)
    {
        $data = $request->validate(['email' => 'required|string']);
        $user = $this->findUserByIdentifier($data['email']);
        if ($user) {
            $token = Str::random(64);
            DB::table('password_reset_tokens')->updateOrInsert(
                ['email' => $user->email],
                ['token' => Hash::make($token), 'created_at' => now()]
            );
            try {
                Mail::raw("Reset your password using this token on the portal:\n\n$token\n\nOr contact the firm for assistance.", function ($m) use ($user) {
                    $m->to($user->email)->subject('Password reset - A B KHAN & ASSOCIATES');
                });
            } catch (\Throwable $e) {}
        }
        return response()->json(['message' => 'If the email exists, a reset link has been sent.']);
    }

    public function resetPassword(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|string',
            'token' => 'required|string',
            'password' => 'required|string|min:8|confirmed',
        ]);
        $user = $this->findUserByIdentifier($data['email']);
        if (! $user) {
            throw ValidationException::withMessages(['email' => ['Invalid or expired reset token.']]);
        }
        $row = DB::table('password_reset_tokens')->where('email', $user->email)->first();
        if (!$row || !Hash::check($data['token'], $row->token)) {
            throw ValidationException::withMessages(['email' => ['Invalid or expired reset token.']]);
        }
        $user->update([
            'password' => Hash::make($data['password']),
            'password_updated_at' => now(),
            'password_updated_by' => 'client',
        ]);
        DB::table('password_reset_tokens')->where('email', $user->email)->delete();
        return response()->json(['message' => 'Password updated. You can sign in now.']);
    }

    /** Step 1: email submitted, generate + email a 6-digit OTP. */
    public function otpRequest(Request $request)
    {
        $data = $request->validate(['email' => 'required|email']);
        $user = User::where('email', $data['email'])->first();
        if ($user) {
            $otp = (string) random_int(100000, 999999);
            DB::table('password_reset_otps')->updateOrInsert(
                ['email' => $user->email],
                [
                    'otp_hash' => Hash::make($otp),
                    'attempts' => 0,
                    'expires_at' => now()->addMinutes(self::OTP_TTL_MINUTES),
                    'reset_token_hash' => null,
                    'reset_token_expires_at' => null,
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );
            try {
                Mail::raw(
                    "Your A B KHAN & ASSOCIATES password reset OTP is: {$otp}\n\n".
                    'This code is valid for '.self::OTP_TTL_MINUTES." minutes.\n\n".
                    "If you did not request this, you can safely ignore this email.",
                    function ($m) use ($user) {
                        $m->to($user->email)->subject('Your password reset OTP - A B KHAN & ASSOCIATES');
                    }
                );
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning('OTP mail failed: '.$e->getMessage());
            }
        }

        // Same response whether or not the account exists, so we never leak which emails are registered.
        return response()->json([
            'message' => 'If an account exists for this email, a verification OTP has been sent.',
            'ttl_minutes' => self::OTP_TTL_MINUTES,
        ]);
    }

    /** Step 3: verify the OTP, issue a short-lived reset token for the final step. */
    public function otpVerify(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|email',
            'otp' => 'required|string',
        ]);

        $row = DB::table('password_reset_otps')->where('email', $data['email'])->first();
        if (!$row || now()->gt($row->expires_at)) {
            throw ValidationException::withMessages(['otp' => ['This OTP has expired. Please request a new one.']]);
        }
        if ($row->attempts >= self::OTP_MAX_ATTEMPTS) {
            throw ValidationException::withMessages(['otp' => ['Too many incorrect attempts. Please request a new OTP.']]);
        }
        if (!Hash::check($data['otp'], $row->otp_hash)) {
            DB::table('password_reset_otps')->where('email', $data['email'])->increment('attempts');
            throw ValidationException::withMessages(['otp' => ['The OTP you entered is incorrect.']]);
        }

        $resetToken = Str::random(48);
        DB::table('password_reset_otps')->where('email', $data['email'])->update([
            'reset_token_hash' => Hash::make($resetToken),
            'reset_token_expires_at' => now()->addMinutes(self::OTP_RESET_TOKEN_TTL_MINUTES),
            'updated_at' => now(),
        ]);

        return response()->json(['message' => 'OTP verified.', 'reset_token' => $resetToken]);
    }

    /** Step 4: set the new password using the token issued after OTP verification. */
    public function otpResetPassword(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|email',
            'reset_token' => 'required|string',
            'password' => [
                'required', 'string', 'min:8', 'confirmed',
                'regex:/[a-z]/', 'regex:/[A-Z]/', 'regex:/[0-9]/', 'regex:/[^a-zA-Z0-9]/',
            ],
        ]);

        $row = DB::table('password_reset_otps')->where('email', $data['email'])->first();
        $tokenValid = $row
            && $row->reset_token_hash
            && now()->lte($row->reset_token_expires_at)
            && Hash::check($data['reset_token'], $row->reset_token_hash);

        if (!$tokenValid) {
            throw ValidationException::withMessages(['reset_token' => ['This session has expired. Please start the reset process again.']]);
        }

        $user = User::where('email', $data['email'])->firstOrFail();
        $user->update([
            'password' => Hash::make($data['password']),
            'password_updated_at' => now(),
            'password_updated_by' => 'client',
        ]);
        DB::table('password_reset_otps')->where('email', $data['email'])->delete();

        return response()->json(['message' => 'Your password has been reset successfully.']);
    }

    /** Change password while logged in (Admin or Client portal). */
    public function changePassword(Request $request)
    {
        $data = $request->validate([
            'current_password' => 'required|string',
            'password' => [
                'required',
                'string',
                'confirmed',
                Password::min(8)->mixedCase()->numbers()->symbols()->uncompromised(),
            ],
        ]);

        $user = $request->user();
        if (! Hash::check($data['current_password'], $user->password)) {
            throw ValidationException::withMessages(['current_password' => ['Current password is incorrect.']]);
        }

        $user->update([
            'password' => Hash::make($data['password']),
            'password_updated_at' => now(),
            'password_updated_by' => $user->isClient() ? 'client' : 'admin',
        ]);
        ActivityLog::create([
            'user_id' => $user->id,
            'action' => 'changed_password',
            'ip_address' => $request->ip(),
        ]);

        return response()->json(['message' => 'Password updated successfully.']);
    }

    private function userPayload(User $user): array
    {
        $user->load('clientProfile');
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'phone' => $user->phone,
            'last_login_at' => $user->last_login_at?->toIso8601String(),
            'client_profile' => $user->clientProfile,
        ];
    }
}
