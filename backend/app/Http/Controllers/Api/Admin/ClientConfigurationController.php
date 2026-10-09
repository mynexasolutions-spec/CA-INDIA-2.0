<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClientDocumentSetting;
use App\Models\ClientProfile;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ClientConfigurationController extends Controller
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

    public function show(Request $request, int $clientId)
    {
        $this->assertClientsUnlocked($request);
        $profile = ClientProfile::findOrFail($clientId);

        // Ensure 6 document settings rows exist
        ClientLayoutController::initializeDefaultsForProfile($profile);

        $documents = $profile->documentSettings()
            ->orderBy('id')
            ->get()
            ->map(function ($doc) {
                return [
                    'id' => $doc->id,
                    'document_type' => $doc->document_type,
                    'document_title' => ClientDocumentSetting::DOCUMENT_TYPES[$doc->document_type] ?? $doc->document_type,
                    'layout_id' => (int) $doc->layout_id,
                    'layout_name' => ClientDocumentSetting::LAYOUTS[(int) $doc->layout_id] ?? null,
                    'colour_scheme' => $doc->colour_scheme,
                    'colour_name' => ClientDocumentSetting::COLOUR_SCHEMES[$doc->colour_scheme] ?? null,
                    'watermark_applies' => (bool) $doc->watermark_applies,
                ];
            });

        return response()->json([
            'client_id' => $profile->id,
            'invoice_tagline' => $profile->invoice_tagline,
            'watermark_enabled' => (bool) $profile->watermark_enabled,
            'watermark_text' => $profile->watermark_text,
            'gst_reminder_enabled' => (bool) $profile->gst_reminder_enabled,
            'documents' => $documents,
            'allowed_layouts' => ClientDocumentSetting::LAYOUTS,
            'allowed_colour_schemes' => ClientDocumentSetting::COLOUR_SCHEMES,
        ]);
    }

    public function update(Request $request, int $clientId)
    {
        $this->assertClientsUnlocked($request);
        $profile = ClientProfile::findOrFail($clientId);

        $data = $request->validate([
            'invoice_tagline' => 'nullable|string|max:120',
            'watermark_enabled' => 'nullable|boolean',
            'watermark_text' => [
                'nullable',
                'string',
                'max:255',
                Rule::requiredIf(fn () => (bool) $request->input('watermark_enabled')),
            ],
            'gst_reminder_enabled' => 'nullable|boolean',
            'documents' => 'required|array',
            'documents.*.document_type' => ['required', 'string', Rule::in(array_keys(ClientDocumentSetting::DOCUMENT_TYPES))],
            'documents.*.layout_id' => 'required|integer|in:1,2,3,4',
            'documents.*.colour_scheme' => ['required', 'string', Rule::in(array_keys(ClientDocumentSetting::COLOUR_SCHEMES))],
            'documents.*.watermark_applies' => 'nullable|boolean',
        ]);

        $providedTypes = array_column($data['documents'], 'document_type');
        $requiredTypes = array_keys(ClientDocumentSetting::DOCUMENT_TYPES);

        // Reject duplicate document types
        if (count($providedTypes) !== count(array_unique($providedTypes))) {
            return response()->json([
                'message' => 'Duplicate document types provided in configuration.',
                'errors' => [
                    'documents' => ['Duplicate document types are not allowed.'],
                ],
            ], 422);
        }

        // Reject missing document types (all 6 required)
        $missing = array_diff($requiredTypes, $providedTypes);
        if (! empty($missing)) {
            return response()->json([
                'message' => 'All 6 document types must be provided in configuration.',
                'errors' => [
                    'documents' => ['Missing required document types: ' . implode(', ', $missing)],
                ],
            ], 422);
        }

        DB::transaction(function () use ($profile, $data, $request) {
            if ($request->has('invoice_tagline')) {
                $rawTagline = $request->input('invoice_tagline');
                $trimmed = is_string($rawTagline) ? trim($rawTagline) : null;
                $profile->invoice_tagline = ($trimmed === '' || $trimmed === null) ? null : $trimmed;
            }
            if ($request->has('watermark_enabled')) {
                $profile->watermark_enabled = (bool) $data['watermark_enabled'];
            }
            if ($request->has('watermark_text')) {
                $profile->watermark_text = $data['watermark_text'];
            }
            if ($request->has('gst_reminder_enabled')) {
                $profile->gst_reminder_enabled = (bool) $data['gst_reminder_enabled'];
            }
            $profile->save();

            foreach ($data['documents'] as $doc) {
                ClientDocumentSetting::updateOrCreate(
                    [
                        'client_profile_id' => $profile->id,
                        'document_type' => $doc['document_type'],
                    ],
                    [
                        'layout_id' => (int) $doc['layout_id'],
                        'colour_scheme' => $doc['colour_scheme'],
                        'watermark_applies' => (bool) ($doc['watermark_applies'] ?? false),
                    ]
                );
            }
        });

        $profile->refresh();

        $documents = $profile->documentSettings()
            ->orderBy('id')
            ->get()
            ->map(function ($doc) {
                return [
                    'id' => $doc->id,
                    'document_type' => $doc->document_type,
                    'document_title' => ClientDocumentSetting::DOCUMENT_TYPES[$doc->document_type] ?? $doc->document_type,
                    'layout_id' => (int) $doc->layout_id,
                    'layout_name' => ClientDocumentSetting::LAYOUTS[(int) $doc->layout_id] ?? null,
                    'colour_scheme' => $doc->colour_scheme,
                    'colour_name' => ClientDocumentSetting::COLOUR_SCHEMES[$doc->colour_scheme] ?? null,
                    'watermark_applies' => (bool) $doc->watermark_applies,
                ];
            });

        return response()->json([
            'message' => 'Configuration settings updated successfully.',
            'client_id' => $profile->id,
            'invoice_tagline' => $profile->invoice_tagline,
            'watermark_enabled' => (bool) $profile->watermark_enabled,
            'watermark_text' => $profile->watermark_text,
            'gst_reminder_enabled' => (bool) $profile->gst_reminder_enabled,
            'documents' => $documents,
        ]);
    }
}
