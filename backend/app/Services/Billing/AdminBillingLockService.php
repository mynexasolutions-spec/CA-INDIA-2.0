<?php

namespace App\Services\Billing;

use App\Models\ClientGstReturn;
use App\Models\ClientProfile;
use App\Models\CommercialDocument;
use Carbon\Carbon;

class AdminBillingLockService
{
    public const TIMEZONE = 'Asia/Kolkata';

    /**
     * Determine lock status and GST filing details for a client profile and creation timestamp.
     *
     * @return array{
     *     is_locked: bool,
     *     gst_status: string,
     *     return_type: ?string,
     *     tax_period: ?string,
     *     filed_on: ?string,
     *     ack_no: ?string
     * }
     */
    public static function check(ClientProfile $profile, mixed $createdAt, ?string $docType = null): array
    {
        if (in_array($docType, ['quotation', 'delivery_challan'], true)) {
            return [
                'is_locked' => false,
                'gst_status' => '-',
                'return_type' => null,
                'tax_period' => null,
                'filed_on' => null,
                'ack_no' => null,
            ];
        }

        if (! $profile->has_gst) {
            return [
                'is_locked' => false,
                'gst_status' => '-',
                'return_type' => null,
                'tax_period' => null,
                'filed_on' => null,
                'ack_no' => null,
            ];
        }

        if (! $createdAt) {
            return [
                'is_locked' => false,
                'gst_status' => 'Not Filed',
                'return_type' => null,
                'tax_period' => null,
                'filed_on' => null,
                'ack_no' => null,
            ];
        }

        $date = ($createdAt instanceof Carbon ? $createdAt->copy() : Carbon::parse($createdAt))
            ->timezone(self::TIMEZONE);

        $isComposition = strtolower(trim((string) $profile->dealer_type)) === 'composition';

        if ($isComposition) {
            $returnType = ClientGstReturn::TYPE_CMP08;
            $taxPeriod = self::formatFyQuarter($date);
        } else {
            // Regular and QRMP clients lock against GSTR-1
            $returnType = ClientGstReturn::TYPE_GSTR1;
            $taxPeriod = $date->format('Y-m');
        }

        $record = ClientGstReturn::where('client_profile_id', $profile->id)
            ->where('return_type', $returnType)
            ->where('tax_period', $taxPeriod)
            ->where('status', 'filed')
            ->first();

        if ($record) {
            $filedOnStr = null;
            if ($record->filed_on) {
                $filedOnStr = $record->filed_on instanceof Carbon
                    ? $record->filed_on->format('Y-m-d')
                    : substr((string) $record->filed_on, 0, 10);
            }

            return [
                'is_locked' => true,
                'gst_status' => 'Filed',
                'return_type' => $returnType,
                'tax_period' => $taxPeriod,
                'filed_on' => $filedOnStr,
                'ack_no' => $record->ack_no,
            ];
        }

        return [
            'is_locked' => false,
            'gst_status' => 'Not Filed',
            'return_type' => $returnType,
            'tax_period' => $taxPeriod,
            'filed_on' => null,
            'ack_no' => null,
        ];
    }

    /**
     * Determine lock status directly for a commercial document.
     * Quotations and Delivery Challans never carry GST lock or status (Decision 10).
     */
    public static function checkDocument(CommercialDocument $doc): array
    {
        if (in_array($doc->type, ['quotation', 'delivery_challan'], true)) {
            return [
                'is_locked' => false,
                'gst_status' => '-',
                'return_type' => null,
                'tax_period' => null,
                'filed_on' => null,
                'ack_no' => null,
            ];
        }

        $profile = $doc->clientProfile ?: ClientProfile::find($doc->client_profile_id);
        if (! $profile) {
            return [
                'is_locked' => false,
                'gst_status' => '-',
                'return_type' => null,
                'tax_period' => null,
                'filed_on' => null,
                'ack_no' => null,
            ];
        }

        return self::check($profile, $doc->created_at);
    }

    /**
     * Compute FY quarter representation matching GstPeriodService shape:
     * Apr-Jun = YYYY-Q1
     * Jul-Sep = YYYY-Q2
     * Oct-Dec = YYYY-Q3
     * Jan-Mar = YYYY-Q4 (where YYYY is the calendar year of Jan-Mar)
     */
    public static function formatFyQuarter(Carbon $date): string
    {
        // CMP-08 / filing-request convention: year = FINANCIAL-YEAR START year, so Jan-Mar 2027 is
        // "2026-Q4" (the same key Cmp08Period and the client's filing requests store).
        $fyStart = $date->month >= 4 ? $date->year : $date->year - 1;
        $q = match (true) {
            $date->month >= 4 && $date->month <= 6 => 1,
            $date->month >= 7 && $date->month <= 9 => 2,
            $date->month >= 10 => 3,
            default => 4,
        };

        return "{$fyStart}-Q{$q}";
    }
}
