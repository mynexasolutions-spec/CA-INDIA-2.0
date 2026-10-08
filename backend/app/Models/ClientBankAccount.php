<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClientBankAccount extends Model
{
    protected $fillable = [
        'client_profile_id',
        'bank_name',
        'account_holder_name',
        'account_number',
        'ifsc_code',
        'branch',
        'account_type',
        'is_primary',
        'status',
        'remarks',
    ];

    protected function casts(): array
    {
        return [
            'is_primary' => 'boolean',
        ];
    }

    public function clientProfile()
    {
        return $this->belongsTo(ClientProfile::class);
    }
}
