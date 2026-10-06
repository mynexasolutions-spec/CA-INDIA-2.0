<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Models\ClientGstReturn;
use App\Models\ClientProfile;
use App\Services\Billing\BillingPolicy;
use Illuminate\Http\Request;

class GstReturnController extends Controller
{
    public function index(Request $request)
    {
        $profile = $request->user()->clientProfile;
        abort_unless($profile, 404, 'Profile not found');
        abort_unless($profile->has_gst, 400, 'GST is not enabled on this profile');

        $returns = ClientGstReturn::where('client_profile_id', $profile->id)
            ->orderByDesc('tax_period')
            ->get();

        $lastFiled = $returns->firstWhere('status', 'filed');

        // The client-visible cycle for a Regular dealer is GSTR-1's own (independent of
        // GSTR-3B's) — same resolution BillingPolicy::gstr1Frequency() uses everywhere
        // else, so a QRMP client (quarterly GSTR-3B, monthly GSTR-1 via IFF) reads as
        // "Monthly (QRMP)" here rather than the misleading "Quarterly".
        $gstr3bFrequency = $profile->gst_filing_frequency ?? 'monthly';
        $gstr1Frequency = BillingPolicy::gstr1Frequency($profile);
        $filingFrequencyLabel = $gstr1Frequency === 'quarterly'
            ? 'Quarterly'
            : ($gstr3bFrequency === 'quarterly' ? 'Monthly (QRMP)' : 'Monthly');

        return response()->json([
            'last_filed' => $lastFiled ? $lastFiled->tax_period : null,
            'frequency' => $gstr3bFrequency,
            'filing_frequency_label' => $filingFrequencyLabel,
            'dealer_type' => $profile->dealer_type,
            // Per-return-type cadence, for any UI (e.g. the Integrated Confirmation panel's
            // Return Period picker) that needs to know whether GSTR-1 or GSTR-3B specifically
            // is monthly or quarterly for this client — GSTR-1 can be monthly (QRMP/IFF) even
            // when GSTR-3B stays quarterly, so these are never assumed to match each other.
            'gstr1_quarterly' => $gstr1Frequency === 'quarterly',
            'gstr3b_quarterly' => $profile->dealer_type === 'composition' || $gstr3bFrequency === 'quarterly',
            'returns' => $returns,
            'next_due' => $this->nextDue($profile),
        ]);
    }

    /**
     * The soonest not-yet-filed period (across every return type this dealer actually
     * files) within the current FY's period grid — same grid + filed-status logic as
     * compliance(), so this never disagrees with the Compliance Status widget. Returns
     * null only once every applicable period in the FY has already been filed.
     */
    private function nextDue(ClientProfile $profile): ?array
    {
        $startYear = $this->fyStartYear(null);
        $isComposition = $profile->dealer_type === 'composition';
        $gstr3bFrequency = $profile->gst_filing_frequency ?? 'monthly';
        $gstr3bQuarterly = $isComposition || $gstr3bFrequency === 'quarterly';
        $gstr1Quarterly = BillingPolicy::gstr1Frequency($profile) === 'quarterly';

        $candidates = [];
        $collect = function (string $type, string $label, array $periods) use ($profile, &$candidates) {
            $filedPeriods = ClientGstReturn::where('client_profile_id', $profile->id)
                ->where('return_type', $type)
                ->whereIn('tax_period', array_column($periods, 'period'))
                ->where('status', 'filed')
                ->pluck('tax_period')
                ->all();

            foreach ($periods as $p) {
                if (! in_array($p['period'], $filedPeriods, true)) {
                    $candidates[] = [
                        'date' => $p['due_date'],
                        'return_type' => $label,
                        'period' => $p['period'],
                        'period_label' => $p['label'],
                    ];
                }
            }
        };

        if ($isComposition) {
            $collect(ClientGstReturn::TYPE_CMP08, 'CMP-08', $this->buildPeriods(true, $startYear, 'due_cmp08'));
        } else {
            $collect(ClientGstReturn::TYPE_GSTR1, 'GSTR-1', $this->buildPeriods($gstr1Quarterly, $startYear, 'due_gstr1', $gstr3bQuarterly));
            $collect(ClientGstReturn::TYPE_GSTR3B, 'GSTR-3B', $this->buildPeriods($gstr3bQuarterly, $startYear, 'due_gstr3b'));
        }

        if (! $candidates) {
            return null;
        }

        usort($candidates, fn ($a, $b) => strcmp($a['date'], $b['date']));

        return $candidates[0];
    }

