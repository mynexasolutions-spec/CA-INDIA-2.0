<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Models\ClientGstReturn;
use App\Models\ClientProfile;
use App\Models\CommercialDocument;
use App\Models\GstFilingRequest;
use App\Services\Billing\BillingPolicy;
use App\Services\Gst\Gstr2bReconciliationService;
use Illuminate\Http\Request;
use Carbon\Carbon;

/**
 * GST Filing Confirmation — GSTR-1 (spec §7 of the original Billing guide) and GSTR-3B
 * (client-portal "GST Returns" spec: GSTR-1 and GSTR-3B as tabs of one GST Returns
 * module). GSTR-3B carries one extra rule GSTR-1 does not: a filing request may not be
 * created for a period whose GSTR-2B reconciliation is still pending — see
 * assertReconciliationComplete() and Gstr2bReconciliationService, which derive
 * reconciliation status from ClientGstr2bRecord/ClientGstr2bInvoice.match_status (no
 * explicit status column exists). For a quarterly/QRMP GSTR-3B period, "reconciled"
 * means every one of the 3 underlying calendar months is reconciled — GSTR-2B is never
 * treated as one quarterly statement.
 *
 * QRMP-aware (spec §5): the accepted filing_period FORMAT depends on the client's
 * resolved cycle for the given return_type (BillingPolicy::gstr1Frequency() /
 * gstr3bFrequency()) — "YYYY-MM" for a monthly filer, "YYYY-Qn" for a quarterly one. A
 * client can't submit the wrong shape for their own profile; this is enforced here, not
 * just hidden in the UI.
 */
class GstFilingController extends Controller
{
    /** Start/end date bounds (YYYY-MM-DD) for a filing period — a "YYYY-MM" month, a
     * "YYYY-Qn" Indian-FY quarter (Q1 = Apr-Jun … Q4 = Jan-Mar), or a bare "YYYY" FY
     * start year (GSTR-4's Annual period: Apr 1 that year -> Mar 31 the next).
     * whereBetween on real date bounds works identically on MySQL and SQLite, unlike a
     * MySQL-only DATE_FORMAT() comparison. */
    private static function periodBounds(string $period): array
    {
        if (preg_match('/^(\d{4})-Q([1-4])$/', $period, $m)) {
            $year = (int) $m[1];
            $ranges = [
                1 => [$year.'-04-01', $year.'-06-30'],
                2 => [$year.'-07-01', $year.'-09-30'],
                3 => [$year.'-10-01', $year.'-12-31'],
                4 => [($year + 1).'-01-01', ($year + 1).'-03-31'],
            ];

            return $ranges[(int) $m[2]];
        }

        if (preg_match('/^(\d{4})$/', $period, $m)) {
            $year = (int) $m[1];

            return [$year.'-04-01', ($year + 1).'-03-31'];
        }

        $start = Carbon::createFromFormat('Y-m-d', $period.'-01')->startOfMonth();

        return [$start->toDateString(), $start->copy()->endOfMonth()->toDateString()];
    }

    /** Rejects a filing_period whose shape doesn't match this client's actual cycle for
     * the given return_type — a quarterly filer can't submit a bare month and vice versa.
     * $returnType defaults to 'GSTR-1' so the original (unmodified) GSTR-1 branch below
     * still runs exactly as before for any existing caller that doesn't pass it. */
    private static function assertPeriodMatchesFrequency(ClientProfile $profile, string $period, string $returnType = 'GSTR-1'): void
    {
        if ($returnType === 'GSTR-3B') {
            // GST Filing Return Type & Period Logic spec: GSTR-3B's period shape follows
            // the client's GSTR-2B frequency (not a separate gstr3bFrequency reading) —
            // GSTR-2B Monthly -> GSTR-3B Monthly, GSTR-2B Quarterly -> GSTR-3B Quarterly.
            $quarterly = BillingPolicy::gstr2bFrequency($profile) === 'quarterly';
            $isQuarterFormat = (bool) preg_match('/^\d{4}-Q[1-4]$/', $period);
            $isMonthFormat = (bool) preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $period);

            abort_if($quarterly && ! $isQuarterFormat, 422, 'Your GSTR-3B is filed quarterly — select a quarter, not a month.');
            abort_if(! $quarterly && ! $isMonthFormat, 422, 'Your GSTR-3B is filed monthly — select a month, not a quarter.');

            return;
        }

