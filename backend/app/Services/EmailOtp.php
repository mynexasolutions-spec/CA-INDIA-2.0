<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
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
     * Always returns null: the code is never exposed to the client, only emailed.
     */
    public static function send(string $key, User $user, string $purpose, array $extra = []): ?string
    {
        $otp = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        Cache::put("email_otp_{$key}", $extra + ['otp' => $otp, 'attempts' => 0, 'user_id' => $user->id], now()->addMinutes(self::TTL_MINUTES));

        $minutes = self::TTL_MINUTES;
        $text = "Your one-time code for {$purpose} is: {$otp}

It is valid for {$minutes} minutes. If you did not request this, ignore this email and do not share this code with anyone.

A B Khan & Associates";
        $html = self::html($otp, $purpose, $minutes);

        try {
            // Goes out through the default mailer — Brevo when MAIL_MAILER=brevo.
            Mail::send([], [], function ($m) use ($user, $html, $text) {
                $m->to($user->otpEmail())->subject('Your verification code')->html($html)->text($text);
            });
        } catch (\Throwable $e) {
            Cache::forget("email_otp_{$key}");
            Log::error('OTP email could not be sent', ['user_id' => $user->id, 'error' => $e->getMessage()]);
            abort(502, 'We could not send the verification code right now. Please try again in a moment.');
        }

        // The code is only ever delivered by email; it is never returned to the browser.
        return null;
    }

    /** Branded HTML body for the code email (table layout + inline styles so every mail client renders it). */
    private static function html(string $otp, string $purpose, int $minutes): string
    {
        $purpose = e($purpose);
        $cell = 'width:46px;height:58px;text-align:center;font:800 28px/58px Arial,Helvetica,sans-serif;color:#ffffff;background:#1d4ed8;background-image:linear-gradient(160deg,#3b72e8,#1d4ed8);border-radius:12px;';
        $digits = implode('<td style="width:8px"></td>', array_map(
            fn ($d) => '<td style="'.$cell.'" bgcolor="#1d4ed8" width="46" height="58" align="center">'.$d.'</td>',
            str_split($otp)
        ));
        $font = 'font-family:Arial,Helvetica,sans-serif;';
        // Mail clients can only load a public https image, so the logo comes from the live site (override with MAIL_LOGO_URL).
        $logo = env('MAIL_LOGO_URL') ?: rtrim((string) config('app.url'), '/').'/assets/ca-india-logo.png';

        return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>'
            .'<body style="margin:0;padding:0;background:#eef3fb;">'
            .'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#eef3fb" style="background:#eef3fb;padding:32px 12px;"><tr><td align="center">'
            // card
            .'<table role="presentation" width="520" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width:520px;width:100%;background:#ffffff;border-radius:22px;border:1px solid #dbe6f7;overflow:hidden;">'
            // header band
            .'<tr><td bgcolor="#0e3270" style="background:#0e3270;background-image:linear-gradient(135deg,#0a2a5e,#1d4ed8);padding:26px 32px;">'
            .'<table role="presentation" cellpadding="0" cellspacing="0"><tr>'
            .'<td align="center" bgcolor="#ffffff" style="background:#ffffff;border-radius:14px;padding:6px 8px;"><img src="'.e($logo).'" alt="CA India" width="70" style="display:block;width:70px;height:auto;border:0;outline:none;text-decoration:none;'.$font.'font-weight:800;font-size:16px;color:#0a2a5e;"></td>'
            .'<td style="padding-left:14px;'.$font.'">'
            .'<div style="font-size:18px;font-weight:800;color:#ffffff;letter-spacing:-0.2px;">A B Khan &amp; Associates</div>'
            .'<div style="font-size:11px;font-weight:700;color:#b9cdf5;letter-spacing:1.6px;text-transform:uppercase;padding-top:3px;">Chartered Accountants</div>'
            .'</td></tr></table></td></tr>'
            // title
            .'<tr><td style="padding:30px 32px 6px;'.$font.'font-size:24px;font-weight:800;color:#0f2a5f;letter-spacing:-0.4px;">Your verification code</td></tr>'
            .'<tr><td style="padding:0 32px 22px;'.$font.'font-size:15px;line-height:1.6;color:#475b7a;">Use the code below for <strong style="color:#0f2a5f;">'.$purpose.'</strong>.</td></tr>'
            // code
            .'<tr><td align="center" style="padding:0 32px 8px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr>'.$digits.'</tr></table></td></tr>'
            .'<tr><td align="center" style="padding:14px 32px 26px;'.$font.'font-size:13px;font-weight:700;color:#1d4ed8;">Valid for '.$minutes.' minutes &middot; single use</td></tr>'
            // security note
            .'<tr><td style="padding:0 32px 28px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
            .'<td bgcolor="#fff8e6" style="background:#fff8e6;border:1px solid #f5dfa0;border-radius:14px;padding:14px 16px;'.$font.'font-size:13px;line-height:1.6;color:#7a4a07;">'
            .'<strong>Keep this code private.</strong> Our team will never ask you for it. If you did not request it, you can safely ignore this email.'
            .'</td></tr></table></td></tr>'
            // footer
            .'<tr><td bgcolor="#f6f9fe" style="background:#f6f9fe;border-top:1px solid #e3ebf7;padding:18px 32px;'.$font.'font-size:12px;line-height:1.6;color:#7a8aa6;">'
            .'This is an automated message from A B Khan &amp; Associates. Please do not reply to this email.'
            .'</td></tr>'
            .'</table></td></tr></table></body></html>';
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
