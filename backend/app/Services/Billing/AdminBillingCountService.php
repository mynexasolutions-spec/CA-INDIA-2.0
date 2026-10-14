<?php

namespace App\Services\Billing;

use App\Models\ClientProfile;
use App\Models\CommercialDocument;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AdminBillingCountService
{
    public const MIN_START_YEAR = 2026;

    public const DOCUMENT_TYPES = [
        'tax_invoice',
        'bill_of_supply',
        'debit_note',
        'credit_note',
        'quotation',
        'delivery_challan',
    ];

    public const COUNTED_STATUSES = [
        'issued',
        'paid',
        'partial',
        'cancelled',
    ];

    public const CONSTITUTION_OPTIONS = [
        'Proprietorship',
        'Partnership Firm',
        'LLP',
        'Private Limited Company',
        'Individual',
        'One Person Company',
        'Trust',
        'Society',
    ];

    public const CONSTITUTION_ALIASES = [
        'Partnership Firm' => ['Partnership Firm', 'Partnership'],
        'Partnership' => ['Partnership Firm', 'Partnership'],
        'Private Limited Company' => ['Private Limited Company', 'Private Limited'],
        'Private Limited' => ['Private Limited Company', 'Private Limited'],
    ];

    /**
     * Validate and resolve the financial year parameter.
     *
     * @throws ValidationException
     */
    public function resolveFy(?string $fy): array
    {
        if ($fy !== null && trim($fy) !== '') {
            $fy = trim($fy);
            if (! preg_match('/^(\d{4})-(\d{2})$/', $fy, $matches)) {
                throw ValidationException::withMessages([
                    'fy' => ['Invalid Financial Year format. Expected format: YYYY-YY (e.g. 2026-27).'],
                ]);
            }

            $startYear = (int) $matches[1];
            $endYearSuffix = (int) $matches[2];
            $expectedSuffix = ($startYear + 1) % 100;

            if ($endYearSuffix !== $expectedSuffix) {
                throw ValidationException::withMessages([
                    'fy' => ["Invalid Financial Year range. For {$startYear}, expected suffix is " . sprintf('%02d', $expectedSuffix) . '.'],
                ]);
            }

            if ($startYear < self::MIN_START_YEAR) {
                throw ValidationException::withMessages([
                    'fy' => ['Financial Year cannot be earlier than ' . self::MIN_START_YEAR . '-' . sprintf('%02d', (self::MIN_START_YEAR + 1) % 100) . '.'],
                ]);
            }
        } else {
            $tz = config('app.timezone') ?: 'Asia/Kolkata';
            $now = Carbon::now($tz);
            $startYear = $now->month >= 4 ? $now->year : $now->year - 1;
            $startYear = max($startYear, self::MIN_START_YEAR);
            $fy = sprintf('%04d-%02d', $startYear, ($startYear + 1) % 100);
        }

        $from = sprintf('%04d-04-01', $startYear);
        $to = sprintf('%04d-03-31', $startYear + 1);

        return [
            'fy' => $fy,
            'start_year' => $startYear,
            'from' => $from,
            'to' => $to,
        ];
    }

    /**
     * Global count across all clients in the FY for the top 6 cards.
     */
    public function getGlobalCardCounts(string $from, string $to): array
    {
        $rows = CommercialDocument::query()
            ->whereBetween('document_date', [$from, $to])
            ->whereIn('status', self::COUNTED_STATUSES)
            ->whereIn('type', self::DOCUMENT_TYPES)
            ->select('type', DB::raw('count(*) as aggregate_count'))
            ->groupBy('type')
            ->pluck('aggregate_count', 'type')
            ->all();

        $counts = [];
        foreach (self::DOCUMENT_TYPES as $type) {
            $counts[$type] = (int) ($rows[$type] ?? 0);
        }

        return $counts;
    }

    /**
     * Client-specific dashboard counts: 7 cards, donut, and 12-month trend.
     */
    public function getClientDashboardData(int $clientProfileId, int $startYear, string $from, string $to): array
    {
        // 1. Counts per document type
        $rows = CommercialDocument::query()
            ->where('client_profile_id', $clientProfileId)
            ->whereBetween('document_date', [$from, $to])
            ->whereIn('status', self::COUNTED_STATUSES)
            ->whereIn('type', self::DOCUMENT_TYPES)
            ->select('type', DB::raw('count(*) as aggregate_count'))
            ->groupBy('type')
            ->pluck('aggregate_count', 'type')
            ->all();

        $cards = [];
        $total = 0;
        foreach (self::DOCUMENT_TYPES as $type) {
            $c = (int) ($rows[$type] ?? 0);
            $cards[$type] = $c;
            $total += $c;
        }
        $cards['total'] = $total;

        // 2. Donut breakdown
        $donut = [];
        foreach (self::DOCUMENT_TYPES as $type) {
            $donut[] = [
                'type' => $type,
                'count' => $cards[$type],
            ];
        }

        // 3. 12-month document trend (DB-portable)
        $dailyDocs = CommercialDocument::query()
            ->where('client_profile_id', $clientProfileId)
            ->whereBetween('document_date', [$from, $to])
            ->whereIn('status', self::COUNTED_STATUSES)
            ->whereIn('type', self::DOCUMENT_TYPES)
            ->select('document_date', 'type', DB::raw('count(*) as count'))
            ->groupBy('document_date', 'type')
            ->get();

        // Bucket by YYYY-MM
        $bucketed = [];
        foreach ($dailyDocs as $row) {
            $monthKey = substr((string) $row->document_date, 0, 7);
            if (! isset($bucketed[$monthKey])) {
                $bucketed[$monthKey] = [
                    'count' => 0,
                    'types' => array_fill_keys(self::DOCUMENT_TYPES, 0),
                ];
            }
            $cnt = (int) $row->count;
            $bucketed[$monthKey]['count'] += $cnt;
            if (isset($bucketed[$monthKey]['types'][$row->type])) {
                $bucketed[$monthKey]['types'][$row->type] += $cnt;
            }
        }

        // Generate full 12 months (April of startYear through March of startYear + 1)
        $monthlyTrend = [];
        for ($i = 0; $i < 12; $i++) {
            $monthNum = ($i + 4) <= 12 ? ($i + 4) : ($i + 4 - 12);
            $yearNum = ($i + 4) <= 12 ? $startYear : ($startYear + 1);
            $monthKey = sprintf('%04d-%02d', $yearNum, $monthNum);

            $dateObj = Carbon::create($yearNum, $monthNum, 1);
            $monthData = $bucketed[$monthKey] ?? [
                'count' => 0,
                'types' => array_fill_keys(self::DOCUMENT_TYPES, 0),
            ];

            $monthlyTrend[] = [
                'month' => $monthKey,
                'label' => $dateObj->format('M Y'),
                'short_month' => $dateObj->format('M'),
                'year' => $yearNum,
                'count' => $monthData['count'],
                'types' => $monthData['types'],
            ];
        }

        return [
            'cards' => $cards,
            'donut' => $donut,
            'total' => $total,
            'monthly_trend' => $monthlyTrend,
        ];
    }

    /**
     * Clean address formatting with no stray dashes.
     */
    public function formatAddress(ClientProfile $profile): ?string
    {
        $parts = array_filter([
            trim((string) $profile->address_line_1),
            trim((string) $profile->address_line_2),
            trim((string) $profile->city),
        ], fn ($v) => $v !== '');

        $state = trim((string) $profile->state);
        $pincode = trim((string) $profile->pincode);

        if ($state !== '' && $pincode !== '') {
            $parts[] = "{$state} - {$pincode}";
        } elseif ($state !== '') {
            $parts[] = $state;
        } elseif ($pincode !== '') {
            $parts[] = $pincode;
        }

        if (! empty($parts)) {
            return implode(', ', $parts);
        }

        $legacy = trim((string) $profile->address);
        return $legacy !== '' ? $legacy : null;
    }

    /**
     * Mask GST fields when GST is OFF.
     */
    public function maskGstFields(ClientProfile $profile): array
    {
        if (! $profile->has_gst) {
            return [
                'has_gst' => false,
                'gstin' => null,
                'registration_type' => null,
            ];
        }

        $regType = $profile->registration_type;
        if (! $regType && $profile->dealer_type) {
            $regType = ucfirst($profile->dealer_type);
        }

        return [
            'has_gst' => true,
            'gstin' => $profile->gstin,
            'registration_type' => $regType,
        ];
    }
}
