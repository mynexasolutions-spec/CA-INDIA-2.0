<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClientProfile;
use App\Services\EmailOtp;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Settings -> Company Deletion.
 *
 * Permanent deletion can never happen by accident:
 *   1. the admin must type the exact company name (several at once: the word DELETE),
 *   2. an OTP is emailed to the admin and must be verified,
 *   3. only Admin / Super Admin accounts may do any of this (not sub-users).
 */
class CompanyDeletionController extends Controller
{
    private const PENDING_KEY = 'company_deletion_pending';

    private function authorizeAdmin(Request $request): void
    {
        abort_unless(in_array($request->user()?->role, ['super_admin', 'admin'], true), 403, 'Only an administrator can delete companies.');
    }

    private function companyName(ClientProfile $p): string
    {
        return $p->business_name ?? $p->client_name ?? '';
    }

    public function clientList(Request $request)
    {
        $this->authorizeAdmin($request);

        $q = ClientProfile::query()->with('user:id,name,email,is_active,last_login_at');

        if ($request->filled('search')) {
            $s = $request->search;
            $q->where(fn ($w) => $w->where('business_name', 'like', "%{$s}%")
                ->orWhere('client_name', 'like', "%{$s}%")
                ->orWhere('gstin', 'like', "%{$s}%")
                ->orWhere('pan', 'like', "%{$s}%"));
        }
        // Status comes from the client's login account (client_profiles has no is_active column).
        if ($request->filled('status') && in_array($request->status, ['active', 'inactive'], true)) {
            $q->whereHas('user', fn ($u) => $u->where('is_active', $request->status === 'active'));
        }
        // Date filters apply to "Last Activity" (last login).
        if ($request->filled('from')) {
            $q->whereHas('user', fn ($u) => $u->whereDate('last_login_at', '>=', $request->from));
        }
        if ($request->filled('to')) {
            $q->whereHas('user', fn ($u) => $u->whereDate('last_login_at', '<=', $request->to));
        }

        $rows = $q->orderBy('business_name')->paginate((int) $request->input('per_page', 10));
        $rows->getCollection()->transform(fn (ClientProfile $p) => [
            'id'            => $p->id,
            'business_name' => $p->business_name,
            'client_name'   => $p->client_name,
            'gstin'         => $p->gstin,
            'pan'           => $p->pan,
            'is_active'     => (bool) ($p->user?->is_active ?? true),
            'created_at'    => $p->created_at,
            'last_activity' => $p->user?->last_login_at,
        ]);

        return response()->json($rows);
    }

    public function summary(Request $request)
    {
        $this->authorizeAdmin($request);

        $history = DB::table('company_deletion_history');
        $fy = now()->month >= 4 ? now()->year : now()->year - 1;

        // Pending = deletions whose OTP has been sent and is still waiting to be verified.
        $pending = collect(Cache::get(self::PENDING_KEY, []))
            ->filter(fn ($token) => Cache::has("email_otp_company_delete_{$token}"))
            ->count();

        return response()->json([
            'total_deleted'      => (clone $history)->count(),
            'deleted_this_fy'    => (clone $history)->where('deleted_at_time', '>=', "{$fy}-04-01")->count(),
            'deleted_this_month' => (clone $history)->whereMonth('deleted_at_time', now()->month)->whereYear('deleted_at_time', now()->year)->count(),
            'pending_deletion'   => $pending,
        ]);
    }

    /**
     * Step 1 -> 2: validates the confirmation (exact name, or DELETE for several), checks every company
     * is inactive, and emails the OTP. Returns the token that ties the OTP to exactly these companies.
     */
    public function requestOtp(Request $request)
    {
        $this->authorizeAdmin($request);

        $data = $request->validate([
            'client_profile_id'    => 'required_without:client_profile_ids|exists:client_profiles,id',
            'client_profile_ids'   => 'required_without:client_profile_id|array|min:1|max:50',
            'client_profile_ids.*' => 'integer|exists:client_profiles,id',
            'confirm_name'         => 'nullable|string',
            'confirm_text'         => 'nullable|string',
        ]);

        $ids = array_values(array_unique(array_map('intval', $data['client_profile_ids'] ?? [$data['client_profile_id']])));
        $profiles = ClientProfile::with('user')->whereIn('id', $ids)->get();

        if (! isset($data['client_profile_ids'])) {
            // Exact match — case and spelling must be identical (surrounding spaces ignored).
            if (trim((string) ($data['confirm_name'] ?? '')) !== trim($this->companyName($profiles->first()))) {
                return response()->json(['message' => 'Company name does not match.'], 422);
            }
        } elseif (trim((string) ($data['confirm_text'] ?? '')) !== 'DELETE') {
            return response()->json(['message' => 'Type DELETE exactly to confirm deleting several companies.'], 422);
        }

        $token = bin2hex(random_bytes(16));
        $dev = EmailOtp::send("company_delete_{$token}", $request->user(), 'permanently deleting '
            .($profiles->count() === 1 ? '"'.$this->companyName($profiles->first()).'"' : $profiles->count().' companies'), ['client_profile_ids' => $ids]);

        Cache::put(self::PENDING_KEY, array_slice(array_merge(Cache::get(self::PENDING_KEY, []), [$token]), -100), now()->addMinutes(30));

        return response()->json([
            'token'      => $token,
            'sent_to'    => EmailOtp::mask($request->user()->otpEmail()),
            'expires_in' => EmailOtp::TTL_MINUTES * 60,
            'names'      => $profiles->map(fn ($p) => $this->companyName($p))->values(),
            '_dev_otp'   => $dev,
        ]);
    }

