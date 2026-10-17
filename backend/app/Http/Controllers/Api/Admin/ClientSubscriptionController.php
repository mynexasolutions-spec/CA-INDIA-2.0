<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\CommercialDocument;
use App\Models\ClientProfile;
use App\Models\ClientSubscription;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ClientSubscriptionController extends Controller
{
    private function assertClientsUnlocked(Request $request): void
    {
        $userId = $request->user()?->id;
        if ($userId && ClientsUnlockController::isUnlocked($userId)) {
            return;
        }

        $hash = $request->header('X-Clients-Unlock-Token');
        if ($hash && hash_equals($request->user()?->clients_unlock_hash ?? '', $hash)) {
            return;
        }

        abort(403, 'Clients module is locked. Enter your administrator password to continue.');
    }

    /**
     * Real disk space this client's records take: generated invoice PDFs, branding files, uploaded
     * documents, GSTR-2B uploads and request attachments. Files that no longer exist are skipped.
     */
    private function storageUsed(ClientProfile $profile): ?string
    {
        $paths = collect([$profile->logo_path, $profile->signature_path, $profile->seal_path, $profile->qr_code_path]);
        $paths = $paths->merge(CommercialDocument::withTrashed()->where('client_profile_id', $profile->id)->whereNotNull('pdf_path')->pluck('pdf_path'))
            ->merge(\App\Models\ClientDocument::where('client_profile_id', $profile->id)->pluck('file_path'))
            ->merge(\App\Models\ClientGstr2bRecord::where('client_profile_id', $profile->id)->pluck('file_path'))
            ->merge(\App\Models\ClientOtherRequest::where('client_profile_id', $profile->id)->whereNotNull('attachment_path')->pluck('attachment_path'))
            ->filter()->unique();

        $bytes = 0;
        foreach ($paths as $path) {
            foreach (['public', 'local'] as $disk) {
                if (Storage::disk($disk)->exists($path)) {
                    $bytes += Storage::disk($disk)->size($path);
                    break;
                }
            }
        }

        if ($bytes <= 0) {
            return '0 KB';
        }
        if ($bytes >= 1073741824) {
            return round($bytes / 1073741824, 2).' GB';
        }
        if ($bytes >= 1048576) {
            return round($bytes / 1048576, 2).' MB';
        }

        return max(1, (int) round($bytes / 1024)).' KB';
    }

    private function formatSubscriptionResponse(ClientProfile $profile, ClientSubscription $sub): array
    {
        $isInactive = strtolower((string) $sub->status) === ClientSubscription::STATUS_INACTIVE;
        $documentsCount = CommercialDocument::where('client_profile_id', $profile->id)->count();

        // When inactive: display 0, but stored values in DB remain untouched
        return [
            'id' => $sub->id,
            'client_profile_id' => $profile->id,
            'status' => $sub->status,
            'from_date' => $sub->from_date?->toDateString(),
            'to_date' => $sub->to_date?->toDateString(),
            'total_fees' => $isInactive ? 0 : ($sub->total_fees !== null ? (float) $sub->total_fees : null),
            'amount_paid' => $isInactive ? 0 : ($sub->amount_paid !== null ? (float) $sub->amount_paid : null),
            'amount_receivable' => $isInactive ? 0 : ($sub->amount_receivable !== null ? (float) $sub->amount_receivable : null),
            'outstanding' => $isInactive ? 0 : ($sub->outstanding !== null ? (float) $sub->outstanding : null),
            'usage' => [
                'documents_count' => $documentsCount,
                'storage_used' => $this->storageUsed($profile),
            ],
            'inactive_alert' => $isInactive ? 'Subscription is inactive for this client. No paid services are enabled. Client record is maintained for data management purposes only.' : null,
            'created_at' => $sub->created_at?->toIso8601String(),
            'updated_at' => $sub->updated_at?->toIso8601String(),
        ];
    }

    public function show(Request $request, int $clientId)
    {
        $this->assertClientsUnlocked($request);
        $profile = ClientProfile::findOrFail($clientId);

        $sub = ClientSubscription::firstOrCreate(
            ['client_profile_id' => $profile->id],
            [
                'status' => ClientSubscription::STATUS_ACTIVE,
                'from_date' => $profile->created_at ? substr((string) $profile->created_at, 0, 10) : now()->toDateString(),
                'to_date' => null,
                'total_fees' => null,
                'amount_paid' => null,
                'amount_receivable' => null,
                'outstanding' => null,
            ]
        );

        return response()->json($this->formatSubscriptionResponse($profile, $sub));
    }

    public function update(Request $request, int $clientId)
    {
        $this->assertClientsUnlocked($request);
        $profile = ClientProfile::findOrFail($clientId);

        $data = $request->validate([
            'status' => 'required|string|in:active,inactive',
            'from_date' => 'required|date',
            'to_date' => 'nullable|date|after_or_equal:from_date',
            'total_fees' => 'nullable|numeric|min:0',
            'amount_paid' => 'nullable|numeric|min:0',
            'amount_receivable' => 'nullable|numeric|min:0',
            'outstanding' => 'nullable|numeric|min:0',
        ]);

        // (1) When status is active: update the real fee fields.
        // (1) When status is inactive: fee fields are NOT modified in database, stored values remain untouched!
        $sub = ClientSubscription::firstOrNew(['client_profile_id' => $profile->id]);
        $sub->status = $data['status'];
        $sub->from_date = $data['from_date'];
        $sub->to_date = $data['to_date'] ?? null;

        if ($data['status'] === ClientSubscription::STATUS_ACTIVE) {
            $sub->total_fees = array_key_exists('total_fees', $data) ? $data['total_fees'] : null;
            $sub->amount_paid = array_key_exists('amount_paid', $data) ? $data['amount_paid'] : null;
            $sub->amount_receivable = array_key_exists('amount_receivable', $data) ? $data['amount_receivable'] : null;
            $sub->outstanding = array_key_exists('outstanding', $data) ? $data['outstanding'] : null;
        }

        $sub->save();

        return response()->json(array_merge(
            ['message' => 'Subscription details updated successfully.'],
            $this->formatSubscriptionResponse($profile, $sub)
        ));
    }
}
