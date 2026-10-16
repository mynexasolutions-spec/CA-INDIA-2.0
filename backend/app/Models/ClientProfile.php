<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClientProfile extends Model
{
    protected $fillable = [
        'user_id', 'client_code', 'client_name', 'business_name', 'invoice_tagline', 'constitution_type', 'business_type',
        'contact_person_name', 'designation', 'gender', 'applicable_from',
        'date_of_incorporation', 'date_of_birth', 'mobile', 'alt_mobile', 'alt_email',
        'gstin', 'registration_type', 'has_gst', 'gst_compliance_enabled', 'dealer_type', 'composition_rate', 'gst_filing_frequency', 'gstr1_filing_frequency', 'gstr2b_filing_frequency', 'pan', 'email', 'state_code', 'state', 'country', 'place_of_supply_default',
        'address', 'address_line_1', 'address_line_2', 'city', 'pincode', 'website',
        'comm_same_as_above', 'comm_address_line_1', 'comm_address_line_2', 'comm_city', 'comm_state', 'comm_state_code', 'comm_pincode', 'comm_country',
        'aadhaar', 'gst_portal_username', 'gst_portal_password', 'tan', 'tan_portal_password',
        'it_portal_password', 'udyam', 'shop_establishment', 'iec', 'cin', 'llpin', 'pt_reg', 'esic', 'pf',
        'pan_status', 'name_as_per_pan', 'pan_allotment_date', 'pan_enabled',
        'gst_status', 'gst_registration_date', 'state_jurisdiction', 'gst_enabled',
        'tan_status', 'tan_allotment_date', 'tan_enabled',
        'cin_incorporation_date', 'cin_certificate_no', 'cin_incorporation_place', 'cin_enabled',
        'udyam_enterprise_type', 'udyam_registration_date', 'udyam_status', 'udyam_enabled',
        'shop_act_issuing_authority', 'shop_act_registration_date', 'shop_act_status', 'shop_act_enabled',
        'fssai_no', 'fssai_license_type', 'fssai_registration_date', 'fssai_status', 'fssai_enabled',
        'iec_registration_date', 'iec_status', 'iec_enabled',
        'ptrc_state', 'ptrc_registration_date', 'ptrc_status', 'ptrc_enabled',
        'ptec_no', 'ptec_state', 'ptec_registration_date', 'ptec_status', 'ptec_enabled',
        'tan_portal_username', 'it_portal_username',
        'two_factor_enabled', 'session_timeout_minutes',
        'bank_name', 'bank_branch', 'bank_account', 'account_holder_name', 'bank_ifsc',
        'swift_code', 'account_type', 'upi_id', 'qr_code_path',
        'logo_path', 'signature_path', 'seal_path', 'signatory_name', 'terms_conditions',
        'invoice_prefix', 'bill_of_supply_prefix', 'credit_note_prefix', 'debit_note_prefix',
        'quotation_prefix', 'amendment_prefix', 'delivery_challan_prefix',
        'invoice_next_number', 'bill_of_supply_next_number', 'credit_note_next_number',
        'debit_note_next_number', 'quotation_next_number', 'amendment_next_number',
        'delivery_challan_next_number', 'document_numbering_settings',
        'default_layout_id', 'default_colour_scheme', 'layout_applied_from', 'layout_updated_at',
        'watermark_enabled', 'watermark_text', 'gst_reminder_enabled',
    ];

    protected function casts(): array
    {
        return [
            'document_numbering_settings' => 'array',
            'default_layout_id' => 'integer',
            'layout_applied_from' => 'date',
            'layout_updated_at' => 'datetime',
            'watermark_enabled' => 'boolean',
            'gst_reminder_enabled' => 'boolean',
            'applicable_from' => 'date',
            'comm_same_as_above' => 'boolean',
            'date_of_incorporation' => 'date',
            'date_of_birth' => 'date',
            'pan_allotment_date' => 'date',
            'pan_enabled' => 'boolean',
            'gst_registration_date' => 'date',
            'gst_enabled' => 'boolean',
            'tan_allotment_date' => 'date',
            'tan_enabled' => 'boolean',
            'cin_incorporation_date' => 'date',
            'cin_enabled' => 'boolean',
            'udyam_registration_date' => 'date',
            'udyam_enabled' => 'boolean',
            'shop_act_registration_date' => 'date',
            'shop_act_enabled' => 'boolean',
            'fssai_registration_date' => 'date',
            'fssai_enabled' => 'boolean',
            'iec_registration_date' => 'date',
            'iec_enabled' => 'boolean',
            'ptrc_registration_date' => 'date',
            'ptrc_enabled' => 'boolean',
            'ptec_registration_date' => 'date',
            'ptec_enabled' => 'boolean',
            'two_factor_enabled' => 'boolean',
            'session_timeout_minutes' => 'integer',
            'has_gst' => 'boolean',
            'gst_compliance_enabled' => 'boolean',
            'composition_rate' => 'decimal:2',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function customers()
    {
        return $this->hasMany(Customer::class);
    }

    public function products()
    {
        return $this->hasMany(Product::class);
    }

    public function documents()
    {
        return $this->hasMany(CommercialDocument::class);
    }

    public function clientDocuments()
    {
        return $this->hasMany(ClientDocument::class);
    }

    public function gstr2bRecords()
    {
        return $this->hasMany(ClientGstr2bRecord::class);
    }

    public function gstReturns()
    {
        return $this->hasMany(ClientGstReturn::class);
    }

    public function clientRequests()
    {
        return $this->hasMany(\App\Models\ClientRequest::class);
    }

    public function complianceTasks()
    {
        return $this->hasMany(ComplianceTask::class);
    }

    public function changeRequests()
    {
        return $this->hasMany(ClientChangeRequest::class);
    }

    public function additionalInfos()
    {
        return $this->hasMany(ClientAdditionalInfo::class)->latest();
    }

    public function bankAccounts()
    {
        return $this->hasMany(ClientBankAccount::class)->orderByDesc('is_primary')->orderBy('id');
    }

    public function notes()
    {
        return $this->hasMany(ClientNote::class)->latest();
    }

    public function documentSettings()
    {
        return $this->hasMany(ClientDocumentSetting::class);
    }

    public function subscription()
    {
        return $this->hasOne(ClientSubscription::class);
    }
}
