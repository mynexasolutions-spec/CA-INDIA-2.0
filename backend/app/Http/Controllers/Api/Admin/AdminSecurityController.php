<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

/** Settings -> Admin Security (login method, Clients-module verification, secondary password). */
class AdminSecurityController extends Controller
{
    private function payload($user): array
    {
        return [
            'login_method'           => $user->login_2fa_enabled ? '2fa' : 'password',
            'clients_verify'         => $user->clients_verify_method === '2fa' ? '2fa' : 'secondary',
            'secondary_password_set' => ! empty($user->clients_secondary_password),
        ];
    }

    public function show(Request $request)
    {
        return response()->json($this->payload($request->user()));
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'login_method'   => 'sometimes|in:password,2fa',
            'clients_verify' => 'sometimes|in:secondary,2fa',
        ]);
        $user = $request->user();

        if (($data['clients_verify'] ?? null) === 'secondary' && empty($user->clients_secondary_password)) {
            throw ValidationException::withMessages(['clients_verify' => ['Set a secondary password first, then choose this option.']]);
        }

        if (isset($data['login_method'])) {
            $user->login_2fa_enabled = $data['login_method'] === '2fa';
        }
        if (isset($data['clients_verify'])) {
            $user->clients_verify_method = $data['clients_verify'];
        }
        $user->save();

        return response()->json($this->payload($user) + ['message' => 'Security settings saved.']);
    }

    /**
     * Set or change the secondary password for the Clients module.
     * The first time, "current password" is the admin login password; afterwards it is the
     * existing secondary password. The secondary password must differ from the login password.
     */
    public function setSecondaryPassword(Request $request)
    {
        $data = $request->validate([
            'current_password' => 'required|string',
            'password'         => ['required', 'string', 'confirmed', Password::min(8)->letters()->numbers()->symbols()],
        ]);
        $user = $request->user();

        $currentOk = empty($user->clients_secondary_password)
            ? Hash::check($data['current_password'], $user->password)
            : Hash::check($data['current_password'], $user->clients_secondary_password);
        if (! $currentOk) {
            throw ValidationException::withMessages(['current_password' => ['Current password is incorrect.']]);
        }

        if (Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages(['password' => ['The secondary password must be different from your login password.']]);
        }

        $user->update(['clients_secondary_password' => Hash::make($data['password'])]);

        return response()->json($this->payload($user->fresh()) + ['message' => 'Secondary password updated successfully.']);
    }
}
