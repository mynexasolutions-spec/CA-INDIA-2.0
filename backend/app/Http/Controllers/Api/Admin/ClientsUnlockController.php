<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\EmailOtp;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;

class ClientsUnlockController extends Controller
{
    public const CACHE_MINUTES = 60;

    public static function cacheKey(int $userId): string
    {
        return "admin_clients_unlock_{$userId}";
    }

    public static function isUnlocked(int $userId): bool
    {
        return (bool) Cache::get(self::cacheKey($userId));
    }

    public function status(Request $request)
    {
        $user = $request->user();
        $unlocked = self::isUnlocked($user->id);

        return response()->json([
            'unlocked' => $unlocked,
            'expires_in_minutes' => $unlocked ? self::CACHE_MINUTES : 0,
            // How this admin chose to verify (Settings -> Admin Security): secondary | 2fa
            'method' => $user->clients_verify_method === '2fa' ? '2fa' : 'secondary',
            'secondary_password_set' => ! empty($user->clients_secondary_password),
        ]);
    }

    /** Email OTP method: sends the code that unlock() then expects. */
    public function sendOtp(Request $request)
    {
        $user = $request->user();
        abort_unless($user->clients_verify_method === '2fa', 422, 'Email verification is not enabled for the Clients module.');

        $dev = EmailOtp::send("clients_unlock_{$user->id}", $user, 'opening the Clients module');

        return response()->json(['sent' => true, 'email' => EmailOtp::mask($user->otpEmail()), '_dev_otp' => $dev]);
    }

    /**
     * Opens the Clients module using the method chosen in Settings -> Admin Security:
     *  - Secondary Password: the separate Clients password (NOT the login password).
     *  - Two-Factor (Email OTP): the code emailed by sendOtp().
     */
    public function unlock(Request $request)
    {
        $user = $request->user();

        if ($user->clients_verify_method === '2fa') {
            $data = $request->validate(['otp' => 'required|string|size:6']);
            $res = EmailOtp::check("clients_unlock_{$user->id}", $data['otp']);
            if (! $res['ok']) {
                return response()->json(['message' => $res['error']], 422);
            }
        } else {
            $data = $request->validate(['password' => 'required|string']);
            if (empty($user->clients_secondary_password)) {
                return response()->json(['message' => 'No secondary password is set yet. Set one under Settings → Admin Security.'], 422);
            }
            if (! Hash::check($data['password'], $user->clients_secondary_password)) {
                return response()->json(['message' => 'Invalid secondary password.'], 422);
            }
        }

        Cache::put(self::cacheKey($user->id), now()->toIso8601String(), now()->addMinutes(self::CACHE_MINUTES));

        return response()->json([
            'unlocked' => true,
            'expires_in_minutes' => self::CACHE_MINUTES,
            'message' => 'Clients module unlocked.',
        ]);
    }

    public function lock(Request $request)
    {
        Cache::forget(self::cacheKey($request->user()->id));

        return response()->json(['unlocked' => false]);
    }
}
