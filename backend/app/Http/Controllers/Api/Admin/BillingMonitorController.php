<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\ClientProfile;
use App\Models\CommercialDocument;
use App\Models\User;
use App\Services\Billing\BillingPolicy;
use App\Services\Billing\InvoiceService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

class BillingMonitorController extends Controller
{
    public function __construct(private InvoiceService $invoices)
    {
    }

    public function dashboard(Request $request)
    {
        $yearStart = now()->month >= 4
            ? now()->year.'-04-01'
            : (now()->year - 1).'-04-01';

        $issued = CommercialDocument::where('type', 'tax_invoice')->where('status', 'issued');
        // GST-period counting spec — Date of Creation, not the back-dated Document Date.
        $fy = (clone $issued)->where('created_at', '>=', $yearStart);

        $monthly = CommercialDocument::where('type', 'tax_invoice')->where('status', 'issued')
            ->where('created_at', '>=', now()->subMonths(11)->startOfMonth())
            ->selectRaw(BillingPolicy::monthGroupExpr('created_at').' as month, COUNT(*) as count, SUM(COALESCE(NULLIF(grand_total,0), total_amount)) as total, SUM(taxable_amount) as taxable, SUM(cgst_amount+sgst_amount+igst_amount) as gst')
            ->groupBy('month')->orderBy('month')->get();

        $topClients = CommercialDocument::where('type', 'tax_invoice')->where('status', 'issued')
            ->select('client_profile_id', DB::raw('COUNT(*) as invoices'), DB::raw('SUM(COALESCE(NULLIF(grand_total,0), total_amount)) as total'))
            ->groupBy('client_profile_id')
            ->with('clientProfile:id,business_name,gstin')
            ->orderByDesc('total')
            ->limit(10)
            ->get();

        $clientWise = ClientProfile::query()
            ->orderBy('business_name')
            ->limit(50)
            ->get(['id', 'business_name', 'gstin', 'user_id'])
            ->map(function ($p) {
                $p->tax_invoices_count = CommercialDocument::where('client_profile_id', $p->id)->where('type', 'tax_invoice')->count();
                $p->debit_notes_count = CommercialDocument::where('client_profile_id', $p->id)->where('type', 'debit_note')->count();
                $p->credit_notes_count = CommercialDocument::where('client_profile_id', $p->id)->where('type', 'credit_note')->count();
                $p->total_amount = (float) CommercialDocument::where('client_profile_id', $p->id)
                    ->where('type', 'tax_invoice')->where('status', 'issued')
                    ->sum(DB::raw('COALESCE(NULLIF(grand_total,0), total_amount)'));

                return $p;
            });

        $hsn = DB::table('document_line_items as li')
            ->join('commercial_documents as d', 'd.id', '=', 'li.commercial_document_id')
            ->where('d.type', 'tax_invoice')->where('d.status', 'issued')
            ->where('d.created_at', '>=', $yearStart)
            ->select('li.hsn_sac', DB::raw('MAX(li.description) as description'), DB::raw('SUM(li.qty) as qty'), DB::raw('SUM(li.taxable_amount) as taxable'), DB::raw('SUM(li.cgst_amount+li.sgst_amount+li.igst_amount) as gst'), DB::raw('SUM(li.total_amount) as total'))
            ->groupBy('li.hsn_sac')->orderByDesc('total')->limit(20)->get();

        $recent = CommercialDocument::with(['customer:id,name', 'clientProfile:id,business_name'])
            ->latest('created_at')->latest('id')->limit(12)->get();

        return response()->json([
            'kpis' => [
                'total_clients' => ClientProfile::count(),
                'total_invoices' => CommercialDocument::count(),
                'tax_invoices' => CommercialDocument::where('type', 'tax_invoice')->count(),
                'debit_notes' => CommercialDocument::where('type', 'debit_note')->count(),
                'credit_notes' => CommercialDocument::where('type', 'credit_note')->count(),
            ],
            'gst_fy' => [
                'taxable_value' => (float) (clone $fy)->sum('taxable_amount'),
                'cgst' => (float) (clone $fy)->sum('cgst_amount'),
                'sgst' => (float) (clone $fy)->sum('sgst_amount'),
                'igst' => (float) (clone $fy)->sum('igst_amount'),
                'total_gst' => (float) (clone $fy)->selectRaw('SUM(cgst_amount+sgst_amount+igst_amount) as t')->value('t'),
                'total_invoice_value' => (float) (clone $fy)->sum(DB::raw('COALESCE(NULLIF(grand_total,0), total_amount)')),
            ],
            'monthly_trend' => $monthly,
            'top_clients' => $topClients,
            'client_wise' => $clientWise,
            'hsn_summary' => $hsn,
            'recent_invoices' => $recent,
        ]);
    }

