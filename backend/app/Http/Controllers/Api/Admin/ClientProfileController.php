<?php

namespace App\Http\Controllers\Api\Admin;

use App\Support\ExcelExport;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\ClientProfile;
use App\Models\CommercialDocument;
use App\Models\User;
use App\Services\Billing\BillingPolicy;
use App\Services\Billing\InvoiceService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use ZipArchive;

class ClientProfileController extends Controller
{
    private const ENCRYPTED = ['gst_portal_password', 'tan_portal_password', 'it_portal_password'];

    /** Fixed domain half of every client login email — the admin only ever chooses the
     * part before the @, here on the server so it can never be overridden via the API. */
    private const LOGIN_EMAIL_DOMAIN = 'abkhanassociates.com';

    private function assertClientsUnlocked(Request $request): void
    {
        abort_unless(
            ClientsUnlockController::isUnlocked($request->user()->id),
            403,
            'Clients module is locked. Enter your administrator password to continue.'
        );
    }

    public function index(Request $request)
    {
        // `directory=1` is the light, read-only client picker used by GST Compliance, Reports and
        // Sub-User assignment. It returns only non-sensitive columns, so it does not need the
        // Clients-module unlock (that gate protects the full client records and Manage Client).
        $directory = $request->boolean('directory');
        if (! $directory) {
            $this->assertClientsUnlocked($request);
        }
        $q = $directory
            ? ClientProfile::select(['id', 'user_id', 'client_code', 'client_name', 'business_name', 'gstin', 'pan', 'has_gst', 'dealer_type', 'gst_filing_frequency', 'gstr1_filing_frequency', 'created_at'])
                ->with('user:id,is_active')
            : ClientProfile::with('user:id,name,email,phone,role,is_active,created_at');

        if ($request->filled('status')) {
            $active = $request->status === 'active';
            $q->whereHas('user', fn ($u) => $u->where('is_active', $active));
        }
        if ($request->filled('constitution_type')) {
            $q->where('constitution_type', $request->constitution_type);
        }
        if ($request->filled('registration_type')) {
            match ($request->registration_type) {
                'gst' => $q->whereNotNull('gstin')->where('gstin', '!=', ''),
                'pan' => $q->whereNotNull('pan')->where('pan', '!=', ''),
                'tan' => $q->whereNotNull('tan')->where('tan', '!=', ''),
                'udyam' => $q->whereNotNull('udyam')->where('udyam', '!=', ''),
                default => null,
            };
        }
        if ($request->filled('gst_status')) {
            if ($request->gst_status === 'registered') {
                $q->where(fn ($w) => $w->where('has_gst', 1)->orWhere(fn ($sq) => $sq->whereNotNull('gstin')->where('gstin', '!=', '')));
            } elseif ($request->gst_status === 'unregistered') {
                $q->where(fn ($w) => $w->where(fn ($sq) => $sq->where('has_gst', 0)->orWhereNull('has_gst'))->where(fn ($sq) => $sq->whereNull('gstin')->orWhere('gstin', '')));
            }
        }
        if ($request->filled('dealer_type')) {
            $q->where('dealer_type', $request->dealer_type);
        }
        if ($request->filled('gst_filing_frequency')) {
            $q->where('gst_filing_frequency', $request->gst_filing_frequency);
        }
        if ($request->filled('registered_from')) {
            $q->whereDate('created_at', '>=', $request->registered_from);
        }
        if ($request->filled('registered_to')) {
            $q->whereDate('created_at', '<=', $request->registered_to);
        }
        if ($request->filled('q')) {
            $s = $request->q;
            $q->where(function ($w) use ($s) {
                $w->where('client_name', 'like', "%{$s}%")
                    ->orWhere('business_name', 'like', "%{$s}%")
                    ->orWhere('client_code', 'like', "%{$s}%")
                    ->orWhere('pan', 'like', "%{$s}%")
                    ->orWhere('gstin', 'like', "%{$s}%")
                    ->orWhere('tan', 'like', "%{$s}%")
                    ->orWhere('mobile', 'like', "%{$s}%")
                    ->orWhere('email', 'like', "%{$s}%")
                    ->orWhereHas('user', fn ($u) => $u->where('name', 'like', "%{$s}%")->orWhere('email', 'like', "%{$s}%")->orWhere('phone', 'like', "%{$s}%"));
            });
        }

        $sort = $request->input('sort', 'created_at');
        $dir = $request->input('dir', 'desc');
        $allowed = ['client_name', 'business_name', 'client_code', 'created_at', 'updated_at', 'constitution_type', 'pan', 'gstin', 'mobile'];
        if (in_array($sort, $allowed, true)) {
            $q->orderBy($sort, $dir === 'asc' ? 'asc' : 'desc');
        } else {
            $q->latest();
        }

        $perPage = max(1, min(100, (int) $request->input('per_page', 10)));
        return response()->json($q->paginate($perPage));
    }

    /** Lightweight client directory for Admin Billing picker (no clients-unlock required). */
    public function billingDirectory(Request $request)
    {
        $q = ClientProfile::query()
            ->select(['id', 'business_name', 'client_name', 'client_code', 'gstin', 'has_gst', 'dealer_type', 'user_id'])
            ->with('user:id,email,is_active')
            ->latest();

        if ($request->filled('q')) {
            $s = $request->q;
            $q->where(function ($w) use ($s) {
                $w->where('business_name', 'like', "%{$s}%")
                    ->orWhere('client_name', 'like', "%{$s}%")
                    ->orWhere('client_code', 'like', "%{$s}%")
                    ->orWhere('gstin', 'like', "%{$s}%");
            });
        }

        return response()->json($q->paginate(50));
    }

    public function show(Request $request, int $id)
    {
        // `directory=1`: just the non-sensitive header fields that GST Compliance and Reports need
        // to show a client's name and billing mode. Full records still require the Clients unlock.
        if ($request->boolean('directory')) {
            $light = ClientProfile::with('user:id,is_active')->findOrFail($id);

            return response()->json($light->only([
                'id', 'user_id', 'client_code', 'client_name', 'business_name', 'gstin', 'pan', 'has_gst',
                'dealer_type', 'registration_type', 'gst_filing_frequency', 'gstr1_filing_frequency',
                'gstr2b_filing_frequency', 'gst_compliance_enabled', 'applicable_from', 'state', 'state_code',
            ]) + ['user' => $light->user?->only(['id', 'is_active'])]);
        }

        $this->assertClientsUnlocked($request);
        $profile = ClientProfile::with([
            'user:id,name,email,phone,role,is_active,password_updated_at,password_updated_by,created_at,updated_at',
            'additionalInfos',
            'bankAccounts',
            'notes',
            'documentSettings',
            'subscription',
        ])->findOrFail($id);
        $data = $profile->toArray();
        foreach (self::ENCRYPTED as $field) {
            if (! empty($data[$field])) {
                try {
                    $data[$field] = Crypt::decryptString($data[$field]);
                } catch (\Throwable) {
                    $data[$field] = null;
                }
            }
        }

        return response()->json($data);
    }

    /**
     * Permanently delete a client company and related billing data.
     * Available from Admin Settings (password confirmation required; Clients unlock not required).
     */
    public function destroy(Request $request, int $id)
    {
        $data = $request->validate([
            'password' => 'required|string',
            'confirm_name' => 'required|string',
        ]);

        if (! Hash::check($data['password'], $request->user()->password)) {
            return response()->json(['message' => 'Administrator password is incorrect.'], 422);
        }

        $profile = ClientProfile::with('user')->findOrFail($id);
        $expected = trim((string) ($profile->business_name ?: $profile->client_name));
        abort_unless(
            strcasecmp(trim($data['confirm_name']), $expected) === 0,
            422,
            'Company name confirmation does not match.'
        );

        return DB::transaction(function () use ($request, $profile) {
            $userId = $profile->user_id;
            $profileId = $profile->id;

            // Break self-references on commercial documents first
            CommercialDocument::where('client_profile_id', $profileId)->update([
                'converted_document_id' => null,
                'reference_document_id' => null,
            ]);

            $docIds = CommercialDocument::where('client_profile_id', $profileId)->pluck('id');
            if ($docIds->isNotEmpty()) {
                DB::table('document_line_items')->whereIn('commercial_document_id', $docIds)->delete();
                if (DB::getSchemaBuilder()->hasTable('document_edit_requests')) {
                    DB::table('document_edit_requests')->whereIn('commercial_document_id', $docIds)->delete();
                }
                CommercialDocument::where('client_profile_id', $profileId)->delete();
            }

            if (DB::getSchemaBuilder()->hasTable('client_change_requests')) {
                DB::table('client_change_requests')->where('client_profile_id', $profileId)->delete();
            }
            if (DB::getSchemaBuilder()->hasTable('document_edit_requests')) {
                DB::table('document_edit_requests')->where('client_profile_id', $profileId)->delete();
            }

            DB::table('customers')->where('client_profile_id', $profileId)->delete();
            DB::table('products')->where('client_profile_id', $profileId)->delete();
            if (DB::getSchemaBuilder()->hasTable('client_documents')) {
                DB::table('client_documents')->where('client_profile_id', $profileId)->delete();
            }
            if (DB::getSchemaBuilder()->hasTable('compliance_tasks')) {
                DB::table('compliance_tasks')->where('client_profile_id', $profileId)->delete();
            }
            if (DB::getSchemaBuilder()->hasTable('client_document_settings')) {
                DB::table('client_document_settings')->where('client_profile_id', $profileId)->delete();
            }
            if (DB::getSchemaBuilder()->hasTable('client_subscriptions')) {
                DB::table('client_subscriptions')->where('client_profile_id', $profileId)->delete();
            }

            foreach (['logo_path', 'signature_path', 'seal_path', 'qr_code_path'] as $asset) {
                if (! empty($profile->{$asset}) && Storage::disk('public')->exists($profile->{$asset})) {
                    Storage::disk('public')->delete($profile->{$asset});
                }
            }
            Storage::disk('public')->deleteDirectory('invoices/'.$profileId);

            $profile->delete();

            if ($userId) {
                DB::table('personal_access_tokens')->where('tokenable_id', $userId)->where('tokenable_type', User::class)->delete();
                User::where('id', $userId)->where('role', 'client')->delete();
            }

            ActivityLog::create([
                'user_id' => $request->user()->id,
                'action' => 'deleted_client',
                'subject_type' => ClientProfile::class,
                'subject_id' => $profileId,
                'ip_address' => $request->ip(),
            ]);

            return response()->json(['message' => 'Company deleted permanently.']);
        });
    }

