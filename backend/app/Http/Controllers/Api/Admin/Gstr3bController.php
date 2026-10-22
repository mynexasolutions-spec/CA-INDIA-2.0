<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClientGstReturn;
use App\Models\ClientProfile;
use App\Models\ClientGstr3bPeriodData;
use App\Models\ClientGstr3bRequest;
use Illuminate\Http\Request;
use Carbon\Carbon;
use App\Services\Gst\Gstr3bCalculator;
use App\Services\Gst\ReturnRequestService;
use Illuminate\Support\Facades\DB;

class Gstr3bController extends Controller
{
    /**
     * Client detail + filing periods for GSTR-3B
     */
    public function clientPeriods(Request $request, int $clientId)
    {
        $client = $this->resolveClient($clientId, [
            'gstReturns' => fn($q) => $q->where('return_type', ClientGstReturn::TYPE_GSTR3B),
        ]);

        $now     = now();
        $fyStart = $now->month >= 4 ? $now->year : $now->year - 1;
        $fyEnd   = $fyStart + 1;

        $frequency = $client->gst_filing_frequency ?? 'monthly';

        $periods = [];
        for ($offset = 0; $offset < 12; $offset++) {
            $month = (($offset + 3) % 12) + 1;
            $year  = $month >= 4 ? $fyStart : $fyEnd;
            $periodKey = sprintf('%04d-%02d', $year, $month);

            // GSTR-3B due date: 20th of following month
            $dueCarbon    = Carbon::create($year, $month, 20)->addMonthNoOverflow();
            $dueDateLabel = $dueCarbon->format('d M Y');

            $filed = $client->gstReturns->first(fn($r) => $r->tax_period === $periodKey);

            if ($filed) {
                $status = 'filed';
            } elseif ($dueCarbon->isPast()) {
                $status = 'pending';
            } else {
                $status = 'upcoming';
            }

            $periods[] = [
                'period'   => $periodKey,
                'label'    => Carbon::create($year, $month, 1)->format('M Y'),
                'due_date' => $dueDateLabel,
                'status'   => $status,
                'filed_on' => $filed?->filed_on?->format('d M Y'),
                'arn'      => $filed?->ack_no,
            ];
        }

        $lastFiled = $client->gstReturns->sortByDesc('tax_period')->first();
        $notFiled  = collect($periods)->where('status', '!=', 'filed')->values();
        $lastPeriodFormatted = null;
        if ($lastFiled && $lastFiled->tax_period) {
            try {
                $lastPeriodFormatted = Carbon::createFromFormat('Y-m', $lastFiled->tax_period)->format('M Y');
            } catch (\Throwable $e) {
                $lastPeriodFormatted = $lastFiled->tax_period;
            }
        }

        return response()->json([
            'client' => [
                'id'               => $client->id,
                'client_code'      => $client->client_code,
                'business_name'    => $client->business_name ?? $client->client_name,
                'gstin'            => $client->gstin,
                'dealer_type'      => $client->dealer_type,
                'filing_frequency' => $frequency,
                'is_active'        => $client->user?->is_active ?? true,
                'email'            => $client->user?->email,
            ],
            'last_filed' => $lastFiled ? [
                'tax_period' => $lastPeriodFormatted,
                'filed_on'   => $lastFiled->filed_on?->format('d M Y'),
                'arn'        => $lastFiled->ack_no,
                'status'     => 'Filed',
            ] : null,
            'upcoming_due_dates' => [
                'current' => $notFiled->get(0)['due_date'] ?? null,
                'next'    => $notFiled->get(1)['due_date'] ?? null,
            ],
            'fy'      => $fyStart . '-' . substr((string)$fyEnd, 2),
            'periods' => $periods,
        ]);
    }

