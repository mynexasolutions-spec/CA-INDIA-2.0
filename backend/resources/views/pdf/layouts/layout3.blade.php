<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>{{ $data['document_title'] }} - {{ $data['invoice_no'] }}</title>
@php
  /*
   * Layout 3 — rounded, icon-led layout (Simple / Royal Blue / Deep Teal / Mocha Brown / Dusty Plum).
   *
   * Every coloured element comes from the theme, so one template serves all five colours. "Simple" is the
   * monochrome variant: no filled bars — black outlines and black text on white.
   */
  $icons = $icons ?? \App\Services\DocumentTemplate\DocumentCanvasHelper::resolveIcons($theme['key'] ?? 'slate_blue');
  $simple = ($theme['key'] ?? '') === 'simple';
  $accent = $theme['primary'];                                       // borders, headings, accents
  $barBg  = $simple ? '#FFFFFF' : $theme['primary'];                 // filled header bars
  $barFg  = $simple ? '#111111' : ($theme['text_on_primary'] ?? '#FFFFFF');
  $tint   = $simple ? '#FFFFFF' : ($theme['grand_bg'] ?? $theme['light_tint'] ?? '#E6EEFD'); // grand-total band
  $grandLine = $simple ? $accent : ($theme['grand_line'] ?? $accent);
  $grandLabel = $theme['grand_label'] ?? (isset($theme['grand_line']) ? $accent : '#0F172A');
  $barDivider = $simple ? 'border-bottom: 1.3px solid ' . $accent . ';' : '';

  // Whole rupees print without decimals, anything else with the client's configured decimals.
  $dp = (int) ($data['decimals'] ?? 2);
  $money = function ($n) use ($dp) {
      $n = (float) $n;
      return abs($n - round($n)) < 0.005 ? number_format($n, 0) : number_format($n, $dp);
  };

  // The address card and the document-info card sit side by side, so they are as tall as the taller of the two.
  // Whichever has less content gets a little extra padding on its rows, so the gap under the last row is the same in
  // both (as on the approved form). Measured at 9.6px: a normal row is ~23.8px, each extra wrapped address line
  // ~17.1px, and the "— TAX INVOICE —" pill block ~39px.
  $addrLines = max(1, (int) ceil(mb_strlen(trim((string) ($data['seller_address'] ?? ''))) / 45));
  $leftRows = (!empty($data['seller_address']) ? 1 : 0) + ((!empty($data['seller_gstin']) || !empty($data['seller_pan'])) ? 1 : 0)
      + (!empty($data['seller_email']) ? 1 : 0) + (!empty($data['seller_phone']) ? 1 : 0) + (!empty($data['seller_state']) ? 1 : 0);
  $rightRows = 2 + (in_array($data['doc_type'] ?? '', ['credit_note', 'debit_note'], true) ? 0 : 1)
      + (!empty($data['place_of_supply']) ? 1 : 0) + 1 + (!empty($data['against_number']) ? 1 : 0)
      + (!empty($data['po_number']) ? 1 : 0);
  $leftH = max(1, $leftRows) * 23.8 + (empty($data['seller_address']) ? 0 : ($addrLines - 1) * 17.1);
  $rightH = 39 + max(1, $rightRows) * 23.8;
  $diffH = $leftH - $rightH;
  $padLeftRow = $diffH < 0 ? round(min(-$diffH / max(1, $leftRows), 14) / 2, 2) : 0;     // extra px above and below each left row
  $padRightRow = $diffH > 0 ? round(min($diffH / max(1, $rightRows), 14) / 2, 2) : 0;

  // Long business names step down so they stay on one line inside the header box.
  $nameLen = mb_strlen((string) $data['company_name']);
  $nameSize = $nameLen <= 22 ? '25pt' : ($nameLen <= 30 ? '21pt' : ($nameLen <= 40 ? '17pt' : ($nameLen <= 52 ? '14pt' : '11.5pt')));