    /** Indian FY: 1 Apr – 31 Mar. e.g. "2026-27" -> starts 2026. */
    private function fyStartYear(?string $fy): int
    {
        return \App\Services\Gst\GstPeriodService::fyStartYear($fy);
    }

    /**
     * Period grid (quarterly or monthly) for one return type, independent of any other
     * return's cycle — the due-date column selected depends only on $type.
     *
     * $qrmp distinguishes, within the MONTHLY GSTR-1 grid specifically, a plain Monthly
     * filer (due 11th) from a Quarterly/QRMP client whose GSTR-1 is still tracked monthly
     * here via IFF (due 13th) — both resolve to the same 12-row grid, only the day differs.
     */
    private function buildPeriods(bool $quarterly, int $startYear, string $dueField, bool $qrmp = false): array
    {
        return \App\Services\Gst\GstPeriodService::buildPeriods($quarterly, $startYear, $dueField, $qrmp);
    }

    /**
     * Filing status grid across a financial year, driven entirely by the client's saved GST
     * configuration and the ClientGstReturn rows admins have marked filed. Used by the
     * dashboard's Compliance Status widget.
     *
     * - Composition dealers: a single CMP-08 row, always quarterly (the composition compliance
     *   cycle is quarterly by law, independent of gst_filing_frequency).
     * - Regular dealers: GSTR-1 and GSTR-3B are tracked on INDEPENDENT cycles — under QRMP a
     *   client may file GSTR-1 monthly (via IFF) while GSTR-3B stays quarterly, or vice versa.
     *   gst_filing_frequency drives GSTR-3B's cycle (and continues to drive the existing
     *   invoice-period-lock logic elsewhere); gstr1_filing_frequency drives GSTR-1's, falling
     *   back to gst_filing_frequency when not explicitly set.
     */
    public function compliance(Request $request)
    {
        $profile = $request->user()->clientProfile;
        abort_unless($profile, 404, 'Profile not found');
        abort_unless($profile->has_gst, 400, 'GST is not enabled on this profile');

        $startYear = $this->fyStartYear($request->input('financial_year'));
        $isComposition = $profile->dealer_type === 'composition';
        $gstr3bFrequency = $profile->gst_filing_frequency ?? 'monthly';
        $gstr1Frequency = BillingPolicy::gstr1Frequency($profile);
        $gstr3bQuarterly = $isComposition || $gstr3bFrequency === 'quarterly';
        $gstr1Quarterly = $gstr1Frequency === 'quarterly';

        $today = now()->toDateString();
        $buildRow = function (string $type, array $periods) use ($profile, $today) {
            $filedPeriods = ClientGstReturn::where('client_profile_id', $profile->id)
                ->where('return_type', $type)
                ->whereIn('tax_period', array_column($periods, 'period'))
                ->where('status', 'filed')
                ->pluck('tax_period')
                ->all();

            $rows = array_map(function ($p) use ($filedPeriods, $today) {
                $filedStatus = in_array($p['period'], $filedPeriods, true);
                // filed: admin has marked it filed. pending: due date has passed and it's
                // still not filed (overdue). upcoming: due date hasn't arrived yet.
                $status = $filedStatus ? 'filed' : ($p['due_date'] && $today > $p['due_date'] ? 'pending' : 'upcoming');

                return [
                    'period' => $p['period'],
                    'label' => $p['label'],
                    'due_date' => $p['due_date'],
                    'status' => $status,
                ];
            }, $periods);

            return [
                'periods' => $rows,
                'filed_count' => count($filedPeriods),
                'total' => count($periods),
            ];
        };

        $payload = [
            'financial_year' => sprintf('%d-%02d', $startYear, ($startYear + 1) % 100),
            'dealer_type' => $profile->dealer_type,
        ];

        if ($isComposition) {
            $payload['cmp08_frequency'] = 'quarterly';
            $payload['cmp08'] = $buildRow(
                ClientGstReturn::TYPE_CMP08,
                $this->buildPeriods(true, $startYear, 'due_cmp08')
            );
        } else {
            $payload['gstr1_frequency'] = $gstr1Quarterly ? 'quarterly' : 'monthly';
            $payload['gstr3b_frequency'] = $gstr3bQuarterly ? 'quarterly' : 'monthly';
            $payload['gstr1'] = $buildRow(
                ClientGstReturn::TYPE_GSTR1,
                $this->buildPeriods($gstr1Quarterly, $startYear, 'due_gstr1', $gstr3bQuarterly)
            );
            $payload['gstr3b'] = $buildRow(
                ClientGstReturn::TYPE_GSTR3B,
                $this->buildPeriods($gstr3bQuarterly, $startYear, 'due_gstr3b')
            );
        }

        return response()->json($payload);
    }
}
