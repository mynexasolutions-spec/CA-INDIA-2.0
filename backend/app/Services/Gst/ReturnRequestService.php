<?php

namespace App\Services\Gst;

use App\Models\ClientGstr3bRequest;
use App\Models\ClientProfile;
use App\Models\GstFilingRequest;
use App\Models\NotificationItem;
use Illuminate\Support\Facades\DB;

/**
 * The request flow shared by GSTR-3B and CMP-08:
 *   Admin initiates -> "Pending Client Action" -> client Accepts / Rejects (reason), or
 *   client submits -> "Submitted" -> Admin Rejects (reason).
 * Only one open request may exist per client + return + tax period.
 */
class ReturnRequestService
{
    public static function label(string $returnType): string
    {
        return $returnType === ClientGstr3bRequest::RETURN_CMP08 ? 'CMP-08' : 'GSTR-3B';
    }

    public static function periodLabel(string $returnType, string $period): string
    {
        return ClientGstr3bRequest::labelForPeriod($returnType, $period);
    }

    public static function latest(int $clientId, string $returnType, string $period): ?ClientGstr3bRequest
    {
        return ClientGstr3bRequest::where('client_profile_id', $clientId)
            ->where('return_type', $returnType)
            ->where('tax_period', $period)
            ->latest('id')
            ->first();
    }

    /** Admin initiates on the client's behalf. Returns null when a request is already open. */
    public static function initiate(ClientProfile $client, string $returnType, string $period, ?int $adminUserId): ?ClientGstr3bRequest
    {
        // Checked inside a transaction so two quick clicks cannot both get through.
        $req = DB::transaction(function () use ($client, $returnType, $period, $adminUserId) {
            if (ClientGstr3bRequest::activeFor($client->id, $period, $returnType)) {
                return null;
            }

            return ClientGstr3bRequest::create([
                'client_profile_id'   => $client->id,
                'return_type'         => $returnType,
                'tax_period'          => $period,
                'status'              => ClientGstr3bRequest::PENDING_CLIENT,
                'initiated_by'        => 'admin',
                'initiated_by_user_id'=> $adminUserId,
            ]);
        });

        if ($req && $client->user_id) {
            $label = self::label($returnType);
            NotificationItem::create([
                'user_id' => $client->user_id,
                'title'   => "New {$label} Request Received",
                'body'    => "Your {$label} request for ".self::periodLabel($returnType, $period)
                    .' has been initiated by your administrator. Please review the request and take the required action.',
                'type'    => 'gstr3b_request',
            ]);
        }

        return $req;
    }

    /** Admin rejects a request the client submitted. Returns null when there is none to reject. */
    public static function reject(ClientProfile $client, string $returnType, string $period, string $reason): ?ClientGstr3bRequest
    {
        $req = ClientGstr3bRequest::where('client_profile_id', $client->id)
            ->where('return_type', $returnType)
            ->where('tax_period', $period)
            ->where('status', ClientGstr3bRequest::SUBMITTED)
            ->latest('id')
            ->first();

        if (! $req) {
            return null;
        }

        DB::transaction(function () use ($req, $client, $returnType, $period, $reason) {
            $req->update(['status' => ClientGstr3bRequest::REJECTED, 'rejection_reason' => $reason]);

            // The client's "Request Filing" record goes back to them for correction so they can re-submit.
            GstFilingRequest::where('client_profile_id', $client->id)
                ->where('return_type', $returnType === ClientGstr3bRequest::RETURN_CMP08 ? 'CMP-08' : 'GSTR-3B')
                ->where('filing_period', $period)
                ->where('status', 'Pending CA Review')
                ->update(['status' => 'Correction Required']);

            if ($client->user_id) {
                $label = self::label($returnType);
                NotificationItem::create([
                    'user_id' => $client->user_id,
                    'title'   => "{$label} Request Rejected",
                    'body'    => "Your {$label} request for ".self::periodLabel($returnType, $period)." was rejected. Reason: {$reason}",
                    'type'    => 'gstr3b_request',
                ]);
            }
        });

        return $req->fresh();
    }

    /** The return is filed - close any request still open for the period. */
    public static function complete(int $clientId, string $returnType, string $period): void
    {
        ClientGstr3bRequest::where('client_profile_id', $clientId)
            ->where('return_type', $returnType)
            ->where('tax_period', $period)
            ->whereIn('status', [ClientGstr3bRequest::SUBMITTED, ClientGstr3bRequest::ACCEPTED])
            ->update(['status' => ClientGstr3bRequest::COMPLETED]);
    }
}
