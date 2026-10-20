<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>{{ $data['document_title'] }} - {{ $data['invoice_no'] }}</title>
@php
  /*
   * Layout 2 — classic form with a centred letterhead (Simple / Royal Blue / Deep Teal / Mocha Brown / Dusty Plum).
   * Black grid throughout; the theme colour appears only in the corner ribbons drawn on the page canvas
   * (large ones, "Simple" has none) and as a soft tint behind the document title.
   */
  $simple = ($theme['key'] ?? '') === 'simple';
  $ink = '#111111';
  // very light wash of the theme colour behind the title bar
  $mix = function (string $hex, float $amount) {
      $hex = ltrim($hex, '#');
      [$r, $g, $b] = [hexdec(substr($hex, 0, 2)), hexdec(substr($hex, 2, 2)), hexdec(substr($hex, 4, 2))];
      return sprintf('#%02X%02X%02X', $r + (255 - $r) * $amount, $g + (255 - $g) * $amount, $b + (255 - $b) * $amount);
  };
  $titleBg = '#FFFFFF';
  $fmt = fn ($n) => number_format((float) $n, 2);

  // Blank rows shrink to make room for taller-than-standard content (wrapped addresses/terms/descriptions, a seal and
  // signature), so a short document never pushes its terms/signature block onto a second page.
  $wrap = fn ($text, $perLine) => max(1, (int) ceil(mb_strlen(trim((string) $text)) / $perLine));
  $extraLines = max(0, max($wrap($data['bill_to']['address'] ?? '', 58), $wrap($data['ship_to']['address'] ?? '', 58)) - 1)
      + max(0, $wrap($data['seller_address'] ?? '', 85) - 1)
      + max(0, array_sum(array_map(fn ($t) => $wrap($t, 80), $data['terms'] ?? [])) - 3)
      + ((!empty($data['seal_path']) || !empty($data['signature_path'])) ? 3 : 0)
      + array_sum(array_map(fn ($i) => max(0, $wrap($i['particulars'] ?? '', 36) - 1) + (!empty($i['description']) ? 1 : 0), $data['items']));
  $minRows = 9;
  $fillRows = max(0, $minRows - count($data['items']) - (int) ceil($extraLines * 0.7));
  $cols = 6 + ($data['show_hsn'] ? 1 : 0) + ($data['has_tax'] ? 1 : 0);
  $tds = $data['summary']['tds_tcs_type'] ?? null;

  $nameLen = mb_strlen((string) $data['company_name']);
  $nameSize = $nameLen <= 24 ? '27pt' : ($nameLen <= 32 ? '23pt' : ($nameLen <= 40 ? '19pt' : ($nameLen <= 50 ? '15pt' : '12pt')));