@endphp
<style>
  @page {
    size: A4 portrait;
    /* The bottom margin stays at 8mm so a row that nearly fits still goes on the page. Where a table is cut at the page
       bottom its canvas outline is ended at the last row (DocumentCanvasHelper::roundedBorders), so it never reaches the
       frame's bottom edge, which is drawn 28pt above the page bottom. */
    margin: 8mm 10.2mm 8mm 10.2mm;
  }
  * { box-sizing: border-box; }
  body {
    font-family: DejaVu Sans, sans-serif;
    font-size: 10px;
    color: #1E293B;
    margin: 0;
    padding: 4px 4px 0;
    line-height: 1.4;
  }
  table { width: 100%; border-collapse: collapse; }
  td, th { vertical-align: top; }

  /* 1. Header: logo box + company name box */
  .hdr-table { width: 100%; margin-bottom: 11px; border-collapse: separate; }
  .hdr-logo-box {
    width: 92px; height: 90px;
    border: 1.3px solid transparent;
    border-radius: 9px;
    padding: 6px;
    text-align: center; vertical-align: middle;
    background: #ffffff;
  }
  .hdr-logo-box img { width: 76px; height: 76px; max-width: 76px; max-height: 76px; display: block; margin: 0 auto; }
  .hdr-gap { width: 8px; }
  .hdr-title-box {
    height: 90px;
    border: 1.3px solid transparent;
    border-radius: 9px;
    padding: 0 14px;
    text-align: center; vertical-align: middle;
    background: #ffffff;
  }
  .hdr-company-name {
    color: {{ $simple ? '#111111' : $accent }};
    font-size: {{ $nameSize }};
    font-weight: 900;
    margin: 0;
    line-height: 1.25;
    text-transform: uppercase;
    white-space: nowrap;
  }

  /* 2. Seller panel + document panel */
  .panel-table { width: 100%; margin-bottom: 11px; border-collapse: separate; border-spacing: 0; }
  .panel-left, .panel-right {
    border: 1.3px solid transparent;
    border-radius: 9px;
    padding: 9px 12px;
    background: #ffffff;
    vertical-align: top;
  }
  .panel-left { width: 53.5%; }
  .panel-right { width: 45.3%; }
  .panel-gap { width: 1.2%; }
  .meta-tbl, .meta-right-tbl { width: 100%; }
  .meta-tbl td, .meta-right-tbl td { padding: 3px 0; font-size: 9.6px; vertical-align: top; }
  .meta-tbl td { padding-top: {{ 3 + $padLeftRow }}px; padding-bottom: {{ 3 + $padLeftRow }}px; }
  .meta-right-tbl td { padding-top: {{ 3 + $padRightRow }}px; padding-bottom: {{ 3 + $padRightRow }}px; }
  .meta-right-tbl td { vertical-align: middle; }
  .meta-ico { width: 22px; padding-right: 5px; }
  .meta-ico img { width: 17px; height: 17px; display: block; margin-top: 1px; }
  .meta-label { width: 52px; font-weight: bold; color: #1E293B; white-space: nowrap; }
  .meta-right-label { width: 104px; font-weight: bold; color: #1E293B; white-space: nowrap; }
  .meta-colon { width: 10px; font-weight: bold; color: #1E293B; text-align: center; }
  .meta-val { color: #0F172A; font-weight: bold; }
  .pill-wrap { text-align: center; margin: 2px 0 8px; }
  .tax-pill {
    display: inline-block;
    background-color: {{ $barBg }};
    color: {{ $barFg }};
    @if($simple) border: 1.3px solid transparent; @endif
    font-size: 11px; font-weight: bold; letter-spacing: 1.2px; text-transform: uppercase;
    padding: 4.5px 24px;
    border-radius: 18px;
  }

  /* 3. Receiver / consignee */
  .party-table { width: 100%; margin-bottom: 11px; border-collapse: separate; border-spacing: 0; }
  .party-box {
    width: 49.4%;
    border: 1.3px solid transparent;
    border-radius: 9px;
    background: #ffffff;
    vertical-align: top;
    padding: 0;
  }
  .party-hdr {
    background-color: {{ $barBg }};
    color: {{ $barFg }};
    {!! $barDivider !!}
    font-size: 9.2px; font-weight: bold; letter-spacing: 0.5px; text-transform: uppercase;
    padding: 6.5px 12px;
    border-top-left-radius: 9px; border-top-right-radius: 9px;
    margin: -1.3px -1.3px 0 -1.3px;
  }
  .party-body { padding: 8px 12px 10px; }
  .party-name { font-weight: bold; font-size: 11.2px; color: #0F172A; margin-bottom: 4px; }
  .party-fields { width: 100%; }
  .party-fields td { padding: 2px 0; font-size: 9.5px; vertical-align: top; }
  .pf-lab { width: 52px; font-weight: bold; color: #1E293B; white-space: nowrap; }
  .pf-colon { width: 10px; font-weight: bold; color: #1E293B; text-align: center; }
  .pf-val { color: #1E293B; }

  /* 4. Items */
  .items-wrap {
    border: 1.3px solid transparent;
    border-radius: 9px;
    margin-bottom: 11px;
    overflow: hidden;
    background: #ffffff;
  }
  .items-table { width: 100%; border-collapse: collapse; }
  .items-table thead { display: table-header-group; }
  .items-table th {
    background-color: {{ $barBg }};
    color: {{ $barFg }};
    {!! $barDivider !!}
    font-size: 8.8px; font-weight: bold; padding: 8px 4px; text-align: center; text-transform: uppercase;
    border-right: 1px solid {{ $simple ? '#CBD5E1' : 'rgba(255, 255, 255, 0.25)' }};
    line-height: 1.3;
  }
  .items-table th:last-child { border-right: none; }
  .items-table th:first-child { border-top-left-radius: 7.7px; }
  .items-table th:last-child { border-top-right-radius: 7.7px; }
  .items-table td {
    border-bottom: 1px solid #E2E8F0;
    border-right: 1px solid #E2E8F0;
    padding: 8.5px 5px; font-size: 10px; font-weight: bold; color: #0F172A; vertical-align: middle; text-align: center;
  }
  .items-table td:last-child { border-right: none; }
  .items-table tr:last-child td { border-bottom: none; }
  .items-table tr { page-break-inside: avoid; }
  .items-table .desc-cell { text-align: center; font-weight: bold; color: #0F172A; text-transform: uppercase; }

  /* 5. Bottom: cards (left) + summary and signatory (right) */
  .bottom-table { width: 100%; margin-top: 4px; }
  .bottom-left { width: 50.5%; vertical-align: top; }
  .bottom-gap { width: 1.5%; }
  .bottom-right { width: 48%; vertical-align: top; }
  .card {
    border: 1.3px solid transparent;
    border-radius: 9px;
    padding: 8px 12px;
    background: #ffffff;
    margin-bottom: 8px;
    /* keep together handled by the row */
  }
  .card-hdr { color: {{ $accent }}; font-weight: bold; font-size: 9.6px; letter-spacing: 0.4px; text-transform: uppercase; }
  .card-hdr img { width: 15px; height: 15px; vertical-align: -2.5px; margin-right: 5px; }
  .card-sep { border-top: 1px dashed {{ $simple ? '#6B7280' : $accent }}; margin: 5px 0 6px; }
  .card-val { font-size: 10px; font-weight: bold; color: #0F172A; line-height: 1.45; }
  .bank-tbl { width: 100%; }
  .bank-tbl td { padding: 1.5px 0; font-size: 9.6px; vertical-align: top; }
  .bt-lab { width: 82px; font-weight: normal; color: #334155; white-space: nowrap; }
  .bt-colon { width: 10px; font-weight: normal; color: #334155; text-align: center; }
  .bt-val { color: #0F172A; }
  .terms-list { margin: 0; padding-left: 15px; font-size: 9.2px; color: #1E293B; line-height: 1.45; }
  .terms-list li { margin-bottom: 1px; }

  .summary-box {
    border: 1.3px solid transparent;
    border-radius: 9px;
    overflow: hidden;
    background: #ffffff;
    margin-bottom: 14px;

  }
  .sum-tbl { width: 100%; border-collapse: collapse; }
  .sum-tbl td { padding: 6.5px 12px; font-size: 9.8px; border-bottom: 1px solid #E2E8F0; }
  .sum-tbl .lab { color: #334155; font-weight: normal; }
  .sum-tbl .val { text-align: right; color: #0F172A; font-weight: normal; }
  .grand-row td {
    background-color: {{ $tint }};
    border-top: 2px solid {{ $grandLine }};
    border-bottom: 2px solid {{ $grandLine }} !important;
    padding: 11px 12px;
  }};
    border-top: 2px solid {{ $accent }};
    border-bottom: none !important;
    padding: 8.5px 12px;
  }
  .grand-row .lab { color: {{ $grandLabel }}; font-size: 11.5px; font-weight: bold; letter-spacing: 0.4px; }
  .grand-row .val { color: #0F172A; font-size: 13.5px; font-weight: bold; }

  .sign-wrap { page-break-inside: avoid; margin-top: 8px; }
  .sign-company { text-align: right; font-size: 11.5px; font-weight: bold; color: {{ $simple ? '#111111' : $accent }}; margin-bottom: 10px; }
  .sign-tbl { width: 210px; margin-left: auto; border-collapse: collapse; }
  .seal-cell { width: 65px; vertical-align: middle; text-align: center; padding-right: 12px; }
  .seal-cell img { width: 60px; height: 60px; max-width: 60px; max-height: 60px; display: block; margin: 0 auto; }
  .sig-cell { vertical-align: middle; text-align: right; }
  .sig-img { max-height: 30px; display: block; margin-left: auto; margin-bottom: 2px; }
  .sig-name { font-size: 10.5px; font-weight: bold; color: {{ $simple ? '#111111' : $accent }}; margin-top: 2px; }
  .sig-role { font-size: 8.6px; color: #64748B; margin-top: 2px; font-weight: bold; }
  .rcm-box {
    margin-top: 9px;
    border: 1.2px solid transparent;
    border-radius: 7px;
    color: {{ $accent }};
    font-weight: bold; font-size: 9.2px; padding: 5px 8px; text-align: center;
    page-break-inside: avoid;
  }
</style>
</head>
<body>

  <!-- 1. Header: logo box + company name box -->
  <table class="hdr-table">
    <tr>
      <td class="hdr-logo-box">
        @if(!empty($data['logo_path']))
          <img src="{{ $data['logo_path'] }}" alt="Logo">
        @endif
      </td>
      <td class="hdr-gap"></td>
      <td class="hdr-title-box">
        <h1 class="hdr-company-name">{{ $data['company_name'] }}</h1>
      </td>
    </tr>
  </table>

  <!-- 2. Seller details + document details -->
  <table class="panel-table">
    <tr>
      <td class="panel-left">
        <table class="meta-tbl">
          @if(!empty($data['seller_address']))
          <tr>
            <td class="meta-ico"><img src="{{ $icons['pin'] }}" alt=""></td>
            <td class="meta-label">Address</td>
            <td class="meta-colon">:</td>
            <td class="meta-val">{{ $data['seller_address'] }}</td>
          </tr>
          @endif
          @if(!empty($data['seller_gstin']) || !empty($data['seller_pan']))
          <tr>
            <td class="meta-ico"><img src="{{ $icons['gstin'] }}" alt=""></td>
            <td class="meta-label">GSTIN</td>
            <td class="meta-colon">:</td>
            <td class="meta-val">
              {{ $data['seller_gstin'] ?: '—' }}@if(!empty($data['seller_pan'])) | PAN : {{ $data['seller_pan'] }}@endif
            </td>
          </tr>
          @endif
          @if(!empty($data['seller_email']))
          <tr>
            <td class="meta-ico"><img src="{{ $icons['email'] }}" alt=""></td>
            <td class="meta-label">Email</td>
            <td class="meta-colon">:</td>
            <td class="meta-val">{{ $data['seller_email'] }}</td>
          </tr>
          @endif
          @if(!empty($data['seller_phone']))
          <tr>
            <td class="meta-ico"><img src="{{ $icons['phone'] }}" alt=""></td>
            <td class="meta-label">Phone</td>
            <td class="meta-colon">:</td>
            <td class="meta-val">{{ $data['seller_phone'] }}</td>
          </tr>
          @endif
          @if(!empty($data['seller_state']))
          <tr>
            <td class="meta-ico"><img src="{{ $icons['pin'] }}" alt=""></td>
            <td class="meta-label">State</td>
            <td class="meta-colon">:</td>
            <td class="meta-val">{{ $data['seller_state'] }}</td>
          </tr>
          @endif
        </table>
      </td>
      <td class="panel-gap"></td>
      <td class="panel-right">
        <div class="pill-wrap">
          <span class="tax-pill">— {{ $data['document_title'] }} —</span>
        </div>
        <table class="meta-right-tbl">
          <tr>
            <td class="meta-ico"><img src="{{ $icons['doc'] }}" alt=""></td>
            <td class="meta-right-label">{{ $data['doc_number_label'] ?? 'Invoice No.' }}</td>
            <td class="meta-colon">:</td>
            <td class="meta-val">{{ $data['invoice_no'] }}</td>
          </tr>
          <tr>
            <td class="meta-ico"><img src="{{ $icons['calendar'] }}" alt=""></td>
            <td class="meta-right-label">{{ $data['doc_date_label'] ?? 'Invoice Date' }}</td>
            <td class="meta-colon">:</td>
            <td class="meta-val">{{ $data['invoice_date'] }}</td>
          </tr>
          @unless(in_array($data['doc_type'] ?? '', ['credit_note', 'debit_note'], true))
          <tr>
            <td class="meta-ico"><img src="{{ $icons['chart'] }}" alt=""></td>
            <td class="meta-right-label">Financial Year</td>
            <td class="meta-colon">:</td>
            <td class="meta-val">{{ $data['financial_year'] }}</td>
          </tr>
          @endunless
          @if(!empty($data['place_of_supply']))
          <tr>
            <td class="meta-ico"><img src="{{ $icons['pin'] }}" alt=""></td>
            <td class="meta-right-label">Place of Supply</td>
            <td class="meta-colon">:</td>
            <td class="meta-val">{{ $data['place_of_supply'] }}</td>
          </tr>
          @endif
          <tr>
            <td class="meta-ico"><img src="{{ $icons['reverse'] }}" alt=""></td>
            <td class="meta-right-label">Reverse Charge</td>
            <td class="meta-colon">:</td>
            <td class="meta-val">{{ $data['reverse_charge'] ? 'Yes' : 'No' }}</td>
          </tr>
          @if(!empty($data['against_number']))
          <tr>
            <td class="meta-ico"><img src="{{ $icons['doc'] }}" alt=""></td>
            <td class="meta-right-label">Against</td>
            <td class="meta-colon">:</td>
            <td class="meta-val">{{ $data['against_number'] }}</td>
          </tr>
          @endif
          @if(!empty($data['po_number']))
          <tr>
            <td class="meta-ico"><img src="{{ $icons['doc'] }}" alt=""></td>
            <td class="meta-right-label">PO No.</td>
            <td class="meta-colon">:</td>
            <td class="meta-val">{{ $data['po_number'] }}</td>
          </tr>
          @endif
        </table>
      </td>
    </tr>
  </table>

  <!-- 3. Details of receiver | details of consignee -->
  <table class="party-table">
    <tr>
      @foreach([['DETAILS OF RECEIVER | BILL TO', $data['bill_to']], ['DETAILS OF CONSIGNEE | SHIP TO', $data['ship_to']]] as $i => [$partyTitle, $party])
        @if($i === 1)<td class="panel-gap"></td>@endif
        <td class="party-box">
          <div class="party-hdr">{{ $partyTitle }}</div>
          <div class="party-body">
            <div class="party-name">{{ $party['name'] ?? '—' }}</div>
            <table class="party-fields">
              @if(!empty($party['address']))
              <tr><td class="pf-lab">Address</td><td class="pf-colon">:</td><td class="pf-val">{{ $party['address'] }}</td></tr>
              @endif
              @if(!empty($party['gstin']))
              <tr><td class="pf-lab">GSTIN</td><td class="pf-colon">:</td><td class="pf-val">{{ $party['gstin'] }}</td></tr>
              @endif
              @if(!empty($party['state']))
              <tr><td class="pf-lab">State</td><td class="pf-colon">:</td><td class="pf-val">{{ $party['state'] }}</td></tr>
              @endif
              @if(!empty($party['mobile']))
              <tr><td class="pf-lab">Mobile</td><td class="pf-colon">:</td><td class="pf-val">{{ $party['mobile'] }}</td></tr>
              @endif
            </table>
          </div>
        </td>
      @endforeach
    </tr>
  </table>

  <!-- 4. Line items -->
  <div class="items-wrap">
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 6%;">SR.<br>NO.</th>
          <th style="width: {{ $data['has_tax'] ? '32%' : '44%' }};">PARTICULARS</th>
          @if($data['show_hsn'])
            <th style="width: 10%;">HSN /<br>SAC</th>
          @endif
          <th style="width: 8%;">QTY</th>
          <th style="width: 8%;">UQC</th>
          <th style="width: 11%;">RATE<br>(₹)</th>
          @if($data['has_tax'])
            <th style="width: 8%;">GST %</th>
            <th style="width: 17%;">TAXABLE VALUE<br>(₹)</th>
          @else
            <th style="width: 17%;">TOTAL AMOUNT<br>(₹)</th>
          @endif
        </tr>
      </thead>
      <tbody>
        @foreach($data['items'] as $index => $item)
          <tr>
            <td style="font-weight: bold;">{{ $item['sr_no'] ?? ($index + 1) }}</td>
            <td class="desc-cell">
              <div>{{ $item['particulars'] }}</div>
              @if(!empty($item['description']))
                <div style="font-size: 8.4px; color: #64748B; font-weight: normal; margin-top: 2px;">{{ $item['description'] }}</div>
              @endif
            </td>
            @if($data['show_hsn'])
              <td>{{ $item['hsn_sac'] ?: '—' }}</td>
            @endif
            <td style="font-weight: bold;">{{ $item['qty'] }}</td>
            <td>{{ $item['uqc'] }}</td>
            <td>{{ number_format($item['rate'], $dp) }}</td>
            @if($data['has_tax'])
              <td>{{ $item['gst_pct'] }}</td>
            @endif
            <td style="font-weight: bold; color: #0F172A;">{{ number_format($item['taxable_value'], $dp) }}</td>
          </tr>
        @endforeach
      </tbody>
    </table>
  </div>

  <!-- 5. Amount in words, bank, terms | summary, signatory -->
  <table class="bottom-table">
    <tr>
      <td class="bottom-left">
        <div class="card">
          <div class="card-hdr"><img src="{{ ($icons['info'] ?: $icons['rupee']) }}" alt=""> AMOUNT IN WORDS</div>
          <div class="card-sep"></div>
          <div class="card-val">{{ $data['amount_in_words'] }}</div>
        </div>

        @if($data['is_delivery_challan'])
          <div class="card">
            <div class="card-hdr">TRANSPORTATION DETAILS</div>
            <div class="card-sep"></div>
            <table class="bank-tbl">
              <tr><td class="bt-lab">Reason</td><td class="bt-colon">:</td><td class="bt-val">{{ $data['challan']['reason'] ?? '—' }}</td></tr>
              <tr><td class="bt-lab">Vehicle No.</td><td class="bt-colon">:</td><td class="bt-val">{{ $data['challan']['vehicle_no'] ?? '—' }}</td></tr>
              <tr><td class="bt-lab">Transporter</td><td class="bt-colon">:</td><td class="bt-val">{{ $data['challan']['transporter_name'] ?? '—' }}</td></tr>
              <tr><td class="bt-lab">E-Way Bill</td><td class="bt-colon">:</td><td class="bt-val">{{ $data['challan']['eway_bill_no'] ?? '—' }}</td></tr>
              <tr><td class="bt-lab">Receiver</td><td class="bt-colon">:</td><td class="bt-val">{{ $data['challan']['receiver_name'] ?? '—' }}</td></tr>
            </table>
          </div>
        @else
          @if(!empty($data['bank']['name']) || !empty($data['bank']['account_no']))
          <div class="card">
            <div class="card-hdr"><img src="{{ $icons['bank'] }}" alt=""> BANK DETAILS (FOR RTGS/NEFT TRANSFERS)</div>
            <div class="card-sep"></div>
            <table class="bank-tbl">
              @if(!empty($data['bank']['name']))
              <tr><td class="bt-lab" style="font-weight: bold; color: #0F172A;">Bank Name</td><td class="bt-colon" style="font-weight: bold;">:</td><td class="bt-val"><strong>{{ $data['bank']['name'] }}</strong></td></tr>
              @endif
              @if(!empty($data['bank']['account_name']))
              <tr><td class="bt-lab">Account Name</td><td class="bt-colon">:</td><td class="bt-val">{{ $data['bank']['account_name'] }}</td></tr>
              @endif
              @if(!empty($data['bank']['account_no']))
              <tr>
                <td class="bt-lab">Account Number</td><td class="bt-colon">:</td>
                <td class="bt-val">{{ $data['bank']['account_no'] }}@if(!empty($data['bank']['ifsc'])) &nbsp;|&nbsp; IFSC Code : {{ $data['bank']['ifsc'] }}@endif</td>
              </tr>
              @endif
              @if(!empty($data['bank']['branch']))
              <tr><td class="bt-lab">Branch</td><td class="bt-colon">:</td><td class="bt-val">{{ $data['bank']['branch'] }}</td></tr>
              @endif
            </table>
          </div>
          @endif

          @if(!empty($data['terms']))
          <div class="card">
            <div class="card-hdr"><img src="{{ $icons['terms'] }}" alt=""> TERMS AND CONDITIONS</div>
            <div class="card-sep"></div>
            <ol class="terms-list">
              @foreach($data['terms'] as $term)
                <li>{{ $term }}</li>
              @endforeach
            </ol>
          </div>
          @endif
        @endif
      </td>

      <td class="bottom-gap"></td>

      <td class="bottom-right">
        <div class="summary-box">
          <table class="sum-tbl">
            <tr>
              <td class="lab">{{ $data['has_tax'] ? 'Total Taxable Value' : 'Total Amount' }}</td>
              <td class="val">₹ {{ $money($data['summary']['taxable_value']) }}</td>
            </tr>
            @if($data['has_tax'])
              @if(!empty($data['summary']['show_split_tax']))
                <tr>
                  <td class="lab">CGST{{ !empty($data['summary']['cgst_rate']) ? ' ('.$data['summary']['cgst_rate'].'%)' : '' }}</td>
                  <td class="val">₹ {{ $money($data['summary']['cgst_amount']) }}</td>
                </tr>
                <tr>
                  <td class="lab">SGST/UTGST{{ !empty($data['summary']['sgst_rate']) ? ' ('.$data['summary']['sgst_rate'].'%)' : '' }}</td>
                  <td class="val">₹ {{ $money($data['summary']['sgst_amount']) }}</td>
                </tr>
              @else
                <tr>
                  <td class="lab">IGST{{ !empty($data['summary']['igst_rate']) ? ' ('.$data['summary']['igst_rate'].'%)' : '' }}</td>
                  <td class="val">₹ {{ $money($data['summary']['igst_amount']) }}</td>
                </tr>
              @endif
            @endif
            <tr>
              <td class="lab">Round Off</td>
              <td class="val">{{ ($data['summary']['round_off'] ?? 0) < 0 ? '- ' : '' }}₹ {{ number_format(abs((float) ($data['summary']['round_off'] ?? 0)), $dp) }}</td>
            </tr>
            <tr class="grand-row">
              <td class="lab">GRAND TOTAL</td>
              <td class="val">₹ {{ $money($data['summary']['grand_total']) }}</td>
            </tr>
          </table>
        </div>

        <div class="sign-wrap">
          <div class="sign-company">For {{ $data['company_name'] }}</div>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="width: 46%; text-align: right; vertical-align: middle; padding: 0 8px 0 0;">
                @if(!empty($data['seal_path']))<img src="{{ $data['seal_path'] }}" alt="Seal" style="max-width: 70px; max-height: 70px;">@endif
              </td>
              <td style="vertical-align: bottom; text-align: right; padding: 0;">
                @if(!empty($data['signature_path']))<img src="{{ $data['signature_path'] }}" alt="Signature" style="max-height: 38px; max-width: 110px;"><br>@endif
                <span class="sig-name">{{ $data['signatory_name'] }}</span><br>
                <span class="sig-role">Authorised Signatory</span>
              </td>
            </tr>
          </table>
        </div>

        @if(!empty($data['reverse_charge']))
          <div class="rcm-box">Tax is payable on reverse charge basis.</div>
        @endif
      </td>
    </tr>
  </table>

  @if(!empty($data['tagline']))
    <div style="margin-top: 8px; background-color: {{ $barBg }}; color: {{ $barFg }}; @if($simple) border: 1.3px solid transparent; @endif font-size: 9.5px; font-weight: bold; letter-spacing: 3px; text-align: center; text-transform: uppercase; padding: 5px 6px; border-radius: 6px;">
      {{ $data['tagline'] }}
    </div>
  @endif

</body>
</html>
