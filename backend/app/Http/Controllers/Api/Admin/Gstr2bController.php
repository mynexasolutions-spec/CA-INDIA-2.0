<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClientGstr2bAdjustment;
use App\Models\ClientGstr2bInvoice;
use App\Models\ClientGstr2bProjectedInvoice;
use App\Models\ClientGstr2bRecord;
use App\Models\ClientProfile;
use App\Services\Gstr2b\Gstr2bJsonParser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Throwable;

class Gstr2bController extends Controller
{
    public function index(int $clientId)
    {
        ClientProfile::findOrFail($clientId);

        $records = ClientGstr2bRecord::where('client_profile_id', $clientId)
            ->withCount('invoices')
            ->with('uploader:id,name')
            ->orderByDesc('tax_period')
            ->get();

        return response()->json($records);
    }

    public function upload(Request $request, int $clientId)
    {
        ClientProfile::findOrFail($clientId);

        $data = $request->validate([
            // 'YYYY-MM' for a monthly-cadence client, 'YYYY-Qn' for a quarterly one — see
            // BillingPolicy::gstr2bFrequency().
            'tax_period' => 'required|regex:/^\d{4}-(0[1-9]|1[0-2]|Q[1-4])$/',
            'file' => 'required|file|mimes:pdf,xls,xlsx,json,csv|max:10240',
        ]);

        $file = $request->file('file');
        $path = $file->store('gstr2b/'.$clientId, 'public');

        $existing = ClientGstr2bRecord::where('client_profile_id', $clientId)
            ->where('tax_period', $data['tax_period'])
            ->first();

        $attrs = [
            'financial_year' => $this->deriveFinancialYear($data['tax_period']),
            'no_bills' => false,
            'file_path' => $path,
            'file_name' => $file->getClientOriginalName(),
            'file_type' => $file->getClientMimeType(),
            'file_size' => $file->getSize(),
            'uploaded_by' => $request->user()->id,
        ];

        if ($existing) {
            if ($existing->file_path) {
                Storage::disk('public')->delete($existing->file_path);
            }
            $existing->update($attrs);
            $record = $existing;
        } else {
            $record = ClientGstr2bRecord::create([
                'client_profile_id' => $clientId,
                'tax_period' => $data['tax_period'],
                ...$attrs,
            ]);
        }

        $parseWarning = null;

        if (strtolower($file->getClientOriginalExtension()) === 'json') {
            ClientGstr2bInvoice::where('gstr2b_record_id', $record->id)->delete();

            try {
                $rows = app(Gstr2bJsonParser::class)->parse(Storage::disk('public')->get($path));

                foreach ($rows as $row) {
                    ClientGstr2bInvoice::create([
                        ...$row,
                        // The file's own eligibility flag is only a hint — Admin decides (Yes/No).
                        // Until then the invoice shows "Select" and contributes no ITC.
                        'itc_eligibility' => null,
                        'client_profile_id' => $clientId,
                        'gstr2b_record_id' => $record->id,
                        'financial_year' => $record->financial_year,
                        'tax_period' => $record->tax_period,
                    ]);
                }
            } catch (Throwable $e) {
                $parseWarning = $e->getMessage();
            }
        }

        $response = $record->fresh(['uploader:id,name'])->toArray();
        $response['parse_warning'] = $parseWarning;

        return response()->json($response, $existing ? 200 : 201);
    }

    /** GSTR-3B Filing Request reconciliation gate spec — lets an admin mark a period as
     *  "No Bills in GSTR-2B" instead of uploading a file, so the client can raise the
     *  GSTR-3B request directly for that period without a real GSTR-2B statement to
     *  reconcile against. Period-wise, same upsert-by-(client, tax_period) shape as
     *  upload() above; wipes any invoices/file the period previously had. */
    public function markNoBills(Request $request, int $clientId)
    {
        ClientProfile::findOrFail($clientId);

        $data = $request->validate([
            'tax_period' => 'required|regex:/^\d{4}-(0[1-9]|1[0-2]|Q[1-4])$/',
        ]);

        $existing = ClientGstr2bRecord::where('client_profile_id', $clientId)
            ->where('tax_period', $data['tax_period'])
            ->first();

        $attrs = [
            'financial_year' => $this->deriveFinancialYear($data['tax_period']),
            'no_bills' => true,
            'file_path' => null,
            'file_name' => null,
            'file_type' => null,
            'file_size' => null,
            'uploaded_by' => $request->user()->id,
        ];

        if ($existing) {
            if ($existing->file_path) {
                Storage::disk('public')->delete($existing->file_path);
            }
            ClientGstr2bInvoice::where('gstr2b_record_id', $existing->id)->delete();
            $existing->update($attrs);
            $record = $existing;
        } else {
            $record = ClientGstr2bRecord::create([
                'client_profile_id' => $clientId,
                'tax_period' => $data['tax_period'],
                ...$attrs,
            ]);
        }

        return response()->json($record->fresh(['uploader:id,name']), $existing ? 200 : 201);
    }