    public function store(Request $request)
    {
        $this->assertClientsUnlocked($request);
        $data = $this->validatePayload($request, true);
        return DB::transaction(function () use ($request, $data) {
            $user = User::create([
                'name' => $data['client_name'] ?? $data['business_name'] ?? 'Client',
                'email' => $data['login_email'],
                'password' => Hash::make($data['password']),
                'phone' => $data['mobile'] ?? $data['phone'] ?? null,
                'role' => 'client',
                'is_active' => $data['is_active'] ?? true,
                'password_updated_at' => now(),
                'password_updated_by' => 'admin',
            ]);

            $profileData = $this->profileFields($data);
            $profileData['user_id'] = $user->id;
            $profileData['client_code'] = \App\Services\Client\ClientIdService::generateNext();
            $profile = ClientProfile::create($profileData);
            ClientLayoutController::initializeDefaultsForProfile($profile);
            if (!empty($profileData['bank_name']) && !empty($profileData['bank_account'])) {
                $profile->bankAccounts()->create([
                    'bank_name' => $profileData['bank_name'],
                    'account_holder_name' => $profileData['account_holder_name'] ?? $profileData['client_name'] ?? '',
                    'account_number' => $profileData['bank_account'],
                    'ifsc_code' => strtoupper($profileData['bank_ifsc'] ?? ''),
                    'branch' => $profileData['bank_branch'] ?? null,
                    'account_type' => $profileData['account_type'] ?? 'Current Account',
                    'is_primary' => true,
                    'status' => 'Active',
                ]);
            }
            $this->handleUploads($request, $profile);

            ActivityLog::create([
                'user_id' => $request->user()->id,
                'action' => 'created_client',
                'subject_type' => ClientProfile::class,
                'subject_id' => $profile->id,
                'ip_address' => $request->ip(),
            ]);

            $payload = $profile->fresh()->load('user')->toArray();
            // Shown once, never stored in readable form.
            if ($temp = $request->attributes->get('generated_password')) {
                $payload['temporary_password'] = $temp;
            }

            return response()->json($payload, 201);
        });
    }

    public function update(Request $request, int $id)
    {
        $this->assertClientsUnlocked($request);
        $profile = ClientProfile::with('user')->findOrFail($id);
        $data = $this->validatePayload($request, false, $profile);

        if ($request->has('document_numbering_settings')) {
            $settings = $request->input('document_numbering_settings');
            if (is_string($settings)) {
                $settings = json_decode($settings, true) ?: [];
            }
            if (is_array($settings)) {
                $guardResponse = $this->validateDocumentNumberingGuard($request, $profile, $settings);
                if ($guardResponse) {
                    return $guardResponse;
                }
            }
        }

        return DB::transaction(function () use ($request, $data, $profile) {
            if (isset($data['client_name']) || isset($data['mobile']) || isset($data['login_email']) || isset($data['password']) || isset($data['is_active'])) {
                $userUpdate = array_filter([
                    'name' => $data['client_name'] ?? null,
                    'email' => $data['login_email'] ?? null,
                    'phone' => $data['mobile'] ?? null,
                    'is_active' => $data['is_active'] ?? null,
                ], fn ($v) => $v !== null);
                if (! empty($data['password'])) {
                    $userUpdate['password'] = Hash::make($data['password']);
                    $userUpdate['password_updated_at'] = now();
                    $userUpdate['password_updated_by'] = 'admin';
                }
                if ($userUpdate) {
                    $profile->user->update($userUpdate);
                }
            }

            unset($data['client_code']); // Client ID is system-generated and read-only
            $profile->update($this->profileFields($data, $profile));
            $this->handleUploads($request, $profile);

            return response()->json($profile->fresh()->load('user'));
        });
    }

