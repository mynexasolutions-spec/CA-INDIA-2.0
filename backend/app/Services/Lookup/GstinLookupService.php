<?php

namespace App\Services\Lookup;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * GSTIN verification through an authorised GST API provider (GSP).
 *
 * The provider and its credentials live ONLY in the backend environment:
 *   GST_API_URL         e.g. https://gsp.example.com/taxpayer/{gstin}      ({gstin} is replaced)
 *   GST_API_KEY         API key / bearer token
 *   GST_API_KEY_HEADER  header to send the key in (default: Authorization -> "Bearer <key>")
 *   GST_API_SECRET      optional second secret, sent as X-Api-Secret
 *
 * Without that configuration nothing is guessed or scraped: the caller gets a clear
 * "not configured" error and the user can still enter the company details manually.
 */
class GstinLookupService
{
    public const FORMAT = '/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/';

    private const STATES = [
        '01' => 'Jammu and Kashmir', '02' => 'Himachal Pradesh', '03' => 'Punjab', '04' => 'Chandigarh',
        '05' => 'Uttarakhand', '06' => 'Haryana', '07' => 'Delhi', '08' => 'Rajasthan', '09' => 'Uttar Pradesh',
        '10' => 'Bihar', '11' => 'Sikkim', '12' => 'Arunachal Pradesh', '13' => 'Nagaland', '14' => 'Manipur',
        '15' => 'Mizoram', '16' => 'Tripura', '17' => 'Meghalaya', '18' => 'Assam', '19' => 'West Bengal',
        '20' => 'Jharkhand', '21' => 'Odisha', '22' => 'Chhattisgarh', '23' => 'Madhya Pradesh', '24' => 'Gujarat',
        '26' => 'Dadra and Nagar Haveli and Daman and Diu', '27' => 'Maharashtra', '29' => 'Karnataka', '30' => 'Goa',
        '31' => 'Lakshadweep', '32' => 'Kerala', '33' => 'Tamil Nadu', '34' => 'Puducherry',
        '35' => 'Andaman and Nicobar Islands', '36' => 'Telangana', '37' => 'Andhra Pradesh', '38' => 'Ladakh',
        '97' => 'Other Territory',
    ];

    public function configured(): bool
    {
        return filled(config('services.gst.url')) && filled(config('services.gst.key'));
    }

    /**
     * @return array{ok: bool, status: int, message?: string, data?: array}
     */
    public function lookup(string $gstin): array
    {
        $gstin = strtoupper(trim($gstin));

        if (! preg_match(self::FORMAT, $gstin)) {
            return $this->fail(422, 'Invalid GSTIN format. Please enter a valid 15-character GSTIN (e.g. 27ABCDE1234F1Z5).');
        }

        if (! $this->configured()) {
            return $this->fail(503, 'GST verification is not set up yet. Please enter the company details manually, or ask your administrator to configure the GST API.');
        }

        $cacheKey = 'gstin_lookup_'.$gstin;
        if ($hit = Cache::get($cacheKey)) {
            return ['ok' => true, 'status' => 200, 'data' => $hit];
        }

        try {
            $headers = ['Accept' => 'application/json'];
            $key = (string) config('services.gst.key');
            $keyHeader = (string) (config('services.gst.key_header') ?: 'Authorization');
            $headers[$keyHeader] = strcasecmp($keyHeader, 'Authorization') === 0 ? 'Bearer '.$key : $key;
            if (filled(config('services.gst.secret'))) {
                $headers['X-Api-Secret'] = (string) config('services.gst.secret');
            }

            $url = str_replace('{gstin}', $gstin, (string) config('services.gst.url'));
            $response = Http::timeout(12)->withHeaders($headers)->get($url);
        } catch (\Throwable $e) {
            return $this->fail(503, 'The GST service could not be reached. Please try again, or enter the details manually.');
        }

        if ($response->status() === 404) {
            return $this->fail(404, 'GSTIN not found. Please check the number and try again.');
        }
        if (in_array($response->status(), [401, 403], true)) {
            // A server-side credential problem — never leak details to the browser.
            return $this->fail(503, 'GST verification is temporarily unavailable. Please enter the details manually.');
        }
        if (! $response->successful()) {
            return $this->fail(503, 'GST verification failed. Please try again, or enter the details manually.');
        }

        $body = $response->json();
        // Providers wrap the taxpayer record differently.
        $t = $body['data'] ?? $body['result'] ?? $body['taxpayerInfo'] ?? $body['taxpayer'] ?? $body;
        $t = $t['taxpayerInfo'] ?? $t;

        $legal = trim((string) ($t['lgnm'] ?? $t['legal_name'] ?? $t['legalName'] ?? ''));
        if ($legal === '' && empty($t['tradeNam'] ?? $t['trade_name'] ?? '')) {
            return $this->fail(404, 'GSTIN not found. Please check the number and try again.');
        }

        $status = strtolower(trim((string) ($t['sts'] ?? $t['status'] ?? $t['gstin_status'] ?? 'active')));
        if ($status !== '' && ! in_array($status, ['active', 'act'], true)) {
            $pretty = ucfirst($status);

            return $this->fail(422, "This GSTIN is {$pretty}. Only active GSTINs can be added.");
        }

        $addr = $t['pradr']['addr'] ?? $t['pradr'] ?? $t['address'] ?? [];
        if (is_string($addr)) {
            $address = $addr;
        } else {
            $address = implode(', ', array_filter([
                $addr['bno'] ?? '', $addr['flno'] ?? '', $addr['bnm'] ?? '', $addr['st'] ?? '',
                $addr['loc'] ?? '', $addr['dst'] ?? '', $addr['stcd'] ?? '', $addr['pncd'] ?? '',
            ], fn ($p) => $p !== '' && $p !== null));
        }

        $code = substr($gstin, 0, 2);
        $data = [
            'gstin'         => $gstin,
            'legal_name'    => $legal,
            'trade_name'    => trim((string) ($t['tradeNam'] ?? $t['trade_name'] ?? $t['tradeName'] ?? '')),
            'status'        => 'active',
            'state_code'    => $code,
            'state'         => self::STATES[$code] ?? '',
            'address'       => $address,
            'business_type' => (string) ($t['ctb'] ?? $t['constitution'] ?? ''),
        ];

        Cache::put($cacheKey, $data, now()->addDay());

        return ['ok' => true, 'status' => 200, 'data' => $data];
    }

    private function fail(int $status, string $message): array
    {
        return ['ok' => false, 'status' => $status, 'message' => $message];
    }
}