    public function invoices(Request $request)
    {
        $q = CommercialDocument::with(['customer:id,name', 'clientProfile:id,business_name,gstin'])
            ->latest('created_at')->latest('id');

        if ($request->filled('client_profile_id')) {
            $q->where('client_profile_id', $request->client_profile_id);
        }
        if ($request->filled('type')) {
            $q->where('type', $request->type);
        }
        if ($request->filled('from')) {
            $q->whereDate('created_at', '>=', $request->from);
        }
        if ($request->filled('to')) {
            $q->whereDate('created_at', '<=', $request->to);
        }
        if ($request->filled('q')) {
            $s = $request->q;
            $q->where(function ($w) use ($s) {
                $w->where('number', 'like', "%{$s}%")
                    ->orWhereHas('customer', fn ($c) => $c->where('name', 'like', "%{$s}%"))
                    ->orWhereHas('clientProfile', fn ($c) => $c->where('business_name', 'like', "%{$s}%")->orWhere('gstin', 'like', "%{$s}%"));
            });
        }

        return response()->json($q->paginate(30));
    }

    public function showInvoice(int $id)
    {
        $doc = CommercialDocument::with([
            'lineItems',
            'customer',
            'clientProfile',
            'referenceDocument:id,number,type,document_date,grand_total,total_amount,status',
            'tdsTcsSection',
        ])->findOrFail($id);

        return response()->json($doc);
    }

    public function pdfInvoice(int $id)
    {
        $doc = CommercialDocument::findOrFail($id);
        $this->invoices->generatePdf($doc);
        $doc->refresh();

        return response()->json(['url' => '/storage/'.$doc->pdf_path, 'path' => $doc->pdf_path]);
    }

