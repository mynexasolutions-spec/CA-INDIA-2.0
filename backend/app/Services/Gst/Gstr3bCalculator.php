<?php

namespace App\Services\Gst;

use App\Models\ClientGstr2bInvoice;
use App\Models\ClientGstr3bPeriodData;
use App\Models\CommercialDocument;
use Carbon\Carbon;

/**
 * Single source of truth for the admin GSTR-3B numbers, so the Summary tab, the
 * Outward / ITC tabs and the Tax Payment Breakup can never disagree.
 *
 *   Output tax & RCM   = Liability to GSTR-1 + RCM liability + Other adjustments (± each)
 *   Eligible ITC       = Brought forward + Adjustment + GSTR-2B (eligible & matched)
 *                        − ITC reversal + Other adjustment
 *   Set-off            = automatic cross-utilisation of that ITC against Output tax & RCM
 *   Total liability    = Output tax & RCM − ITC set off + Interest + Late fee
 *   Net tax payable    = Total liability − Tax paid through the Cash Ledger
 *
 * Interest and late fee are never payable through ITC — only through cash.
 */
class Gstr3bCalculator
{
    public const HEADS = ['igst', 'cgst', 'sgst'];

    private const GSTR1_TYPES = ['tax_invoice', 'bill_of_supply', 'debit_note', 'credit_note'];

    private static function n(mixed $v): float
    {
        return is_numeric($v) ? (float) $v : 0.0;
    }

    /**
     * Liability to GSTR-1: exactly what the GSTR-1 review shows for the month — tax invoices,
     * bills of supply and debit notes add, credit notes reduce, cancelled documents are
     * ignored, and quotations / delivery challans never count.
     *
     * @return array{igst: float, cgst: float, sgst: float, taxable: float}
     */
    public static function gstr1Liability(int $clientId, string $period): array
    {
        [$yr, $mo] = array_map('intval', explode('-', $period));
        $start = Carbon::create($yr, $mo, 1)->startOfMonth();
        $end = $start->copy()->endOfMonth();

        $rows = CommercialDocument::where('client_profile_id', $clientId)
            ->whereBetween('document_date', [$start, $end])
            ->whereIn('type', self::GSTR1_TYPES)
            ->whereNull('cancelled_at')
            ->selectRaw('type, SUM(taxable_amount) as taxable, SUM(igst_amount) as igst, SUM(cgst_amount) as cgst, SUM(sgst_amount) as sgst')
            ->groupBy('type')
            ->get();

        $out = ['igst' => 0.0, 'cgst' => 0.0, 'sgst' => 0.0, 'taxable' => 0.0];
        foreach ($rows as $r) {
            $sign = $r->type === 'credit_note' ? -1 : 1;
            foreach (['igst', 'cgst', 'sgst', 'taxable'] as $k) {
                $out[$k] += $sign * (float) $r->$k;
            }
        }

        return array_map(fn ($v) => round($v, 2), $out);
    }

    /**
     * Automatic ITC set-off / cross-utilisation (Section 49 / Rule 88A order):
     *   1. IGST ITC → IGST liability, then CGST, then SGST
     *   2. CGST ITC → CGST liability, then IGST        (never against SGST)
     *   3. SGST ITC → SGST liability, then IGST        (never against CGST)
     *
     * @param array{igst: float, cgst: float, sgst: float} $itc       ITC available per head
     * @param array{igst: float, cgst: float, sgst: float} $liability Output tax & RCM per head
     * @return array{used: array, remaining_liability: array, balance_itc: array, itc_applied: array, detail: array}
     */
    public static function setOff(array $itc, array $liability): array
    {
        $avail = array_map(fn ($v) => max(0.0, (float) $v), $itc);
        $liab = array_map(fn ($v) => max(0.0, (float) $v), $liability);
        $startLiab = $liab;

        $detail = [
            'igst_to_igst' => 0.0, 'igst_to_cgst' => 0.0, 'igst_to_sgst' => 0.0,
            'cgst_to_cgst' => 0.0, 'cgst_to_igst' => 0.0,
            'sgst_to_sgst' => 0.0, 'sgst_to_igst' => 0.0,
        ];

        $apply = function (string $from, string $to) use (&$avail, &$liab, &$detail) {
            $amt = min($avail[$from], $liab[$to]);
            $avail[$from] -= $amt;
            $liab[$to] -= $amt;
            $detail["{$from}_to_{$to}"] += $amt;
        };

        // IGST credit is exhausted first (IGST → CGST → SGST), as the Rules require.
        $apply('igst', 'igst');
        $apply('igst', 'cgst');
        $apply('igst', 'sgst');
        // Then CGST / SGST credit against their own head, and only after that against IGST.
        $apply('cgst', 'cgst');
        $apply('sgst', 'sgst');
        $apply('cgst', 'igst');
        $apply('sgst', 'igst');

        $detail = array_map(fn ($v) => round($v, 2), $detail);

        $used = [
            'igst' => $detail['igst_to_igst'] + $detail['igst_to_cgst'] + $detail['igst_to_sgst'],
            'cgst' => $detail['cgst_to_cgst'] + $detail['cgst_to_igst'],
            'sgst' => $detail['sgst_to_sgst'] + $detail['sgst_to_igst'],
        ];

        $r = fn (array $a) => array_map(fn ($v) => round($v, 2), $a);

        return [
            'used' => $r($used),
            'remaining_liability' => $r($liab),
            'balance_itc' => $r($avail),
            // ITC that actually went against each head's own liability (for the Tax Payment Breakup).
            'itc_applied' => $r(array_map(fn ($h) => $startLiab[$h] - $liab[$h], array_combine(self::HEADS, self::HEADS))),
            'detail' => $detail,
        ];
    }

