<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Models\ClientAmendmentRequest;
use App\Models\CommercialDocument;
use Illuminate\Http\Request;

class AmendmentRequestController extends Controller
{
    private function profile(Request $request)
    {
        $profile = $request->user()->clientProfile;
        abort_unless($profile, 403);
        return $profile;
    }

    public function index(Request $request)
    {
        $rows = ClientAmendmentRequest::where('client_profile_id', $this->profile($request)->id)
            ->latest('id')
            ->paginate(25);

        return response()->json(['data' => $rows]);
    }

    public function lookup(Request $request)
    {
        $data = $request->validate([
            'document_type' => 'required|in:tax_invoice,bill_of_supply,credit_note,debit_note',
            'bill_number'   => 'required|string|max:80',
        ]);

        $profile = $this->profile($request);
        $doc = CommercialDocument::where('client_profile_id', $profile->id)
            ->where('type', $data['document_type'])
            ->where('number', $data['bill_number'])
            ->with('customer:id,name,gstin,gst_status')
            ->first();

        abort_unless($doc, 404, 'Document not found. Please check the document type and number.');
        abort_unless(
            in_array($doc->status, ['issued', 'paid', 'partial'], true),
            422,
            'Only issued documents are eligible for amendment.'
        );

        return response()->json([
            'id'            => $doc->id,
            'bill_number'   => $doc->number,
            'document_date' => $doc->document_date,
            'customer_name' => $doc->customer?->name,
            'gstin'         => $doc->customer?->gstin ?? $doc->customer?->gstin_display,
            'amount'        => $doc->grand_total ?: $doc->total_amount,
            'status'        => $doc->status,
            'type'          => $doc->type,
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'document_type' => 'required|in:tax_invoice,bill_of_supply,credit_note,debit_note',
            'bill_number'   => 'required|string|max:80',
            'reason'        => 'required|string|max:120',
            'remarks'       => 'required|string|max:2000',
        ]);

        $profile = $this->profile($request);
        $doc = CommercialDocument::where('client_profile_id', $profile->id)
            ->where('type', $data['document_type'])
            ->where('number', $data['bill_number'])
            ->with('customer:id,name,gstin,gst_status')
            ->first();

        abort_unless($doc, 404, 'Document not found.');
        abort_unless(in_array($doc->status, ['issued', 'paid', 'partial'], true), 422, 'Only issued documents are eligible for amendment.');

        $pending = ClientAmendmentRequest::where('commercial_document_id', $doc->id)
            ->whereIn('status', ['pending'])
            ->exists();
        abort_if($pending, 422, 'An amendment request is already pending for this document.');

        $req = ClientAmendmentRequest::create([
            'client_profile_id'    => $profile->id,
            'commercial_document_id' => $doc->id,
            'submitted_by'         => $request->user()->id,
            'document_type'        => $doc->type,
            'bill_number'          => $doc->number,
            'document_date'        => $doc->document_date,
            'customer_name'        => $doc->customer?->name,
            'gstin'                => $doc->customer?->gstin ?? $doc->customer?->gstin_display,
            'original_amount'      => $doc->grand_total ?: $doc->total_amount,
            'reason'               => $data['reason'],
            'remarks'              => $data['remarks'],
            'status'               => 'pending',
        ]);

        return response()->json([
            'message' => 'Your amendment request has been submitted successfully.',
            'request' => $req,
        ], 201);
    }

    public function show(Request $request, int $id)
    {
        $profile = $this->profile($request);
        $req = ClientAmendmentRequest::where('client_profile_id', $profile->id)
            ->with(['amendmentDocument'])
            ->findOrFail($id);

        return response()->json($req);
    }
}
