<?php

namespace App\Services\Gst;

use App\Models\ClientGstr2bInvoice;
use App\Models\ClientGstReturn;
use App\Models\CommercialDocument;

class GstLiabilityService
{
    /**
     * Single source of truth for the GST Liability / ITC report — the KPI cards, the
     * Output GST Breakdown table and the Output-GST-vs-ITC chart all read from this
     * one calculation, so they can never disagree. total_output_gst is derived from
     * the same cgst/sgst/igst figures returned here, not computed independently.
     *
     * @return array<string, float|string>
     */
    public function calculate(int $clientProfileId, string $from, string $to): array
    {
        // GST-period counting spec — Date of Creation, not the back-dated Document Date.
        $output = CommercialDocument::where('client_profile_id', $clientProfileId)
            ->whereDate('created_at', '>=', $from)
            ->whereDate('created_at', '<=', $to)
            ->whereIn('status', ['issued', 'paid', 'partial'])
            ->whereIn('type', ['tax_invoice', 'debit_note', 'credit_note'])
            ->selectRaw(
                'COALESCE(SUM(CASE WHEN type = ? THEN -1 ELSE 1 END * COALESCE(cgst_amount, 0)), 0) AS cgst,
                 COALESCE(SUM(CASE WHEN type = ? THEN -1 ELSE 1 END * COALESCE(sgst_amount, 0)), 0) AS sgst,
                 COALESCE(SUM(CASE WHEN type = ? THEN -1 ELSE 1 END * COALESCE(igst_amount, 0)), 0) AS igst',
                ['credit_note', 'credit_note', 'credit_note']
            )
            ->first();

        $eligibleItc = ClientGstr2bInvoice::where('client_profile_id', $clientProfileId)
            ->whereBetween('tax_period', [substr($from, 0, 7), substr($to, 0, 7)])
            ->where('itc_eligibility', 'eligible')
            ->where('match_status', ClientGstr2bInvoice::MATCH_STATUS_MATCHED)
            ->sum('total_gst');

        $cgst = round((float) ($output?->cgst ?? 0), 2);
        $sgst = round((float) ($output?->sgst ?? 0), 2);
        $igst = round((float) ($output?->igst ?? 0), 2);
        $totalOutputGst = round($cgst + $sgst + $igst, 2);
        $totalEligibleItc = round((float) $eligibleItc, 2);
        $netLiability = round($totalOutputGst - $totalEligibleItc, 2);
        $result = $netLiability > 0
            ? 'gst_payable'
            : ($netLiability < 0 ? 'excess_itc' : 'no_liability');
        // Negating a zero float in PHP yields -0.0, which json_encode() renders as "-0" —
        // normalize away the sign so a no-data period consistently shows plain 0.
        $noSignZero = fn (float $v): float => $v == 0.0 ? 0.0 : $v;

        return [
            'cgst' => $cgst,
            'sgst' => $sgst,
            'igst' => $igst,
            'total_output_gst' => $totalOutputGst,
            'total_eligible_itc' => $totalEligibleItc,
            'net_gst_liability' => $netLiability,
            'gst_payable' => $noSignZero(max($netLiability, 0)),
            'itc_carry_forward' => $noSignZero(max(-$netLiability, 0)),
            'result' => $result,
            'result_label' => match ($result) {
                'gst_payable' => 'GST Payable',
                'excess_itc' => 'Excess ITC Available / ITC Carry Forward',
                default => 'No GST Payable',
            },
        ];
    }

    /** @return array<string, float|int> */
    public function dashboardSummary(int $clientProfileId, string $from, string $to): array
    {
        $liability = $this->calculate($clientProfileId, $from, $to);
        $gstr2b = ClientGstr2bInvoice::where('client_profile_id', $clientProfileId)
            ->whereBetween('tax_period', [substr($from, 0, 7), substr($to, 0, 7)]);

        return [
            'output_gst' => (float) $liability['total_output_gst'],
            'eligible_itc' => (float) $liability['total_eligible_itc'],
            'gst_payable' => (float) $liability['gst_payable'],
            'excess_itc' => (float) $liability['itc_carry_forward'],
            'total_gstr2b_invoices' => (clone $gstr2b)->count(),
            'matched_invoices' => (clone $gstr2b)
                ->where('match_status', ClientGstr2bInvoice::MATCH_STATUS_MATCHED)
                ->count(),
            'unmatched_invoices' => (clone $gstr2b)
                ->notMatched()
                ->count(),
        ];
    }

