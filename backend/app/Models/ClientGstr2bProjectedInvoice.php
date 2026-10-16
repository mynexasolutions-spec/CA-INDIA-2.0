<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClientGstr2bProjectedInvoice extends Model
{
    protected $fillable = [
        'client_profile_id', 'financial_year', 'tax_period',
        'invoice_date', 'invoice_number', 'party_name', 'gstin',
        'taxable_value', 'igst', 'cgst', 'sgst_utgst', 'itc_amount',
    ];

    protected function casts(): array
    {
        return [
            'invoice_date'   => 'date',
            'taxable_value'  => 'decimal:2',
            'igst'           => 'decimal:2',
            'cgst'           => 'decimal:2',
            'sgst_utgst'     => 'decimal:2',
            'itc_amount'     => 'decimal:2',
        ];
    }

    public function clientProfile()
    {
        return $this->belongsTo(ClientProfile::class);
    }
}
