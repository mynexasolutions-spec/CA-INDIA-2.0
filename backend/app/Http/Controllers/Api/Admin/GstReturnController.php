<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClientGstReturn;
use App\Models\ClientProfile;
use App\Models\CommercialDocument;
use App\Models\DocumentLineItem;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\DB;

class GstReturnController extends Controller
{
    /**
     * Dashboard Overview (Cards)
     */
    public function dashboard(Request $request)
    {
        $month = $request->input('month', now()->format('Y-m')); // e.g. "2026-04"
        $quarter = $request->input('quarter', now()->year . '-Q' . ceil(now()->month / 3)); // e.g. "2026-Q1"

        // Overall summary
        $totalGstClients = ClientProfile::where('has_gst', true)->count();
        $regularClients = ClientProfile::where('dealer_type', 'regular')->where('has_gst', true)->count();
        $compositionClients = ClientProfile::where('dealer_type', 'composition')->where('has_gst', true)->count();

        // Monthly Stats
        $monthlyClientsCount = ClientProfile::where('has_gst', true)->where('gst_filing_frequency', 'monthly')->count();
        $monthlyFiledCount = ClientGstReturn::where('tax_period', $month)
            ->where('return_type', ClientGstReturn::TYPE_GSTR3B)
            ->whereHas('clientProfile', fn($q) => $q->where('gst_filing_frequency', 'monthly'))
            ->count();
        $monthlyPendingCount = max(0, $monthlyClientsCount - $monthlyFiledCount);

        // Quarterly Stats
        $quarterlyClientsCount = ClientProfile::where('has_gst', true)->where('gst_filing_frequency', 'quarterly')->count();
        $quarterlyFiledCount = ClientGstReturn::where('tax_period', $quarter)
            ->where('return_type', ClientGstReturn::TYPE_GSTR3B)
            ->whereHas('clientProfile', fn($q) => $q->where('gst_filing_frequency', 'quarterly'))
            ->count();
        $quarterlyPendingCount = max(0, $quarterlyClientsCount - $quarterlyFiledCount);

        return response()->json([
            'overall' => [
                'total' => $totalGstClients,
                'regular' => $regularClients,
                'composition' => $compositionClients,
                'total_filed' => $monthlyFiledCount + $quarterlyFiledCount,
                'total_pending' => $monthlyPendingCount + $quarterlyPendingCount,
            ],
            'monthly' => [
                'period' => $month,
                'total' => $monthlyClientsCount,
                'filed' => $monthlyFiledCount,
                'pending' => $monthlyPendingCount,
            ],
            'quarterly' => [
                'period' => $quarter,
                'total' => $quarterlyClientsCount,
                'filed' => $quarterlyFiledCount,
                'pending' => $quarterlyPendingCount,
            ]
        ]);
    }

    /**
     * Client List for a specific period
     */
    public function index(Request $request)
    {
        $period = $request->input('period'); // "2026-04"
        $returnType = in_array($request->input('return_type'), ClientGstReturn::TYPES, true)
            ? $request->input('return_type')
            : ClientGstReturn::TYPE_GSTR3B;

        $q = ClientProfile::query()
            ->where('has_gst', true)
            ->with(['gstReturns' => function($q) use ($period, $returnType) {
                $q->where('return_type', $returnType);
                if ($period) {
                    $q->where('tax_period', $period);
                } else {
                    $q->latest('tax_period')->limit(1); // just get the most recent
                }
            }]);

        if ($request->filled('registration_type')) {
            $q->where('dealer_type', $request->registration_type);
        }

        if ($request->filled('frequency')) {
            $q->where('gst_filing_frequency', $request->frequency);
        }

        if ($request->filled('q')) {
            $search = $request->q;
            $q->where(fn($w) => $w->where('client_name', 'like', "%{$search}%")
                                  ->orWhere('business_name', 'like', "%{$search}%")
                                  ->orWhere('gstin', 'like', "%{$search}%"));
        }

        $clients = $q->orderBy('business_name')->paginate(25);

        // Transform results to add status
        $clients->getCollection()->transform(function ($client) use ($period, $returnType) {
            $filed = $client->gstReturns->firstWhere('tax_period', $period);
            $lastFiled = $client->gstReturns->sortByDesc('tax_period')->first();

            return [
                'id' => $client->id,
                'business_name' => $client->business_name,
                'client_name' => $client->client_name,
                'gstin' => $client->gstin,
                'registration_type' => $client->dealer_type,
                'frequency' => $client->gst_filing_frequency,
                'is_qrmp' => $this->isQrmp($client),
                'return_type' => $returnType,
                'status' => $filed ? 'filed' : 'pending',
                'last_filed' => $lastFiled ? $lastFiled->tax_period : null,
            ];
        });

        return response()->json($clients);
    }

