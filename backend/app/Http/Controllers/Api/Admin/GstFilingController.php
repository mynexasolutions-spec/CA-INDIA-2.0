<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClientGstReturn;
use App\Models\GstFilingRequest;
use Illuminate\Http\Request;

class GstFilingController extends Controller
{
    public function index()
    {
        $requests = GstFilingRequest::with('clientProfile.user')
            ->orderBy('created_at', 'desc')
            ->get();
            
        return response()->json($requests);
    }

    public function show($id)
    {
        $filingRequest = GstFilingRequest::with(['clientProfile.user', 'documents'])
            ->findOrFail($id);

        $profile = $filingRequest->clientProfile;
        $due = $profile
            ? \App\Services\Billing\GstDueDate::dueDate($profile, (string) $filingRequest->return_type, (string) $filingRequest->filing_period)
            : null;

        return response()->json(array_merge($filingRequest->toArray(), [
            'meta' => [
                'taxpayer_type'    => $profile ? \App\Services\Billing\GstDueDate::taxpayerType($profile) : null,
                'filing_frequency' => $profile ? \App\Services\Billing\GstDueDate::frequencyLabel($profile, (string) $filingRequest->return_type) : null,
                'period_label'     => \App\Services\Billing\GstDueDate::periodLabel((string) $filingRequest->filing_period),
                'due_date'         => $due?->format('d F Y'),
                'request_date'     => $filingRequest->created_at?->format('d F Y'),
            ],
        ]));
    }

    public function updateStatus(Request $request, $id)
    {
        $request->validate([
            'status' => 'required|string|in:Pending CA Review,Approved for Filing,Correction Required,GST Filed',
            // Mandatory only for the "GST Filed" transition — the admin can't mark a
            // request filed without both, per spec.
            'filing_date' => 'required_if:status,GST Filed|date',
            'ack_no' => 'required_if:status,GST Filed|string|max:50',
        ]);

        $filingRequest = GstFilingRequest::findOrFail($id);
        $filingRequest->status = $request->status;

        if ($request->status === 'GST Filed') {
            $filingRequest->filing_date = $request->filing_date;
            $filingRequest->ack_no = $request->ack_no;
        }

        $filingRequest->save();

        // Keep the GSTR-3B request record (Admin screen / Client request list) in step with this filing request.
        $reqReturn = match (true) {
            $filingRequest->return_type === 'GSTR-3B' && preg_match('/^\d{4}-\d{2}$/', $filingRequest->filing_period) === 1 => \App\Models\ClientGstr3bRequest::RETURN_GSTR3B,
            $filingRequest->return_type === 'CMP-08' && preg_match('/^\d{4}-Q[1-4]$/', $filingRequest->filing_period) === 1 => \App\Models\ClientGstr3bRequest::RETURN_CMP08,
            default => null,
        };
        if ($reqReturn) {
            $open = \App\Models\ClientGstr3bRequest::where('client_profile_id', $filingRequest->client_profile_id)
                ->where('return_type', $reqReturn)
                ->where('tax_period', $filingRequest->filing_period);
            if ($request->status === 'GST Filed') {
                (clone $open)->whereIn('status', ['submitted', 'accepted'])->update(['status' => 'completed']);
            } elseif ($request->status === 'Correction Required') {
                (clone $open)->where('status', 'submitted')
                    ->update(['status' => 'rejected', 'rejection_reason' => 'Correction required by the administrator.']);
            }
        }

        // Admin Portal and Client Portal read the filing status from the same underlying
        // record: marking a request "GST Filed" here immediately upserts the matching
        // client_gst_returns row, so it shows up in Client Portal → GST Returns → Filing
        // History (and the Compliance Status widget) with no separate manual entry.
        if ($request->status === 'GST Filed') {
            ClientGstReturn::updateOrCreate(
                [
                    'client_profile_id' => $filingRequest->client_profile_id,
                    'tax_period' => $filingRequest->filing_period,
                    'return_type' => str_replace('-', '', $filingRequest->return_type), // 'GSTR-1' -> 'GSTR1'
                ],
                [
                    'status' => 'filed',
                    'filed_on' => $filingRequest->filing_date,
                    'ack_no' => $filingRequest->ack_no,
                    'filed_by' => $request->user()->id,
                ]
            );
        }

        return response()->json([
            'message' => 'Status updated successfully.',
            'request' => $filingRequest
        ]);
    }
}
