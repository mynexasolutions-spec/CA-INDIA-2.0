<?php

namespace App\Http\Controllers\Api\Billing;

use App\Http\Controllers\Api\Billing\Concerns\ResolvesBillingProfile;
use App\Http\Controllers\Controller;
use App\Models\ClientProfile;
use App\Models\CommercialDocument;
use App\Services\Billing\BillingPolicy;
use App\Services\Gst\GstLiabilityService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    use ResolvesBillingProfile;

    // Mark Paid/Unpaid is a payment-status change only — it must never remove a document
    // from GST Summary, HSN/SAC Summary, Party-wise Details, or Sales reports. All three
    // "issued family" statuses count as live, finalized documents; only draft/cancelled
    // are excluded. Matches GstLiabilityService::calculate()'s status filter.
    private const ISSUED_STATUSES = ['issued', 'partial', 'paid'];

    public function __construct(private readonly GstLiabilityService $liabilityService) {}

    private function profileId(Request $request): int
    {
        return $this->resolveBillingProfile($request)->id;
    }

    private function dateRange(Request $request): array
    {
        // Billing launched at FY 2026-27 — no report may reach earlier than that,
        // even an intentionally "open-ended" one like Outstanding/Pending Dues.
        $openEnded = in_array($request->input('type'), ['outstanding_report', 'outstanding', 'pending_dues', 'paid_invoices'], true)
            && ! $request->filled('from') && ! $request->filled('to');

        if ($openEnded) {
            return [BillingPolicy::MIN_BILLING_FY_START_DATE, '2999-12-31'];
        }

        $now = now();
        $y1 = max($now->month >= 4 ? $now->year : $now->year - 1, BillingPolicy::MIN_BILLING_FY_START_YEAR);
        $fyFrom = "{$y1}-04-01";
        $fyTo = ($y1 + 1).'-03-31';

        return [
            BillingPolicy::clampFromDate($request->input('from', $fyFrom)),
            $request->input('to', $fyTo),
        ];
    }

    public function index(Request $request)
    {
        $type = $request->input('type', 'gst_summary');
        $pid = $this->profileId($request);
        $period = array_combine(['from', 'to'], $this->dateRange($request));
        $data = $this->build($type, $pid, $period['from'], $period['to']);

        return response()->json([
            'type' => $type,
            ...$period,
            'data' => $data,
            'available' => $this->availableTypes(),
        ]);
    }

    public function export(Request $request)
    {
        $format = $request->input('format', 'csv');
        $type = $request->input('type', 'gst_summary');
        $pid = $this->profileId($request);
        $period = array_combine(['from', 'to'], $this->dateRange($request));
        $data = $this->build($type, $pid, $period['from'], $period['to']);
        $rows = $this->flattenRows($data);

        $profile = ClientProfile::find($pid);
        $meta = $this->businessHeaderData($profile);
        $periodText = $period['period_label'] ?? ($this->fmtReportDate($period['from']).' to '.$this->fmtReportDate($period['to']));
        $moneyHeaders = $this->computeMoneyHeaders($rows);

        if ($format === 'pdf') {
            $pdf = Pdf::loadView('pdf.report', [
                'title'        => $this->reportTitle($type),
                'periodText'   => $periodText,
                'rows'         => $rows,
                'meta'         => $meta,
                'moneyHeaders' => $moneyHeaders,
                'generatedOn'  => now()->format('d-m-Y'),
            ]);

            return $pdf->download("{$type}.pdf");
        }

        if ($format === 'xlsx') {
            // Simple XML SpreadsheetML (Excel-openable) without heavy writer dependency usage
            return $this->xlsxDownload($type, $rows, $meta, $this->reportTitle($type), $periodText, $moneyHeaders);
        }

        return $this->csvDownload($type, $rows);
    }

    /** Which flattened-row columns hold money vs. plain labels/codes/counts — name-based
     *  (not just is_numeric()) since codes like HSN/SAC are numeric strings too. Shared by
     *  both the PDF and Excel export so the two never disagree on formatting. */
    private function computeMoneyHeaders(array $rows): array
    {
        if (! count($rows)) {
            return [];
        }
        $nonMoneyExact = ['invoices', 'documents', 'count', 'id'];
        $nonMoneyPattern = '/code|hsn|sac|qty|quantity|uqc|rate|no\.|number|\bname\b|particular|\btype\b|description|party|customer|date|sr\.|percent|%/i';
        $out = [];
        foreach ((array) $rows[0] as $h => $v) {
            if (! is_numeric($v)) {
                continue;
            }
            if (in_array(strtolower(trim((string) $h)), $nonMoneyExact, true)) {
                continue;
            }
            if (preg_match($nonMoneyPattern, (string) $h)) {
                continue;
            }
            $out[] = $h;
        }

        return $out;
    }

    /** Client business details for the branded export header — same fields/fallbacks
     *  used on the invoice PDF, so exports carry the client's own branding, not the firm's. */
    private function businessHeaderData(?ClientProfile $p): array
    {
        if (! $p) {
            return ['name' => null, 'address' => '', 'gstin' => null, 'phone' => null, 'email' => null];
        }
        $addressParts = array_filter([
            $p->address,
            $p->city,
            trim(($p->state ?: '').($p->pincode ? ' - '.$p->pincode : '')),
        ], fn ($part) => filled($part));

        return [
            'name'    => $p->business_name ?: ($p->client_name ?: 'Business'),
            'address' => implode(', ', $addressParts),
            'pan'     => $p->pan ?: null,
            'gstin'   => $p->has_gst ? $p->gstin : null,
            'phone'   => $p->mobile ?: ($p->user?->phone ?? null),
            'email'   => $p->email ?: ($p->user?->email ?? null),
        ];
    }

    private function fmtReportDate(?string $iso): string
    {
        if (! $iso) {
            return '';
        }
        $months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        [$y, $m, $d] = array_pad(explode('-', substr($iso, 0, 10)), 3, null);

        return $m ? ((int) $d).' '.$months[((int) $m) - 1].' '.$y : $iso;
    }

    /** Friendly report titles for the export header — matches each report page's own heading. */
    private function reportTitle(string $type): string
    {
        return match ($type) {
            'gst_summary' => 'GST Summary',
            'gst_liability' => 'GST Liability / ITC',
            'hsn_summary', 'hsn_wise' => 'HSN / SAC Summary',
            'party_wise_sales', 'party_wise', 'customer_wise' => 'Party-wise Detail',
            'sales_register', 'sales_summary' => 'Sales Register',
            'invoice_register', 'document_register' => 'Invoice Register',
            'monthly_sales' => 'Monthly Sales',
            'outstanding', 'pending_dues', 'outstanding_report' => 'Outstanding / Pending Dues',
            'paid_invoices' => 'Paid Invoices',
            'credit_notes' => 'Credit Notes',
            'debit_notes' => 'Debit Notes',
            default => ucwords(str_replace('_', ' ', $type)),
        };
    }

    /** Back-compat */
    public function exportCsv(Request $request): StreamedResponse
    {
        $request->merge(['format' => 'csv']);

        return $this->export($request);
    }

    private function build(string $type, int $pid, string $from, string $to)
    {
        // Listing/filtering/GST-period counting spec — Date of Creation, not the
        // document's back-dated Document Date. whereDate() on both bounds keeps this
        // correct against the created_at timestamp column.
        // Columns are table-qualified because some reports join `customers`, which has the same
        // client_profile_id / created_at / type / status columns (an unqualified name is "ambiguous").
        $base = CommercialDocument::where('commercial_documents.client_profile_id', $pid)
            ->whereDate('commercial_documents.created_at', '>=', $from)
            ->whereDate('commercial_documents.created_at', '<=', $to);

        return match ($type) {
            'sales_register', 'sales_summary' => (clone $base)->where('type', 'tax_invoice')->whereIn('status', self::ISSUED_STATUSES)
                ->with('customer:id,name')->orderBy('created_at')->get(),
            'invoice_register', 'document_register' => (clone $base)->with('customer:id,name')->orderBy('created_at')->get(),
            'gst_summary' => $this->gstSummaryMatrix($base, $pid),
            'gst_liability' => $this->gstLiability($pid, $from, $to),
            // Net figures = Tax Invoice + Bill of Supply + Debit Note − Credit Note, same
            // convention as party_wise below — a credit note against a HSN/SAC code reduces
            // that code's reported quantity/value/tax, it doesn't add on top of it.
            'hsn_summary', 'hsn_wise' => DB::table('document_line_items as li')
                ->join('commercial_documents as d', 'd.id', '=', 'li.commercial_document_id')
                ->where('d.client_profile_id', $pid)
                ->whereDate('d.created_at', '>=', $from)
                ->whereDate('d.created_at', '<=', $to)
                ->whereIn('d.type', ['tax_invoice', 'bill_of_supply', 'debit_note', 'credit_note'])
                ->whereIn('d.status', self::ISSUED_STATUSES)
                ->select(
                    'li.hsn_sac',
                    DB::raw('MAX(li.description) as description'),
                    DB::raw("SUM(CASE WHEN d.type = 'credit_note' THEN -li.qty ELSE li.qty END) as qty"),
                    DB::raw("SUM(CASE WHEN d.type = 'credit_note' THEN -li.taxable_amount ELSE li.taxable_amount END) as taxable"),
                    DB::raw('AVG(li.gst_rate) as gst_rate'),
                    DB::raw("SUM(CASE WHEN d.type = 'credit_note' THEN -li.cgst_amount ELSE li.cgst_amount END) as cgst"),
                    DB::raw("SUM(CASE WHEN d.type = 'credit_note' THEN -li.sgst_amount ELSE li.sgst_amount END) as sgst"),
                    DB::raw("SUM(CASE WHEN d.type = 'credit_note' THEN -li.igst_amount ELSE li.igst_amount END) as igst"),
                    DB::raw("SUM(CASE WHEN d.type = 'credit_note' THEN -li.total_amount ELSE li.total_amount END) as total")
                )
                ->groupBy('li.hsn_sac')->get(),
            // Credit Notes reduce a party's business value — signed -1 here so the mixed
            // per-customer taxable/total sums net them out instead of adding them on top.
            'party_wise', 'customer_wise', 'party_wise_sales' => (clone $base)
                ->whereIn('type', ['tax_invoice', 'bill_of_supply', 'debit_note', 'credit_note'])
                ->whereIn('status', self::ISSUED_STATUSES)
                ->select(
                    'customer_id',
                    DB::raw('COUNT(*) as invoices'),
                    DB::raw("SUM(CASE WHEN type = 'credit_note' THEN -taxable_amount ELSE taxable_amount END) as taxable"),
                    DB::raw("SUM(CASE WHEN type = 'credit_note' THEN -COALESCE(NULLIF(grand_total,0), total_amount) ELSE COALESCE(NULLIF(grand_total,0), total_amount) END) as total")
                )
                ->groupBy('customer_id')->with('customer:id,name')->get(),
            'monthly_sales' => (clone $base)->where('type', 'tax_invoice')->whereIn('status', self::ISSUED_STATUSES)
                ->selectRaw(BillingPolicy::monthGroupExpr('created_at').' as month, COUNT(*) as count, SUM(taxable_amount) as taxable, SUM(COALESCE(NULLIF(grand_total,0), total_amount)) as total')
                ->groupBy('month')->orderBy('month')->get(),
            // A Debit Note adds to what a party owes; a Credit Note reduces it — both now
            // included alongside Tax Invoice/Bill of Supply so "Total Outstanding" nets as
            // Tax Invoice + Bill of Supply + Debit Note − Credit Note, not just the sales
            // documents on their own.
            'outstanding', 'pending_dues', 'outstanding_report' => (clone $base)
                ->whereIn('type', ['tax_invoice', 'bill_of_supply', 'debit_note', 'credit_note'])
                ->whereIn('status', ['issued', 'partial'])
                ->with('customer:id,name')
                ->orderBy('created_at')
                ->get(),
            'paid_invoices' => (clone $base)
                ->whereIn('type', ['tax_invoice', 'bill_of_supply', 'debit_note', 'credit_note'])
                ->where('status', 'paid')
                ->with('customer:id,name')
                ->orderByDesc('created_at')
                ->get(),
            'credit_notes' => (clone $base)->where('type', 'credit_note')->with('customer:id,name')->get(),
            'debit_notes' => (clone $base)->where('type', 'debit_note')->with('customer:id,name')->get(),
            'document_numbering' => $this->documentNumberingSummary($pid, $from, $to),
            default => ['error' => 'Unknown report type', 'available' => $this->availableTypes()],
        };
    }

    /** @return array<string, float|string> */
    private function gstLiability(int $pid, string $from, string $to): array
    {
        $profile = ClientProfile::find($pid);
        abort_unless(
            $profile && BillingPolicy::mode($profile) === 'regular',
            422,
            'GST Liability Report is available only for regular GST dealers.'
        );

        return $this->liabilityService->calculate($pid, $from, $to);
    }

    private function gstSummaryMatrix($base, int $pid): array
    {
        $bucket = function (string $type) use ($base): array {
            $scope = (clone $base)->where('type', $type)->whereIn('status', self::ISSUED_STATUSES);

            return [
                'taxable_value' => (float) (clone $scope)->sum('taxable_amount'),
                'cgst' => (float) (clone $scope)->sum('cgst_amount'),
                'sgst' => (float) (clone $scope)->sum('sgst_amount'),
                'igst' => (float) (clone $scope)->sum('igst_amount'),
                'total_invoice_value' => (float) (clone $scope)->sum(DB::raw('COALESCE(NULLIF(grand_total,0), total_amount)')),
                'count' => (clone $scope)->count(),
            ];
        };

        // B2B = customer has a registered GSTIN; B2C = no GSTIN / unregistered.
        $bucketB2b = function (string $type, bool $isB2b) use ($base): array {
            $scope = (clone $base)->where('commercial_documents.type', $type)->whereIn('commercial_documents.status', self::ISSUED_STATUSES)
                ->leftJoin('customers', 'commercial_documents.customer_id', '=', 'customers.id');
            if ($isB2b) {
                $scope = $scope->where('customers.gst_status', 'registered')
                               ->whereNotNull('customers.gstin')
                               ->where('customers.gstin', '!=', '');
            } else {
                $scope = $scope->where(function ($q) {
                    $q->whereNull('customers.id')
                      ->orWhere('customers.gst_status', '!=', 'registered')
                      ->orWhereNull('customers.gstin')
                      ->orWhere('customers.gstin', '=', '');
                });
            }
            return [
                'taxable_value' => (float) $scope->sum('commercial_documents.taxable_amount'),
                'cgst' => (float) $scope->sum('commercial_documents.cgst_amount'),
                'sgst' => (float) $scope->sum('commercial_documents.sgst_amount'),
                'igst' => (float) $scope->sum('commercial_documents.igst_amount'),
                'total_invoice_value' => (float) $scope->sum(DB::raw('COALESCE(NULLIF(commercial_documents.grand_total,0), commercial_documents.total_amount)')),
                'count' => $scope->count(),
            ];
        };

        $zero = [
            'taxable_value' => 0.0, 'cgst' => 0.0, 'sgst' => 0.0,
            'igst' => 0.0, 'total_invoice_value' => 0.0, 'count' => 0,
        ];

        $tax = $bucket('tax_invoice');
        $bos = $bucket('bill_of_supply');
        $dn = $bucket('debit_note');
        $cn = $bucket('credit_note');

        $profile = ClientProfile::find($pid);
        $mode = $profile ? BillingPolicy::mode($profile) : 'regular';

        // Same 4-column structure for every dealer type — only values change.
        if ($mode === 'regular') {
            $bos = $zero;
        } elseif ($mode === 'composition') {
            $tax = $zero;
            $dn = $zero;
        }

        // B2B/B2C bifurcation per doc type
        $bifurcation = [];
        foreach (['tax_invoice', 'bill_of_supply', 'debit_note', 'credit_note'] as $docType) {
            $bifurcation[$docType] = [
                'b2b' => $bucketB2b($docType, true),
                'b2c' => $bucketB2b($docType, false),
            ];
        }
        // Apply same dealer-mode zeroing
        if ($mode === 'regular') {
            $bifurcation['bill_of_supply'] = ['b2b' => $zero, 'b2c' => $zero];
        } elseif ($mode === 'composition') {
            $bifurcation['tax_invoice'] = ['b2b' => $zero, 'b2c' => $zero];
            $bifurcation['debit_note']  = ['b2b' => $zero, 'b2c' => $zero];
        }

        return [
            'matrix' => [
                'tax_invoice' => $tax,
                'bill_of_supply' => $bos,
                'debit_note' => $dn,
                'credit_note' => $cn,
            ],
            'bifurcation' => $bifurcation,
            'dealer_mode' => $mode,
            // Legacy flat fields
            'taxable' => $tax['taxable_value'],
            'cgst' => $tax['cgst'],
            'sgst' => $tax['sgst'],
            'igst' => $tax['igst'],
            'total_gst' => $tax['cgst'] + $tax['sgst'] + $tax['igst'],
            'total' => $tax['total_invoice_value'],
        ];
    }

    private function flattenGstMatrix(array $matrix): array
    {
        $rows = [
            'taxable_value' => 'Total Taxable Value',
            'cgst' => 'CGST Amount',
            'sgst' => 'SGST/UTGST Amount',
            'igst' => 'IGST Amount',
            'total_invoice_value' => 'Total Gross Value',
        ];
        $out = [];
        foreach ($rows as $key => $label) {
            $taxInvoices = (float) ($matrix['tax_invoice'][$key] ?? 0);
            $billOfSupply = (float) ($matrix['bill_of_supply'][$key] ?? 0);
            $debitNotes = (float) ($matrix['debit_note'][$key] ?? 0);
            $creditNotes = (float) ($matrix['credit_note'][$key] ?? 0);
            $out[] = [
                'Particulars' => $label,
                'Tax Invoices' => $taxInvoices,
                'Bills of Supply' => $billOfSupply,
                'Debit Notes' => $debitNotes,
                'Credit Notes' => $creditNotes,
                // Row-wise net across doc types, same as the live GST Summary report's
                // "Total" column — Credit Notes reduce the value, so they're subtracted.
                'Total' => $taxInvoices + $billOfSupply + $debitNotes - $creditNotes,
            ];
        }

        return $out;
    }

    /** Renames the raw hsn_summary query columns to the same human labels the live
     * HSN / SAC Summary page uses (Code Type, HSN / SAC Code, GST Rate (%), ...) and
     * appends a Total row, so the export matches the on-screen table instead of dumping
     * raw DB column names. */
    private function flattenHsnSummary(array $rows): array
    {
        $out = [];
        $totQty = $totTaxable = $totIgst = $totCgst = $totSgst = 0.0;

        foreach ($rows as $row) {
            $arr = is_array($row) ? $row : (array) $row;
            $hsn = (string) ($arr['hsn_sac'] ?? '');
            $qty = (float) ($arr['qty'] ?? 0);
            $taxable = (float) ($arr['taxable'] ?? 0);
            $igst = (float) ($arr['igst'] ?? 0);
            $cgst = (float) ($arr['cgst'] ?? 0);
            $sgst = (float) ($arr['sgst'] ?? 0);

            $totQty += $qty;
            $totTaxable += $taxable;
            $totIgst += $igst;
            $totCgst += $cgst;
            $totSgst += $sgst;

            $out[] = [
                'Code Type' => str_starts_with($hsn, '99') ? 'SAC' : 'HSN',
                'HSN / SAC Code' => $hsn,
                'GST Rate (%)' => round((float) ($arr['gst_rate'] ?? 0)),
                'QTY' => $qty,
                'Taxable Value' => $taxable,
                'IGST' => $igst,
                'CGST' => $cgst,
                'SGST' => $sgst,
            ];
        }

        $out[] = [
            'Code Type' => 'Total',
            'HSN / SAC Code' => '',
            'GST Rate (%)' => '',
            'QTY' => $totQty,
            'Taxable Value' => $totTaxable,
            'IGST' => $totIgst,
            'CGST' => $totCgst,
            'SGST' => $totSgst,
        ];

        return $out;
    }

    private function availableTypes(): array
    {
        return [
            'sales_register', 'invoice_register', 'gst_summary', 'gst_liability', 'hsn_summary',
            'party_wise_sales', 'monthly_sales', 'outstanding_report', 'paid_invoices',
            'credit_notes', 'debit_notes', 'document_numbering',
        ];
    }

    private static array $DOC_TYPE_ORDER = [
        'tax_invoice', 'bill_of_supply', 'debit_note', 'credit_note', 'quotation', 'delivery_challan',
    ];

    private static array $DOC_TYPE_LABELS = [
        'tax_invoice'      => 'Tax Invoice',
        'bill_of_supply'   => 'Bill of Supply',
        'debit_note'       => 'Debit Note',
        'credit_note'      => 'Credit Note',
        'quotation'        => 'Quotation',
        'delivery_challan' => 'Delivery Challan',
    ];

    private function documentNumberingSummary(int $pid, string $from, string $to): array
    {
        $rows = [];
        foreach (self::$DOC_TYPE_ORDER as $type) {
            $docs = CommercialDocument::where('client_profile_id', $pid)
                ->where('type', $type)
                ->whereDate('created_at', '>=', $from)
                ->whereDate('created_at', '<=', $to)
                ->whereNotIn('status', ['draft'])
                ->orderBy('number')
                ->get(['id', 'number', 'status']);

            if ($docs->isEmpty()) {
                continue;
            }

            $allNums   = $docs->pluck('number');
            $prefix    = $this->extractPrefix((string) ($allNums->first() ?? ''));
            $cancelled = $docs->where('status', 'cancelled')->count();
            $active    = $docs->count() - $cancelled;

            $rows[] = [
                'type'           => $type,
                'label'          => self::$DOC_TYPE_LABELS[$type] ?? $type,
                'prefix'         => $prefix,
                'start_sequence' => $allNums->first(),
                'end_sequence'   => $allNums->last(),
                'total'          => $docs->count(),
                'cancelled'      => $cancelled,
                'active'         => $active,
            ];
        }

        $totalDocs      = array_sum(array_column($rows, 'total'));
        $activeDocs     = array_sum(array_column($rows, 'active'));
        $cancelledDocs  = array_sum(array_column($rows, 'cancelled'));
        $docTypesCount  = count($rows);

        return [
            'summary' => compact('totalDocs', 'activeDocs', 'cancelledDocs', 'docTypesCount'),
            'rows'    => $rows,
        ];
    }

    public function drillDown(Request $request): \Illuminate\Http\JsonResponse
    {
        $pid      = $this->profileId($request);
        $period   = array_combine(['from', 'to'], $this->dateRange($request));
        $docType  = $request->input('document_type');

        abort_unless(in_array($docType, self::$DOC_TYPE_ORDER, true), 422, 'Invalid document type.');

        $docs = CommercialDocument::where('client_profile_id', $pid)
            ->where('type', $docType)
            ->whereDate('created_at', '>=', $period['from'])
            ->whereDate('created_at', '<=', $period['to'])
            ->whereNotIn('status', ['draft'])
            ->orderBy('number')
            ->get(['id', 'number', 'status', 'document_date', 'created_at', 'type']);

        return response()->json([
            'document_type' => $docType,
            'label'         => self::$DOC_TYPE_LABELS[$docType] ?? $docType,
            'from'          => $period['from'],
            'to'            => $period['to'],
            'documents'     => $docs->map(fn ($d) => [
                'id'            => $d->id,
                'number'        => $d->number,
                'document_date' => $d->document_date?->format('d M Y'),
                'status'        => $d->status,
                'created_at'    => $d->created_at?->format('d M Y, h:i A'),
                'filing_status' => null,
            ]),
        ]);
    }

    private function extractPrefix(string $number): string
    {
        if (preg_match('/^([A-Za-z\-_\/]+)/u', $number, $m)) {
            return rtrim($m[1], '-_/');
        }
        return '—';
    }

    private function flattenRows($data): array
    {
        if (is_object($data) && method_exists($data, 'toArray')) {
            $data = $data->toArray();
        }
        if (! is_array($data)) {
            return [['value' => $data]];
        }
        if (isset($data['matrix']) && is_array($data['matrix'])) {
            return $this->flattenGstMatrix($data['matrix']);
        }
        if (isset($data['total_output_gst'], $data['total_eligible_itc'])) {
            return [
                ['Particulars' => 'Total Output GST', 'Amount' => $data['total_output_gst']],
                ['Particulars' => 'Total Eligible ITC', 'Amount' => $data['total_eligible_itc']],
                ['Particulars' => 'Net GST Liability (Output GST - Eligible ITC)', 'Amount' => $data['net_gst_liability']],
                ['Particulars' => 'GST Payable', 'Amount' => $data['gst_payable']],
                ['Particulars' => 'ITC Carry Forward', 'Amount' => $data['itc_carry_forward']],
                ['Particulars' => 'Result', 'Amount' => $data['result_label']],
            ];
        }
        if (isset($data['taxable']) || isset($data['error'])) {
            return [$data];
        }
        if (isset($data[0]) && is_array((array) $data[0]) && array_key_exists('hsn_sac', (array) $data[0])) {
            return $this->flattenHsnSummary($data);
        }
        $out = [];
        foreach ($data as $row) {
            $arr = is_array($row) ? $row : (array) $row;
            if (isset($arr['customer']) && is_array($arr['customer'])) {
                $arr['party_name'] = $arr['customer']['name'] ?? '';
                unset($arr['customer']);
            }
            $out[] = $arr;
        }

        return $out ?: [['message' => 'No data']];
    }

    private function csvDownload(string $type, array $rows): StreamedResponse
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
        }, "{$type}.csv", ['Content-Type' => 'text/csv']);
    }

    /**
     * SpreadsheetML export — same branded header (business name/address/GSTIN/phone/
     * email), report title + period, and Total-row highlight as the PDF export, so the
     * two formats are visually consistent (per the reference designs).
     */
    private function xlsxDownload(string $type, array $rows, array $meta, string $title, string $periodText, array $moneyHeaders)
    {
        $headers = array_keys($rows[0] ?? ['value' => '']);
        $colCount = max(count($headers), 1);
        $esc = fn ($v) => htmlspecialchars((string) $v, ENT_QUOTES | ENT_XML1);

        $xml = '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>';
        $xml .= '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">';

        $xml .= '<Styles>';
        $xml .= '<Style ss:ID="bizName"><Font ss:Bold="1" ss:Size="14" ss:Color="#000000"/><Alignment ss:Horizontal="Center"/></Style>';
        $xml .= '<Style ss:ID="bizLine"><Font ss:Size="10" ss:Color="#222222"/><Alignment ss:Horizontal="Center"/></Style>';
        $xml .= '<Style ss:ID="bizMeta"><Font ss:Size="10" ss:Color="#222222"/><Alignment ss:Horizontal="Center"/></Style>';
        $xml .= '<Style ss:ID="title"><Font ss:Bold="1" ss:Size="13" ss:Color="#000000"/><Alignment ss:Horizontal="Center"/></Style>';
        $xml .= '<Style ss:ID="period"><Font ss:Size="10" ss:Color="#444444"/><Alignment ss:Horizontal="Center"/></Style>';
        $xml .= '<Style ss:ID="colHead"><Font ss:Bold="1" ss:Size="10" ss:Color="#FFFFFF"/><Interior ss:Color="#4B5563" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/></Style>';
        $xml .= '<Style ss:ID="cell"><Alignment ss:Horizontal="Center"/></Style>';
        $xml .= '<Style ss:ID="cellLabel"><Font ss:Bold="1"/><Alignment ss:Horizontal="Left"/></Style>';
        $xml .= '<Style ss:ID="cellMoney"><Alignment ss:Horizontal="Center"/><NumberFormat ss:Format="#,##0.00"/></Style>';
        $xml .= '<Style ss:ID="totalCell"><Font ss:Bold="1" ss:Color="#000000"/><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/></Style>';
        $xml .= '<Style ss:ID="totalLabel"><Font ss:Bold="1" ss:Color="#000000"/><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/><Alignment ss:Horizontal="Left"/></Style>';
        $xml .= '<Style ss:ID="totalMoney"><Font ss:Bold="1" ss:Color="#000000"/><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/><NumberFormat ss:Format="#,##0.00"/></Style>';
        $xml .= '<Style ss:ID="footer"><Font ss:Size="9" ss:Color="#444444"/><Alignment ss:Horizontal="Left"/></Style>';
        $xml .= '</Styles>';

        $xml .= '<Worksheet ss:Name="Report"><Table>';

        $mergeAttr = $colCount > 1 ? ' ss:MergeAcross="'.($colCount - 1).'"' : '';
        if ($meta['name'] ?? null) {
            $xml .= '<Row><Cell'.$mergeAttr.' ss:StyleID="bizName"><Data ss:Type="String">'.$esc(strtoupper($meta['name'])).'</Data></Cell></Row>';
            if ($meta['address'] ?? null) {
                $xml .= '<Row><Cell'.$mergeAttr.' ss:StyleID="bizLine"><Data ss:Type="String">'.$esc($meta['address']).'</Data></Cell></Row>';
            }
            $metaLine = implode('   |   ', array_filter([
                ($meta['pan']   ?? null) ? 'PAN: '.$meta['pan']       : null,
                ($meta['gstin'] ?? null) ? 'GSTIN: '.$meta['gstin']   : null,
                ($meta['email'] ?? null) ? 'Email: '.$meta['email']   : null,
                ($meta['phone'] ?? null) ? 'Mobile: '.$meta['phone']  : null,
            ]));
            if ($metaLine) {
                $xml .= '<Row><Cell'.$mergeAttr.' ss:StyleID="bizMeta"><Data ss:Type="String">'.$esc($metaLine).'</Data></Cell></Row>';
            }
            $xml .= '<Row></Row>';
        }

        $xml .= '<Row><Cell'.$mergeAttr.' ss:StyleID="title"><Data ss:Type="String">'.$esc($title).'</Data></Cell></Row>';
        $xml .= '<Row><Cell'.$mergeAttr.' ss:StyleID="period"><Data ss:Type="String">'.$esc('Period: '.$periodText).'</Data></Cell></Row>';
        $xml .= '<Row></Row>';

        $xml .= '<Row>';
        foreach ($headers as $h) {
            $label = $h.(in_array($h, $moneyHeaders, true) ? ' (₹)' : '');
            $xml .= '<Cell ss:StyleID="colHead"><Data ss:Type="String">'.$esc($label).'</Data></Cell>';
        }
        $xml .= '</Row>';

        $lastIndex = count($rows) - 1;
        foreach ($rows as $i => $row) {
            $arr = (array) $row;
            $first = reset($arr);
            $isTotal = $i === $lastIndex && is_string($first) && stripos($first, 'total') !== false;
            $xml .= '<Row>';
            foreach ($headers as $ci => $h) {
                $v = $arr[$h] ?? '';
                $isMoney = in_array($h, $moneyHeaders, true) && is_numeric($v);
                $isLabelCol = $ci === 0;
                $style = $isTotal
                    ? ($isLabelCol ? 'totalLabel' : ($isMoney ? 'totalMoney' : 'totalCell'))
                    : ($isLabelCol ? 'cellLabel' : ($isMoney ? 'cellMoney' : 'cell'));
                $typeAttr = is_numeric($v) ? 'Number' : 'String';
                $xml .= '<Cell ss:StyleID="'.$style.'"><Data ss:Type="'.$typeAttr.'">'.$esc($v).'</Data></Cell>';
            }
            $xml .= '</Row>';
        }
        $xml .= '<Row></Row>';
        $xml .= '<Row><Cell ss:StyleID="footer"><Data ss:Type="String">'.$esc('Report Generated On: '.now()->format('d-m-Y')).'</Data></Cell></Row>';
        $xml .= '</Table></Worksheet></Workbook>';

        return response($xml, 200, [
            'Content-Type' => 'application/vnd.ms-excel',
            'Content-Disposition' => "attachment; filename=\"{$type}.xls\"",
        ]);
    }
}
