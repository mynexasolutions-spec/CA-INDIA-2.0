<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClientBankAccount;
use App\Models\ClientProfile;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ClientBankAccountController extends Controller
{
    private function assertClientsUnlocked(Request $request): void
    {
        $hash = $request->header('X-Clients-Unlock-Token');
        abort_unless(
            $hash && hash_equals($request->user()->clients_unlock_hash ?? '', $hash),
            403,
            'Clients section is locked.'
        );
    }

    public function index(Request $request, int $clientId)
    {
        $this->assertClientsUnlocked($request);
        $profile = ClientProfile::findOrFail($clientId);
        return response()->json($profile->bankAccounts);
    }

    public function store(Request $request, int $clientId)
    {
        $this->assertClientsUnlocked($request);
        $profile = ClientProfile::findOrFail($clientId);

        $data = $request->validate([
            'bank_name' => 'required|string|max:255',
            'account_holder_name' => 'required|string|max:255',
            'account_number' => 'required|string|max:50',
            'ifsc_code' => 'required|string|max:20',
            'branch' => 'nullable|string|max:255',
            'account_type' => 'nullable|string|max:50',
            'is_primary' => 'nullable|boolean',
            'status' => 'nullable|string|in:Active,Inactive,active,inactive',
            'remarks' => 'nullable|string|max:1000',
        ]);

        return DB::transaction(function () use ($data, $profile) {
            $count = $profile->bankAccounts()->count();
            $isPrimary = !empty($data['is_primary']) || $count === 0;

            if ($isPrimary) {
                $profile->bankAccounts()->update(['is_primary' => false]);
            }

            $account = $profile->bankAccounts()->create([
                'bank_name' => $data['bank_name'],
                'account_holder_name' => $data['account_holder_name'],
                'account_number' => $data['account_number'],
                'ifsc_code' => strtoupper($data['ifsc_code']),
                'branch' => $data['branch'] ?? null,
                'account_type' => $data['account_type'] ?? 'Current Account',
                'is_primary' => $isPrimary,
                'status' => ucfirst($data['status'] ?? 'Active'),
                'remarks' => $data['remarks'] ?? null,
            ]);

            if ($isPrimary) {
                $profile->update([
                    'bank_name' => $account->bank_name,
                    'bank_branch' => $account->branch,
                    'bank_account' => $account->account_number,
                    'account_holder_name' => $account->account_holder_name,
                    'bank_ifsc' => $account->ifsc_code,
                    'account_type' => $account->account_type,
                ]);
            } else {
                $profile->touch();
            }

            return response()->json($account, 201);
        });
    }

    public function update(Request $request, int $clientId, int $bankId)
    {
        $this->assertClientsUnlocked($request);
        $profile = ClientProfile::findOrFail($clientId);
        $account = $profile->bankAccounts()->findOrFail($bankId);

        $data = $request->validate([
            'bank_name' => 'required|string|max:255',
            'account_holder_name' => 'required|string|max:255',
            'account_number' => 'required|string|max:50',
            'ifsc_code' => 'required|string|max:20',
            'branch' => 'nullable|string|max:255',
            'account_type' => 'nullable|string|max:50',
            'is_primary' => 'nullable|boolean',
            'status' => 'nullable|string|in:Active,Inactive,active,inactive',
            'remarks' => 'nullable|string|max:1000',
        ]);

        return DB::transaction(function () use ($data, $profile, $account) {
            $isPrimary = !empty($data['is_primary']);

            if ($isPrimary) {
                $profile->bankAccounts()->where('id', '!=', $account->id)->update(['is_primary' => false]);
            }

            $account->update([
                'bank_name' => $data['bank_name'],
                'account_holder_name' => $data['account_holder_name'],
                'account_number' => $data['account_number'],
                'ifsc_code' => strtoupper($data['ifsc_code']),
                'branch' => $data['branch'] ?? null,
                'account_type' => $data['account_type'] ?? 'Current Account',
                'is_primary' => $isPrimary,
                'status' => ucfirst($data['status'] ?? 'Active'),
                'remarks' => $data['remarks'] ?? null,
            ]);

            if ($isPrimary) {
                $profile->update([
                    'bank_name' => $account->bank_name,
                    'bank_branch' => $account->branch,
                    'bank_account' => $account->account_number,
                    'account_holder_name' => $account->account_holder_name,
                    'bank_ifsc' => $account->ifsc_code,
                    'account_type' => $account->account_type,
                ]);
            } else {
                $profile->touch();
            }

            return response()->json($account);
        });
    }

    public function destroy(Request $request, int $clientId, int $bankId)
    {
        $this->assertClientsUnlocked($request);
        $profile = ClientProfile::findOrFail($clientId);
        $account = $profile->bankAccounts()->findOrFail($bankId);

        return DB::transaction(function () use ($profile, $account) {
            $wasPrimary = $account->is_primary;
            $account->delete();

            if ($wasPrimary) {
                $nextPrimary = $profile->bankAccounts()->first();
                if ($nextPrimary) {
                    $nextPrimary->update(['is_primary' => true]);
                    $profile->update([
                        'bank_name' => $nextPrimary->bank_name,
                        'bank_branch' => $nextPrimary->branch,
                        'bank_account' => $nextPrimary->account_number,
                        'account_holder_name' => $nextPrimary->account_holder_name,
                        'bank_ifsc' => $nextPrimary->ifsc_code,
                        'account_type' => $nextPrimary->account_type,
                    ]);
                } else {
                    $profile->update([
                        'bank_name' => null,
                        'bank_branch' => null,
                        'bank_account' => null,
                        'account_holder_name' => null,
                        'bank_ifsc' => null,
                        'account_type' => null,
                    ]);
                }
            } else {
                $profile->touch();
            }

            return response()->json(['message' => 'Bank account deleted successfully.']);
        });
    }
}
