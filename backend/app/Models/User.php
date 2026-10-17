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
        'name', 'email', 'otp_email', 'password', 'role', 'phone', 'is_active', 'last_login_at',
        'password_updated_at', 'password_updated_by',
        'login_2fa_enabled', 'clients_verify_method', 'clients_secondary_password',
    ];

    protected $hidden = ['password', 'remember_token', 'clients_secondary_password'];

    /**
     * Inbox that receives verification codes: for the super admin the ADMIN_OTP_EMAIL env value, then the dedicated OTP email when set, else a client's
     * registered contact email (their login email is only a system ID), else the login email.
     */
    public function otpEmail(): string
    {
        if ($this->role === 'super_admin') {
            $env = trim((string) config('mail.admin_otp_email'));
            if ($env !== '' && filter_var($env, FILTER_VALIDATE_EMAIL)) {
                return $env;
            }
        }
        if ($this->otp_email) {
            return $this->otp_email;
        }
        if ($this->role === 'client') {
            $contact = trim((string) $this->clientProfile?->email);
            if ($contact !== '' && filter_var($contact, FILTER_VALIDATE_EMAIL)) {
                return strtolower($contact);
            }
        }

        return $this->email;
    }

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
