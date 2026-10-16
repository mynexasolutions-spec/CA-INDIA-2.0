<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class ClientRequest extends Model {
    protected $table    = 'client_requests';
    protected $fillable = [
        'request_id','client_profile_id','request_type','subject','description',
        'update_details','attachments','client_remarks','status','rejection_reason',
        'submitted_by_user_id','reviewed_by_user_id',
    ];
    protected function casts(): array {
        return ['update_details'=>'array','attachments'=>'array'];
    }

    public function client()      { return $this->belongsTo(ClientProfile::class,'client_profile_id'); }
    public function submittedBy() { return $this->belongsTo(\App\Models\User::class,'submitted_by_user_id'); }

    public static function nextRequestId(): string
    {
        $year = now()->year;
        $last = static::where('request_id','like',"REQ-$year-%")->orderByDesc('id')->value('request_id');
        $seq  = $last ? ((int)substr($last, -3)) + 1 : 1;
        return sprintf('REQ-%d-%03d', $year, $seq);
    }

    public function getTypeLabelAttribute(): string {
        return match($this->request_type) {
            'profile_update'    => 'Profile Update',
            'document_change'   => 'Document Change',
            'bank_details'      => 'Bank Details',
            'invoice_setting'   => 'Invoice Setting',
            'invoice_amendment' => 'Invoice Amendment',
            default             => 'Other Request',
        };
    }
}
