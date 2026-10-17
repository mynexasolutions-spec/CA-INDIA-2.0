<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClientProfile;
use App\Services\ClientRequestFeed;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Admin "Request" module: client-wise view of the requests clients raise from the Client Portal
 * (see ClientRequestFeed for what is included and how statuses are mapped).
 */
class AdminRequestController extends Controller
{
    private const EMPTY = ['total' => 0, 'pending' => 0, 'completed' => 0, 'rejected' => 0];

    /** Client list with request summary */
    public function clientList(Request $request)
    {
        $search  = trim((string) $request->input('search', ''));
        $status  = strtolower((string) $request->input('status', 'All'));
        $page    = max(1, (int) $request->input('page', 1));
        $perPage = 10;

        $counts = ClientRequestFeed::countsByClient();

        $query = ClientProfile::with('user:id,name,is_active,email');
        if ($search !== '') {
            $query->where(fn ($q) =>
                $q->where('business_name', 'like', "%$search%")
                  ->orWhere('client_name', 'like', "%$search%")
                  ->orWhere('client_code', 'like', "%$search%")
                  ->orWhere('gstin', 'like', "%$search%")
                  ->orWhere('pan', 'like', "%$search%")
            );
        }
        $clients = $query->orderBy('business_name')->get();

        // "Pending / Completed / Rejected" narrows the list to clients that have such a request.
        if (in_array($status, ['pending', 'completed', 'rejected'], true)) {
            $clients = $clients->filter(fn ($c) => ($counts[$c->id][$status] ?? 0) > 0);
        }

        $rows = $clients->slice(($page - 1) * $perPage, $perPage)->map(function ($c) use ($counts) {
            $n = $counts[$c->id] ?? self::EMPTY;

            return [
                'id'             => $c->id,
                'client_code'    => $c->client_code,
                'business_name'  => $c->business_name ?? $c->client_name,
                'gstin'          => $c->gstin ?? '—',
                'mobile'         => $c->mobile ?? '—',
                'total_requests' => $n['total'],
                'pending'        => $n['pending'],
                'completed'      => $n['completed'],
                'rejected'       => $n['rejected'],
                'is_active'      => $c->user?->is_active ?? true,
            ];
        })->values();

        // Summary cards: every request of every client.
        $global = self::EMPTY;
        foreach ($counts as $n) {
            foreach ($global as $k => $_) {
                $global[$k] += $n[$k];
            }
        }

        return response()->json([
            'rows'     => $rows,
            'total'    => $clients->count(),
            'page'     => $page,
            'per_page' => $perPage,
            'summary'  => $global,
        ]);
    }

    /** Request list for a specific client */
    public function clientRequests(Request $request, int $clientId)
    {
        $client = ClientProfile::with('user:id,name,is_active,email')->findOrFail($clientId);

        $type     = (string) $request->input('type', 'all');
        $status   = strtolower((string) $request->input('status', 'All'));
        $search   = mb_strtolower(trim((string) $request->input('search', '')));
        $fromDate = $request->input('from_date');
        $toDate   = $request->input('to_date');
        $page     = max(1, (int) $request->input('page', 1));
        $perPage  = 10;

        $all = ClientRequestFeed::forClient($client);

        // Category counts and the client's summary ignore the list filters, as in the mock-up.
        $typeCounts = ['all' => $all->count()];
        foreach (ClientRequestFeed::TYPES as $t) {
            $typeCounts[$t] = $all->where('request_type', $t)->count();
        }
        $summary = [
            'total'     => $all->count(),
            'pending'   => $all->where('status', 'pending')->count(),
            'completed' => $all->where('status', 'completed')->count(),
            'rejected'  => $all->where('status', 'rejected')->count(),
        ];

        $filtered = $all
            ->when(in_array($type, ClientRequestFeed::TYPES, true), fn ($c) => $c->where('request_type', $type))
            ->when(in_array($status, ['pending', 'completed', 'rejected'], true), fn ($c) => $c->where('status', $status))
            ->when($search !== '', fn ($c) => $c->filter(fn ($r) =>
                str_contains(mb_strtolower($r['request_id']), $search) || str_contains(mb_strtolower((string) $r['subject']), $search)))
            ->when($fromDate, fn ($c) => $c->filter(fn ($r) => substr((string) $r['submitted_at'], 0, 10) >= $fromDate))
            ->when($toDate, fn ($c) => $c->filter(fn ($r) => substr((string) $r['submitted_at'], 0, 10) <= $toDate))
            ->values();

        return response()->json([
            'client' => [
                'id'            => $client->id,
                'client_code'   => $client->client_code,
                'business_name' => $client->business_name ?? $client->client_name,
                'gstin'         => $client->gstin,
                'pan'           => $client->pan,
                'mobile'        => $client->mobile,
                'email'         => $client->user?->email ?? $client->email,
                'is_active'     => $client->user?->is_active ?? true,
            ],
            'summary'     => $summary,
            'type_counts' => $typeCounts,
            'requests'    => $filtered->slice(($page - 1) * $perPage, $perPage)->map(fn ($r) => collect($r)->except(['sort_id', 'submitted_at'])->all())->values(),
            'total'       => $filtered->count(),
            'page'        => $page,
            'per_page'    => $perPage,
        ]);
    }

    /** Mark a request as completed */
    public function complete(Request $request, string $requestId)
    {
        ClientRequestFeed::complete($requestId, $request);

        return response()->json(['message' => 'Request marked as completed.']);
    }

    /** Reject a request — the reason is mandatory and is shown to the client */
    public function reject(Request $request, string $requestId)
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:500', 'regex:/\S/']], [
            'reason.required' => 'Please enter a reason for rejection.',
            'reason.regex'    => 'Please enter a reason for rejection.',
        ]);

        ClientRequestFeed::reject($requestId, $data['reason'], $request);

        return response()->json(['message' => 'Request rejected.']);
    }

    /** Download a request's attachment (stored privately, so it is streamed through an authenticated route) */
    public function attachment(string $requestId)
    {
        [$path, $name] = ClientRequestFeed::attachment($requestId);

        return Storage::disk('local')->download($path, $name);
    }
}
