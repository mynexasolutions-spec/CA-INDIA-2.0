<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class CommercialDocument extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'client_profile_id', 'customer_id', 'reference_document_id', 'converted_document_id', 'type', 'number',
        'document_date', 'due_date', 'place_of_supply', 'is_inter_state', 'is_reverse_charge',
        'discount_total', 'taxable_amount', 'cgst_amount', 'sgst_amount', 'igst_amount',
        'total_amount', 'round_off', 'grand_total', 'amount_in_words',
        'tax_deduction_type', 'tds_tcs_section_id', 'tds_tcs_rate', 'tds_tcs_amount',
        'status', 'cancellation_reason', 'cancelled_at', 'cancelled_by', 'edit_allowed', 'issued_at', 'notes', 'terms',
        'payment_terms', 'currency', 'pdf_path', 'share_token', 'po_number',
        'reason_for_transportation', 'reason_for_transportation_other', 'vehicle_no',
        'transporter_name', 'eway_bill_no', 'receiver_name', 'receiver_signature_datetime',
    ];

    protected function casts(): array
    {
        return [
            'document_date' => 'date',
            'due_date' => 'date',
            'issued_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'is_inter_state' => 'boolean',
            'is_reverse_charge' => 'boolean',
            'edit_allowed' => 'boolean',
            'discount_total' => 'decimal:2',
            'taxable_amount' => 'decimal:2',
            'cgst_amount' => 'decimal:2',
            'sgst_amount' => 'decimal:2',
            'igst_amount' => 'decimal:2',
            'total_amount' => 'decimal:2',
            'round_off' => 'decimal:2',
            'grand_total' => 'decimal:2',
            'tds_tcs_rate' => 'decimal:2',
            'tds_tcs_amount' => 'decimal:2',
            'receiver_signature_datetime' => 'datetime',
        ];
    }

    public function clientProfile()
    {
        return $this->belongsTo(ClientProfile::class);
    }

    public function cancelledBy()
    {
        return $this->belongsTo(User::class, 'cancelled_by');
    }

    public function tdsTcsSection()
    {
        return $this->belongsTo(TdsTcsSection::class);
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function referenceDocument()
    {
        return $this->belongsTo(CommercialDocument::class, 'reference_document_id');
    }

    public function convertedDocument()
    {
        return $this->belongsTo(CommercialDocument::class, 'converted_document_id')->withTrashed();
    }

    public function amendments()
    {
        return $this->hasMany(CommercialDocument::class, 'reference_document_id')->where('type', 'amendment');
    }

    public function editRequests()
    {
        return $this->hasMany(DocumentEditRequest::class, 'commercial_document_id');
    }

    public function lineItems()
    {
        return $this->hasMany(DocumentLineItem::class)->orderBy('sort_order');
    }

    public function getGstAmountAttribute(): float
    {
        return (float) $this->cgst_amount + (float) $this->sgst_amount + (float) $this->igst_amount;
    }
}