    /** Everything the 3B screens need for one client + month. */
    public static function compute(int $clientId, string $period): array
    {
        $row = ClientGstr3bPeriodData::where('client_profile_id', $clientId)->where('tax_period', $period)->first();
        $outward = $row?->outward_rcm ?? [];
        $itcData = $row?->itc_data ?? [];
        $interestData = $row?->interest_data ?? [];
        $lateData = $row?->late_fee_data ?? [];
        $cash = $row?->cash_ledger ?? [];

        $g1 = self::gstr1Liability($clientId, $period);

        $g2b = ClientGstr2bInvoice::where('client_profile_id', $clientId)
            ->where('tax_period', $period)
            ->where('itc_eligibility', 'eligible')
            ->where('match_status', 'matched')
            ->selectRaw('COALESCE(SUM(igst),0) as igst, COALESCE(SUM(cgst),0) as cgst, COALESCE(SUM(sgst),0) as sgst')
            ->first();

        // Projected ITC (client's estimate) counts as normal ITC until the official GSTR-2B is loaded.
        $projected = ProjectedItc::forPeriod($clientId, $period);

        $out = $itc = $interest = $late = $cashPaid = [];
        foreach (self::HEADS as $h) {
            // Output tax & RCM = GSTR-1 liability + RCM + other adjustments (adjustments may be negative).
            $out[$h] = round($g1[$h] + self::n($outward["rcm_$h"] ?? 0) + self::n($outward["adj_$h"] ?? 0), 2);

            $itc[$h] = round(
                self::n($itcData["bf_$h"] ?? 0) + self::n($itcData["adj_$h"] ?? 0) + self::n($g2b->$h ?? 0) + $projected[$h]
                - self::n($itcData["rev_$h"] ?? 0) + self::n($itcData["other_$h"] ?? 0),
                2
            );

            $sumRows = function (array $d) use ($h) {
                $t = 0.0;
                foreach (['output', 'rcm', 'other'] as $p) {
                    $t += self::n($d["{$p}_$h"] ?? 0);
                    if ($h === 'sgst') {
                        $t += self::n($d["{$p}_utgst"] ?? 0); // SGST/UTGST column
                    }
                }

                return round($t, 2);
            };
            $interest[$h] = $sumRows($interestData);
            $late[$h] = $sumRows($lateData);

            $cashPaid[$h] = round(array_sum(array_map(fn ($u) => self::n($u[$h] ?? 0), $cash['utilisations'] ?? [])), 2);
        }

        $set = self::setOff($itc, $out);

        $liability = $net = [];
        foreach (self::HEADS as $h) {
            $liability[$h] = round($set['remaining_liability'][$h] + $interest[$h] + $late[$h], 2);
            $net[$h] = round(max(0.0, $liability[$h] - $cashPaid[$h]), 2);
        }

        $tot = fn (array $a) => round(array_sum($a), 2);

        return [
            'gstr1' => $g1,
            'output' => $out,
            'itc' => $itc,
            'itc_projected' => $projected, // already included in 'itc'; kept so screens can label it
            'interest' => $interest,
            'late_fee' => $late,
            'cash_paid' => $cashPaid,
            'set_off' => $set,
            'liability' => $liability,
            'net_payable' => $net,
            'totals' => [
                'output' => $tot($out),
                'itc_eligible' => $tot($itc),
                'itc_projected' => $projected['total'],
                'itc_used' => $tot($set['used']),
                'itc_balance' => $tot($set['balance_itc']),
                'interest' => $tot($interest),
                'late_fee' => $tot($late),
                'cash_paid' => $tot($cashPaid),
                'liability' => $tot($liability),
                'net_payable' => $tot($net),
            ],
        ];
    }
}
