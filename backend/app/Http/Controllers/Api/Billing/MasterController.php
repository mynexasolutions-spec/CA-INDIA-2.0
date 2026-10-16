<?php

namespace App\Http\Controllers\Api\Billing;

use App\Http\Controllers\Controller;
use App\Models\CommercialDocument;
use App\Models\Customer;
use App\Models\HsnSacCode;
use App\Models\Product;
use App\Models\TdsTcsSection;
use App\Services\Billing\BillingPolicy;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class MasterController extends Controller
{
    private function profileId(Request $request): int
    {
        $profile = $request->user()->clientProfile;
        abort_unless($profile, 403, 'No client billing profile');

        return $profile->id;
    }

    private const GSTIN_REGEX = '/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/';

    public function gstinLookup(Request $request)
    {
        $gstin = strtoupper(trim($request->input('gstin', '')));

        if (!preg_match('/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/', $gstin)) {
            return response()->json(['error' => 'Invalid GSTIN format. Please enter a valid 15-digit GSTIN.'], 422);
        }

        try {
            // Use the public GST search API (no credentials needed for basic taxpayer lookup).
            $url = "https://sheet.gst.gov.in/api/getGSTINDetails?gstin={$gstin}";
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT        => 10,
                CURLOPT_HTTPHEADER     => ['Accept: application/json'],
            ]);
            $raw    = curl_exec($ch);
            $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $err    = curl_error($ch);
            curl_close($ch);

            if ($err) throw new \RuntimeException("Network error: {$err}");

            $body = json_decode($raw, true);

            // Fallback to taxpayer search API if first one fails or returns no data
            if ($status !== 200 || empty($body) || isset($body['error'])) {
                $url2 = "https://api.gst.gov.in/commonapi/v1.1/search?action=TP&gstin={$gstin}";
                $ch2 = curl_init($url2);
                curl_setopt_array($ch2, [
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_TIMEOUT        => 10,
                    CURLOPT_HTTPHEADER     => ['Accept: application/json'],
                ]);
                $raw2    = curl_exec($ch2);
                $status2 = curl_getinfo($ch2, CURLINFO_HTTP_CODE);
                curl_close($ch2);
                if ($status2 === 200) { $body = json_decode($raw2, true); $status = $status2; }
            }

            if ($status === 404 || (isset($body['statusCode']) && $body['statusCode'] === '404')) {
                return response()->json(['error' => 'GSTIN not found. Please check and try again.'], 404);
            }

            // Normalise across both API response shapes
            $sts   = strtolower($body['sts'] ?? $body['status'] ?? '');
            if ($sts && !in_array($sts, ['active', 'act'])) {
                return response()->json(['error' => "GSTIN status is '{$sts}'. Only active GSTINs are accepted."], 422);
            }

            $addr  = $body['pradr']['addr'] ?? $body['pradr'] ?? [];
            $parts = array_filter([$addr['bnm'] ?? '', $addr['st'] ?? '', $addr['loc'] ?? '', $addr['dst'] ?? '', $addr['stcd'] ?? '', $addr['pncd'] ?? '']);
            $address = implode(', ', $parts);

            $stateCode = substr($gstin, 0, 2);
            $stateName = $body['pradr']['addr']['stcd'] ?? $body['stj'] ?? '';

            return response()->json([
                'gstin'        => $gstin,
                'legal_name'   => $body['lgnm'] ?? $body['taxpayerInfo']['lgnm'] ?? '',
                'trade_name'   => $body['tradeNam'] ?? $body['tradeName'] ?? '',
                'status'       => $sts ?: 'active',
                'state_code'   => $stateCode,
                'state'        => $stateName,
                'address'      => $address,
                'business_type' => $body['ctb'] ?? '',
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'GST lookup failed. Please try again or enter details manually.'], 503);
        }
    }

    public function parties(Request $request)
    {
        $q = Customer::where('client_profile_id', $this->profileId($request))->latest();
        if ($request->filled('q')) {
            $s = $request->q;
            $q->where(function ($w) use ($s) {
                $w->where('name', 'like', "%{$s}%")
                    ->orWhere('gstin', 'like', "%{$s}%")
                    ->orWhere('phone', 'like', "%{$s}%");
            });
        }
        if ($request->filled('state')) {
            $q->where('state', $request->state);
        }
        if ($request->filled('gst_status')) {
            $q->where('gst_status', $request->gst_status);
        }
        // status=active|archived limits by archive state; omitted = legacy behaviour (all).
        if ($request->input('status') === 'active') {
            $q->where('is_active', true);
        } elseif ($request->input('status') === 'archived') {
            $q->where('is_active', false);
        }

        return response()->json($q->paginate(min(100, max(1, (int) $request->input('per_page', 10)))));
    }

    /** Last few distinct active parties the client actually invoiced (for the invoice dropdown). */
    public function recentParties(Request $request)
    {
        $profileId = $this->profileId($request);
        $ids = CommercialDocument::where('client_profile_id', $profileId)
            ->whereNotNull('customer_id')
            ->orderByDesc('id')
            ->limit(100)
            ->pluck('customer_id')
            ->unique()
            ->values();

        $parties = Customer::where('client_profile_id', $profileId)
            ->where('is_active', true)
            ->whereIn('id', $ids)
            ->get()
            ->sortBy(fn ($c) => $ids->search($c->id))
            ->take(5)
            ->values();

        return response()->json(['data' => $parties]);
    }

    /** Archive a party that has documents (history stays intact); hard-delete one that has none. */
    public function destroyParty(Request $request, int $id)
    {
        $profileId = $this->profileId($request);
        $c = Customer::where('client_profile_id', $profileId)->findOrFail($id);

        $used = CommercialDocument::where('client_profile_id', $profileId)->where('customer_id', $c->id)->exists();
        if ($used) {
            $c->update(['is_active' => false]);

            return response()->json(['archived' => true, 'message' => 'This party has invoices/documents, so it was archived instead of deleted. It no longer appears in the invoice dropdown.']);
        }

        $c->delete();

        return response()->json(['deleted' => true, 'message' => 'Party deleted.']);
    }

    public function restoreParty(Request $request, int $id)
    {
        $c = Customer::where('client_profile_id', $this->profileId($request))->findOrFail($id);
        $c->update(['is_active' => true]);

        return response()->json($c);
    }

    private function findDuplicate(int $profileId, array $data, ?int $ignoreId = null): ?Customer
    {
        $branch = strtolower(trim((string) ($data['branch_name'] ?? '')));
        $name = strtolower(trim((string) $data['name']));
        $gstin = strtoupper(trim((string) ($data['gstin'] ?? '')));

        return Customer::where('client_profile_id', $profileId)
            ->where('is_active', true)
            ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
            ->where(function ($q) use ($name, $gstin) {
                $q->whereRaw('LOWER(TRIM(name)) = ?', [$name]);
                if ($gstin !== '') {
                    $q->orWhere('gstin', $gstin);
                }
            })
            ->get()
            ->first(fn ($c) => strtolower(trim((string) $c->branch_name)) === $branch);
    }

    private function partyRules(): array
    {
        return [
            'name' => 'required|string|max:200',
            'proprietor_name' => 'required|string|max:200',
            'contact_person' => 'nullable|string|max:120',
            'email' => 'nullable|email',
            'phone' => 'nullable|string|max:20',
            'gst_status' => 'required|in:registered,unregistered',
            'gstin' => ['required_if:gst_status,registered', 'nullable', 'string', 'regex:'.self::GSTIN_REGEX],
            'state_code' => 'required|string|max:2',
            'state' => 'required|string|max:80',
            'billing_address' => 'required|string|max:100',
            'shipping_address' => 'nullable|string|max:100',
            'branch_name' => 'nullable|string|max:100',
        ];
    }

    private function normalizeGstFields(array $data): array
    {
        if (($data['gst_status'] ?? null) === 'unregistered') {
            $data['gstin'] = null;
        }

        return $data;
    }

    public function storeParty(Request $request)
    {
        $data = $this->normalizeGstFields($request->validate($this->partyRules()));
        $data['client_profile_id'] = $this->profileId($request);

        if (! $request->boolean('confirm_duplicate')) {
            $dup = $this->findDuplicate($data['client_profile_id'], $data);
            if ($dup) {
                return response()->json([
                    'duplicate' => true,
                    'message' => "A party \"{$dup->name}\"".($dup->gstin ? " (GSTIN {$dup->gstin})" : '').' already exists. Create another one anyway?',
                ], 409);
            }
        }

        return response()->json(Customer::create($data), 201);
    }

    public function updateParty(Request $request, int $id)
    {
        $c = Customer::where('client_profile_id', $this->profileId($request))->findOrFail($id);
        $data = $this->normalizeGstFields($request->validate($this->partyRules()));
        $c->update($data + $request->only(['is_active']));

        return response()->json($c);
    }

    public function showParty(Request $request, int $id)
    {
        return response()->json(
            Customer::where('client_profile_id', $this->profileId($request))->findOrFail($id)
        );
    }

    /** @deprecated alias */
    public function customers(Request $request)
    {
        return $this->parties($request);
    }

    public function storeCustomer(Request $request)
    {
        return $this->storeParty($request);
    }

    public function updateCustomer(Request $request, int $id)
    {
        return $this->updateParty($request, $id);
    }

    public function products(Request $request)
    {
        return response()->json(
            Product::where('client_profile_id', $this->profileId($request))->latest()->paginate(50)
        );
    }

    public function storeProduct(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string',
            'sku' => 'nullable|string',
            'hsn_sac' => ['nullable', 'string', Rule::exists('hsn_sac_codes', 'code')],
            'gst_rate' => ['nullable', 'numeric', Rule::in(BillingPolicy::GST_RATES)],
            'unit' => 'nullable|string',
            'sale_price' => 'nullable|numeric',
            'description' => 'nullable|string',
        ]);
        $data['client_profile_id'] = $this->profileId($request);

        return response()->json(Product::create($data), 201);
    }

    public function updateProduct(Request $request, int $id)
    {
        $p = Product::where('client_profile_id', $this->profileId($request))->findOrFail($id);
        $data = $request->validate([
            'name' => 'sometimes|string',
            'sku' => 'nullable|string',
            'hsn_sac' => ['nullable', 'string', Rule::exists('hsn_sac_codes', 'code')],
            'gst_rate' => ['nullable', 'numeric', Rule::in(BillingPolicy::GST_RATES)],
            'unit' => 'nullable|string',
            'sale_price' => 'nullable|numeric',
            'description' => 'nullable|string',
            'is_active' => 'boolean',
        ]);
        $p->update($data);

        return response()->json($p);
    }

    /**
     * Search the official government HSN / SAC master.
     * Only codes present here may be used on documents.
     */
    public function hsnSacCodes(Request $request)
    {
        $search = trim((string) $request->input('q', ''));
        $type = $request->input('type');

        $query = HsnSacCode::query();

        if (in_array($type, ['hsn', 'sac'], true)) {
            $query->where('type', $type);
        }

        if ($search !== '') {
            $query->where(function ($w) use ($search) {
                $w->where('code', 'like', $search.'%')
                    ->orWhere('description', 'like', '%'.$search.'%');
            });
            // Exact-prefix code matches first, then shortest (chapter-level) codes.
            $query->orderByRaw('CASE WHEN code LIKE ? THEN 0 ELSE 1 END', [$search.'%']);
        }

        $rows = $query->orderBy('code_length')
            ->orderBy('code')
            ->limit(40)
            ->get(['type', 'code', 'description']);

        return response()->json(['data' => $rows]);
    }

    /** Active TDS/TCS sections for the create-document dropdown. */
    public function tdsTcsSections(Request $request)
    {
        $type = $request->input('type');
        $q = TdsTcsSection::where('is_active', true)->orderBy('sort_order')->orderBy('code');
        if (in_array($type, ['tds', 'tcs'], true)) {
            $q->where('type', $type);
        }

        return response()->json(['data' => $q->get(['id', 'type', 'code', 'description', 'rate'])]);
    }

    /** Validate a single code against the government master. */
    public function verifyHsnSac(Request $request)
    {
        $code = trim((string) $request->input('code', ''));
        $row = $code === '' ? null : HsnSacCode::where('code', $code)->first(['type', 'code', 'description']);

        return response()->json([
            'valid' => (bool) $row,
            'match' => $row,
        ]);
    }
}