    /**
     * Composition-scheme summary: Turnover × the client's composition rate, NOT the
     * output-GST-minus-ITC calculation used for Regular dealers — composition dealers pay a
     * flat rate on turnover and, by law, cannot avail Input Tax Credit at all (so ITC Availed /
     * ITC Available are always zero — a genuine business rule, not a placeholder).
     *
     * @return array<string, float|int>
     */
    public function compositionSummary(int $clientProfileId, string $from, string $to, float $rate): array
    {
        $turnover = (float) CommercialDocument::where('client_profile_id', $clientProfileId)
            ->where('type', 'bill_of_supply')
            ->whereIn('status', ['issued', 'partial', 'paid'])
            ->whereDate('created_at', '>=', $from)
            ->whereDate('created_at', '<=', $to)
            ->sum('taxable_amount');

        $taxPayable = round($turnover * $rate / 100, 2);

        // "Tax Paid (through CMP-08)" — sum the payable for whichever FY quarters overlapping
        // this period have actually had their CMP-08 marked filed by the admin.
        $fyStartYear = \Carbon\Carbon::parse($from)->month >= 4
            ? \Carbon\Carbon::parse($from)->year
            : \Carbon\Carbon::parse($from)->year - 1;
        $quarters = [
            ['key' => "{$fyStartYear}-Q1", 'from' => "{$fyStartYear}-04-01", 'to' => "{$fyStartYear}-06-30"],
            ['key' => "{$fyStartYear}-Q2", 'from' => "{$fyStartYear}-07-01", 'to' => "{$fyStartYear}-09-30"],
            ['key' => "{$fyStartYear}-Q3", 'from' => "{$fyStartYear}-10-01", 'to' => "{$fyStartYear}-12-31"],
            ['key' => "{$fyStartYear}-Q4", 'from' => ($fyStartYear + 1).'-01-01', 'to' => ($fyStartYear + 1).'-03-31'],
        ];
        $overlapping = array_filter($quarters, fn ($q) => $q['from'] <= $to && $q['to'] >= $from);
        $filedKeys = ClientGstReturn::where('client_profile_id', $clientProfileId)
            ->where('return_type', ClientGstReturn::TYPE_CMP08)
            ->where('status', 'filed')
            ->whereIn('tax_period', array_column($overlapping, 'key'))
            ->pluck('tax_period')
            ->all();

        $taxPaid = 0.0;
        foreach ($overlapping as $q) {
            if (!in_array($q['key'], $filedKeys, true)) {
                continue;
            }
            $qTurnover = (float) CommercialDocument::where('client_profile_id', $clientProfileId)
                ->where('type', 'bill_of_supply')
                ->where('status', 'issued')
                ->whereDate('created_at', '>=', $q['from'])
                ->whereDate('created_at', '<=', $q['to'])
                ->sum('taxable_amount');
            $taxPaid += round($qTurnover * $rate / 100, 2);
        }

        // Composition dealers still receive GSTR-2B for their purchases (even though ITC can't
        // be claimed against it) — reconciling those records against supplier filings still
        // matters for audit purposes, so reuse the same matching data under CMP-08 terminology.
        $gstr2b = ClientGstr2bInvoice::where('client_profile_id', $clientProfileId)
            ->whereBetween('tax_period', [substr($from, 0, 7), substr($to, 0, 7)]);

        return [
            'turnover' => round($turnover, 2),
            'tax_payable' => $taxPayable,
            'tax_paid' => round($taxPaid, 2),
            'itc_availed' => 0.0,
            'itc_available' => 0.0,
            'composition_rate' => $rate,
            'total_gstr2b_invoices' => (clone $gstr2b)->count(),
            'matched_invoices' => (clone $gstr2b)
                ->where('match_status', ClientGstr2bInvoice::MATCH_STATUS_MATCHED)
                ->count(),
            'unmatched_invoices' => (clone $gstr2b)
                ->notMatched()
                ->count(),
        ];
    }
}
