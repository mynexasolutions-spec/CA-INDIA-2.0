<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClientChangeRequest;
use App\Models\ClientProfile;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ChangeRequestController extends Controller
{
    private function serialize(ClientChangeRequest $req, bool $withDiff = false): array
    {
        $data = [
            'id' => $req->id,
            'section' => $req->section,
            'status' => $req->status,
            'payload' => $req->payload ?? [],
            'logo_path' => $req->logo_path,
            'signature_path' => $req->signature_path,
            'seal_path' => $req->seal_path,
            'qr_code_path' => $req->qr_code_path,
            'admin_note' => $req->admin_note,
            'reviewed_at' => $req->reviewed_at,
            'created_at' => $req->created_at,
            'updated_at' => $req->updated_at,
            'client_profile_id' => $req->client_profile_id,
            'client' => $req->clientProfile ? [
                'id' => $req->clientProfile->id,
                'business_name' => $req->clientProfile->business_name,
                'client_name' => $req->clientProfile->client_name,
                'client_code' => $req->clientProfile->client_code,
            ] : null,
            'submitter' => $req->submitter ? [
                'id' => $req->submitter->id,
                'name' => $req->submitter->name,
                'email' => $req->submitter->email,
            ] : null,
            'reviewer' => $req->reviewer ? [
                'id' => $req->reviewer->id,
                'name' => $req->reviewer->name,
            ] : null,
        ];

        if ($withDiff && $req->clientProfile) {
            $data['approved'] = $this->approvedSnapshot($req->clientProfile);
            $data['proposed'] = $this->proposedSnapshot($req, $req->clientProfile);
        }

        return $data;
    }

    private function approvedSnapshot(ClientProfile $profile): array
    {
        $text = [];
        foreach (ClientChangeRequest::snapshotFields() as $field) {
            $text[$field] = ClientChangeRequest::liveValue($profile, $field);
        }

        return [
            'text' => $text,
            'layout' => ['layout_id' => (int) ($profile->default_layout_id ?: 1), 'colour_scheme' => (string) ($profile->default_colour_scheme ?: 'slate_blue')],
            'logo_path' => $profile->logo_path,
            'signature_path' => $profile->signature_path,
            'seal_path' => $profile->seal_path,
            'qr_code_path' => $profile->qr_code_path,
        ];
    }

    private function proposedSnapshot(ClientChangeRequest $req, ClientProfile $profile): array
    {
        $text = [];
        $payload = $req->payload ?? [];
        foreach (ClientChangeRequest::snapshotFields() as $field) {
            $text[$field] = array_key_exists($field, $payload) ? $payload[$field] : ClientChangeRequest::liveValue($profile, $field);
        }

        return [
            'text' => $text,
            'layout' => [
                'layout_id' => (int) ($payload['layout_id'] ?? ($profile->default_layout_id ?: 1)),
                'colour_scheme' => (string) ($payload['colour_scheme'] ?? ($profile->default_colour_scheme ?: 'slate_blue')),
            ],
            'logo_path' => $req->logo_path ?: $profile->logo_path,
            'signature_path' => $req->signature_path ?: $profile->signature_path,
            'seal_path' => $req->seal_path ?: $profile->seal_path,
            'qr_code_path' => $req->qr_code_path ?: $profile->qr_code_path,
            'staged' => [
                'logo_path' => $req->logo_path,
                'signature_path' => $req->signature_path,
                'seal_path' => $req->seal_path,
                'qr_code_path' => $req->qr_code_path,
            ],
        ];
    }

    public function index(Request $request)
    {
        $status = $request->input('status', 'pending');
        $q = ClientChangeRequest::with(['clientProfile:id,business_name,client_name,client_code', 'submitter:id,name,email'])
            ->where('status', '!=', ClientChangeRequest::STATUS_DRAFT)
            ->latest('id');

        if ($status && $status !== 'all') {
            $q->where('status', $status);
        }
        if ($request->filled('q')) {
            $s = $request->q;
            $q->whereHas('clientProfile', function ($w) use ($s) {
                $w->where('business_name', 'like', "%{$s}%")
                    ->orWhere('client_name', 'like', "%{$s}%")
                    ->orWhere('client_code', 'like', "%{$s}%");
            });
        }

        return response()->json($q->paginate(25));
    }

    public function show(int $id)
    {
        $req = ClientChangeRequest::with([
            'clientProfile',
            'submitter:id,name,email',
            'reviewer:id,name',
        ])->findOrFail($id);

        return response()->json($this->serialize($req, true));
    }

    public function approve(Request $request, int $id)
    {
        $req = ClientChangeRequest::with('clientProfile')->findOrFail($id);
        abort_unless($req->isPending(), 422, 'Only pending requests can be approved');
        $profile = $req->clientProfile;
        abort_unless($profile, 404);

        $data = $request->validate(['admin_note' => 'nullable|string|max:2000']);
        $payload = $req->payload ?? [];
        $updates = [];
        foreach (ClientChangeRequest::TEXT_FIELDS as $field) {
            if (array_key_exists($field, $payload)) {
                $updates[$field] = $payload[$field];
            }
        }

        foreach (ClientChangeRequest::ASSET_FIELDS as $input => $column) {
            if ($req->{$column}) {
                $destDir = "clients/{$profile->id}";
                $filename = basename($req->{$column});
                $dest = "{$destDir}/{$filename}";
                if (Storage::disk('public')->exists($req->{$column})) {
                    if (Storage::disk('public')->exists($dest)) {
                        Storage::disk('public')->delete($dest);
                    }
                    Storage::disk('public')->copy($req->{$column}, $dest);
                    $updates[$column] = $dest;
                } else {
                    $updates[$column] = $req->{$column};
                }
            }
        }

        // Approved numbering changes (prefix, separator, next number, position, status) must beat the
        // per-type numbering settings (document_numbering_settings), which are what the next document
        // number is actually built from. The numbering type (auto/manual) is never touched here.
        // Re-validated now: documents may have been issued since the client submitted.
        \App\Services\Billing\DocumentNumberingSettings::assertValid($profile, $payload);
        [$numberingSettings, $numberingColumns] = \App\Services\Billing\DocumentNumberingSettings::apply($profile, $payload);
        if ($numberingSettings) {
            $updates = array_merge($updates, $numberingColumns);
            $updates['document_numbering_settings'] = $numberingSettings;
        }

        if ($updates) {
            $profile->update($updates);
        }

        if ($req->section === ClientChangeRequest::SECTION_LAYOUT && ! empty($payload['layout_id']) && ! empty($payload['colour_scheme'])) {
            ClientLayoutController::applyLayout($profile, (int) $payload['layout_id'], (string) $payload['colour_scheme']);
        }

        $req->update([
            'status' => ClientChangeRequest::STATUS_APPROVED,
            'admin_note' => $data['admin_note'] ?? $req->admin_note,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ]);

        return response()->json([
            'message' => 'Change request approved. Master profile updated.',
            'request' => $this->serialize($req->fresh()->load(['clientProfile', 'submitter', 'reviewer']), true),
        ]);
    }

    public function reject(Request $request, int $id)
    {
        $req = ClientChangeRequest::with('clientProfile')->findOrFail($id);
        abort_unless($req->isPending(), 422, 'Only pending requests can be rejected');

        $data = $request->validate(['admin_note' => 'nullable|string|max:2000']);
        $req->update([
            'status' => ClientChangeRequest::STATUS_REJECTED,
            'admin_note' => $data['admin_note'] ?? null,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ]);

        return response()->json([
            'message' => 'Change request rejected. Master profile unchanged.',
            'request' => $this->serialize($req->fresh()->load(['clientProfile', 'submitter', 'reviewer']), true),
        ]);
    }
}
