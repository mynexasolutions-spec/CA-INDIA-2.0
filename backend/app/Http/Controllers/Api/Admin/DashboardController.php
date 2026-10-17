<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClientChangeRequest;
use App\Models\ClientGstReturn;
use App\Models\ClientGstr3bRequest;
use App\Models\ClientProfile;
use App\Services\ClientRequestFeed;
use App\Services\Gst\Cmp08Period;
use Illuminate\Http\Request;
use App\Models\DocumentEditRequest;
use App\Models\GstFilingRequest;
use App\Models\User;
use App\Services\Gst\GstPeriodService;
use Carbon\Carbon;

class DashboardController extends Controller
{
    public function index(Request $request)
    {
        // The header's Financial Year: limits the request counts below to that period.
        $from = $request->filled('from') ? (string) $request->input('from') : null;
        $to = $request->filled('to') ? (string) $request->input('to') : null;

        $now = now();
        $today = $now->copy()->startOfDay();

        // 1. Client Totals
        $totalClients = ClientProfile::count();
        $activeClients = ClientProfile::whereHas('user', fn ($q) => $q->where('is_active', true))->count();
        $inactiveClients = $totalClients - $activeClients;

        // 2. Client Request Overview (5 rows per spec)
        // Mapping:
        // - Profile Update: No matching section exists today. Show 0 and flag for lead.
        // - Document Change = document_edit_requests
        // - Bank Details = client_change_requests section 'bank'
        // - Invoice Settings = client_change_requests section 'invoice_settings'
        // - Others = client_change_requests sections other than bank & invoice_settings
        // Real sources, one status vocabulary (pending / approved / rejected):
        //  - the Request module (client "Other Request" form + invoice amendments), where Admin marks
        //    a request Completed (= approved) or Rejected,
        //  - Settings change requests (bank / invoice settings ...) and document edit requests.
        $feed = ClientRequestFeed::countsByType($from, $to);
        $inRange = fn ($q) => $q
            ->when($from, fn ($w) => $w->whereDate('created_at', '>=', $from))
            ->when($to, fn ($w) => $w->whereDate('created_at', '<=', $to));
        $fromFeed = fn (array $types) => [
            'total' => array_sum(array_map(fn ($t) => $feed[$t]['total'], $types)),
            'pending' => array_sum(array_map(fn ($t) => $feed[$t]['pending'], $types)),
            'approved' => array_sum(array_map(fn ($t) => $feed[$t]['completed'], $types)),
            'rejected' => array_sum(array_map(fn ($t) => $feed[$t]['rejected'], $types)),
        ];

        // One source for the Dashboard and the Request page, so both always show the same numbers.
        $profileC = $fromFeed(['profile_update']);
        $docC = $fromFeed(['document_change']);
        $bankC = $fromFeed(['bank_details']);
        $invC = $fromFeed(['invoice_setting']);
        $otherC = $fromFeed(['other', 'invoice_amendment']);

        [$docTotal, $docPending, $docApproved, $docRejected] = array_values($docC);
        [$bankTotal, $bankPending, $bankApproved, $bankRejected] = array_values($bankC);
        [$invTotal, $invPending, $invApproved, $invRejected] = array_values($invC);
        [$otherTotal, $otherPending, $otherApproved, $otherRejected] = array_values($otherC);

        $clientRequestsRows = [
            [
                'key' => 'profile_update',
                'title' => 'Profile Update',
                'icon' => 'user',
                'total' => $profileC['total'],
                'pending' => $profileC['pending'],
                'approved' => $profileC['approved'],
                'rejected' => $profileC['rejected'],
                'action_url' => '/admin/requests',
            ],
            [
                'key' => 'document_change',
                'title' => 'Document Change',
                'icon' => 'document',
                'total' => $docTotal,
                'pending' => $docPending,
                'approved' => $docApproved,
                'rejected' => $docRejected,
                'action_url' => '/admin/requests',
            ],
            [
                'key' => 'bank_details',
                'title' => 'Bank Details',
                'icon' => 'bank',
                'total' => $bankTotal,
                'pending' => $bankPending,
                'approved' => $bankApproved,
                'rejected' => $bankRejected,
                'action_url' => '/admin/requests',
            ],
            [
                'key' => 'invoice_settings',
                'title' => 'Invoice Settings',
                'icon' => 'settings',
                'total' => $invTotal,
                'pending' => $invPending,
                'approved' => $invApproved,
                'rejected' => $invRejected,
                'action_url' => '/admin/requests',
            ],
            [
                'key' => 'others',
                'title' => 'Others',
                'icon' => 'dots',
                'total' => $otherTotal,
                'pending' => $otherPending,
                'approved' => $otherApproved,
                'rejected' => $otherRejected,
                'action_url' => '/admin/requests',
            ],
        ];

        $totalClientRequests = array_sum(array_column($clientRequestsRows, 'total'));
        $pendingClientRequests = array_sum(array_column($clientRequestsRows, 'pending'));

        // 3. GST Filing Requests — only requests where something is still pending:
        //    Confirmation Received + Filing Pending, or Confirmation Pending + Filing Not Started.
        //    Received + Filed (the whole process is done) is never listed.
        $filingInRange = fn ($q) => $q
            ->when($from, fn ($w) => $w->whereDate('created_at', '>=', $from))
            ->when($to, fn ($w) => $w->whereDate('created_at', '<=', $to));

        $dueFor = function (string $returnType, ?string $period, $fallback) {
            if ($period && preg_match('/^(\d{4})-(\d{2})$/', $period, $m)) {
                $day = $returnType === 'GSTR-1' ? 11 : 20;

                return Carbon::createFromDate((int) $m[1], (int) $m[2], 1)->addMonth()->day($day);
            }
            if ($period && ($q = Cmp08Period::parse($period))) {
                // Quarter ends -> due the 22nd (GSTR-3B) / 18th (CMP-08) of the following month.
                $endMonth = Carbon::createFromDate($q[1] === 'Q4' ? $q[0] + 1 : $q[0], ['Q1' => 6, 'Q2' => 9, 'Q3' => 12, 'Q4' => 3][$q[1]], 1);

                return $endMonth->addMonth()->day($returnType === 'CMP-08' ? 18 : 22);
            }

            return $fallback;
        };

        $filedRequests = GstFilingRequest::where('status', 'GST Filed');
        $openFilings = $filingInRange(GstFilingRequest::with('clientProfile')->where('status', '!=', 'GST Filed'));
        $awaitingClient = $filingInRange(ClientGstr3bRequest::with('client')->where('status', ClientGstr3bRequest::PENDING_CLIENT));
        $acceptedByClient = $filingInRange(ClientGstr3bRequest::with('client')->where('status', ClientGstr3bRequest::ACCEPTED));

        $rows = collect();
        foreach ((clone $awaitingClient)->get() as $r) {
            $rt = $r->return_label;
            $rows->push([
                'sort' => $r->created_at, 'id' => 'r'.$r->id,
                'client_name' => $r->client?->business_name ?: $r->client?->client_name ?: 'N/A',
                'return_type' => $rt,
                'due_date' => $dueFor($rt, $r->tax_period, $now)->format('d M Y'),
                'confirmation_status' => 'Pending',
                'filing_status' => 'Not Started',
                'raw_status' => $r->status,
                'action_url' => $r->return_type === ClientGstr3bRequest::RETURN_CMP08 ? '/admin/cmp08' : '/admin/gst-returns?tab=gstr-3b',
            ]);
        }
        foreach ((clone $acceptedByClient)->get() as $r) {
            $rt = $r->return_label;
            $rows->push([
                'sort' => $r->created_at, 'id' => 'r'.$r->id,
                'client_name' => $r->client?->business_name ?: $r->client?->client_name ?: 'N/A',
                'return_type' => $rt,
                'due_date' => $dueFor($rt, $r->tax_period, $now)->format('d M Y'),
                'confirmation_status' => 'Received',
                'filing_status' => 'Pending',
                'raw_status' => $r->status,
                'action_url' => $r->return_type === ClientGstr3bRequest::RETURN_CMP08 ? '/admin/cmp08' : '/admin/gst-returns?tab=gstr-3b',
            ]);
        }
        foreach ((clone $openFilings)->get() as $req) {
            $rows->push([
                'sort' => $req->created_at, 'id' => $req->id,
                'client_name' => $req->clientProfile?->business_name ?: $req->clientProfile?->client_name ?: 'N/A',
                'return_type' => $req->return_type,
                'due_date' => $dueFor($req->return_type, $req->filing_period, $req->created_at?->copy()->addDays(15) ?? $now)->format('d M Y'),
                // The client declares and confirms when raising the request, so confirmation is in.
                'confirmation_status' => 'Received',
                'filing_status' => 'Pending',
                'raw_status' => $req->status,
                'action_url' => "/admin/gst-filing-requests/{$req->id}",
            ]);
        }
        $filingRequestsList = $rows->sortByDesc('sort')->take(10)->map(fn ($r) => collect($r)->except('sort')->all())->values();

        $confPendingGstFilingRequests = (clone $awaitingClient)->count();
        $confirmedGstFilingRequests = (clone $openFilings)->count() + (clone $acceptedByClient)->count();
        $filedGstFilingRequests = $filingInRange($filedRequests)->count();
        $totalGstFilingRequests = $confPendingGstFilingRequests + $confirmedGstFilingRequests + $filedGstFilingRequests;
        $pendingGstFilingRequests = $confPendingGstFilingRequests + $confirmedGstFilingRequests;

        // 4. GST Return Status (Current Filing Cycle)
        // We evaluate applicable GST clients
        $gstClients = ClientProfile::where('has_gst', true)->get();

        $prevMonthDate = $now->copy()->subMonth();
        $prevMonthPeriod = $prevMonthDate->format('Y-m');
        // In Jan / Apr / Jul / Oct the quarter that just ended is the previous FINANCIAL-YEAR quarter,
        // keyed "FYSTART-Qn" (e.g. Apr 2026 -> the Jan-Mar 2026 quarter = "2025-Q4").
        $prevQuarterPeriod = Cmp08Period::keyForDate($now->copy()->subMonth());
        $isQuarterDueMonth = in_array($now->month, [1, 4, 7, 10], true);

        $returnsPendingCount = 0;
        $returnsOverdueCount = 0;
        $returnsFiledCount = 0;
        $unfiledReturnRows = [];

        foreach ($gstClients as $client) {
            $isComposition = $client->dealer_type === 'composition';
            $frequency = $client->gst_filing_frequency ?? 'monthly';
            $isQuarterly = $isComposition || $frequency === 'quarterly';

            $applicableReturns = [];
            if ($isComposition) {
                // Composition: CMP-08 is quarterly — it is only due (18th) in Jan / Apr / Jul / Oct.
                if ($isQuarterDueMonth) {
                    $applicableReturns[] = [
                        'return_type' => 'CMP-08',
                        'db_type' => ClientGstReturn::TYPE_CMP08,
                        'period' => $prevQuarterPeriod,
                        'due_date' => Carbon::createFromDate($now->year, $now->month, 18),
                    ];
                }
            } else {
                if ($frequency === 'monthly') {
                    // Regular Monthly: GSTR-1 (11th) and GSTR-3B (20th)
                    $applicableReturns[] = [
                        'return_type' => 'GSTR-1',
                        'db_type' => ClientGstReturn::TYPE_GSTR1,
                        'period' => $prevMonthPeriod,
                        'due_date' => Carbon::createFromDate($now->year, $now->month, 11),
                    ];
                    $applicableReturns[] = [
                        'return_type' => 'GSTR-3B',
                        'db_type' => ClientGstReturn::TYPE_GSTR3B,
                        'period' => $prevMonthPeriod,
                        'due_date' => Carbon::createFromDate($now->year, $now->month, 20),
                    ];
                } else {
                    // Regular QRMP: GSTR-1 IFF (13th) and GSTR-3B (22nd in quarter end month)
                    $applicableReturns[] = [
                        'return_type' => 'GSTR-1',
                        'db_type' => ClientGstReturn::TYPE_GSTR1,
                        'period' => $prevMonthPeriod,
                        'due_date' => Carbon::createFromDate($now->year, $now->month, 13),
                    ];
                    if ($isQuarterDueMonth) {
                        $applicableReturns[] = [
                            'return_type' => 'GSTR-3B',
                            'db_type' => ClientGstReturn::TYPE_GSTR3B,
                            'period' => $prevQuarterPeriod,
                            'due_date' => Carbon::createFromDate($now->year, $now->month, 22),
                        ];
                    }
                }
            }

            foreach ($applicableReturns as $ret) {
                // If period is before client's applicable_from date, it is Non-Applicable
                if (! GstPeriodService::isPeriodApplicable($ret['period'], $client->applicable_from)) {
                    continue;
                }

                // Check if filed in DB
                $isFiled = ClientGstReturn::where('client_profile_id', $client->id)
                    ->where('return_type', $ret['db_type'])
                    ->where('tax_period', $ret['period'])
                    ->where('status', 'filed')
                    ->exists();

                if ($isFiled) {
                    $returnsFiledCount++;
                } else {
                    $isOverdue = $ret['due_date']->copy()->startOfDay()->lt($today);
                    $status = $isOverdue ? 'Overdue' : 'Pending';
                    if ($isOverdue) {
                        $returnsOverdueCount++;
                    } else {
                        $returnsPendingCount++;
                    }

                    // Table only shows unfiled returns (Pending / Due / Overdue)
                    $unfiledReturnRows[] = [
                        'id' => $client->id,
                        'client_name' => $client->business_name ?: $client->client_name ?: 'N/A',
                        'gstin' => $client->gstin ?: '—',
                        'return_type' => $ret['return_type'],
                        'due_date' => $ret['due_date']->format('d M Y'),
                        'due_date_raw' => $ret['due_date']->toDateString(),
                        'status' => $status,
                        'action_url' => '/admin/gst-returns',
                    ];
                }
            }
        }

        // Sort unfiled return rows by due_date ascending
        usort($unfiledReturnRows, fn ($a, $b) => strcmp($a['due_date_raw'], $b['due_date_raw']));
        $gstReturnsTable = array_slice($unfiledReturnRows, 0, 10);

        // 5. Upcoming Due Dates (Current Month per spec)
        $upcomingDueDates = GstPeriodService::getUpcomingDueDates($now);

        return response()->json([
            'overview' => [
                'total_clients' => $totalClients,
                'active_clients' => $activeClients,
                'inactive_clients' => $inactiveClients,
                'client_requests' => $totalClientRequests,
                'client_requests_pending' => $pendingClientRequests,
                'gst_filing_requests' => $totalGstFilingRequests,
                'gst_filing_requests_pending' => $pendingGstFilingRequests,
            ],
            'gst_return_summary' => [
                'total_returns_due' => $returnsPendingCount + $returnsOverdueCount + $returnsFiledCount,
                'pending' => $returnsPendingCount,
                'overdue' => $returnsOverdueCount,
                'filed' => $returnsFiledCount,
            ],
            'filing_request_summary' => [
                'total_requests' => $totalGstFilingRequests,
                'confirmation_pending' => $confPendingGstFilingRequests,
                'confirmed' => $confirmedGstFilingRequests,
                'filed' => $filedGstFilingRequests,
            ],
            'gst_returns_table' => $gstReturnsTable,
            'gst_filing_requests_table' => $filingRequestsList,
            'client_requests_overview' => $clientRequestsRows,
            'upcoming_due_dates' => $upcomingDueDates,
        ]);
    }
}
