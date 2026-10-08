<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClientSubscription extends Model
{
    public const STATUS_ACTIVE = 'active';
    public const STATUS_INACTIVE = 'inactive';

    public const STATUSES = [
        self::STATUS_ACTIVE => 'Active',
        self::STATUS_INACTIVE => 'Inactive',
    ];

    protected $fillable = [
        'client_profile_id',
        'status',
        'from_date',
        'to_date',
        'total_fees',
        'amount_paid',
        'amount_receivable',
        'outstanding',
    ];

    protected function casts(): array
    {
        return [
            'from_date' => 'date',
            'to_date' => 'date',
            'total_fees' => 'decimal:2',
            'amount_paid' => 'decimal:2',
            'amount_receivable' => 'decimal:2',
            'outstanding' => 'decimal:2',
        ];
    }

    public function clientProfile()
    {
        return $this->belongsTo(ClientProfile::class);
    }
}
