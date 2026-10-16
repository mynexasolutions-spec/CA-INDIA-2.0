<?php

namespace App\Services\Gst;

use Carbon\Carbon;

/**
 * CMP-08 is a quarterly return. Its period key is "YYYY-Qn" where YYYY is the START year of the
 * financial year: Q1 Apr-Jun, Q2 Jul-Sep, Q3 Oct-Dec and Q4 Jan-Mar of YYYY+1 (so "2026-Q4" is
 * Jan-Mar 2027). This is the same key the client's filing requests, the GST period grid and
 * GSTR-2B use, so a CMP-08 filed anywhere is found everywhere.
 */
class Cmp08Period
{
    public const QUARTERS = [
        'Q1' => ['label' => 'Q1 (Apr - Jun)', 'due_month' => 7,  'due_day' => 18],
        'Q2' => ['label' => 'Q2 (Jul - Sep)', 'due_month' => 10, 'due_day' => 18],
        'Q3' => ['label' => 'Q3 (Oct - Dec)', 'due_month' => 1,  'due_day' => 18],
        'Q4' => ['label' => 'Q4 (Jan - Mar)', 'due_month' => 4,  'due_day' => 18],
    ];

    /** @return array{0: int, 1: string}|null  [financial-year start year, "Q1".."Q4"] */
    public static function parse(string $period): ?array
    {
        if (! preg_match('/^(\d{4})-(Q[1-4])$/', $period, $m)) {
            return null;
        }

        return [(int) $m[1], $m[2]];
    }

    public static function key(int $fyStart, string $qKey): string
    {
        return "{$fyStart}-{$qKey}";
    }

    /** "2026-27" -> 2026 (falls back to the current FY). */
    public static function fyStartFromLabel(?string $fy): int
    {
        if ($fy && preg_match('/^(\d{4})-\d{2}$/', $fy, $m)) {
            return (int) $m[1];
        }

        return now()->month >= 4 ? now()->year : now()->year - 1;
    }

    public static function fyLabel(int $fyStart): string
    {
        return $fyStart.'-'.substr((string) ($fyStart + 1), -2);
    }

    public static function dueDate(int $fyStart, string $qKey): Carbon
    {
        $q = self::QUARTERS[$qKey];
        // Q1 (Jul) and Q2 (Oct) fall in the FY start year; Q3 (Jan) and Q4 (Apr) in the next calendar year.
        $year = $q['due_month'] < 7 ? $fyStart + 1 : $fyStart;

        return Carbon::create($year, $q['due_month'], $q['due_day'])->startOfDay();
    }

    /** "Q1 (Apr - Jun) 2026" - Q4 shows the calendar year it ends in. */
    public static function quarterLabel(int $fyStart, string $qKey): string
    {
        return self::QUARTERS[$qKey]['label'].' '.($qKey === 'Q4' ? $fyStart + 1 : $fyStart);
    }

    /** The "FYSTART-Qn" key of the quarter a date falls in. */
    public static function keyForDate(Carbon $d): string
    {
        $fy = $d->month >= 4 ? $d->year : $d->year - 1;
        $q = match (true) {
            $d->month >= 4 && $d->month <= 6 => 1,
            $d->month >= 7 && $d->month <= 9 => 2,
            $d->month >= 10 => 3,
            default => 4,
        };

        return "{$fy}-Q{$q}";
    }

    /** Pending once the due date has passed, otherwise Upcoming; Filed wins over both. */
    public static function status(bool $filed, Carbon $due): string
    {
        return $filed ? 'Filed' : ($due->isPast() ? 'Pending' : 'Upcoming');
    }
}
