<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClientDocumentSetting;
use App\Models\ClientProfile;
use App\Models\ClientSubscription;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ClientLayoutController extends Controller
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

    public static function initializeDefaultsForProfile(ClientProfile $profile): void
    {
        $now = now();
        foreach (array_keys(ClientDocumentSetting::DOCUMENT_TYPES) as $docType) {
            ClientDocumentSetting::firstOrCreate(
                [
                    'client_profile_id' => $profile->id,
                    'document_type' => $docType,
                ],
                [
                    'layout_id' => $profile->default_layout_id ?: 1,
                    'colour_scheme' => $profile->default_colour_scheme ?: 'slate_blue',
                    'watermark_applies' => false,
                ]
            );
        }

        ClientSubscription::firstOrCreate(
            ['client_profile_id' => $profile->id],
            [
                'status' => 'active',
                'from_date' => $now->toDateString(),
                'to_date' => null,
                'total_fees' => null,
                'amount_paid' => null,
                'amount_receivable' => null,
                'outstanding' => null,
            ]
        );
    }

    public function show(Request $request, int $clientId)
    {
        $this->assertClientsUnlocked($request);
        $profile = ClientProfile::findOrFail($clientId);

        $layoutId = (int) ($profile->default_layout_id ?: 1);
        $colourScheme = (string) ($profile->default_colour_scheme ?: 'slate_blue');

        return response()->json([
            'client_id' => $profile->id,
            'layout_id' => $layoutId,
            'default_layout_id' => $layoutId,
            'colour_scheme' => $colourScheme,
            'default_colour_scheme' => $colourScheme,
            'applied_from' => $profile->layout_applied_from?->toDateString(),
            'layout_applied_from' => $profile->layout_applied_from?->toDateString(),
            'updated_at' => $profile->layout_updated_at?->toIso8601String(),
            'layout_updated_at' => $profile->layout_updated_at?->toIso8601String(),
            'layout_name' => ClientDocumentSetting::LAYOUTS[$layoutId] ?? null,
            'colour_name' => ClientDocumentSetting::COLOUR_SCHEMES[$colourScheme] ?? null,
            'allowed_layouts' => ClientDocumentSetting::LAYOUTS,
            'allowed_colour_schemes' => ClientDocumentSetting::COLOUR_SCHEMES,
        ]);
    }

    public function update(Request $request, int $clientId)
    {
        $this->assertClientsUnlocked($request);
        $profile = ClientProfile::findOrFail($clientId);

        $data = $request->validate([
            'layout_id' => 'required|integer|in:1,2,3,4',
            'colour_scheme' => ['required', 'string', Rule::in(array_keys(ClientDocumentSetting::COLOUR_SCHEMES))],
            'applied_from' => 'nullable|date',
        ]);

        DB::transaction(function () use ($profile, $data) {
            $layoutId = (int) $data['layout_id'];
            $colourScheme = (string) $data['colour_scheme'];

            $profile->default_layout_id = $layoutId;
            $profile->default_colour_scheme = $colourScheme;

            if (array_key_exists('applied_from', $data) && !empty($data['applied_from'])) {
                $profile->layout_applied_from = $data['applied_from'];
            } elseif (!$profile->layout_applied_from) {
                $profile->layout_applied_from = now()->toDateString();
            }

            $profile->layout_updated_at = now();
            $profile->save();

            // Overwrite all 6 client_document_settings rows with the new default layout & colour
            foreach (array_keys(ClientDocumentSetting::DOCUMENT_TYPES) as $docType) {
                ClientDocumentSetting::updateOrCreate(
                    [
                        'client_profile_id' => $profile->id,
                        'document_type' => $docType,
                    ],
                    [
                        'layout_id' => $layoutId,
                        'colour_scheme' => $colourScheme,
                    ]
                );
            }
        });

        $profile->refresh();

        return response()->json([
            'message' => 'Layout settings updated successfully and applied to all document types.',
            'client_id' => $profile->id,
            'layout_id' => (int) $profile->default_layout_id,
            'default_layout_id' => (int) $profile->default_layout_id,
            'colour_scheme' => (string) $profile->default_colour_scheme,
            'default_colour_scheme' => (string) $profile->default_colour_scheme,
            'applied_from' => $profile->layout_applied_from?->toDateString(),
            'layout_applied_from' => $profile->layout_applied_from?->toDateString(),
            'updated_at' => $profile->layout_updated_at?->toIso8601String(),
            'layout_updated_at' => $profile->layout_updated_at?->toIso8601String(),
            'layout_name' => ClientDocumentSetting::LAYOUTS[(int) $profile->default_layout_id] ?? null,
            'colour_name' => ClientDocumentSetting::COLOUR_SCHEMES[(string) $profile->default_colour_scheme] ?? null,
        ]);
    }
}
