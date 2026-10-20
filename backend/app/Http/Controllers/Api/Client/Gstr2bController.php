<?php

namespace App\Http\Controllers\Api\Client;

use App\Support\ExcelExport;

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

    /**
     * 'available' once the admin has loaded the official GSTR-2B; otherwise 'open' from the FIRST DAY of the tax
     * period (the month, or the quarter for quarterly filers). The official statement only appears around the 14th
     * of the following month, but from day one the client can already enter Projected ITC. 'upcoming' before that.
     * Earlier periods stay accessible.
     */
    private static function periodStatus(bool $hasOfficialData, Carbon $periodStart): string
    {
        if ($hasOfficialData) {
            return 'available';
        }

        return $periodStart->copy()->startOfDay()->lte(Carbon::now()->startOfDay()) ? 'open' : 'upcoming';
    }

    /** Financial year label ("2026-27") a tax-period key belongs to: "2026-08", "2027-02" or a quarter key "2026-Q3". */
    private static function fyForPeriod(string $period): string
    {
        if (preg_match('/^(\d{4})-Q[1-4]$/', $period, $m) === 1) {
            $start = (int) $m[1];
        } else {
            $parsed = Carbon::createFromFormat('Y-m', substr($period, 0, 7));
            $year = $parsed ? (int) $parsed->format('Y') : (int) date('Y');
            $month = $parsed ? (int) $parsed->format('m') : (int) date('m');
            $start = $month >= 4 ? $year : $year - 1;
        }

        return $start.'-'.substr((string) ($start + 1), -2);
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
                ['key' => "{$fyStart}-Q1", 'label' => "Q1 Apr–Jun {$fyStart}",  'available_by' => Carbon::create($fyStart, 7, 14), 'starts' => Carbon::create($fyStart, 4, 1)],
                ['key' => "{$fyStart}-Q2", 'label' => "Q2 Jul–Sep {$fyStart}",  'available_by' => Carbon::create($fyStart, 10, 14), 'starts' => Carbon::create($fyStart, 7, 1)],
                ['key' => "{$fyStart}-Q3", 'label' => "Q3 Oct–Dec {$fyStart}",  'available_by' => Carbon::create($fyEnd, 1, 14), 'starts' => Carbon::create($fyStart, 10, 1)],
                ['key' => "{$fyStart}-Q4", 'label' => "Q4 Jan–Mar {$fyEnd}",    'available_by' => Carbon::create($fyEnd, 4, 14), 'starts' => Carbon::create($fyEnd, 1, 1)],
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
                    'expected_on'  => $q['available_by']->format('d M Y'),
                    'status'       => self::periodStatus($rec !== null, $q['starts']),
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
                    'expected_on'  => Carbon::create($year, $month, 1)->addMonthNoOverflow()->day(14)->format('d M Y'),
                    'status'       => self::periodStatus($rec !== null, Carbon::create($year, $month, 1)),
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
                'registration_type' => $profile->registration_type ?: ($profile->dealer_type === 'composition' ? 'Composition' : 'Regular'),
            ],
            'last_gstr2b' => $lastRecord ? [
                'period'       => $lastRecord->tax_period,
                'label'        => collect($periods)->firstWhere('period', $lastRecord->tax_period)['label'] ?? $lastRecord->tax_period,
                'available_on' => $lastRecord->created_at->format('d M Y'),
                'total_itc'    => (float) ClientGstr2bInvoice::where('client_profile_id', $profileId)->where('tax_period', $lastRecord->tax_period)->sum('total_gst'),
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

        // The summary cards describe the whole tax period, whatever the table is filtered to.
        $periodBase = clone $base;

        if ($ms = $request->input('match_status')) {
            // "Unmatched" means anything not (yet) matched, which is how the summary counts it too.
            $ms === 'unmatched' ? $base->where('match_status', '<>', 'matched') : $base->where('match_status', $ms);
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

        $summaryRow = (clone $periodBase)->selectRaw(
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

    private const PROJECTED_RULES = [
        'invoice_date'   => 'required|date',
        'invoice_number' => 'required|string|max:50',
        'party_name'     => 'required|string|max:200',
        'gstin'          => ['required', 'string', 'regex:/^[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][1-9A-Za-z][Zz][0-9A-Za-z]$/'],
        'taxable_value'  => 'required|numeric|min:0',
        'igst'           => 'nullable|numeric|min:0',
        'cgst'           => 'nullable|numeric|min:0',
        'sgst_utgst'     => 'nullable|numeric|min:0',
        'itc_amount'     => 'nullable|numeric|min:0',
    ];

    private const PROJECTED_MESSAGES = [
        'gstin.regex' => 'Enter a valid 15-character GSTIN (e.g. 27ABCDE1234F1Z5).',
    ];

    private const TEMPLATE_HEADINGS = ['Invoice Date', 'Invoice No.', 'Party Name', 'GSTIN', 'Taxable Value', 'IGST', 'CGST', 'SGST/UTGST', 'ITC Amount'];

    /** Uppercase GSTIN; ITC amount defaults to IGST + CGST + SGST. */
    private function normaliseProjected(array $d): array
    {
        $d['gstin'] = strtoupper(trim((string) ($d['gstin'] ?? '')));
        foreach (['igst', 'cgst', 'sgst_utgst'] as $k) {
            $d[$k] = isset($d[$k]) && $d[$k] !== '' ? (float) $d[$k] : 0.0;
        }
        if (! isset($d['itc_amount']) || $d['itc_amount'] === '' || $d['itc_amount'] === null) {
            $d['itc_amount'] = round($d['igst'] + $d['cgst'] + $d['sgst_utgst'], 2);
        }

        return $d;
    }

    /** The predefined Excel template the client fills in and uploads. */
    public function projectedTemplate(Request $request, string $period)
    {
        $this->profileId($request);

        $sheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
        $ws = $sheet->getActiveSheet();
        $ws->setTitle('Projected ITC');
        $ws->fromArray(self::TEMPLATE_HEADINGS, null, 'A1');
        $ws->fromArray([['2026-08-15', 'INV-001', 'ABC Traders Pvt Ltd', '27ABCDE1234F1Z5', 10000, 0, 900, 900, 1800]], null, 'A2');
        $ws->getStyle('A1:I1')->getFont()->setBold(true);
        $ws->getStyle('A1:I1')->getFill()->setFillType('solid')->getStartColor()->setRGB('E8F0FE');
        foreach (range('A', 'I') as $col) {
            $ws->getColumnDimension($col)->setWidth(20);
        }
        $ws->setCellValue('A4', 'Notes: Invoice Date, Invoice No., Party Name, GSTIN and Taxable Value are required. Fill either IGST or CGST + SGST/UTGST. ITC Amount is optional (defaults to IGST + CGST + SGST). Delete this sample row and these notes before uploading.');

        $tmp = tempnam(sys_get_temp_dir(), 'pitc');
        (new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($sheet))->save($tmp);

        return response()->download($tmp, 'gstr2b_projected_itc_template.xlsx', [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend(true);
    }

    /** Validates the whole uploaded sheet first; nothing is imported unless every row is valid. */
    public function projectedImport(Request $request, string $period)
    {
        $profileId = $this->profileId($request);
        $request->validate(['file' => 'required|file|mimes:xlsx,xls,csv|max:5120'], [
            'file.mimes' => 'Please upload the Excel template (.xlsx, .xls or .csv).',
        ]);

        try {
            $book = \PhpOffice\PhpSpreadsheet\IOFactory::load($request->file('file')->getRealPath());
            $raw = $book->getActiveSheet()->toArray(null, true, false, false);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'The file could not be read. Please upload the Excel template without changing its columns.'], 422);
        }

        $norm = fn ($v) => strtolower(preg_replace('/[^a-z0-9]/i', '', (string) $v));
        $head = array_map($norm, $raw[0] ?? []);
        $required = array_slice(self::TEMPLATE_HEADINGS, 0, 5);
        $missing = array_values(array_filter($required, fn ($h) => ! in_array($norm($h), $head, true)));
        if ($missing) {
            return response()->json(['message' => 'The file does not match the template. Missing column(s): '.implode(', ', $missing).'.'], 422);
        }
        $idx = array_flip($head);
        $cell = fn (array $row, string $name) => isset($idx[$norm($name)]) ? ($row[$idx[$norm($name)]] ?? null) : null;

        $fy = $request->input('financial_year') ?: self::fyForPeriod($period);

        $rows = [];
        $errors = [];
        foreach (array_slice($raw, 1) as $i => $row) {
            $line = $i + 2;
            $row = array_values($row);
            if (! array_filter($row, fn ($v) => $v !== null && trim((string) $v) !== '')) {
                continue;
            }
            if (stripos(trim((string) ($row[0] ?? '')), 'notes:') === 0) {
                continue;
            }

            $dateRaw = $cell($row, 'Invoice Date');
            try {
                $date = is_numeric($dateRaw)
                    ? \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject((float) $dateRaw)->format('Y-m-d')
                    : Carbon::createFromFormat(str_contains((string) $dateRaw, '/') ? 'd/m/Y' : 'Y-m-d', trim((string) $dateRaw))->format('Y-m-d');
            } catch (\Throwable $e) {
                $date = null;
            }

            $candidate = [
                'invoice_date'   => $date,
                'invoice_number' => trim((string) $cell($row, 'Invoice No.')),
                'party_name'     => trim((string) $cell($row, 'Party Name')),
                'gstin'          => strtoupper(trim((string) $cell($row, 'GSTIN'))),
                'taxable_value'  => $cell($row, 'Taxable Value'),
                'igst'           => $cell($row, 'IGST'),
                'cgst'           => $cell($row, 'CGST'),
                'sgst_utgst'     => $cell($row, 'SGST/UTGST'),
                'itc_amount'     => $cell($row, 'ITC Amount'),
            ];
            foreach (['taxable_value', 'igst', 'cgst', 'sgst_utgst', 'itc_amount'] as $k) {
                if ($candidate[$k] === '' || $candidate[$k] === null) {
                    $candidate[$k] = null;
                } elseif (is_string($candidate[$k])) {
                    $candidate[$k] = str_replace(',', '', trim($candidate[$k]));
                }
            }

            $v = \Illuminate\Support\Facades\Validator::make($candidate, self::PROJECTED_RULES, self::PROJECTED_MESSAGES);
            if ($v->fails()) {
                foreach ($v->errors()->all() as $m) {
                    $errors[] = "Row {$line}: {$m}";
                }
                continue;
            }
            $clean = $this->normaliseProjected($v->validated());
            if ($clean['igst'] > 0 && ($clean['cgst'] > 0 || $clean['sgst_utgst'] > 0)) {
                $errors[] = "Row {$line}: Enter either IGST or CGST + SGST/UTGST, not both.";
                continue;
            }
            $rows[] = $clean;
        }

        if ($errors) {
            return response()->json(['message' => 'The file has errors. Nothing was imported - please correct these rows and upload again.', 'errors' => array_slice($errors, 0, 30)], 422);
        }
        if (! $rows) {
            return response()->json(['message' => 'The file has no invoice rows to import.'], 422);
        }

        \Illuminate\Support\Facades\DB::transaction(function () use ($rows, $profileId, $fy, $period) {
            foreach ($rows as $r) {
                ClientGstr2bProjectedInvoice::create(['client_profile_id' => $profileId, 'financial_year' => $fy, 'tax_period' => $period, ...$r]);
            }
        });

        return response()->json(['message' => count($rows).' invoice(s) imported successfully.', 'imported' => count($rows)], 201);
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

        $fy = $request->input('financial_year') ?: self::fyForPeriod($period);

        $data = $request->validate(self::PROJECTED_RULES, self::PROJECTED_MESSAGES);
        $data = $this->normaliseProjected($data);

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

        $data = $request->validate(self::PROJECTED_RULES, self::PROJECTED_MESSAGES);
        $data = $this->normaliseProjected($data);

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
        $esc = fn ($v) => htmlspecialchars((string) $v, ENT_QUOTES | ENT_XML1);
        $xml = '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>';
        $xml .= ExcelExport::root();
        $xml .= ExcelExport::styles();
        $xml .= '<Worksheet ss:Name="GSTR-2B"><Table>'.ExcelExport::cols($headers, $rows);
        $xml .= '<Row>';
        foreach ($headers as $h) {
            $xml .= '<Cell ss:StyleID="colHead"><Data ss:Type="String">'.$esc($h).'</Data></Cell>';
        }
        $xml .= '</Row>';
        foreach ($rows as $row) {
            $xml .= '<Row>';
            foreach ($headers as $ci => $h) {
                $v = $row[$h] ?? '';
                $typeAttr = is_numeric($v) ? 'Number' : 'String';
                $xml .= '<Cell ss:StyleID="'.($ci === 0 ? 'cellLabel' : 'cell').'"><Data ss:Type="'.$typeAttr.'">'.$esc(is_scalar($v) ? $v : json_encode($v)).'</Data></Cell>';
            }
            $xml .= '</Row>';
        }
        $xml .= '<Row></Row><Row><Cell ss:StyleID="footer"><Data ss:Type="String">'.$esc('Report Generated On: '.now()->format('d-m-Y')).'</Data></Cell></Row>';
        $xml .= ExcelExport::end();

        return response($xml, 200, [
            'Content-Type' => 'application/vnd.ms-excel',
            'Content-Disposition' => 'attachment; filename="gstr2b.xls"',
        ]);
    }
}
