<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Models\ClientCmp08Data;
use App\Models\ClientGstReturn;
use App\Models\ClientProfile;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Http\Request;

class ClientCmp08Controller extends Controller
{
    private static array $QUARTERS = [
        'Q1' => ['label' => 'Q1 (Apr – Jun)', 'months' => [4,5,6],    'due_month' => 7,  'due_day' => 18],
        'Q2' => ['label' => 'Q2 (Jul – Sep)', 'months' => [7,8,9],    'due_month' => 10, 'due_day' => 18],
        'Q3' => ['label' => 'Q3 (Oct – Dec)', 'months' => [10,11,12], 'due_month' => 1,  'due_day' => 18],
        'Q4' => ['label' => 'Q4 (Jan – Mar)', 'months' => [1,2,3],    'due_month' => 4,  'due_day' => 18],
    ];

    private function profile(): ClientProfile
    {
        $profile = auth()->user()->clientProfile;
        abort_unless($profile, 403);
        return $profile;
    }

    private function dueDate(string $qKey, int $fyStart, int $fyEnd): Carbon
    {
        $q    = self::$QUARTERS[$qKey];
        $year = $q['due_month'] < 7 ? $fyEnd : $fyStart; // Q3 (Jan) and Q4 (Apr) are due in the next calendar year
        return Carbon::create($year, $q['due_month'], $q['due_day']);
    }

    public function periods(Request $request): \Illuminate\Http\JsonResponse
    {
        $profile = $this->profile();

        $now     = Carbon::now();
        $fyStart = $now->month >= 4 ? $now->year : $now->year - 1;
        $fyEnd   = $fyStart + 1;
        $fy      = $fyStart . '-' . substr($fyEnd, -2);

        if ($fyParam = $request->input('financial_year')) {
            if (preg_match('/^(\d{4})-/', $fyParam, $m)) {
                $fyStart = (int) $m[1];
                $fyEnd   = $fyStart + 1;
                $fy      = $fyParam;
            }
        }

        $filedMap = ClientGstReturn::where('client_profile_id', $profile->id)
            ->where('return_type', ClientGstReturn::TYPE_CMP08)
            ->where('status', 'filed')
            ->where('tax_period', 'like', $fyStart . '-Q%')
            ->get()->keyBy('tax_period');

        $savedMap = ClientCmp08Data::where('client_profile_id', $profile->id)
            ->where('tax_period', 'like', $fyStart . '-Q%')
            ->get()->keyBy('tax_period');

        $periods = [];
        foreach (self::$QUARTERS as $qKey => $qInfo) {
            $periodKey = \App\Services\Gst\Cmp08Period::key($fyStart, $qKey);
            $due       = $this->dueDate($qKey, $fyStart, $fyEnd);
            $filed     = $filedMap->get($periodKey);
            $saved     = $savedMap->get($periodKey);

            $status = 'upcoming';
            if ($filed) {
                $status = 'filed';
            } elseif ($saved?->client_confirmed_at) {
                $status = 'confirmed';
            } elseif ($saved) {
                $status = 'pending';
            }

            $periods[] = [
                'period'        => $periodKey,
                'quarter'       => $qKey,
                'quarter_label' => $qInfo['label'],
                'due_date'      => $due->format('d/m/Y'),
                'status'        => $status,
                'prepared'      => $saved !== null,
                'filed_on'      => $filed?->filed_on?->format('d M Y'),
            ];
        }

        return response()->json([
            'financial_year' => $fy,
            'profile' => [
                'business_name' => $profile->business_name,
                'gstin'         => $profile->gstin,
                'dealer_type'   => $profile->dealer_type,
            ],
            'periods' => $periods,
        ]);
    }

