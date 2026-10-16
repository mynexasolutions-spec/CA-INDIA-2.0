<?php

namespace App\Http\Controllers\Api\Billing\Concerns;

use App\Models\ClientProfile;
use Illuminate\Http\Request;

/**
 * Which client's billing data a request is about.
 *
 * - Client Portal: always the logged-in client's own profile.
 * - Admin Portal: the read-only report routes carry a {clientId}; only staff may use them, and
 *   they then get exactly what that client sees — the same controller, the same code, the same
 *   numbers. (A client can never reach another client's data: client routes have no {clientId}.)
 */
trait ResolvesBillingProfile
{
    protected function resolveBillingProfile(Request $request): ClientProfile
    {
        $routeClient = $request->route('clientId');

        if ($routeClient !== null) {
            abort_unless($request->user()?->isStaff(), 403);

            return ClientProfile::findOrFail((int) $routeClient);
        }

        $profile = $request->user()->clientProfile;
        abort_unless($profile, 403);

        return $profile;
    }
}
