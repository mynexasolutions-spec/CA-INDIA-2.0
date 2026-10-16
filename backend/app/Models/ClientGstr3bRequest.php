<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

/**
 * A GSTR-3B or CMP-08 request between the Admin and a client (see return_type). The table keeps
 * its original name; the flow itself lives in App\Services\Gst\ReturnRequestService.
 */
class ClientGstr3bRequest extends Model {
    public const RETURN_GSTR3B = 'GSTR3B';
    public const RETURN_CMP08 = 'CMP08';

    /** Raised by the Admin on the client's behalf — waiting for the client's Accept / Reject. */
    public const PENDING_CLIENT = 'pending_client';
    /** Raised by the client from the Client Portal — waiting for the Admin. */
    public const SUBMITTED = 'submitted';
    public const ACCEPTED = 'accepted';
    public const REJECTED = 'rejected';
    public const COMPLETED = 'completed';

    /** At most one of these may exist per client + return + tax period. */
    public const ACTIVE = [self::PENDING_CLIENT, self::SUBMITTED, self::ACCEPTED];

    protected $table    = 'client_gstr3b_requests';
    protected $fillable = [
        'client_profile_id','return_type','tax_period','status',
        'initiated_by','initiated_by_user_id','rejection_reason',
    ];

    protected $attributes = ['return_type' => self::RETURN_GSTR3B];

    public function client()      { return $this->belongsTo(ClientProfile::class, 'client_profile_id'); }
    public function initiatedBy() { return $this->belongsTo(\App\Models\User::class, 'initiated_by_user_id'); }

    public function scopeActive($q) { return $q->whereIn('status', self::ACTIVE); }

    public static function activeFor(int $clientProfileId, string $period, string $returnType = self::RETURN_GSTR3B): ?self {
        return static::where('client_profile_id', $clientProfileId)
            ->where('return_type', $returnType)
            ->where('tax_period', $period)
            ->active()
            ->latest('id')
            ->first();
    }

    /** "Sep 2026" for a GSTR-3B month, "Q1 (Apr - Jun) 2026" for a CMP-08 quarter. */
    public static function labelForPeriod(string $returnType, string $period): string {
        if ($returnType === self::RETURN_CMP08 && ($p = \App\Services\Gst\Cmp08Period::parse($period))) {
            return \App\Services\Gst\Cmp08Period::quarterLabel($p[0], $p[1]);
        }

        return \Carbon\Carbon::createFromFormat('Y-m', $period)->format('M Y');
    }

    /** The client may Accept / Reject only a request the Admin initiated and that is still waiting for them. */
    public function awaitingClient(): bool {
        return $this->status === self::PENDING_CLIENT && $this->initiated_by === 'admin';
    }

    /** The Admin may Reject only a request the client submitted. */
    public function awaitingAdmin(): bool {
        return $this->status === self::SUBMITTED;
    }

    /** Source of the request, exactly as the screens show it: "Admin" or "Client". */
    public function getInitiatedByLabelAttribute(): string {
        return $this->initiated_by === 'client' ? 'Client' : 'Admin';
    }

    public function getReturnLabelAttribute(): string {
        return $this->return_type === self::RETURN_CMP08 ? 'CMP-08' : 'GSTR-3B';
    }

    public function getStatusLabelAttribute(): string {
        return match($this->status) {
            self::PENDING_CLIENT => 'Pending Client Action',
            self::SUBMITTED      => 'Submitted',
            self::ACCEPTED       => 'Accepted',
            self::REJECTED       => 'Rejected',
            self::COMPLETED      => 'Completed',
            default              => $this->status,
        };
    }

    /** Shape shared by the Admin and Client screens. */
    public function toScreen(): array {
        return [
            'id'                => $this->id,
            'client_profile_id' => $this->client_profile_id,
            'client_name'       => $this->client?->business_name ?? $this->client?->client_name,
            'return_type'       => $this->return_type,
            'return_label'      => $this->return_label,
            'tax_period'        => $this->tax_period,
            'period_label'      => self::labelForPeriod($this->return_type, $this->tax_period),
            'status'            => $this->status,
            'status_label'      => $this->status_label,
            'initiated_by'      => $this->initiated_by,
            'initiated_by_name' => $this->initiated_by_label,
            'rejection_reason'  => $this->rejection_reason,
            'created_at'        => $this->created_at?->format('d M Y'),
            'awaiting_client'   => $this->awaitingClient(),
            'awaiting_admin'    => $this->awaitingAdmin(),
        ];
    }
}
