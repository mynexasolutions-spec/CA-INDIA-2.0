<?php

namespace App\Http\Controllers\Api\Billing;

use App\Http\Controllers\Controller;
use App\Models\CommercialDocument;
use App\Models\Customer;
use App\Services\Billing\BillingPolicy;
use App\Services\Gst\GstLiabilityService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    // Mark Paid/Unpaid is a payment-status change only — it must never remove a document
    // from the Billing dashboard's totals/KPIs/GST breakdown. All three "issued family"
    // statuses count as live, finalized documents; only draft/cancelled are excluded.
    // Matches GstLiabilityService::calculate()'s status filter.
    private const ISSUED_STATUSES = ['issued', 'partial', 'paid'];

    public function __construct(private readonly GstLiabilityService $liabilityService) {}

    private function profile(Request $request)
    {
        $profile = $request->user()->clientProfile;
        abort_unless($profile, 403, 'No billing profile');

        return $profile;
    }

    /** Indian FY: 1 Apr – 31 Mar. Switches automatically on 1 April.
     * Never earlier than FY 2026-27 — the Billing module's launch FY. */
    private function currentFyRange(): array
    {
        $now = now();
        $y1 = max($now->month >= 4 ? $now->year : $now->year - 1, BillingPolicy::MIN_BILLING_FY_START_YEAR);

        return ["{$y1}-04-01", ($y1 + 1).'-03-31'];
    }

    private function applyPeriod(Builder $q, ?string $from, ?string $to): Builder
    {
        // GST-period counting spec — bucketed by Date of Creation, not the document's
        // back-dated Document Date.
        if ($from) {
            $q->whereDate('created_at', '>=', $from);
        }
        if ($to) {
            $q->whereDate('created_at', '<=', $to);
        }

        return $q;
    }

    /**
     * Taxable value / GST amount across the given period, for the dealer's primary sales
     * document type (Tax Invoice for regular/retail dealers, Bill of Supply for composition
     * dealers) — bucketed by calendar month for Monthly filers, or by the four Indian GST
     * quarters (Apr-Jun, Jul-Sep, Oct-Dec, Jan-Mar) for Quarterly (QRMP) filers, per the
     * Client Portal spec: "Quarterly client = quarterly chart ... the data grouping ... must
     * change." Grouped in PHP rather than SQL so it behaves identically on SQLite (dev) and
     * MySQL (prod).
     *
     * Net figures follow the same convention as the rest of the dashboard: Tax Invoice + Bill of
     * Supply + Debit Note − Credit Note (a dealer only ever issues the document types that apply
     * to their registration, so the other types simply contribute zero).
     *
     * @return array<int, array{period: string, label: string, taxable_value: float, gst_amount: float}>
     */
    private function monthlyTrend(int $pid, string $from, string $to, string $frequency): array
    {
        $signedTypes = [
            'tax_invoice' => 1,
            'bill_of_supply' => 1,
            'debit_note' => 1,
            'credit_note' => -1,
        ];

        $rows = CommercialDocument::where('client_profile_id', $pid)
            ->whereIn('type', array_keys($signedTypes))
            ->whereIn('status', self::ISSUED_STATUSES)
            ->whereDate('created_at', '>=', $from)
            ->whereDate('created_at', '<=', $to)
            ->get(['type', 'created_at', 'taxable_amount', 'cgst_amount', 'sgst_amount', 'igst_amount']);

        $buckets = [];
        if ($frequency === 'quarterly') {
            // Same FY-quarter convention as the compliance endpoint: Q1 Apr-Jun, Q2 Jul-Sep,
            // Q3 Oct-Dec (all in the FY's start year), Q4 Jan-Mar (in start year + 1).
            $fyStartYear = \Carbon\Carbon::parse($from)->month >= 4
                ? \Carbon\Carbon::parse($from)->year
                : \Carbon\Carbon::parse($from)->year - 1;
            $quarterDefs = [
                1 => ['months' => [4, 5, 6], 'year' => $fyStartYear],
                2 => ['months' => [7, 8, 9], 'year' => $fyStartYear],
                3 => ['months' => [10, 11, 12], 'year' => $fyStartYear],
                4 => ['months' => [1, 2, 3], 'year' => $fyStartYear + 1],
            ];
            $monthToQuarter = [];
            foreach ($quarterDefs as $q => $def) {
                foreach ($def['months'] as $m) {
                    $monthToQuarter[$def['year'].'-'.$m] = $q;
                }
            }
            foreach ($quarterDefs as $q => $def) {
                $key = $def['year'].'-Q'.$q;
                $startMonth = $def['months'][0];
                $endMonth = end($def['months']);
                $startLabelYear = $def['year'];
                $buckets[$key] = [
                    'period' => $key,
                    'label' => "Q{$q} (".\Carbon\Carbon::createFromDate($startLabelYear, $startMonth, 1)->format('M')
                        .'-'.\Carbon\Carbon::createFromDate($def['year'], $endMonth, 1)->format("M ’y").')',
                    'taxable_value' => 0.0,
                    'gst_amount' => 0.0,
                ];
            }
        } else {
            $cursor = \Carbon\Carbon::parse($from)->startOfMonth();
            $end = \Carbon\Carbon::parse($to)->startOfMonth();
            while ($cursor <= $end) {
                $key = $cursor->format('Y-m');
                $buckets[$key] = [
                    'period' => $key,
                    'label' => $cursor->format('M \'y'),
                    'taxable_value' => 0.0,
                    'gst_amount' => 0.0,
                ];
                $cursor->addMonth();
            }
        }

        foreach ($rows as $row) {
            $date = \Carbon\Carbon::parse($row->created_at);
            if ($frequency === 'quarterly') {
                $q = $monthToQuarter[$date->year.'-'.$date->month] ?? null;
                $key = $q ? $quarterDefs[$q]['year'].'-Q'.$q : null;
            } else {
                $key = $date->format('Y-m');
            }
            if (!$key || !isset($buckets[$key])) {
                continue;
            }
            $sign = $signedTypes[$row->type];
            $buckets[$key]['taxable_value'] += $sign * (float) $row->taxable_amount;
            $buckets[$key]['gst_amount'] += $sign * ((float) $row->cgst_amount + (float) $row->sgst_amount + (float) $row->igst_amount);
        }

        return array_values($buckets);
    }

    public function index(Request $request)
    {
        $profile = $this->profile($request);
        $pid = $profile->id;
        [$defaultFrom, $defaultTo] = $this->currentFyRange();
        $from = BillingPolicy::clampFromDate($request->input('from', $defaultFrom));
        $to = $request->input('to', $defaultTo);

        $base = CommercialDocument::where('client_profile_id', $pid)->where('status', '!=', 'cancelled');
        $this->applyPeriod($base, $from, $to);

        $tax = (clone $base)->where('type', 'tax_invoice')->whereIn('status', self::ISSUED_STATUSES);
        $bos = (clone $base)->where('type', 'bill_of_supply')->whereIn('status', self::ISSUED_STATUSES);
        $dn = (clone $base)->where('type', 'debit_note');
        $cn = (clone $base)->where('type', 'credit_note');
        // "Cancelled Invoices" counts cancelled invoice-type documents only (not quotations / challans),
        // and they are never part of the active Tax Invoice count above.
        $cancelled = CommercialDocument::where('client_profile_id', $pid)
            ->where('status', 'cancelled')
            ->whereIn('type', ['tax_invoice', 'bill_of_supply', 'debit_note', 'credit_note']);
        $this->applyPeriod($cancelled, $from, $to);
        $quo = (clone $base)->where('type', 'quotation')->whereIn('status', self::ISSUED_STATUSES);
        $dc = (clone $base)->where('type', 'delivery_challan')->whereIn('status', self::ISSUED_STATUSES);

        $gstBucket = function (Builder $q): array {
            $scope = (clone $q)->whereIn('status', self::ISSUED_STATUSES);

            return [
                'taxable_value' => (float) (clone $scope)->sum('taxable_amount'),
                'cgst' => (float) (clone $scope)->sum('cgst_amount'),
                'sgst' => (float) (clone $scope)->sum('sgst_amount'),
                'igst' => (float) (clone $scope)->sum('igst_amount'),
                'total_invoice_value' => (float) (clone $scope)->sum(DB::raw('COALESCE(NULLIF(grand_total,0), total_amount)')),
            ];
        };

        $zero = [
            'taxable_value' => 0.0,
            'cgst' => 0.0,
            'sgst' => 0.0,
            'igst' => 0.0,
            'total_invoice_value' => 0.0,
        ];

        $gstTax = $gstBucket($tax);
        $gstBos = $gstBucket($bos);
        $gstDn = $gstBucket($dn);
        $gstCn = $gstBucket($cn);

        $mode = BillingPolicy::mode($profile);
        if ($mode === 'regular') {
            $gstBos = $zero;
        } elseif ($mode === 'composition') {
            $gstTax = $zero;
            $gstDn = $zero;
        }

        $frequency = $profile->gst_filing_frequency ?? 'monthly';
        // Composition's compliance cycle is quarterly by law, independent of whatever
        // gst_filing_frequency happens to be saved — don't rely solely on that field for it.
        $trendFrequency = $mode === 'composition' ? 'quarterly' : $frequency;
        $monthlyTrend = $this->monthlyTrend($pid, $from, $to, $trendFrequency);

        $recent = CommercialDocument::where('client_profile_id', $pid);
        $this->applyPeriod($recent, $from, $to);
        $recent = $recent
            ->with('customer:id,name')
            ->latest('created_at')
            ->latest('id')
            ->limit(8)
            ->get();

        return response()->json([
            'period' => ['from' => $from, 'to' => $to],
            'summary' => [
                'total_invoices' => (clone $base)->whereIn('type', ['tax_invoice', 'bill_of_supply', 'debit_note', 'credit_note'])->whereIn('status', self::ISSUED_STATUSES)->count(),
                'tax_invoices' => (clone $tax)->count(),
                'tax_invoices_value' => (float) (clone $tax)->sum(DB::raw('COALESCE(NULLIF(grand_total,0), total_amount)')),
                'bill_of_supply' => (clone $bos)->count(),
                'bill_of_supply_value' => (float) (clone $bos)->sum(DB::raw('COALESCE(NULLIF(grand_total,0), total_amount)')),
                'debit_notes' => (clone $dn)->whereIn('status', self::ISSUED_STATUSES)->count(),
                'debit_notes_value' => (float) (clone $dn)->whereIn('status', self::ISSUED_STATUSES)->sum(DB::raw('COALESCE(NULLIF(grand_total,0), total_amount)')),
                'credit_notes' => (clone $cn)->whereIn('status', self::ISSUED_STATUSES)->count(),
                'credit_notes_value' => (float) (clone $cn)->whereIn('status', self::ISSUED_STATUSES)->sum(DB::raw('COALESCE(NULLIF(grand_total,0), total_amount)')),
                'cancelled_invoices' => (clone $cancelled)->count(),
                'quotations' => (clone $quo)->count(),
                'quotations_value' => (float) (clone $quo)->sum(DB::raw('COALESCE(NULLIF(grand_total,0), total_amount)')),
                'delivery_challans' => (clone $dc)->count(),
                'delivery_challans_value' => (float) (clone $dc)->sum(DB::raw('COALESCE(NULLIF(grand_total,0), total_amount)')),
            ],
            'gst' => [
                'taxable_value' => $gstTax['taxable_value'],
                'cgst' => $gstTax['cgst'],
                'sgst' => $gstTax['sgst'],
                'igst' => $gstTax['igst'],
                'total_gst' => $gstTax['cgst'] + $gstTax['sgst'] + $gstTax['igst'],
                'total_invoice_value' => $gstTax['total_invoice_value'],
            ],
            'gst_matrix' => [
                'tax_invoice' => $gstTax,
                'bill_of_supply' => $gstBos,
                'debit_note' => $gstDn,
                'credit_note' => $gstCn,
            ],
            'dealer_mode' => $mode,
            'gst_filing_frequency' => $frequency,
            'composition_rate' => (float) $profile->composition_rate,
            'gst_dashboard' => $mode === 'regular'
                ? $this->liabilityService->dashboardSummary($pid, $from, $to)
                : null,
            'composition_dashboard' => $mode === 'composition'
                ? $this->liabilityService->compositionSummary($pid, $from, $to, (float) $profile->composition_rate)
                : null,
            'monthly_trend' => $monthlyTrend,
            'recent_invoices' => $recent,
            'parties_count' => Customer::where('client_profile_id', $pid)->count(),
        ]);
    }
}
