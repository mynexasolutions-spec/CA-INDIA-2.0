<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClientGstr2bInvoice extends Model
{
    public const MATCH_STATUS_MATCHED = 'matched';

    public const MATCH_STATUS_UNMATCHED = 'unmatched';

    /** Every newly uploaded document starts here until Admin/Client reconciles it. */
    public const MATCH_STATUS_PENDING = 'pending';

    public const MATCH_STATUSES = [
        self::MATCH_STATUS_MATCHED,
        self::MATCH_STATUS_UNMATCHED,
        self::MATCH_STATUS_PENDING,
    ];

    public const ITC_ELIGIBLE = 'eligible';

    public const ITC_INELIGIBLE = 'ineligible';

    public const ITC_ELIGIBILITIES = [
        self::ITC_ELIGIBLE,
        self::ITC_INELIGIBLE,
    ];

    /**
     * New documents are Pending (reconciliation) and have no ITC eligibility decision
     * (null = "Select") until Admin marks them Yes / No.
     */
    protected $attributes = [
        'match_status' => self::MATCH_STATUS_PENDING,
    ];

    /** Anything not yet Matched — Unmatched and Pending alike. Their ITC is excluded from the eligible ITC. */
    public function scopeNotMatched($query)
    {
        return $query->where(fn ($w) => $w
            ->where('match_status', '!=', self::MATCH_STATUS_MATCHED)
            ->orWhereNull('match_status'));
    }

    protected $fillable = [
        'client_profile_id', 'gstr2b_record_id', 'financial_year', 'tax_period',
        'supplier_gstin', 'supplier_name', 'invoice_number', 'invoice_date', 'invoice_value',
        'taxable_value', 'cgst', 'sgst', 'igst', 'cess', 'total_gst',
        'itc_eligibility', 'itc_reason', 'match_status',
    ];

    protected function casts(): array
    {
        return [
            'invoice_date' => 'date',
        ];
    }

    public function clientProfile()
    {
        return $this->belongsTo(ClientProfile::class);
    }

    public function record()
    {
        return $this->belongsTo(ClientGstr2bRecord::class, 'gstr2b_record_id');
    }
}
