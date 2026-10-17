<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NotificationItem extends Model
{
    protected $table = 'notifications';
    protected $fillable = ['user_id','title','body','type','link','read_at'];
    protected function casts(): array { return ['read_at' => 'datetime']; }
    public function user() { return $this->belongsTo(User::class); }
}
