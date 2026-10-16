<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StaffClientAssignment extends Model
{
    protected $table = 'staff_client_assignments';

    protected $fillable = ['user_id', 'client_profile_id', 'module_permissions'];

    protected $casts = ['module_permissions' => 'array'];
}