    /**
     * GSTR-3B data for a specific period (for the Review page)
     */
    public function periodData(Request $request, int $clientId, string $period)
    {
        $client = $this->resolveClient($clientId);
        $clientId = $client->id;

        [$yr, $mo] = explode('-', $period);
        $start = Carbon::create((int)$yr, (int)$mo, 1)->startOfMonth();
        $end   = $start->copy()->endOfMonth();

        $dueDate    = Carbon::create((int)$yr, (int)$mo, 20)->addMonthNoOverflow()->format('d/m/Y');
        $periodLabel = $start->format('M Y');

        $filed = ClientGstReturn::where('client_profile_id', $clientId)
            ->where('tax_period', $period)
            ->where('return_type', ClientGstReturn::TYPE_GSTR3B)
            ->first();

        // Every Summary number comes from the same calculator the tabs use, so it always
        // reflects what has been entered on the Outward, ITC, Interest and Cash Ledger tabs.
        $calc = Gstr3bCalculator::compute($clientId, $period);
        $t = $calc['totals'];
        $heads = ['IGST' => 'igst', 'CGST' => 'cgst', 'SGST/UTGST' => 'sgst'];

        $breakup = [];
        foreach ($heads as $label => $h) {
            $breakup[] = [
                'label'     => $label,
                'output'    => $calc['output'][$h],
                'itc'       => $calc['set_off']['itc_applied'][$h],
                'interest'  => $calc['interest'][$h],
                'late_fee'  => $calc['late_fee'][$h],
                'liability' => $calc['liability'][$h],
            ];
        }
        $breakup[] = [
            'label'     => 'Total',
            'output'    => $t['output'],
            'itc'       => round(array_sum($calc['set_off']['itc_applied']), 2),
            'interest'  => $t['interest'],
            'late_fee'  => $t['late_fee'],
            'liability' => $t['liability'],
            'is_total'  => true,
        ];

        $row = function (string $label, array $perHead, bool $isTotal = false) {
            $r = ['label' => $label, 'igst' => $perHead['igst'], 'cgst' => $perHead['cgst'], 'sgst' => $perHead['sgst'],
                  'total' => round($perHead['igst'] + $perHead['cgst'] + $perHead['sgst'], 2)];
            if ($isTotal) {
                $r['is_total'] = true;
            }

            return $r;
        };
        $grossLiability = [];
        foreach (Gstr3bCalculator::HEADS as $h) {
            $grossLiability[$h] = round($calc['output'][$h] + $calc['interest'][$h] + $calc['late_fee'][$h], 2);
        }

        return response()->json([
            'client' => [
                'id'               => $client->id,
                'business_name'    => $client->business_name ?? $client->client_name,
                'gstin'            => $client->gstin,
                'dealer_type'      => $client->dealer_type,
                'filing_frequency' => $client->gst_filing_frequency ?? 'monthly',
            ],
            'period'       => $period,
            'period_label' => $periodLabel,
            'due_date'     => $dueDate,
            'return_status' => $filed ? 'Filed' : 'Pending',
            'filed_on'      => $filed?->filed_on?->format('d M Y'),
            'arn'           => $filed?->ack_no,

            'summary' => [
                'total_outward_taxable' => $calc['gstr1']['taxable'],
                'total_output_tax'      => $t['output'],
                'total_eligible_itc'    => $t['itc_eligible'],
                'projected_itc'         => $t['itc_projected'], // already included in total_eligible_itc
                'total_tax_liability'   => $t['liability'],
                'net_tax_payable'       => $t['net_payable'],
                'excess_itc'            => $t['itc_balance'],
            ],

            'tax_payment_breakup' => $breakup,

            'itc_balance' => [
                $row('Total Tax Liability', $grossLiability),
                $row('Less: ITC', $calc['set_off']['itc_applied']),
                $row('Less: Tax Paid through Cash Ledger', $calc['cash_paid']),
                $row('Balance ITC (Available)', $calc['set_off']['balance_itc'], true),
            ],
        ]);
    }

