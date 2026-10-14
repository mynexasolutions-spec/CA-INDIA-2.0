<?php

namespace App\Services\Gst;

use App\Models\ClientProfile;
use Carbon\Carbon;

class GstPeriodService
{
    /**
     * Indian FY: 1 Apr – 31 Mar. e.g. "2026-27" -> starts 2026.
     */
    public static function fyStartYear(?string $fy = null): int
    {
        if ($fy && preg_match('/^(\d{4})-\d{2}$/', $fy, $m)) {
            return (int) $m[1];
        }
        $now = now();

        return $now->month >= 4 ? $now->year : $now->year - 1;
    }

    /**
     * Indian FY quarter format matching buildPeriods() quarters:
     * Apr-Jun = YYYY-Q1
     * Jul-Sep = YYYY-Q2
     * Oct-Dec = YYYY-Q3
     * Jan-Mar = YYYY-Q4 (where YYYY is the calendar year of Jan-Mar)
     */
    public static function fyQuarterOf(mixed $date): string
    {
        $d = $date instanceof Carbon ? $date->copy() : Carbon::parse($date);
        $month = $d->month;
        $q = match (true) {
            $month >= 4 && $month <= 6 => 1,
            $month >= 7 && $month <= 9 => 2,
            $month >= 10 && $month <= 12 => 3,
            default => 4,
        };

        return "{$d->year}-Q{$q}";
    }

    /**
     * Period grid (quarterly or monthly) for one return type.
     */
    public static function buildPeriods(bool $quarterly, int $startYear, string $dueField, bool $qrmp = false, mixed $applicableFrom = null): array
    {
        $appDate = null;
        if ($applicableFrom) {
            $appDate = $applicableFrom instanceof Carbon ? $applicableFrom->copy()->startOfDay() : Carbon::parse($applicableFrom)->startOfDay();
        }

        $periods = [];
        if ($quarterly) {
            $quarters = [
                ['q' => 1, 'year' => $startYear, 'label' => 'Apr-Jun', 'endMonth' => 6, 'endYear' => $startYear],
                ['q' => 2, 'year' => $startYear, 'label' => 'Jul-Sep', 'endMonth' => 9, 'endYear' => $startYear],
                ['q' => 3, 'year' => $startYear, 'label' => 'Oct-Dec', 'endMonth' => 12, 'endYear' => $startYear],
                ['q' => 4, 'year' => $startYear + 1, 'label' => 'Jan-Mar', 'endMonth' => 3, 'endYear' => $startYear + 1],
            ];
            foreach ($quarters as $q) {
                $periodEnd = Carbon::createFromDate($q['endYear'], $q['endMonth'], 1)->endOfMonth();
                $isApplicable = ! $appDate || $appDate->lte($periodEnd);
                $after = Carbon::createFromDate($q['endYear'], $q['endMonth'], 1)->addMonth();
                $day = ['due_gstr1' => 13, 'due_gstr3b' => 22, 'due_cmp08' => 18][$dueField] ?? 20;
                $periods[] = [
                    'period' => "{$q['year']}-Q{$q['q']}",
                    'label' => $q['label'],
                    'due_date' => $after->copy()->day($day)->toDateString(),
                    'is_applicable' => $isApplicable,
                    'status' => $isApplicable ? null : 'Non-Applicable',
                ];
            }
        } else {
            for ($i = 0; $i < 12; $i++) {
                $month = 4 + $i;
                $year = $startYear;
                if ($month > 12) {
                    $month -= 12;
                    $year += 1;
                }
                $periodEnd = Carbon::createFromDate($year, $month, 1)->endOfMonth();
                $isApplicable = ! $appDate || $appDate->lte($periodEnd);
                $after = Carbon::createFromDate($year, $month, 1)->addMonth();
                $day = $dueField === 'due_gstr3b' ? 20 : ($qrmp ? 13 : 11);
                $periods[] = [
                    'period' => sprintf('%04d-%02d', $year, $month),
                    'label' => Carbon::createFromDate($year, $month, 1)->format("M 'y"),
                    'due_date' => $after->copy()->day($day)->toDateString(),
                    'is_applicable' => $isApplicable,
                    'status' => $isApplicable ? null : 'Non-Applicable',
                ];
            }
        }

        return $periods;
    }

