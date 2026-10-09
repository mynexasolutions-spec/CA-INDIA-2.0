<?php

namespace App\Console\Commands;

use App\Services\DocumentTemplate\DocumentCanvasHelper;
use App\Services\DocumentTemplate\DocumentThemeTokens;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

class GenerateF2ArtifactsCommand extends Command
{
    protected $signature = 'spike:f2-artifacts';
    protected $description = 'Generate Stage F2 PDFs for Layout 2 (6 colours Tax Invoice, Overflow, Bill of Supply, Credit Note)';

    public function handle()
    {
        $this->info('Starting Stage F2 PDF generation for Layout 2...');
        $outDir = storage_path('app/spike/f2');
        if (!File::isDirectory($outDir)) {
            File::makeDirectory($outDir, 0755, true);
        }

        // Base BOARDWALA payload modeled directly after reference image
        $basePayload = [
            'doc_type' => 'tax_invoice',
            'document_title' => 'Tax Invoice',
            'doc_number_label' => 'Invoice No.',
            'doc_date_label' => 'Invoice Date',
            'company_name' => 'BOARDWALA.IN',
            'company_name_title_case' => 'Boardwala.in',
            'tagline' => 'https://www.boardwala.in/',
            'logo_path' => file_exists(storage_path('app/spike/sample_logo.png'))
                ? storage_path('app/spike/sample_logo.png')
                : (file_exists(public_path('pdf-assets/website-logo.png')) ? public_path('pdf-assets/website-logo.png') : null),
            'seller_address' => 'Office No. 02, Su-Swapna Apartment, Plot No. C7, Sector - 23, Seawoods (east) Navi Mumbai 400706, Thane, Maharashtra, 400706',
            'seller_gstin' => '27EFWPK7843N1Z9',
            'seller_pan' => 'EFWPK7843N',
            'seller_email' => 'boardwala.in@gmail.com',
            'seller_phone' => '8779225668',
            'seller_state' => 'Maharashtra (27)',
            'invoice_no' => '2026-27-143',
            'invoice_date' => '30-09-2026',
            'financial_year' => '2026-27',
            'place_of_supply' => 'Maharashtra (27)',
            'reverse_charge' => false,
            'against_number' => null,
            'bill_to' => [
                'name' => 'CHAITANYA DEVELOPER',
                'address' => "SHOP NO. 4, Tulsi Corner Cooperative Housing Society Ltd,\nSECTOR 21, Navi Mumbai, Raigad, Maharashtra, Raigad, Maharashtra, 410209",
                'gstin' => '27AASFC1308D1ZP',
                'pan' => 'AASFC1308D',
                'state' => 'Maharashtra',
                'place_of_supply' => 'Maharashtra',
                'mobile' => null,
            ],
            'ship_to' => [
                'name' => 'CHAITANYA DEVELOPER',
                'address' => "SHOP NO. 4, Tulsi Corner Cooperative Housing Society Ltd,\nSECTOR 21, Navi Mumbai, Raigad, Maharashtra, Raigad, Maharashtra, 410209",
                'gstin' => '27AASFC1308D1ZP',
                'pan' => 'AASFC1308D',
                'state' => 'Maharashtra',
                'place_of_supply' => 'Maharashtra',
                'mobile' => null,
            ],
            'has_tax' => true,
            'show_hsn' => true,
            'items' => [
                [
                    'sr_no' => 1,
                    'particulars' => 'ALUMINIUM CHANNEL LETTERS',
                    'description' => "English Letters Details :- ( Height 4.5 ft ) 108mm Embossed Imported Aluminium Channel Letters.\nEmbossed will be made of aluminum & Front face will be made of Acrylic For Light Pass, Letters Size & Color As Per Design. Led Modules: 3 SMD Waterproof Samsung 1.5 Watt Light With 3 Years Warranty Power Supply: IP 68 Complete Waterproof With 1 Year Warranty.",
                    'hsn_sac' => '94056090',
                    'qty' => 486,
                    'uqc' => 'IN',
                    'rate' => 380.00,
                    'gst_pct' => '18%',
                    'taxable_value' => 190295.91,
                ],
                [
                    'sr_no' => 2,
                    'particulars' => 'INSTALLATION & TRANSPORTATION',
                    'description' => null,
                    'hsn_sac' => '94056090',
                    'qty' => 1,
                    'uqc' => 'PCS',
                    'rate' => 10000.00,
                    'gst_pct' => '18%',
                    'taxable_value' => 10304.09,
                ],
            ],
            'amount_in_words' => 'Two Lakh Six Hundred Rupees Only',
            'bank' => [
                'name' => 'Axis Bank',
                'account_name' => 'BOARDWALA.IN',
                'account_no' => '923020041664177',
                'ifsc' => 'UTIB0001365',
                'branch' => 'NERUL ,EAST, NAVI MUMBAI',
            ],
            'terms' => [
                'Goods once sold will not be taken back or exchanged.',
                '60% advance for placing order.',
                '20% payment within completion of work & remaining 20% after completion of work.',
                'Service charges will be applicable after 3 months of installation of signboard if required.',
                'There should be a electric point nearby where signboard is going to be installed.',
                'Ladder/Scaffolding comes under clients responsibility.',
            ],
            'is_delivery_challan' => false,
            'challan' => [
                'reason' => '—',
                'vehicle_no' => null,
                'transporter_name' => null,
                'eway_bill_no' => null,
                'receiver_name' => null,
            ],
            'summary' => [
                'taxable_value' => 170000.00,
                'show_split_tax' => true,
                'cgst_rate' => 9,
                'cgst_amount' => 15300.00,
                'sgst_rate' => 9,
                'sgst_amount' => 15300.00,
                'igst_rate' => null,
                'igst_amount' => 0.00,
                'round_off' => 0.00,
                'grand_total' => 200600.00,
            ],
            'seal_path' => null,
            'signature_path' => file_exists(storage_path('app/spike/sample_sig.png'))
                ? storage_path('app/spike/sample_sig.png')
                : (file_exists(storage_path('app/spike/sample_signature.png')) ? storage_path('app/spike/sample_signature.png') : null),
            'signatory_name' => 'BOARDWALA.IN',
        ];

        // 1. Generate 6 approved colour schemes for Tax Invoice
        $colours = [
            'slate_blue',
            'charcoal_grey',
            'dusty_plum',
            'mocha_brown',
            'deep_teal',
            'antique_gold',
        ];

        foreach ($colours as $colour) {
            $theme = DocumentThemeTokens::get($colour);
            $pdf = $this->renderPdf($basePayload, $theme, true, 'www.abkhanassociates.com');
            $fileName = "tax-invoice-{$colour}.pdf";
            File::put($outDir . '/' . $fileName, $pdf);
            $this->info("Generated: {$fileName} (" . strlen($pdf) . " bytes)");
        }

        // 2. Generate multi-page overflow document (20 line items)
        $overflowPayload = $basePayload;
        $overflowPayload['invoice_no'] = '2026-27-143-OVERFLOW';
        $overflowPayload['items'] = $this->get20OverflowItems();
        $totalTaxable = array_sum(array_column($overflowPayload['items'], 'taxable_value'));
        $overflowPayload['summary']['taxable_value'] = $totalTaxable;
        $overflowPayload['summary']['cgst_amount'] = round($totalTaxable * 0.09, 2);
        $overflowPayload['summary']['sgst_amount'] = round($totalTaxable * 0.09, 2);
        $overflowPayload['summary']['grand_total'] = $totalTaxable + $overflowPayload['summary']['cgst_amount'] + $overflowPayload['summary']['sgst_amount'];
        $overflowPayload['amount_in_words'] = 'Rupees ' . number_format($overflowPayload['summary']['grand_total'], 2) . ' Only.';

        $overflowTheme = DocumentThemeTokens::get('charcoal_grey');
        $overflowPdf = $this->renderPdf($overflowPayload, $overflowTheme, true, 'www.abkhanassociates.com');
        File::put($outDir . '/tax-invoice-overflow.pdf', $overflowPdf);
        $this->info("Generated: tax-invoice-overflow.pdf (" . strlen($overflowPdf) . " bytes)");

        // 3. Generate Bill of Supply (No tax columns, no tax bifurcation)
        $bosPayload = $basePayload;
        $bosPayload['doc_type'] = 'bill_of_supply';
        $bosPayload['document_title'] = 'Bill of Supply';
        $bosPayload['doc_number_label'] = 'Bill No.';
        $bosPayload['doc_date_label'] = 'Bill Date';
        $bosPayload['invoice_no'] = 'BOS-2026-042';
        $bosPayload['has_tax'] = false;
        $bosPayload['summary']['cgst_amount'] = 0;
        $bosPayload['summary']['sgst_amount'] = 0;
        $bosPayload['summary']['igst_amount'] = 0;
        $bosPayload['summary']['grand_total'] = $bosPayload['summary']['taxable_value'];

        $bosTheme = DocumentThemeTokens::get('slate_blue');
        $bosPdf = $this->renderPdf($bosPayload, $bosTheme, true, 'www.abkhanassociates.com');
        File::put($outDir . '/bill-of-supply.pdf', $bosPdf);
        $this->info("Generated: bill-of-supply.pdf (" . strlen($bosPdf) . " bytes)");

        // 4. Generate Credit Note (With Against field)
        $cnPayload = $basePayload;
        $cnPayload['doc_type'] = 'credit_note';
        $cnPayload['document_title'] = 'Credit Note';
        $cnPayload['doc_number_label'] = 'Credit Note No.';
        $cnPayload['doc_date_label'] = 'Credit Note Date';
        $cnPayload['invoice_no'] = 'CN-2026-015';
        $cnPayload['against_number'] = '2026-27-32';

        $cnTheme = DocumentThemeTokens::get('mocha_brown');
        $cnPdf = $this->renderPdf($cnPayload, $cnTheme, true, 'www.abkhanassociates.com');
        File::put($outDir . '/credit-note.pdf', $cnPdf);
        $this->info("Generated: credit-note.pdf (" . strlen($cnPdf) . " bytes)");

        $this->info('All Stage F2 artifacts generated successfully.');
        return 0;
    }

