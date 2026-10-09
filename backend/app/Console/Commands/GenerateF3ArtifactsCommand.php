<?php

namespace App\Console\Commands;

use App\Services\DocumentTemplate\DocumentCanvasHelper;
use App\Services\DocumentTemplate\DocumentThemeTokens;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

class GenerateF3ArtifactsCommand extends Command
{
    protected $signature = 'spike:f3-artifacts';
    protected $description = 'Generate Stage F3 PDFs for Layout 3 (Charcoal, Plum, Teal, Slate, with & without tagline, overflow, Bill of Supply, Credit Note)';

    public function handle()
    {
        $this->info('Starting Stage F3 PDF generation for tuned Layout 3...');
        $outDir = storage_path('app/spike/f3');
        if (!File::isDirectory($outDir)) {
            File::makeDirectory($outDir, 0755, true);
        }

        // Base UNICO AIRCON payload modeled accurately after reference image
        $basePayload = [
            'doc_type' => 'tax_invoice',
            'document_title' => 'TAX INVOICE',
            'doc_number_label' => 'Invoice No.',
            'doc_date_label' => 'Invoice Date',
            'company_name' => 'UNICO AIRCON',
            'company_name_title_case' => 'Unico Aircon',
            'tagline' => 'COOLER TOMORROW TOGETHER',
            'logo_path' => file_exists(storage_path('app/spike/sample_logo.png'))
                ? storage_path('app/spike/sample_logo.png')
                : (file_exists(public_path('pdf-assets/website-logo.png')) ? public_path('pdf-assets/website-logo.png') : null),
            'seller_address' => 'SHOP NO. 1, BEHAYET CHS, PLOT NO. 362, SECTOR 6, NEAR DARSHAN DARBAR ROAD, NERUL (WEST), NAVI MUMBAI – 400706, MAHARASHTRA, INDIA',
            'seller_gstin' => '27ABCP1234K1Z5',
            'seller_pan' => 'AABCP1234K',
            'seller_email' => 'info@unicoaircon.in',
            'seller_phone' => '+91 98765 43210 / +91 98196 65091',
            'seller_state' => 'Maharashtra (27)',
            'invoice_no' => '2026-27/001',
            'invoice_date' => '15-04-2026',
            'financial_year' => '2026-27',
            'place_of_supply' => 'Maharashtra (27)',
            'reverse_charge' => false,
            'against_number' => null,
            'bill_to' => [
                'name' => 'KRISHNA TRADERS PRIVATE LIMITED',
                'address' => "101, Ground Floor, Business Park,\nSector 6, Nerul West, Navi Mumbai – 400706,\nMaharashtra, India",
                'gstin' => '27AACCK1234M1Z2',
                'pan' => 'AACCK1234M',
                'state' => 'Maharashtra (27)',
                'place_of_supply' => 'Maharashtra (27)',
                'mobile' => '+91 98765 43210',
            ],
            'ship_to' => [
                'name' => 'KRISHNA TRADERS PRIVATE LIMITED',
                'address' => "101, Ground Floor, Business Park,\nSector 6, Nerul West, Navi Mumbai – 400706,\nMaharashtra, India",
                'gstin' => '27AACCK1234M1Z2',
                'pan' => 'AACCK1234M',
                'state' => 'Maharashtra (27)',
                'place_of_supply' => 'Maharashtra (27)',
                'mobile' => '+91 98765 43210',
            ],
            'has_tax' => true,
            'show_hsn' => true,
            'items' => [
                [
                    'sr_no' => 1,
                    'particulars' => 'Split AC 1.5 Ton (Voltas) – Supply Only',
                    'description' => null,
                    'hsn_sac' => '84151010',
                    'qty' => 1,
                    'uqc' => 'Nos',
                    'rate' => 28000.00,
                    'gst_pct' => '18%',
                    'taxable_value' => 28000.00,
                ],
                [
                    'sr_no' => 2,
                    'particulars' => 'Installation Charges (AC Installation and Commissioning)',
                    'description' => null,
                    'hsn_sac' => '998719',
                    'qty' => 1,
                    'uqc' => 'Job',
                    'rate' => 2000.00,
                    'gst_pct' => '18%',
                    'taxable_value' => 2000.00,
                ],
                [
                    'sr_no' => 3,
                    'particulars' => 'Copper Pipe 3 Meter (1/4" & 1/2")',
                    'description' => null,
                    'hsn_sac' => '741110',
                    'qty' => 2,
                    'uqc' => 'Nos',
                    'rate' => 1200.00,
                    'gst_pct' => '18%',
                    'taxable_value' => 2400.00,
                ],
                [
                    'sr_no' => 4,
                    'particulars' => 'Bracket Set (Outdoor Unit)',
                    'description' => null,
                    'hsn_sac' => '83024900',
                    'qty' => 1,
                    'uqc' => 'Set',
                    'rate' => 850.00,
                    'gst_pct' => '18%',
                    'taxable_value' => 850.00,
                ],
            ],
            'amount_in_words' => 'Rupees Thirty Nine Thousand Two Hundred Thirty Five Only.',
            'bank' => [
                'name' => 'HDFC Bank Limited',
                'account_name' => 'UNICO AIRCON',
                'account_no' => '12345678901234',
                'ifsc' => 'HDFC0001234',
                'branch' => 'Nerul, Navi Mumbai',
            ],
            'terms' => [
                'Goods once sold will not be taken back or exchanged.',
                'Payment to be made within 15 days from the date of invoice.',
                'Interest @ 18% p.a. will be charged on delayed payments.',
                'Subject to Navi Mumbai Jurisdiction only.',
                'This is a computer generated invoice and does not require a signature.',
                'Thank you for your business.',
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
                'taxable_value' => 33250.00,
                'show_split_tax' => true,
                'cgst_rate' => 9,
                'cgst_amount' => 2992.50,
                'sgst_rate' => 9,
                'sgst_amount' => 2992.50,
                'igst_rate' => null,
                'igst_amount' => 0.00,
                'round_off' => 0.00,
                'grand_total' => 39235.00,
            ],
            'seal_path' => null,
            'signature_path' => file_exists(storage_path('app/spike/sample_sig.png'))
                ? storage_path('app/spike/sample_sig.png')
                : (file_exists(storage_path('app/spike/sample_signature.png')) ? storage_path('app/spike/sample_signature.png') : null),
            'signatory_name' => 'UNICO AIRCON',
        ];

        // 1. Generate 4 main colours (Charcoal, Plum, Teal, Slate) + remaining 2 (Mocha, Gold) with tagline
        $colours = [
            'charcoal_grey',
            'dusty_plum',
            'deep_teal',
            'slate_blue',
            'mocha_brown',
            'antique_gold',
        ];

        foreach ($colours as $colour) {
            $payload = $basePayload;
            $theme = DocumentThemeTokens::get($colour);
            $pdf = $this->renderPdf($payload, $theme, true, 'www.abkhanassociates.com');
            $fileName = "tax-invoice-{$colour}.pdf";
            File::put($outDir . '/' . $fileName, $pdf);
            $this->info("Generated: {$fileName} (" . strlen($pdf) . " bytes)");
        }

        // 2. Generate without tagline (Charcoal, Plum, Teal, Slate)
        $noTaglineColours = [
            'charcoal_grey',
            'dusty_plum',
            'deep_teal',
            'slate_blue',
        ];

        foreach ($noTaglineColours as $colour) {
            $payload = $basePayload;
            $payload['tagline'] = null;
            $theme = DocumentThemeTokens::get($colour);
            $pdf = $this->renderPdf($payload, $theme, true, 'www.abkhanassociates.com');
            $fileName = "tax-invoice-{$colour}-no-tagline.pdf";
            File::put($outDir . '/' . $fileName, $pdf);
            $this->info("Generated: {$fileName} (" . strlen($pdf) . " bytes)");
        }

        // 3. Generate multi-page overflow document (20 line items)
        $overflowPayload = $basePayload;
        $overflowPayload['invoice_no'] = '2026-27/001-OVERFLOW';
        $overflowPayload['items'] = $this->get20OverflowItems();
        $totalTaxable = array_sum(array_column($overflowPayload['items'], 'taxable_value'));
        $overflowPayload['summary']['taxable_value'] = $totalTaxable;
        $overflowPayload['summary']['cgst_amount'] = round($totalTaxable * 0.09, 2);
        $overflowPayload['summary']['sgst_amount'] = round($totalTaxable * 0.09, 2);
        $overflowPayload['summary']['grand_total'] = $totalTaxable + $overflowPayload['summary']['cgst_amount'] + $overflowPayload['summary']['sgst_amount'];
        $overflowPayload['amount_in_words'] = 'Rupees Two Lakh Eighty Five Thousand Only.';

        $themeSlate = DocumentThemeTokens::get('slate_blue');
        $overflowPdf = $this->renderPdf($overflowPayload, $themeSlate, true, 'www.abkhanassociates.com');
        File::put($outDir . '/tax-invoice-overflow.pdf', $overflowPdf);
        $this->info('Generated: tax-invoice-overflow.pdf (' . strlen($overflowPdf) . ' bytes)');

        // 4. Generate Bill of Supply (no GST columns, no tax bifurcation)
        $bosPayload = $basePayload;
        $bosPayload['doc_type'] = 'bill_of_supply';
        $bosPayload['document_title'] = 'BILL OF SUPPLY';
        $bosPayload['doc_number_label'] = 'Bill No.';
        $bosPayload['doc_date_label'] = 'Bill Date';
        $bosPayload['invoice_no'] = 'BOS-2026-27/001';
        $bosPayload['has_tax'] = false;
        $bosPayload['show_hsn'] = true;
        $bosPayload['summary']['show_split_tax'] = false;
        $bosPayload['summary']['cgst_amount'] = 0;
        $bosPayload['summary']['sgst_amount'] = 0;
        $bosPayload['summary']['igst_amount'] = 0;
        $bosPayload['summary']['grand_total'] = $bosPayload['summary']['taxable_value'];

        $themeTeal = DocumentThemeTokens::get('deep_teal');
        $bosPdf = $this->renderPdf($bosPayload, $themeTeal, false);
        File::put($outDir . '/bill-of-supply.pdf', $bosPdf);
        $this->info('Generated: bill-of-supply.pdf (' . strlen($bosPdf) . ' bytes)');

        // 5. Generate Credit Note (Against field populated)
        $cnPayload = $basePayload;
        $cnPayload['doc_type'] = 'credit_note';
        $cnPayload['document_title'] = 'CREDIT NOTE';
        $cnPayload['doc_number_label'] = 'Credit Note No.';
        $cnPayload['doc_date_label'] = 'Credit Note Date';
        $cnPayload['invoice_no'] = 'CN-2026-27/001';
        $cnPayload['against_number'] = '2026-27/001';
        $cnPayload['summary']['taxable_value'] = 2000.00;
        $cnPayload['summary']['cgst_amount'] = 180.00;
        $cnPayload['summary']['sgst_amount'] = 180.00;
        $cnPayload['summary']['grand_total'] = 2360.00;
        $cnPayload['amount_in_words'] = 'Rupees Two Thousand Three Hundred Sixty Only.';
        $cnPayload['items'] = [
            [
                'sr_no' => 1,
                'particulars' => 'Installation Charges - Rate Adjustment / Reversal',
                'description' => 'Credit note issued against Invoice 2026-27/001',
                'hsn_sac' => '998719',
                'qty' => 1,
                'uqc' => 'Job',
                'rate' => 2000.00,
                'gst_pct' => '18%',
                'taxable_value' => 2000.00,
            ],
        ];

        $themePlum = DocumentThemeTokens::get('dusty_plum');
        $cnPdf = $this->renderPdf($cnPayload, $themePlum, true, 'www.abkhanassociates.com');
        File::put($outDir . '/credit-note.pdf', $cnPdf);
        $this->info('Generated: credit-note.pdf (' . strlen($cnPdf) . ' bytes)');

        $this->info('Stage F3 PDF generation complete! Artifacts saved in storage/app/spike/f3/');
        return 0;
    }

