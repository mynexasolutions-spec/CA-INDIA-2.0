<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name', 'email', 'password', 'role', 'phone', 'is_active', 'last_login_at',
        'password_updated_at', 'password_updated_by',
        'login_2fa_enabled', 'clients_verify_method', 'clients_secondary_password',
    ];

    protected $hidden = ['password', 'remember_token', 'clients_secondary_password'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password_updated_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
            'login_2fa_enabled' => 'boolean',
        ];
    }

    public function clientProfile()
    {
        return $this->hasOne(ClientProfile::class);
    }

    public function staffAssignments()
    {
        return $this->hasMany(StaffClientAssignment::class, 'user_id');
    }

    public function isAdmin(): bool
    {
        return in_array($this->role, ['super_admin', 'admin'], true);
    }

    public function isStaff(): bool
    {
        return in_array($this->role, ['super_admin', 'admin', 'staff'], true);
    }

    public function isClient(): bool
    {
        return $this->role === 'client';
    }
}