@endphp
<style>
  @page { size: A4 portrait; margin: 7mm 7mm 13mm 7mm; }
  * { box-sizing: border-box; }
  body { font-family: "Times", "DejaVu Serif", serif; font-size: 12.2px; color: {{ $ink }}; margin: 0; padding: 0; line-height: 1.35; }
  table { width: 100%; border-collapse: collapse; }
  td, th { vertical-align: top; }
  .box { border: 1.3px solid {{ $ink }}; }
  .gap { height: 6px; }

  .hdr td { vertical-align: middle; }
  .logo { width: 24%; padding: 8px 0 0 44px; }
  .logo-box { border: 1.3px solid {{ $ink }}; height: 92px; text-align: center; padding: 6px; }
  .logo-box img { max-width: 100px; max-height: 78px; }
  .logo-box .ph { font-size: 11.4px; padding-top: 28px; }
  .co { text-align: center; padding-left: 10px; }
  .co-name { font-size: {{ $nameSize }}; font-weight: bold; text-transform: uppercase; white-space: nowrap; line-height: 1.15; }
  .co-line { font-size: 11.6px; line-height: 1.5; }
  .co-gstin { font-size: 11.2px; font-weight: bold; }

  .doc-title { text-align: center; font-size: 27px; font-weight: bold; padding: 4px 4px 6px; background: #FFFFFF; text-transform: uppercase; letter-spacing: 0.3px; }
  .m1 td { border: 1.2px solid {{ $ink }}; padding: 6px 8px; font-size: 13px; }
  .m1 td.k { font-weight: bold; text-transform: uppercase; width: 24%; }
  .m1 td.v { font-weight: bold; text-align: center; }
  .m2 td { border: 1.2px solid {{ $ink }}; padding: 4px 6px; font-size: 11.4px; }
  .m2 td.k { font-weight: bold; white-space: nowrap; }
  .m2 td.v { font-weight: bold; }

  .party td { padding: 0; }
  .party .l { border-right: 1.2px solid {{ $ink }}; width: 50%; }
  .party .h { border-bottom: 1.2px solid {{ $ink }}; font-weight: bold; font-size: 12.2px; padding: 6px 8px; text-transform: uppercase; }
  .party .b { padding: 6px 8px 8px; }
  .party-name { font-weight: bold; font-size: 13.6px; text-transform: uppercase; margin-bottom: 3px; }
  .kv td { padding: 1.5px 0; font-size: 11.6px; }
  .kv td.k { width: 54px; }
  .kv td.c { width: 10px; }

  .items th { border: 1.2px solid {{ $ink }}; font-weight: bold; font-size: 11.6px; padding: 6px 3px; text-align: center; }
  .items td { border: 1.2px solid {{ $ink }}; font-size: 12px; padding: 4px 4px; text-align: center; height: 20px; }
  .items td.p { text-align: left; font-weight: bold; }
  .items td.r { text-align: right; }
  .items tr { page-break-inside: avoid; }

  .bank-h { font-weight: bold; font-size: 12.2px; padding: 6px 8px; border-bottom: 1.2px solid {{ $ink }}; text-transform: uppercase; }
  .bank { padding: 6px 8px; }
  .bank td { padding: 2px 0; font-size: 11.6px; }
  .bank td.k { width: 82px; }
  .sum td { border-bottom: 1.2px solid {{ $ink }}; padding: 3px 7px; font-size: 11.6px; }
  .sum tr:last-child td { border-bottom: 0; }
  .sum td.l { border-right: 1.2px solid {{ $ink }}; width: 56%; }
  .sum td.v { text-align: center; }
  .sum .b { font-weight: bold; text-transform: uppercase; }
  .sum .gt td { font-size: 15px; font-weight: bold; padding: 6px 7px; }

  .words td { padding: 6px 8px; font-size: 12.2px; }
  .words td.k { font-weight: bold; text-transform: uppercase; width: 26%; border-right: 1.2px solid {{ $ink }}; }
  .words td.v { font-weight: bold; }
  .foot td { padding: 6px 8px; }
  .foot .t { font-weight: bold; text-transform: uppercase; font-size: 12.2px; }
  .terms-list { margin: 3px 0 0; padding-left: 15px; font-size: 11.6px; }
  .terms-list li { margin-bottom: 3px; }
  .sign { text-align: right; }
  .sign-for { font-weight: bold; font-size: 12.2px; line-height: 1.3; }
  .sign-img { max-height: 44px; max-width: 120px; display: block; }
  .seal-img { max-height: 58px; max-width: 58px; display: block; }
</style>
</head>
<body>

  <table class="hdr">
    <tr>
      <td class="logo">
        <div class="logo-box">
          @if(!empty($data['logo_path']))
            <img src="{{ $data['logo_path'] }}" alt="Logo">
          @else
            <div class="ph"><b>COMPANY LOGO</b></div>
          @endif
        </div>
      </td>
      <td class="co">
        <div class="co-name">{{ $data['company_name'] }}</div>
        @if(!empty($data['seller_address']))<div class="co-line" style="text-transform: uppercase;">{{ $data['seller_address'] }}</div>@endif
        <div class="co-line">
          @if(!empty($data['seller_email']))E-Mail ID: {{ $data['seller_email'] }}@endif
          @if(!empty($data['seller_email']) && !empty($data['seller_phone'])), @endif
          @if(!empty($data['seller_phone']))Mobile: {{ $data['seller_phone'] }}@endif
        </div>
        @if(!empty($data['seller_gstin']))<div class="co-gstin">GSTIN {{ $data['seller_gstin'] }}@if(!empty($data['seller_pan'])) &nbsp;|&nbsp; PAN {{ $data['seller_pan'] }}@endif</div>@endif
      </td>
    </tr>
  </table>

  <div class="gap"></div>
  <table class="box"><tr><td class="doc-title">{{ $data['document_title'] }}</td></tr></table>

  <div class="gap"></div>
  <table class="m1">
    <tr>
      <td class="k">{{ $data['doc_number_label'] }}</td>
      <td class="v">{{ $data['invoice_no'] }}</td>
      <td class="k">{{ $data['doc_date_label'] }}</td>
      <td class="v" style="width: 22%;">{{ $data['invoice_date'] }}</td>
    </tr>
  </table>
  <div style="height: 4px;"></div>
  <table class="m2">
    <tr>
      <td class="k">Place of Supply</td>
      <td class="v">{{ $data['place_of_supply'] }}</td>
      <td class="k">PO No.</td>
      <td class="v">{{ $data['po_number'] ?? '—' }}</td>
      <td class="k">Against</td>
      <td class="v">{{ !empty($data['against_number']) ? $data['against_number'] : '—' }}</td>
      <td class="k">Reverse Charge</td>
      <td class="v" style="text-align: center;">{{ $data['reverse_charge'] ? 'Yes' : 'No' }}</td>
    </tr>
  </table>

  <div class="gap"></div>
  <table class="box party">
    <tr>
      <td class="l h">DETAILS OF RECEIVER | BILL TO</td>
      <td class="h">DETAILS OF CONSIGNEE | SHIP TO</td>
    </tr>
    <tr>
      @foreach([$data['bill_to'], $data['ship_to']] as $i => $party)
        <td class="{{ $i === 0 ? 'l' : '' }} b">
          <div class="party-name">{{ $party['name'] ?? '—' }}</div>
          <table class="kv">
            <tr><td class="k">GSTIN</td><td class="c">:</td><td>{{ $party['gstin'] ?? '' }}</td></tr>
            <tr><td class="k">State</td><td class="c">:</td><td>{{ $party['state'] ?? '' }}</td></tr>
            <tr><td class="k">Address</td><td class="c">:</td><td>{{ $party['address'] ?? '' }}</td></tr>
            <tr><td class="k">Email ID</td><td class="c">:</td><td>{{ $party['email'] ?? '' }}</td></tr>
            <tr><td class="k">Mobile</td><td class="c">:</td><td>{{ $party['mobile'] ?? '' }}</td></tr>
          </table>
        </td>
      @endforeach
    </tr>
  </table>

  <div class="gap"></div>
  <table class="items">
    <thead>
      <tr>
        <th style="width: 8%;">Sr. No.</th>
        <th>PARTICULARS</th>
        @if($data['show_hsn'])<th style="width: 11%;">HSN/SAC</th>@endif
        <th style="width: 7%;">QTY</th>
        <th style="width: 7%;">UQC</th>
        <th style="width: 11%;">RATE</th>
        @if($data['has_tax'])<th style="width: 8%;">GST (%)</th>@endif
        <th style="width: 15%;">{{ $data['has_tax'] ? 'TAXABLE VALUE' : 'AMOUNT' }}</th>
      </tr>
    </thead>
    <tbody>
      @foreach($data['items'] as $index => $item)
        <tr>
          <td>{{ $item['sr_no'] ?? ($index + 1) }}</td>
          <td class="p">
            {{ $item['particulars'] }}
            @if(!empty($item['description']))<div style="font-weight: normal; font-size: 7.8px;">{{ $item['description'] }}</div>@endif
          </td>
          @if($data['show_hsn'])<td>{{ $item['hsn_sac'] ?: '—' }}</td>@endif
          <td>{{ $item['qty'] }}</td>
          <td>{{ $item['uqc'] }}</td>
          <td class="r">{{ $fmt($item['rate']) }}</td>
          @if($data['has_tax'])<td>{{ $item['gst_pct'] }}</td>@endif
          <td class="r" style="font-weight: bold;">{{ $fmt($item['taxable_value']) }}</td>
        </tr>
      @endforeach
      @for($f = 0; $f < $fillRows; $f++)
        <tr>@for($c = 0; $c < $cols; $c++)<td>&nbsp;</td>@endfor</tr>
      @endfor
    </tbody>
  </table>

  <div class="gap"></div>
  <table>
    <tr>
      <td style="width: 60%; padding-right: 6px;">
        <div class="box">
          <div class="bank-h">BANK DETAILS (FOR RTGS/NEFT TRANSFERS)</div>
          <div class="bank">
            <table>
              <tr><td class="k">Bank Name</td><td>: {{ $data['bank']['name'] ?? '' }}</td></tr>
              <tr><td class="k">Account Name</td><td>: {{ $data['bank']['account_name'] ?? '' }}</td></tr>
              <tr><td class="k">Account Number</td><td>: {{ $data['bank']['account_no'] ?? '' }}</td></tr>
              <tr><td class="k">Branch</td><td>: {{ $data['bank']['branch'] ?? '' }}</td></tr>
              <tr><td class="k">IFSC CODE</td><td>: {{ $data['bank']['ifsc'] ?? '' }}</td></tr>
            </table>
          </div>
        </div>
      </td>
      <td>
        <table class="box sum">
          <tr><td class="l b">{{ $data['has_tax'] ? 'TOTAL TAXABLE VALUE' : 'TOTAL AMOUNT' }}</td><td class="v">{{ $fmt($data['summary']['taxable_value']) }}</td></tr>
          @if($data['has_tax'])
            @if(!empty($data['summary']['show_split_tax']))
              <tr><td class="l">CGST{{ !empty($data['summary']['cgst_rate']) ? ' ('.$data['summary']['cgst_rate'].'%)' : '' }}</td><td class="v">{{ $fmt($data['summary']['cgst_amount']) }}</td></tr>
              <tr><td class="l">SGST/UTGST{{ !empty($data['summary']['sgst_rate']) ? ' ('.$data['summary']['sgst_rate'].'%)' : '' }}</td><td class="v">{{ $fmt($data['summary']['sgst_amount']) }}</td></tr>
            @else
              <tr><td class="l">IGST{{ !empty($data['summary']['igst_rate']) ? ' ('.$data['summary']['igst_rate'].'%)' : '' }}</td><td class="v">{{ $fmt($data['summary']['igst_amount']) }}</td></tr>
            @endif
          @endif
          @if($tds)
            <tr><td class="l">{{ $tds === 'tds' ? 'LESS: TDS' : 'ADD: TCS' }}{{ !empty($data['summary']['tds_tcs_section']) ? ' ('.$data['summary']['tds_tcs_section'].')' : '' }}</td><td class="v">{{ $fmt($data['summary']['tds_tcs_amount']) }}</td></tr>
          @endif
          <tr><td class="l">Rounded off</td><td class="v">{{ ($data['summary']['round_off'] ?? 0) < 0 ? '-' : '' }}{{ $fmt(abs((float) ($data['summary']['round_off'] ?? 0))) }}</td></tr>
          <tr class="gt"><td class="l">Grand Total</td><td class="v">{{ $fmt($data['summary']['grand_total']) }}</td></tr>
        </table>
      </td>
    </tr>
  </table>

  @if($data['is_delivery_challan'])
    <div class="gap"></div>
    <table class="box words">
      <tr>
        <td class="k">TRANSPORTATION DETAILS</td>
        <td>
          Reason: {{ $data['challan']['reason'] ?? '—' }} &nbsp;|&nbsp; Vehicle No.: {{ $data['challan']['vehicle_no'] ?? '—' }}
          &nbsp;|&nbsp; Transporter: {{ $data['challan']['transporter_name'] ?? '—' }} &nbsp;|&nbsp; E-Way Bill: {{ $data['challan']['eway_bill_no'] ?? '—' }}
          &nbsp;|&nbsp; Receiver: {{ $data['challan']['receiver_name'] ?? '—' }}
        </td>
      </tr>
    </table>
  @endif

  <div class="gap"></div>
  <table class="box words">
    <tr>
      <td class="k">AMOUNT IN WORDS</td>
      <td class="v">{{ $data['amount_in_words'] }}</td>
    </tr>
  </table>

  <div class="gap"></div>
  <table class="box foot">
    <tr>
      <td style="width: 58%;">
        <div class="t">TERMS &amp; CONDITIONS</div>
        <ol class="terms-list">
          @foreach($data['terms'] as $term)<li>{{ $term }}</li>@endforeach
        </ol>
      </td>
      <td class="sign">
        <div class="sign-for">For {{ $data['company_name_title_case'] }}</div>
        {{-- seal and signature sit in their own fixed-height row, clear of the company line above --}}
        <table style="width: auto; margin: 8px 0 4px auto; height: 64px;">
          <tr>
            @if(!empty($data['seal_path']))<td style="vertical-align: middle; padding-right: 10px;"><img class="seal-img" src="{{ $data['seal_path'] }}" alt="Seal"></td>@endif
            @if(!empty($data['signature_path']))<td style="vertical-align: middle;"><img class="sign-img" src="{{ $data['signature_path'] }}" alt="Signature"></td>@endif
          </tr>
        </table>
        <div style="font-size: 8.8px;">Authorised Signatory</div>
      </td>
    </tr>
  </table>

  @if(!empty($data['reverse_charge']))
    <div style="margin-top: 6px; font-size: 8.4px; font-weight: bold; text-align: center;">Tax is payable on reverse charge basis.</div>
  @endif

</body>
</html>