    public function destroy(int $clientId, int $recordId)
    {
        $record = ClientGstr2bRecord::where('client_profile_id', $clientId)->findOrFail($recordId);

        if ($record->file_path) {
            Storage::disk('public')->delete($record->file_path);
        }
        $record->delete();

        return response()->json(['message' => 'Deleted']);
    }

    /** Replaces the invoice line items for a record with rows the admin's browser parsed
     * out of an Excel/CSV GSTR-2B export (the JSON format is parsed server-side in
     * upload(); spreadsheet formats don't have a PHP-side parser, so the frontend reads
     * the sheet with SheetJS and posts back the mapped rows instead). */
    public function bulkStoreInvoices(Request $request, int $clientId, int $recordId)
    {
        $record = ClientGstr2bRecord::where('client_profile_id', $clientId)->findOrFail($recordId);

        $data = $request->validate([
            'invoices' => 'present|array',
            'invoices.*.supplier_gstin' => 'nullable|string|max:20',
            'invoices.*.supplier_name' => 'nullable|string|max:255',
            'invoices.*.invoice_number' => 'nullable|string|max:255',
            'invoices.*.invoice_date' => 'nullable|date',
            'invoices.*.invoice_value' => 'nullable|numeric',
            'invoices.*.taxable_value' => 'nullable|numeric',
            'invoices.*.cgst' => 'nullable|numeric',
            'invoices.*.sgst' => 'nullable|numeric',
            'invoices.*.igst' => 'nullable|numeric',
            'invoices.*.cess' => 'nullable|numeric',
            'invoices.*.itc_eligibility' => ['nullable', 'string', Rule::in(ClientGstr2bInvoice::ITC_ELIGIBILITIES)],
            'invoices.*.itc_reason' => 'nullable|string|max:255',
        ]);

        ClientGstr2bInvoice::where('gstr2b_record_id', $record->id)->delete();

        foreach ($data['invoices'] as $row) {
            $cgst = (float) ($row['cgst'] ?? 0);
            $sgst = (float) ($row['sgst'] ?? 0);
            $igst = (float) ($row['igst'] ?? 0);

            ClientGstr2bInvoice::create([
                'client_profile_id' => $clientId,
                'gstr2b_record_id' => $record->id,
                'financial_year' => $record->financial_year,
                'tax_period' => $record->tax_period,
                'supplier_gstin' => $row['supplier_gstin'] ?? null,
                'supplier_name' => $row['supplier_name'] ?? null,
                'invoice_number' => $row['invoice_number'] ?? null,
                'invoice_date' => $row['invoice_date'] ?? null,
                'invoice_value' => (float) ($row['invoice_value'] ?? 0),
                'taxable_value' => (float) ($row['taxable_value'] ?? 0),
                'cgst' => $cgst,
                'sgst' => $sgst,
                'igst' => $igst,
                'cess' => (float) ($row['cess'] ?? 0),
                'total_gst' => $cgst + $sgst + $igst,
                // Admin decides eligibility after upload; default is "Select" (null).
                'itc_eligibility' => null,
                'itc_reason' => $row['itc_reason'] ?? null,
            ]);
        }

        return response()->json(
            ClientGstr2bInvoice::where('gstr2b_record_id', $record->id)->orderBy('id')->get()
        );
    }

    /** Structured invoice line items for one uploaded record — populated either by the
     * server-side JSON parser (upload()) or by bulkStoreInvoices() for spreadsheet formats. */
    public function invoices(int $clientId, int $recordId)
    {
        $record = ClientGstr2bRecord::where('client_profile_id', $clientId)->findOrFail($recordId);

        return response()->json(
            ClientGstr2bInvoice::where('gstr2b_record_id', $record->id)->orderBy('id')->get()
        );
    }

