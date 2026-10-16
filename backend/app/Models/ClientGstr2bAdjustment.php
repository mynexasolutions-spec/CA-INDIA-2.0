<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class ClientGstr2bAdjustment extends Model {
    protected $fillable = [
        'client_profile_id','tax_period','financial_year','from_previous_period',
        'prev_igst','prev_cgst','prev_sgst',
        'adj_igst','adj_cgst','adj_sgst',
        'adjustment_reason','remarks','adjusted_by',
    ];
    protected function casts(): array {
        return ['prev_igst'=>'decimal:2','prev_cgst'=>'decimal:2','prev_sgst'=>'decimal:2',
                'adj_igst'=>'decimal:2','adj_cgst'=>'decimal:2','adj_sgst'=>'decimal:2'];
    }
    public function clientProfile() { return $this->belongsTo(ClientProfile::class); }
}
