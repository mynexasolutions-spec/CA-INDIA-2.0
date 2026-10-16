<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClientOtherRequest extends Model
{
    protected $fillable = [
        'client_profile_id', 'submitted_by',
        'request_type', 'document_type', 'document_number',
        'subject', 'request_details', 'please_specify',
        'attachment_path', 'status', 'admin_remarks',
    ];

    public function clientProfile()
    {
        return $this->belongsTo(ClientProfile::class);
    }

    public function requestId(): string
    {
        return 'OR-' . date('Y', strtotime($this->created_at)) . '-' . str_pad($this->id, 3, '0', STR_PAD_LEFT);
    }
}