    public function periodData(Request $request, string $period): \Illuminate\Http\JsonResponse
    {
        $profile = $this->profile();

        $parsed = \App\Services\Gst\Cmp08Period::parse($period);
        abort_unless($parsed, 404, 'Invalid CMP-08 period.');
        [$fyStart, $qKey] = $parsed;
        $fy        = \App\Services\Gst\Cmp08Period::fyLabel($fyStart);
        $fyEnd     = $fyStart + 1;
        $qInfo     = self::$QUARTERS[$qKey];
        $due       = $this->dueDate($qKey, $fyStart, $fyEnd);

        $filed = ClientGstReturn::where('client_profile_id', $profile->id)
            ->where('tax_period', $period)
            ->where('return_type', ClientGstReturn::TYPE_CMP08)
            ->first();

        $saved = ClientCmp08Data::where('client_profile_id', $profile->id)
            ->where('tax_period', $period)->first();

        $rate = (float) ($profile->composition_rate ?? 0) > 0 ? (float) $profile->composition_rate : 1.0;
        $defaultTurnover = [
            ['particulars' => 'Outward Supplies',      'taxable_value' => 0, 'rate' => $rate, 'tax_amount' => 0, 'remarks' => ''],
            ['particulars' => 'Supplies under RCM',     'taxable_value' => 0, 'rate' => $rate, 'tax_amount' => 0, 'remarks' => ''],
            ['particulars' => 'Other Taxable Supplies', 'taxable_value' => 0, 'rate' => $rate, 'tax_amount' => 0, 'remarks' => ''],
        ];
        $defaultAdj = [
            ['particulars' => 'Previous Period Adjustment', 'tax_amount' => 0, 'cgst' => 0, 'sgst' => 0, 'total' => 0, 'remarks' => ''],
            ['particulars' => 'Other Adjustment',           'tax_amount' => 0, 'cgst' => 0, 'sgst' => 0, 'total' => 0, 'remarks' => ''],
        ];

        $turnover    = $saved?->turnover    ?? $defaultTurnover;
        $adjustments = $saved?->adjustments ?? $defaultAdj;
        $payments    = $saved?->payments    ?? [];

        $taxLiability = array_sum(array_column($turnover,    'tax_amount'));
        $adjTotal     = array_sum(array_column($adjustments, 'total'));
        $netPayable   = $taxLiability + $adjTotal;
        $taxPaid      = array_sum(array_column($payments,    'amount'));
        $balance      = $netPayable - $taxPaid;

        $returnStatus = 'Upcoming';
        if ($filed) {
            $returnStatus = 'Filed';
        } elseif ($saved?->client_confirmed_at) {
            $returnStatus = 'Confirmed';
        } elseif ($saved) {
            $returnStatus = 'Pending';
        }

        return response()->json([
            'client' => [
                'business_name'     => $profile->business_name,
                'gstin'             => $profile->gstin ?? '—',
                'registration_type' => 'Composition',
            ],
            'period'        => $period,
            'quarter_label' => $qInfo['label'],
            'due_date'      => $due->format('d/m/Y'),
            'return_status' => $returnStatus,
            'filed_on'      => $filed?->filed_on?->format('d M Y'),
            'arn'           => $filed?->ack_no,
            'prepared_by_ca'      => $saved !== null,
            'client_confirmed_at' => $saved?->client_confirmed_at?->format('d M Y H:i'),
            'turnover'    => $turnover,
            'adjustments' => $adjustments,
            'payments'    => $payments,
            'remarks'     => $saved?->remarks ?? '',
            'summary' => [
                'total_taxable_turnover' => array_sum(array_column($turnover, 'taxable_value')),
                'tax_liability'          => round($taxLiability, 2),
                'adjustments'            => round($adjTotal, 2),
                'net_tax_payable'        => round($netPayable, 2),
                'tax_paid'               => round($taxPaid, 2),
                'balance_payable'        => round($balance, 2),
            ],
        ]);
    }

    public function confirm(Request $request, string $period): \Illuminate\Http\JsonResponse
    {
        $profile = $this->profile();

        $saved = ClientCmp08Data::where('client_profile_id', $profile->id)
            ->where('tax_period', $period)->first();

        abort_unless($saved, 404, 'CMP-08 data for this period has not been prepared yet.');
        abort_if($saved->client_confirmed_at, 422, 'This return has already been confirmed.');

        $saved->update([
            'client_confirmed_at' => now(),
            'client_confirmed_by' => auth()->id(),
        ]);

        return response()->json(['message' => 'CMP-08 return confirmed successfully.', 'confirmed_at' => now()->format('d M Y H:i')]);
    }

    public function download(Request $request, string $period): mixed
    {
        $profile = $this->profile();

        $parsed = \App\Services\Gst\Cmp08Period::parse($period);
        abort_unless($parsed, 404, 'Invalid CMP-08 period.');
        [$fyStart, $qKey] = $parsed;
        $fy        = \App\Services\Gst\Cmp08Period::fyLabel($fyStart);
        $fyEnd     = $fyStart + 1;
        $qInfo     = self::$QUARTERS[$qKey];
        $due       = $this->dueDate($qKey, $fyStart, $fyEnd);

        $saved = ClientCmp08Data::where('client_profile_id', $profile->id)->where('tax_period', $period)->first();
        $filed = \App\Models\ClientGstReturn::where('client_profile_id', $profile->id)
            ->where('tax_period', $period)->where('return_type', \App\Models\ClientGstReturn::TYPE_CMP08)->first();

        $turnover    = $saved?->turnover    ?? [];
        $adjustments = $saved?->adjustments ?? [];
        $payments    = $saved?->payments    ?? [];

        $taxLiability = array_sum(array_column($turnover,    'tax_amount'));
        $adjTotal     = array_sum(array_column($adjustments, 'total'));
        $netPayable   = $taxLiability + $adjTotal;
        $taxPaid      = array_sum(array_column($payments,    'amount'));
        $balance      = $netPayable - $taxPaid;

        $pdf = Pdf::loadView('pdf.cmp08_summary', [
            'client'       => ['business_name' => $profile->business_name, 'gstin' => $profile->gstin ?? '—'],
            'quarter_label'=> $qInfo['label'],
            'financial_year'=> $fy,
            'due_date'     => $due->format('d/m/Y'),
            'return_status'=> $filed ? 'Filed' : ($saved?->client_confirmed_at ? 'Confirmed' : 'Pending'),
            'turnover'     => $turnover,
            'adjustments'  => $adjustments,
            'payments'     => $payments,
            'summary'      => [
                'total_taxable_turnover' => array_sum(array_column($turnover, 'taxable_value')),
                'tax_liability'          => round($taxLiability, 2),
                'adjustments'            => round($adjTotal, 2),
                'net_tax_payable'        => round($netPayable, 2),
                'tax_paid'               => round($taxPaid, 2),
                'balance_payable'        => round($balance, 2),
            ],
        ]);

        return $pdf->download("CMP-08_{$period}.pdf");
    }
}