    /** Lets an admin correct/override the ITC eligibility the parser assigned to one
     * invoice line, with an optional reason (e.g. "Blocked credit u/s 17(5)"). */
    public function updateEligibility(Request $request, int $clientId, int $invoiceId)
    {
        $data = $request->validate([
            'itc_eligibility' => ['required', 'string', Rule::in(ClientGstr2bInvoice::ITC_ELIGIBILITIES)],
            'itc_reason' => ['nullable', 'string', 'max:255'],
        ]);

        $invoice = ClientGstr2bInvoice::where('client_profile_id', $clientId)->findOrFail($invoiceId);
        $invoice->update($data);

        return response()->json($invoice->fresh());
    }

    /** All periods (monthly or quarterly) for a client's FY with stats */
    public function periods(Request $request, int $clientId)
    {
        $client = ClientProfile::with('user:id,is_active')->findOrFail($clientId);
        $freq = $client->gstr2b_filing_frequency ?? $client->gst_filing_frequency ?? 'monthly';

        $now = now();
        $fyStart = $now->month >= 4 ? $now->year : $now->year - 1;
        $fyEnd   = $fyStart + 1;
        $fy      = $fyStart.'-'.substr($fyEnd, -2);

        $records = ClientGstr2bRecord::where('client_profile_id', $clientId)
            ->where('financial_year', $fy)
            ->withCount(['invoices',
                'invoices as matched_count' => fn($q) => $q->where('match_status', 'matched'),
                'invoices as unmatched_count' => fn($q) => $q->notMatched(),
            ])
            ->get()->keyBy('tax_period');

        $periods = [];
        if ($freq === 'quarterly') {
            $quarters = [
                ['key'=>"$fyStart-Q1", 'label'=>"Q1 (Apr $fyStart – Jun $fyStart)", 'due'=>\Carbon\Carbon::create($fyStart, 7, 14)],
                ['key'=>"$fyStart-Q2", 'label'=>"Q2 (Jul $fyStart – Sep $fyStart)", 'due'=>\Carbon\Carbon::create($fyStart, 10, 14)],
                ['key'=>"$fyStart-Q3", 'label'=>"Q3 (Oct $fyStart – Dec $fyStart)", 'due'=>\Carbon\Carbon::create($fyEnd, 1, 14)],
                ['key'=>"$fyStart-Q4", 'label'=>"Q4 (Jan $fyEnd – Mar $fyEnd)",     'due'=>\Carbon\Carbon::create($fyEnd, 4, 14)],
            ];
            foreach ($quarters as $i => $q) {
                $rec = $records->get($q['key']);
                $periods[] = ['period'=>$q['key'],'label'=>$q['label'],'due_date'=>$q['due']->format('d M Y'),
                    'record_id'=>$rec?->id,'no_bills'=>$rec?->no_bills ?? false,
                    'total_invoices'=>$rec?->invoices_count ?? 0,'matched'=>$rec?->matched_count ?? 0,'unmatched'=>$rec?->unmatched_count ?? 0,
                    'recon_status'=>$rec ? ($rec->invoices_count === $rec->matched_count && $rec->invoices_count > 0 ? 'matched' : 'pending') : 'pending'];
            }
        } else {
            for ($offset = 0; $offset < 12; $offset++) {
                $month = (($offset + 3) % 12) + 1;
                $year  = $month >= 4 ? $fyStart : $fyEnd;
                $key   = sprintf('%04d-%02d', $year, $month);
                $due   = \Carbon\Carbon::create($year, $month, 14)->addMonthNoOverflow();
                $label = \Carbon\Carbon::create($year, $month, 1)->format('M Y');
                $rec   = $records->get($key);
                $periods[] = ['period'=>$key,'label'=>$label,'due_date'=>$due->format('d M Y'),
                    'record_id'=>$rec?->id,'no_bills'=>$rec?->no_bills ?? false,
                    'total_invoices'=>$rec?->invoices_count ?? 0,'matched'=>$rec?->matched_count ?? 0,'unmatched'=>$rec?->unmatched_count ?? 0,
                    'recon_status'=>$rec ? ($rec->invoices_count === $rec->matched_count && $rec->invoices_count > 0 ? 'matched' : 'pending') : 'pending'];
            }
        }

        return response()->json(['client'=>['id'=>$client->id,'client_code'=>$client->client_code,
            'business_name'=>$client->business_name ?? $client->client_name,'gstin'=>$client->gstin,
            'dealer_type'=>$client->dealer_type,'filing_frequency'=>$freq,'is_active'=>$client->user?->is_active ?? true],
            'fy'=>$fy,'frequency'=>$freq,'periods'=>$periods]);
    }