    /**
     * Get saved tab data for a period
     */
    public function getTabData(Request $request, int $clientId, string $period)
    {
        $client = $this->resolveClient($clientId);
        $clientId = $client->id;

        $row = ClientGstr3bPeriodData::where('client_profile_id', $clientId)
            ->where('tax_period', $period)->first();

        // Auto-populated Liability to GSTR-1 (same figure the GSTR-1 review shows).
        $calc = Gstr3bCalculator::compute($clientId, $period);
        $gstr1Igst = $calc['gstr1']['igst'];
        $gstr1Cgst = $calc['gstr1']['cgst'];
        $gstr1Sgst = $calc['gstr1']['sgst'];

        // ITC from GSTR-2B
        $itcRow = \App\Models\ClientGstr2bInvoice::where('client_profile_id', $clientId)
            ->where('tax_period', $period)
            ->where('itc_eligibility', 'eligible')
            ->where('match_status', 'matched')
            ->selectRaw('COUNT(*) as matched, SUM(igst) as igst, SUM(cgst) as cgst, SUM(sgst) as sgst')
            ->first();

        $totalInv = \App\Models\ClientGstr2bInvoice::where('client_profile_id', $clientId)
            ->where('tax_period', $period)->count();
        $unmatchedInv = \App\Models\ClientGstr2bInvoice::where('client_profile_id', $clientId)
            ->where('tax_period', $period)
            ->notMatched()->count();

        $unmatchedItc = \App\Models\ClientGstr2bInvoice::where('client_profile_id', $clientId)
            ->where('tax_period', $period)
            ->notMatched()
            ->selectRaw('COALESCE(SUM(igst),0) + COALESCE(SUM(cgst),0) + COALESCE(SUM(sgst),0) as total')
            ->value('total');
        // Same definition the GSTR-2B screens use: every matched invoice, whatever its eligibility.
        $matchedItcAll = \App\Models\ClientGstr2bInvoice::where('client_profile_id', $clientId)
            ->where('tax_period', $period)
            ->where('match_status', 'matched')
            ->selectRaw('COALESCE(SUM(igst),0) + COALESCE(SUM(cgst),0) + COALESCE(SUM(sgst),0) as total')
            ->value('total');

        // Projected ITC (client's estimate, until the official GSTR-2B is loaded) is added to the
        // GSTR-2B ITC heads, and also returned separately so the screen can label it.
        $projectedItc = \App\Services\Gst\ProjectedItc::forPeriod($clientId, $period);
        $itcIgst = round(($itcRow->igst ?? 0) + $projectedItc['igst'], 2);
        $itcCgst = round(($itcRow->cgst ?? 0) + $projectedItc['cgst'], 2);
        $itcSgst = round(($itcRow->sgst ?? 0) + $projectedItc['sgst'], 2);

        $outward = $row?->outward_rcm ?? [
            'rcm_igst' => 0, 'rcm_cgst' => 0, 'rcm_sgst' => 0,
            'adj_igst' => 0, 'adj_cgst' => 0, 'adj_sgst' => 0,
        ];

        $itcData = $row?->itc_data ?? [
            'bf_igst'  => 0, 'bf_cgst'  => 0, 'bf_sgst'  => 0,
            'adj_igst' => 0, 'adj_cgst' => 0, 'adj_sgst' => 0,
            'rev_igst' => 0, 'rev_cgst' => 0, 'rev_sgst' => 0,
            'other_igst' => 0, 'other_cgst' => 0, 'other_sgst' => 0,
        ];

        $interestData = $row?->interest_data ?? [
            'output_igst' => 0,'output_cgst' => 0,'output_sgst' => 0,'output_utgst' => 0,'output_remarks' => '',
            'rcm_igst'    => 0,'rcm_cgst'    => 0,'rcm_sgst'    => 0,'rcm_utgst'    => 0,'rcm_remarks'    => '',
            'other_igst'  => 0,'other_cgst'  => 0,'other_sgst'  => 0,'other_utgst'  => 0,'other_remarks'  => '',
        ];

        $lateFeeData = $row?->late_fee_data ?? [
            'output_igst' => 0,'output_cgst' => 0,'output_sgst' => 0,'output_utgst' => 0,'output_remarks' => '',
            'rcm_igst'    => 0,'rcm_cgst'    => 0,'rcm_sgst'    => 0,'rcm_utgst'    => 0,'rcm_remarks'    => '',
            'other_igst'  => 0,'other_cgst'  => 0,'other_sgst'  => 0,'other_utgst'  => 0,'other_remarks'  => '',
        ];

        $cashLedger = $row?->cash_ledger ?? [
            'opening_balance' => ['igst' => 0, 'cgst' => 0, 'sgst' => 0],
            'payments'        => [],
            'utilisations'    => [],
        ];

        return response()->json([
            'remarks'    => $row?->remarks ?? '',
            'gstr1'      => ['igst' => $gstr1Igst, 'cgst' => $gstr1Cgst, 'sgst' => $gstr1Sgst],
            // Output tax & RCM per head (saved RCM / adjustments included): the liability the ITC tab sets off against.
            'liability'  => $calc['output'],
            'outward'    => $outward,
            'itc_gstr2b' => ['igst' => $itcIgst, 'cgst' => $itcCgst, 'sgst' => $itcSgst,
                             'total_invoices' => $totalInv, 'matched' => $itcRow->matched ?? 0, 'unmatched' => $unmatchedInv,
                             'unmatched_itc' => round((float) $unmatchedItc, 2),
                             'matched_itc' => round((float) $matchedItcAll, 2),
                             'projected' => $projectedItc],
            'itc_data'   => $itcData,
            'interest'   => $interestData,
            'late_fee'   => $lateFeeData,
            'cash_ledger'=> $cashLedger,
        ]);
    }