    private function renderPdf(array $data, array $theme, bool $watermarkApplies, ?string $watermarkText): string
    {
        $pdf = Pdf::loadView('pdf.layouts.layout2', [
            'data' => $data,
            'theme' => $theme,
        ])
        ->setPaper('a4', 'portrait')
        ->setOption([
            'isRemoteEnabled' => true,
            'dpi' => 96,
            'defaultFont' => 'DejaVu Sans',
        ]);

        $pdf->render();
        $dompdf = $pdf->getDomPDF();

        // Square frame radius 0 for Layout 2
        DocumentCanvasHelper::attachFrameAndFooter(
            $dompdf->getCanvas(),
            $dompdf->getFontMetrics(),
            $theme,
            $watermarkApplies,
            $watermarkText,
            0
        );

        return $pdf->output();
    }

    private function get20OverflowItems(): array
    {
        $items = [];
        $signageProducts = [
            'ALUMINIUM CHANNEL LETTERS 3D EMBOSSED',
            'ACRYLIC LED GLOW SIGN BOARD FRONT LIT',
            'BACKLIT FLEX BANNER WITH MS FRAMEWORK',
            'NEON SIGNAGE CUSTOM SHAPE WITH TRANSFORMER',
            'STAINLESS STEEL TITANIUM GOLD COATED LETTERS',
            'BRASS ETCHED NAME PLATE WITH WOODEN BASE',
            'RETRO REFLECTIVE ROAD SIGN BOARD HIGH INTENSITY',
            'WAYFINDING SIGNAGE TOTEM PYLON TOWER',
            'SAFETY SIGNAGE PHOTOLUMINESCENT GLOW IN DARK',
            'VINYL FROSTED FILM FOR OFFICE GLASS PARTITION',
            'ONE WAY VISION GRAPHICS PERFORATED PRINT',
            'ACRYLIC SANDWICH POSTER HOLDER WITH STUDS',
            'MODULAR ALUMINIUM SLIM LIGHTBOX 25MM PROFILE',
            'FABRIC LIGHTBOX WITH HIGH POWER LED BACKLIGHT',
            'EDGELIT LED ACRYLIC PANEL DISPLAY',
            'DIGITAL PRINTED ACP CLADDING SHEET FABRICATION',
            '3D ACRYLIC CUTOUT LOGO ON WOODEN BACKDROP',
            'MAGNETIC ACRYLIC DISPLAY STAND COUNTER TOP',
            'INSTALLATION HARDWARE SCAFFOLDING & CRANE CHARGES',
            'TRANSPORTATION & ON-SITE STRUCTURAL FITTING',
        ];

        foreach ($signageProducts as $idx => $name) {
            $sr = $idx + 1;
            $qty = ($sr * 3) + 2;
            $rate = 250 + ($sr * 40);
            $val = round($qty * $rate, 2);
            $items[] = [
                'sr_no' => $sr,
                'particulars' => $name,
                'description' => "Specification grade signage component #{$sr} with weather-proof warranty.",
                'hsn_sac' => '94056090',
                'qty' => $qty,
                'uqc' => ($sr % 3 === 0) ? 'SQFT' : 'NOS',
                'rate' => $rate,
                'gst_pct' => '18%',
                'taxable_value' => $val,
            ];
        }

        return $items;
    }
}
