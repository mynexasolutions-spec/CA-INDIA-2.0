<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Models\ClientGstr2bInvoice;
use App\Models\ClientGstr2bProjectedInvoice;
use App\Models\ClientGstr2bRecord;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class Gstr2bController extends Controller
{
    private const SORTABLE = [
        'supplier_gstin', 'supplier_name', 'invoice_number', 'invoice_date',
        'taxable_value', 'cgst', 'sgst', 'igst', 'total_gst', 'match_status',
    ];

    private function profileId(Request $request): int
    {
        abort_unless($request->user()->clientProfile, 403);

        return $request->user()->clientProfile->id;
    }

    private function filtered(Request $request): Builder
    {
        $q = ClientGstr2bInvoice::where('client_profile_id', $this->profileId($request));

        if ($fy = $request->input('financial_year')) {
            $q->where('financial_year', $fy);
        }
        if ($period = $request->input('tax_period')) {
            $q->where('tax_period', $period);
        }
        if ($gstin = $request->input('supplier_gstin')) {
            $q->where('supplier_gstin', 'like', "%{$gstin}%");
        }
        if ($name = $request->input('supplier_name')) {
            $q->where('supplier_name', 'like', "%{$name}%");
        }
        if ($invoiceNumber = $request->input('invoice_number')) {
            $q->where('invoice_number', 'like', "%{$invoiceNumber}%");
        }
        if ($matchStatus = $request->input('match_status')) {
            abort_unless(
                in_array($matchStatus, ClientGstr2bInvoice::MATCH_STATUSES, true),
                422,
                'Invalid match status.'
            );
            $q->where('match_status', $matchStatus);
        }
        if ($search = $request->input('q')) {
            $q->where(function ($w) use ($search) {
                $w->where('supplier_name', 'like', "%{$search}%")
                    ->orWhere('supplier_gstin', 'like', "%{$search}%")
                    ->orWhere('invoice_number', 'like', "%{$search}%");
            });
        }

        return $q;
    }

    private function sorted(Builder $query, Request $request): Builder
    {
        $sort = in_array($request->input('sort'), self::SORTABLE, true)
            ? $request->input('sort')
            : 'invoice_date';
        $dir = $request->input('dir') === 'asc' ? 'asc' : 'desc';

        return $query->orderBy($sort, $dir);
    }

    /** @return array<string, int|float> */
    private function summary(Builder $query): array
    {
        $summary = (clone $query)
            ->selectRaw(
                'COUNT(*) AS total_invoices,
                SUM(CASE WHEN match_status = ? THEN 1 ELSE 0 END) AS matched_invoices,
                SUM(CASE WHEN match_status <> ? THEN 1 ELSE 0 END) AS unmatched_invoices,
                COALESCE(SUM(CASE WHEN match_status = ? THEN total_gst ELSE 0 END), 0) AS matched_itc_amount,
                COALESCE(SUM(CASE WHEN match_status <> ? THEN total_gst ELSE 0 END), 0) AS unmatched_itc_amount',
                [
                    ClientGstr2bInvoice::MATCH_STATUS_MATCHED,
                    ClientGstr2bInvoice::MATCH_STATUS_MATCHED,
                    ClientGstr2bInvoice::MATCH_STATUS_MATCHED,
                    ClientGstr2bInvoice::MATCH_STATUS_MATCHED,
                ]
            )
            ->first();

        return [
            'total_invoices' => (int) ($summary?->total_invoices ?? 0),
            'matched_invoices' => (int) ($summary?->matched_invoices ?? 0),
            'unmatched_invoices' => (int) ($summary?->unmatched_invoices ?? 0),
            'matched_itc_amount' => (float) ($summary?->matched_itc_amount ?? 0),
            'unmatched_itc_amount' => (float) ($summary?->unmatched_itc_amount ?? 0),
        ];
    }

    public function periods(Request $request)
    {
        $profile   = $request->user()->clientProfile;
        abort_unless($profile, 403);
        $profileId = $profile->id;

        $now       = Carbon::now();
        $fyStart   = $now->month >= 4 ? $now->year : $now->year - 1;
        $fyEnd     = $fyStart + 1;
        $fy        = $fyStart . '-' . substr($fyEnd, -2);

        if ($fyParam = $request->input('financial_year')) {
            if (preg_match('/^(\d{4})-/', $fyParam, $m)) {
                $fyStart = (int) $m[1];
                $fyEnd   = $fyStart + 1;
                $fy      = $fyParam;
            }
        }

        $freq = $profile->gstr2b_filing_frequency ?? $profile->gst_filing_frequency ?? 'monthly';

        $records = ClientGstr2bRecord::where('client_profile_id', $profileId)
            ->where('financial_year', $fy)
            ->get()->keyBy('tax_period');

        $periods = [];
        if ($freq === 'quarterly') {
            $quarters = [
                ['key' => "{$fyStart}-Q1", 'label' => "Q1 Apr–Jun {$fyStart}",  'available_by' => Carbon::create($fyStart, 8, 14)],
                ['key' => "{$fyStart}-Q2", 'label' => "Q2 Jul–Sep {$fyStart}",  'available_by' => Carbon::create($fyStart, 11, 14)],
                ['key' => "{$fyStart}-Q3", 'label' => "Q3 Oct–Dec {$fyStart}",  'available_by' => Carbon::create($fyEnd, 2, 14)],
                ['key' => "{$fyStart}-Q4", 'label' => "Q4 Jan–Mar {$fyEnd}",    'available_by' => Carbon::create($fyEnd, 5, 14)],
            ];
            foreach ($quarters as $q) {
                $rec       = $records->get($q['key']);
                $totalItc  = $rec
                    ? (float) ClientGstr2bInvoice::where('client_profile_id', $profileId)->where('tax_period', $q['key'])->sum('total_gst')
                    : 0;
                $periods[] = [
                    'period'       => $q['key'],
                    'label'        => $q['label'],
                    'available_on' => $rec?->created_at?->format('d M Y'),
                    'status'       => $rec ? 'available' : ($now->gt($q['available_by']) ? 'upcoming' : 'upcoming'),
                    'total_itc'    => $totalItc,
                    'no_bills'     => $rec?->no_bills ?? false,
                ];
            }
        } else {
            for ($offset = 0; $offset < 12; $offset++) {
                $month = (($offset + 3) % 12) + 1;
                $year  = $month >= 4 ? $fyStart : $fyEnd;
                $key   = sprintf('%04d-%02d', $year, $month);
                $rec   = $records->get($key);
                $totalItc = $rec
                    ? (float) ClientGstr2bInvoice::where('client_profile_id', $profileId)->where('tax_period', $key)->sum('total_gst')
                    : 0;
                $periods[] = [
                    'period'       => $key,
                    'label'        => Carbon::create($year, $month, 1)->format('M Y'),
                    'available_on' => $rec?->created_at?->format('d M Y'),
                    'status'       => $rec ? 'available' : 'upcoming',
                    'total_itc'    => $totalItc,
                    'no_bills'     => $rec?->no_bills ?? false,
                ];
            }
        }

        $lastRecord = ClientGstr2bRecord::where('client_profile_id', $profileId)
            ->orderByDesc('created_at')->first();

        return response()->json([
            'financial_year' => $fy,
            'profile' => [
                'business_name'    => $profile->business_name,
                'gstin'            => $profile->gstin,
                'filing_frequency' => $freq,
            ],
            'last_gstr2b' => $lastRecord ? [
                'period'       => $lastRecord->tax_period,
                'available_on' => $lastRecord->created_at->format('d M Y'),
            ] : null,
            'periods' => $periods,
        ]);
    }

    public function periodInvoices(Request $request, string $period)
    {
        $profileId = $this->profileId($request);
        $perPage   = min((int) $request->input('per_page', 25), 100);

        $base = ClientGstr2bInvoice::where('client_profile_id', $profileId)
            ->where('tax_period', $period);

        if ($ms = $request->input('match_status')) {
            $base->where('match_status', $ms);
        }
        if ($q = $request->input('q')) {
            $base->where(fn($w) => $w
                ->where('supplier_name', 'like', "%{$q}%")
                ->orWhere('supplier_gstin', 'like', "%{$q}%")
                ->orWhere('invoice_number', 'like', "%{$q}%"));
        }

        $sort = in_array($request->input('sort'), self::SORTABLE, true) ? $request->input('sort') : 'invoice_date';
        $dir  = $request->input('dir') === 'asc' ? 'asc' : 'desc';
        $data = (clone $base)->orderBy($sort, $dir)->paginate($perPage)->toArray();

        $summaryRow = (clone $base)->selectRaw(
            'COUNT(*) AS total,
             SUM(CASE WHEN match_status = "matched" THEN 1 ELSE 0 END) AS matched,
             SUM(CASE WHEN match_status <> "matched" THEN 1 ELSE 0 END) AS unmatched,
             COALESCE(SUM(CASE WHEN match_status = "matched" THEN total_gst ELSE 0 END),0) AS matched_itc,
             COALESCE(SUM(CASE WHEN match_status <> "matched" THEN total_gst ELSE 0 END),0) AS unmatched_itc,
             COALESCE(SUM(total_gst),0) AS total_itc'
        )->first();

        $data['summary'] = [
            'total_invoices'     => (int) ($summaryRow->total ?? 0),
            'matched_invoices'   => (int) ($summaryRow->matched ?? 0),
            'unmatched_invoices' => (int) ($summaryRow->unmatched ?? 0),
            'matched_itc'        => (float) ($summaryRow->matched_itc ?? 0),
            'unmatched_itc'      => (float) ($summaryRow->unmatched_itc ?? 0),
            'total_itc'          => (float) ($summaryRow->total_itc ?? 0),
        ];

        return response()->json($data);
    }

    public function projectedIndex(Request $request, string $period)
    {
        $profileId = $this->profileId($request);
        $rows = ClientGstr2bProjectedInvoice::where('client_profile_id', $profileId)
            ->where('tax_period', $period)
            ->orderBy('invoice_date')
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function projectedStore(Request $request, string $period)
    {
        $profileId = $this->profileId($request);
        $profile   = $request->user()->clientProfile;

        $fy = $request->input('financial_year');
        if (!$fy) {
            $parsed = Carbon::createFromFormat('Y-m', substr($period, 0, 7));
            $year   = $parsed ? (int) $parsed->format('Y') : (int) date('Y');
            $month  = $parsed ? (int) $parsed->format('m') : (int) date('m');
            $fyStart = $month >= 4 ? $year : $year - 1;
            $fy      = $fyStart . '-' . substr($fyStart + 1, -2);
        }

        $data = $request->validate([
            'invoice_date'   => 'nullable|date',
            'invoice_number' => 'nullable|string|max:50',
            'party_name'     => 'nullable|string|max:200',
            'gstin'          => 'nullable|string|max:20',
            'taxable_value'  => 'nullable|numeric|min:0',
            'igst'           => 'nullable|numeric|min:0',
            'cgst'           => 'nullable|numeric|min:0',
            'sgst_utgst'     => 'nullable|numeric|min:0',
            'itc_amount'     => 'nullable|numeric|min:0',
        ]);

        $inv = ClientGstr2bProjectedInvoice::create([
            'client_profile_id' => $profileId,
            'financial_year'    => $fy,
            'tax_period'        => $period,
            ...$data,
        ]);

        return response()->json($inv, 201);
    }

    public function projectedUpdate(Request $request, string $period, int $id)
    {
        $profileId = $this->profileId($request);
        $inv = ClientGstr2bProjectedInvoice::where('client_profile_id', $profileId)
            ->where('tax_period', $period)->findOrFail($id);

        $data = $request->validate([
            'invoice_date'   => 'nullable|date',
            'invoice_number' => 'nullable|string|max:50',
            'party_name'     => 'nullable|string|max:200',
            'gstin'          => 'nullable|string|max:20',
            'taxable_value'  => 'nullable|numeric|min:0',
            'igst'           => 'nullable|numeric|min:0',
            'cgst'           => 'nullable|numeric|min:0',
            'sgst_utgst'     => 'nullable|numeric|min:0',
            'itc_amount'     => 'nullable|numeric|min:0',
        ]);

        $inv->update($data);
        return response()->json($inv->fresh());
    }

    public function projectedDestroy(Request $request, string $period, int $id)
    {
        $profileId = $this->profileId($request);
        $inv = ClientGstr2bProjectedInvoice::where('client_profile_id', $profileId)
            ->where('tax_period', $period)->findOrFail($id);
        $inv->delete();
        return response()->json(null, 204);
    }

    public function projectedExtract(Request $request, string $period)
    {
        $this->profileId($request); // auth check

        $request->validate(['file' => 'required|file|mimes:jpg,jpeg,png,webp,pdf|max:10240']);

        $file     = $request->file('file');
        $mime     = $file->getMimeType();
        $base64   = base64_encode(file_get_contents($file->getRealPath()));

        $apiKey = config('services.anthropic.api_key');
        abort_unless($apiKey, 503, 'AI extraction is not configured on this server.');

        $isImage = str_starts_with($mime, 'image/');
        $mediaType = $isImage ? ($mime === 'image/jpg' ? 'image/jpeg' : $mime) : 'application/pdf';

        $systemPrompt = 'You are an invoice data extraction assistant. Extract structured invoice data from the provided invoice image or PDF and return ONLY a valid JSON object with these keys: invoice_date (YYYY-MM-DD), invoice_number, party_name, gstin, taxable_value (number), igst (number), cgst (number), sgst_utgst (number). Use null for missing fields. Do not include any explanation outside the JSON.';

        $content = $isImage
            ? [['type' => 'image', 'source' => ['type' => 'base64', 'media_type' => $mediaType, 'data' => $base64]], ['type' => 'text', 'text' => 'Extract the invoice data from this image and return JSON.']]
            : [['type' => 'document', 'source' => ['type' => 'base64', 'media_type' => 'application/pdf', 'data' => $base64]], ['type' => 'text', 'text' => 'Extract the invoice data from this PDF and return JSON.']];

        $response = Http::withHeaders([
            'x-api-key'         => $apiKey,
            'anthropic-version' => '2023-06-01',
        ])->post('https://api.anthropic.com/v1/messages', [
            'model'      => 'claude-opus-4-5',
            'max_tokens' => 512,
            'system'     => $systemPrompt,
            'messages'   => [['role' => 'user', 'content' => $content]],
        ]);

        abort_if($response->failed(), 502, 'AI extraction service returned an error.');

        $text = $response->json('content.0.text', '');
        // Strip any markdown code fences if present
        $text = preg_replace('/^```[a-z]*\n?/', '', trim($text));
        $text = preg_replace('/\n?```$/', '', $text);

        $extracted = json_decode($text, true);
        abort_if(!is_array($extracted), 422, 'Could not parse extracted invoice data.');

        return response()->json([
            'invoice_date'   => $extracted['invoice_date']   ?? null,
            'invoice_number' => $extracted['invoice_number'] ?? null,
            'party_name'     => $extracted['party_name']     ?? null,
            'gstin'          => $extracted['gstin']          ?? null,
            'taxable_value'  => is_numeric($extracted['taxable_value'] ?? null) ? (float) $extracted['taxable_value'] : null,
            'igst'           => is_numeric($extracted['igst']          ?? null) ? (float) $extracted['igst']          : null,
            'cgst'           => is_numeric($extracted['cgst']          ?? null) ? (float) $extracted['cgst']          : null,
            'sgst_utgst'     => is_numeric($extracted['sgst_utgst']    ?? null) ? (float) $extracted['sgst_utgst']    : null,
        ]);
    }

    public function index(Request $request)
    {
        $perPage = min((int) $request->input('per_page', 25), 100);
        $query = $this->filtered($request);
        $payload = $this->sorted(clone $query, $request)->paginate($perPage)->toArray();
        $payload['summary'] = $this->summary($query);

        return response()->json($payload);
    }

    public function updateMatchStatus(Request $request, int $invoiceId)
    {
        $data = $request->validate([
            'match_status' => [
                'required',
                'string',
                Rule::in(ClientGstr2bInvoice::MATCH_STATUSES),
            ],
        ]);

        $invoice = ClientGstr2bInvoice::where('client_profile_id', $this->profileId($request))
            ->findOrFail($invoiceId);

        $invoice->update(['match_status' => $data['match_status']]);

        return response()->json($invoice->fresh());
    }

    /**
     * Client reconciliation in bulk (select invoices -> Apply). Reconciliation is the only
     * thing a client may change — ITC Eligibility stays Admin-only and is not accepted here.
     */
    public function bulkMatchStatus(Request $request)
    {
        $data = $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'integer',
            'match_status' => ['required', 'string', Rule::in([
                ClientGstr2bInvoice::MATCH_STATUS_MATCHED,
                ClientGstr2bInvoice::MATCH_STATUS_UNMATCHED,
            ])],
        ]);

        $updated = ClientGstr2bInvoice::where('client_profile_id', $this->profileId($request))
            ->whereIn('id', $data['ids'])
            ->update(['match_status' => $data['match_status']]);

        return response()->json(['updated' => $updated]);
    }

    public function export(Request $request)
    {
        $format = $request->input('format', 'csv');

        $rows = $this->sorted($this->filtered($request), $request)->get()->map(fn ($r) => [
            'Supplier GSTIN' => $r->supplier_gstin,
            'Supplier Name' => $r->supplier_name,
            'Invoice Number' => $r->invoice_number,
            'Invoice Date' => optional($r->invoice_date)->format('d-m-Y'),
            'Taxable Value' => (float) $r->taxable_value,
            'CGST' => (float) $r->cgst,
            'SGST' => (float) $r->sgst,
            'IGST' => (float) $r->igst,
            'Total GST' => (float) $r->total_gst,
            'ITC Eligibility' => $r->itc_eligibility ? ucfirst($r->itc_eligibility) : '—',
            'Match Status' => ucfirst($r->match_status),
        ])->all();

        if ($format === 'pdf') {
            $pdf = Pdf::loadView('pdf.report', [
                'title' => 'GSTR-2B',
                'from' => $request->input('financial_year', ''),
                'to' => $request->input('tax_period', ''),
                'rows' => $rows,
            ]);

            return $pdf->download('gstr2b.pdf');
        }

        if ($format === 'xlsx') {
            return $this->xlsxDownload($rows);
        }

        return $this->csvDownload($rows);
    }

    private function csvDownload(array $rows): StreamedResponse
    {
        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            $first = $rows[0] ?? [];
            if ($first) {
                fputcsv($out, array_keys($first));
            }
            foreach ($rows as $row) {
                fputcsv($out, array_map(fn ($v) => is_scalar($v) || $v === null ? $v : json_encode($v), $row));
            }
            fclose($out);
        }, 'gstr2b.csv', ['Content-Type' => 'text/csv']);
    }

    private function xlsxDownload(array $rows)
    {
        $headers = array_keys($rows[0] ?? ['value' => '']);
        $xml = '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>';
        $xml .= '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="GSTR-2B"><Table>';
        $xml .= '<Row>';
        foreach ($headers as $h) {
            $xml .= '<Cell><Data ss:Type="String">'.htmlspecialchars((string) $h).'</Data></Cell>';
        }
        $xml .= '</Row>';
        foreach ($rows as $row) {
            $xml .= '<Row>';
            foreach ($headers as $h) {
                $v = $row[$h] ?? '';
                $typeAttr = is_numeric($v) ? 'Number' : 'String';
                $xml .= '<Cell><Data ss:Type="'.$typeAttr.'">'.htmlspecialchars((string) $v).'</Data></Cell>';
            }
            $xml .= '</Row>';
        }
        $xml .= '</Table></Worksheet></Workbook>';

        return response($xml, 200, [
            'Content-Type' => 'application/vnd.ms-excel',
            'Content-Disposition' => 'attachment; filename="gstr2b.xls"',
        ]);
    }
}