    /**
     * Check whether a specific period string is on or after the applicable_from date.
     */
    public static function isPeriodApplicable(string $period, mixed $applicableFrom): bool
    {
        if (! $applicableFrom) {
            return true;
        }

        $appDate = $applicableFrom instanceof Carbon ? $applicableFrom->copy()->startOfDay() : Carbon::parse($applicableFrom)->startOfDay();

        if (preg_match('/^(\d{4})-(\d{2})$/', $period, $m)) {
            $periodEnd = Carbon::createFromDate((int) $m[1], (int) $m[2], 1)->endOfMonth();
            return $appDate->lte($periodEnd);
        }

        if (preg_match('/^(\d{4})-Q(\d)$/', $period, $m)) {
            $qEndMonth = (int) $m[2] * 3;
            $periodEnd = Carbon::createFromDate((int) $m[1], $qEndMonth, 1)->endOfMonth();
            return $appDate->lte($periodEnd);
        }

        return true;
    }

    /**
     * Get upcoming due dates for current month per 02-dashboard spec.
     */
    public static function getUpcomingDueDates(?Carbon $now = null): array
    {
        $now = $now ?? now();
        $year = $now->year;
        $month = $now->month;
        $today = $now->copy()->startOfDay();
        $monthEnd = $now->copy()->endOfMonth();

        $rows = [];

        $clientScope = function ($q) use ($monthEnd) {
            $q->where(function ($w) use ($monthEnd) {
                $w->whereNull('applicable_from')->orWhere('applicable_from', '<=', $monthEnd);
            });
        };

        // Client counts based on registration type and frequency
        $regularMonthlyCount = ClientProfile::where('has_gst', true)
            ->where(function ($q) {
                $q->whereNull('dealer_type')->orWhere('dealer_type', 'regular');
            })
            ->where(function ($q) {
                $q->whereNull('gst_filing_frequency')->orWhere('gst_filing_frequency', 'monthly');
            })
            ->tap($clientScope)
            ->count();

        $regularQrmpCount = ClientProfile::where('has_gst', true)
            ->where(function ($q) {
                $q->whereNull('dealer_type')->orWhere('dealer_type', 'regular');
            })
            ->where('gst_filing_frequency', 'quarterly')
            ->tap($clientScope)
            ->count();

        $compositionCount = ClientProfile::where('has_gst', true)
            ->where('dealer_type', 'composition')
            ->tap($clientScope)
            ->count();

        $formatStatus = function (Carbon $dueDate) use ($today) {
            $dueDay = $dueDate->copy()->startOfDay();
            if ($dueDay->lt($today)) {
                $days = $today->diffInDays($dueDay);
                return [
                    'label' => 'Overdue',
                    'type' => 'overdue',
                    'days' => -$days,
                ];
            } elseif ($dueDay->eq($today)) {
                return [
                    'label' => 'Due Today',
                    'type' => 'due_today',
                    'days' => 0,
                ];
            } else {
                $days = $today->diffInDays($dueDay);
                return [
                    'label' => "In {$days} " . ($days === 1 ? 'Day' : 'Days'),
                    'type' => 'upcoming',
                    'days' => $days,
                ];
            }
        };

        // 1. GSTR-1 (Monthly) - due 11th of current month
        $d1 = Carbon::createFromDate($year, $month, 11);
        $st1 = $formatStatus($d1);
        $rows[] = [
            'return_type' => 'GSTR-1 (Monthly)',
            'due_date' => $d1->toDateString(),
            'due_date_formatted' => $d1->format('d M Y'),
            'client_count' => $regularMonthlyCount,
            'status' => $st1['label'],
            'status_type' => $st1['type'],
        ];

        // 2. GSTR-3B (Monthly) - due 20th of current month
        $d2 = Carbon::createFromDate($year, $month, 20);
        $st2 = $formatStatus($d2);
        $rows[] = [
            'return_type' => 'GSTR-3B (Monthly)',
            'due_date' => $d2->toDateString(),
            'due_date_formatted' => $d2->format('d M Y'),
            'client_count' => $regularMonthlyCount,
            'status' => $st2['label'],
            'status_type' => $st2['type'],
        ];

        // 3. GSTR-1 (QRMP) - due 13th of current month
        $d3 = Carbon::createFromDate($year, $month, 13);
        $st3 = $formatStatus($d3);
        $rows[] = [
            'return_type' => 'GSTR-1 (QRMP)',
            'due_date' => $d3->toDateString(),
            'due_date_formatted' => $d3->format('d M Y'),
            'client_count' => $regularQrmpCount,
            'status' => $st3['label'],
            'status_type' => $st3['type'],
        ];

        // Quarterly rows only in Jan (1), Apr (4), Jul (7), Oct (10)
        $isQuarterDueMonth = in_array($month, [1, 4, 7, 10], true);

        if ($isQuarterDueMonth) {
            // 4. GSTR-3B (Quarterly) - due 22nd
            $d4 = Carbon::createFromDate($year, $month, 22);
            $st4 = $formatStatus($d4);
            $rows[] = [
                'return_type' => 'GSTR-3B (Quarterly)',
                'due_date' => $d4->toDateString(),
                'due_date_formatted' => $d4->format('d M Y'),
                'client_count' => $regularQrmpCount,
                'status' => $st4['label'],
                'status_type' => $st4['type'],
            ];

            // 5. CMP-08 - due 18th
            $d5 = Carbon::createFromDate($year, $month, 18);
            $st5 = $formatStatus($d5);
            $rows[] = [
                'return_type' => 'CMP-08',
                'due_date' => $d5->toDateString(),
                'due_date_formatted' => $d5->format('d M Y'),
                'client_count' => $compositionCount,
                'status' => $st5['label'],
                'status_type' => $st5['type'],
            ];
        }

        // Filter out return types with 0 applicable clients (show only rows with at least 1 client)
        $rows = array_values(array_filter($rows, fn ($r) => ($r['client_count'] ?? 0) > 0));

        return $rows;
    }

