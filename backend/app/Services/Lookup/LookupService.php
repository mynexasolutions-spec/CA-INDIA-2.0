<?php

namespace App\Services\Lookup;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class LookupService
{
    private const CACHE_TTL_DAYS = 30;

    /**
     * Caches only SUCCESSFUL lookups. A timeout, an outage or an unknown code must not be remembered
     * for 30 days — the next attempt should simply try again.
     */
    private function rememberSuccess(string $key, \Closure $lookup): array
    {
        $hit = Cache::get($key);
        if (is_array($hit) && ($hit['success'] ?? false) === true) {
            return $hit;
        }

        $result = $lookup();
        if (($result['success'] ?? false) === true) {
            Cache::put($key, $result, now()->addDays(self::CACHE_TTL_DAYS));
        }

        return $result;
    }

    /**
     * Look up Indian PIN code.
     * Uses api.postalpincode.in with caching and graceful fallback.
     */
    public function lookupPin(string $pin): array
    {
        $cleanPin = trim($pin);

        if (! preg_match('/^\d{6}$/', $cleanPin)) {
            return [
                'success' => false,
                'message' => 'PIN code must be exactly 6 digits.',
            ];
        }

        $cacheKey = "lookup_pin_{$cleanPin}";

        return $this->rememberSuccess($cacheKey, function () use ($cleanPin) {
            try {
                $response = Http::timeout(5)
                    ->withoutVerifying()
                    ->withHeaders(['User-Agent' => 'CA-India-Admin-Portal/1.0 (Windows NT 10.0)'])
                    ->acceptJson()
                    ->get("https://api.postalpincode.in/pincode/{$cleanPin}");

                if (! $response->successful()) {
                    return [
                        'success' => false,
                        'message' => 'PIN code lookup service unavailable. You can enter the city manually.',
                    ];
                }

                $data = $response->json();
                if (! is_array($data) || empty($data[0]) || ($data[0]['Status'] ?? '') !== 'Success') {
                    return [
                        'success' => false,
                        'message' => 'Invalid or unknown PIN code. City must be entered manually.',
                    ];
                }

                $postOffices = $data[0]['PostOffice'] ?? [];
                if (empty($postOffices)) {
                    return [
                        'success' => false,
                        'message' => 'No postal records found for this PIN code.',
                    ];
                }

                $first = $postOffices[0];
                $division = $first['Division'] ?? '';
                $district = $first['District'] ?? '';

                if (stripos($division, 'New Mumbai') !== false || stripos($division, 'Navi Mumbai') !== false) {
                    $city = 'Navi Mumbai';
                } elseif (! empty($district)) {
                    $city = $district;
                } else {
                    $city = $first['Block'] ?? $first['Name'] ?? '';
                }

                $state = $first['State'] ?? '';

                return [
                    'success' => true,
                    'city' => $city,
                    'state' => $state,
                    'country' => 'India',
                    'pincode' => $cleanPin,
                ];
            } catch (\Throwable $e) {
                Log::warning("PIN lookup failed for {$cleanPin}: " . $e->getMessage());

                return [
                    'success' => false,
                    'message' => 'PIN code lookup timed out or failed. Please enter the city manually.',
                ];
            }
        });
    }

    /**
     * Look up Indian Bank IFSC code.
     * Uses ifsc.razorpay.com with caching and graceful fallback.
     */
    public function lookupIfsc(string $ifsc): array
    {
        $cleanIfsc = strtoupper(trim($ifsc));

        if (! preg_match('/^[A-Z]{4}0[A-Z0-9]{6}$/', $cleanIfsc)) {
            return [
                'success' => false,
                'message' => 'Invalid IFSC code format (e.g. HDFC0001234).',
            ];
        }

        $cacheKey = "lookup_ifsc_{$cleanIfsc}";

        return $this->rememberSuccess($cacheKey, function () use ($cleanIfsc) {
            try {
                $response = Http::timeout(5)
                    ->withoutVerifying()
                    ->withHeaders(['User-Agent' => 'CA-India-Admin-Portal/1.0'])
                    ->acceptJson()
                    ->get("https://ifsc.razorpay.com/{$cleanIfsc}");

                if ($response->status() === 404) {
                    return [
                        'success' => false,
                        'message' => 'IFSC code not found. Bank name and branch can be entered manually.',
                    ];
                }

                if (! $response->successful()) {
                    return [
                        'success' => false,
                        'message' => 'IFSC lookup service unavailable. You can enter bank details manually.',
                    ];
                }

                $data = $response->json();

                return [
                    'success' => true,
                    'ifsc' => $cleanIfsc,
                    'bank_name' => $data['BANK'] ?? '',
                    'bank' => $data['BANK'] ?? '',
                    'branch' => $data['BRANCH'] ?? '',
                    'bank_branch' => $data['BRANCH'] ?? '',
                    'swift_code' => $data['SWIFT'] ?? '',
                    'city' => $data['CITY'] ?? '',
                    'state' => $data['STATE'] ?? '',
                ];
            } catch (\Throwable $e) {
                Log::warning("IFSC lookup failed for {$cleanIfsc}: " . $e->getMessage());

                return [
                    'success' => false,
                    'message' => 'IFSC lookup timed out or failed. Please enter bank details manually.',
                ];
            }
        });
    }
}