    /**
     * Dedicated admin endpoint to set or reset a client's password.
     */
    public function setPassword(Request $request, int $id)
    {
        $this->assertClientsUnlocked($request);
        $data = $request->validate([
            'password' => 'required|string|min:8',
        ]);

        $profile = ClientProfile::with('user')->findOrFail($id);
        $profile->user->update([
            'password' => Hash::make($data['password']),
            'password_updated_at' => now(),
            'password_updated_by' => 'admin',
        ]);

        $profile->touch();

        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'set_client_password',
            'subject_type' => User::class,
            'subject_id' => $profile->user_id,
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'message' => 'Password updated successfully.',
            'password_updated_at' => $profile->user->password_updated_at?->toIso8601String(),
            'password_updated_by' => 'admin',
        ]);
    }

    /**
     * Get dynamic GST filing frequency rules via GstPeriodService.
     */
    public function getGstFilingRules(Request $request)
    {
        $this->assertClientsUnlocked($request);
        $dealerType = $request->query('dealer_type', 'regular');
        $optOut = $request->query('opt_out', 'Monthly');
        $applicableFrom = $request->query('applicable_from');

        $rules = \App\Services\Gst\GstPeriodService::getFilingRules($dealerType, $optOut, $applicableFrom);

        return response()->json($rules);
    }

    public function billingDashboard(Request $request, int $id)
    {
        $profile = ClientProfile::findOrFail($id);
        [$from, $to] = $this->dateRange($request);

        // Listing/filtering/GST-period counting spec — Date of Creation, not the
        // document's back-dated Document Date.
        $base = CommercialDocument::where('client_profile_id', $profile->id)
            ->whereDate('created_at', '>=', $from)->whereDate('created_at', '<=', $to)
            ->where('status', 'issued')
            ->when($request->filled('document_type') && $request->document_type !== 'all', fn ($q) => $q->where('type', $request->document_type))
            ->when($request->filled('invoice_number'), fn ($q) => $q->where('number', 'like', '%'.$request->invoice_number.'%'))
            ->when($request->filled('hsn_sac'), function ($q) use ($request) {
                $q->whereHas('lineItems', fn ($li) => $li->where('hsn_sac', 'like', '%'.$request->hsn_sac.'%'));
            });

        $sum = fn ($type = null) => (clone $base)->when($type, fn ($q) => $q->where('type', $type));

        // $base mixes document types unless the caller filtered to exactly one — Credit
        // Notes reduce value, so only flip their sign when types are actually mixed; a
        // single-type view (e.g. "Credit Notes" only) should keep its own plain totals.
        $mixedTypes = ! ($request->filled('document_type') && $request->document_type !== 'all');
        $signed = fn (string $expr) => $mixedTypes
            ? "SUM(CASE WHEN type = 'credit_note' THEN -($expr) ELSE ($expr) END)"
            : "SUM($expr)";
        // Same sign rule, but unwrapped — for passing straight to Eloquent's own ->sum(),
        // which already adds its own SUM(...) around whatever expression it's given.
        $signedExpr = fn (string $expr) => $mixedTypes
            ? "CASE WHEN type = 'credit_note' THEN -($expr) ELSE ($expr) END"
            : $expr;

        $monthly = (clone $base)
            ->selectRaw(BillingPolicy::monthGroupExpr('created_at').' as month,
                SUM(CASE WHEN type = "tax_invoice" THEN 1 ELSE 0 END) as tax_invoices,
                SUM(CASE WHEN type = "bill_of_supply" THEN 1 ELSE 0 END) as bill_of_supply,
                SUM(CASE WHEN type = "debit_note" THEN 1 ELSE 0 END) as debit_notes,
                SUM(CASE WHEN type = "credit_note" THEN 1 ELSE 0 END) as credit_notes,
                COUNT(*) as total_documents,
                '.$signed('taxable_amount').' as taxable,
                '.$signed('COALESCE(NULLIF(grand_total,0), total_amount)').' as total,
                '.$signed('cgst_amount').' as cgst,
                '.$signed('sgst_amount').' as sgst,
                '.$signed('igst_amount').' as igst,
                '.$signed('cgst_amount+sgst_amount+igst_amount').' as gst')
            ->groupBy('month')->orderBy('month')->get();

        $hsn = DB::table('document_line_items as li')
            ->join('commercial_documents as d', 'd.id', '=', 'li.commercial_document_id')
            ->where('d.client_profile_id', $profile->id)
            ->whereDate('d.created_at', '>=', $from)->whereDate('d.created_at', '<=', $to)
            ->where('d.status', 'issued')
            ->select(
                'li.hsn_sac',
                DB::raw('MAX(li.description) as description'),
                DB::raw('MAX(li.unit) as uqc'),
                DB::raw('SUM(li.qty) as qty'),
                DB::raw('SUM(li.taxable_amount) as taxable'),
                DB::raw('SUM(li.cgst_amount) as cgst'),
                DB::raw('SUM(li.sgst_amount) as sgst'),
                DB::raw('SUM(li.igst_amount) as igst'),
                DB::raw('SUM(li.total_amount) as total')
            )
            ->groupBy('li.hsn_sac')->orderByDesc('total')->get();

        $yearly = (clone $base)
            ->selectRaw(BillingPolicy::yearGroupExpr('created_at').' as year, type, COUNT(*) as count, SUM(taxable_amount) as taxable, SUM(COALESCE(NULLIF(grand_total,0), total_amount)) as total, SUM(cgst_amount) as cgst, SUM(sgst_amount) as sgst, SUM(igst_amount) as igst, SUM(cgst_amount+sgst_amount+igst_amount) as gst')
            ->groupBy('year', 'type')->orderBy('year')->get();

        $typeDistribution = [
            ['type' => 'tax_invoice', 'count' => $sum('tax_invoice')->count()],
            ['type' => 'bill_of_supply', 'count' => $sum('bill_of_supply')->count()],
            ['type' => 'debit_note', 'count' => $sum('debit_note')->count()],
            ['type' => 'credit_note', 'count' => $sum('credit_note')->count()],
        ];

        $documents = (clone $base)
            ->with('customer:id,name')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get();

        $documentGroups = [
            'tax_invoices' => $documents->where('type', 'tax_invoice')->values(),
            'bill_of_supply' => $documents->where('type', 'bill_of_supply')->values(),
            'debit_notes' => $documents->where('type', 'debit_note')->values(),
            'credit_notes' => $documents->where('type', 'credit_note')->values(),
        ];

        $gstBucket = function (string $type) use ($sum): array {
            $scope = $sum($type);

            return [
                'taxable_value' => (float) (clone $scope)->sum('taxable_amount'),
                'cgst' => (float) (clone $scope)->sum('cgst_amount'),
                'sgst' => (float) (clone $scope)->sum('sgst_amount'),
                'igst' => (float) (clone $scope)->sum('igst_amount'),
                'total_invoice_value' => (float) (clone $scope)->sum(DB::raw('COALESCE(NULLIF(grand_total,0), total_amount)')),
            ];
        };

        $partyWise = (clone $base)
            ->select(
                'customer_id',
                DB::raw('COUNT(*) as invoices'),
                DB::raw($signed('taxable_amount').' as taxable'),
                DB::raw($signed('COALESCE(NULLIF(grand_total,0), total_amount)').' as total')
            )
            ->groupBy('customer_id')
            ->with('customer:id,name')
            ->orderByDesc('total')
            ->get();

        return response()->json([
            'client' => $profile->only(['id', 'client_code', 'client_name', 'business_name', 'gstin', 'has_gst', 'dealer_type']),
            'period' => ['from' => $from, 'to' => $to],
            'summary' => [
                'tax_invoices' => $sum('tax_invoice')->count(),
                'bill_of_supply' => $sum('bill_of_supply')->count(),
                'debit_notes' => $sum('debit_note')->count(),
                'credit_notes' => $sum('credit_note')->count(),
                'total_documents' => (clone $base)->count(),
                'total_invoice_value' => (float) (clone $base)->sum(DB::raw($signedExpr('COALESCE(NULLIF(grand_total,0), total_amount)'))),
                'taxable_value' => (float) (clone $base)->sum(DB::raw($signedExpr('taxable_amount'))),
                'cgst' => (float) (clone $base)->sum(DB::raw($signedExpr('cgst_amount'))),
                'sgst' => (float) (clone $base)->sum(DB::raw($signedExpr('sgst_amount'))),
                'igst' => (float) (clone $base)->sum(DB::raw($signedExpr('igst_amount'))),
                'total_gst' => (float) (clone $base)->selectRaw('SUM('.$signedExpr('cgst_amount+sgst_amount+igst_amount').') as t')->value('t'),
                'net_invoice_value' => (float) (clone $base)->sum(DB::raw($signedExpr('COALESCE(NULLIF(grand_total,0), total_amount)'))),
            ],
            'monthly' => $monthly,
            'monthly_report' => $monthly,
            'yearly' => $yearly,
            'yearly_report' => $this->yearlyTotals($yearly),
            'type_distribution' => $typeDistribution,
            'hsn_summary' => $hsn,
            'documents' => $documentGroups,
            'gst_matrix' => $this->applyDealerGstMatrix([
                'tax_invoice' => $gstBucket('tax_invoice'),
                'bill_of_supply' => $gstBucket('bill_of_supply'),
                'debit_note' => $gstBucket('debit_note'),
                'credit_note' => $gstBucket('credit_note'),
            ], $profile),
            'party_wise' => $partyWise,
        ]);
    }

    public function exportBilling(Request $request, int $id)
    {
        $profile = ClientProfile::findOrFail($id);
        [$from, $to] = $this->dateRange($request);
        $type = $request->input('type', 'invoice_register');
        $format = $request->input('format', 'xls');

        $addrParts = array_filter([$profile->address, $profile->city, trim(($profile->state ?: '').($profile->pincode ? ' - '.$profile->pincode : ''))], fn ($p) => filled($p));
        $exportMeta = [
            'name'    => $profile->business_name ?: ($profile->client_name ?: 'Business'),
            'address' => implode(', ', $addrParts),
            'pan'     => $profile->pan ?: null,
            'gstin'   => $profile->has_gst ? $profile->gstin : null,
            'phone'   => $profile->mobile ?: ($profile->user?->phone ?? null),
            'email'   => $profile->email ?: ($profile->user?->email ?? null),
        ];
        $exportTitle  = ucwords(str_replace('_', ' ', $type));
        $exportPeriod = $from.' to '.$to;

        if ($type === 'gst_summary') {
            $base = CommercialDocument::where('client_profile_id', $profile->id)
                ->whereDate('created_at', '>=', $from)->whereDate('created_at', '<=', $to)
                ->where('status', 'issued');
            $bucket = function (string $docType) use ($base): array {
                return [
                    'taxable_value' => (float) (clone $base)->where('type', $docType)->sum('taxable_amount'),
                    'cgst' => (float) (clone $base)->where('type', $docType)->sum('cgst_amount'),
                    'sgst' => (float) (clone $base)->where('type', $docType)->sum('sgst_amount'),
                    'igst' => (float) (clone $base)->where('type', $docType)->sum('igst_amount'),
                    'total_invoice_value' => (float) (clone $base)->where('type', $docType)->sum(DB::raw('COALESCE(NULLIF(grand_total,0), total_amount)')),
                ];
            };
            $matrix = $this->applyDealerGstMatrix([
                'tax_invoice' => $bucket('tax_invoice'),
                'bill_of_supply' => $bucket('bill_of_supply'),
                'debit_note' => $bucket('debit_note'),
                'credit_note' => $bucket('credit_note'),
            ], $profile);
            $keys = [
                'taxable_value' => 'Total Taxable Value',
                'cgst' => 'CGST Amount',
                'sgst' => 'SGST/UTGST Amount',
                'igst' => 'IGST Amount',
                'total_invoice_value' => 'Total Gross Value',
            ];
            $rows = [];
            foreach ($keys as $column => $label) {
                $rows[] = [
                    'Particulars' => $label,
                    'Tax Invoices' => (float) ($matrix['tax_invoice'][$column] ?? 0),
                    'Bill of Supply' => (float) ($matrix['bill_of_supply'][$column] ?? 0),
                    'Debit Notes' => (float) ($matrix['debit_note'][$column] ?? 0),
                    'Credit Notes' => (float) ($matrix['credit_note'][$column] ?? 0),
                ];
            }

            return $this->respondExport($format, $type, $rows, $exportMeta, $exportTitle, $exportPeriod);
        }

        if ($type === 'billing_summary') {
            // Every document type is mixed together per party here — Credit Notes reduce
            // a party's business value, so they're subtracted rather than added.
            $cn = fn (string $expr) => "SUM(CASE WHEN commercial_documents.type = 'credit_note' THEN -($expr) ELSE ($expr) END)";
            $rows = CommercialDocument::query()
                ->leftJoin('customers as c', 'c.id', '=', 'commercial_documents.customer_id')
                ->where('commercial_documents.client_profile_id', $profile->id)
                ->whereDate('commercial_documents.created_at', '>=', $from)->whereDate('commercial_documents.created_at', '<=', $to)
                ->where('commercial_documents.status', 'issued')
                ->select(
                    DB::raw('COALESCE(MAX(c.name), "No Party") as Party'),
                    DB::raw('COUNT(*) as Documents'),
                    DB::raw($cn('commercial_documents.taxable_amount').' as Taxable'),
                    DB::raw($cn('commercial_documents.cgst_amount').' as CGST'),
                    DB::raw($cn('commercial_documents.sgst_amount').' as SGST'),
                    DB::raw($cn('commercial_documents.igst_amount').' as IGST'),
                    DB::raw($cn('COALESCE(NULLIF(commercial_documents.grand_total,0), commercial_documents.total_amount)').' as Total')
                )
                ->groupBy('commercial_documents.customer_id')
                ->orderByDesc('Total')
                ->get()
                ->map(fn ($row) => $row->toArray())
                ->all();

            return $this->respondExport($format, $type, $rows, $exportMeta, $exportTitle, $exportPeriod);
        }

        if ($type === 'hsn_summary') {
            $hsn = DB::table('document_line_items as li')
                ->join('commercial_documents as d', 'd.id', '=', 'li.commercial_document_id')
                ->where('d.client_profile_id', $profile->id)
                ->whereDate('d.created_at', '>=', $from)->whereDate('d.created_at', '<=', $to)
                ->where('d.status', 'issued')
                ->select(
                    'li.hsn_sac',
                    DB::raw('MAX(li.description) as description'),
                    DB::raw('MAX(li.unit) as uqc'),
                    DB::raw('SUM(li.qty) as qty'),
                    DB::raw('SUM(li.taxable_amount) as taxable'),
                    DB::raw('SUM(li.cgst_amount) as cgst'),
                    DB::raw('SUM(li.sgst_amount) as sgst'),
                    DB::raw('SUM(li.igst_amount) as igst'),
                    DB::raw('SUM(li.total_amount) as total')
                )
                ->groupBy('li.hsn_sac')->orderByDesc('total')->get()
                ->map(fn ($r) => (array) $r)->all();

            return $this->respondExport($format, $type, $hsn, $exportMeta, $exportTitle, $exportPeriod);
        }

        if ($type === 'monthly_report') {
            // Every document type is mixed together per month here — Credit Notes reduce
            // value, so they're subtracted rather than added.
            $cn = fn (string $expr) => "SUM(CASE WHEN type = 'credit_note' THEN -($expr) ELSE ($expr) END)";
            $rows = CommercialDocument::where('client_profile_id', $profile->id)
                ->whereDate('created_at', '>=', $from)->whereDate('created_at', '<=', $to)->where('status', 'issued')
                ->selectRaw(BillingPolicy::monthGroupExpr('created_at').' as month,
                    SUM(CASE WHEN type = "tax_invoice" THEN 1 ELSE 0 END) as tax_invoices,
                    SUM(CASE WHEN type = "bill_of_supply" THEN 1 ELSE 0 END) as bill_of_supply,
                    SUM(CASE WHEN type = "debit_note" THEN 1 ELSE 0 END) as debit_notes,
                    SUM(CASE WHEN type = "credit_note" THEN 1 ELSE 0 END) as credit_notes,
                    '.$cn('taxable_amount').' as taxable_turnover,
                    '.$cn('COALESCE(NULLIF(grand_total,0), total_amount)').' as invoice_value,
                    '.$cn('cgst_amount').' as cgst, '.$cn('sgst_amount').' as sgst, '.$cn('igst_amount').' as igst,
                    '.$cn('cgst_amount+sgst_amount+igst_amount').' as gst_liability')
                ->groupBy('month')->orderBy('month')->get()->map(fn ($r) => (array) $r->toArray())->all();

            return $this->respondExport($format, $type, $rows, $exportMeta, $exportTitle, $exportPeriod);
        }

        if ($type === 'yearly_report') {
            $yearly = CommercialDocument::where('client_profile_id', $profile->id)
                ->whereDate('created_at', '>=', $from)->whereDate('created_at', '<=', $to)->where('status', 'issued')
                ->selectRaw(BillingPolicy::yearGroupExpr('created_at').' as year, type, COUNT(*) as count, SUM(taxable_amount) as taxable, SUM(COALESCE(NULLIF(grand_total,0), total_amount)) as total, SUM(cgst_amount+sgst_amount+igst_amount) as gst')
                ->groupBy('year', 'type')->orderBy('year')->get();
            $rows = $this->yearlyTotals($yearly);

            return $this->respondExport($format, $type, $rows, $exportMeta, $exportTitle, $exportPeriod);
        }

        $registerMap = [
            'invoice_register' => null,
            'tax_invoice_register' => 'tax_invoice',
            'bill_of_supply_register' => 'bill_of_supply',
            'debit_note_register' => 'debit_note',
            'credit_note_register' => 'credit_note',
        ];
        $docType = $registerMap[$type] ?? null;

        $docs = CommercialDocument::with('customer:id,name')
            ->where('client_profile_id', $profile->id)
            ->whereDate('created_at', '>=', $from)->whereDate('created_at', '<=', $to)
            ->where('status', 'issued')
            ->when($docType, fn ($q) => $q->where('type', $docType))
            ->orderBy('created_at')
            ->get()
            ->map(fn ($d) => [
                'Number' => $d->number,
                'Date' => $d->document_date?->format('Y-m-d'),
                'Type' => $d->type,
                'Party' => $d->customer?->name,
                'Taxable' => $d->taxable_amount,
                'CGST' => $d->cgst_amount,
                'SGST' => $d->sgst_amount,
                'IGST' => $d->igst_amount,
                'Total' => $d->grand_total ?: $d->total_amount,
                'Status' => $d->status,
            ])->all();

        return $this->respondExport($format, $type, $docs, $exportMeta, $exportTitle, $exportPeriod);
    }

    public function downloadZip(Request $request, int $id)
    {
        $profile = ClientProfile::findOrFail($id);
        [$from, $to] = $this->dateRange($request);
        $docType = $request->input('document_type');

        $docs = CommercialDocument::where('client_profile_id', $profile->id)
            ->whereDate('created_at', '>=', $from)->whereDate('created_at', '<=', $to)
            ->where('status', 'issued')
            ->when($docType && $docType !== 'all', fn ($q) => $q->where('type', $docType))
            ->get();

        $zipPath = storage_path('app/temp/client-'.$profile->id.'-'.time().'.zip');
        @mkdir(dirname($zipPath), 0755, true);
        $zip = new ZipArchive;
        $zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE);

        foreach ($docs as $doc) {
            if ($doc->pdf_path && Storage::disk('public')->exists($doc->pdf_path)) {
                $name = ($doc->number ?: 'doc-'.$doc->id).'.pdf';
                $zip->addFile(Storage::disk('public')->path($doc->pdf_path), $name);
            }
        }
        $zip->close();

        return response()->download($zipPath, "invoices-{$profile->client_code}.zip")->deleteFileAfterSend(true);
    }

    private function validatePayload(Request $request, bool $creating, ?ClientProfile $profile = null): array
    {
        $isGstOn = filter_var($request->input('gst_enabled', $request->input('has_gst', $profile?->has_gst ?? false)), FILTER_VALIDATE_BOOLEAN);
        $isPanOn = filter_var($request->input('pan_enabled', $profile?->pan_enabled ?? false), FILTER_VALIDATE_BOOLEAN);
        $isTanOn = filter_var($request->input('tan_enabled', $profile?->tan_enabled ?? false), FILTER_VALIDATE_BOOLEAN);
        $isCinOn = filter_var($request->input('cin_enabled', $profile?->cin_enabled ?? false), FILTER_VALIDATE_BOOLEAN);
        $isUdyamOn = filter_var($request->input('udyam_enabled', $profile?->udyam_enabled ?? false), FILTER_VALIDATE_BOOLEAN);
        $isFssaiOn = filter_var($request->input('fssai_enabled', $profile?->fssai_enabled ?? false), FILTER_VALIDATE_BOOLEAN);
        $isPtrcOn = filter_var($request->input('ptrc_enabled', $profile?->ptrc_enabled ?? false), FILTER_VALIDATE_BOOLEAN);
        $isPtecOn = filter_var($request->input('ptec_enabled', $profile?->ptec_enabled ?? false), FILTER_VALIDATE_BOOLEAN);

        // Graceful fallbacks for missing required fields so creating a client never fails
        if (empty($request->input('client_name'))) {
            $fallbackName = $request->input('business_name') ?: $request->input('contact_person_name') ?: 'Client ' . date('Ymd');
            $request->merge(['client_name' => $fallbackName]);
        }
        if (empty($request->input('business_name')) && $request->filled('client_name')) {
            $request->merge(['business_name' => $request->input('client_name')]);
        }
        if ($creating && empty($request->input('email'))) {
            $safeName = preg_replace('/[^a-zA-Z0-9]/', '', strtolower($request->input('client_name') ?: 'client'));
            $request->merge(['email' => ($safeName ?: 'client') . '_' . time() . '@' . self::LOGIN_EMAIL_DOMAIN]);
        }
        if ($creating && empty($request->input('login_prefix'))) {
            $base = preg_replace('/[^a-zA-Z0-9]/', '', strtolower($request->input('client_name') ?: $request->input('business_name') ?: 'client'));
            $cleanPrefix = substr($base ?: 'client', 0, 30);
            $testPrefix = $cleanPrefix;
            $counter = 1;
            while (User::where('email', $testPrefix . '@' . self::LOGIN_EMAIL_DOMAIN)->exists()) {
                $testPrefix = $cleanPrefix . $counter++;
            }
            $request->merge(['login_prefix' => $testPrefix]);
        }
        if ($creating && empty($request->input('password'))) {
            // No shared default password: a random temporary one is generated, hashed, and shown to the admin once.
            $request->attributes->set('generated_password', $generated = \Illuminate\Support\Str::password(12, true, true, true, false));
            $request->merge(['password' => $generated]);
        }

        // Fallbacks for Name as per PAN and CIN Date if primary is empty but alternate was supplied
        if ($isPanOn && empty($request->input('name_as_per_pan')) && $request->filled('client_name')) {
            $request->merge(['name_as_per_pan' => $request->input('client_name')]);
        }
        if ($isCinOn && empty($request->input('cin_incorporation_date')) && $request->filled('date_of_incorporation')) {
            $request->merge(['cin_incorporation_date' => $request->input('date_of_incorporation')]);
        }

        // Never block client creation or form save on empty compliance cards
        $reqGst = false;
        $reqPan = false;
        $reqTan = false;
        $reqCin = false;
        $reqUdyam = false;
        $reqFssai = false;
        $reqPtrc = false;
        $reqPtec = false;

        $rules = [
            'client_name' => 'required|string',
            'business_name' => 'nullable|string',
            'email' => 'required|email',
            'login_prefix' => 'required|string|max:64|regex:/^[a-zA-Z0-9._-]+$/',
            'password' => 'nullable|string|min:8',
            'mobile' => 'nullable|string',
            'phone' => 'nullable|string',
            'is_active' => 'nullable|boolean',
            'client_code' => 'nullable|string|unique:client_profiles,client_code'.($profile ? ','.$profile->id : ''),
            'constitution_type' => 'nullable|string',
            'business_type' => 'nullable|string',
            'contact_person_name' => 'nullable|string',
            'designation' => 'nullable|string',
            'gender' => 'nullable|string',
            'applicable_from' => 'nullable|date',
            'date_of_incorporation' => 'nullable|date',
            'date_of_birth' => 'nullable|date',
            'alt_mobile' => 'nullable|string',
            'alt_email' => 'nullable|email',
            'address' => 'nullable|string',
            'address_line_1' => 'nullable|string',
            'address_line_2' => 'nullable|string',
            'city' => 'nullable|string',
            'state' => 'nullable|string',
            'state_code' => 'nullable|string|max:2',
            'pincode' => 'nullable|string',
            'country' => 'nullable|string',
            'comm_same_as_above' => 'nullable|boolean',
            'comm_address_line_1' => 'nullable|string',
            'comm_address_line_2' => 'nullable|string',
            'comm_city' => 'nullable|string',
            'comm_state' => 'nullable|string',
            'comm_state_code' => 'nullable|string|max:2',
            'comm_pincode' => 'nullable|string',
            'comm_country' => 'nullable|string',
            'website' => 'nullable|string',
            'gstin' => ($reqGst ? 'required' : 'nullable').'|string',
            'registration_type' => ($reqGst ? 'required' : 'nullable').'|string|in:Regular,Composition,regular,composition',
            'has_gst' => 'nullable|boolean',
            'gst_compliance_enabled' => 'nullable|boolean',
            'dealer_type' => 'nullable|in:regular,composition',
            'gst_filing_frequency' => 'nullable|in:monthly,quarterly',
            'gstr1_filing_frequency' => 'nullable|in:monthly,quarterly',
            'gstr2b_filing_frequency' => 'nullable|in:monthly,quarterly',
            'composition_rate' => 'nullable|numeric|min:0|max:99.99',
            'pan' => ($reqPan ? 'required' : 'nullable').'|string',
            'aadhaar' => 'nullable|string',
            'gst_portal_username' => 'nullable|string',
            'gst_portal_password' => 'nullable|string',
            'tan' => ($reqTan ? 'required' : 'nullable').'|string',
            'tan_portal_password' => 'nullable|string',
            'it_portal_password' => 'nullable|string',
            'udyam' => ($reqUdyam ? 'required' : 'nullable').'|string',
            'shop_establishment' => 'nullable|string',
            'iec' => 'nullable|string',
            'cin' => ($reqCin ? 'required' : 'nullable').'|string',
            'llpin' => 'nullable|string',
            'pt_reg' => 'nullable|string',
            'esic' => 'nullable|string',
            'pf' => 'nullable|string',
            'pan_status' => ($reqPan ? 'required' : 'nullable').'|string',
            'name_as_per_pan' => ($reqPan ? 'required' : 'nullable').'|string',
            'pan_allotment_date' => 'nullable|date',
            'pan_enabled' => 'nullable|boolean',
            'gst_status' => ($reqGst ? 'required' : 'nullable').'|string',
            'gst_registration_date' => ($reqGst ? 'required' : 'nullable').'|date',
            'state_jurisdiction' => ($reqGst ? 'required' : 'nullable').'|string',
            'gst_enabled' => 'nullable|boolean',
            'tan_status' => ($reqTan ? 'required' : 'nullable').'|string',
            'tan_allotment_date' => 'nullable|date',
            'tan_enabled' => 'nullable|boolean',
            'cin_incorporation_date' => ($reqCin ? 'required' : 'nullable').'|date',
            'cin_certificate_no' => 'nullable|string',
            'cin_incorporation_place' => 'nullable|string',
            'cin_enabled' => 'nullable|boolean',
            'udyam_enterprise_type' => ($reqUdyam ? 'required' : 'nullable').'|string',
            'udyam_registration_date' => ($reqUdyam ? 'required' : 'nullable').'|date',
            'udyam_status' => ($reqUdyam ? 'required' : 'nullable').'|string',
            'udyam_enabled' => 'nullable|boolean',
            'shop_act_issuing_authority' => 'nullable|string',
            'shop_act_registration_date' => 'nullable|date',
            'shop_act_status' => 'nullable|string',
            'shop_act_enabled' => 'nullable|boolean',
            'fssai_no' => ($reqFssai ? 'required' : 'nullable').'|string',
            'fssai_license_type' => 'nullable|string',
            'fssai_registration_date' => 'nullable|date',
            'fssai_status' => ($reqFssai ? 'required' : 'nullable').'|string',
            'fssai_enabled' => 'nullable|boolean',
            'iec_registration_date' => 'nullable|date',
            'iec_status' => 'nullable|string',
            'iec_enabled' => 'nullable|boolean',
            'ptrc_state' => ($reqPtrc ? 'required' : 'nullable').'|string',
            'ptrc_registration_date' => 'nullable|date',
            'ptrc_status' => 'nullable|string',
            'ptrc_enabled' => 'nullable|boolean',
            'ptec_no' => ($reqPtec ? 'required' : 'nullable').'|string',
            'ptec_state' => ($reqPtec ? 'required' : 'nullable').'|string',
            'ptec_registration_date' => 'nullable|date',
            'ptec_status' => ($reqPtec ? 'required' : 'nullable').'|string',
            'ptec_enabled' => 'nullable|boolean',
            'tan_portal_username' => 'nullable|string',
            'it_portal_username' => 'nullable|string',
            'two_factor_enabled' => 'nullable|boolean',
            'session_timeout_minutes' => 'nullable|integer|min:1|max:1440',
            'esic' => 'nullable|string',
            'pf' => 'nullable|string',
            'bank_name' => 'nullable|string',
            'bank_branch' => 'nullable|string',
            'bank_account' => 'nullable|string',
            'account_holder_name' => 'nullable|string',
            'bank_ifsc' => 'nullable|string',
            'swift_code' => 'nullable|string',
            'account_type' => 'nullable|string',
            'upi_id' => 'nullable|string',
            'signatory_name' => 'nullable|string',
            'terms_conditions' => 'nullable|string',
            'invoice_prefix' => 'nullable|string|max:40',
            'bill_of_supply_prefix' => 'nullable|string|max:40',
            'credit_note_prefix' => 'nullable|string|max:40',
            'debit_note_prefix' => 'nullable|string|max:40',
            'quotation_prefix' => 'nullable|string|max:40',
            'amendment_prefix' => 'nullable|string|max:40',
            'invoice_next_number' => 'nullable|integer|min:1',
            'bill_of_supply_next_number' => 'nullable|integer|min:1',
            'credit_note_next_number' => 'nullable|integer|min:1',
            'debit_note_next_number' => 'nullable|integer|min:1',
            'quotation_next_number' => 'nullable|integer|min:1',
            'amendment_next_number' => 'nullable|integer|min:1',
            'delivery_challan_prefix' => 'nullable|string|max:40',
            'delivery_challan_next_number' => 'nullable|integer|min:1',
            'default_layout_id' => 'nullable|integer|in:1,2,3',
            'default_colour_scheme' => 'nullable|string',
            'invoice_tagline' => 'nullable|string',
            'document_numbering_settings' => 'nullable',
        ];

        $messages = [
            'applicable_from.required' => 'The applicable from date is required when GST is enabled.',
            'gstin.required' => 'The GSTIN is required when GST is enabled.',
            'registration_type.required' => 'The registration type is required when GST is enabled.',
            'gst_status.required' => 'The GST status is required when GST is enabled.',
            'gst_registration_date.required' => 'The GST registration date is required when GST is enabled.',
            'state_jurisdiction.required' => 'The state jurisdiction is required when GST is enabled.',
            'pan.required' => 'The PAN is required when PAN card is enabled.',
            'pan_status.required' => 'The PAN status is required when PAN card is enabled.',
            'name_as_per_pan.required' => 'The name as per PAN is required when PAN card is enabled.',
            'tan.required' => 'The TAN is required when TAN card is enabled.',
            'tan_status.required' => 'The TAN status is required when TAN card is enabled.',
            'cin.required' => 'The CIN is required when CIN card is enabled.',
            'cin_incorporation_date.required' => 'The date of incorporation is required when CIN card is enabled.',
            'udyam.required' => 'The UDYAM number is required when UDYAM card is enabled.',
            'udyam_enterprise_type.required' => 'The enterprise type is required when UDYAM card is enabled.',
            'udyam_registration_date.required' => 'The UDYAM registration date is required when UDYAM card is enabled.',
            'udyam_status.required' => 'The UDYAM status is required when UDYAM card is enabled.',
            'fssai_no.required' => 'The FSSAI number is required when FSSAI card is enabled.',
            'fssai_status.required' => 'The FSSAI status is required when FSSAI card is enabled.',
            'ptrc_state.required' => 'The PTRC state is required when PTRC card is enabled.',
            'ptec_no.required' => 'The PTEC number is required when PTEC card is enabled.',
            'ptec_state.required' => 'The PTEC state is required when PTEC card is enabled.',
            'ptec_status.required' => 'The PTEC status is required when PTEC card is enabled.',
        ];

        $data = $request->validate($rules, $messages);

        if (array_key_exists('login_prefix', $data)) {
            $loginEmail = strtolower(trim($data['login_prefix'])).'@'.self::LOGIN_EMAIL_DOMAIN;
            $taken = User::where('email', $loginEmail)
                ->when($profile, fn ($q) => $q->where('id', '!=', $profile->user_id))
                ->exists();
            abort_if($taken, 422, 'This login email is already in use by another client.');
            $data['login_email'] = $loginEmail;
        }

        return $data;
    }

    private function normalizeGstFields(array $data): array
    {
        // Align registration_type (spec Master) and dealer_type
        if (array_key_exists('registration_type', $data) && ! empty($data['registration_type'])) {
            $regNorm = ucfirst(strtolower(trim($data['registration_type'])));
            $data['registration_type'] = $regNorm;
            $data['dealer_type'] = strtolower($regNorm);
        } elseif (array_key_exists('dealer_type', $data) && ! empty($data['dealer_type'])) {
            $data['registration_type'] = ucfirst(strtolower(trim($data['dealer_type'])));
        }

        // Only touch GST fields when this request actually included has_gst — a narrow
        // partial update (e.g. toggling just gst_compliance_enabled) must never silently
        // reset has_gst/dealer_type/filing frequencies to their "not GST registered" state.
        if (! array_key_exists('has_gst', $data)) {
            return $data;
        }

        $hasGst = filter_var($data['has_gst'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $data['has_gst'] = $hasGst;
        if (! $hasGst) {
            $data['dealer_type'] = null;
            $data['registration_type'] = null;
            $data['gst_filing_frequency'] = null;
            $data['gstr1_filing_frequency'] = null;
            $data['gstr2b_filing_frequency'] = null;
        } else {
            if (empty($data['dealer_type'])) {
                $data['dealer_type'] = 'regular';
                $data['registration_type'] = 'Regular';
            }
            if ($data['dealer_type'] === 'composition') {
                // Composition dealers file CMP-08, not GSTR-1/2B/3B — the split doesn't apply.
                $data['registration_type'] = 'Composition';
                $data['gst_filing_frequency'] = 'quarterly';
                $data['gstr1_filing_frequency'] = null;
                $data['gstr2b_filing_frequency'] = null;
                if (empty($data['composition_rate'])) {
                    $data['composition_rate'] = 1.00; // default: traders/manufacturers rate
                }
            } else {
                $data['registration_type'] = 'Regular';
                if (empty($data['gst_filing_frequency'])) {
                    $data['gst_filing_frequency'] = 'monthly'; // default for regular if omitted
                }
                // Client Filing Frequency auto-selection spec: GSTR-1 is tracked monthly
                // regardless of the GSTR-3B cycle — defaults to monthly, labelled "Monthly
                // (QRMP)" on the frontend when GSTR-3B is quarterly (the stored value stays
                // 'monthly' either way, so due-date/period logic in GstReturnController never
                // sees a bogus "quarterly" GSTR-1 cycle). GSTR-2B mirrors GSTR-3B's cycle 1:1,
                // plain "Monthly"/"Quarterly" — it has no downstream due-date logic of its own.
                // Both defaults apply only when the admin hasn't explicitly chosen a value.
                if (empty($data['gstr1_filing_frequency'])) {
                    $data['gstr1_filing_frequency'] = 'monthly';
                }
                if (empty($data['gstr2b_filing_frequency'])) {
                    $data['gstr2b_filing_frequency'] = $data['gst_filing_frequency'];
                }
            }
        }

        return $data;
    }

    private function profileFields(array $data, ?ClientProfile $existing = null): array
    {
        $data = $this->normalizeGstFields($data);

        // Keep address and address_line_1 in sync if only one was provided
        if (! empty($data['address_line_1']) && empty($data['address'])) {
            $data['address'] = $data['address_line_1'];
        } elseif (! empty($data['address']) && empty($data['address_line_1'])) {
            $data['address_line_1'] = $data['address'];
        }

        $fields = [
            'client_name', 'business_name', 'constitution_type', 'business_type',
            'contact_person_name', 'designation', 'gender', 'applicable_from',
            'date_of_incorporation', 'date_of_birth', 'mobile', 'alt_mobile', 'alt_email',
            'email', 'address', 'address_line_1', 'address_line_2', 'city', 'state', 'state_code', 'pincode', 'country', 'website',
            'comm_same_as_above', 'comm_address_line_1', 'comm_address_line_2', 'comm_city', 'comm_state', 'comm_state_code', 'comm_pincode', 'comm_country',
            'gstin', 'registration_type', 'has_gst', 'gst_compliance_enabled', 'dealer_type', 'gst_filing_frequency', 'gstr1_filing_frequency', 'gstr2b_filing_frequency', 'composition_rate', 'pan', 'aadhaar', 'gst_portal_username', 'tan', 'udyam', 'shop_establishment',
            'iec', 'cin', 'llpin', 'pt_reg', 'esic', 'pf',
            'pan_status', 'name_as_per_pan', 'pan_allotment_date', 'pan_enabled',
            'gst_status', 'gst_registration_date', 'state_jurisdiction', 'gst_enabled',
            'tan_status', 'tan_allotment_date', 'tan_enabled',
            'cin_incorporation_date', 'cin_certificate_no', 'cin_incorporation_place', 'cin_enabled',
            'udyam_enterprise_type', 'udyam_registration_date', 'udyam_status', 'udyam_enabled',
            'shop_act_issuing_authority', 'shop_act_registration_date', 'shop_act_status', 'shop_act_enabled',
            'fssai_no', 'fssai_license_type', 'fssai_registration_date', 'fssai_status', 'fssai_enabled',
            'iec_registration_date', 'iec_status', 'iec_enabled',
            'ptrc_state', 'ptrc_registration_date', 'ptrc_status', 'ptrc_enabled',
            'ptec_no', 'ptec_state', 'ptec_registration_date', 'ptec_status', 'ptec_enabled',
            'tan_portal_username', 'it_portal_username',
            'two_factor_enabled', 'session_timeout_minutes',
            'bank_name', 'bank_branch', 'bank_account', 'account_holder_name', 'bank_ifsc',
            'swift_code', 'account_type', 'upi_id', 'signatory_name', 'terms_conditions', 'client_code',
            'invoice_prefix', 'bill_of_supply_prefix', 'credit_note_prefix', 'debit_note_prefix',
            'quotation_prefix', 'amendment_prefix', 'delivery_challan_prefix',
            'invoice_next_number', 'bill_of_supply_next_number', 'credit_note_next_number',
            'debit_note_next_number', 'quotation_next_number', 'amendment_next_number',
            'delivery_challan_next_number',
            'default_layout_id', 'default_colour_scheme', 'invoice_tagline',
        ];

        $out = [];
        foreach ($fields as $f) {
            if (array_key_exists($f, $data)) {
                $out[$f] = $data[$f];
            }
        }

        if (array_key_exists('document_numbering_settings', $data)) {
            $settings = $data['document_numbering_settings'];
            if (is_string($settings)) {
                $decoded = json_decode($settings, true);
                $out['document_numbering_settings'] = is_array($decoded) ? $decoded : null;
            } elseif (is_array($settings)) {
                $out['document_numbering_settings'] = $settings;
            }

            if (! empty($out['document_numbering_settings']) && is_array($out['document_numbering_settings'])) {
                $map = [
                    'invoice' => ['invoice_prefix', 'invoice_next_number'],
                    'bill_of_supply' => ['bill_of_supply_prefix', 'bill_of_supply_next_number'],
                    'credit_note' => ['credit_note_prefix', 'credit_note_next_number'],
                    'debit_note' => ['debit_note_prefix', 'debit_note_next_number'],
                    'quotation' => ['quotation_prefix', 'quotation_next_number'],
                    'delivery_challan' => ['delivery_challan_prefix', 'delivery_challan_next_number'],
                ];
                foreach ($map as $key => [$prefixCol, $seqCol]) {
                    if (isset($out['document_numbering_settings'][$key]) && is_array($out['document_numbering_settings'][$key])) {
                        $c = $out['document_numbering_settings'][$key];
                        if (! empty($c['prefix'])) {
                            $out[$prefixCol] = $c['prefix'];
                        }
                        if (isset($c['next_number']) && $c['next_number'] !== '') {
                            $out[$seqCol] = max(1, (int) $c['next_number']);
                        }
                    }
                }
            }
        }

        foreach (self::ENCRYPTED as $f) {
            if (! empty($data[$f])) {
                $out[$f] = Crypt::encryptString($data[$f]);
            } elseif ($existing && array_key_exists($f, $data) && $data[$f] === '') {
                $out[$f] = null;
            }
        }

        return $out;
    }

    private function handleUploads(Request $request, ClientProfile $profile): void
    {
        // Logo, signature, seal, and QR are managed via client change-request approval only.
    }

    private function applyDealerGstMatrix(array $matrix, ClientProfile $profile): array
    {
        $zero = [
            'taxable_value' => 0.0,
            'cgst' => 0.0,
            'sgst' => 0.0,
            'igst' => 0.0,
            'total_invoice_value' => 0.0,
        ];
        $out = [
            'tax_invoice' => $matrix['tax_invoice'] ?? $zero,
            'bill_of_supply' => $matrix['bill_of_supply'] ?? $zero,
            'debit_note' => $matrix['debit_note'] ?? $zero,
            'credit_note' => $matrix['credit_note'] ?? $zero,
        ];
        $mode = BillingPolicy::mode($profile);
        if ($mode === 'regular') {
            $out['bill_of_supply'] = $zero;
        } elseif ($mode === 'composition') {
            $out['tax_invoice'] = $zero;
            $out['debit_note'] = $zero;
        }

        return $out;
    }

    private function dateRange(Request $request): array
    {
        $preset = $request->input('preset', 'this_month');
        $now = now();

        return match ($preset) {
            'today' => [$now->toDateString(), $now->toDateString()],
            'yesterday' => [$now->copy()->subDay()->toDateString(), $now->copy()->subDay()->toDateString()],
            'this_week' => [$now->copy()->startOfWeek()->toDateString(), $now->toDateString()],
            'last_month' => [$now->copy()->subMonth()->startOfMonth()->toDateString(), $now->copy()->subMonth()->endOfMonth()->toDateString()],
            'quarterly' => [$now->copy()->firstOfQuarter()->toDateString(), $now->toDateString()],
            'financial_year' => $now->month >= 4
                ? [$now->year.'-04-01', ($now->year + 1).'-03-31']
                : [($now->year - 1).'-04-01', $now->year.'-03-31'],
            'this_month' => [$now->copy()->startOfMonth()->toDateString(), $now->toDateString()],
            'custom' => [
                $request->input('from', $now->copy()->startOfMonth()->toDateString()),
                $request->input('to', $now->toDateString()),
            ],
            default => [$now->copy()->startOfMonth()->toDateString(), $now->toDateString()],
        };
    }

    private function yearlyTotals($yearly): array
    {
        // Rows are grouped by (year, type); only flip Credit Notes' sign when more than
        // one document type is actually present — a single-type view (e.g. filtered to
        // "Credit Notes" only) should keep its own plain positive totals.
        $mixedTypes = collect($yearly)->pluck('type')->unique()->count() > 1;

        $byYear = [];
        foreach ($yearly as $row) {
            $sign = ($mixedTypes && $row->type === 'credit_note') ? -1 : 1;
            $y = $row->year;
            if (! isset($byYear[$y])) {
                $byYear[$y] = [
                    'year' => $y,
                    'total_documents' => 0,
                    'tax_invoices' => 0,
                    'bill_of_supply' => 0,
                    'debit_notes' => 0,
                    'credit_notes' => 0,
                    'taxable_turnover' => 0,
                    'invoice_value' => 0,
                    'cgst' => 0,
                    'sgst' => 0,
                    'igst' => 0,
                    'gst_liability' => 0,
                ];
            }
            $byYear[$y]['total_documents'] += (int) $row->count;
            $byYear[$y][$row->type === 'tax_invoice' ? 'tax_invoices' : ($row->type === 'bill_of_supply' ? 'bill_of_supply' : ($row->type === 'debit_note' ? 'debit_notes' : 'credit_notes'))] += (int) $row->count;
            $byYear[$y]['taxable_turnover'] += $sign * (float) $row->taxable;
            $byYear[$y]['invoice_value'] += $sign * (float) $row->total;
            $byYear[$y]['cgst'] += $sign * (float) ($row->cgst ?? 0);
            $byYear[$y]['sgst'] += $sign * (float) ($row->sgst ?? 0);
            $byYear[$y]['igst'] += $sign * (float) ($row->igst ?? 0);
            $byYear[$y]['gst_liability'] += $sign * (float) ($row->gst ?? 0);
        }

        return array_values($byYear);
    }

    private function respondExport(string $format, string $type, array $rows, array $meta = [], string $title = '', string $periodText = '')
    {
        if ($format === 'csv') {
            return $this->csvDownload($type, $rows);
        }
        if ($format === 'pdf') {
            return $this->pdfDownload($type, $rows, $meta, $title ?: ucwords(str_replace('_', ' ', $type)), $periodText);
        }

        return $this->xlsxDownload($type, $rows, $meta, $title ?: ucwords(str_replace('_', ' ', $type)), $periodText);
    }

    private function pdfDownload(string $type, array $rows, array $meta = [], string $title = '', string $periodText = '')
    {
        $moneyHeaders = $this->computeMoneyHeaders($rows);

        return \Barryvdh\DomPDF\Facade\Pdf::loadView('pdf.report', [
            'title'        => $title ?: ucwords(str_replace('_', ' ', $type)),
            'periodText'   => $periodText,
            'rows'         => $rows,
            'meta'         => $meta,
            'moneyHeaders' => $moneyHeaders,
            'generatedOn'  => now()->format('d-m-Y'),
        ])->download("{$type}.pdf");
    }

    /** Basic money-column detector matching the client portal's ReportController logic. */
    private function computeMoneyHeaders(array $rows): array
    {
        if (! $rows) return [];
        $nonMoneyExact   = ['invoices', 'documents', 'count', 'id'];
        $nonMoneyPattern = '/code|hsn|sac|qty|quantity|uqc|rate|no\.|number|\bname\b|particular|\btype\b|description|party|customer|date|sr\.|percent|%/i';
        $out = [];
        foreach ((array) ($rows[0] ?? []) as $h => $v) {
            if (! is_numeric($v)) continue;
            if (in_array(strtolower(trim((string) $h)), $nonMoneyExact, true)) continue;
            if (preg_match($nonMoneyPattern, (string) $h)) continue;
            $out[] = $h;
        }
        return $out;
    }

    private function csvDownload(string $type, array $rows)
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
     * Guard C: Check proposed document numbering settings for collisions and gaps.
     *
     * Exact duplicate: hard block 422 with key document_numbering_settings.<doc_key>.next_number
     * Gap (proposed < highest issued): warning 409 with requires_confirmation: true
     */
    private function validateDocumentNumberingGuard(Request $request, ClientProfile $profile, array $settings): ?\Illuminate\Http\JsonResponse
    {
        $invoices = app(InvoiceService::class);
        $docKeys = [
            'invoice' => ['type' => 'tax_invoice', 'label' => 'Tax Invoice'],
            'bill_of_supply' => ['type' => 'bill_of_supply', 'label' => 'Bill of Supply'],
            'credit_note' => ['type' => 'credit_note', 'label' => 'Credit Note'],
            'debit_note' => ['type' => 'debit_note', 'label' => 'Debit Note'],
            'quotation' => ['type' => 'quotation', 'label' => 'Quotation'],
            'delivery_challan' => ['type' => 'delivery_challan', 'label' => 'Delivery Challan'],
        ];

        $exactErrors = [];

        // Step 1: Exact-duplicate check per client, across all types, drafts included (assertUniqueNumber jaisa)
        foreach ($docKeys as $docKey => $info) {
            if (! isset($settings[$docKey]) || ! is_array($settings[$docKey])) {
                continue;
            }
            $cfg = $settings[$docKey];
            $type = $info['type'];

            $tempProfile = clone $profile;
            $currentSettings = $profile->document_numbering_settings;
            $tempProfile->document_numbering_settings = array_merge(is_array($currentSettings) ? $currentSettings : [], [$docKey => $cfg]);
            [$prefix, $separator, $position, $padLen] = $invoices->resolveNumberingConfig($tempProfile, $type);

            $rawNext = isset($cfg['next_number']) ? (string) $cfg['next_number'] : '01';
            $nextNum = max(1, (int) $rawNext);
            $candidate = $invoices->formatDocNumber($prefix, $nextNum, $separator, $position, max($padLen, strlen($rawNext)));

            $exactExists = CommercialDocument::where('client_profile_id', $profile->id)
                ->where('number', $candidate)
                ->exists();

            if ($exactExists) {
                $exactErrors["document_numbering_settings.{$docKey}.next_number"] = [
                    "Document number '{$candidate}' is already in use for this client.",
                ];
            }
        }

        if (! empty($exactErrors)) {
            throw \Illuminate\Validation\ValidationException::withMessages($exactErrors);
        }

        // Step 2: Gap check (sirf issued/non-draft par, sirf matching pattern wale documents)
        if (! $request->boolean('confirm_gap')) {
            foreach ($docKeys as $docKey => $info) {
                if (! isset($settings[$docKey]) || ! is_array($settings[$docKey])) {
                    continue;
                }
                $cfg = $settings[$docKey];
                $type = $info['type'];
                $label = $info['label'];

                $tempProfile = clone $profile;
                $currentSettings = $profile->document_numbering_settings;
                $tempProfile->document_numbering_settings = array_merge(is_array($currentSettings) ? $currentSettings : [], [$docKey => $cfg]);
                [$prefix, $separator, $position, $padLen] = $invoices->resolveNumberingConfig($tempProfile, $type);

                $rawNext = isset($cfg['next_number']) ? (string) $cfg['next_number'] : '01';
                $nextNum = max(1, (int) $rawNext);

                $quotedPrefix = preg_quote($prefix, '/');
                $quotedSep = preg_quote($separator, '/');
                if ($position === 'last') {
                    $pattern = (str_starts_with($prefix, '-') || str_starts_with($prefix, '/'))
                        ? '/^(\d+)' . $quotedPrefix . '$/'
                        : '/^(\d+)' . $quotedSep . $quotedPrefix . '$/';
                } else {
                    $pattern = (str_ends_with($prefix, '-') || str_ends_with($prefix, '/'))
                        ? '/^' . $quotedPrefix . '(\d+)$/'
                        : '/^' . $quotedPrefix . $quotedSep . '(\d+)$/';
                }

                $issuedNumbers = CommercialDocument::where('client_profile_id', $profile->id)
                    ->where('type', $type)
                    ->where('status', '!=', 'draft')
                    ->pluck('number');

                $highestIssued = 0;
                foreach ($issuedNumbers as $num) {
                    if (preg_match($pattern, (string) $num, $m)) {
                        $val = (int) $m[1];
                        if ($val > $highestIssued) {
                            $highestIssued = $val;
                        }
                    }
                }

                if ($highestIssued > 0 && $nextNum < $highestIssued) {
                    return response()->json([
                        'requires_confirmation' => true,
                        'doc_key' => $docKey,
                        'proposed_number' => $nextNum,
                        'highest_issued' => $highestIssued,
                        'message' => "Proposed Next Number ({$nextNum}) for {$label} is lower than the highest issued number ({$highestIssued}). This will create or fill a gap in document numbering. Are you sure you want to proceed?",
                    ], 409);
                }
            }
        }

        return null;
    }

    private function xlsxDownload(string $type, array $rows, array $meta = [], string $title = '', string $periodText = '')
    {
        $headers      = array_keys($rows[0] ?? ['value' => '']);
        $colCount     = max(count($headers), 1);
        $moneyHeaders = $this->computeMoneyHeaders($rows);
        $esc          = fn ($v) => htmlspecialchars((string) $v, ENT_QUOTES | ENT_XML1);

        $xml = '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>';
        $xml .= ExcelExport::root();
        $xml .= ExcelExport::styles();
        $xml .= '<Worksheet ss:Name="Report"><Table>'.ExcelExport::cols($headers, $rows);

        $mergeAttr = $colCount > 1 ? ' ss:MergeAcross="'.($colCount - 1).'"' : '';
        if ($meta['name'] ?? null) {
            $xml .= '<Row><Cell'.$mergeAttr.' ss:StyleID="bizName"><Data ss:Type="String">'.$esc(strtoupper($meta['name'])).'</Data></Cell></Row>';
            if ($meta['address'] ?? null) {
                $xml .= '<Row><Cell'.$mergeAttr.' ss:StyleID="bizLine"><Data ss:Type="String">'.$esc($meta['address']).'</Data></Cell></Row>';
            }
            $metaLine = implode('   |   ', array_filter([
                ($meta['pan']   ?? null) ? 'PAN: '.$meta['pan']      : null,
                ($meta['gstin'] ?? null) ? 'GSTIN: '.$meta['gstin']  : null,
                ($meta['email'] ?? null) ? 'Email: '.$meta['email']  : null,
                ($meta['phone'] ?? null) ? 'Mobile: '.$meta['phone'] : null,
            ]));
            if ($metaLine) {
                $xml .= '<Row><Cell'.$mergeAttr.' ss:StyleID="bizMeta"><Data ss:Type="String">'.$esc($metaLine).'</Data></Cell></Row>';
            }
            $xml .= '<Row></Row>';
        }
        $xml .= '<Row><Cell'.$mergeAttr.' ss:StyleID="title"><Data ss:Type="String">'.$esc($title ?: ucwords(str_replace('_', ' ', $type))).'</Data></Cell></Row>';
        if ($periodText) {
            $xml .= '<Row><Cell'.$mergeAttr.' ss:StyleID="period"><Data ss:Type="String">'.$esc('Period: '.$periodText).'</Data></Cell></Row>';
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
                $isMoney    = in_array($h, $moneyHeaders, true) && is_numeric($v);
                $isLabelCol = $ci === 0;
                $style = $isTotal
                    ? ($isLabelCol ? 'totalLabel' : ($isMoney ? 'totalMoney' : 'totalCell'))
                    : ($isLabelCol ? 'cellLabel'  : ($isMoney ? 'cellMoney'  : 'cell'));
                $typeAttr = is_numeric($v) ? 'Number' : 'String';
                $xml .= '<Cell ss:StyleID="'.$style.'"><Data ss:Type="'.$typeAttr.'">'.$esc(is_scalar($v) ? (string) $v : json_encode($v)).'</Data></Cell>';
            }
            $xml .= '</Row>';
        }
        $xml .= '<Row></Row>';
        $xml .= '<Row><Cell ss:StyleID="footer"><Data ss:Type="String">'.$esc('Report Generated On: '.now()->format('d-m-Y')).'</Data></Cell></Row>';
        $xml .= ExcelExport::end();

        return response($xml, 200, [
            'Content-Type'        => 'application/vnd.ms-excel',
            'Content-Disposition' => "attachment; filename=\"{$type}.xls\"",
        ]);
    }
}
