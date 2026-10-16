<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DocumentPaymentLog extends Model
{
    protected $fillable = [
        'commercial_document_id', 'client_profile_id', 'action',
        'paid_on', 'payment_time', 'payment_mode', 'reference_number',
        'received_by', 'paid_amount', 'remarks', 'unmark_reason', 'recorded_by',
    ];

    public function document()
    {
        return $this->belongsTo(CommercialDocument::class, 'commercial_document_id');
    }
}
