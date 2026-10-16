<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClientAmendmentRequest extends Model
{
    protected $fillable = [
        'client_profile_id', 'commercial_document_id', 'submitted_by',
        'document_type', 'bill_number', 'document_date', 'customer_name',
        'gstin', 'original_amount', 'reason', 'remarks',
        'status', 'admin_remarks', 'amendment_document_id',
    ];

    protected function casts(): array
    {
        return [
            'document_date'   => 'date',
            'original_amount' => 'decimal:2',
        ];
    }

    public function clientProfile()
    {
        return $this->belongsTo(ClientProfile::class);
    }

    public function document()
    {
        return $this->belongsTo(CommercialDocument::class, 'commercial_document_id');
    }

    public function amendmentDocument()
    {
        return $this->belongsTo(CommercialDocument::class, 'amendment_document_id');
    }
}
