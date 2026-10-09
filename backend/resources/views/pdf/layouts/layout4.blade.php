<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>{{ $data['document_title'] }} - {{ $data['invoice_no'] }}</title>
<style>
  @page {
    size: A4 portrait;
    margin: 4.5mm 7mm 7mm 7mm;
  }
  * {
    box-sizing: border-box;
  }
  body {
    font-family: DejaVu Sans, sans-serif;
    font-size: 10px;
    color: #111827;
    margin: 0;
    padding: 0;
    line-height: 1.32;
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
</style>
</head>
<body>

  <!-- 1. Header Section -->
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 4px;">
    <tr>
      <!-- Logo Box (White Box ~85px) -->
      <td style="width: 95px; vertical-align: middle; padding-right: 10px;">
        <div style="width: 85px; height: 85px; border: 1.5px solid #D1D5DB; background-color: #FFFFFF; text-align: center; vertical-align: middle; padding: 4px;">
          @if(!empty($data['logo_path']))
            <img src="{{ $data['logo_path'] }}" style="max-width: 77px; max-height: 77px; vertical-align: middle;" alt="Logo">
          @else
            <div style="font-size: 16px; font-weight: 800; color: {{ $theme['primary'] }}; line-height: 77px; text-align: center;">
              {{ substr($data['company_name'], 0, 4) }}
            </div>
          @endif
        </div>
      </td>

      <!-- Company Details (Company Name ~20pt Extra Bold) -->
      <td style="vertical-align: middle; padding-left: 2px; padding-right: 12px;">
        <div style="font-size: 25px; font-weight: 800; color: {{ $theme['dark'] }}; letter-spacing: 0.5px; margin-bottom: 2px; text-transform: uppercase; line-height: 1.15;">
          {{ $data['company_name'] }}
        </div>
        @if(!empty($data['seller_address']))
        <div style="font-size: 9px; color: #374151; line-height: 1.35; margin-bottom: 2px;">
          {{ $data['seller_address'] }}
        </div>
        @endif
        <div style="font-size: 9px; color: #1F2937; line-height: 1.35;">
          @if(!empty($data['seller_phone']))
            <b>Mobile:</b> {{ $data['seller_phone'] }}
          @endif
          @if(!empty($data['seller_gstin']))
            @if(!empty($data['seller_phone'])) &nbsp;|&nbsp; @endif<b>GSTIN:</b> {{ $data['seller_gstin'] }}
          @endif
          @if(!empty($data['seller_pan']))
            &nbsp;|&nbsp; <b>PAN Number:</b> {{ $data['seller_pan'] }}
          @endif
        </div>
        <div style="font-size: 9px; color: #1F2937; line-height: 1.35; margin-top: 1px;">
          @if(!empty($data['seller_email']))
            <b>Email:</b> {{ $data['seller_email'] }}
          @endif
        </div>
      </td>

      <!-- Vertical Divider -->
      <td style="width: 1px; vertical-align: middle; border-left: 1.5px solid #D1D5DB;"></td>

      <!-- Right Side: Document Title (Bada, bold theme-dark text with horizontal divider bars) -->
      @php
        $titleLen = strlen($data['document_title'] ?? '');
        $titleFontSize = match(true) {
          $titleLen <= 11 => '21px',
          $titleLen <= 14 => '18px',
          default => '16.5px',
        };
        $titleNowrap = $titleLen <= 11 ? 'white-space: nowrap;' : '';
      @endphp
      <td style="width: 225px; vertical-align: middle; text-align: center; padding-left: 10px; padding-right: 4px;">
        <div style="border-top: 1.5px solid {{ $theme['primary'] }}; margin-bottom: 5px;"></div>
        <div style="font-size: {{ $titleFontSize }}; font-weight: 800; color: {{ $theme['dark'] }}; letter-spacing: 0.6px; text-transform: uppercase; line-height: 1.18; {{ $titleNowrap }}">
          {{ $data['document_title'] }}
        </div>
        <div style="border-bottom: 1.5px solid {{ $theme['primary'] }}; margin-top: 5px;"></div>
      </td>
    </tr>
  </table>

  <!-- 2. Meta Strip: Light Tint Background Strip with Bold Values -->
  @php
    $isNote = in_array($data['doc_type'], ['credit_note', 'debit_note'], true);
    $cellWidth = $isNote ? '20%' : '25%';
  @endphp
  <table style="width: 100%; border-collapse: collapse; background-color: {{ $theme['light_tint'] }}; margin-top: 5px; margin-bottom: 8px;">
    <tr>
      <!-- Invoice No. -->
      <td style="width: {{ $cellWidth }}; padding: 5px 8px; vertical-align: middle; border-right: 1px solid rgba(0,0,0,0.12);">
        <div style="font-size: 8.5px; color: #4B5563; margin-bottom: 2px;">{{ $data['doc_number_label'] }}</div>
        <div style="font-size: 11.5px; font-weight: 800; color: #111827;">{{ $data['invoice_no'] }}</div>
      </td>
      <!-- Invoice Date -->
      <td style="width: {{ $cellWidth }}; padding: 5px 8px; vertical-align: middle; border-right: 1px solid rgba(0,0,0,0.12);">
        <div style="font-size: 8.5px; color: #4B5563; margin-bottom: 2px;">{{ $data['doc_date_label'] }}</div>
        <div style="font-size: 11.5px; font-weight: 800; color: #111827;">{{ $data['invoice_date'] }}</div>
      </td>
      <!-- Place of Supply -->
      <td style="width: {{ $cellWidth }}; padding: 5px 8px; vertical-align: middle; border-right: 1px solid rgba(0,0,0,0.12);">
        <div style="font-size: 8.5px; color: #4B5563; margin-bottom: 2px;">Place of Supply</div>
        <div style="font-size: 11.5px; font-weight: 800; color: #111827;">{{ $data['place_of_supply'] }}</div>
      </td>
      <!-- Reverse Charge -->
      <td style="width: {{ $cellWidth }}; padding: 5px 8px; vertical-align: middle; {{ $isNote ? 'border-right: 1px solid rgba(0,0,0,0.12);' : '' }}">
        <div style="font-size: 8.5px; color: #4B5563; margin-bottom: 2px;">Reverse Charge</div>
        <div style="font-size: 11.5px; font-weight: 800; color: #111827;">{{ $data['reverse_charge'] ? 'Yes' : 'No' }}</div>
      </td>
      @if($isNote)
      <!-- Against (Credit / Debit Note only) -->
      <td style="width: {{ $cellWidth }}; padding: 5px 8px; vertical-align: middle;">
        <div style="font-size: 8.5px; color: #4B5563; margin-bottom: 2px;">Against</div>
        <div style="font-size: 11.5px; font-weight: 800; color: #111827;">{{ $data['against_number'] ?: '—' }}</div>
      </td>
      @endif
    </tr>
  </table>

  <!-- 3. BILL TO / SHIP TO Section -->
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
    <tr>
      <!-- BILL TO Panel -->
      <td style="width: 49%; vertical-align: top; padding: 0;">
        <div style="border: 1px solid #D1D5DB; page-break-inside: avoid;">
          <div style="background-color: {{ $theme['primary'] }}; color: #FFFFFF; font-weight: bold; font-size: 10.5px; padding: 4.5px 8px; text-transform: uppercase; letter-spacing: 0.5px;">
            BILL TO
          </div>
          <div style="padding: 5px 8px 6px;">
            <div style="font-weight: 800; font-size: 11px; color: #111827; margin-bottom: 2px; text-transform: uppercase;">
              {{ $data['bill_to']['name'] }}
            </div>
            <div style="font-size: 9px; color: #374151; line-height: 1.35; margin-bottom: 5px;">
              {!! nl2br(e($data['bill_to']['address'] ?: '—')) !!}
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 9.5px;">
              <tr>
                <td style="width: 85px; color: #4B5563; padding: 1px 0;">GSTIN</td>
                <td style="width: 10px; color: #4B5563; padding: 1px 0;">:</td>
                <td style="color: #111827; font-weight: bold; padding: 1px 0;">{{ $data['bill_to']['gstin'] ?: 'Unregistered' }}</td>
              </tr>
              @if(!empty($data['bill_to']['pan']))
              <tr>
                <td style="color: #4B5563; padding: 1px 0;">PAN Number</td>
                <td style="width: 10px; color: #4B5563; padding: 1px 0;">:</td>
                <td style="color: #111827; font-weight: bold; padding: 1px 0;">{{ $data['bill_to']['pan'] }}</td>
              </tr>
              @endif
              <tr>
                <td style="color: #4B5563; padding: 1px 0;">Place of Supply</td>
                <td style="width: 10px; color: #4B5563; padding: 1px 0;">:</td>
                <td style="color: #111827; font-weight: bold; padding: 1px 0;">{{ $data['place_of_supply'] ?: ($data['bill_to']['state'] ?: '—') }}</td>
              </tr>
            </table>
          </div>
        </div>
      </td>

      <td style="width: 2%;"></td>

      <!-- SHIP TO Panel -->
      <td style="width: 49%; vertical-align: top; padding: 0;">
        <div style="border: 1px solid #D1D5DB; page-break-inside: avoid;">
          <div style="background-color: {{ $theme['primary'] }}; color: #FFFFFF; font-weight: bold; font-size: 10.5px; padding: 4.5px 8px; text-transform: uppercase; letter-spacing: 0.5px;">
            SHIP TO
          </div>
          <div style="padding: 5px 8px 6px;">
            <div style="font-weight: 800; font-size: 11px; color: #111827; margin-bottom: 2px; text-transform: uppercase;">
              {{ $data['ship_to']['name'] }}
            </div>
            <div style="font-size: 9px; color: #374151; line-height: 1.35; margin-bottom: 5px;">
              {!! nl2br(e($data['ship_to']['address'] ?: '—')) !!}
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 9.5px;">
              <tr>
                <td style="width: 85px; color: #4B5563; padding: 1px 0;">GSTIN</td>
                <td style="width: 10px; color: #4B5563; padding: 1px 0;">:</td>
                <td style="color: #111827; font-weight: bold; padding: 1px 0;">{{ $data['ship_to']['gstin'] ?: 'Unregistered' }}</td>
              </tr>
              @if(!empty($data['ship_to']['pan']))
              <tr>
                <td style="color: #4B5563; padding: 1px 0;">PAN Number</td>
                <td style="width: 10px; color: #4B5563; padding: 1px 0;">:</td>
                <td style="color: #111827; font-weight: bold; padding: 1px 0;">{{ $data['ship_to']['pan'] }}</td>
              </tr>
              @endif
              <tr>
                <td style="color: #4B5563; padding: 1px 0;">Place of Supply</td>
                <td style="width: 10px; color: #4B5563; padding: 1px 0;">:</td>
                <td style="color: #111827; font-weight: bold; padding: 1px 0;">{{ $data['ship_to']['state'] ?: ($data['place_of_supply'] ?: '—') }}</td>
              </tr>
            </table>
          </div>
        </div>
      </td>
    </tr>
  </table>

  <!-- 4. Items Table Section: Header Row Light Tint, Amount Column Taxable Value, Subtotal Bar Tinted -->
  @php
    $totalQty = 0;
    $totalAmount = 0;
    foreach ($data['items'] as $item) {
        if (!empty($item['qty'])) {
            $totalQty += (float) $item['qty'];
        }
        $totalAmount += (float) ($item['taxable_value'] ?? 0);
    }
    $totalQtyDisplay = fmod($totalQty, 1) == 0.0 ? (int)$totalQty : number_format($totalQty, 2);
  @endphp

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px; border: 1px solid #D1D5DB;">
    <thead>
      <tr style="background-color: {{ $theme['light_tint'] }}; color: {{ $theme['dark'] }}; font-size: 9.5px; font-weight: 800;">
        <th style="width: 30px; padding: 5px 2px; text-align: center; border-right: 1px solid rgba(0,0,0,0.1);">Sr.<br>No.</th>
        <th style="padding: 5px 8px; text-align: left; border-right: 1px solid rgba(0,0,0,0.1);">Description of Goods / Services</th>
        <th style="width: 60px; padding: 5px 3px; text-align: center; border-right: 1px solid rgba(0,0,0,0.1);">HSN</th>
        <th style="width: 40px; padding: 5px 3px; text-align: center; border-right: 1px solid rgba(0,0,0,0.1);">Qty</th>
        <th style="width: 36px; padding: 5px 3px; text-align: center; border-right: 1px solid rgba(0,0,0,0.1);">Unit</th>
        <th style="width: 65px; padding: 5px 4px; text-align: right; border-right: 1px solid rgba(0,0,0,0.1);">Rate (₹)</th>
        @if($data['has_tax'])
        <th style="width: 46px; padding: 5px 3px; text-align: center; border-right: 1px solid rgba(0,0,0,0.1);">GST (%)</th>
        @endif
        <th style="width: 82px; padding: 5px 8px; text-align: right;">Amount (₹)</th>
      </tr>
    </thead>
    <tbody>
      @forelse($data['items'] as $item)
      <tr style="border-bottom: 1px solid #E5E7EB; font-size: 9.5px; page-break-inside: avoid;">
        <td style="padding: 5px 3px; text-align: center; vertical-align: top; border-right: 1px solid #E5E7EB; color: #374151;">{{ $item['sr_no'] }}</td>
        <td style="padding: 5px 8px; text-align: left; vertical-align: top; border-right: 1px solid #E5E7EB;">
          <div style="font-weight: 800; font-size: 10.5px; color: #111827; text-transform: uppercase;">{{ $item['particulars'] }}</div>
          @if(!empty($item['description']))
          <div style="font-size: 8.5px; color: #374151; line-height: 1.32; margin-top: 1.5px;">
            {!! nl2br(e($item['description'])) !!}
          </div>
          @endif
        </td>
        <td style="padding: 5px 3px; text-align: center; vertical-align: top; border-right: 1px solid #E5E7EB; color: #374151; font-size: 9.5px;">{{ $item['hsn_sac'] ?: '—' }}</td>
        <td style="padding: 5px 3px; text-align: center; vertical-align: top; border-right: 1px solid #E5E7EB; font-weight: bold; color: #111827; font-size: 10px;">{{ $item['qty'] !== null ? $item['qty'] : '—' }}</td>
        <td style="padding: 5px 3px; text-align: center; vertical-align: top; border-right: 1px solid #E5E7EB; color: #374151; font-size: 9.5px;">{{ $item['uqc'] }}</td>
        <td style="padding: 5px 4px; text-align: right; vertical-align: top; border-right: 1px solid #E5E7EB; color: #111827; font-size: 9.5px;">{{ number_format($item['rate'], 2) }}</td>
        @if($data['has_tax'])
        <td style="padding: 5px 3px; text-align: center; vertical-align: top; border-right: 1px solid #E5E7EB; color: #374151; font-size: 9.5px;">{{ $item['gst_pct'] }}</td>
        @endif
        <td style="padding: 5px 8px; text-align: right; vertical-align: top; font-weight: bold; color: #111827; font-size: 10.5px;">{{ number_format($item['taxable_value'], 2) }}</td>
      </tr>
      @empty
      <tr>
        <td colspan="{{ $data['has_tax'] ? 8 : 7 }}" style="padding: 10px; text-align: center; color: #6B7280; font-size: 9.5px;">No items found.</td>
      </tr>
      @endforelse
    </tbody>
    <tfoot>
      <!-- SUBTOTAL Bar (Bada, Bold, Tinted) -->
      <tr style="background-color: {{ $theme['light_tint'] }}; border-top: 1.5px solid #9CA3AF; border-bottom: 1.5px solid #9CA3AF;">
        <td colspan="3" style="padding: 6px 8px; text-align: left; text-transform: uppercase; font-size: 13.5px; font-weight: 800; color: #111827; letter-spacing: 0.5px;">
          SUBTOTAL
        </td>
        <td style="padding: 6px 3px; text-align: center; font-size: 13px; font-weight: 800; color: #111827;">
          {{ $totalQtyDisplay ?: '' }}
        </td>
        <td colspan="{{ $data['has_tax'] ? 3 : 2 }}" style="padding: 6px;"></td>
        <td style="padding: 6px 8px; text-align: right; font-size: 13.5px; font-weight: 800; color: #111827;">
          {{ number_format($totalAmount, 2) }}
        </td>
      </tr>
    </tfoot>
  </table>

  <!-- 5. Bottom Section: Left (Bank Details + Terms) vs Right (Summary + Signatory) - No avoid-break on wrapper! -->
  <table style="width: 100%; border-collapse: collapse; margin-top: 5px;">
    <tr>
      <!-- Left Column: Bank Details & Terms & Challan Transportation Details -->
      <td style="width: 49%; vertical-align: top; padding: 0;">
        @if($data['is_delivery_challan'])
        <div style="border: 1px solid #D1D5DB; margin-bottom: 6px; page-break-inside: avoid;">
          <div style="background-color: {{ $theme['primary'] }}; color: #FFFFFF; font-size: 10px; font-weight: bold; padding: 4px 8px; letter-spacing: 0.5px; text-transform: uppercase;">
            TRANSPORTATION DETAILS
          </div>
          <div style="padding: 4px 8px; font-size: 8.5px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="width: 80px; color: #4B5563; padding: 1px 0;">Reason</td>
                <td style="width: 10px; color: #4B5563;">:</td>
                <td style="color: #111827; font-weight: bold;">{{ $data['challan']['reason'] }}</td>
              </tr>
              @if(!empty($data['challan']['vehicle_no']))
              <tr>
                <td style="color: #4B5563; padding: 1px 0;">Vehicle No.</td>
                <td style="color: #4B5563;">:</td>
                <td style="color: #111827; font-weight: bold;">{{ $data['challan']['vehicle_no'] }}</td>
              </tr>
              @endif
              @if(!empty($data['challan']['transporter_name']))
              <tr>
                <td style="color: #4B5563; padding: 1px 0;">Transporter</td>
                <td style="color: #4B5563;">:</td>
                <td style="color: #111827; font-weight: bold;">{{ $data['challan']['transporter_name'] }}</td>
              </tr>
              @endif
              @if(!empty($data['challan']['eway_bill_no']))
              <tr>
                <td style="color: #4B5563; padding: 1px 0;">E-way Bill No.</td>
                <td style="color: #4B5563;">:</td>
                <td style="color: #111827; font-weight: bold;">{{ $data['challan']['eway_bill_no'] }}</td>
              </tr>
              @endif
            </table>
          </div>
        </div>
        @endif

        <!-- Bank Details Card -->
        <div style="border: 1px solid #D1D5DB; margin-bottom: 6px; page-break-inside: avoid;">
          <div style="background-color: {{ $theme['primary'] }}; color: #FFFFFF; font-size: 10px; font-weight: bold; padding: 4px 8px; letter-spacing: 0.5px; text-transform: uppercase;">
            BANK DETAILS
          </div>
          <div style="padding: 4px 8px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 9px;">
              <tr>
                <td style="width: 78px; color: #4B5563; padding: 1.5px 0;">Name</td>
                <td style="width: 10px; color: #4B5563; padding: 1.5px 0;">:</td>
                <td style="color: #111827; font-weight: bold; padding: 1.5px 0;">{{ $data['bank']['account_name'] ?: $data['bank']['name'] }}</td>
              </tr>
              <tr>
                <td style="color: #4B5563; padding: 1.5px 0;">IFSC Code</td>
                <td style="width: 10px; color: #4B5563; padding: 1.5px 0;">:</td>
                <td style="color: #111827; font-weight: bold; padding: 1.5px 0;">{{ $data['bank']['ifsc'] ?: '—' }}</td>
              </tr>
              <tr>
                <td style="color: #4B5563; padding: 1.5px 0;">Account No.</td>
                <td style="width: 10px; color: #4B5563; padding: 1.5px 0;">:</td>
                <td style="color: #111827; font-weight: bold; padding: 1.5px 0;">{{ $data['bank']['account_no'] ?: '—' }}</td>
              </tr>
              <tr>
                <td style="color: #4B5563; padding: 1.5px 0;">Bank</td>
                <td style="width: 10px; color: #4B5563; padding: 1.5px 0;">:</td>
                <td style="color: #111827; padding: 1.5px 0;">{{ $data['bank']['name'] }}{{ $data['bank']['branch'] ? ' ,' . $data['bank']['branch'] : '' }}</td>
              </tr>
            </table>
          </div>
        </div>

        <!-- Terms Card -->
        <div style="border: 1px solid #D1D5DB; page-break-inside: avoid;">
          <div style="background-color: {{ $theme['primary'] }}; color: #FFFFFF; font-size: 10px; font-weight: bold; padding: 4px 8px; letter-spacing: 0.5px; text-transform: uppercase;">
            TERMS AND CONDITIONS
          </div>
          <div style="padding: 4px 8px 5px;">
            <ol style="margin: 0; padding-left: 13px; font-size: 8.5px; color: #374151; line-height: 1.3;">
              @foreach($data['terms'] as $term)
                <li style="margin-bottom: 2px;">{{ $term }}</li>
              @endforeach
            </ol>
          </div>
        </div>
      </td>

      <td style="width: 2%;"></td>

      <!-- Right Column: Summary / Tax Bifurcation + Total Amount bar + Words + Signatory -->
      <td style="width: 49%; vertical-align: top; padding: 0;">
        <!-- Summary Box -->
        <div style="border: 1px solid #D1D5DB; page-break-inside: avoid;">
          <div style="background-color: {{ $theme['primary'] }}; color: #FFFFFF; font-size: 10px; font-weight: bold; padding: 4px 8px;">
            <table style="width: 100%; border-collapse: collapse; color: #FFFFFF;">
              <tr>
                <td style="text-align: left; letter-spacing: 0.5px; text-transform: uppercase;">Summary / Tax Bifurcation</td>
                <td style="text-align: right; width: 90px;">Amount (₹)</td>
              </tr>
            </table>
          </div>
          <div style="padding: 4px 8px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 9px;">
              <tr>
                <td style="padding: 1.5px 0; color: #374151;">Taxable Amount</td>
                <td style="padding: 1.5px 0; text-align: right; color: #111827;">{{ number_format($data['summary']['taxable_value'], 2) }}</td>
              </tr>
              @if($data['has_tax'])
                @if(!empty($data['summary']['igst_amount']) || ($data['doc_type'] !== 'bill_of_supply' && !empty($data['summary']['igst_rate'])))
                <tr>
                  <td style="padding: 1.5px 0; color: #374151;">IGST @ {{ $data['summary']['igst_rate'] ?? 18 }}%</td>
                  <td style="padding: 1.5px 0; text-align: right; color: #111827;">{{ number_format($data['summary']['igst_amount'], 2) }}</td>
                </tr>
                @else
                <tr>
                  <td style="padding: 1.5px 0; color: #374151;">CGST @ {{ $data['summary']['cgst_rate'] ?? 9 }}%</td>
                  <td style="padding: 1.5px 0; text-align: right; color: #111827;">{{ number_format($data['summary']['cgst_amount'], 2) }}</td>
                </tr>
                <tr>
                  <td style="padding: 1.5px 0; color: #374151;">SGST @ {{ $data['summary']['sgst_rate'] ?? 9 }}%</td>
                  <td style="padding: 1.5px 0; text-align: right; color: #111827;">{{ number_format($data['summary']['sgst_amount'], 2) }}</td>
                </tr>
                @endif
              @endif
              <tr>
                <td style="padding: 1.5px 0; color: #374151;">Round Off</td>
                <td style="padding: 1.5px 0; text-align: right; color: #111827;">{{ number_format($data['summary']['round_off'], 2) }}</td>
              </tr>
            </table>
          </div>
          <!-- Total Amount Bar: Bada, Bold, Tinted -->
          <div style="background-color: {{ $theme['light_tint'] }}; border-top: 1.5px solid #9CA3AF; padding: 5px 8px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="font-weight: 800; font-size: 13.5px; color: #111827;">Total Amount (₹)</td>
                <td style="font-weight: 800; font-size: 14.5px; color: #111827; text-align: right;">{{ number_format($data['summary']['grand_total'], 2) }}</td>
              </tr>
            </table>
          </div>
        </div>

        <!-- Amount in Words -->
        <div style="margin-top: 5px; padding: 0 2px;">
          <div style="font-size: 8.5px; font-weight: bold; color: #111827;">Amount in words:</div>
          <div style="font-size: 8.5px; color: #374151; line-height: 1.35; margin-top: 1px;">{{ $data['amount_in_words'] }}</div>
        </div>

        <!-- Authorised Signatory Block (~80px total height) -->
        <div style="text-align: right; margin-top: 8px; page-break-inside: avoid;">
          <div style="height: 52px; text-align: right; margin-bottom: 2px;">
            @if(!empty($data['seal_path']))
              <img src="{{ $data['seal_path'] }}" style="max-height: 50px; max-width: 85px; vertical-align: middle; margin-right: 6px;" alt="Seal">
            @endif
            @if(!empty($data['signature_path']))
              <img src="{{ $data['signature_path'] }}" style="max-height: 50px; max-width: 130px; vertical-align: middle;" alt="Signature">
            @endif
          </div>
          <div style="font-size: 8.5px; font-weight: bold; color: #111827; letter-spacing: 0.3px; text-transform: uppercase;">
            AUTHORISED SIGNATORY FOR
          </div>
          <div style="font-size: 11px; font-weight: 800; color: #111827; letter-spacing: 0.3px; text-transform: uppercase;">
            {{ $data['company_name'] }}
          </div>
          @if(!empty($data['signatory_name']) && $data['signatory_name'] !== $data['company_name'])
          <div style="font-size: 8.5px; color: #374151; margin-top: 1px;">
            Name: <b>{{ $data['signatory_name'] }}</b>
          </div>
          @endif
        </div>
      </td>
    </tr>
  </table>

  <!-- 6. Thank-you Strip (Centered Italic with Thin Lines) -->
  <table style="width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 2px; page-break-inside: avoid;">
    <tr>
      <td style="width: 33%; vertical-align: middle;">
        <div style="border-top: 1px solid {{ $theme['primary'] }}; opacity: 0.6;"></div>
      </td>
      <td style="width: 34%; text-align: center; vertical-align: middle; padding: 0 10px; font-style: italic; font-size: 9px; color: {{ $theme['dark'] }}; white-space: nowrap;">
        Thank you for your business!
      </td>
      <td style="width: 33%; vertical-align: middle;">
        <div style="border-top: 1px solid {{ $theme['primary'] }}; opacity: 0.6;"></div>
      </td>
    </tr>
  </table>

</body>
</html>