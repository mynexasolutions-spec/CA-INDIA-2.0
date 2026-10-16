<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClientCmp08Data;
use App\Models\ClientGstr3bRequest;
use App\Models\ClientGstReturn;
use App\Models\ClientProfile;
use App\Services\Gst\Cmp08Period;
use App\Services\Gst\ReturnRequestService;
use Illuminate\Http\Request;

class Cmp08Controller extends Controller
{
    private const RETURN = ClientGstr3bRequest::RETURN_CMP08;

    /** Only Composition clients file CMP-08. */
    private function compositionClient(int $clientId): ClientProfile
    {
        return ClientProfile::with('user:id,name,is_active')
            ->where('dealer_type', 'composition')
            ->findOrFail($clientId);
    }

    /** @return array{0: int, 1: string} */
    private function parsePeriod(string $period): array
    {
        $parsed = Cmp08Period::parse($period);
        abort_unless($parsed, 404, 'Invalid CMP-08 period.');

        return $parsed;
    }

    /** Default tax rate on a new return = the client's own composition rate (1% for traders / manufacturers). */
    private function defaultRate(ClientProfile $client): float
    {
        $rate = (float) ($client->composition_rate ?? 0);

        return $rate > 0 ? $rate : 1.0;
    }

    private function n(mixed $v): float
    {
        return is_numeric($v) ? (float) $v : 0.0;
    }

    /**
     * Brings every row into its consistent shape. This is the single source of the arithmetic, so
     * the totals, the cards and Net / Balance Payable can never disagree with the saved rows.
     *
     * - Turnover:   tax = taxable value x rate
     * - Adjustment: Tax Amount = CGST + SGST = Total (positive = add, negative = less). If only a
     *               Tax Amount is given it is split equally between CGST and SGST.
     * - Payment:    amount as a number
     */
    private function normalise(array $turnover, array $adjustments, array $payments): array
    {
        $turnover = array_map(function ($r) {
            $taxable = $this->n($r['taxable_value'] ?? 0);
            $rate = $this->n($r['rate'] ?? 0);

            return [
                'particulars'   => (string) ($r['particulars'] ?? ''),
                'taxable_value' => round($taxable, 2),
                'rate'          => $rate,
                'tax_amount'    => round($taxable * $rate / 100, 2),
                'remarks'       => (string) ($r['remarks'] ?? ''),
            ];
        }, array_values($turnover));

        $adjustments = array_map(function ($r) {
            $tax = $this->n($r['tax_amount'] ?? 0);
            $cgst = $this->n($r['cgst'] ?? 0);
            $sgst = $this->n($r['sgst'] ?? 0);

            if (abs($cgst + $sgst) < 0.005 && abs($tax) >= 0.005) {
                $cgst = round($tax / 2, 2);
                $sgst = round($tax - $cgst, 2);
            } else {
                $tax = round($cgst + $sgst, 2);
            }

            return [
                'particulars' => (string) ($r['particulars'] ?? ''),
                'tax_amount'  => $tax,
                'cgst'        => round($cgst, 2),
                'sgst'        => round($sgst, 2),
                'total'       => $tax,
                'remarks'     => (string) ($r['remarks'] ?? ''),
            ];
        }, array_values($adjustments));

        $payments = array_map(fn ($r) => [
            'date'       => $r['date'] ?? null,
            'challan_no' => $r['challan_no'] ?? null,
            'mode'       => $r['mode'] ?? null,
            'amount'     => round($this->n($r['amount'] ?? 0), 2),
            'remarks'    => (string) ($r['remarks'] ?? ''),
        ], array_values($payments));

        return [$turnover, $adjustments, $payments];
    }

    private function summary(array $turnover, array $adjustments, array $payments): array
    {
        $liability = round(array_sum(array_column($turnover, 'tax_amount')), 2);
        $adjTotal = round(array_sum(array_column($adjustments, 'total')), 2);
        $net = round($liability + $adjTotal, 2);
        $paid = round(array_sum(array_column($payments, 'amount')), 2);

        return [
            'total_taxable_turnover' => round(array_sum(array_column($turnover, 'taxable_value')), 2),
            'tax_liability'          => $liability,
            'adjustments'            => $adjTotal,
            'net_tax_payable'        => $net,
            'tax_paid'               => $paid,
            'balance_payable'        => round($net - $paid, 2),
        ];
    }

