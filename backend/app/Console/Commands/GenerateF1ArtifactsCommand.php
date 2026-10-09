<?php

namespace App\Console\Commands;

use App\Models\ClientDocumentSetting;
use App\Models\CommercialDocument;
use App\Services\Billing\InvoiceService;
use App\Services\DocumentTemplate\DocumentCanvasHelper;
use App\Services\DocumentTemplate\DocumentPayloadBuilder;
use App\Services\DocumentTemplate\DocumentThemeTokens;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

class GenerateF1ArtifactsCommand extends Command
{
    protected $signature = 'spike:f1-artifacts';
    protected $description = 'Generate Stage F1 PDFs (6 colours Tax Invoice, Overflow, Bill of Supply, Credit Note)';

    public function handle(InvoiceService $invoiceService)
    {
        $this->info('Starting Stage F1 PDF generation...');
        $outDir = storage_path('app/spike/f1');
        if (!File::isDirectory($outDir)) {
            File::makeDirectory($outDir, 0755, true);
        }

        // 1. Pick a base tax invoice from database or build a comprehensive sample
        $taxInvoice = CommercialDocument::where('type', 'tax_invoice')
            ->whereHas('clientProfile')
            ->first();

        if ($taxInvoice) {
            $basePayload = DocumentPayloadBuilder::build($taxInvoice);
        } else {
            $basePayload = [];
        }

        // Ensure rich sample items and party data are present for the sample tax invoice
        if (empty($basePayload['items'])) {
            $basePayload['company_name'] = 'ABD GLOBEX SOLUTIONS PRIVATE LIMITED';
            $basePayload['company_name_title_case'] = 'ABD Globex Solutions Private Limited';
            $basePayload['tagline'] = 'Excellence in Global Trade & Supply';
            $basePayload['logo_path'] = file_exists(storage_path('app/spike/sample_logo.png'))
                ? storage_path('app/spike/sample_logo.png')
                : (file_exists(public_path('pdf-assets/website-logo.png')) ? public_path('pdf-assets/website-logo.png') : null);
            $basePayload['seller_address'] = 'A Wing 401, Nerul Aakash Ganga Chs, Plot No. B-71, Sector 23, Seawoods, East, Navi Mumbai, - 400706';
            $basePayload['seller_gstin'] = '27QWERT1234Q1Z2';
            $basePayload['seller_pan'] = 'QWERT1234Q';
            $basePayload['seller_email'] = 'calculation@gmail.com';
            $basePayload['seller_phone'] = '9987412345';
            $basePayload['seller_state'] = 'Maharashtra (State Code: 27)';
            $basePayload['doc_type'] = 'tax_invoice';
            $basePayload['document_title'] = 'TAX INVOICE';
            $basePayload['doc_number_label'] = 'Tax Invoice No.';
            $basePayload['doc_date_label'] = 'Tax Invoice Date';
            $basePayload['invoice_no'] = 'INV-03';
            $basePayload['invoice_date'] = '10/09/2026';
            $basePayload['financial_year'] = '2026-27';
            $basePayload['place_of_supply'] = 'Uttar Pradesh (09)';
            $basePayload['reverse_charge'] = false;
            $basePayload['against_number'] = null;
            $basePayload['bill_to'] = [
                'name' => 'ABC COMPANY PRIVATE LIMITED',
                'address' => 'Office No. 101, Ruby Business Park, Plot No. 392, Sector 23, Akbar Nagar East, Kanpur-210817',
                'gstin' => '09ABCDE1234Q1Z2',
                'state' => 'Uttar Pradesh (State Code: 09)',
                'mobile' => '9978454321',
            ];
            $basePayload['ship_to'] = [
                'name' => 'ABC COMPANY PRIVATE LIMITED',
                'address' => 'Office No. 101, Ruby Business Park, Plot No. 392, Sector 23, Akbar Nagar East, Kanpur-210817',
                'gstin' => '09ABCDE1234Q1Z2',
                'state' => 'Uttar Pradesh (State Code: 09)',
                'mobile' => '9978454321',
            ];
            $basePayload['has_tax'] = true;
            $basePayload['show_hsn'] = true;
            $basePayload['items'] = [
                [
                    'sr_no' => 1,
                    'particulars' => 'Insulated wire, cable and other insulated electric conductors',
                    'description' => null,
                    'hsn_sac' => '8544',
                    'qty' => 100,
                    'uqc' => 'NOS',
                    'rate' => 1000,
                    'gst_pct' => '18%',
                    'taxable_value' => 100000,
                ],
            ];
            $basePayload['amount_in_words'] = 'Rupees One Lakh Eighteen Thousand Only.';
            $basePayload['bank'] = [
                'name' => 'KOTAK MAHINDRA BANK LTD',
                'account_name' => 'CALCULATION PRIVATE LIMITED',
                'account_no' => '012310110001234',
                'ifsc' => 'BKID000123',
                'branch' => 'NERUL',
            ];
            $basePayload['terms'] = [
                'Payment is expected within 7 days from the invoice issuance date; otherwise 18% interest will be charged on overdue payment.',
                'All disputes are subject to Mumbai Jurisdiction.',
            ];
            $basePayload['is_delivery_challan'] = false;
            $basePayload['challan'] = [];
            $basePayload['summary'] = [
                'taxable_value' => 100000,
                'show_split_tax' => false,
                'cgst_rate' => null,
                'cgst_amount' => 0,
                'sgst_rate' => null,
                'sgst_amount' => 0,
                'igst_rate' => '18',
                'igst_amount' => 18000,
                'round_off' => 0.00,
                'grand_total' => 118000,
            ];
            $basePayload['seal_path'] = file_exists(storage_path('app/spike/sample_seal.png'))
                ? storage_path('app/spike/sample_seal.png')
                : null;
            $basePayload['signature_path'] = file_exists(storage_path('app/spike/sample_sig.png'))
                ? storage_path('app/spike/sample_sig.png')
                : null;
            $basePayload['signatory_name'] = 'Tom & Jerry Both are Best';
        }

        // 2. Generate 6 colours Tax Invoice PDFs
        $colours = [
            'slate_blue' => 'Slate Blue',
            'charcoal_grey' => 'Charcoal Grey',
            'dusty_plum' => 'Dusty Plum',
            'mocha_brown' => 'Mocha Brown',
            'deep_teal' => 'Deep Teal',
            'antique_gold' => 'Antique Gold',
        ];

        foreach ($colours as $colourKey => $colourName) {
            $theme = DocumentThemeTokens::get($colourKey);
            $icons = DocumentCanvasHelper::resolveIcons($theme['key']);

            $pdfContent = $this->renderPdf($basePayload, $theme, $icons, false, null);
            $targetPath = $outDir . "/tax_invoice_{$colourKey}.pdf";
            File::put($targetPath, $pdfContent);
            $this->info("Generated: tax_invoice_{$colourKey}.pdf (" . strlen($pdfContent) . " bytes)");
        }

        // 3. Generate Overflow PDF (20 items, 2-page or clean multi-page)
        $overflowPayload = $basePayload;
        $overflowPayload['items'] = $this->get20OverflowItems();
        $overflowTaxable = array_sum(array_column($overflowPayload['items'], 'taxable_value'));
        $overflowIgst = round($overflowTaxable * 0.18, 2);
        $overflowGrand = $overflowTaxable + $overflowIgst;
        $overflowPayload['summary']['taxable_value'] = $overflowTaxable;
        $overflowPayload['summary']['igst_rate'] = '18';
        $overflowPayload['summary']['igst_amount'] = $overflowIgst;
        $overflowPayload['summary']['grand_total'] = $overflowGrand;
        $overflowPayload['amount_in_words'] = 'Rupees ' . ucwords($this->numberToWords((int)$overflowGrand)) . ' Only.';

        $charcoalTheme = DocumentThemeTokens::get('charcoal_grey');
        $charcoalIcons = DocumentCanvasHelper::resolveIcons($charcoalTheme['key']);
        $overflowPdf = $this->renderPdf($overflowPayload, $charcoalTheme, $charcoalIcons, false, null);
        $overflowPath = $outDir . '/tax_invoice_overflow.pdf';
        File::put($overflowPath, $overflowPdf);
        $this->info("Generated: tax_invoice_overflow.pdf (" . strlen($overflowPdf) . " bytes)");

        // 4. Generate Bill of Supply PDF (No tax columns)
        $bosDoc = CommercialDocument::where('type', 'bill_of_supply')->first();
        if ($bosDoc) {
            $bosPayload = DocumentPayloadBuilder::build($bosDoc);
        } else {
            // Emulate Bill of Supply from base data
            $bosPayload = $basePayload;
            $bosPayload['doc_type'] = 'bill_of_supply';
            $bosPayload['document_title'] = 'BILL OF SUPPLY';
            $bosPayload['doc_number_label'] = 'Bill No.';
            $bosPayload['doc_date_label'] = 'Bill Date';
            $bosPayload['invoice_no'] = 'BOS-01';
            $bosPayload['has_tax'] = false;
            $bosPayload['show_hsn'] = true;
            $bosPayload['summary']['show_split_tax'] = false;
            $bosPayload['summary']['cgst_amount'] = 0;
            $bosPayload['summary']['sgst_amount'] = 0;
            $bosPayload['summary']['igst_amount'] = 0;
            $bosPayload['summary']['grand_total'] = $bosPayload['summary']['taxable_value'];
        }

        $bosTheme = DocumentThemeTokens::get('deep_teal');
        $bosIcons = DocumentCanvasHelper::resolveIcons($bosTheme['key']);
        $bosPdf = $this->renderPdf($bosPayload, $bosTheme, $bosIcons, true, 'www.abkhanassociates.com');
        $bosPath = $outDir . '/bill_of_supply.pdf';
        File::put($bosPath, $bosPdf);
        $this->info("Generated: bill_of_supply.pdf (" . strlen($bosPdf) . " bytes)");

        // 5. Generate Credit Note PDF (With "Against")
        $cnDoc = CommercialDocument::where('type', 'credit_note')->first();
        if ($cnDoc) {
            $cnPayload = DocumentPayloadBuilder::build($cnDoc);
            if (empty($cnPayload['against_number'])) {
                $cnPayload['against_number'] = 'BWT/2026-27/0001';
            }
        } else {
            // Emulate Credit Note
            $cnPayload = $basePayload;
            $cnPayload['doc_type'] = 'credit_note';
            $cnPayload['document_title'] = 'CREDIT NOTE';
            $cnPayload['doc_number_label'] = 'Credit Note No.';
            $cnPayload['doc_date_label'] = 'Credit Note Date';
            $cnPayload['invoice_no'] = 'CN-01';
            $cnPayload['against_number'] = 'INV-2026-001';
        }

        $cnTheme = DocumentThemeTokens::get('dusty_plum');
        $cnIcons = DocumentCanvasHelper::resolveIcons($cnTheme['key']);
        $cnPdf = $this->renderPdf($cnPayload, $cnTheme, $cnIcons, true, 'www.abkhanassociates.com');
        $cnPath = $outDir . '/credit_note.pdf';
        File::put($cnPath, $cnPdf);
        $this->info("Generated: credit_note.pdf (" . strlen($cnPdf) . " bytes)");

        $this->info('All Stage F1 artifacts generated successfully.');
        return 0;
    }

