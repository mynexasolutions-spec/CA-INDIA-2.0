<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClientProfile;
use App\Models\CommercialDocument;
use App\Models\Customer;
use App\Models\TdsTcsSection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminBillingPartyController extends Controller
{
    /**
     * List / search parties for a specific client profile.
     */
    public function index(Request $request, int $clientId): JsonResponse
    {
        ClientProfile::findOrFail($clientId);

        $q = Customer::where('client_profile_id', $clientId)->latest('id');

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

        if ($request->input('status') === 'active') {
            $q->where('is_active', true);
        } elseif ($request->input('status') === 'archived') {
            $q->where('is_active', false);
        }

        $perPage = min(100, max(1, (int) $request->input('per_page', 10)));

        return response()->json($q->paginate($perPage));
    }

    /**
     * Recently invoiced active parties for a specific client profile (for invoice dropdown).
     */
    public function recent(Request $request, int $clientId): JsonResponse
    {
        ClientProfile::findOrFail($clientId);

        $ids = CommercialDocument::where('client_profile_id', $clientId)
            ->whereNotNull('customer_id')
            ->orderByDesc('id')
            ->limit(100)
            ->pluck('customer_id')
            ->unique()
            ->values();

        $parties = Customer::where('client_profile_id', $clientId)
            ->where('is_active', true)
            ->whereIn('id', $ids)
            ->get()
            ->sortBy(fn ($c) => $ids->search($c->id))
            ->take(5)
            ->values();

        return response()->json(['data' => $parties]);
    }

    /**
     * Show a specific party scoped to a client profile (cross-tenant isolated).
     */
    public function show(Request $request, int $clientId, int $id): JsonResponse
    {
        ClientProfile::findOrFail($clientId);

        $party = Customer::where('client_profile_id', $clientId)->findOrFail($id);

        return response()->json($party);
    }

    /**
     * Active TDS/TCS sections for invoice dropdown.
     * Optionally scoped to client (asserting client exists if provided).
     */
    public function tdsTcsSections(Request $request, ?int $clientId = null): JsonResponse
    {
        if ($clientId !== null) {
            ClientProfile::findOrFail($clientId);
        }

        $type = $request->input('type');
        $q = TdsTcsSection::where('is_active', true)->orderBy('sort_order')->orderBy('code');
        if (in_array($type, ['tds', 'tcs'], true)) {
            $q->where('type', $type);
        }

        return response()->json(['data' => $q->get(['id', 'type', 'code', 'description', 'rate'])]);
    }
}