    public function clientList(Request $request)
    {
        $fyStart = Cmp08Period::fyStartFromLabel($request->input('fy'));
        $quarter = $request->input('quarter', 'All');
        $status  = $request->input('status', 'All');
        $search  = trim((string) $request->input('search', ''));
        $page    = max(1, (int) $request->input('page', 1));
        $perPage = 10;

        $query = ClientProfile::where('dealer_type', 'composition')->with(['user:id,name,is_active']);

        if ($search !== '') {
            $query->where(fn ($q) =>
                $q->where('business_name', 'like', "%$search%")
                  ->orWhere('client_name', 'like', "%$search%")
                  ->orWhere('client_code', 'like', "%$search%")
                  ->orWhere('gstin', 'like', "%$search%")
            );
        }

        $clients = $query->orderBy('business_name')->get();

        $filedMap = ClientGstReturn::whereIn('client_profile_id', $clients->pluck('id'))
            ->where('return_type', ClientGstReturn::TYPE_CMP08)
            ->where('status', 'filed')
            ->where('tax_period', 'like', $fyStart.'-Q%')
            ->get()
            ->keyBy(fn ($r) => $r->client_profile_id.'|'.$r->tax_period);

        $quartersToShow = $quarter === 'All' || ! isset(Cmp08Period::QUARTERS[$quarter])
            ? array_keys(Cmp08Period::QUARTERS)
            : [$quarter];

        $rows = [];
        $pendingCount = 0;
        $filedCount = 0;

        foreach ($clients as $client) {
            foreach (array_keys(Cmp08Period::QUARTERS) as $qKey) {
                $periodKey = Cmp08Period::key($fyStart, $qKey);
                $due = Cmp08Period::dueDate($fyStart, $qKey);
                $filed = $filedMap->get($client->id.'|'.$periodKey);
                $rowStatus = Cmp08Period::status((bool) $filed, $due);

                // Summary cards count the whole FY, whatever quarter / status filter is applied.
                if ($rowStatus === 'Pending') { $pendingCount++; }
                if ($rowStatus === 'Filed') { $filedCount++; }

                if (! in_array($qKey, $quartersToShow, true)) { continue; }
                if ($status !== 'All' && $rowStatus !== $status) { continue; }

                $rows[] = [
                    'client_id'     => $client->id,
                    'client_code'   => $client->client_code,
                    'business_name' => $client->business_name ?? $client->client_name,
                    'gstin'         => $client->gstin ?? '—',
                    'quarter'       => Cmp08Period::quarterLabel($fyStart, $qKey),
                    'quarter_key'   => $qKey,
                    'period'        => $periodKey,
                    'due_date'      => $due->format('d/m/Y'),
                    'status'        => $rowStatus,
                    'filed_on'      => $filed?->filed_on?->format('d M Y'),
                    'arn'           => $filed?->ack_no,
                ];
            }
        }

        return response()->json([
            'rows'     => array_values(array_slice($rows, ($page - 1) * $perPage, $perPage)),
            'total'    => count($rows),
            'page'     => $page,
            'per_page' => $perPage,
            'summary'  => [
                'total_clients'  => $clients->count(),
                'active_clients' => $clients->filter(fn ($c) => $c->user?->is_active)->count(),
                'pending'        => $pendingCount,
                'filed'          => $filedCount,
            ],
            'quarters' => array_map(fn ($k, $v) => ['key' => $k, 'label' => $v['label']], array_keys(Cmp08Period::QUARTERS), Cmp08Period::QUARTERS),
        ]);
    }

    public function periodData(Request $request, int $clientId, string $period)
    {
        $client = $this->compositionClient($clientId);
        [$fyStart, $qKey] = $this->parsePeriod($period);
        $due = Cmp08Period::dueDate($fyStart, $qKey);

        $filed = ClientGstReturn::where('client_profile_id', $client->id)
            ->where('tax_period', $period)
            ->where('return_type', ClientGstReturn::TYPE_CMP08)
            ->where('status', 'filed')
            ->first();

        $saved = ClientCmp08Data::where('client_profile_id', $client->id)->where('tax_period', $period)->first();

        $rate = $this->defaultRate($client);
        $defaultTurnover = array_map(fn ($p) => ['particulars' => $p, 'taxable_value' => 0, 'rate' => $rate, 'tax_amount' => 0, 'remarks' => ''],
            ['Outward Supplies', 'Supplies under RCM', 'Other Taxable Supplies']);
        $defaultAdj = array_map(fn ($p) => ['particulars' => $p, 'tax_amount' => 0, 'cgst' => 0, 'sgst' => 0, 'total' => 0, 'remarks' => ''],
            ['Previous Period Adjustment', 'Other Adjustment']);

        [$turnover, $adjustments, $payments] = $this->normalise(
            $saved?->turnover ?: $defaultTurnover,
            $saved?->adjustments ?: $defaultAdj,
            $saved?->payments ?? []
        );

        return response()->json([
            'client' => [
                'id'                => $client->id,
                'client_code'       => $client->client_code,
                'business_name'     => $client->business_name ?? $client->client_name,
                'gstin'             => $client->gstin ?? '—',
                'dealer_type'       => 'composition',
                'registration_type' => 'Composition',
                'composition_rate'  => $rate,
            ],
            'period'        => $period,
            'quarter_label' => Cmp08Period::quarterLabel($fyStart, $qKey),
            'due_date'      => $due->format('d/m/Y'),
            'return_status' => Cmp08Period::status((bool) $filed, $due),
            'filed_on'      => $filed?->filed_on?->format('d M Y'),
            'arn'           => $filed?->ack_no,
            'turnover'      => $turnover,
            'adjustments'   => $adjustments,
            'payments'      => $payments,
            'remarks'       => $saved?->remarks ?? '',
            'summary'       => $this->summary($turnover, $adjustments, $payments),
        ]);
    }

