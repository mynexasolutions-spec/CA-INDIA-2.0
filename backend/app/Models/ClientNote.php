<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClientNote extends Model
{
    protected $fillable = [
        'client_profile_id',
        'note',
    ];

    public function clientProfile()
    {
        return $this->belongsTo(ClientProfile::class);
    }
}
