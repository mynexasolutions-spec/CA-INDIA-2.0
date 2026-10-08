<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\Lookup\LookupService;
use Illuminate\Http\Request;

class LookupController extends Controller
{
    public function __construct(
        protected LookupService $lookupService
    ) {}

    public function pin(Request $request, string $pin)
    {
        $result = $this->lookupService->lookupPin($pin);

        return response()->json($result);
    }

    public function ifsc(Request $request, string $ifsc)
    {
        $result = $this->lookupService->lookupIfsc($ifsc);

        return response()->json($result);
    }
}
