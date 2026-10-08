<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClientNote;
use App\Models\ClientProfile;
use Illuminate\Http\Request;

class ClientNoteController extends Controller
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
        return response()->json($profile->notes);
    }

    public function store(Request $request, int $clientId)
    {
        $this->assertClientsUnlocked($request);
        $profile = ClientProfile::findOrFail($clientId);

        $data = $request->validate([
            'note' => 'required|string|max:2000',
        ]);

        $note = $profile->notes()->create([
            'note' => $data['note'],
        ]);

        return response()->json($note, 201);
    }

    public function update(Request $request, int $clientId, int $noteId)
    {
        $this->assertClientsUnlocked($request);
        $profile = ClientProfile::findOrFail($clientId);
        $note = $profile->notes()->findOrFail($noteId);

        $data = $request->validate([
            'note' => 'required|string|max:2000',
        ]);

        $note->update([
            'note' => $data['note'],
        ]);

        return response()->json($note);
    }

    public function destroy(Request $request, int $clientId, int $noteId)
    {
        $this->assertClientsUnlocked($request);
        $profile = ClientProfile::findOrFail($clientId);
        $note = $profile->notes()->findOrFail($noteId);
        $note->delete();

        return response()->json(['message' => 'Note deleted successfully.']);
    }
}
