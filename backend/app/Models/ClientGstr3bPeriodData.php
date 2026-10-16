<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class ClientGstr3bPeriodData extends Model {
    protected $table = 'client_gstr3b_period_data';
    protected $fillable = [
        'client_profile_id','tax_period',
        'outward_rcm','itc_data','interest_data','late_fee_data','cash_ledger',
        'remarks','updated_by',
    ];
    protected function casts(): array {
        return [
            'outward_rcm'   => 'array',
            'itc_data'      => 'array',
            'interest_data' => 'array',
            'late_fee_data' => 'array',
            'cash_ledger'   => 'array',
        ];
    }
}