    /** Admin-only hard delete — see InvoiceService::adminDelete() for the guard rails
     * and cleanup. Logs an explicit ActivityLog entry (in addition to the AuditLog
     * middleware's generic request log) because the document row itself won't exist
     * afterward for anyone to look up. */
    public function destroyDocument(Request $request, int $id)
    {
        $doc = CommercialDocument::findOrFail($id);
        $snapshot = [
            'number' => $doc->number,
            'type' => $doc->type,
            'client_profile_id' => $doc->client_profile_id,
            'client_business_name' => $doc->clientProfile?->business_name,
            'grand_total' => $doc->grand_total ?: $doc->total_amount,
        ];

        $this->invoices->adminDelete($doc);

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'deleted_document',
            'subject_type' => CommercialDocument::class,
            'subject_id' => $id,
            'properties' => $snapshot,
            'ip_address' => $request->ip(),
        ]);

        return response()->json(['message' => 'Document deleted permanently.']);
    }

    /** Admin — Full Billing Access & Control spec: an admin can change any document's
     *  Number, Date, or Status (including moving a cancelled/incorrect document back to
     *  Draft so the client can access and recreate it) regardless of GST filing locks.
     *  Line items/amounts are unchanged here — once the document is back in Draft, the
     *  client edits it normally through the existing client-side update flow. */
    public function updateDocument(Request $request, int $id)
    {
        $doc = CommercialDocument::findOrFail($id);
        $data = $request->validate([
            'number' => 'nullable|string|max:100',
            'document_date' => 'nullable|date',
            'status' => 'nullable|in:draft,issued,cancelled,paid,partial',
        ]);

        $before = $doc->only(['number', 'document_date', 'status']);
        $doc = $this->invoices->adminUpdate($doc, $data);

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'updated_document',
            'subject_type' => CommercialDocument::class,
            'subject_id' => $id,
            'properties' => ['before' => $before, 'after' => $doc->only(['number', 'document_date', 'status'])],
            'ip_address' => $request->ip(),
        ]);

        return response()->json($doc);
    }

    public function report(Request $request)
    {
        $type = $request->input('type', 'gst_summary');
        $from = $request->input('from', now()->startOfMonth()->toDateString());
        $to = $request->input('to', now()->toDateString());

        // GST-period counting spec — Date of Creation, not the back-dated Document Date.
        $base = CommercialDocument::whereDate('created_at', '>=', $from)->whereDate('created_at', '<=', $to);

        // If called via /clients/{id}/reports, filter to that client only
        $clientId = $request->route('id') ?? $request->input('client_profile_id');
        if ($clientId) {
            $base->where('client_profile_id', (int) $clientId);
        }
        $data = match ($type) {
            'client_wise_register' => (clone $base)->with(['customer:id,name', 'clientProfile:id,business_name'])->orderBy('created_at')->get(),
            'monthly_sales' => (clone $base)->where('type', 'tax_invoice')->where('status', 'issued')
                ->selectRaw(BillingPolicy::monthGroupExpr('created_at').' as month, COUNT(*) as count, SUM(COALESCE(NULLIF(grand_total,0), total_amount)) as total')
                ->groupBy('month')->orderBy('month')->get(),
            'gst_summary' => $this->gstSummaryMatrixFirm($base),
            'hsn_summary' => DB::table('document_line_items as li')
                ->join('commercial_documents as d', 'd.id', '=', 'li.commercial_document_id')
                ->whereDate('d.created_at', '>=', $from)
                ->whereDate('d.created_at', '<=', $to)
                ->where('d.type', 'tax_invoice')->where('d.status', 'issued')
                ->when($clientId, fn($q) => $q->where('d.client_profile_id', (int)$clientId))
                ->select(
                    'li.hsn_sac',
                    DB::raw('MAX(li.description) as description'),
                    DB::raw('MAX(li.gst_rate) as gst_rate'),
                    DB::raw('SUM(li.qty) as qty'),
                    DB::raw('SUM(li.taxable_amount) as taxable'),
                    DB::raw('SUM(li.cgst_amount) as cgst'),
                    DB::raw('SUM(li.sgst_amount) as sgst'),
                    DB::raw('SUM(li.igst_amount) as igst'),
                    DB::raw('SUM(li.total_amount) as total')
                )
                ->groupBy('li.hsn_sac')->get(),
            'party_wise' => (clone $base)->where('type', 'tax_invoice')->where('status', 'issued')
                ->select('customer_id', DB::raw('COUNT(*) as invoices'), DB::raw('SUM(COALESCE(NULLIF(grand_total,0), total_amount)) as total'))
                ->groupBy('customer_id')->with('customer:id,name')->get(),
            default => ['error' => 'Unknown type'],
        };

        $format = $request->input('format', 'json');
        if ($format === 'json') {
            return response()->json(['type' => $type, 'from' => $from, 'to' => $to, 'data' => $data]);
        }

        // gst_summary's on-screen/JSON shape carries a nested 'matrix' (tax_invoice/
        // bill_of_supply/debit_note/credit_note buckets) alongside flat top-level
        // taxable/cgst/sgst/igst/total keys copied from tax_invoice only — fine for the
        // dashboard widget that reads those directly, but exporting that shape as-is
        // dumped the raw nested matrix as a single "matrix" column full of JSON. Flatten
        // it into the same Particulars/Tax Invoices/Bill of Supply/... rows the client
        // portal's GST Summary export already uses, for every export format.
        if ($type === 'gst_summary' && is_array($data) && isset($data['matrix'])) {
            $rows = $this->flattenGstMatrixFirm($data['matrix']);
        } else {
            $rows = is_array($data) && isset($data['taxable']) ? [$data] : (method_exists($data, 'toArray') ? $data->toArray() : (array) $data);
        }
        if ($format === 'pdf') {
            return Pdf::loadView('pdf.report', [
                'title'        => ucwords(str_replace('_', ' ', $type)),
                'periodText'   => $from.' to '.$to,
                'rows'         => $rows,
                'meta'         => [],
                'moneyHeaders' => $this->computeMoneyHeaders($rows),
                'generatedOn'  => now()->format('d-m-Y'),
            ])->download("{$type}.pdf");
        }

        if ($format === 'xlsx') {
            return $this->xlsxDownload($type, $rows);
        }

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            if ($rows) {
                fputcsv($out, array_keys((array) $rows[0]));
            }
            foreach ($rows as $row) {
                $arr = (array) $row;
                fputcsv($out, array_map(fn ($v) => is_scalar($v) || $v === null ? $v : json_encode($v), $arr));
            }
            fclose($out);
        }, "{$type}.csv", ['Content-Type' => 'text/csv']);
    }

    /** Real Excel-openable export (SpreadsheetML) for the Admin Billing Reports "Export
     *  Excel" button — was previously mislabeled and downloading plain CSV instead.
     *  Same styling approach as the client portal's ReportController::xlsxDownload(),
     *  minus the per-client business header since this report spans every client. */
    private function xlsxDownload(string $type, array $rows)
    {
        // $rows[0] can be a stdClass (raw DB::table() query rows, e.g. hsn_summary) rather
        // than an array — cast before array_keys() or it throws a TypeError.
        $headers = array_keys((array) ($rows[0] ?? ['value' => '']));
        $colCount = max(count($headers), 1);
        $moneyHeaders = $this->computeMoneyHeaders($rows);
        $esc = fn ($v) => htmlspecialchars((string) $v, ENT_QUOTES | ENT_XML1);
        $title = strtoupper(str_replace('_', ' ', $type));

        $xml = '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>';
        $xml .= '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">';
        $xml .= '<Styles>';
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

        // Determine period from request or default
        $reqFrom = request()->input('from', '');
        $reqTo   = request()->input('to', '');
        $periodStr = $reqFrom && $reqTo ? $reqFrom.' to '.$reqTo : '';

        $mergeAttr = $colCount > 1 ? ' ss:MergeAcross="'.($colCount - 1).'"' : '';
        $xml .= '<Row><Cell'.$mergeAttr.' ss:StyleID="title"><Data ss:Type="String">'.$esc(ucwords(str_replace('_', ' ', $type))).'</Data></Cell></Row>';
        if ($periodStr) {
            $xml .= '<Row><Cell'.$mergeAttr.' ss:StyleID="period"><Data ss:Type="String">'.$esc('Period: '.$periodStr).'</Data></Cell></Row>';
        }
        $xml .= '<Row></Row>';

        $xml .= '<Row>';
        foreach ($headers as $h) {
            $label = $h.(in_array($h, $moneyHeaders, true) ? ' (₹)' : '');
            $xml .= '<Cell ss:StyleID="colHead"><Data ss:Type="String">'.$esc($label).'</Data></Cell>';
        }
        $xml .= '</Row>';

        $lastIndex = count($rows) - 1;
        foreach ($rows as $i => $row) {
            $arr   = (array) $row;
            $first = reset($arr);
            $isTotal = $i === $lastIndex && is_string($first) && stripos($first, 'total') !== false;
            $xml .= '<Row>';
            foreach ($headers as $ci => $h) {
                $v = $arr[$h] ?? '';
                $isMoney = in_array($h, $moneyHeaders, true) && is_numeric($v);
                $isLabelCol = $ci === 0;
                $style = $isTotal
                    ? ($isLabelCol ? 'totalLabel' : ($isMoney ? 'totalMoney' : 'totalCell'))
                    : ($isLabelCol ? 'cellLabel'  : ($isMoney ? 'cellMoney'  : 'cell'));
                $typeAttr = is_numeric($v) ? 'Number' : 'String';
                $xml .= '<Cell ss:StyleID="'.$style.'"><Data ss:Type="'.$typeAttr.'">'.$esc(is_scalar($v) ? $v : json_encode($v)).'</Data></Cell>';
            }
            $xml .= '</Row>';
        }
        $xml .= '<Row></Row>';
        $xml .= '<Row><Cell ss:StyleID="footer"><Data ss:Type="String">'.$esc('Report Generated On: '.now()->format('d-m-Y')).'</Data></Cell></Row>';
        $xml .= '</TABLE></Worksheet></Workbook>';

        return response($xml, 200, [
            'Content-Type' => 'application/vnd.ms-excel',
            'Content-Disposition' => "attachment; filename=\"{$type}.xls\"",
        ]);
    }

    /** Which columns hold money vs. plain labels/codes/counts — name-based, since codes
     *  like HSN/SAC are numeric strings too. Same heuristic as the client portal's
     *  ReportController::computeMoneyHeaders(). */
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

    public function setClientActive(Request $request, int $id)
    {
        $data = $request->validate(['is_active' => 'required|boolean']);
        $profile = ClientProfile::with('user')->findOrFail($id);
        $profile->user->update(['is_active' => $data['is_active']]);

        return response()->json(['user' => $profile->user->fresh(), 'profile' => $profile]);
    }

    public function resetClientPassword(Request $request, int $id)
    {
        $data = $request->validate(['password' => 'required|string|min:8']);
        $profile = ClientProfile::with('user')->findOrFail($id);
        $profile->user->update([
            'password' => Hash::make($data['password']),
            'password_updated_at' => now(),
            'password_updated_by' => 'admin',
        ]);
        $profile->touch();
        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'reset_client_password',
            'subject_type' => User::class,
            'subject_id' => $profile->user_id,
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'message' => 'Password updated',
            'password_updated_at' => $profile->user->password_updated_at?->toIso8601String(),
            'password_updated_by' => 'admin',
        ]);
    }

    /** Firm-wide GST matrix — always 4 columns with actual aggregates. */
    /** Same row shape as the client portal's ReportController::flattenGstMatrix() —
     *  used only for exports (CSV/PDF/Excel), not the on-screen dashboard widget. */
    private function flattenGstMatrixFirm(array $matrix): array
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
                'Bill of Supply' => $billOfSupply,
                'Debit Notes' => $debitNotes,
                'Credit Notes' => $creditNotes,
                // Credit Notes reduce value, so they're subtracted rather than added —
                // same rule as the client portal's flattenGstMatrix().
                'Total' => $taxInvoices + $billOfSupply + $debitNotes - $creditNotes,
            ];
        }

        return $out;
    }

    private function gstSummaryMatrixFirm($base): array
    {
        $bucket = function (string $type) use ($base): array {
            $scope = (clone $base)->where('type', $type)->where('status', 'issued');

            return [
                'taxable_value' => (float) (clone $scope)->sum('taxable_amount'),
                'cgst' => (float) (clone $scope)->sum('cgst_amount'),
                'sgst' => (float) (clone $scope)->sum('sgst_amount'),
                'igst' => (float) (clone $scope)->sum('igst_amount'),
                'total_invoice_value' => (float) (clone $scope)->sum(DB::raw('COALESCE(NULLIF(grand_total,0), total_amount)')),
            ];
        };

        $tax = $bucket('tax_invoice');
        $bos = $bucket('bill_of_supply');
        $dn = $bucket('debit_note');
        $cn = $bucket('credit_note');

        return [
            'matrix' => [
                'tax_invoice' => $tax,
                'bill_of_supply' => $bos,
                'debit_note' => $dn,
                'credit_note' => $cn,
            ],
            'taxable' => $tax['taxable_value'],
            'cgst' => $tax['cgst'],
            'sgst' => $tax['sgst'],
            'igst' => $tax['igst'],
            'total' => $tax['total_invoice_value'],
        ];
    }

    public function loginHistory(Request $request, int $id)
    {
        $profile = ClientProfile::findOrFail($id);
        $logs = ActivityLog::where('user_id', $profile->user_id)
            ->where('action', 'login')
            ->latest()
            ->paginate(50);

        return response()->json($logs);
    }

    public function updateClient(Request $request, int $id)
    {
        $profile = ClientProfile::with('user')->findOrFail($id);
        $data = $request->validate([
            'business_name' => 'sometimes|string',
            'gstin' => 'nullable|string',
            'pan' => 'nullable|string',
            'email' => 'nullable|email',
            'name' => 'sometimes|string',
            'phone' => 'nullable|string',
            'address' => 'nullable|string',
            'city' => 'nullable|string',
        ]);
        if (isset($data['name']) || array_key_exists('phone', $data)) {
            $profile->user->update(array_filter([
                'name' => $data['name'] ?? null,
                'phone' => $data['phone'] ?? null,
            ], fn ($v) => $v !== null));
        }
        $profile->update(collect($data)->only(['business_name', 'gstin', 'pan', 'email', 'address', 'city'])->toArray());

        return response()->json($profile->fresh()->load('user'));
    }
}
