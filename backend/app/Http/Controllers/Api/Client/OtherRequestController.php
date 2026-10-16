<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Models\ClientOtherRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class OtherRequestController extends Controller
{
    private const REQUEST_TYPES = [
        'Profile Update',
        'Document Change',
        'Bank Details',
        'Invoice Settings',
        'Others',
    ];

    private const DOC_TYPES = [
        'tax_invoice', 'bill_of_supply', 'debit_note', 'credit_note', 'quotation', 'delivery_challan',
    ];

    private function profile(Request $request)
    {
        $profile = $request->user()->clientProfile;
        abort_unless($profile, 403);
        return $profile;
    }

    public function index(Request $request)
    {
        $rows = ClientOtherRequest::where('client_profile_id', $this->profile($request)->id)
            ->latest('id')
            ->paginate(25);

        $rows->getCollection()->transform(function ($r) {
            $r->request_id = $r->requestId();
            return $r;
        });

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'request_type'    => 'required|in:' . implode(',', self::REQUEST_TYPES),
            'document_type'   => 'nullable|in:' . implode(',', self::DOC_TYPES),
            'document_number' => 'nullable|string|max:80',
            'subject'         => 'required|string|max:200',
            'request_details' => 'required|string|max:5000',
            'please_specify'  => 'nullable|string|max:2000',
            'attachment'      => 'nullable|file|mimes:pdf,jpg,jpeg,png|max:5120',
        ]);

        if ($data['request_type'] === 'Others') {
            abort_if(empty($data['please_specify']), 422, 'Please specify your request when selecting Others.');
        }

        $profile = $this->profile($request);
        $path = null;

        if ($request->hasFile('attachment')) {
            $path = $request->file('attachment')->store("other-requests/{$profile->id}", 'local');
        }

        $req = ClientOtherRequest::create([
            'client_profile_id' => $profile->id,
            'submitted_by'      => $request->user()->id,
            'request_type'      => $data['request_type'],
            'document_type'     => $data['document_type'] ?? null,
            'document_number'   => $data['document_number'] ?? null,
            'subject'           => $data['subject'],
            'request_details'   => $data['request_details'],
            'please_specify'    => $data['please_specify'] ?? null,
            'attachment_path'   => $path,
            'status'            => 'pending',
        ]);

        return response()->json([
            'message'    => 'Your request has been submitted successfully.',
            'request_id' => $req->requestId(),
            'request'    => $req,
        ], 201);
    }

    public function show(Request $request, int $id)
    {
        $profile = $this->profile($request);
        $req = ClientOtherRequest::where('client_profile_id', $profile->id)->findOrFail($id);
        $req->request_id = $req->requestId();
        return response()->json($req);
    }
}
