<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClientAdditionalInfo;
use App\Models\ClientProfile;
use Illuminate\Http\Request;

class ClientAdditionalInfoController extends Controller
{
    private function assertClientsUnlocked(Request $request): void
    {
        abort_unless(
            ClientsUnlockController::isUnlocked($request->user()->id),
            403,
            'Clients module is locked. Enter your administrator password to continue.'
        );
    }

    public function index(Request $request, int $clientId)
    {
        $this->assertClientsUnlocked($request);
        $profile = ClientProfile::findOrFail($clientId);

        $records = ClientAdditionalInfo::where('client_profile_id', $profile->id)
            ->latest('updated_at')
            ->get();

        return response()->json($records);
    }

    public function store(Request $request, int $clientId)
    {
        $this->assertClientsUnlocked($request);
        $profile = ClientProfile::findOrFail($clientId);

        $data = $request->validate([
            'information' => 'required|string|max:255',
            'remarks' => 'required|string|max:1000',
        ]);

        $record = ClientAdditionalInfo::create([
            'client_profile_id' => $profile->id,
            'information' => $data['information'],
            'remarks' => $data['remarks'],
        ]);

        $profile->touch();

        return response()->json($record, 201);
    }

    public function update(Request $request, int $clientId, int $infoId)
    {
        $this->assertClientsUnlocked($request);
        $profile = ClientProfile::findOrFail($clientId);
        $record = ClientAdditionalInfo::where('client_profile_id', $profile->id)->findOrFail($infoId);

        $data = $request->validate([
            'information' => 'required|string|max:255',
            'remarks' => 'required|string|max:1000',
        ]);

        $record->update($data);
        $profile->touch();

        return response()->json($record);
    }

    public function destroy(Request $request, int $clientId, int $infoId)
    {
        $this->assertClientsUnlocked($request);
        $profile = ClientProfile::findOrFail($clientId);
        $record = ClientAdditionalInfo::where('client_profile_id', $profile->id)->findOrFail($infoId);

        $record->delete();
        $profile->touch();

        return response()->json(['message' => 'Information record deleted.']);
    }
}
