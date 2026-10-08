<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClientProfile;
use App\Models\ClientSubscription;
use Illuminate\Http\Request;

class ClientServiceAccessController extends Controller
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

    private function buildServicesList(ClientProfile $profile): array
    {
        $sub = $profile->subscription;
        $isActive = $sub ? (strtolower((string) $sub->status) === ClientSubscription::STATUS_ACTIVE) : true;

        if ($isActive) {
            return [
                'subscription_status' => 'active',
                'services' => [
                    [
                        'service_key' => 'client_data_management',
                        'service_name' => 'Client Data Management',
                        'access' => true,
                        'disabled' => true,
                        'remarks' => 'Always enabled for all clients',
                    ],
                    [
                        'service_key' => 'billing',
                        'service_name' => 'Billing',
                        'access' => true,
                        'disabled' => true,
                        'remarks' => 'Enabled with active subscription',
                    ],
                    [
                        'service_key' => 'document_change',
                        'service_name' => 'Document Change',
                        'access' => true,
                        'disabled' => true,
                        'remarks' => 'Enabled with active subscription',
                    ],
                    [
                        'service_key' => 'requests',
                        'service_name' => 'Requests',
                        'access' => true,
                        'disabled' => true,
                        'remarks' => 'Enabled with active subscription',
                    ],
                    [
                        'service_key' => 'gst_compliance',
                        'service_name' => 'GST Compliance',
                        'access' => (bool) $profile->gst_compliance_enabled,
                        'disabled' => false,
                        'remarks' => 'GST filing and compliance management',
                    ],
                    [
                        'service_key' => 'reports',
                        'service_name' => 'Reports',
                        'access' => true,
                        'disabled' => true,
                        'remarks' => 'Enabled with active subscription',
                    ],
                ],
            ];
        }

        return [
            'subscription_status' => 'inactive',
            'services' => [
                [
                    'service_key' => 'client_data_management',
                    'service_name' => 'Client Data Management',
                    'access' => true,
                    'disabled' => true,
                    'remarks' => 'Always enabled for all clients',
                ],
                [
                    'service_key' => 'billing',
                    'service_name' => 'Billing',
                    'access' => false,
                    'disabled' => true,
                    'remarks' => 'Not Applicable (Subscription Inactive)',
                ],
                [
                    'service_key' => 'document_change',
                    'service_name' => 'Document Change',
                    'access' => false,
                    'disabled' => true,
                    'remarks' => 'Not Applicable (Subscription Inactive)',
                ],
                [
                    'service_key' => 'requests',
                    'service_name' => 'Requests',
                    'access' => false,
                    'disabled' => true,
                    'remarks' => 'Not Applicable (Subscription Inactive)',
                ],
                [
                    'service_key' => 'gst_compliance',
                    'service_name' => 'GST Compliance',
                    'access' => false,
                    'disabled' => true,
                    'remarks' => 'Not Applicable (Subscription Inactive)',
                ],
                [
                    'service_key' => 'reports',
                    'service_name' => 'Reports',
                    'access' => false,
                    'disabled' => true,
                    'remarks' => 'Not Applicable (Subscription Inactive)',
                ],
            ],
        ];
    }

    public function show(Request $request, int $clientId)
    {
        $this->assertClientsUnlocked($request);
        $profile = ClientProfile::with('subscription')->findOrFail($clientId);

        $data = $this->buildServicesList($profile);

        return response()->json(array_merge([
            'client_id' => $profile->id,
            'client_name' => $profile->client_name,
        ], $data));
    }

    public function update(Request $request, int $clientId)
    {
        $this->assertClientsUnlocked($request);
        $profile = ClientProfile::with('subscription')->findOrFail($clientId);

        $sub = $profile->subscription;
        $isActive = $sub ? (strtolower((string) $sub->status) === ClientSubscription::STATUS_ACTIVE) : true;

        if (! $isActive) {
            return response()->json([
                'message' => 'Service access cannot be updated because the subscription is inactive for this client.',
            ], 422);
        }

        $data = $request->validate([
            'gst_compliance_enabled' => 'required|boolean',
        ]);

        $profile->gst_compliance_enabled = (bool) $data['gst_compliance_enabled'];
        $profile->save();
        $profile->refresh();

        $serviceData = $this->buildServicesList($profile);

        return response()->json(array_merge([
            'message' => 'Service access settings updated successfully.',
            'client_id' => $profile->id,
            'client_name' => $profile->client_name,
        ], $serviceData));
    }
}