    /**
     * Return filing frequency rules for Module 2A (Tab 9: GST Filing Frequency).
     * Strictly computes return types, frequencies, due dates, remarks, and applicability
     * according to Government GST rules and Applicable From.
     */
    public static function getFilingRules(?string $dealerType, ?string $optOut = 'Monthly', mixed $applicableFrom = null): array
    {
        $dealer = strtolower(trim((string) $dealerType));
        if ($dealer === 'composition') {
            $mode = 'Quarterly';
        } else {
            $mode = (strcasecmp((string) $optOut, 'Quarterly') === 0) ? 'Quarterly' : 'Monthly';
        }

        $appDate = null;
        if ($applicableFrom) {
            $appDate = $applicableFrom instanceof Carbon ? $applicableFrom->copy()->startOfDay() : Carbon::parse($applicableFrom)->startOfDay();
        }

        $rows = [];

        // 1. GSTR-1 (Monthly)
        if ($dealer === 'composition') {
            $rows[] = [
                'return_type' => 'GSTR-1 (Monthly)',
                'frequency' => 'Monthly',
                'enabled' => false,
                'due_date' => '11th of next month',
                'remark' => 'Outward supplies return',
                'status' => 'Not applicable for Composition scheme',
            ];
        } elseif ($mode === 'Quarterly') {
            $rows[] = [
                'return_type' => 'GSTR-1 (Monthly)',
                'frequency' => 'Monthly',
                'enabled' => false,
                'due_date' => '11th of next month',
                'remark' => 'Outward supplies return',
                'status' => 'Not applicable for QRMP',
            ];
        } else {
            $rows[] = [
                'return_type' => 'GSTR-1 (Monthly)',
                'frequency' => 'Monthly',
                'enabled' => true,
                'due_date' => '11th of next month',
                'remark' => 'Outward supplies return',
                'status' => 'Active',
            ];
        }

        // 2. GSTR-1 (Monthly - QRMP)
        if ($dealer === 'composition') {
            $rows[] = [
                'return_type' => 'GSTR-1 (Monthly - QRMP)',
                'frequency' => 'Quarterly',
                'enabled' => false,
                'due_date' => '13th of next month after quarter',
                'remark' => 'For QRMP scheme (Quarterly return with monthly upload)',
                'status' => 'Not applicable for Composition scheme',
            ];
        } elseif ($mode === 'Quarterly') {
            $rows[] = [
                'return_type' => 'GSTR-1 (Monthly - QRMP)',
                'frequency' => 'Quarterly',
                'enabled' => true,
                'due_date' => '13th of next month after quarter',
                'remark' => 'For QRMP scheme (Quarterly return with monthly upload)',
                'status' => 'Active',
            ];
        } else {
            $rows[] = [
                'return_type' => 'GSTR-1 (Monthly - QRMP)',
                'frequency' => 'Quarterly',
                'enabled' => false,
                'due_date' => '13th of next month after quarter',
                'remark' => 'For QRMP scheme (Quarterly return with monthly upload)',
                'status' => 'Not applicable for Monthly regular filing',
            ];
        }

        // 3. GSTR-2B
        if ($dealer === 'composition') {
            $rows[] = [
                'return_type' => 'GSTR-2B',
                'frequency' => 'Monthly',
                'enabled' => false,
                'due_date' => '14th of next month',
                'remark' => 'Auto-generated ITC statement',
                'status' => 'Not applicable for Composition scheme',
            ];
        } elseif ($mode === 'Quarterly') {
            $rows[] = [
                'return_type' => 'GSTR-2B',
                'frequency' => 'Quarterly',
                'enabled' => true,
                'due_date' => '14th of next month after quarter',
                'remark' => 'Auto-generated ITC statement',
                'status' => 'Active',
            ];
        } else {
            $rows[] = [
                'return_type' => 'GSTR-2B',
                'frequency' => 'Monthly',
                'enabled' => true,
                'due_date' => '14th of next month',
                'remark' => 'Auto-generated ITC statement',
                'status' => 'Active',
            ];
        }

        // 4. GSTR-3B
        if ($dealer === 'composition') {
            $rows[] = [
                'return_type' => 'GSTR-3B',
                'frequency' => 'Monthly',
                'enabled' => false,
                'due_date' => '20th of next month',
                'remark' => 'Summary return and tax payment',
                'status' => 'Not applicable for Composition scheme',
            ];
        } elseif ($mode === 'Quarterly') {
            $rows[] = [
                'return_type' => 'GSTR-3B',
                'frequency' => 'Quarterly',
                'enabled' => true,
                'due_date' => '22nd of next month after quarter',
                'remark' => 'Summary return and tax payment',
                'status' => 'Active',
            ];
        } else {
            $rows[] = [
                'return_type' => 'GSTR-3B',
                'frequency' => 'Monthly',
                'enabled' => true,
                'due_date' => '20th of next month',
                'remark' => 'Summary return and tax payment',
                'status' => 'Active',
            ];
        }

        // 5. CMP-08
        if ($dealer === 'composition') {
            $rows[] = [
                'return_type' => 'CMP-08',
                'frequency' => 'Quarterly',
                'enabled' => true,
                'due_date' => '18th of next month after quarter',
                'remark' => 'For Composition Scheme (Quarterly return)',
                'status' => 'Active',
            ];
        } else {
            $rows[] = [
                'return_type' => 'CMP-08',
                'frequency' => 'Quarterly',
                'enabled' => false,
                'due_date' => '18th of next month after quarter',
                'remark' => 'For Composition Scheme (Quarterly return)',
                'status' => 'Not applicable for Regular Dealer',
            ];
        }

        return [
            'dealer_type' => $dealer === 'composition' ? 'Composition Dealer' : 'Regular Dealer',
            'opt_out' => $mode,
            'applicable_from' => $appDate ? $appDate->toDateString() : null,
            'government_rules_note' => 'Due dates are as per current Government rules and may be subject to change.',
            'returns' => $rows,
        ];
    }
}
