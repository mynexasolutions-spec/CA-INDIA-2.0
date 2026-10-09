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
    font-size: 10px;
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

  <!-- 1. Header Section -->
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 4px;">
    <tr>
      <!-- Logo Box -->
      <td style="width: 98px; vertical-align: middle; padding-right: 10px;">
        <div style="width: 90px; height: 90px; border: 1.5px solid #D1D5DB; background-color: #FFFFFF; text-align: center; vertical-align: middle; padding: 4px;">
          @if(!empty($data['logo_path']))
            <img src="{{ $data['logo_path'] }}" style="max-width: 82px; max-height: 82px; vertical-align: middle;" alt="Logo">
          @else
            <div style="font-size: 15px; font-weight: 800; color: {{ $theme['primary'] }}; line-height: 82px; text-align: center;">
              {{ substr($data['company_name'], 0, 4) }}
            </div>
          @endif
        </div>
      </td>
      <!-- Company Details -->
      <td style="vertical-align: middle; padding-left: 2px;">
        <div style="font-size: 23px; font-weight: 800; color: #111827; letter-spacing: 0.5px; margin-bottom: 3px; text-transform: uppercase;">
          {{ $data['company_name'] }}
        </div>
        @if(!empty($data['seller_address']))
        <div style="font-size: 9px; color: #374151; line-height: 1.35; margin-bottom: 3px;">
          {{ $data['seller_address'] }}
        </div>
        @endif
        <div style="font-size: 9px; color: #1F2937; line-height: 1.4;">
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
        <div style="font-size: 9px; color: #1F2937; line-height: 1.4; margin-top: 2px;">
          @if(!empty($data['seller_email']))
            <b>Email:</b> {{ $data['seller_email'] }}
          @endif
        </div>
      </td>
    </tr>
  </table>

  <!-- Header Divider Line -->
  <div style="border-bottom: 1.5px solid #D1D5DB; margin: 4px 0 10px 0;"></div>

  <!-- 2. Meta Information Row + Document Title Pill -->
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px;">
    <tr>
      <!-- Left: Key/Value Grid -->
      <td style="vertical-align: middle;">
        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
          <tr>
            <td style="width: 95px; color: #4B5563; padding: 2px 0;">{{ $data['doc_date_label'] }}</td>
            <td style="width: 125px; font-weight: 800; font-size: 12px; color: #111827; padding: 2px 0;">{{ $data['invoice_date'] }}</td>
            <td style="width: 105px; color: #4B5563; padding: 2px 0;">Place of Supply</td>
            <td style="font-weight: 800; font-size: 12px; color: #111827; padding: 2px 0;">{{ $data['place_of_supply'] }}</td>
          </tr>
          <tr>
            <td style="color: #4B5563; padding: 2px 0;">{{ $data['doc_number_label'] }}</td>
            <td style="font-weight: 800; font-size: 12px; color: #111827; padding: 2px 0;">{{ $data['invoice_no'] }}</td>
            <td style="color: #4B5563; padding: 2px 0;">Reverse Charge</td>
            <td style="font-weight: 800; font-size: 12px; color: #111827; padding: 2px 0;">
              {{ $data['reverse_charge'] ? 'Yes' : 'No' }}
              @if(in_array($data['doc_type'], ['credit_note', 'debit_note'], true))
                &nbsp;&nbsp;&nbsp;&nbsp;<span style="font-weight: normal; color: #4B5563;">Against</span>&nbsp;&nbsp;<b>{{ $data['against_number'] ?: '—' }}</b>
              @endif
            </td>
          </tr>
        </table>
      </td>
      <!-- Right: Document Title Pill -->
      <td style="width: 170px; text-align: right; vertical-align: middle;">
        <div style="display: inline-block; background-color: {{ $theme['light_tint'] }}; border: 1.5px solid {{ $theme['primary'] }}; border-radius: 6px; padding: 7px 20px; text-align: center; font-weight: 800; font-size: 15px; color: {{ $theme['dark'] ?? '#111827' }}; letter-spacing: 0.4px;">
          {{ $data['document_title'] }}
        </div>
      </td>
    </tr>
  </table>

  <!-- 3. Bill To / Ship To Section (Shared Partial) -->
  @include('pdf.partials.parties')

  <!-- 4. Items Table Section (Shared Partial) -->
  @include('pdf.partials.items_table')

  <!-- 5. Bottom Section: Left (Bank + Terms + Challan) vs Right (Summary + Signatory) -->
  <table style="width: 100%; border-collapse: collapse; margin-top: 10px;" class="avoid-break">
    <tr>
      <!-- Left Column: Bank Details & Terms -->
      <td style="width: 49%; vertical-align: top; padding: 0;">
        @if($data['is_delivery_challan'])
        <div style="border: 1px solid #D1D5DB; margin-bottom: 12px;">
          <div style="background-color: {{ $theme['primary'] }}; color: #FFFFFF; font-size: 10.5px; font-weight: bold; padding: 6px 10px; letter-spacing: 0.5px; text-transform: uppercase;">
            TRANSPORTATION DETAILS
          </div>
          <div style="padding: 7px 10px; font-size: 9px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="width: 80px; color: #4B5563; padding: 2px 0;">Reason</td>
                <td style="width: 10px; color: #4B5563;">:</td>
                <td style="color: #111827; font-weight: bold;">{{ $data['challan']['reason'] }}</td>
              </tr>
              @if(!empty($data['challan']['vehicle_no']))
              <tr>
                <td style="color: #4B5563; padding: 2px 0;">Vehicle No.</td>
                <td style="color: #4B5563;">:</td>
                <td style="color: #111827; font-weight: bold;">{{ $data['challan']['vehicle_no'] }}</td>
              </tr>
              @endif
              @if(!empty($data['challan']['transporter_name']))
              <tr>
                <td style="color: #4B5563; padding: 2px 0;">Transporter</td>
                <td style="color: #4B5563;">:</td>
                <td style="color: #111827; font-weight: bold;">{{ $data['challan']['transporter_name'] }}</td>
              </tr>
              @endif
              @if(!empty($data['challan']['eway_bill_no']))
              <tr>
                <td style="color: #4B5563; padding: 2px 0;">E-way Bill No.</td>
                <td style="color: #4B5563;">:</td>
                <td style="color: #111827; font-weight: bold;">{{ $data['challan']['eway_bill_no'] }}</td>
              </tr>
              @endif
            </table>
          </div>
        </div>
        @endif

        @include('pdf.partials.bank_details')
        @include('pdf.partials.terms')
      </td>

      <td style="width: 2%;"></td>

      <!-- Right Column: Summary, Total, Words, Signatory -->
      <td style="width: 49%; vertical-align: top; padding: 0;">
        @include('pdf.partials.summary')
        @include('pdf.partials.signatory')
      </td>
    </tr>
  </table>

</body>
</html>
