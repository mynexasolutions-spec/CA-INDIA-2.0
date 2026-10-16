<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GstRateMaster extends Model
{
    protected $fillable = ['rate', 'is_active'];

    protected $casts = ['rate' => 'float', 'is_active' => 'boolean'];
}
