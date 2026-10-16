<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Models\GstFilingRequest;
use App\Services\Billing\BillingPolicy;
use Carbon\Carbon;
use Illuminate\Http\Request;

class GstFilingReminderController extends Controller
{
    public function reminders(Request $request)
    {
        $profile = $request->user()->clientProfile;

        if (!$profile || !$profile->has_gst || $profile->gst_compliance_enabled === false) {
            return response()->json(['reminders' => []]);
        }

        $today = Carbon::today();
        $reminders = [];

        if ($profile->dealer_type === 'composition') {
            foreach ($this->lastNQuarters($today, 2) as $p) {
                $due = $this->quarterDueDate($p, 18);
                if ($this->inWindow($today, $due) && !$this->hasRequest($profile->id, 'CMP-08', $p['code'])) {
                    $reminders[] = $this->item('CMP-08', $p, $due, $today, 'Quarterly');
                }
            }
        } else {
            $gstr1Freq  = BillingPolicy::gstr1Frequency($profile);
            $gstr3bFreq = BillingPolicy::gstr3bFrequency($profile);
            $isQrmp     = ($gstr1Freq === 'monthly') && ($gstr3bFreq === 'quarterly');

            // GSTR-1
            if ($gstr1Freq === 'monthly') {
                $dueDay = $isQrmp ? 13 : 11;
                foreach ($this->lastNMonths($today, 2) as $p) {
                    $due = Carbon::createFromDate($p['year'], $p['month'], 1)
                        ->addMonthNoOverflow()->setDay($dueDay);
                    if ($this->inWindow($today, $due) && !$this->hasRequest($profile->id, 'GSTR-1', $p['code'])) {
                        $reminders[] = $this->item('GSTR-1', $p, $due, $today, 'Monthly');
                    }
                }
            } else {
                foreach ($this->lastNQuarters($today, 2) as $p) {
                    $due = $this->quarterDueDate($p, 13);
                    if ($this->inWindow($today, $due) && !$this->hasRequest($profile->id, 'GSTR-1', $p['code'])) {
                        $reminders[] = $this->item('GSTR-1', $p, $due, $today, 'Quarterly');
                    }
                }
            }

            // GSTR-3B
            if ($gstr3bFreq === 'monthly') {
                foreach ($this->lastNMonths($today, 2) as $p) {
                    $due = Carbon::createFromDate($p['year'], $p['month'], 1)
                        ->addMonthNoOverflow()->setDay(20);
                    if ($this->inWindow($today, $due) && !$this->hasRequest($profile->id, 'GSTR-3B', $p['code'])) {
                        $reminders[] = $this->item('GSTR-3B', $p, $due, $today, 'Monthly');
                    }
                }
            } else {
                foreach ($this->lastNQuarters($today, 2) as $p) {
                    $due = $this->quarterDueDate($p, 22);
                    if ($this->inWindow($today, $due) && !$this->hasRequest($profile->id, 'GSTR-3B', $p['code'])) {
                        $reminders[] = $this->item('GSTR-3B', $p, $due, $today, 'Quarterly');
                    }
                }
            }
        }

        usort($reminders, fn ($a, $b) => strcmp($a['due_date_raw'], $b['due_date_raw']));

        return response()->json(['reminders' => array_values($reminders)]);
    }

    private function item(string $type, array $period, Carbon $due, Carbon $today, string $freq): array
    {
        $days   = (int) $today->diffInDays($due, false);
        $status = $days < 0 ? 'overdue' : ($days <= 7 ? 'due_soon' : 'upcoming');

        return [
            'return_type'      => $type,
            'period_label'     => $period['label'],
            'period_code'      => $period['code'],
            'filing_frequency' => $freq,
            'due_date'         => $due->format('d M Y'),
            'due_date_raw'     => $due->format('Y-m-d'),
            'days_left'        => $days,
            'status'           => $status,
        ];
    }

    /** Show reminder if due date is within ±30 days of today. */
    private function inWindow(Carbon $today, Carbon $due): bool
    {
        $diff = (int) $today->diffInDays($due, false);

        return $diff >= -30 && $diff <= 30;
    }

    private function hasRequest(int $profileId, string $type, string $period): bool
    {
        return GstFilingRequest::where('client_profile_id', $profileId)
            ->where('return_type', $type)
            ->where('filing_period', $period)
            ->whereIn('status', ['Pending CA Review', 'Approved for Filing', 'GST Filed'])
            ->exists();
    }

    /** Returns the last $n completed months, most-recent first. */
    private function lastNMonths(Carbon $today, int $n): array
    {
        $result = [];
        $d = $today->copy()->startOfMonth()->subMonth();
        for ($i = 0; $i < $n; $i++) {
            $result[] = [
                'code'  => $d->format('Y-m'),
                'label' => $d->format('F Y'),
                'year'  => (int) $d->year,
                'month' => (int) $d->month,
            ];
            $d->subMonth();
        }

        return $result;
    }

    /**
     * Returns the last $n completed Indian-FY quarters, newest first.
     * Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar of FY start year.
     * Period code: "YYYY-Qn" with YYYY = FY start year.
     */
    private function lastNQuarters(Carbon $today, int $n): array
    {
        // Each entry: [endMon, endDay, qNum]
        // endMon <= 3 means the quarter belongs to the previous FY start year.
        $defs = [
            ['endMon' => 6,  'endDay' => 30, 'q' => 1],
            ['endMon' => 9,  'endDay' => 30, 'q' => 2],
            ['endMon' => 12, 'endDay' => 31, 'q' => 3],
            ['endMon' => 3,  'endDay' => 31, 'q' => 4],
        ];

        $seen = [];
        $candidates = [];
        for ($yr = $today->year - 1; $yr <= $today->year; $yr++) {
            foreach ($defs as $def) {
                $endDate = Carbon::create($yr, $def['endMon'], $def['endDay']);
                if ($endDate->lt($today)) {
                    $fyYear = $def['endMon'] <= 3 ? ($yr - 1) : $yr;
                    $code   = "{$fyYear}-Q{$def['q']}";
                    if (!isset($seen[$code])) {
                        $seen[$code]  = true;
                        $candidates[] = [
                            'code'    => $code,
                            'label'   => $this->quarterLabel($fyYear, $def['q']),
                            'fyYear'  => $fyYear,
                            'qNum'    => $def['q'],
                            'endDate' => $endDate,
                        ];
                    }
                }
            }
        }

        usort($candidates, fn ($a, $b) => $b['endDate']->timestamp - $a['endDate']->timestamp);

        return array_slice($candidates, 0, $n);
    }

    private function quarterLabel(int $fyYear, int $q): string
    {
        $labels = [1 => 'Q1 (Apr - Jun)', 2 => 'Q2 (Jul - Sep)', 3 => 'Q3 (Oct - Dec)', 4 => 'Q4 (Jan - Mar)'];

        return $labels[$q] . ' ' . $fyYear;
    }

    /**
     * Due date = $dayOfMonth of the calendar month immediately after the quarter ends.
     * Q1 ends Jun → July;  Q2 ends Sep → October;
     * Q3 ends Dec → January (fyYear+1);  Q4 ends Mar → April (fyYear+1).
     */
    private function quarterDueDate(array $period, int $day): Carbon
    {
        $map = [1 => [7, 0], 2 => [10, 0], 3 => [1, 1], 4 => [4, 1]];
        [$mon, $yearAdd] = $map[$period['qNum']];

        return Carbon::create($period['fyYear'] + $yearAdd, $mon, $day);
    }
}