    /**
     * All filing periods for a single client (FY-based)
     */
    public function clientPeriods(Request $request, int $clientId)
    {
        $returnType = $request->input('return_type', ClientGstReturn::TYPE_GSTR1);
        $client = ClientProfile::with([
            'user:id,name,is_active',
            'gstReturns' => fn($q) => $q->where('return_type', $returnType),
        ])->findOrFail($clientId);

        $now = now();
        $fyStart = $now->month >= 4 ? $now->year : $now->year - 1;
        $fyEnd   = $fyStart + 1;

        $frequency = $client->gstr1_filing_frequency ?? $client->gst_filing_frequency ?? 'monthly';

        // Build 12 monthly periods Apr–Mar
        $periods = [];
        for ($offset = 0; $offset < 12; $offset++) {
            $month = (($offset + 3) % 12) + 1; // 4,5,...,12,1,2,3
            $year  = $month >= 4 ? $fyStart : $fyEnd;

            $periodKey = sprintf('%04d-%02d', $year, $month);

            // Due date: 11th of following month
            $dueCarbon = \Carbon\Carbon::create($year, $month, 1)->addMonthNoOverflow()->setDay($this->gstr1DueDay($client));
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
                'label'    => \Carbon\Carbon::create($year, $month, 1)->format('M Y'),
                'due_date' => $dueDateLabel,
                'status'   => $status,
                'filed_on' => $filed?->filed_on?->format('d M Y'),
                'arn'      => $filed?->ack_no,
            ];
        }

        $lastFiled = $client->gstReturns->sortByDesc('tax_period')->first();

        $notFiled   = collect($periods)->where('status', '!=', 'filed')->values();
        $currentDue = $notFiled->get(0);
        $nextDue    = $notFiled->get(1);

