<?php

namespace App\Services\Billing;

use App\Models\ClientProfile;
use Carbon\Carbon;

/**
 * GST return due dates and display labels, shared by the client reminder popup/bell and the
 * admin filing-request screen so both always agree.
 * Period codes: monthly "YYYY-MM", quarterly "YYYY-Qn" (YYYY = FY start year).
 */
class GstDueDate
{
    public static function isQrmp(ClientProfile $p): bool
    {
        return $p->dealer_type !== 'composition'
            && BillingPolicy::gstr1Frequency($p) === 'monthly'
            && BillingPolicy::gstr3bFrequency($p) === 'quarterly';
    }

    public static function taxpayerType(ClientProfile $p): string
    {
        return $p->dealer_type === 'composition' ? 'Composition Dealer' : 'Regular Taxpayer';
    }

    /** Label shown in the "Filing Frequency" column. */
    public static function frequencyLabel(ClientProfile $p, string $returnType): string
    {
        if ($p->dealer_type === 'composition') {
            return 'Quarterly (Composition)';
        }
        if ($returnType === 'GSTR-1') {
            if (BillingPolicy::gstr1Frequency($p) === 'monthly') {
                return self::isQrmp($p) ? 'Monthly (QRMP)' : 'Monthly';
            }

            return 'Quarterly';
        }

        return BillingPolicy::gstr3bFrequency($p) === 'quarterly' ? 'Quarterly' : 'Monthly';
    }

    public static function periodLabel(string $code): string
    {
        if (preg_match('/^(\d{4})-Q([1-4])$/', $code, $m)) {
            $fy = (int) $m[1];
            $map = [1 => ['April', 'June', 0], 2 => ['July', 'September', 0], 3 => ['October', 'December', 0], 4 => ['January', 'March', 1]];
            [$from, $to, $add] = $map[(int) $m[2]];

            return "{$from} – {$to} ".($fy + $add);
        }
        if (preg_match('/^(\d{4})-(\d{2})$/', $code, $m)) {
            return Carbon::createFromDate((int) $m[1], (int) $m[2], 1)->format('F Y');
        }

        return $code;
    }

    public static function dueDate(ClientProfile $p, string $returnType, string $code): ?Carbon
    {
        if (preg_match('/^(\d{4})-Q([1-4])$/', $code, $m)) {
            $day = $returnType === 'CMP-08' ? 18 : ($returnType === 'GSTR-1' ? 13 : 22);
            $map = [1 => [7, 0], 2 => [10, 0], 3 => [1, 1], 4 => [4, 1]];
            [$mon, $add] = $map[(int) $m[2]];

            return Carbon::create((int) $m[1] + $add, $mon, $day);
        }
        if (preg_match('/^(\d{4})-(\d{2})$/', $code, $m)) {
            $day = $returnType === 'GSTR-1' ? (self::isQrmp($p) ? 13 : 11) : 20;

            return Carbon::createFromDate((int) $m[1], (int) $m[2], 1)->addMonthNoOverflow()->setDay($day);
        }

        return null;
    }
}