    private function renderPdf(array $data, array $theme, array $icons, bool $watermarkApplies, ?string $watermarkText): string
    {
        $pdf = Pdf::loadView('pdf.layouts.layout1', [
            'data' => $data,
            'theme' => $theme,
            'icons' => $icons,
        ])
        ->setPaper('a4', 'portrait')
        ->setOption([
            'isRemoteEnabled' => true,
            'dpi' => 96,
            'defaultFont' => 'DejaVu Sans',
        ]);

        $pdf->render();
        $dompdf = $pdf->getDomPDF();

        DocumentCanvasHelper::attachFrameAndFooter(
            $dompdf->getCanvas(),
            $dompdf->getFontMetrics(),
            $theme,
            $watermarkApplies,
            $watermarkText
        );

        return $pdf->output();
    }

    private function get20OverflowItems(): array
    {
        $descriptions = [
            'Insulated wire, cable and other electric conductors for heavy industry grade connections',
            'Aluminium armored power transmission cable 4 core 16 sq mm IS 1554 certified',
            'Copper flexible control multicore cable 12 core 1.5 sq mm PVC insulated',
            'High voltage electrical insulation tape heat resistant up to 105 degrees Celsius',
            'Modular industrial switchgear disconnect switch 63A triple pole with neutral',
            'Moulded case circuit breaker (MCCB) 4 pole 125A 25kA breaking capacity',
            'Distribution box IP65 weather proof double door 12 way with transparent acrylic cover',
            'Cable tray perforated type pre-galvanized heavy duty 300mm x 50mm x 2.0mm',
            'Heavy duty brass cable glands double compression type for armored cable size 25mm',
            'Earth ground copper tape conductor 25mm x 3mm bare electrical grade 99.9% pure',
            'Maintenance free chemical earth electrode 3 meter length 50mm diameter copper bonded',
            'Digital multifunction power meter panel mounted RS485 Modbus communication',
            'Current transformer ring type ratio 200/5A class 0.5 accuracy rated 5VA burden',
            'LED high bay industrial luminaire 150W 6500K daylight IP66 surge protection 4kV',
            'Flameproof cable connector explosion proof zone 1 category 2G certified',
            'Submersible pump heavy duty 3 phase 7.5HP with stainless steel impeller',
            'Automatic transfer switch controller unit dual power source ATS panel 100A',
            'Electrical terminal lugs crimping type heavy duty tinned copper 70 sq mm',
            'Heat shrinkable cable jointing kit for 11kV grade 3 core XLPE cable outdoor type',
            'Annual electrical preventive maintenance services and diagnostic testing package',
        ];

        $items = [];
        foreach ($descriptions as $i => $desc) {
            $qty = ($i + 1) * 5;
            $rate = ($i + 1) * 100;
            $taxable = $qty * $rate;
            $items[] = [
                'sr_no' => $i + 1,
                'particulars' => $desc,
                'description' => null,
                'hsn_sac' => 8500 + ($i % 50),
                'qty' => $qty,
                'uqc' => 'NOS',
                'rate' => $rate,
                'gst_pct' => '18%',
                'taxable_value' => $taxable,
            ];
        }

        return $items;
    }

