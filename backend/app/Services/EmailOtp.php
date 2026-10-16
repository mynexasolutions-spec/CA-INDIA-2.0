<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;

/**
 * Six-digit one-time codes sent to a user's registered email (admin login 2FA, Clients-module
 * access). A code lives 5 minutes, allows 5 wrong tries, and is single-use.
 */
class EmailOtp
{
    public const TTL_MINUTES = 5;
    public const MAX_ATTEMPTS = 5;

    public static function mask(string $email): string
    {
        [$local, $domain] = array_pad(explode('@', $email, 2), 2, '');

        return substr($local, 0, 2).str_repeat('*', max(1, strlen($local) - 2)).'@'.$domain;
    }

    /**
     * Creates and emails a code under $key. $extra is kept alongside it (e.g. user id, portal).
     * Returns the code only when running locally with debug on, so developers can finish the flow
     * without a mail server — never in production.
     */
    public static function send(string $key, User $user, string $purpose, array $extra = []): ?string
    {
        $otp = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        Cache::put("email_otp_{$key}", $extra + ['otp' => $otp, 'attempts' => 0, 'user_id' => $user->id], now()->addMinutes(self::TTL_MINUTES));

        Mail::raw(
            "Your one-time code for {$purpose} is: {$otp}\n\nIt is valid for ".self::TTL_MINUTES." minutes. If you did not request this, ignore this email and do not share the code.",
            fn ($m) => $m->to($user->email)->subject('Your verification code')
        );

        return app()->environment('local') && config('app.debug') ? $otp : null;
    }

    /** @return array{ok: bool, error: ?string, data: ?array} */
    public static function check(string $key, string $otp): array
    {
        $cacheKey = "email_otp_{$key}";
        $data = Cache::get($cacheKey);

        if (! $data) {
            return ['ok' => false, 'error' => 'The code has expired. Please request a new one.', 'data' => null];
        }

        if (! hash_equals((string) $data['otp'], trim($otp))) {
            $data['attempts']++;
            if ($data['attempts'] >= self::MAX_ATTEMPTS) {
                Cache::forget($cacheKey);

                return ['ok' => false, 'error' => 'Too many incorrect attempts. Please request a new code.', 'data' => null];
            }
            Cache::put($cacheKey, $data, now()->addMinutes(self::TTL_MINUTES));

            return ['ok' => false, 'error' => 'Incorrect code.', 'data' => null];
        }

        Cache::forget($cacheKey); // single use

        return ['ok' => true, 'error' => null, 'data' => $data];
    }
}
