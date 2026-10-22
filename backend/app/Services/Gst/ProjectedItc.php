<?php

namespace App\Services\Gst;

use App\Models\ClientGstr2bProjectedInvoice;
use App\Models\ClientGstr2bRecord;
use Carbon\Carbon;

/**
 * Projected ITC — the client's own estimate of the ITC they expect from GSTR-2B (entered in
 * GSTR-2B → Projected ITC). It counts as normal ITC in every Input GST / ITC calculation, but
 * only until the official GSTR-2B for that period is loaded: from then on the actual data
 * replaces it (so the two are never added together), and the Admin can also delete the
 * projected rows outright.
 */
class ProjectedItc
{
    public const HEADS = ['igst', 'cgst', 'sgst'];

    /** @return array{igst: float, cgst: float, sgst: float, total: float} */
    public static function zero(): array
    {
        return ['igst' => 0.0, 'cgst' => 0.0, 'sgst' => 0.0, 'total' => 0.0];
    }

    /** Projected ITC for one tax period ("2026-08" or "2026-Q2"); zero once the official GSTR-2B exists. */
    public static function forPeriod(int $clientId, string $period): array
    {
        return self::byPeriod($clientId)[$period] ?? self::zero();
    }

    /**
     * Projected ITC per tax period, only for periods still without an official GSTR-2B record.
     *
     * @return array<string, array{igst: float, cgst: float, sgst: float, total: float}>
     */
    public static function byPeriod(int $clientId): array
    {
        $official = ClientGstr2bRecord::where('client_profile_id', $clientId)->pluck('tax_period')->all();

        $rows = ClientGstr2bProjectedInvoice::where('client_profile_id', $clientId)
            ->selectRaw('tax_period, COALESCE(SUM(igst),0) AS igst, COALESCE(SUM(cgst),0) AS cgst, COALESCE(SUM(sgst_utgst),0) AS sgst')
            ->groupBy('tax_period')
            ->get();

        $out = [];
        foreach ($rows as $r) {
            if (in_array($r->tax_period, $official, true)) {
                continue;
            }
            $out[$r->tax_period] = self::pack((float) $r->igst, (float) $r->cgst, (float) $r->sgst);
        }

        return $out;
    }

    /** Projected ITC for every period overlapping [$from, $to] (Y-m-d dates). */
    public static function forRange(int $clientId, string $from, string $to): array
    {
        $start = Carbon::parse($from)->startOfDay();
        $end = Carbon::parse($to)->endOfDay();

        $sum = self::zero();
        foreach (self::byPeriod($clientId) as $period => $heads) {
            $bounds = self::bounds($period);
            if (! $bounds || $bounds[1]->lt($start) || $bounds[0]->gt($end)) {
                continue;
            }
            foreach (self::HEADS as $h) {
                $sum[$h] += $heads[$h];
            }
        }

        return self::pack($sum['igst'], $sum['cgst'], $sum['sgst']);
    }

    /** Projected ITC for every period strictly before $period (used for carried-forward ITC). */
    public static function before(int $clientId, string $period): array
    {
        $current = self::bounds($period);
        $sum = self::zero();
        if (! $current) {
            return $sum;
        }
        foreach (self::byPeriod($clientId) as $p => $heads) {
            $b = self::bounds($p);
            if ($b && $b[1]->lt($current[0])) {
                foreach (self::HEADS as $h) {
                    $sum[$h] += $heads[$h];
                }
            }
        }

        return self::pack($sum['igst'], $sum['cgst'], $sum['sgst']);
    }

    /** @return array{0: Carbon, 1: Carbon}|null  [start, end] of "YYYY-MM" or FY quarter "YYYY-Qn". */
    private static function bounds(string $period): ?array
    {
        if (preg_match('/^(\d{4})-(\d{2})$/', $period, $m)) {
            $start = Carbon::create((int) $m[1], (int) $m[2], 1)->startOfDay();

            return [$start, $start->copy()->endOfMonth()];
        }
        if (preg_match('/^(\d{4})-Q([1-4])$/', $period, $m)) {
            $year = (int) $m[1];
            $start = match ((int) $m[2]) {
                1 => Carbon::create($year, 4, 1),
                2 => Carbon::create($year, 7, 1),
                3 => Carbon::create($year, 10, 1),
                default => Carbon::create($year + 1, 1, 1),
            };
            $start = $start->startOfDay();

            return [$start, $start->copy()->addMonthsNoOverflow(2)->endOfMonth()];
        }

        return null;
    }

    private static function pack(float $igst, float $cgst, float $sgst): array
    {
        $igst = round($igst, 2);
        $cgst = round($cgst, 2);
        $sgst = round($sgst, 2);

        return ['igst' => $igst, 'cgst' => $cgst, 'sgst' => $sgst, 'total' => round($igst + $cgst + $sgst, 2)];
    }
}