    /** Period detail: ITC summary + adjustment + upload info */
    public function periodDetail(Request $request, int $clientId, string $period)
    {
        $client = ClientProfile::with('user:id,is_active')->findOrFail($clientId);
        $record = ClientGstr2bRecord::where('client_profile_id', $clientId)->where('tax_period', $period)
            ->withCount(['invoices','invoices as matched_count'=>fn($q)=>$q->where('match_status','matched'),
                'invoices as unmatched_count'=>fn($q)=>$q->notMatched()])
            ->with('uploader:id,name')->first();

        $adj = ClientGstr2bAdjustment::where('client_profile_id', $clientId)->where('tax_period', $period)->first();

        // Current ITC = eligible + matched invoices
        $currentItc = ClientGstr2bInvoice::where('client_profile_id', $clientId)->where('tax_period', $period)
            ->where('itc_eligibility', 'eligible')->where('match_status', 'matched')
            ->selectRaw('SUM(igst) as igst, SUM(cgst) as cgst, SUM(sgst) as sgst, SUM(total_gst) as total')
            ->first();

        // Previous Month Closing ITC is never typed in — it is rolled forward from every earlier period.
        $prev = $this->carriedForward($clientId, $period);

        $totalItc = [
            'igst' => round($prev['igst']+($adj->adj_igst??0)+($currentItc->igst??0), 2),
            'cgst' => round($prev['cgst']+($adj->adj_cgst??0)+($currentItc->cgst??0), 2),
            'sgst' => round($prev['sgst']+($adj->adj_sgst??0)+($currentItc->sgst??0), 2),
        ];
        $totalItc['total'] = $totalItc['igst'] + $totalItc['cgst'] + $totalItc['sgst'];

        // Summary cards: reconciliation position only (eligibility affects the ITC rows above, not these cards).
        $matchedItc = ClientGstr2bInvoice::where('client_profile_id', $clientId)->where('tax_period', $period)
            ->where('match_status','matched')
            ->sum('total_gst');
        $unmatchedItc = ClientGstr2bInvoice::where('client_profile_id', $clientId)->where('tax_period', $period)
            ->notMatched()
            ->sum('total_gst');
        $totalTaxable = ClientGstr2bInvoice::where('client_profile_id', $clientId)->where('tax_period', $period)
            ->sum('taxable_value');

        return response()->json([
            'client'=>['id'=>$client->id,'client_code'=>$client->client_code,'business_name'=>$client->business_name??$client->client_name,
                'gstin'=>$client->gstin,'filing_frequency'=>$client->gstr2b_filing_frequency??$client->gst_filing_frequency??'monthly','is_active'=>$client->user?->is_active??true],
            'period'=>$period,'record'=>$record?->toArray(),'adjustment'=>$adj,
            'itc'=>['prev'=>['igst'=>$prev['igst'],'cgst'=>$prev['cgst'],'sgst'=>$prev['sgst'],'total'=>round($prev['igst']+$prev['cgst']+$prev['sgst'],2)],
                'adjustment'=>['igst'=>(float)($adj->adj_igst??0),'cgst'=>(float)($adj->adj_cgst??0),'sgst'=>(float)($adj->adj_sgst??0),'total'=>round(($adj->adj_igst??0)+($adj->adj_cgst??0)+($adj->adj_sgst??0),2)],
                'current'=>['igst'=>(float)($currentItc->igst??0),'cgst'=>(float)($currentItc->cgst??0),'sgst'=>(float)($currentItc->sgst??0),'total'=>round(($currentItc->igst??0)+($currentItc->cgst??0)+($currentItc->sgst??0),2)],
                'total'=>$totalItc],
            'summary'=>['total_invoices'=>$record?->invoices_count??0,'total_taxable'=>round((float)$totalTaxable,2),'matched'=>$record?->matched_count??0,
                'unmatched'=>$record?->unmatched_count??0,'matched_itc'=>round((float)$matchedItc,2),'unmatched_itc'=>round((float)$unmatchedItc,2)],
        ]);
    }

