<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClientChangeRequest extends Model
{
    /** Files staged by the client before they press "Submit for Approval" — never shown to the admin. */
    public const STATUS_DRAFT = 'draft';
    public const STATUS_PENDING = 'pending';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';

    // Each Settings tab tracks its own independent approval workflow.
    public const SECTION_BRANDING = 'branding';
    public const SECTION_BANK = 'bank';
    public const SECTION_INVOICE_SETTINGS = 'invoice_settings';
    public const SECTION_NUMBERING = 'numbering';
    public const SECTION_LAYOUT = 'layout';
    public const SECTIONS = [self::SECTION_BRANDING, self::SECTION_BANK, self::SECTION_INVOICE_SETTINGS, self::SECTION_NUMBERING, self::SECTION_LAYOUT];

    public const TEXT_FIELDS = [
        'bank_name',
        'bank_branch',
        'account_holder_name',
        'bank_account',
        'bank_ifsc',
        'swift_code',
        'account_type',
        'upi_id',
        'signatory_name',
        'invoice_prefix',
        'bill_of_supply_prefix',
        'credit_note_prefix',
        'debit_note_prefix',
        'quotation_prefix',
        'delivery_challan_prefix',
        'terms_conditions',
    ];

    /** Which section each editable text field belongs to. */
    public const FIELD_SECTIONS = [
        'bank_name' => self::SECTION_BANK,
        'bank_branch' => self::SECTION_BANK,
        'account_holder_name' => self::SECTION_BANK,
        'bank_account' => self::SECTION_BANK,
        'bank_ifsc' => self::SECTION_BANK,
        'swift_code' => self::SECTION_BANK,
        'account_type' => self::SECTION_BANK,
        'upi_id' => self::SECTION_BANK,
        // Logo, signature, seal, signatory name and T&C are ONE Invoice Branding request.
        'signatory_name' => self::SECTION_BRANDING,
        'terms_conditions' => self::SECTION_BRANDING,
        'invoice_prefix' => self::SECTION_NUMBERING,
        'bill_of_supply_prefix' => self::SECTION_NUMBERING,
        'credit_note_prefix' => self::SECTION_NUMBERING,
        'debit_note_prefix' => self::SECTION_NUMBERING,
        'quotation_prefix' => self::SECTION_NUMBERING,
        'delivery_challan_prefix' => self::SECTION_NUMBERING,
        'layout_id' => self::SECTION_LAYOUT,
        'colour_scheme' => self::SECTION_LAYOUT,
    ];

    public const ASSET_FIELDS = [
        'logo' => 'logo_path',
        'signature' => 'signature_path',
        'seal' => 'seal_path',
        'qr_code' => 'qr_code_path',
    ];

    protected $fillable = [
        'client_profile_id',
        'section',
        'submitted_by',
        'status',
        'payload',
        'logo_path',
        'signature_path',
        'seal_path',
        'qr_code_path',
        'admin_note',
        'reviewed_by',
        'reviewed_at',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'reviewed_at' => 'datetime',
        ];
    }

    public function clientProfile()
    {
        return $this->belongsTo(ClientProfile::class);
    }

    public function submitter()
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function isPending(): bool
    {
        return $this->status === self::STATUS_PENDING;
    }
}
