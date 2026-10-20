<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClientDocumentSetting extends Model
{
    public const DOCUMENT_TYPES = [
        'tax_invoice' => 'Tax Invoice',
        'bill_of_supply' => 'Bill of Supply',
        'credit_note' => 'Credit Note',
        'debit_note' => 'Debit Note',
        'quotation' => 'Quotation',
        'delivery_challan' => 'Delivery Challan',
    ];

    public const LAYOUTS = [
        1 => 'Layout 1 Modern Professional (Top Header Style)',
        2 => 'Layout 2 Clean & Simple (Classic Corporate)',
        3 => 'Layout 3 Structured & Detailed (Table Focused)',
        4 => 'Layout 4 Modern Boxed (Panel Style)',
    ];

    public const COLOUR_SCHEMES = [
        'simple' => 'Simple',
        'royal_blue' => 'Royal Blue',
        'slate_blue' => 'Slate Blue',
        'charcoal_grey' => 'Charcoal Grey',
        'dusty_plum' => 'Dusty Plum',
        'mocha_brown' => 'Mocha Brown',
        'deep_teal' => 'Deep Teal',
        'antique_gold' => 'Antique Gold',
    ];

    protected $fillable = [
        'client_profile_id',
        'document_type',
        'layout_id',
        'colour_scheme',
        'watermark_applies',
    ];

    protected function casts(): array
    {
        return [
            'layout_id' => 'integer',
            'watermark_applies' => 'boolean',
        ];
    }

    public function clientProfile()
    {
        return $this->belongsTo(ClientProfile::class);
    }
}
