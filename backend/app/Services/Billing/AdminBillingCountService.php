<?php

namespace App\Services\Billing;

use App\Models\ClientProfile;
use App\Models\CommercialDocument;
use App\Models\Customer;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AdminBillingCountService
{
    public const MIN_START_YEAR = 2026;

    public const B2B_CONDITION_SQL = "customers.id IS NOT NULL AND LOWER(COALESCE(customers.gst_status, '')) = 'registered' AND TRIM(COALESCE(customers.gstin, '')) != ''";

    public const DOCUMENT_TYPES = [
        'tax_invoice',
        'bill_of_supply',
        'debit_note',
        'credit_note',
        'quotation',
        'delivery_challan',
    ];

    public const COUNTED_STATUSES = [
        'issued',
        'paid',
        'partial',
        'cancelled',
    ];

    public const CONSTITUTION_OPTIONS = [
        'Proprietorship',
        'Partnership Firm',
        'LLP',
        'Private Limited Company',
        'Individual',
        'One Person Company',
        'Trust',
        'Society',
    ];

    public const CONSTITUTION_ALIASES = [
        'Partnership Firm' => ['Partnership Firm', 'Partnership'],
        'Partnership' => ['Partnership Firm', 'Partnership'],
        'Private Limited Company' => ['Private Limited Company', 'Private Limited'],
        'Private Limited' => ['Private Limited Company', 'Private Limited'],
    ];

    /**
     * Validate and resolve the financial year parameter.
     *
     * @throws ValidationException
     */
    public function resolveFy(?string $fy): array
    {
        if ($fy !== null && trim($fy) !== '') {
            $fy = trim($fy);
            if (! preg_match('/^(\d{4})-(\d{2})$/', $fy, $matches)) {
                throw ValidationException::withMessages([
                    'fy' => ['Invalid Financial Year format. Expected format: YYYY-YY (e.g. 2026-27).'],
                ]);
            }

            $startYear = (int) $matches[1];
            $endYearSuffix = (int) $matches[2];
            $expectedSuffix = ($startYear + 1) % 100;

            if ($endYearSuffix !== $expectedSuffix) {
                throw ValidationException::withMessages([
                    'fy' => ["Invalid Financial Year range. For {$startYear}, expected suffix is " . sprintf('%02d', $expectedSuffix) . '.'],
                ]);
            }

            if ($startYear < self::MIN_START_YEAR) {
                throw ValidationException::withMessages([
                    'fy' => ['Financial Year cannot be earlier than ' . self::MIN_START_YEAR . '-' . sprintf('%02d', (self::MIN_START_YEAR + 1) % 100) . '.'],
                ]);
            }
        } else {
            $tz = config('app.timezone') ?: 'Asia/Kolkata';
            $now = Carbon::now($tz);
            $startYear = $now->month >= 4 ? $now->year : $now->year - 1;
            $startYear = max($startYear, self::MIN_START_YEAR);
            $fy = sprintf('%04d-%02d', $startYear, ($startYear + 1) % 100);
        }

        $from = sprintf('%04d-04-01', $startYear);
        $to = sprintf('%04d-03-31', $startYear + 1);

        return [
            'fy' => $fy,
            'start_year' => $startYear,
            'from' => $from,
            'to' => $to,
        ];
    }

    /**
     * Global count across all clients in the FY for the top 6 cards.
     */
    public function getGlobalCardCounts(string $from, string $to): array
    {
        $rows = CommercialDocument::query()
            ->whereBetween('document_date', [$from, $to])
            ->whereIn('status', self::COUNTED_STATUSES)
            ->whereIn('type', self::DOCUMENT_TYPES)
            ->select('type', DB::raw('count(*) as aggregate_count'))
            ->groupBy('type')
            ->pluck('aggregate_count', 'type')
            ->all();

        $counts = [];
        foreach (self::DOCUMENT_TYPES as $type) {
            $counts[$type] = (int) ($rows[$type] ?? 0);
        }

        return $counts;
    }

    /**
     * Client-specific dashboard counts: 7 cards, donut, and 12-month trend.
     */
    public function getClientDashboardData(int $clientProfileId, int $startYear, string $from, string $to): array
    {
        // 1. Counts per document type
        $rows = CommercialDocument::query()
            ->where('client_profile_id', $clientProfileId)
            ->whereBetween('document_date', [$from, $to])
            ->whereIn('status', self::COUNTED_STATUSES)
            ->whereIn('type', self::DOCUMENT_TYPES)
            ->select('type', DB::raw('count(*) as aggregate_count'))
            ->groupBy('type')
            ->pluck('aggregate_count', 'type')
            ->all();

        $cards = [];
        $total = 0;
        foreach (self::DOCUMENT_TYPES as $type) {
            $c = (int) ($rows[$type] ?? 0);
            $cards[$type] = $c;
            $total += $c;
        }
        $cards['total'] = $total;

        // 2. Donut breakdown
        $donut = [];
        foreach (self::DOCUMENT_TYPES as $type) {
            $donut[] = [
                'type' => $type,
                'count' => $cards[$type],
            ];
        }

        // 3. 12-month document trend (DB-portable)
        $dailyDocs = CommercialDocument::query()
            ->where('client_profile_id', $clientProfileId)
            ->whereBetween('document_date', [$from, $to])
            ->whereIn('status', self::COUNTED_STATUSES)
            ->whereIn('type', self::DOCUMENT_TYPES)
            ->select('document_date', 'type', DB::raw('count(*) as count'))
            ->groupBy('document_date', 'type')
            ->get();

        // Bucket by YYYY-MM
        $bucketed = [];
        foreach ($dailyDocs as $row) {
            $monthKey = substr((string) $row->document_date, 0, 7);
            if (! isset($bucketed[$monthKey])) {
                $bucketed[$monthKey] = [
                    'count' => 0,
                    'types' => array_fill_keys(self::DOCUMENT_TYPES, 0),
                ];
            }
            $cnt = (int) $row->count;
            $bucketed[$monthKey]['count'] += $cnt;
            if (isset($bucketed[$monthKey]['types'][$row->type])) {
                $bucketed[$monthKey]['types'][$row->type] += $cnt;
            }
        }

        // Generate full 12 months (April of startYear through March of startYear + 1)
        $monthlyTrend = [];
        for ($i = 0; $i < 12; $i++) {
            $monthNum = ($i + 4) <= 12 ? ($i + 4) : ($i + 4 - 12);
            $yearNum = ($i + 4) <= 12 ? $startYear : ($startYear + 1);
            $monthKey = sprintf('%04d-%02d', $yearNum, $monthNum);

            $dateObj = Carbon::create($yearNum, $monthNum, 1);
            $monthData = $bucketed[$monthKey] ?? [
                'count' => 0,
                'types' => array_fill_keys(self::DOCUMENT_TYPES, 0),
            ];

            $monthlyTrend[] = [
                'month' => $monthKey,
                'label' => $dateObj->format('M Y'),
                'short_month' => $dateObj->format('M'),
                'year' => $yearNum,
                'count' => $monthData['count'],
                'types' => $monthData['types'],
            ];
        }

        return [
            'cards' => $cards,
            'donut' => $donut,
            'total' => $total,
            'monthly_trend' => $monthlyTrend,
        ];
    }

    /**
     * Clean address formatting with no stray dashes.
     */
    public function formatAddress(ClientProfile $profile): ?string
    {
        $parts = array_filter([
            trim((string) $profile->address_line_1),
            trim((string) $profile->address_line_2),
            trim((string) $profile->city),
        ], fn ($v) => $v !== '');

        $state = trim((string) $profile->state);
        $pincode = trim((string) $profile->pincode);

        if ($state !== '' && $pincode !== '') {
            $parts[] = "{$state} - {$pincode}";
        } elseif ($state !== '') {
            $parts[] = $state;
        } elseif ($pincode !== '') {
            $parts[] = $pincode;
        }

        if (! empty($parts)) {
            return implode(', ', $parts);
        }

        $legacy = trim((string) $profile->address);
        return $legacy !== '' ? $legacy : null;
    }

    /**
     * Mask GST fields when GST is OFF.
     */
    public function maskGstFields(ClientProfile $profile): array
    {
        if (! $profile->has_gst) {
            return [
                'has_gst' => false,
                'gstin' => null,
                'registration_type' => null,
            ];
        }

        $regType = $profile->registration_type;
        if (! $regType && $profile->dealer_type) {
            $regType = ucfirst($profile->dealer_type);
        }

        return [
            'has_gst' => true,
            'gstin' => $profile->gstin,
            'registration_type' => $regType,
        ];
    }

    /**
     * Check whether a customer is B2B according to Decision 13 / Rule 2:
     * Registered GST status AND non-empty GSTIN.
     */
    public static function isB2b(?Customer $customer): bool
    {
        return $customer !== null
            && strtolower(trim((string) $customer->gst_status)) === 'registered'
            && trim((string) $customer->gstin) !== '';
    }

    /**
     * Cards and tab counts (Total / B2B / B2C / Cancelled / Deleted) for a specific client, docType, and FY.
     * Depends only on client + docType + FY (document_date), NOT on search or date filters.
     * B2B + B2C = Total.
     */
    public function getDocumentCards(int $clientProfileId, string $type, string $from, string $to): array
    {
        $b2bSql = self::B2B_CONDITION_SQL;

        $activeAndCancelled = CommercialDocument::query()
            ->leftJoin('customers', 'commercial_documents.customer_id', '=', 'customers.id')
            ->where('commercial_documents.client_profile_id', $clientProfileId)
            ->where('commercial_documents.type', $type)
            ->whereBetween('commercial_documents.document_date', [$from, $to . ' 23:59:59'])
            ->whereIn('commercial_documents.status', ['issued', 'paid', 'partial', 'cancelled'])
            ->selectRaw("
                COUNT(*) as total_count,
                SUM(CASE WHEN commercial_documents.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count,
                SUM(CASE WHEN {$b2bSql} THEN 1 ELSE 0 END) as b2b_count,
                SUM(CASE WHEN NOT ({$b2bSql}) THEN 1 ELSE 0 END) as b2c_count
            ")
            ->first();

        $deletedCount = CommercialDocument::onlyTrashed()
            ->where('client_profile_id', $clientProfileId)
            ->where('type', $type)
            ->whereBetween('document_date', [$from, $to . ' 23:59:59'])
            ->where('status', 'deleted')
            ->count();

        $total = (int) ($activeAndCancelled->total_count ?? 0);
        $b2b = (int) ($activeAndCancelled->b2b_count ?? 0);
        $b2c = (int) ($activeAndCancelled->b2c_count ?? 0);
        $cancelled = (int) ($activeAndCancelled->cancelled_count ?? 0);

        return [
            'total' => $total,
            'b2b' => $b2b,
            'b2c' => $b2c,
            'cancelled' => $cancelled,
            'deleted' => $deletedCount,
        ];
    }

    /**
     * Build the filtered query and compute filtered_totals over the full filtered result set.
     * Returns [$query, $filteredTotals].
     *
     * @return array{0: \Illuminate\Database\Eloquent\Builder, 1: array{taxable: float, igst: float, cgst: float, sgst: float, grand_total: float}}
     */
    public function getDocumentListQueryAndTotals(
        ClientProfile $client,
        string $type,
        string $from,
        string $to,
        Request $request
    ): array {
        $b2bSql = self::B2B_CONDITION_SQL;
        $tab = strtolower(trim((string) $request->query('tab', 'all')));
        if (! in_array($tab, ['all', 'b2b', 'b2c', 'cancelled', 'deleted'], true)) {
            $tab = 'all';
        }

        $statusFilter = $request->filled('status') ? strtolower(trim((string) $request->query('status'))) : null;
        $isDeleted = ($tab === 'deleted' || $statusFilter === 'deleted');

        $query = $isDeleted
            ? CommercialDocument::onlyTrashed()->where('commercial_documents.status', 'deleted')
            : CommercialDocument::query()->whereIn('commercial_documents.status', ['issued', 'paid', 'partial', 'cancelled']);

        $query->leftJoin('customers', 'commercial_documents.customer_id', '=', 'customers.id')
            ->where('commercial_documents.client_profile_id', $client->id)
            ->where('commercial_documents.type', $type)
            ->whereBetween('commercial_documents.document_date', [$from, $to . ' 23:59:59']);

        // Tab filters
        if (! $isDeleted) {
            if ($tab === 'cancelled') {
                $query->where('commercial_documents.status', 'cancelled');
            } elseif ($tab === 'b2b') {
                $query->whereRaw($b2bSql);
            } elseif ($tab === 'b2c') {
                $query->whereRaw("NOT ({$b2bSql})");
            }

            // Status filter (when tab is not cancelled)
            if ($tab !== 'cancelled' && $statusFilter !== null && $statusFilter !== 'all') {
                if ($statusFilter === 'active') {
                    $query->whereIn('commercial_documents.status', ['issued', 'paid', 'partial']);
                } elseif ($statusFilter === 'cancelled') {
                    $query->where('commercial_documents.status', 'cancelled');
                }
            }
        }

        // Search: number, customer name, GSTIN (wildcards escaped with !)
        if ($request->filled('q')) {
            $rawQ = trim((string) $request->query('q'));
            $escaped = str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $rawQ);
            $pattern = "%{$escaped}%";
            $query->where(function ($w) use ($pattern) {
                $w->whereRaw("commercial_documents.number LIKE ? ESCAPE '!'", [$pattern])
                    ->orWhereRaw("customers.name LIKE ? ESCAPE '!'", [$pattern])
                    ->orWhereRaw("customers.gstin LIKE ? ESCAPE '!'", [$pattern]);
            });
        }

        // Additional date ranges (inside FY)
        if ($request->filled('invoice_date_from')) {
            $query->where('commercial_documents.document_date', '>=', $request->query('invoice_date_from'));
        }
        if ($request->filled('invoice_date_to')) {
            $query->where('commercial_documents.document_date', '<=', $request->query('invoice_date_to'));
        }

        // Creation date range (IST day boundaries)
        if ($request->filled('creation_date_from')) {
            $startUtc = Carbon::createFromFormat('Y-m-d', $request->query('creation_date_from'), 'Asia/Kolkata')->startOfDay()->utc();
            $query->where('commercial_documents.created_at', '>=', $startUtc);
        }
        if ($request->filled('creation_date_to')) {
            $endUtc = Carbon::createFromFormat('Y-m-d', $request->query('creation_date_to'), 'Asia/Kolkata')->endOfDay()->utc();
            $query->where('commercial_documents.created_at', '<=', $endUtc);
        }

        // Calculate filtered totals over the entire filtered set across all pages
        $totalsQuery = (clone $query);
        if (! $isDeleted && $tab !== 'cancelled') {
            $totalsQuery->whereIn('commercial_documents.status', ['issued', 'paid', 'partial']);
        }

        $totalsRow = $totalsQuery->selectRaw("
            COALESCE(SUM(commercial_documents.taxable_amount), 0) as taxable,
            COALESCE(SUM(commercial_documents.igst_amount), 0) as igst,
            COALESCE(SUM(commercial_documents.cgst_amount), 0) as cgst,
            COALESCE(SUM(commercial_documents.sgst_amount), 0) as sgst,
            COALESCE(SUM(COALESCE(commercial_documents.grand_total, commercial_documents.total_amount, 0)), 0) as grand_total
        ")->first();

        $filteredTotals = [
            'taxable' => round((float) ($totalsRow->taxable ?? 0), 2),
            'igst' => round((float) ($totalsRow->igst ?? 0), 2),
            'cgst' => round((float) ($totalsRow->cgst ?? 0), 2),
            'sgst' => round((float) ($totalsRow->sgst ?? 0), 2),
            'grand_total' => round((float) ($totalsRow->grand_total ?? 0), 2),
        ];

        return [$query, $filteredTotals];
    }

    /**
     * Compute View screen action flags once on backend.
     */
    public static function computeDocumentFlags(CommercialDocument $doc, array $lock): array
    {
        $isDeleted = $doc->trashed() || $doc->status === 'deleted';
        if ($isDeleted) {
            return [
                'can_edit_creation_date' => false,
                'can_cancel' => false,
                'can_delete' => false,
            ];
        }

        $isActive = in_array($doc->status, ['issued', 'paid', 'partial'], true);
        $isCancelled = $doc->status === 'cancelled';
        $isGstFiled = (bool) ($lock['is_locked'] ?? false);

        if (in_array($doc->type, ['quotation', 'delivery_challan'], true)) {
            $canCancel = $isActive && ! $doc->converted_document_id;
            $canEditCreationDate = $isActive;
            $isReferenced = CommercialDocument::where('reference_document_id', $doc->id)->exists();
            $isAttached = DB::table('gst_filing_request_document')->where('commercial_document_id', $doc->id)->exists();
            $canDelete = ($isActive || $isCancelled) && ! $isReferenced && ! $isAttached;

            return [
                'can_edit_creation_date' => $canEditCreationDate,
                'can_cancel' => $canCancel,
                'can_delete' => $canDelete,
            ];
        }

        $canEditCreationDate = $isActive && ! $isGstFiled;
        $canCancel = $isActive && ! $isGstFiled;

        $isReferenced = CommercialDocument::where('reference_document_id', $doc->id)->exists();
        $isAttached = DB::table('gst_filing_request_document')->where('commercial_document_id', $doc->id)->exists();

        $canDelete = ($isActive || $isCancelled) && ! $isGstFiled && ! $isReferenced && ! $isAttached;

        return [
            'can_edit_creation_date' => $canEditCreationDate,
            'can_cancel' => $canCancel,
            'can_delete' => $canDelete,
        ];
    }

    /**
     * Format seller block reusing 2B PDF seller data.
     */
    public function formatSeller(ClientProfile $profile): array
    {
        return \App\Services\DocumentTemplate\DocumentPayloadBuilder::buildSeller($profile);
    }
}