    private function numberToWords(int $num): string
    {
        $ones = [
            0 => '', 1 => 'one', 2 => 'two', 3 => 'three', 4 => 'four', 5 => 'five',
            6 => 'six', 7 => 'seven', 8 => 'eight', 9 => 'nine', 10 => 'ten',
            11 => 'eleven', 12 => 'twelve', 13 => 'thirteen', 14 => 'fourteen',
            15 => 'fifteen', 16 => 'sixteen', 17 => 'seventeen', 18 => 'eighteen', 19 => 'nineteen'
        ];
        $tens = [
            2 => 'twenty', 3 => 'thirty', 4 => 'forty', 5 => 'fifty',
            6 => 'sixty', 7 => 'seventy', 8 => 'eighty', 9 => 'ninety'
        ];

        if ($num === 0) return 'zero';

        $words = '';
        if ($num >= 10000000) {
            $words .= $this->numberToWords((int)($num / 10000000)) . ' crore ';
            $num %= 10000000;
        }
        if ($num >= 100000) {
            $words .= $this->numberToWords((int)($num / 100000)) . ' lakh ';
            $num %= 100000;
        }
        if ($num >= 1000) {
            $words .= $this->numberToWords((int)($num / 1000)) . ' thousand ';
            $num %= 1000;
        }
        if ($num >= 100) {
            $words .= $this->numberToWords((int)($num / 100)) . ' hundred ';
            $num %= 100;
        }
        if ($num > 0) {
            if ($num < 20) {
                $words .= $ones[$num];
            } else {
                $words .= $tens[(int)($num / 10)];
                if ($num % 10 > 0) {
                    $words .= ' ' . $ones[$num % 10];
                }
            }
        }

        return trim($words);
    }
}
