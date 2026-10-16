<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HsnSacCode extends Model
{
    protected $fillable = ['type', 'code', 'description', 'code_length', 'is_active'];

    protected $casts = ['is_active' => 'boolean'];

    public function getLabelAttribute(): string
    {
        return $this->code.' — '.$this->description;
    }
}
