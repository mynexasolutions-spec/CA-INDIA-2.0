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
     * Period grid (quarterly or monthly) for one return type.
     */
    public static function buildPeriods(bool $quarterly, int $startYear, string $dueField, bool $qrmp = false): array
    {
        $periods = [];
        if ($quarterly) {
            $quarters = [
                ['q' => 1, 'year' => $startYear, 'label' => 'Apr-Jun', 'endMonth' => 6, 'endYear' => $startYear],
                ['q' => 2, 'year' => $startYear, 'label' => 'Jul-Sep', 'endMonth' => 9, 'endYear' => $startYear],
                ['q' => 3, 'year' => $startYear, 'label' => 'Oct-Dec', 'endMonth' => 12, 'endYear' => $startYear],
                ['q' => 4, 'year' => $startYear + 1, 'label' => 'Jan-Mar', 'endMonth' => 3, 'endYear' => $startYear + 1],
            ];
            foreach ($quarters as $q) {
                $after = Carbon::createFromDate($q['endYear'], $q['endMonth'], 1)->addMonth();
                $day = ['due_gstr1' => 13, 'due_gstr3b' => 22, 'due_cmp08' => 18][$dueField] ?? 20;
                $periods[] = [
                    'period' => "{$q['year']}-Q{$q['q']}",
                    'label' => $q['label'],
                    'due_date' => $after->copy()->day($day)->toDateString(),
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
                $after = Carbon::createFromDate($year, $month, 1)->addMonth();
                $day = $dueField === 'due_gstr3b' ? 20 : ($qrmp ? 13 : 11);
                $periods[] = [
                    'period' => sprintf('%04d-%02d', $year, $month),
                    'label' => Carbon::createFromDate($year, $month, 1)->format("M 'y"),
                    'due_date' => $after->copy()->day($day)->toDateString(),
                ];
            }
        }

        return $periods;
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

        $rows = [];

        // Client counts based on registration type and frequency
        $regularMonthlyCount = ClientProfile::where('has_gst', true)
            ->where(function ($q) {
                $q->whereNull('dealer_type')->orWhere('dealer_type', 'regular');
            })
            ->where(function ($q) {
                $q->whereNull('gst_filing_frequency')->orWhere('gst_filing_frequency', 'monthly');
            })
            ->count();

        $regularQrmpCount = ClientProfile::where('has_gst', true)
            ->where(function ($q) {
                $q->whereNull('dealer_type')->orWhere('dealer_type', 'regular');
            })
            ->where('gst_filing_frequency', 'quarterly')
            ->count();

        $compositionCount = ClientProfile::where('has_gst', true)
            ->where('dealer_type', 'composition')
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
}