    /** Save ITC adjustment for a period */
    public function saveAdjustment(Request $request, int $clientId, string $period)
    {
        ClientProfile::findOrFail($clientId);
        $data = $request->validate([
            // Previous Month Closing ITC is system-derived (see carriedForward) — not accepted here.
            'adj_igst'=>'nullable|numeric','adj_cgst'=>'nullable|numeric','adj_sgst'=>'nullable|numeric',
            'adjustment_reason'=>'nullable|string|max:255','remarks'=>'nullable|string|max:1000',
        ]);
        $rec = ClientGstr2bRecord::where('client_profile_id',$clientId)->where('tax_period',$period)->first();
        $adj = ClientGstr2bAdjustment::updateOrCreate(
            ['client_profile_id'=>$clientId,'tax_period'=>$period],
            [...$data,'financial_year'=>$this->deriveFinancialYear($period),'adjusted_by'=>$request->user()->id]
        );
        return response()->json($adj);
    }

    /** Paginated invoices with search + filter */
    public function invoiceList(Request $request, int $clientId, string $period)
    {
        $client = ClientProfile::with('user:id,is_active')->find($clientId);
        $record = ClientGstr2bRecord::where('client_profile_id',$clientId)->where('tax_period',$period)->first();
        if (!$record) {
            $emptyPagination = ['data'=>[],'total'=>0,'per_page'=>10,'current_page'=>1,'last_page'=>1,'from'=>0,'to'=>0];
            return response()->json([
                'client' => $client ? [
                    'id' => $client->id,
                    'client_code' => $client->client_code,
                    'business_name' => $client->business_name ?? $client->client_name,
                    'gstin' => $client->gstin,
                    'filing_frequency' => $client->gstr2b_filing_frequency ?? $client->gst_filing_frequency ?? 'monthly',
                ] : null,
                'invoices' => $emptyPagination,
                'summary' => ['total_invoices'=>0,'matched'=>0,'unmatched'=>0,'matched_itc'=>0,'unmatched_itc'=>0],
                ...$emptyPagination,
            ]);
        }

        $q = ClientGstr2bInvoice::where('gstr2b_record_id',$record->id);
        if ($request->filled('supplier_gstin')) $q->where('supplier_gstin','like','%'.$request->supplier_gstin.'%');
        if ($request->filled('supplier_name'))  $q->where('supplier_name','like','%'.$request->supplier_name.'%');
        if ($request->filled('invoice_number')) $q->where('invoice_number','like','%'.$request->invoice_number.'%');
        $fromDate = $request->input('from_date') ?? $request->input('date_from');
        $toDate = $request->input('to_date') ?? $request->input('date_to');
        if ($fromDate) $q->where('invoice_date','>=',$fromDate);
        if ($toDate)   $q->where('invoice_date','<=',$toDate);

        $invoices = $q->orderBy('id')->paginate(10);

        $matchedCount = ClientGstr2bInvoice::where('gstr2b_record_id',$record->id)->where('match_status','matched')->count();
        $unmatchedCount = ClientGstr2bInvoice::where('gstr2b_record_id',$record->id)->notMatched()->count();
        $matchedItc = ClientGstr2bInvoice::where('gstr2b_record_id',$record->id)->where('match_status','matched')->sum('total_gst');
        $unmatchedItc = ClientGstr2bInvoice::where('gstr2b_record_id',$record->id)->notMatched()->sum('total_gst');

        return response()->json([
            'client' => $client ? [
                'id' => $client->id,
                'client_code' => $client->client_code,
                'business_name' => $client->business_name ?? $client->client_name,
                'gstin' => $client->gstin,
                'filing_frequency' => $client->gstr2b_filing_frequency ?? $client->gst_filing_frequency ?? 'monthly',
            ] : null,
            'invoices' => $invoices,
            'summary' => [
                'total_invoices' => $record->invoices()->count(),
                'matched' => $matchedCount,
                'unmatched' => $unmatchedCount,
                'matched_itc' => round((float)$matchedItc, 2),
                'unmatched_itc' => round((float)$unmatchedItc, 2),
            ],
            ...$invoices->toArray(),
        ]);
    }

    /** Update match_status for one or many invoices */
    public function bulkUpdateStatus(Request $request, int $clientId)
    {
        $data = $request->validate([
            'ids'=>'required|array','ids.*'=>'integer',
            'match_status'=>['nullable','string',\Illuminate\Validation\Rule::in(ClientGstr2bInvoice::MATCH_STATUSES)],
            'itc_eligibility'=>['nullable','string',\Illuminate\Validation\Rule::in(ClientGstr2bInvoice::ITC_ELIGIBILITIES)],
        ]);
        $upd = [];
        if (isset($data['match_status']))    $upd['match_status']    = $data['match_status'];
        if (isset($data['itc_eligibility'])) $upd['itc_eligibility'] = $data['itc_eligibility'];
        if ($upd) ClientGstr2bInvoice::where('client_profile_id',$clientId)->whereIn('id',$data['ids'])->update($upd);
        return response()->json(['updated'=>count($data['ids'])]);
    }

