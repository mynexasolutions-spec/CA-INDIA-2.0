<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Models\ClientGstr3bRequest;
use App\Models\ClientProfile;
use App\Models\NotificationItem;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class Gstr3bRequestController extends Controller
{
    private function clientProfile()
    {
        return ClientProfile::where('user_id', auth()->id())->firstOrFail();
    }

    private function notifyAdmins(ClientProfile $client, string $title, string $body): void
    {
        User::whereIn('role', ['super_admin', 'admin'])->each(function ($admin) use ($title, $body) {
            NotificationItem::create(['user_id' => $admin->id, 'title' => $title, 'body' => $body, 'type' => 'gstr3b_request']);
        });
    }

    /**
     * The logged-in client's GSTR-3B and CMP-08 requests, newest first (?return_type=GSTR3B|CMP08 narrows it).
     * "pending_count" is the number waiting for the client's action (the "N New Request" badge).
     */
    public function index(Request $request)
    {
        $client = $this->clientProfile();
        $requests = ClientGstr3bRequest::with('client')
            ->where('client_profile_id', $client->id)
            ->when(in_array($request->input('return_type'), [ClientGstr3bRequest::RETURN_GSTR3B, ClientGstr3bRequest::RETURN_CMP08], true),
                fn ($q) => $q->where('return_type', $request->input('return_type')))
            ->latest('id')
            ->get()
            ->map(fn ($r) => $r->toScreen());

        return response()->json([
            'requests'      => $requests->values(),
            'pending_count' => $requests->where('awaiting_client', true)->count(),
        ]);
    }

    /**
     * Client raises their own GSTR-3B request -> Status "Submitted", Initiated By "Client".
     */
    public function store(Request $request)
    {
        $client = $this->clientProfile();
        $data = $request->validate([
            'return_type' => ['nullable', 'in:GSTR3B,CMP08'],
            'tax_period'  => ['required', 'string', 'regex:/^(\d{4}-(0[1-9]|1[0-2])|\d{4}-Q[1-4])$/'],
        ]);
        $returnType = $data['return_type'] ?? ClientGstr3bRequest::RETURN_GSTR3B;
        // GSTR-3B is a monthly period ("2026-09"), CMP-08 a quarter ("2026-Q1").
        $isQuarter = str_contains($data['tax_period'], 'Q');
        abort_if($returnType === ClientGstr3bRequest::RETURN_CMP08 ? ! $isQuarter : $isQuarter, 422, 'The tax period does not match the return type.');

        $req = DB::transaction(function () use ($client, $data, $returnType) {
            if (ClientGstr3bRequest::activeFor($client->id, $data['tax_period'], $returnType)) {
                return null;
            }

            return ClientGstr3bRequest::create([
                'client_profile_id'   => $client->id,
                'return_type'         => $returnType,
                'tax_period'          => $data['tax_period'],
                'status'              => ClientGstr3bRequest::SUBMITTED,
                'initiated_by'        => 'client',
                'initiated_by_user_id'=> auth()->id(),
            ]);
        });

        if (! $req) {
            return response()->json(['message' => 'A request for this tax period is already in progress.'], 422);
        }

        $label = $req->return_label;
        $periodLabel = ClientGstr3bRequest::labelForPeriod($returnType, $data['tax_period']);
        $this->notifyAdmins($client, "{$label} Request Submitted", ($client->business_name ?? 'A client') . " submitted a {$label} request for {$periodLabel}.");

        return response()->json(['message' => 'Request submitted successfully.', 'id' => $req->id, 'request' => $req->load('client')->toScreen()], 201);
    }

    private function awaitingRequest(int $requestId, ClientProfile $client): ClientGstr3bRequest
    {
        // Only a request the Admin initiated and that is still waiting for this client can be answered.
        return ClientGstr3bRequest::where('id', $requestId)
            ->where('client_profile_id', $client->id)
            ->where('status', ClientGstr3bRequest::PENDING_CLIENT)
            ->where('initiated_by', 'admin')
            ->firstOrFail();
    }

    /** Client accepts a request -> Status "Accepted"; the GSTR-3B workflow continues. */
    public function accept(Request $request, int $requestId)
    {
        $client = $this->clientProfile();
        $req = $this->awaitingRequest($requestId, $client);
        $req->update(['status' => ClientGstr3bRequest::ACCEPTED]);

        $periodLabel = ClientGstr3bRequest::labelForPeriod($req->return_type, $req->tax_period);
        $this->notifyAdmins($client, "{$req->return_label} Request Accepted", ($client->business_name ?? 'The client') . " accepted the {$req->return_label} request for {$periodLabel}.");

        return response()->json(['message' => 'Request accepted successfully.', 'request' => $req->fresh()->load('client')->toScreen()]);
    }

    /** Client rejects a request -> Status "Rejected"; the reason is mandatory and visible to the Admin. */
    public function reject(Request $request, int $requestId)
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:500', 'regex:/\S/']], [
            'reason.required' => 'Please provide a reason for rejecting this request.',
            'reason.regex'    => 'Please provide a reason for rejecting this request.',
        ]);

        $client = $this->clientProfile();
        $req = $this->awaitingRequest($requestId, $client);
        $req->update(['status' => ClientGstr3bRequest::REJECTED, 'rejection_reason' => trim($data['reason'])]);

        $periodLabel = ClientGstr3bRequest::labelForPeriod($req->return_type, $req->tax_period);
        $this->notifyAdmins($client, "{$req->return_label} Request Rejected", ($client->business_name ?? 'The client') . " rejected the {$req->return_label} request for {$periodLabel}. Reason: " . trim($data['reason']));

        return response()->json(['message' => 'Request rejected.', 'request' => $req->fresh()->load('client')->toScreen()]);
    }
}
