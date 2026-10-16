<?php

namespace App\Services\Gst;

use App\Models\ClientGstr2bInvoice;
use App\Models\ClientGstr2bRecord;
use Carbon\Carbon;

/**
 * GSTR-3B mandatory reconciliation gate (client-portal GST Returns spec) — whether a
 * client's GSTR-2B reconciliation is "completed" for a given period is fully derived,
 * there is no explicit status column anywhere. A "YYYY-MM" month is reconciled iff a
 * ClientGstr2bRecord (an uploaded GSTR-2B statement) exists for it AND none of that
 * month's ClientGstr2bInvoice rows are still Unmatched or Pending (i.e. not Matched).
 *
 * Deliberately self-contained (including its own FY period-grid builder in
 * GstFilingController::periods()) rather than extracted from/sharing code with
 * GstReturnController — this feature must never be able to change that controller's
 * existing, working period/compliance logic.
 */
class Gstr2bReconciliationService
{
    public static function isMonthReconciled(int $clientProfileId, string $monthPeriod): bool
    {
        $hasRecord = ClientGstr2bRecord::where('client_profile_id', $clientProfileId)
            ->where('tax_period', $monthPeriod)
            ->exists();

        if (! $hasRecord) {
            return false;
        }

        $hasUnmatched = ClientGstr2bInvoice::where('client_profile_id', $clientProfileId)
            ->where('tax_period', $monthPeriod)
            ->notMatched()
            ->exists();

        return ! $hasUnmatched;
    }

    /** "2026-Q1" -> ['2026-04', '2026-05', '2026-06'] (Q1=Apr-Jun … Q4=Jan-Mar of year+1),
     * same quarter definition as GstFilingController::periodBounds(). */
    public static function monthsInQuarter(string $quarterPeriod): array
    {
        if (! preg_match('/^(\d{4})-Q([1-4])$/', $quarterPeriod, $m)) {
            return [];
        }

        $year = (int) $m[1];
        $starts = [
            1 => [$year, 4],
            2 => [$year, 7],
            3 => [$year, 10],
            4 => [$year + 1, 1],
        ];
        [$startYear, $startMonth] = $starts[(int) $m[2]];

        $months = [];
        for ($i = 0; $i < 3; $i++) {
            $month = $startMonth + $i;
            $y = $startYear;
            if ($month > 12) {
                $month -= 12;
                $y += 1;
            }
            $months[] = sprintf('%04d-%02d', $y, $month);
        }

        return $months;
    }

    /** Quarterly GSTR-2B is NEVER treated as one statement — every one of the 3
     * underlying calendar months must be individually reconciled. */
    public static function isQuarterReconciled(int $clientProfileId, string $quarterPeriod): bool
    {
        foreach (self::monthsInQuarter($quarterPeriod) as $month) {
            if (! self::isMonthReconciled($clientProfileId, $month)) {
                return false;
            }
        }

        return true;
    }

    /** Dispatches on the period's own shape ("YYYY-MM" vs "YYYY-Qn") so callers don't
     * need to know the client's filing frequency separately. */
    public static function isPeriodReconciled(int $clientProfileId, string $period): bool
    {
        if (preg_match('/^\d{4}-Q[1-4]$/', $period)) {
            return self::isQuarterReconciled($clientProfileId, $period);
        }

        return self::isMonthReconciled($clientProfileId, $period);
    }

    /** Per-month true/false breakdown for a quarter — lets the "View Reconciliation"
     * action and the gate popup point at the actual pending month(s), not a meaningless
     * quarter-wide label. */
    public static function quarterMonthBreakdown(int $clientProfileId, string $quarterPeriod): array
    {
        $breakdown = [];
        foreach (self::monthsInQuarter($quarterPeriod) as $month) {
            $breakdown[$month] = self::isMonthReconciled($clientProfileId, $month);
        }

        return $breakdown;
    }

    /**
     * FY period grid for GSTR-1, GSTR-3B, CMP-08 (Composition, always quarterly) or
     * GSTR-4 (Composition, always annual), feeding the client GST Returns workspace's
     * "Filing Periods" table. Intentionally a fresh, self-contained implementation —
     * NOT extracted from GstReturnController::buildPeriods() — so this new feature
     * carries zero risk of altering that controller's existing dashboard/compliance
     * behavior.
     *
     * Due-date convention matches GstReturnController::buildPeriods() for GSTR-1/GSTR-3B:
     * GSTR-1 monthly = 11th of the next month (13th if $qrmpMonthlyGstr1, i.e. tracked
     * monthly via IFF while the client's overall cadence is quarterly), GSTR-1 quarterly =
     * 13th of the month after the quarter, GSTR-3B monthly = 20th, GSTR-3B quarterly = 22nd.
     * CMP-08 = 18th of the month after the quarter. GSTR-4 = 30 June following the FY end
     * (current rule since the 2019 due-date extension from the original 30 April).
     */
    public static function periodGrid(string $returnType, bool $quarterly, int $startYear, bool $qrmpMonthlyGstr1 = false): array
    {
        $periods = [];

        // GSTR-4 is Annual — one single period per FY, not a month/quarter grid. The
        // period key is just the FY start year ("2026"), matching periodBounds()'s
        // bare-year branch (Apr 1 startYear -> Mar 31 startYear+1).
        if ($returnType === 'GSTR-4') {
            return [[
                'period' => (string) $startYear,
                'period_label' => "FY {$startYear}-".substr((string) ($startYear + 1), -2),
                'due_date' => Carbon::createFromDate($startYear + 1, 6, 30)->toDateString(),
            ]];
        }

        if ($quarterly) {
            $quarters = [
                1 => ['label' => 'Apr-Jun', 'endYear' => $startYear, 'endMonth' => 6],
                2 => ['label' => 'Jul-Sep', 'endYear' => $startYear, 'endMonth' => 9],
                3 => ['label' => 'Oct-Dec', 'endYear' => $startYear, 'endMonth' => 12],
                4 => ['label' => 'Jan-Mar', 'endYear' => $startYear + 1, 'endMonth' => 3],
            ];
            foreach ($quarters as $q => $info) {
                $after = Carbon::createFromDate($info['endYear'], $info['endMonth'], 1)->addMonth();
                $day = $returnType === 'GSTR-3B' ? 22 : ($returnType === 'CMP-08' ? 18 : 13);
                $periods[] = [
                    'period' => "{$startYear}-Q{$q}",
                    'period_label' => "{$info['label']} {$startYear}",
                    'due_date' => $after->copy()->day($day)->toDateString(),
                ];
            }

            return $periods;
        }

        for ($i = 0; $i < 12; $i++) {
            $month = 4 + $i;
            $year = $startYear;
            if ($month > 12) {
                $month -= 12;
                $year += 1;
            }
            $after = Carbon::createFromDate($year, $month, 1)->addMonth();
            $day = $returnType === 'GSTR-3B' ? 20 : ($qrmpMonthlyGstr1 ? 13 : 11);
            $periods[] = [
                'period' => sprintf('%04d-%02d', $year, $month),
                'period_label' => Carbon::createFromDate($year, $month, 1)->format('M Y'),
                'due_date' => $after->copy()->day($day)->toDateString(),
            ];
        }

        return $periods;
    }
}