        return response()->json([
            'client' => [
                'id'               => $client->id,
                'client_code'      => $client->client_code,
                'business_name'    => $client->business_name ?? $client->client_name,
                'gstin'            => $client->gstin,
                'dealer_type'      => $client->dealer_type,
                'filing_frequency' => $frequency,
                'filing_frequency_label' => $this->filingFrequencyLabel($client),
                'is_qrmp'          => $this->isQrmp($client),
                'is_active'        => $client->user?->is_active ?? true,
            ],
            'last_filed' => $lastFiled ? [
                'tax_period' => \Carbon\Carbon::createFromFormat('Y-m', $lastFiled->tax_period)->format('M Y'),
                'filed_on'   => $lastFiled->filed_on?->format('d M Y'),
                'arn'        => $lastFiled->ack_no,
                'status'     => $lastFiled->status ?? 'filed',
            ] : null,
            'upcoming_due_dates' => [
                'current' => is_array($currentDue) ? ($currentDue['due_date'] ?? null) : null,
                'next'    => is_array($nextDue)    ? ($nextDue['due_date']    ?? null) : null,
            ],
            'fy'      => $fyStart . '-' . substr($fyEnd, 2),
            'periods' => $periods,
        ]);
    }


    /**
     * Review data for a single period (document summary + HSN/SAC)
     */
    public function reviewPeriod(Request $request, int $clientId, string $period)
    {
        $returnType = $request->input('return_type', ClientGstReturn::TYPE_GSTR1);
        $client = ClientProfile::with(['user:id,name,is_active'])->findOrFail($clientId);

        // Parse period month boundaries
        [$yr, $mo] = explode('-', $period);
        $startDate = \Carbon\Carbon::create((int)$yr, (int)$mo, 1)->startOfMonth();
        $endDate   = $startDate->copy()->endOfMonth();

        // Due date: 11th of next month
        $dueDate = $startDate->copy()->addMonthNoOverflow()->setDay($this->gstr1DueDay($client))->format('d M Y');
        $periodLabel = $startDate->format('F Y');

        // Filed status
        $filedReturn = ClientGstReturn::where('client_profile_id', $clientId)
            ->where('tax_period', $period)
            ->where('return_type', $returnType)
            ->first();

        $docTypes = ['tax_invoice' => 'Tax Invoice', 'bill_of_supply' => 'Bill of Supply', 'debit_note' => 'Debit Note', 'credit_note' => 'Credit Note'];

        // Document type summary
        $docs = CommercialDocument::where('client_profile_id', $clientId)
            ->whereBetween('document_date', [$startDate, $endDate])
            ->whereIn('type', array_keys($docTypes))
            ->select('type','number','status','taxable_amount','cgst_amount','sgst_amount','igst_amount','grand_total','cancelled_at')
            ->get();

        $docSummary = [];
        foreach ($docTypes as $key => $label) {
            $group = $docs->where('type', $key);
            if ($group->isEmpty()) continue;
            $cancelled = $group->whereNotNull('cancelled_at')->count();
            $active    = $group->whereNull('cancelled_at');
            $nums = $active->pluck('number')->filter()->sort()->values();
            $multiplier = in_array($key, ['credit_note']) ? -1 : 1;
            $docSummary[] = [
                'type'         => $label,
                'key'          => $key,
                'count'        => $group->count(),
                'taxable'      => round($active->sum('taxable_amount') * $multiplier, 2),
                'igst'         => round($active->sum('igst_amount') * $multiplier, 2),
                'cgst'         => round($active->sum('cgst_amount') * $multiplier, 2),
                'sgst'         => round($active->sum('sgst_amount') * $multiplier, 2),
                'total'        => round($active->sum('grand_total') * $multiplier, 2),
                'number_from'  => $nums->first(),
                'number_to'    => $nums->last(),
                'issued'       => $active->count(),
                'cancelled'    => $cancelled,
            ];
        }

        // HSN/SAC summary
        $hsnRows = DocumentLineItem::join('commercial_documents as cd', 'cd.id', '=', 'document_line_items.commercial_document_id')
            ->where('cd.client_profile_id', $clientId)
            ->whereBetween('cd.document_date', [$startDate, $endDate])
            ->whereIn('cd.type', array_keys($docTypes))
            ->whereNull('cd.cancelled_at')
            ->groupBy('document_line_items.hsn_sac', 'document_line_items.gst_rate', 'document_line_items.unit')
            ->select(
                'document_line_items.hsn_sac',
                'document_line_items.gst_rate',
                'document_line_items.unit',
                DB::raw('SUM(document_line_items.qty) as total_qty'),
                DB::raw('SUM(document_line_items.taxable_amount) as taxable'),
                DB::raw('SUM(document_line_items.igst_amount) as igst'),
                DB::raw('SUM(document_line_items.cgst_amount) as cgst'),
                DB::raw('SUM(document_line_items.sgst_amount) as sgst'),
                DB::raw('MAX(document_line_items.description) as description')
            )
            ->get()
            ->map(fn($r) => [
                'hsn_sac'     => $r->hsn_sac,
                // SAC codes (services) start with 99; everything else is an HSN code.
                'code_type'   => str_starts_with((string) $r->hsn_sac, '99') ? 'SAC' : 'HSN',
                'description' => $r->description,
                'gst_rate'    => (float)$r->gst_rate,
                'qty'         => round((float)$r->total_qty, 2),
                'uqc'         => $r->unit ?? 'NOS',
                'taxable'     => round((float)$r->taxable, 2),
                'igst'        => round((float)$r->igst, 2),
                'cgst'        => round((float)$r->cgst, 2),
                'sgst'        => round((float)$r->sgst, 2),
            ]);

        return response()->json([
            'client' => [
                'id'               => $client->id,
                'client_code'      => $client->client_code,
                'business_name'    => $client->business_name ?? $client->client_name,
                'gstin'            => $client->gstin,
                'dealer_type'      => $client->dealer_type,
                'filing_frequency' => $client->gstr1_filing_frequency ?? $client->gst_filing_frequency ?? 'monthly',
                'filing_frequency_label' => $this->filingFrequencyLabel($client),
                'is_qrmp'          => $this->isQrmp($client),
                'is_active'        => $client->user?->is_active ?? true,
            ],
            'period'       => $period,
            'period_label' => $periodLabel,
            'due_date'     => $dueDate,
            'filing_status' => $filedReturn ? 'filed' : 'pending',
            'filed_on'     => $filedReturn?->filed_on?->format('d M Y'),
            'arn'          => $filedReturn?->ack_no,
            'doc_summary'  => $docSummary,
            'hsn_summary'  => $hsnRows,
        ]);
    }

    /**
     * B2B document list (registered customers) for a period
     */
    public function b2bDocuments(Request $request, int $clientId, string $period)
    {
        [$yr, $mo] = explode('-', $period);
        $startDate = \Carbon\Carbon::create((int)$yr, (int)$mo, 1)->startOfMonth();
        $endDate   = $startDate->copy()->endOfMonth();

        $query = CommercialDocument::with('customer')
            ->where('client_profile_id', $clientId)
            ->whereBetween('document_date', [$startDate, $endDate])
            ->whereIn('type', $this->docTypesFrom($request))
            ->whereNull('cancelled_at')
            ->whereHas('customer', fn($q) => $q->where('gst_status', 'registered'))
            ->orderBy('document_date')->orderBy('number');

        return $this->listResponse($request, $query);
    }

    /**
     * B2C document list (unregistered customers) for a period
     */
    public function b2cDocuments(Request $request, int $clientId, string $period)
    {
        [$yr, $mo] = explode('-', $period);
        $startDate = \Carbon\Carbon::create((int)$yr, (int)$mo, 1)->startOfMonth();
        $endDate   = $startDate->copy()->endOfMonth();

        $query = CommercialDocument::with('customer')
            ->where('client_profile_id', $clientId)
            ->whereBetween('document_date', [$startDate, $endDate])
            ->whereIn('type', $this->docTypesFrom($request))
            ->whereNull('cancelled_at')
            ->where(fn($q) => $q->whereDoesntHave('customer')
                ->orWhereHas('customer', fn($q2) => $q2->where('gst_status', '!=', 'registered')))
            ->orderBy('document_date')->orderBy('number');

        return $this->listResponse($request, $query);
    }

    /**
     * B2C State-wise summary (grouped by place_of_supply + gst_rate)
     */
    public function b2cStateSummary(Request $request, int $clientId, string $period)
    {
        [$yr, $mo] = explode('-', $period);
        $startDate = \Carbon\Carbon::create((int)$yr, (int)$mo, 1)->startOfMonth();
        $endDate   = $startDate->copy()->endOfMonth();

        $rows = DocumentLineItem::join('commercial_documents as cd', 'cd.id', '=', 'document_line_items.commercial_document_id')
            ->leftJoin('customers as cu', 'cu.id', '=', 'cd.customer_id')
            ->where('cd.client_profile_id', $clientId)
            ->whereBetween('cd.document_date', [$startDate, $endDate])
            ->whereIn('cd.type', $this->docTypesFrom($request))
            ->whereNull('cd.cancelled_at')
            ->where(fn($q) => $q->whereNull('cu.id')->orWhere('cu.gst_status', '!=', 'registered'))
            ->groupBy('cd.place_of_supply', 'document_line_items.gst_rate')
            ->select(
                'cd.place_of_supply',
                'document_line_items.gst_rate',
                DB::raw('COUNT(DISTINCT cd.id) as doc_count'),
                DB::raw('SUM(document_line_items.taxable_amount) as taxable'),
                DB::raw('SUM(document_line_items.igst_amount) as igst'),
                DB::raw('SUM(document_line_items.cgst_amount) as cgst'),
                DB::raw('SUM(document_line_items.sgst_amount) as sgst'),
                DB::raw('SUM(document_line_items.taxable_amount + document_line_items.igst_amount + document_line_items.cgst_amount + document_line_items.sgst_amount) as total')
            )
            ->orderBy('cd.place_of_supply')
            ->orderByDesc('document_line_items.gst_rate')
            ->get();

        // Group by state for frontend
        $grouped = [];
        foreach ($rows as $r) {
            $state = $r->place_of_supply ?? 'Unknown';
            if (!isset($grouped[$state])) {
                $grouped[$state] = ['state' => $state, 'rates' => [], 'doc_count' => 0, 'taxable' => 0, 'igst' => 0, 'cgst' => 0, 'sgst' => 0, 'total' => 0];
            }
            $grouped[$state]['rates'][] = [
                'gst_rate'  => (float)$r->gst_rate,
                'doc_count' => (int)$r->doc_count,
                'taxable'   => round((float)$r->taxable, 2),
                'igst'      => round((float)$r->igst, 2),
                'cgst'      => round((float)$r->cgst, 2),
                'sgst'      => round((float)$r->sgst, 2),
                'total'     => round((float)$r->total, 2),
            ];
            $grouped[$state]['doc_count'] += (int)$r->doc_count;
            $grouped[$state]['taxable']   += (float)$r->taxable;
            $grouped[$state]['igst']      += (float)$r->igst;
            $grouped[$state]['cgst']      += (float)$r->cgst;
            $grouped[$state]['sgst']      += (float)$r->sgst;
            $grouped[$state]['total']     += (float)$r->total;
        }

        foreach ($grouped as &$g) {
            $g['taxable'] = round($g['taxable'], 2);
            $g['igst']    = round($g['igst'], 2);
            $g['cgst']    = round($g['cgst'], 2);
            $g['sgst']    = round($g['sgst'], 2);
            $g['total']   = round($g['total'], 2);
        }

        return response()->json(['data' => array_values($grouped)]);
    }

    /**
     * Paginated document list for the screen, or (?all=1) every row of the period for exports.
     */
    private function listResponse(Request $request, $query)
    {
        if ($request->boolean('all')) {
            return response()->json(['data' => $query->get()->map(fn($doc) => $this->formatDoc($doc))->values()]);
        }

        $docs = $query->paginate(10);
        $docs->getCollection()->transform(fn($doc) => $this->formatDoc($doc));

        return response()->json($docs);
    }

    private const GSTR1_DOC_TYPES = ['tax_invoice', 'bill_of_supply', 'debit_note', 'credit_note'];

    /**
     * Document types to list. A specific valid type filters to it; an empty / "all"
     * (the UI's placeholder state) returns every GSTR-1 document type.
     */
    private function docTypesFrom(Request $request): array
    {
        $t = $request->input('doc_type');

        return in_array($t, self::GSTR1_DOC_TYPES, true) ? [$t] : self::GSTR1_DOC_TYPES;
    }

    /**
     * QRMP = a Regular client whose GSTR-3B cycle is quarterly. GSTR-1 is still tracked
     * monthly (docs/spec: stored gstr1_filing_frequency stays 'monthly'), but the due
     * date is the 13th instead of the 11th.
     */
    private function isQrmp(ClientProfile $client): bool
    {
        return strtolower((string) $client->dealer_type) !== 'composition'
            && strtolower((string) $client->gst_filing_frequency) === 'quarterly';
    }

    private function gstr1DueDay(ClientProfile $client): int
    {
        return $this->isQrmp($client) ? 13 : 11;
    }

    private function filingFrequencyLabel(ClientProfile $client): string
    {
        return $this->isQrmp($client)
            ? 'Monthly (QRMP)'
            : ucfirst($client->gstr1_filing_frequency ?? $client->gst_filing_frequency ?? 'monthly');
    }

    private function formatDoc(CommercialDocument $doc): array
    {
        $taxable = (float)$doc->taxable_amount;
        $igst    = (float)$doc->igst_amount;
        $cgst    = (float)$doc->cgst_amount;
        $sgst    = (float)$doc->sgst_amount;
        $gstRate = $taxable > 0 ? round(($igst + $cgst + $sgst) / $taxable * 100) : 0;

        return [
            'id'              => $doc->id,
            'number'          => $doc->number,
            'document_date'   => \Carbon\Carbon::parse($doc->document_date)->format('d-m-Y'),
            'party_name'      => $doc->customer?->name ?? '—',
            'gstin'           => $doc->customer?->gstin ?? 'Unregistered',
            'place_of_supply' => $doc->place_of_supply ?? '—',
            'gst_rate'        => $gstRate,
            'taxable'         => round($taxable, 2),
            'igst'            => round($igst, 2),
            'cgst'            => round($cgst, 2),
            'sgst'            => round($sgst, 2),
            'total'           => round((float)$doc->grand_total, 2),
        ];
    }

    /**
     * Mark a return as filed (or un-filed)
     */
    public function store(Request $request, int $clientId)
    {
        $data = $request->validate([
            'tax_period'  => ['required', 'string', 'regex:/^\d{4}-\d{2}$/'],
            'return_type' => ['nullable', Rule::in(ClientGstReturn::TYPES)],
            'status'      => 'required|in:filed,pending',
            // Marking a return as filed needs both the date and the ARN.
            'filed_on'    => ['exclude_unless:status,filed', 'required', 'date'],
            'arn'         => ['exclude_unless:status,filed', 'required', 'string', 'max:50', 'regex:/\S/'],
        ], [
            'filed_on.required' => 'Filed On date is required.',
            'arn.required'      => 'ARN is required.',
            'arn.regex'         => 'ARN is required.',
        ]);
        $returnType = $data['return_type'] ?? ClientGstReturn::TYPE_GSTR1;
        $client = ClientProfile::findOrFail($clientId);

        if ($data['status'] === 'filed') {
            $filedOn = \Carbon\Carbon::parse($data['filed_on']);

            $return = ClientGstReturn::updateOrCreate(
                ['client_profile_id' => $client->id, 'tax_period' => $data['tax_period'], 'return_type' => $returnType],
                ['status' => 'filed', 'filed_on' => $filedOn, 'ack_no' => trim($data['arn']), 'filed_by' => $request->user()->id]
            );

            // Mark all documents in this period as GST filed
            [$yr, $mo] = explode('-', $data['tax_period']);
            $startDate = \Carbon\Carbon::create((int)$yr, (int)$mo, 1)->startOfMonth();
            $endDate   = $startDate->copy()->endOfMonth();

            CommercialDocument::where('client_profile_id', $client->id)
                ->whereBetween('document_date', [$startDate, $endDate])
                ->whereIn('type', ['tax_invoice', 'bill_of_supply', 'debit_note', 'credit_note'])
                ->whereNull('cancelled_at')
                ->update(['gst_filed_at' => $filedOn, 'gst_return_type' => $returnType]);

            return response()->json([
                'message'   => 'Marked as filed',
                'return'    => $return,
                'filed_on'  => $filedOn->format('d M Y'),
                'arn'       => trim($data['arn']),
            ]);
        } else {
            ClientGstReturn::where('client_profile_id', $client->id)
                ->where('tax_period', $data['tax_period'])
                ->where('return_type', $returnType)
                ->delete();

            // Unmark documents
            [$yr, $mo] = explode('-', $data['tax_period']);
            $startDate = \Carbon\Carbon::create((int)$yr, (int)$mo, 1)->startOfMonth();
            $endDate   = $startDate->copy()->endOfMonth();
            CommercialDocument::where('client_profile_id', $client->id)
                ->whereBetween('document_date', [$startDate, $endDate])
                ->whereIn('type', self::GSTR1_DOC_TYPES)
                ->where('gst_return_type', $returnType)
                ->update(['gst_filed_at' => null, 'gst_return_type' => null]);

            return response()->json(['message' => 'Marked as pending']);
        }
    }
}