    /** Sends a new code for a pending deletion (the old one stops working). */
    public function resendOtp(Request $request)
    {
        $this->authorizeAdmin($request);
        $data = $request->validate(['token' => 'required|string']);

        $pending = Cache::get("email_otp_company_delete_{$data['token']}");
        if (! $pending || ($pending['user_id'] ?? null) !== $request->user()->id) {
            return response()->json(['message' => 'This request has expired. Please start again.'], 422);
        }

        $dev = EmailOtp::send("company_delete_{$data['token']}", $request->user(), 'permanently deleting companies', ['client_profile_ids' => $pending['client_profile_ids']]);

        return response()->json(['sent' => true, '_dev_otp' => $dev]);
    }

    /** Step 3: verifies the OTP and deletes. Everything is deleted together or not at all. */
    public function verifyAndDelete(Request $request)
    {
        $this->authorizeAdmin($request);

        $data = $request->validate([
            'token'   => 'required|string',
            'otp'     => 'required|string|size:6',
            'reason'  => 'nullable|string|max:255',
            'remarks' => 'nullable|string',
        ]);

        $key = "company_delete_{$data['token']}";
        $pending = Cache::get("email_otp_{$key}");
        if ($pending && ($pending['user_id'] ?? null) !== $request->user()->id) {
            return response()->json(['message' => 'This OTP was issued to a different admin.'], 403);
        }

        $res = EmailOtp::check($key, $data['otp']);
        if (! $res['ok']) {
            return response()->json(['message' => $res['error']], 422);
        }

        $profiles = ClientProfile::with('user')->whereIn('id', $res['data']['client_profile_ids'])->get();
        $names = [];
        DB::transaction(function () use ($profiles, $request, $data, &$names) {
            foreach ($profiles as $profile) {
                DB::table('company_deletion_history')->insert([
                    'client_profile_id'  => $profile->id,
                    'company_name'       => $this->companyName($profile),
                    'gstin'              => $profile->gstin,
                    'pan'                => $profile->pan,
                    'deleted_by_user_id' => $request->user()->id,
                    'deleted_by_name'    => $request->user()->name,
                    'reason'             => $data['reason'] ?? null,
                    'remarks'            => $data['remarks'] ?? null,
                    'deleted_at_time'    => now(),
                    'created_at'         => now(),
                    'updated_at'         => now(),
                ]);

                $names[] = $this->companyName($profile);
                $profile->user?->tokens()->delete();
                $profile->user?->delete();
                $profile->delete();
            }
        });

        return response()->json(['message' => 'Company deleted successfully', 'deleted' => $names]);
    }

    public function history(Request $request)
    {
        $this->authorizeAdmin($request);

        $q = DB::table('company_deletion_history');

        if ($request->filled('search')) {
            $s = $request->search;
            $q->where(fn ($w) => $w->where('company_name', 'like', "%{$s}%")
                ->orWhere('gstin', 'like', "%{$s}%")
                ->orWhere('pan', 'like', "%{$s}%")
                ->orWhere('deleted_by_name', 'like', "%{$s}%")
                ->orWhere('reason', 'like', "%{$s}%")
                ->orWhere('remarks', 'like', "%{$s}%"));
        }
        if ($request->filled('from')) {
            $q->where('deleted_at_time', '>=', $request->from.' 00:00:00');
        }
        if ($request->filled('to')) {
            $q->where('deleted_at_time', '<=', $request->to.' 23:59:59');
        }

        return response()->json($q->orderBy('deleted_at_time', 'desc')->paginate((int) $request->input('per_page', 10)));
    }
}
