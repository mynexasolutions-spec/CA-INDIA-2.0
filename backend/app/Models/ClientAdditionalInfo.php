<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClientAdditionalInfo extends Model
{
    protected $fillable = [
        'client_profile_id',
        'information',
        'remarks',
    ];

    public function clientProfile()
    {
        return $this->belongsTo(ClientProfile::class);
    }
}
