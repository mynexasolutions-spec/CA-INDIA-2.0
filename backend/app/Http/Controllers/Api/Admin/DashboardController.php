<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClientChangeRequest;
use App\Models\ClientGstReturn;
use App\Models\ClientProfile;
use App\Models\DocumentEditRequest;
use App\Models\GstFilingRequest;
use App\Models\User;
use App\Services\Gst\GstPeriodService;
use Carbon\Carbon;

class DashboardController extends Controller
{
    public function index()
    {
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
        $docTotal = DocumentEditRequest::count();
        $docPending = DocumentEditRequest::where('status', 'pending')->count();
        $docApproved = DocumentEditRequest::where('status', 'approved')->count();
        $docRejected = DocumentEditRequest::where('status', 'rejected')->count();

        $bankTotal = ClientChangeRequest::where('section', 'bank')->count();
        $bankPending = ClientChangeRequest::where('section', 'bank')->where('status', 'pending')->count();
        $bankApproved = ClientChangeRequest::where('section', 'bank')->where('status', 'approved')->count();
        $bankRejected = ClientChangeRequest::where('section', 'bank')->where('status', 'rejected')->count();

        $invTotal = ClientChangeRequest::where('section', 'invoice_settings')->count();
        $invPending = ClientChangeRequest::where('section', 'invoice_settings')->where('status', 'pending')->count();
        $invApproved = ClientChangeRequest::where('section', 'invoice_settings')->where('status', 'approved')->count();
        $invRejected = ClientChangeRequest::where('section', 'invoice_settings')->where('status', 'rejected')->count();

        $otherTotal = ClientChangeRequest::whereNotIn('section', ['bank', 'invoice_settings'])->count();
        $otherPending = ClientChangeRequest::whereNotIn('section', ['bank', 'invoice_settings'])->where('status', 'pending')->count();
        $otherApproved = ClientChangeRequest::whereNotIn('section', ['bank', 'invoice_settings'])->where('status', 'approved')->count();
        $otherRejected = ClientChangeRequest::whereNotIn('section', ['bank', 'invoice_settings'])->where('status', 'rejected')->count();

        $clientRequestsRows = [
            [
                'key' => 'profile_update',
                'title' => 'Profile Update',
                'icon' => 'user',
                'total' => 0,
                'pending' => 0,
                'approved' => 0,
                'rejected' => 0,
                'action_url' => '/admin/pending-approval',
                'note' => 'No DB request section exists today; flagged for lead',
            ],
            [
                'key' => 'document_change',
                'title' => 'Document Change',
                'icon' => 'document',
                'total' => $docTotal,
                'pending' => $docPending,
                'approved' => $docApproved,
                'rejected' => $docRejected,
                'action_url' => '/admin/edit-requests',
            ],
            [
                'key' => 'bank_details',
                'title' => 'Bank Details',
                'icon' => 'bank',
                'total' => $bankTotal,
                'pending' => $bankPending,
                'approved' => $bankApproved,
                'rejected' => $bankRejected,
                'action_url' => '/admin/pending-approval',
            ],
            [
                'key' => 'invoice_settings',
                'title' => 'Invoice Settings',
                'icon' => 'settings',
                'total' => $invTotal,
                'pending' => $invPending,
                'approved' => $invApproved,
                'rejected' => $invRejected,
                'action_url' => '/admin/pending-approval',
            ],
            [
                'key' => 'others',
                'title' => 'Others',
                'icon' => 'dots',
                'total' => $otherTotal,
                'pending' => $otherPending,
                'approved' => $otherApproved,
                'rejected' => $otherRejected,
                'action_url' => '/admin/pending-approval',
            ],
        ];

        $totalClientRequests = array_sum(array_column($clientRequestsRows, 'total'));
        $pendingClientRequests = array_sum(array_column($clientRequestsRows, 'pending'));

        // 3. GST Filing Requests
        $totalGstFilingRequests = GstFilingRequest::count();
        $pendingGstFilingRequests = GstFilingRequest::where('status', '!=', 'GST Filed')->count();
        $filedGstFilingRequests = GstFilingRequest::where('status', 'GST Filed')->count();
        $confirmedGstFilingRequests = GstFilingRequest::where('client_declaration', true)->count();
        // Per spec line 79: "Confirmation Pending / Not Started cannot exist today. Show 0 for it in the strip and flag it for the lead."
        $confPendingGstFilingRequests = GstFilingRequest::where('client_declaration', false)->count();

        // GST Filing Requests table: Show only if action is still pending (status != 'GST Filed')
        $filingRequestsList = GstFilingRequest::with('clientProfile')
            ->where('status', '!=', 'GST Filed')
            ->orderBy('id', 'desc')
            ->limit(10)
            ->get()
            ->map(function ($req) use ($now) {
                // Derive due date from filing_period
                $dueDate = null;
                if ($req->filing_period && preg_match('/^(\d{4})-(\d{2})$/', $req->filing_period, $m)) {
                    $periodDate = Carbon::createFromDate((int)$m[1], (int)$m[2], 1);
                    $dueDay = (stripos($req->return_type, 'GSTR-1') !== false || stripos($req->return_type, 'GSTR1') !== false) ? 11 : 20;
                    $dueDate = $periodDate->copy()->addMonth()->day($dueDay);
                } elseif ($req->filing_period && preg_match('/^(\d{4})-Q(\d)$/', $req->filing_period, $m)) {
                    $qEndMonth = (int)$m[2] * 3;
                    $periodDate = Carbon::createFromDate((int)$m[1], $qEndMonth, 1);
                    $dueDate = $periodDate->copy()->addMonth()->day(22);
                } else {
                    $dueDate = $req->created_at ? $req->created_at->copy()->addDays(15) : $now->copy();
                }

                return [
                    'id' => $req->id,
                    'client_name' => $req->clientProfile?->business_name ?: $req->clientProfile?->client_name ?: 'N/A',
                    'return_type' => $req->return_type,
                    'due_date' => $dueDate ? $dueDate->format('d M Y') : '—',
                    'confirmation_status' => $req->client_declaration ? 'Received' : 'Pending',
                    'filing_status' => $req->status === 'GST Filed' ? 'Filed' : ($req->status === 'Pending CA Review' ? 'Pending' : 'Pending'),
                    'raw_status' => $req->status,
                    'action_url' => "/admin/gst-filing-requests/{$req->id}",
                ];
            });

        // 4. GST Return Status (Current Filing Cycle)
        // We evaluate applicable GST clients
        $gstClients = ClientProfile::where('has_gst', true)->get();

        $prevMonthDate = $now->copy()->subMonth();
        $prevMonthPeriod = $prevMonthDate->format('Y-m');
        $quarterNum = ceil($now->month / 3);
        $prevQuarterNum = $quarterNum > 1 ? $quarterNum - 1 : 4;
        $prevQuarterYear = $quarterNum > 1 ? $now->year : $now->year - 1;
        $prevQuarterPeriod = "{$prevQuarterYear}-Q{$prevQuarterNum}";

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
                // Composition: CMP-08 quarterly
                $applicableReturns[] = [
                    'return_type' => 'CMP-08',
                    'db_type' => ClientGstReturn::TYPE_CMP08,
                    'period' => $prevQuarterPeriod,
                    'due_date' => Carbon::createFromDate($now->year, $now->month, 18),
                ];
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
                    if (in_array($now->month, [1, 4, 7, 10], true)) {
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