        // Composition — CMP-08: no GSTR-2B applicability, always quarterly, no dependence
        // on any monthly/quarterly profile setting.
        if ($returnType === 'CMP-08') {
            abort_unless((bool) preg_match('/^\d{4}-Q[1-4]$/', $period), 422, 'CMP-08 is filed quarterly — select a quarter.');

            return;
        }

        // Composition — GSTR-4: Annual, one period per Financial Year (a bare "YYYY"
        // FY start year), never a month or quarter.
        if ($returnType === 'GSTR-4') {
            abort_unless((bool) preg_match('/^\d{4}$/', $period), 422, 'GSTR-4 is filed annually — select a financial year.');

            return;
        }

        // GST Filing Return Type & Period Logic spec: GSTR-1's Filing Period is always
        // Monthly — even a QRMP (quarterly GSTR-3B) dealer still tracks GSTR-1 monthly
        // via IFF, so gstr1_filing_frequency is no longer consulted here.
        $isMonthFormat = (bool) preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $period);
        abort_if(! $isMonthFormat, 422, 'GSTR-1 is filed monthly — select a month, not a quarter.');
    }

    /** GSTR-3B mandatory reconciliation gate (client-portal GST Returns spec §6) — a
     * no-op for GSTR-1 (first line), so this can never affect the existing GSTR-1
     * store() path. For GSTR-3B, blocks creating the filing request outright when the
     * applicable GSTR-2B period(s) aren't fully reconciled yet. */
    private static function assertReconciliationComplete(int $clientProfileId, string $returnType, string $period): void
    {
        if ($returnType !== 'GSTR-3B') {
            return;
        }

        abort_unless(
            Gstr2bReconciliationService::isPeriodReconciled($clientProfileId, $period),
            422,
            'GSTR reconciliation is pending for the selected period. Please complete GSTR-2B reconciliation before raising the GSTR-3B filing request.'
        );
    }

    public function preview(Request $request)
    {
        $request->validate([
            'financial_year' => 'required|string',
            'filing_period' => 'required|string', // "YYYY-MM" or "YYYY-Qn" — see assertPeriodMatchesFrequency()
            'return_type' => 'required|string|in:GSTR-1,GSTR-3B,CMP-08,GSTR-4',
        ]);

        $profile = $request->user()->clientProfile;
        $clientProfileId = $profile->id;
        $period = $request->filing_period;
        $returnType = $request->return_type;
        self::assertPeriodMatchesFrequency($profile, $period, $returnType);
        [$periodStart, $periodEnd] = self::periodBounds($period);

        // Informational only (never blocks preview) — the frontend uses this to decide
        // whether the "Send Filing Request" action is enabled, and store() enforces the
        // actual block. Null for GSTR-1, which has no reconciliation gate.
        $reconciliationStatus = $returnType === 'GSTR-3B'
            ? (Gstr2bReconciliationService::isPeriodReconciled($clientProfileId, $period) ? 'completed' : 'pending')
            : null;

        // Allowed types for GST calculation
        $types = ['tax_invoice', 'bill_of_supply', 'debit_note', 'credit_note'];

        // GST-period counting spec — a bill belongs to the filing period it was
        // created in, not the period implied by its back-dated Document Date.
        $bills = CommercialDocument::where('client_profile_id', $clientProfileId)
            ->whereIn('type', $types)
            ->whereIn('status', ['issued', 'paid', 'partial'])
            ->whereDate('created_at', '>=', $periodStart)
            ->whereDate('created_at', '<=', $periodEnd)
            ->get();

        // Net figures = Tax Invoice + Bill of Supply + Debit Note − Credit Note.
        $taxableValue = 0;
        $cgst = 0;
        $sgst = 0;
        $igst = 0;

        foreach ($bills as $bill) {
            $sign = $bill->type === 'credit_note' ? -1 : 1;
            $taxableValue += $sign * $bill->taxable_amount;
            $cgst += $sign * $bill->cgst_amount;
            $sgst += $sign * $bill->sgst_amount;
            $igst += $sign * $bill->igst_amount;
        }

        $totalGst = $cgst + $sgst + $igst;

        return response()->json([
            'bills' => $bills,
            'summary' => [
                'total_bills' => $bills->count(),
                'taxable_value' => $taxableValue,
                'total_cgst' => $cgst,
                'total_sgst' => $sgst,
                'total_igst' => $igst,
                'total_gst' => $totalGst,
            ],
            'reconciliation_status' => $reconciliationStatus,
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'financial_year' => 'required|string',
            'filing_period' => 'required|string', // "YYYY-MM" or "YYYY-Qn" — see assertPeriodMatchesFrequency()
            'return_type' => 'required|string|in:GSTR-1,GSTR-3B,CMP-08,GSTR-4',
            'client_declaration' => 'required|accepted',
        ]);

        $profile = $request->user()->clientProfile;
        $clientProfileId = $profile->id;
        self::assertPeriodMatchesFrequency($profile, $request->filing_period, $request->return_type);
        self::assertReconciliationComplete($clientProfileId, $request->return_type, $request->filing_period);

        // GSTR-3B (monthly): the Admin may already have initiated a request for this period.
        // Same for CMP-08 (a quarter such as "2026-Q1"): the request flow is shared by both returns.
        $reqReturn = match (true) {
            $request->return_type === 'GSTR-3B' && preg_match('/^\d{4}-\d{2}$/', $request->filing_period) === 1 => \App\Models\ClientGstr3bRequest::RETURN_GSTR3B,
            $request->return_type === 'CMP-08' && preg_match('/^\d{4}-Q[1-4]$/', $request->filing_period) === 1 => \App\Models\ClientGstr3bRequest::RETURN_CMP08,
            default => null,
        };
        $open3b = $reqReturn ? \App\Models\ClientGstr3bRequest::activeFor($clientProfileId, $request->filing_period, $reqReturn) : null;
        if ($open3b && $open3b->awaitingClient()) {
            return response()->json(['message' => 'Your administrator has sent you a ' . $request->return_type . ' request for this period. Please accept or reject it first.'], 422);
        }

        // Check if there's already an active request for this period + return type — scoped
        // to return_type too, since GSTR-1 and GSTR-3B (or CMP-08 and GSTR-3B's own quarter
        // periods) can share the exact same period string without being the same request.
        $existing = GstFilingRequest::where('client_profile_id', $clientProfileId)
            ->where('filing_period', $request->filing_period)
            ->where('return_type', $request->return_type)
            ->whereNotIn('status', ['Correction Required']) // Allow new one if old was correction required? Or just block if Pending/Approved
            ->first();
            
        if ($existing && in_array($existing->status, ['Pending CA Review', 'Approved for Filing', 'GST Filed'])) {
            return response()->json(['message' => 'A GST Filing request for this period is already in progress or completed.'], 400);
        }

        // Fetch bills again
        $period = $request->filing_period;
        $types = ['tax_invoice', 'bill_of_supply', 'debit_note', 'credit_note'];
        [$periodStart, $periodEnd] = self::periodBounds($period);

        // GST-period counting spec — a bill belongs to the filing period it was
        // created in, not the period implied by its back-dated Document Date.
        $bills = CommercialDocument::where('client_profile_id', $clientProfileId)
            ->whereIn('type', $types)
            ->whereIn('status', ['issued', 'paid', 'partial'])
            ->whereDate('created_at', '>=', $periodStart)
            ->whereDate('created_at', '<=', $periodEnd)
            ->get();

        // Net figures = Tax Invoice + Bill of Supply + Debit Note − Credit Note.
        $taxableValue = 0;
        $cgst = 0;
        $sgst = 0;
        $igst = 0;
        foreach ($bills as $bill) {
            $sign = $bill->type === 'credit_note' ? -1 : 1;
            $taxableValue += $sign * $bill->taxable_amount;
            $cgst += $sign * $bill->cgst_amount;
            $sgst += $sign * $bill->sgst_amount;
            $igst += $sign * $bill->igst_amount;
        }
        $totalGst = $cgst + $sgst + $igst;

        $filingRequest = GstFilingRequest::create([
            'client_profile_id' => $clientProfileId,
            'financial_year' => $request->financial_year,
            'filing_period' => $request->filing_period,
            'return_type' => $request->return_type,
            'status' => 'Pending CA Review',
            'total_bills' => $bills->count(),
            'taxable_value' => $taxableValue,
            'total_cgst' => $cgst,
            'total_sgst' => $sgst,
            'total_igst' => $igst,
            'total_gst' => $totalGst,
            'client_declaration' => $request->client_declaration,
        ]);

        // Attach documents to pivot table
        $filingRequest->documents()->attach($bills->pluck('id'));

        // A GSTR-3B request raised by the client is recorded as "Submitted" / Initiated By "Client", so
        // the Admin's GSTR-3B screen sees it. (An already Accepted Admin request just carries on.)
        if ($reqReturn && ! $open3b) {
            \App\Models\ClientGstr3bRequest::create([
                'client_profile_id'   => $clientProfileId,
                'return_type'         => $reqReturn,
                'tax_period'          => $request->filing_period,
                'status'              => \App\Models\ClientGstr3bRequest::SUBMITTED,
                'initiated_by'        => 'client',
                'initiated_by_user_id'=> $request->user()->id,
            ]);
        }

        // Notify all admin/super_admin users about the new filing request
        $businessName = $profile->business_name ?: ($profile->client_name ?: 'A client');
        $periodLabel  = \App\Services\Billing\GstDueDate::periodLabel((string) $request->filing_period);
        $submittedOn  = now()->format('j F Y');
        \App\Models\User::whereIn('role', ['super_admin', 'admin'])->each(function ($admin) use ($businessName, $request, $periodLabel, $submittedOn, $filingRequest) {
            \App\Models\NotificationItem::create([
                'user_id' => $admin->id,
                'title'   => 'New GST Filing Request',
                'body'    => "Client: {$businessName}\nReturn: {$request->return_type}\nReturn Period: {$periodLabel}\nSubmitted On: {$submittedOn}",
                'type'    => 'gst_filing_request',
                'link'    => '/admin/gst-filing-requests/' . $filingRequest->id,
            ]);
        });

        return response()->json([
            'message' => 'GST filing confirmation has been sent to CA for review and filing process.',
            'request' => $filingRequest
        ]);
    }

    /**
     * GSTR-1 outward supplies summary for a specific filing period.
     * Returns document-type summary and HSN/SAC aggregation so the GSTR-1 page can
     * render the Summary tab without a separate billing-module call.
     * Uses document_date for period assignment (GSTR-1 is date-of-invoice based).
     */
    public function gstr1Summary(Request $request)
    {
        $request->validate(['filing_period' => 'required|string']);

        $profile = $request->user()->clientProfile;
        $period  = $request->filing_period;
        [$periodStart, $periodEnd] = self::periodBounds($period);

        $types = ['tax_invoice', 'bill_of_supply', 'debit_note', 'credit_note'];
        $typeLabels = [
            'tax_invoice'    => 'Tax Invoice',
            'bill_of_supply' => 'Bill of Supply',
            'debit_note'     => 'Debit Note',
            'credit_note'    => 'Credit Note',
        ];

        $docs = CommercialDocument::with(['lineItems', 'customer'])
            ->where('client_profile_id', $profile->id)
            ->whereIn('type', $types)
            ->whereIn('status', ['issued', 'paid', 'partial'])
            ->whereDate('document_date', '>=', $periodStart)
            ->whereDate('document_date', '<=', $periodEnd)
            ->get();

        // Document type summary
        $docTypeSummary = [];
        $totals = ['count' => 0, 'taxable' => 0, 'igst' => 0, 'cgst' => 0, 'sgst' => 0, 'total' => 0];
        foreach ($types as $t) {
            $filtered = $docs->where('type', $t);
            $sign = $t === 'credit_note' ? -1 : 1;
            $row = [
                'type'          => $t,
                'label'         => $typeLabels[$t],
                'count'         => $filtered->count(),
                'taxable_value' => round($filtered->sum('taxable_amount') * $sign, 2),
                'igst'          => round($filtered->sum('igst_amount') * $sign, 2),
                'cgst'          => round($filtered->sum('cgst_amount') * $sign, 2),
                'sgst'          => round($filtered->sum('sgst_amount') * $sign, 2),
                'total'         => round($filtered->sum('grand_total') * $sign, 2),
            ];
            $docTypeSummary[] = $row;
            $totals['count']   += $row['count'];
            $totals['taxable'] += $row['taxable_value'];
            $totals['igst']    += $row['igst'];
            $totals['cgst']    += $row['cgst'];
            $totals['sgst']    += $row['sgst'];
            $totals['total']   += $row['total'];
        }

        // HSN/SAC summary — aggregate line items, grouped by hsn_sac + gst_rate
        $hsnGroups = [];
        foreach ($docs as $doc) {
            $sign = $doc->type === 'credit_note' ? -1 : 1;
            foreach ($doc->lineItems as $item) {
                $key = ($item->hsn_sac ?: '') . '|' . $item->gst_rate;
                if (!isset($hsnGroups[$key])) {
                    $hsnGroups[$key] = [
                        'hsn_sac'       => $item->hsn_sac ?: '',
                        'description'   => $item->description ?: '',
                        'gst_rate'      => (float) $item->gst_rate,
                        'qty'           => 0,
                        'uqc'           => $item->unit ?: 'NOS',
                        'taxable_value' => 0,
                        'igst'          => 0,
                        'cgst'          => 0,
                        'sgst'          => 0,
                        'total'         => 0,
                    ];
                }
                $hsnGroups[$key]['qty']           += (float) $item->qty * $sign;
                $hsnGroups[$key]['taxable_value'] += (float) $item->taxable_amount * $sign;
                $hsnGroups[$key]['igst']          += (float) $item->igst_amount * $sign;
                $hsnGroups[$key]['cgst']          += (float) $item->cgst_amount * $sign;
                $hsnGroups[$key]['sgst']          += (float) $item->sgst_amount * $sign;
                $hsnGroups[$key]['total']         += (float) $item->total_amount * $sign;
            }
        }
        $hsnSummary = array_values($hsnGroups);

        return response()->json([
            'period'           => $period,
            'doc_type_summary' => $docTypeSummary,
            'doc_type_totals'  => $totals,
            'hsn_summary'      => $hsnSummary,
        ]);
    }

    public function index(Request $request)
    {
        $requests = GstFilingRequest::where('client_profile_id', $request->user()->clientProfile->id)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($requests);
    }

    public function show(Request $request, $id)
    {
        $filingRequest = GstFilingRequest::with('documents')->where('client_profile_id', $request->user()->clientProfile->id)->findOrFail($id);

        return response()->json($filingRequest);
    }

    public function gstr3bSummary(Request $request)
    {
        $request->validate(['tax_period' => 'required|string']);
        $profile = $request->user()->clientProfile;
        $period  = $request->tax_period;

        [$yr, $mo] = explode('-', $period);
        $start = Carbon::create((int)$yr, (int)$mo, 1)->startOfMonth();
        $end   = $start->copy()->endOfMonth();

        // Outward supply from commercial documents in the period
        $docs = CommercialDocument::where('client_profile_id', $profile->id)
            ->whereBetween('document_date', [$start, $end])
            ->whereNull('cancelled_at')
            ->selectRaw('
                COALESCE(SUM(taxable_amount),0) as taxable,
                COALESCE(SUM(igst_amount),0) as igst,
                COALESCE(SUM(cgst_amount),0) as cgst,
                COALESCE(SUM(sgst_amount),0) as sgst
            ')->first();

        $outTaxable = round($docs->taxable ?? 0, 2);
        $outIgst    = round($docs->igst    ?? 0, 2);
        $outCgst    = round($docs->cgst    ?? 0, 2);
        $outSgst    = round($docs->sgst    ?? 0, 2);

        // ITC from matched eligible GSTR-2B invoices
        $itcRow = \App\Models\ClientGstr2bInvoice::where('client_profile_id', $profile->id)
            ->where('tax_period', $period)
            ->where('itc_eligibility', 'eligible')
            ->where('match_status', 'matched')
            ->selectRaw('
                COALESCE(SUM(igst),0) as igst,
                COALESCE(SUM(cgst),0) as cgst,
                COALESCE(SUM(sgst),0) as sgst
            ')->first();

        $itcIgst = round($itcRow->igst ?? 0, 2);
        $itcCgst = round($itcRow->cgst ?? 0, 2);
        $itcSgst = round($itcRow->sgst ?? 0, 2);

        $liabIgst = max(0, $outIgst - $itcIgst);
        $liabCgst = max(0, $outCgst - $itcCgst);
        $liabSgst = max(0, $outSgst - $itcSgst);

        $totalOutput = round($outIgst + $outCgst + $outSgst, 2);
        $totalItc    = round($itcIgst + $itcCgst + $itcSgst, 2);
        $totalLiab   = round($liabIgst + $liabCgst + $liabSgst, 2);

        return response()->json([
            'period'       => $period,
            'period_label' => $start->format('M Y'),
            'summary' => [
                'total_outward_taxable' => $outTaxable,
                'total_output_tax'      => $totalOutput,
                'total_eligible_itc'    => $totalItc,
                'total_tax_liability'   => $totalLiab,
                'net_tax_payable'       => round($totalLiab - $totalItc, 2),
            ],
            'tax_payment_breakup' => [
                ['label'=>'IGST',       'output'=>$outIgst, 'itc'=>$itcIgst, 'interest'=>0, 'late_fee'=>0, 'liability'=>$liabIgst],
                ['label'=>'CGST',       'output'=>$outCgst, 'itc'=>$itcCgst, 'interest'=>0, 'late_fee'=>0, 'liability'=>$liabCgst],
                ['label'=>'SGST/UTGST', 'output'=>$outSgst, 'itc'=>$itcSgst, 'interest'=>0, 'late_fee'=>0, 'liability'=>$liabSgst],
                ['label'=>'Total',      'output'=>$totalOutput, 'itc'=>$totalItc, 'interest'=>0, 'late_fee'=>0, 'liability'=>$totalLiab, 'is_total'=>true],
            ],
            'itc_balance' => [
                ['label'=>'Total Tax Liability',               'igst'=>$outIgst, 'cgst'=>$outCgst, 'sgst'=>$outSgst, 'total'=>$totalOutput],
                ['label'=>'Less: ITC',                         'igst'=>$itcIgst, 'cgst'=>$itcCgst, 'sgst'=>$itcSgst, 'total'=>$totalItc],
                ['label'=>'Less: Tax Paid through Cash Ledger','igst'=>$liabIgst,'cgst'=>$liabCgst,'sgst'=>$liabSgst,'total'=>$totalLiab],
                ['label'=>'Balance ITC (Available)',           'igst'=>0, 'cgst'=>round($itcCgst-$outCgst,2), 'sgst'=>round($itcSgst-$outSgst,2), 'total'=>round($totalItc-$totalOutput,2), 'is_total'=>true],
            ],
        ]);
    }

    /**
     * Data source for the client GST Returns workspace's "Filing Periods" table (one
     * tab each for GSTR-1 and GSTR-3B). Builds the FY period grid via
     * Gstr2bReconciliationService::periodGrid() (deliberately independent of
     * GstReturnController::buildPeriods() — see that service's docblock), joins in this
     * client's own GstFilingRequest per period, and — for GSTR-3B only — attaches
     * reconciliation status so the frontend can render the "Reconciliation Pending" /
     * "View Reconciliation" state without a second round trip.
     */
    public function periods(Request $request)
    {
        $request->validate([
            'financial_year' => 'required|string',
            'return_type' => 'required|string|in:GSTR-1,GSTR-3B,CMP-08,GSTR-4',
        ]);

        $profile = $request->user()->clientProfile;
        $clientProfileId = $profile->id;
        $returnType = $request->return_type;

        abort_unless(preg_match('/^(\d{4})-/', $request->financial_year, $m), 422, 'Invalid financial_year.');
        $startYear = (int) $m[1];

        // GST Filing Return Type & Period Logic spec: GSTR-3B's cadence follows the
        // client's GSTR-2B frequency; GSTR-1 is always Monthly (tracked via IFF under
        // QRMP), so it never becomes quarterly here regardless of gstr1_filing_frequency.
        // CMP-08 is always Quarterly regardless of any profile setting (no GSTR-2B
        // applicability at all); GSTR-4 is Annual — periodGrid() ignores $quarterly for it.
        $gstr2bQuarterly = BillingPolicy::gstr2bFrequency($profile) === 'quarterly';
        $quarterly = match ($returnType) {
            'GSTR-3B' => $gstr2bQuarterly,
            'CMP-08' => true,
            default => false,
        };
        // GSTR-1 tracked monthly via IFF while the client's overall (GSTR-2B/3B) cadence
        // is quarterly — same QRMP due-date distinction as GstReturnController::buildPeriods().
        $qrmpMonthlyGstr1 = $returnType === 'GSTR-1' && $gstr2bQuarterly;

        $grid = Gstr2bReconciliationService::periodGrid($returnType, $quarterly, $startYear, $qrmpMonthlyGstr1);

        $existingRequests = GstFilingRequest::where('client_profile_id', $clientProfileId)
            ->where('return_type', $returnType)
            ->get()
            ->keyBy('filing_period');

        // The Admin Portal records a filing in two places: a filing-confirmation request (GstFilingRequest) and the
        // return itself (ClientGstReturn, written by "Mark as Filed" on the GSTR-1 / GSTR-3B review screens). The
        // client must see Filed + the ARN whichever one the admin used, so both feed each row.
        $filedReturns = ClientGstReturn::where('client_profile_id', $clientProfileId)
            ->where('return_type', str_replace('-', '', $returnType))
            ->where('status', 'filed')
            ->get()
            ->keyBy('tax_period');

        $periods = array_map(function (array $p) use ($existingRequests, $filedReturns, $returnType, $clientProfileId, $quarterly) {
            $existing = $existingRequests->get($p['period']);
            $filedReturn = $filedReturns->get($p['period'])
                ?? ($quarterly ? $filedReturns->get(self::quarterEndMonthKey($p['period'])) : null);

            $reconciliationStatus = null;
            $reconciliationBreakdown = null;
            if ($returnType === 'GSTR-3B') {
                $reconciliationStatus = Gstr2bReconciliationService::isPeriodReconciled($clientProfileId, $p['period'])
                    ? 'completed'
                    : 'pending';
                if ($quarterly) {
                    $reconciliationBreakdown = Gstr2bReconciliationService::quarterMonthBreakdown($clientProfileId, $p['period']);
                }
            }

            [$status, $action] = self::resolvePeriodStatusAndAction($existing, $returnType, $reconciliationStatus);
            $filedOn = $existing?->filing_date;
            $ackNo = $existing?->ack_no;

            if ($filedReturn && $existing?->status !== 'GST Filed') {
                // Filed by the admin without (or ahead of) a confirmation request.
                $status = 'Filed Successfully';
                $action = $existing ? 'view_details' : null;
                $filedOn = $filedReturn->filed_on?->toDateString();
                $ackNo = $filedReturn->ack_no;
            } elseif ($filedReturn) {
                $filedOn = $filedOn ?: $filedReturn->filed_on?->toDateString();
                $ackNo = $ackNo ?: $filedReturn->ack_no;
            }

            return [
                'period' => $p['period'],
                'period_label' => $p['period_label'],
                'due_date' => $p['due_date'],
                'status' => $status,
                'filed_on' => $filedOn,
                'ack_no' => $ackNo,
                'filing_request_id' => $existing?->id,
                'reconciliation_status' => $reconciliationStatus,
                'reconciliation_month_breakdown' => $reconciliationBreakdown,
                'action' => $action,
            ];
        }, $grid);

        return response()->json([
            'financial_year' => $request->financial_year,
            'return_type' => $returnType,
            'quarterly' => $quarterly,
            'summary' => self::periodsSummary($profile, $returnType, $quarterly, $gstr2bQuarterly, $existingRequests, $periods),
            'periods' => $periods,
        ]);
    }

    /** Per-return-type summary cards (Dealer Type / Filing Frequency / Last Filed
     * Return / Next Due Date) for the GST Returns workspace header — computed here
     * rather than reusing GstReturnController::index() (whose "next_due"/frequency
     * label are combined across GSTR-1+GSTR-3B, not split per tab as the spec's two
     * reference screenshots require), again to avoid touching that controller. */
    private static function periodsSummary(ClientProfile $profile, string $returnType, bool $quarterly, bool $gstr2bQuarterly, $existingRequests, array $periods): array
    {
        $frequencyLabel = match ($returnType) {
            'GSTR-3B' => $quarterly ? 'Quarterly' : 'Monthly',
            'CMP-08' => 'Quarterly',
            'GSTR-4' => 'Annual',
            // GSTR-1 is always Monthly — "Monthly (QRMP)" only changes the label when
            // tracked via IFF while the overall (GSTR-2B/3B) cadence is quarterly.
            default => $gstr2bQuarterly ? 'Monthly (QRMP)' : 'Monthly',
        };

        // Last filed = the most recent period that reads "Filed Successfully" in the grid, so it covers a filing
        // recorded either as a confirmation request or directly by the admin, and carries its ARN.
        $lastFiled = collect($periods)
            ->where('status', 'Filed Successfully')
            ->sortByDesc(fn ($p) => ($p['filed_on'] ? (string) $p['filed_on'] : '').'|'.$p['period'])
            ->first();

        $nextDuePeriod = collect($periods)->first(fn ($p) => $p['status'] !== 'Filed Successfully');

        return [
            'dealer_type' => $profile->dealer_type,
            'filing_frequency_label' => $frequencyLabel,
            'last_filed' => $lastFiled ? [
                'period' => $lastFiled['period'],
                'period_label' => $lastFiled['period_label'],
                'filed_on' => $lastFiled['filed_on'],
                'ack_no' => $lastFiled['ack_no'],
            ] : null,
            'next_due' => $nextDuePeriod ? [
                'period' => $nextDuePeriod['period'],
                'period_label' => $nextDuePeriod['period_label'],
                'date' => $nextDuePeriod['due_date'],
            ] : null,
        ];
    }

    /** "2026-Q3" (Oct-Dec) -> "2026-12": the month a quarterly return is recorded against when the admin
     *  marks it filed from the monthly review screens. Anything that isn't a quarter key is returned as is. */
    private static function quarterEndMonthKey(string $period): string
    {
        if (preg_match('/^(\d{4})-Q([1-4])$/', $period, $m) !== 1) {
            return $period;
        }

        return match ((int) $m[2]) {
            1 => "{$m[1]}-06",
            2 => "{$m[1]}-09",
            3 => "{$m[1]}-12",
            default => ((int) $m[1] + 1).'-03',
        };
    }

    /** Row status label + action ('request_filing' | 'view_details' | 'view_reconciliation')
     * for one Filing Periods table row. An existing request always wins (mirrors store()'s
     * own uniqueness check — a 'Correction Required' request re-enables Request Filing,
     * matching store()'s `whereNotIn('status', ['Correction Required'])` allowance);
     * otherwise a GSTR-3B period with pending reconciliation routes to View Reconciliation. */
    private static function resolvePeriodStatusAndAction(?GstFilingRequest $existing, string $returnType, ?string $reconciliationStatus): array
    {
        if ($existing) {
            return match ($existing->status) {
                'GST Filed' => ['Filed Successfully', 'view_details'],
                'Correction Required' => ['Correction Required', 'request_filing'],
                default => [$existing->status, 'view_details'],
            };
        }

        if ($returnType === 'GSTR-3B' && $reconciliationStatus === 'pending') {
            return ['Reconciliation Pending', 'view_reconciliation'];
        }

        return ['Request Not Raised', 'request_filing'];
    }
}
