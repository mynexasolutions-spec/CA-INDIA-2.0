<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClientProfile;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class StaffController extends Controller
{
    public function index(Request $request)
    {
        $q = User::whereIn('role', ['admin', 'staff']);

        if ($request->filled('search')) {
            $s = $request->search;
            $q->where(fn($w) => $w->where('name', 'like', "%{$s}%")
                ->orWhere('email', 'like', "%{$s}%")
                ->orWhere('role', 'like', "%{$s}%"));
        }
        if ($request->filled('status') && $request->status !== 'all') {
            $q->where('is_active', $request->status === 'active');
        }
        if ($request->filled('role') && $request->role !== 'all') {
            $q->where('role', $request->role);
        }

        $rows = $q->orderBy('name')->paginate((int) $request->input('per_page', 10));

        $total   = User::whereIn('role', ['admin', 'staff'])->count();
        $active  = User::whereIn('role', ['admin', 'staff'])->where('is_active', true)->count();
        $inactive = $total - $active;
        $assigned = DB::table('staff_client_assignments')->distinct('user_id')->count('user_id');

        return response()->json([
            'data'      => $rows->items(),
            'total'     => $rows->total(),
            'last_page' => $rows->lastPage(),
            'summary'   => compact('total', 'active', 'inactive', 'assigned'),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'     => 'required|string|max:255',
            'email'    => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'role'     => 'required|in:admin,staff',
            'phone'    => 'nullable|string|max:20',
        ]);
        $user = User::create([
            'name'      => $data['name'],
            'email'     => $data['email'],
            'password'  => Hash::make($data['password']),
            'role'      => $data['role'],
            'phone'     => $data['phone'] ?? null,
            'is_active' => true,
        ]);
        return response()->json($user, 201);
    }

    public function update(Request $request, int $id)
    {
        $user = User::whereIn('role', ['admin', 'staff'])->findOrFail($id);
        $data = $request->validate([
            'name'      => 'required|string|max:255',
            'email'     => "required|email|unique:users,email,{$id}",
            'role'      => 'required|in:admin,staff',
            'phone'     => 'nullable|string|max:20',
            'is_active' => 'boolean',
        ]);
        $user->update($data);
        return response()->json($user);
    }

    public function resetPassword(Request $request, int $id)
    {
        $user = User::whereIn('role', ['admin', 'staff'])->findOrFail($id);
        $data = $request->validate(['password' => 'required|string|min:8']);
        $user->update(['password' => Hash::make($data['password'])]);
        return response()->json(['message' => 'Password reset successfully']);
    }

    public function destroy(int $id)
    {
        $user = User::whereIn('role', ['admin', 'staff'])->findOrFail($id);
        DB::table('staff_client_assignments')->where('user_id', $id)->delete();
        $user->delete();
        return response()->json(['message' => 'Staff member deleted']);
    }

    public function getAssignments(int $id)
    {
        $assignments = DB::table('staff_client_assignments')
            ->where('user_id', $id)->get();
        $clientIds = $assignments->pluck('client_profile_id');
        $clients   = ClientProfile::with('user:id,name,email,is_active')->get();

        return response()->json([
            'assigned_client_ids' => $clientIds,
            'assignments'         => $assignments,
            'clients'             => $clients,
        ]);
    }

    public function saveAssignments(Request $request, int $id)
    {
        $user = User::whereIn('role', ['admin', 'staff'])->findOrFail($id);
        $data = $request->validate([
            'assignments' => 'present|array',
        ]);

        DB::table('staff_client_assignments')->where('user_id', $id)->delete();

        foreach ($data['assignments'] as $key => $val) {
            $clientId = is_array($val) && isset($val['client_profile_id']) ? (int) $val['client_profile_id'] : (int) $key;
            $perms = is_array($val) && isset($val['module_permissions']) ? $val['module_permissions'] : $val;

            if ($clientId > 0) {
                DB::table('staff_client_assignments')->insert([
                    'user_id'            => $id,
                    'client_profile_id'  => $clientId,
                    'module_permissions' => is_string($perms) ? $perms : json_encode($perms),
                    'created_at'         => now(),
                    'updated_at'         => now(),
                ]);
            }
        }

        return response()->json(['message' => 'Assignments saved']);
    }
}