    /**
     * [start, end] of a "YYYY-MM" month or "YYYY-Qn" FY quarter (Q1 = Apr–Jun … Q4 = Jan–Mar of year+1).
     *
     * @return array{0: \Carbon\Carbon, 1: \Carbon\Carbon}|null
     */
    private function periodBounds(string $period): ?array
    {
        if (preg_match('/^(\d{4})-(\d{2})$/', $period, $m)) {
            $start = \Carbon\Carbon::create((int) $m[1], (int) $m[2], 1)->startOfDay();

            return [$start, $start->copy()->endOfMonth()];
        }

        if (preg_match('/^(\d{4})-Q([1-4])$/', $period, $m)) {
            $year = (int) $m[1];
            $start = match ((int) $m[2]) {
                1 => \Carbon\Carbon::create($year, 4, 1),
                2 => \Carbon\Carbon::create($year, 7, 1),
                3 => \Carbon\Carbon::create($year, 10, 1),
                default => \Carbon\Carbon::create($year + 1, 1, 1),
            };
            $start = $start->startOfDay();

            return [$start, $start->copy()->addMonthsNoOverflow(2)->endOfMonth()];
        }

        return null;
    }

    /**
     * Previous Month Closing ITC for a period: the Total Available ITC rolled forward from
     * every earlier period — each earlier period's manual adjustment plus its eligible +
     * matched GSTR-2B ITC. It is derived on every read, so it follows invoice
     * reconciliation changes in earlier periods and can never be typed in by hand.
     *
     * @return array{igst: float, cgst: float, sgst: float}
     */
    private function carriedForward(int $clientId, string $period): array
    {
        $sum = ['igst' => 0.0, 'cgst' => 0.0, 'sgst' => 0.0];
        $current = $this->periodBounds($period);
        if (! $current) {
            return $sum;
        }
        $isEarlier = fn (string $p) => ($b = $this->periodBounds($p)) !== null && $b[1]->lt($current[0]);

        $itc = ClientGstr2bInvoice::where('client_profile_id', $clientId)
            ->where('itc_eligibility', 'eligible')
            ->where('match_status', 'matched')
            ->selectRaw('tax_period, SUM(igst) as igst, SUM(cgst) as cgst, SUM(sgst) as sgst')
            ->groupBy('tax_period')
            ->get();
        foreach ($itc as $r) {
            if ($isEarlier($r->tax_period)) {
                foreach (['igst', 'cgst', 'sgst'] as $h) {
                    $sum[$h] += (float) $r->$h;
                }
            }
        }

        foreach (ClientGstr2bAdjustment::where('client_profile_id', $clientId)->get() as $a) {
            if ($isEarlier($a->tax_period)) {
                foreach (['igst', 'cgst', 'sgst'] as $h) {
                    $sum[$h] += (float) $a->{"adj_$h"};
                }
            }
        }

        return array_map(fn ($v) => round($v, 2), $sum);
    }

    private function deriveFinancialYear(string $taxPeriod): string
    {
        // Quarter periods already encode the FY's start year directly (e.g. "2026-Q4" is
        // Jan-Mar 2027, still FY 2026-27) — same convention as GstFilingController.
        if (preg_match('/^(\d{4})-Q[1-4]$/', $taxPeriod, $m)) {
            $startYear = (int) $m[1];

            return $startYear.'-'.substr((string) ($startYear + 1), -2);
        }

        [$year, $month] = array_map('intval', explode('-', $taxPeriod));
        $startYear = $month >= 4 ? $year : $year - 1;

        return $startYear.'-'.substr((string) ($startYear + 1), -2);
    }

    public function destroyProjected(Request $request, int $clientId, string $period)
    {
        ClientProfile::findOrFail($clientId);

        $deleted = ClientGstr2bProjectedInvoice::where('client_profile_id', $clientId)
            ->where('tax_period', $period)
            ->delete();

        return response()->json([
            'deleted' => $deleted,
            'message' => "Deleted {$deleted} projected invoice(s) for period {$period}.",
        ]);
    }
}
