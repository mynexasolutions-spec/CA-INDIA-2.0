<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class ClientCmp08Data extends Model {
    protected $table    = 'client_cmp08_data';
    protected $fillable = ['client_profile_id','tax_period','turnover','adjustments','payments','remarks','updated_by'];
    protected function casts(): array {
        return ['turnover'=>'array','adjustments'=>'array','payments'=>'array'];
    }
}
