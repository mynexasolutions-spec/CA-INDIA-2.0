<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClientProfile;
use App\Services\Billing\AdminBillingCountService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminBillingController extends Controller
{
    public function __construct(
        private readonly AdminBillingCountService $countService
    ) {}

    /**
     * Client List for Admin Billing (PDF pp 31-33).
     * Includes 6 global cards for selected FY and filtered, paginated client table.
     */
    public function clients(Request $request): JsonResponse
    {
        $fyData = $this->countService->resolveFy($request->query('fy'));
        $cards = $this->countService->getGlobalCardCounts($fyData['from'], $fyData['to']);

        $query = ClientProfile::query()
            ->with('user:id,name,email,phone,is_active')
            ->orderBy('client_code', 'asc');

        // Search: Client Code / Business Name (Trade Name) / Client Name (Legal Name) / PAN / GSTIN (only if has_gst=true)
        if ($request->filled('q')) {
            $rawQ = trim((string) $request->query('q'));
            $escaped = str_replace(
                ['!', '%', '_'],
                ['!!', '!%', '!_'],
                $rawQ
            );
            $pattern = "%{$escaped}%";

            $query->where(function ($w) use ($pattern) {
                $w->whereRaw("client_code LIKE ? ESCAPE '!'", [$pattern])
                    ->orWhereRaw("business_name LIKE ? ESCAPE '!'", [$pattern])
                    ->orWhereRaw("client_name LIKE ? ESCAPE '!'", [$pattern])
                    ->orWhereRaw("pan LIKE ? ESCAPE '!'", [$pattern])
                    ->orWhere(function ($gstScope) use ($pattern) {
                        $gstScope->where('has_gst', true)
                            ->whereRaw("gstin LIKE ? ESCAPE '!'", [$pattern]);
                    });
            });
        }

        // Status Filter: All / Active / Inactive
        if ($request->filled('status')) {
            $status = strtolower(trim((string) $request->query('status')));
            if ($status === 'active') {
                $query->whereHas('user', fn ($u) => $u->where('is_active', true));
            } elseif ($status === 'inactive') {
                $query->where(function ($w) {
                    $w->whereDoesntHave('user')
                        ->orWhereHas('user', fn ($u) => $u->where('is_active', false));
                });
            }
        }

        // Constitution Type Filter with alias groups
        if ($request->filled('constitution_type')) {
            $constitution = trim((string) $request->query('constitution_type'));
            if ($constitution !== '' && strtolower($constitution) !== 'all') {
                $aliases = AdminBillingCountService::CONSTITUTION_ALIASES[$constitution] ?? [$constitution];
                $query->whereIn('constitution_type', $aliases);
            }
        }

        // Registration Type Filter: requires has_gst = true; Regular includes QRMP
        if ($request->filled('registration_type')) {
            $regType = trim((string) $request->query('registration_type'));
            if ($regType !== '' && strcasecmp($regType, 'all') !== 0) {
                $query->where('has_gst', true);
                if (strcasecmp($regType, 'Regular') === 0) {
                    $query->where(function ($w) {
                        $w->whereIn('registration_type', ['Regular', 'regular', 'QRMP', 'qrmp'])
                            ->orWhere('dealer_type', 'regular');
                    });
                } elseif (strcasecmp($regType, 'Composition') === 0) {
                    $query->where(function ($w) {
                        $w->whereIn('registration_type', ['Composition', 'composition'])
                            ->orWhere('dealer_type', 'composition');
                    });
                } else {
                    $query->where('registration_type', $regType);
                }
            }
        }

        $perPage = min(max((int) $request->query('per_page', 10), 1), 100);
        $paginated = $query->paginate($perPage);

        $transformed = $paginated->getCollection()->map(function (ClientProfile $p) {
            $masked = $this->countService->maskGstFields($p);
            $isActive = (bool) ($p->user?->is_active ?? false);

            return [
                'id' => $p->id,
                'client_code' => $p->client_code,
                'business_name' => $p->business_name,
                'client_name' => $p->client_name,
                'gstin' => $masked['gstin'],
                'pan' => $p->pan,
                'constitution_type' => $p->constitution_type,
                'registration_type' => $masked['registration_type'],
                'is_active' => $isActive,
                'mobile' => $p->mobile ?: $p->user?->phone,
                'email' => $p->email ?: $p->user?->email,
                'address' => $this->countService->formatAddress($p),
                'has_gst' => $masked['has_gst'],
            ];
        });

        $paginated->setCollection($transformed);

        return response()->json([
            'fy' => $fyData['fy'],
            'from' => $fyData['from'],
            'to' => $fyData['to'],
            'cards' => $cards,
            'filter_options' => [
                'constitution_types' => AdminBillingCountService::CONSTITUTION_OPTIONS,
                'registration_types' => ['All', 'Regular', 'Composition'],
                'statuses' => ['All', 'Active', 'Inactive'],
            ],
            'clients' => $paginated,
        ]);
    }

    /**
     * Client Dashboard for Admin Billing (PDF pp 33-35).
     * Includes client info, 7 cards, donut, and 12-month document trend.
     */
    public function clientDashboard(Request $request, int $clientId): JsonResponse
    {
        $fyData = $this->countService->resolveFy($request->query('fy'));

        $profile = ClientProfile::with('user:id,name,email,phone,is_active')->findOrFail($clientId);
        $masked = $this->countService->maskGstFields($profile);
        $dashboardData = $this->countService->getClientDashboardData(
            $clientId,
            $fyData['start_year'],
            $fyData['from'],
            $fyData['to']
        );

        $isActive = (bool) ($profile->user?->is_active ?? false);

        return response()->json([
            'client' => [
                'id' => $profile->id,
                'client_code' => $profile->client_code,
                'business_name' => $profile->business_name,
                'client_name' => $profile->client_name,
                'gstin' => $masked['gstin'],
                'pan' => $profile->pan,
                'constitution_type' => $profile->constitution_type,
                'registration_type' => $masked['registration_type'],
                'is_active' => $isActive,
                'mobile' => $profile->mobile ?: $profile->user?->phone,
                'email' => $profile->email ?: $profile->user?->email,
                'address' => $this->countService->formatAddress($profile),
                'has_gst' => $masked['has_gst'],
            ],
            'fy' => $fyData['fy'],
            'from' => $fyData['from'],
            'to' => $fyData['to'],
            'cards' => $dashboardData['cards'],
            'donut' => $dashboardData['donut'],
            'monthly_trend' => $dashboardData['monthly_trend'],
        ]);
    }
}