    private function renderPdf(array $data, array $theme, bool $showWatermark = false, ?string $watermarkText = null): string
    {
        $viewData = [
            'data' => $data,
            'theme' => $theme,
        ];

        $pdf = Pdf::loadView('pdf.layouts.layout3', $viewData)
            ->setPaper('a4', 'portrait')
            ->setOption([
                'isRemoteEnabled' => true,
                'dpi' => 96,
                'defaultFont' => 'DejaVu Sans',
            ]);

        $pdf->render();
        $dompdf = $pdf->getDomPDF();

        // Layout 3 uses crisp square outer frame (radius = 0)
        DocumentCanvasHelper::attachFrameAndFooter(
            $dompdf->getCanvas(),
            $dompdf->getFontMetrics(),
            $theme,
            $showWatermark,
            $watermarkText,
            0
        );

        return $pdf->output();
    }

    private function get20OverflowItems(): array
    {
        $items = [];
        for ($i = 1; $i <= 20; $i++) {
            $rate = 1500.00 + ($i * 100);
            $qty = 1 + ($i % 3);
            $taxable = $rate * $qty;
            $items[] = [
                'sr_no' => $i,
                'particulars' => "Air Conditioning Duct & Spare Component Item #{$i}",
                'description' => "Technical specification and model fitting reference #{$i}",
                'hsn_sac' => (string) (84150000 + $i),
                'qty' => $qty,
                'uqc' => 'Nos',
                'rate' => $rate,
                'gst_pct' => '18%',
                'taxable_value' => $taxable,
            ];
        }
        return $items;
    }
}