    /**
     * Save tab data for a period
     */
    public function saveTabData(Request $request, int $clientId, string $period)
    {
        $client = $this->resolveClient($clientId);
        $clientId = $client->id;

        $allowed = ['outward_rcm','itc_data','interest_data','late_fee_data','cash_ledger','remarks'];
        $update  = array_intersect_key($request->all(), array_flip($allowed));
        $update['updated_by'] = auth()->id();

        ClientGstr3bPeriodData::updateOrCreate(
            ['client_profile_id' => $clientId, 'tax_period' => $period],
            $update
        );

        return response()->json(['message' => 'Saved successfully.']);
    }

    /**
     * Get current request status for a period
     */
    public function getRequest(Request $request, int $clientId, string $period)
    {
        $client = $this->resolveClient($clientId);

        $req = ReturnRequestService::latest($client->id, ClientGstr3bRequest::RETURN_GSTR3B, $period);

        return response()->json(['request' => $req?->load('client')->toScreen()]);
    }

    /**
     * Admin initiates a GSTR-3B request on the client's behalf
     */
    public function initiateRequest(Request $request, int $clientId, string $period)
    {
        $client = $this->resolveClient($clientId);

        if (! preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $period)) {
            return response()->json(['message' => 'Invalid tax period.'], 422);
        }

        $req = ReturnRequestService::initiate($client, ClientGstr3bRequest::RETURN_GSTR3B, $period, auth()->id());

        if (! $req) {
            return response()->json(['message' => 'A request for this tax period is already in progress.'], 422);
        }

        return response()->json([
            'message' => 'Request initiated successfully.',
            'request' => $req->load('client')->toScreen(),
        ]);
    }

    /**
     * Admin rejects a request the client submitted (needs a reason; the client sees it).
     */
    public function rejectRequest(Request $request, int $clientId, string $period)
    {
        $data = $request->validate(['reason' => 'required|string|max:500']);

        $client = $this->resolveClient($clientId);
        $req = ReturnRequestService::reject($client, ClientGstr3bRequest::RETURN_GSTR3B, $period, $data['reason']);

        if (! $req) {
            return response()->json(['message' => 'There is no submitted request to reject for this period.'], 422);
        }

        return response()->json(['message' => 'Request rejected.', 'request' => $req->load('client')->toScreen()]);
    }

    /**
     * Mark a period as filed
     */
    public function markAsFiled(Request $request, int $clientId, string $period)
    {
        $client = $this->resolveClient($clientId);
        $clientId = $client->id;

        $request->validate([
            'filed_on' => 'required|date',
            'arn'      => 'required|string|max:100',
        ]);

        ClientGstReturn::updateOrCreate(
            ['client_profile_id'=>$clientId,'tax_period'=>$period,'return_type'=>ClientGstReturn::TYPE_GSTR3B],
            ['status'=>'filed','filed_on'=>$request->filed_on,'ack_no'=>$request->arn,'filed_by'=>auth()->id()]
        );

        // The return is filed — close any request still open for this period.
        ReturnRequestService::complete($clientId, ClientGstr3bRequest::RETURN_GSTR3B, $period);

        return response()->json(['message' => 'Marked as filed successfully.']);
    }

    /**
     * Resolve the client profile for a URL id.
     *
     * The admin UI passes the client_profile id. A user_id is accepted only as a
     * fallback when no profile has that id, so the lookup is deterministic and an
     * unknown id is a 404 — never some other client's data.
     */
    private function resolveClient(int $clientId, array $with = []): ClientProfile
    {
        $with = array_merge(['user:id,name,is_active'], $with);

        $client = ClientProfile::with($with)->find($clientId)
            ?? ClientProfile::with($with)->where('user_id', $clientId)->first();

        if (!$client) {
            abort(404, 'Client not found');
        }

        return $client;
    }
}
