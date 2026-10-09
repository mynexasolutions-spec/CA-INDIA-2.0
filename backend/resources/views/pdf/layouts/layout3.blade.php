<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>{{ $data['document_title'] }} - {{ $data['invoice_no'] }}</title>
<style>
  @page {
    size: A4 portrait;
    margin: 5.5mm 7.5mm 9.5mm 7.5mm;
  }
  * {
    box-sizing: border-box;
  }
  body {
    font-family: DejaVu Sans, sans-serif;
    font-size: 9.5px;
    color: #111827;
    margin: 0;
    padding: 2px 2px 0;
    line-height: 1.35;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  thead {
    display: table-header-group;
  }
  tfoot {
    display: table-row-group;
  }
  tr {
    page-break-inside: avoid;
  }
  .avoid-break {
    page-break-inside: avoid;
  }
</style>
</head>
<body>

@php
  // Deeper, richer header tints for Layout 3 table headers
  $deepTints = [
    'slate_blue' => '#D5DFEC',
    'charcoal_grey' => '#CCD2DA',
    'dusty_plum' => '#DEC5D8',
    'mocha_brown' => '#E4D5CD',
    'deep_teal' => '#C8E4E3',
    'antique_gold' => '#EDE0BE',
  ];
  $headerTint = $deepTints[$theme['key']] ?? ($theme['light_tint'] ?? '#E6EBF2');
@endphp

  <!-- 1. Header Section: Larger Logo Box (Left) + 24pt Bold Company Details (Center) -->
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 7px;">
    <tr>
      <!-- Larger Logo Box -->
      <td style="width: 106px; vertical-align: middle; padding: 0 10px 0 0;">
        <div style="width: 96px; height: 96px; border: 1.5px solid #6B7280; background-color: #FFFFFF; text-align: center; vertical-align: middle; padding: 4px;">
          @if(!empty($data['logo_path']))
            <img src="{{ $data['logo_path'] }}" style="max-width: 86px; max-height: 86px; vertical-align: middle;" alt="Logo">
          @else
            <div style="font-size: 13px; font-weight: 800; color: #374151; line-height: 86px; text-align: center; letter-spacing: 0.5px;">
              LOGO HERE
            </div>
          @endif
        </div>
      </td>

      <!-- Company Details (Centered) -->
      <td style="vertical-align: middle; text-align: center; padding: 0 8px;">
        <div style="font-size: 24pt; font-weight: 800; color: {{ $theme['primary'] }}; letter-spacing: 0.8px; margin-bottom: 4px; text-transform: uppercase; line-height: 1.15;">
          {{ $data['company_name'] }}
        </div>
        @if(!empty($data['seller_address']))
        <div style="font-size: 8.5px; color: #374151; line-height: 1.35; margin-bottom: 3px; text-transform: uppercase;">
          {{ $data['seller_address'] }}
        </div>
        @endif
        <div style="font-size: 9px; color: #111827; line-height: 1.4;">
          @if(!empty($data['seller_gstin']))
            <b>GSTIN:</b> {{ $data['seller_gstin'] }}
          @endif
          @if(!empty($data['seller_pan']))
            @if(!empty($data['seller_gstin'])) &nbsp;|&nbsp; @endif<b>PAN:</b> {{ $data['seller_pan'] }}
          @endif
          @if(!empty($data['seller_state']))
            &nbsp;|&nbsp; <b>State:</b> {{ $data['seller_state'] }}
          @endif
        </div>
        <div style="font-size: 9px; color: #111827; line-height: 1.4; margin-top: 2px;">
          @if(!empty($data['seller_phone']))
            <b>Contact:</b> {{ $data['seller_phone'] }}
          @endif
          @if(!empty($data['seller_email']))
            @if(!empty($data['seller_phone'])) &nbsp;|&nbsp; @endif<b>Email:</b> {{ $data['seller_email'] }}
          @endif
        </div>
      </td>
    </tr>
  </table>

  <!-- 2. Full-Width Title Bar (Thicker & Larger Text) -->
  <div style="background-color: {{ $theme['primary'] }}; color: #FFFFFF; font-size: 16px; font-weight: 800; text-align: center; letter-spacing: 1.5px; padding: 6px 0; text-transform: uppercase; margin-bottom: 0;">
    {{ $data['document_title'] }}
  </div>

  <!-- 3. Meta Row Table (Bordered 5 Columns with Deeper Tint Header & Larger Text) -->
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 6px; border-left: 1px solid #9CA3AF; border-right: 1px solid #9CA3AF; border-bottom: 1px solid #9CA3AF;">
    <!-- Meta Header Row -->
    <tr style="background-color: {{ $headerTint }};">
      <td style="width: 20%; font-size: 9px; font-weight: 800; color: #111827; text-align: center; border: 1px solid #9CA3AF; padding: 4.5px 4px;">
        {{ $data['doc_number_label'] }}
      </td>
      <td style="width: 20%; font-size: 9px; font-weight: 800; color: #111827; text-align: center; border: 1px solid #9CA3AF; padding: 4.5px 4px;">
        {{ $data['doc_date_label'] }}
      </td>
      <td style="width: 24%; font-size: 9px; font-weight: 800; color: #111827; text-align: center; border: 1px solid #9CA3AF; padding: 4.5px 4px;">
        Place of Supply
      </td>
      <td style="width: 20%; font-size: 9px; font-weight: 800; color: #111827; text-align: center; border: 1px solid #9CA3AF; padding: 4.5px 4px;">
        Reverse Charge
      </td>
      <td style="width: 16%; font-size: 9px; font-weight: 800; color: #111827; text-align: center; border: 1px solid #9CA3AF; padding: 4.5px 4px;">
        Against
      </td>
    </tr>
    <!-- Meta Values Row -->
    <tr style="background-color: #FFFFFF;">
      <td style="font-size: 9.5px; font-weight: bold; color: #111827; text-align: center; border: 1px solid #9CA3AF; padding: 5px 4px;">
        {{ $data['invoice_no'] }}
      </td>
      <td style="font-size: 9.5px; font-weight: bold; color: #111827; text-align: center; border: 1px solid #9CA3AF; padding: 5px 4px;">
        {{ $data['invoice_date'] }}
      </td>
      <td style="font-size: 9px; color: #111827; text-align: center; border: 1px solid #9CA3AF; padding: 5px 4px;">
        {{ $data['place_of_supply'] }}
      </td>
      <td style="font-size: 9px; color: #111827; text-align: center; border: 1px solid #9CA3AF; padding: 5px 4px; vertical-align: middle;">
        <span style="display: inline-block; width: 10px; height: 10px; border: 1.2px solid #111827; text-align: center; line-height: 10px; font-size: 8.5px; vertical-align: middle; margin-right: 3px;">
          {!! $data['reverse_charge'] ? '&#x2713;' : '&nbsp;' !!}
        </span>
        <span style="vertical-align: middle;">Yes</span>
        &nbsp;&nbsp;
        <span style="display: inline-block; width: 10px; height: 10px; border: 1.2px solid #111827; text-align: center; line-height: 10px; font-size: 8.5px; vertical-align: middle; margin-right: 3px;">
          {!! !$data['reverse_charge'] ? '&#x2713;' : '&nbsp;' !!}
        </span>
        <span style="vertical-align: middle;">No</span>
      </td>
      <td style="font-size: 9px; color: #111827; text-align: center; border: 1px solid #9CA3AF; padding: 5px 4px;">
        {{ in_array($data['doc_type'], ['credit_note', 'debit_note'], true) ? ($data['against_number'] ?: '—') : '—' }}
      </td>
    </tr>
  </table>

  <!-- 4. Bill To / Ship To Bordered Grid (Thicker Headers & Larger Font) -->
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 6px;">
    <tr>
      <!-- BILL TO -->
      <td style="width: 49.3%; vertical-align: top; padding: 0;">
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #9CA3AF;">
          <tr>
            <td style="background-color: {{ $headerTint }}; font-weight: 800; font-size: 9.5px; color: #111827; padding: 4.5px 8px; border-bottom: 1px solid #9CA3AF; letter-spacing: 0.8px;">
              BILL TO
            </td>
          </tr>
          <tr>
            <td style="padding: 5px 8px; font-size: 8.5px; line-height: 1.4; background-color: #FFFFFF;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="width: 50px; color: #374151; vertical-align: top; padding: 1.5px 0;">Name</td>
                  <td style="width: 8px; color: #374151; vertical-align: top; padding: 1.5px 0;">:</td>
                  <td style="font-weight: bold; color: #111827; vertical-align: top; padding: 1.5px 0;">{{ $data['bill_to']['name'] }}</td>
                </tr>
                <tr>
                  <td style="color: #374151; vertical-align: top; padding: 1.5px 0;">Address</td>
                  <td style="color: #374151; vertical-align: top; padding: 1.5px 0;">:</td>
                  <td style="color: #1F2937; vertical-align: top; padding: 1.5px 0;">{{ $data['bill_to']['address'] ?: '—' }}</td>
                </tr>
                <tr>
                  <td style="color: #374151; vertical-align: top; padding: 1.5px 0;">Contact</td>
                  <td style="color: #374151; vertical-align: top; padding: 1.5px 0;">:</td>
                  <td style="color: #1F2937; vertical-align: top; padding: 1.5px 0;">{{ $data['bill_to']['mobile'] ?: '—' }}</td>
                </tr>
                <tr>
                  <td style="color: #374151; vertical-align: top; padding: 1.5px 0;">GSTIN</td>
                  <td style="color: #374151; vertical-align: top; padding: 1.5px 0;">:</td>
                  <td style="font-weight: bold; color: #111827; vertical-align: top; padding: 1.5px 0;">{{ $data['bill_to']['gstin'] ?: '—' }}</td>
                </tr>
                <tr>
                  <td style="color: #374151; vertical-align: top; padding: 1.5px 0;">State</td>
                  <td style="color: #374151; vertical-align: top; padding: 1.5px 0;">:</td>
                  <td style="color: #1F2937; vertical-align: top; padding: 1.5px 0;">{{ $data['bill_to']['state'] ?: '—' }}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>

      <!-- Spacer -->
      <td style="width: 1.4%;"></td>

      <!-- SHIP TO -->
      <td style="width: 49.3%; vertical-align: top; padding: 0;">
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #9CA3AF;">
          <tr>
            <td style="background-color: {{ $headerTint }}; font-weight: 800; font-size: 9.5px; color: #111827; padding: 4.5px 8px; border-bottom: 1px solid #9CA3AF; letter-spacing: 0.8px;">
              SHIP TO
            </td>
          </tr>
          <tr>
            <td style="padding: 5px 8px; font-size: 8.5px; line-height: 1.4; background-color: #FFFFFF;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="width: 50px; color: #374151; vertical-align: top; padding: 1.5px 0;">Name</td>
                  <td style="width: 8px; color: #374151; vertical-align: top; padding: 1.5px 0;">:</td>
                  <td style="font-weight: bold; color: #111827; vertical-align: top; padding: 1.5px 0;">{{ $data['ship_to']['name'] }}</td>
                </tr>
                <tr>
                  <td style="color: #374151; vertical-align: top; padding: 1.5px 0;">Address</td>
                  <td style="color: #374151; vertical-align: top; padding: 1.5px 0;">:</td>
                  <td style="color: #1F2937; vertical-align: top; padding: 1.5px 0;">{{ $data['ship_to']['address'] ?: '—' }}</td>
                </tr>
                <tr>
                  <td style="color: #374151; vertical-align: top; padding: 1.5px 0;">Contact</td>
                  <td style="color: #374151; vertical-align: top; padding: 1.5px 0;">:</td>
                  <td style="color: #1F2937; vertical-align: top; padding: 1.5px 0;">{{ $data['ship_to']['mobile'] ?: '—' }}</td>
                </tr>
                <tr>
                  <td style="color: #374151; vertical-align: top; padding: 1.5px 0;">GSTIN</td>
                  <td style="color: #374151; vertical-align: top; padding: 1.5px 0;">:</td>
                  <td style="font-weight: bold; color: #111827; vertical-align: top; padding: 1.5px 0;">{{ $data['ship_to']['gstin'] ?: '—' }}</td>
                </tr>
                <tr>
                  <td style="color: #374151; vertical-align: top; padding: 1.5px 0;">State</td>
                  <td style="color: #374151; vertical-align: top; padding: 1.5px 0;">:</td>
                  <td style="color: #1F2937; vertical-align: top; padding: 1.5px 0;">{{ $data['ship_to']['state'] ?: '—' }}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- 5. Items Table (Bordered Grid + Increased Padding + Prominent Total Bar) -->
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 6px; border: 1px solid #9CA3AF;">
    <thead>
      <tr style="background-color: {{ $theme['primary'] }}; color: #FFFFFF;">
        <th style="width: 5%; font-size: 9px; font-weight: 800; text-align: center; padding: 5px 2px; border: 1px solid #9CA3AF;">Sr.<br>No.</th>
        <th style="width: {{ $data['has_tax'] ? '37%' : '47%' }}; font-size: 9px; font-weight: 800; text-align: center; padding: 5px 6px; border: 1px solid #9CA3AF;">Description of Goods / Services</th>
        <th style="width: 10%; font-size: 9px; font-weight: 800; text-align: center; padding: 5px 3px; border: 1px solid #9CA3AF;">HSN / SAC</th>
        <th style="width: 11%; font-size: 9px; font-weight: 800; text-align: center; padding: 5px 3px; border: 1px solid #9CA3AF;">Rate<br>(₹)</th>
        <th style="width: 6%; font-size: 9px; font-weight: 800; text-align: center; padding: 5px 2px; border: 1px solid #9CA3AF;">Qty</th>
        <th style="width: 7%; font-size: 9px; font-weight: 800; text-align: center; padding: 5px 2px; border: 1px solid #9CA3AF;">Unit</th>
        @if($data['has_tax'])
        <th style="width: 10%; font-size: 9px; font-weight: 800; text-align: center; padding: 5px 2px; border: 1px solid #9CA3AF;">GST<br>Rate (%)</th>
        @endif
        <th style="width: 14%; font-size: 9px; font-weight: 800; text-align: center; padding: 5px 4px; border: 1px solid #9CA3AF;">
          {{ $data['has_tax'] ? 'Taxable Amount (₹)' : 'Amount (₹)' }}
        </th>
      </tr>
    </thead>
    <tbody>
      @php $totalTaxableSum = 0; @endphp
      @foreach($data['items'] as $item)
      @php $totalTaxableSum += (float) $item['taxable_value']; @endphp
      <tr style="background-color: #FFFFFF;">
        <td style="text-align: center; font-size: 9px; padding: 4.5px 2px; border: 1px solid #9CA3AF; vertical-align: top;">{{ $item['sr_no'] }}</td>
        <td style="text-align: left; font-size: 9px; padding: 4.5px 6px; border: 1px solid #9CA3AF; vertical-align: top;">
          <div style="font-weight: bold; color: #111827;">{{ $item['particulars'] }}</div>
          @if(!empty($item['description']))
            <div style="font-size: 8px; color: #4B5563; line-height: 1.3; margin-top: 1.5px;">{{ $item['description'] }}</div>
          @endif
        </td>
        <td style="text-align: center; font-size: 9px; padding: 4.5px 2px; border: 1px solid #9CA3AF; vertical-align: top;">{{ $item['hsn_sac'] ?: '—' }}</td>
        <td style="text-align: right; font-size: 9px; padding: 4.5px 4px; border: 1px solid #9CA3AF; vertical-align: top;">{{ number_format((float) $item['rate'], 2) }}</td>
        <td style="text-align: center; font-size: 9px; padding: 4.5px 2px; border: 1px solid #9CA3AF; vertical-align: top;">{{ $item['qty'] ?? '—' }}</td>
        <td style="text-align: center; font-size: 9px; padding: 4.5px 2px; border: 1px solid #9CA3AF; vertical-align: top;">{{ $item['uqc'] ?: 'NOS' }}</td>
        @if($data['has_tax'])
        <td style="text-align: center; font-size: 9px; padding: 4.5px 2px; border: 1px solid #9CA3AF; vertical-align: top;">{{ $item['gst_pct'] }}</td>
        @endif
        <td style="text-align: right; font-size: 9px; font-weight: bold; padding: 4.5px 4px; border: 1px solid #9CA3AF; vertical-align: top;">
          {{ number_format((float) $item['taxable_value'], 2) }}
        </td>
      </tr>
      @endforeach

      <!-- Empty filler rows to maintain clean table height for single-page invoices -->
      @php
        $fillerRows = max(0, min(5, 6 - count($data['items'])));
      @endphp
      @for($f = 0; $f < $fillerRows; $f++)
      <tr style="background-color: #FFFFFF;">
        <td style="border: 1px solid #9CA3AF; padding: 4px 2px; font-size: 9px;">&nbsp;</td>
        <td style="border: 1px solid #9CA3AF; padding: 4px 6px; font-size: 9px;">&nbsp;</td>
        <td style="border: 1px solid #9CA3AF; padding: 4px 2px; font-size: 9px;">&nbsp;</td>
        <td style="border: 1px solid #9CA3AF; padding: 4px 4px; font-size: 9px;">&nbsp;</td>
        <td style="border: 1px solid #9CA3AF; padding: 4px 2px; font-size: 9px;">&nbsp;</td>
        <td style="border: 1px solid #9CA3AF; padding: 4px 2px; font-size: 9px;">&nbsp;</td>
        @if($data['has_tax'])
        <td style="border: 1px solid #9CA3AF; padding: 4px 2px; font-size: 9px;">&nbsp;</td>
        @endif
        <td style="border: 1px solid #9CA3AF; padding: 4px 4px; font-size: 9px;">&nbsp;</td>
      </tr>
      @endfor

      <!-- Total Row (Prominent Theme Coloured Bar) -->
      <tr style="background-color: {{ $theme['primary'] }}; color: #FFFFFF;">
        <td colspan="{{ $data['has_tax'] ? 7 : 6 }}" style="text-align: right; font-size: 11px; font-weight: 800; padding: 5px 8px; border: 1px solid #9CA3AF; letter-spacing: 0.5px;">
          Total
        </td>
        <td style="text-align: right; font-size: 11px; font-weight: 800; padding: 5px 6px; border: 1px solid #9CA3AF;">
          {{ number_format($totalTaxableSum, 2) }}
        </td>
      </tr>
    </tbody>
  </table>

  <!-- 6. Bottom Split Section: Left (Words + Bank + Terms + Challan) vs Right (Summary + Signatory) -->
  <table style="width: 100%; border-collapse: collapse; margin-top: 4px;" class="avoid-break">
    <tr>
      <!-- Left Column -->
      <td style="width: 49.3%; vertical-align: top; padding: 0;">

        <!-- Amount in Words Box -->
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #9CA3AF; margin-bottom: 5px;">
          <tr>
            <td style="background-color: {{ $headerTint }}; font-size: 8.5px; font-weight: 800; color: #111827; padding: 3px 6px; border-bottom: 1px solid #9CA3AF;">
              Amount in Words (INR)
            </td>
          </tr>
          <tr>
            <td style="padding: 5px 6px; font-size: 8.5px; color: #111827; line-height: 1.4; background-color: #FFFFFF;">
              {{ $data['amount_in_words'] }}
            </td>
          </tr>
        </table>

        <!-- Bank Details Box -->
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #9CA3AF; margin-bottom: 5px;">
          <tr>
            <td style="background-color: {{ $headerTint }}; font-size: 8.5px; font-weight: 800; color: #111827; padding: 3px 6px; border-bottom: 1px solid #9CA3AF;">
              Bank Details
            </td>
          </tr>
          <tr>
            <td style="padding: 5px 6px; font-size: 8.5px; line-height: 1.4; background-color: #FFFFFF;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="width: 88px; color: #374151; padding: 1px 0;">Account Name</td>
                  <td style="width: 8px; color: #374151; padding: 1px 0;">:</td>
                  <td style="font-weight: bold; color: #111827; padding: 1px 0;">{{ $data['bank']['account_name'] ?: '—' }}</td>
                </tr>
                <tr>
                  <td style="color: #374151; padding: 1px 0;">Bank Name</td>
                  <td style="color: #374151; padding: 1px 0;">:</td>
                  <td style="color: #111827; padding: 1px 0;">{{ $data['bank']['name'] ?: '—' }}</td>
                </tr>
                <tr>
                  <td style="color: #374151; padding: 1px 0;">Account No.</td>
                  <td style="color: #374151; padding: 1px 0;">:</td>
                  <td style="font-weight: bold; color: #111827; padding: 1px 0;">{{ $data['bank']['account_no'] ?: '—' }}</td>
                </tr>
                <tr>
                  <td style="color: #374151; padding: 1px 0;">IFSC Code</td>
                  <td style="color: #374151; padding: 1px 0;">:</td>
                  <td style="font-weight: bold; color: #111827; padding: 1px 0;">{{ $data['bank']['ifsc'] ?: '—' }}</td>
                </tr>
                <tr>
                  <td style="color: #374151; padding: 1px 0;">Branch</td>
                  <td style="color: #374151; padding: 1px 0;">:</td>
                  <td style="color: #111827; padding: 1px 0;">{{ $data['bank']['branch'] ?: '—' }}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Delivery Challan Transportation Details Box (When applicable) -->
        @if($data['is_delivery_challan'])
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #9CA3AF; margin-bottom: 5px;">
          <tr>
            <td style="background-color: {{ $headerTint }}; font-size: 8.5px; font-weight: 800; color: #111827; padding: 3px 6px; border-bottom: 1px solid #9CA3AF;">
              Transportation Details
            </td>
          </tr>
          <tr>
            <td style="padding: 5px 6px; font-size: 8.5px; line-height: 1.4; background-color: #FFFFFF;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="width: 88px; color: #374151; padding: 1px 0;">Reason</td>
                  <td style="width: 8px; color: #374151; padding: 1px 0;">:</td>
                  <td style="font-weight: bold; color: #111827; padding: 1px 0;">{{ $data['challan']['reason'] }}</td>
                </tr>
                @if(!empty($data['challan']['vehicle_no']))
                <tr>
                  <td style="color: #374151; padding: 1px 0;">Vehicle No.</td>
                  <td style="color: #374151; padding: 1px 0;">:</td>
                  <td style="font-weight: bold; color: #111827; padding: 1px 0;">{{ $data['challan']['vehicle_no'] }}</td>
                </tr>
                @endif
                @if(!empty($data['challan']['transporter_name']))
                <tr>
                  <td style="color: #374151; padding: 1px 0;">Transporter</td>
                  <td style="color: #374151; padding: 1px 0;">:</td>
                  <td style="font-weight: bold; color: #111827; padding: 1px 0;">{{ $data['challan']['transporter_name'] }}</td>
                </tr>
                @endif
                @if(!empty($data['challan']['eway_bill_no']))
                <tr>
                  <td style="color: #374151; padding: 1px 0;">E-way Bill No.</td>
                  <td style="color: #374151; padding: 1px 0;">:</td>
                  <td style="font-weight: bold; color: #111827; padding: 1px 0;">{{ $data['challan']['eway_bill_no'] }}</td>
                </tr>
                @endif
              </table>
            </td>
          </tr>
        </table>
        @endif

        <!-- Terms & Conditions Box -->
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #9CA3AF;">
          <tr>
            <td style="background-color: {{ $headerTint }}; font-size: 8.5px; font-weight: 800; color: #111827; padding: 3px 6px; border-bottom: 1px solid #9CA3AF;">
              Terms & Conditions
            </td>
          </tr>
          <tr>
            <td style="padding: 5px 6px; font-size: 8px; line-height: 1.38; background-color: #FFFFFF;">
              <ol style="margin: 0; padding-left: 13px; color: #374151;">
                @foreach($data['terms'] as $term)
                  <li>{{ $term }}</li>
                @endforeach
              </ol>
            </td>
          </tr>
        </table>

      </td>

      <!-- Spacer -->
      <td style="width: 1.4%;"></td>

      <!-- Right Column -->
      <td style="width: 49.3%; vertical-align: top; padding: 0;">

        <!-- Summary / Tax Bifurcation Box -->
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #9CA3AF; margin-bottom: 5px;">
          <!-- Header -->
          <tr style="background-color: {{ $headerTint }};">
            <td style="font-size: 8.5px; font-weight: 800; color: #111827; padding: 3px 6px; border: 1px solid #9CA3AF;">
              Summary / Tax Bifurcation
            </td>
            <td style="font-size: 8.5px; font-weight: 800; color: #111827; text-align: right; padding: 3px 6px; border: 1px solid #9CA3AF; width: 36%;">
              Amount (₹)
            </td>
          </tr>

          <!-- Taxable Amount Row -->
          <tr style="background-color: #FFFFFF;">
            <td style="font-size: 8.5px; color: #374151; padding: 3px 6px; border: 1px solid #9CA3AF;">
              {{ $data['has_tax'] ? 'Total Taxable Amount' : 'Total Amount' }}
            </td>
            <td style="font-size: 8.5px; font-weight: bold; text-align: right; color: #111827; padding: 3px 6px; border: 1px solid #9CA3AF;">
              {{ number_format((float) $data['summary']['taxable_value'], 2) }}
            </td>
          </tr>

          <!-- Tax Rows (Omitted for Bill of Supply) -->
          @if($data['has_tax'])
            @if($data['summary']['show_split_tax'])
              <tr style="background-color: #FFFFFF;">
                <td style="font-size: 8.5px; color: #374151; padding: 3px 6px; border: 1px solid #9CA3AF;">
                  CGST @ {{ $data['summary']['cgst_rate'] ?? '9' }} %
                </td>
                <td style="font-size: 8.5px; text-align: right; color: #111827; padding: 3px 6px; border: 1px solid #9CA3AF;">
                  {{ number_format((float) $data['summary']['cgst_amount'], 2) }}
                </td>
              </tr>
              <tr style="background-color: #FFFFFF;">
                <td style="font-size: 8.5px; color: #374151; padding: 3px 6px; border: 1px solid #9CA3AF;">
                  SGST @ {{ $data['summary']['sgst_rate'] ?? '9' }} %
                </td>
                <td style="font-size: 8.5px; text-align: right; color: #111827; padding: 3px 6px; border: 1px solid #9CA3AF;">
                  {{ number_format((float) $data['summary']['sgst_amount'], 2) }}
                </td>
              </tr>
              <tr style="background-color: #FFFFFF;">
                <td style="font-size: 8.5px; color: #374151; padding: 3px 6px; border: 1px solid #9CA3AF;">
                  IGST
                </td>
                <td style="font-size: 8.5px; text-align: right; color: #111827; padding: 3px 6px; border: 1px solid #9CA3AF;">
                  {{ number_format((float) $data['summary']['igst_amount'], 2) }}
                </td>
              </tr>
            @else
              <tr style="background-color: #FFFFFF;">
                <td style="font-size: 8.5px; color: #374151; padding: 3px 6px; border: 1px solid #9CA3AF;">
                  IGST @ {{ $data['summary']['igst_rate'] ?? '18' }} %
                </td>
                <td style="font-size: 8.5px; text-align: right; color: #111827; padding: 3px 6px; border: 1px solid #9CA3AF;">
                  {{ number_format((float) $data['summary']['igst_amount'], 2) }}
                </td>
              </tr>
            @endif
          @endif

          <!-- Round Off Row -->
          <tr style="background-color: #FFFFFF;">
            <td style="font-size: 8.5px; color: #374151; padding: 3px 6px; border: 1px solid #9CA3AF;">
              Round Off
            </td>
            <td style="font-size: 8.5px; text-align: right; color: #111827; padding: 3px 6px; border: 1px solid #9CA3AF;">
              {{ number_format((float) $data['summary']['round_off'], 2) }}
            </td>
          </tr>

          <!-- Grand Total Row (Large & Bold Theme Bar) -->
          <tr style="background-color: {{ $theme['primary'] }}; color: #FFFFFF;">
            <td style="font-size: 11.5px; font-weight: 800; padding: 5px 6px; border: 1px solid #9CA3AF; letter-spacing: 0.3px;">
              Grand Total (₹)
            </td>
            <td style="font-size: 11.5px; font-weight: 800; text-align: right; padding: 5px 6px; border: 1px solid #9CA3AF;">
              {{ number_format((float) $data['summary']['grand_total'], 2) }}
            </td>
          </tr>
        </table>

        <!-- For <company> Box (Larger Seal Circle + ~80px Signature Area + Name) -->
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #9CA3AF; background-color: #FFFFFF;">
          <tr>
            <td style="padding: 5px 8px; border-bottom: 0;">
              <div style="font-size: 9px; font-weight: 800; color: #111827;">
                For {{ $data['company_name'] }}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 2px 8px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <!-- Larger Company Seal Circle -->
                  <td style="width: 45%; text-align: center; vertical-align: middle; padding: 2px 0;">
                    @if(!empty($data['seal_path']))
                      <img src="{{ $data['seal_path'] }}" style="max-width: 68px; max-height: 68px; vertical-align: middle;" alt="Seal">
                    @else
                      <div style="display: inline-block; width: 66px; height: 66px; border: 1.5px dashed #4B5563; border-radius: 50%; text-align: center; vertical-align: middle;">
                        <div style="font-size: 8px; color: #4B5563; font-weight: bold; line-height: 1.25; padding-top: 20px;">
                          Company<br>Seal
                        </div>
                      </div>
                    @endif
                  </td>

                  <!-- Signature Area (~80px total height) & Title -->
                  <td style="width: 55%; text-align: center; vertical-align: bottom; padding: 0 0 2px 0;">
                    @if(!empty($data['signature_path']))
                      <img src="{{ $data['signature_path'] }}" style="max-height: 48px; max-width: 110px; margin-bottom: 2px;" alt="Signature">
                    @else
                      <div style="height: 42px;"></div>
                    @endif
                    <div style="border-bottom: 1.2px solid #374151; width: 110px; margin: 0 auto 3px auto;"></div>
                    <div style="font-size: 8px; color: #374151; font-weight: bold;">
                      Authorized Signatory
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          {{-- Signatory Name Line (only Name shown) --}}
          <tr>
            <td style="padding: 3px 8px 6px 8px; font-size: 8.5px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="width: 52px; color: #374151;">Name</td>
                  <td style="width: 8px; color: #374151;">:</td>
                  <td style="font-weight: bold; color: #111827;">{{ $data['signatory_name'] }}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>

  <!-- 7. Tagline Strip (Thicker Theme Colour Bar at Bottom of Frame) -->
  @if(!empty($data['tagline']))
  <div style="background-color: {{ $theme['primary'] }}; color: #FFFFFF; font-size: 9.5px; font-weight: 800; letter-spacing: 3px; text-align: center; text-transform: uppercase; padding: 5px 6px; margin-top: 5px;">
    {{ $data['tagline'] }}
  </div>
  @endif

</body>
</html>