    public function saveData(Request $request, int $clientId, string $period)
    {
        $client = $this->compositionClient($clientId);
        $this->parsePeriod($period);

        $data = $request->validate([
            'turnover'                  => 'sometimes|array|max:20',
            'turnover.*.particulars'    => 'required|string|max:100',
            'turnover.*.taxable_value'  => 'nullable|numeric',
            'turnover.*.rate'           => 'nullable|numeric|min:0|max:99.99',
            'turnover.*.remarks'        => 'nullable|string|max:255',
            'adjustments'               => 'sometimes|array|max:20',
            'adjustments.*.particulars' => 'required|string|max:100',
            'adjustments.*.tax_amount'  => 'nullable|numeric',
            'adjustments.*.cgst'        => 'nullable|numeric',
            'adjustments.*.sgst'        => 'nullable|numeric',
            'adjustments.*.remarks'     => 'nullable|string|max:255',
            'payments'                  => 'sometimes|array|max:200',
            'payments.*.date'           => 'nullable|string|max:20',
            'payments.*.challan_no'     => 'nullable|string|max:50',
            'payments.*.mode'           => 'nullable|string|max:50',
            'payments.*.amount'         => 'required|numeric|min:0',
            'payments.*.remarks'        => 'nullable|string|max:255',
            'remarks'                   => 'nullable|string|max:2000',
        ]);

        $row = ClientCmp08Data::firstOrNew(['client_profile_id' => $client->id, 'tax_period' => $period]);
        [$turnover, $adjustments, $payments] = $this->normalise(
            $data['turnover'] ?? $row->turnover ?? [],
            $data['adjustments'] ?? $row->adjustments ?? [],
            $data['payments'] ?? $row->payments ?? []
        );

        $row->fill([
            'turnover'    => $turnover,
            'adjustments' => $adjustments,
            'payments'    => $payments,
            'updated_by'  => auth()->id(),
        ]);
        if (array_key_exists('remarks', $data)) {
            $row->remarks = $data['remarks'];
        }
        $row->save();

        return response()->json([
            'message'     => 'Saved successfully.',
            'turnover'    => $turnover,
            'adjustments' => $adjustments,
            'payments'    => $payments,
            'summary'     => $this->summary($turnover, $adjustments, $payments),
        ]);
    }

    public function markAsFiled(Request $request, int $clientId, string $period)
    {
        $client = $this->compositionClient($clientId);
        $this->parsePeriod($period);

        $data = $request->validate([
            'filed_on' => 'required|date',
            'arn'      => ['required', 'string', 'max:100', 'regex:/\S/'],
        ], ['filed_on.required' => 'Filed On date is required.', 'arn.required' => 'ARN is required.', 'arn.regex' => 'ARN is required.']);

        ClientGstReturn::updateOrCreate(
            ['client_profile_id' => $client->id, 'tax_period' => $period, 'return_type' => ClientGstReturn::TYPE_CMP08],
            ['status' => 'filed', 'filed_on' => $data['filed_on'], 'ack_no' => trim($data['arn']), 'filed_by' => auth()->id()]
        );

        // The return is filed - close any request still open for this quarter.
        ReturnRequestService::complete($client->id, self::RETURN, $period);

        return response()->json(['message' => 'Marked as filed successfully.']);
    }

    // ── Request flow (same as GSTR-3B) ──────────────────────────────────────────────

    public function getRequest(Request $request, int $clientId, string $period)
    {
        $client = $this->compositionClient($clientId);
        $this->parsePeriod($period);

        $req = ReturnRequestService::latest($client->id, self::RETURN, $period);

        return response()->json(['request' => $req?->load('client')->toScreen()]);
    }

    public function initiateRequest(Request $request, int $clientId, string $period)
    {
        $client = $this->compositionClient($clientId);
        $this->parsePeriod($period);

        $req = ReturnRequestService::initiate($client, self::RETURN, $period, auth()->id());

        if (! $req) {
            return response()->json(['message' => 'A request for this tax period is already in progress.'], 422);
        }

        return response()->json(['message' => 'Request initiated successfully.', 'request' => $req->load('client')->toScreen()]);
    }

    public function rejectRequest(Request $request, int $clientId, string $period)
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:500', 'regex:/\S/']], [
            'reason.required' => 'Please provide a reason for rejecting this request.',
            'reason.regex'    => 'Please provide a reason for rejecting this request.',
        ]);

        $client = $this->compositionClient($clientId);
        $this->parsePeriod($period);

        $req = ReturnRequestService::reject($client, self::RETURN, $period, trim($data['reason']));

        if (! $req) {
            return response()->json(['message' => 'There is no submitted request to reject for this period.'], 422);
        }

        return response()->json(['message' => 'Request rejected.', 'request' => $req->load('client')->toScreen()]);
    }
}
