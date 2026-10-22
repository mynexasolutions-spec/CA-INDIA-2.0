<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>{{ $data['document_title'] }} - {{ $data['invoice_no'] }}</title>
@php
  /*
   * Layout 2 — classic form with a centred letterhead (Simple / Royal Blue / Deep Teal / Mocha Brown / Dusty Plum).
   * Black grid throughout. The theme colour shows in the filled title bar and in the ribbon bands drawn across the top
   * and bottom of every page on the canvas ("Simple" has neither: a plain boxed title and no ribbons).
   */
  $simple = ($theme['key'] ?? '') === 'simple';
  $ink = '#111111';
  $titleColor = $simple ? $ink : ($theme['l1_title'] ?? $theme['primary']);
  $dp = (int) ($data['decimals'] ?? 2);
  $fmt = fn ($n) => number_format((float) $n, $dp);

  $tds = $data['summary']['tds_tcs_type'] ?? null;

  // The company name is set as large as fits on one line beside the logo box (about 420pt wide).
  $nameLen = max(1, mb_strlen((string) $data['company_name']));
  $nameSize = max(11, min(27, (int) floor(420 / $nameLen / 0.7))) . 'pt';

  // Tax / TDS / round-off rows and the PO No. / Against boxes appear only when they have a value to show.
  $sm = $data['summary'];
  $interState = $data['has_tax'] && empty($sm['show_split_tax']);
  $rate = fn ($r) => ($r !== null && $r !== '' && (float) $r > 0) ? ' (' . rtrim(rtrim(number_format((float) $r, 2), '0'), '.') . '%)' : '';
  $igstRate = !empty($sm['igst_rate']) ? $sm['igst_rate'] : (!empty($sm['cgst_rate']) ? (float) $sm['cgst_rate'] * 2 : null);
  $halfRate = !empty($sm['cgst_rate']) ? $sm['cgst_rate'] : (!empty($sm['igst_rate']) ? (float) $sm['igst_rate'] / 2 : null);
  $roundOff = (float) ($sm['round_off'] ?? 0);
  // layout preview: list every component, not only the ones that apply
  $sampleAll = !empty($data['sample_all']);
  $na = '(If Applicable)';

  // The supply / PO / against / reverse-charge strip: [label, value, label width %, value width %]. PO No. and Against
  // are left out when empty and the widths of the rest are scaled back up to fill the line.
  $m2 = [['Place of Supply', $data['place_of_supply'], 11.2, 15.2]];
  if (!empty($data['po_number'])) { $m2[] = ['PO No.', $data['po_number'], 8.1, 17.2]; }
  if (!empty($data['against_number'])) { $m2[] = ['Against', $data['against_number'], 7.8, 20.8]; }
  $m2[] = ['Reverse Charge', $data['reverse_charge'] ? 'Yes' : 'No', 12.5, 7.2];
  $m2Scale = 100 / array_sum(array_map(fn ($c) => $c[2] + $c[3], $m2));
@endphp
<style>
  /* Top 15mm / bottom 14.2mm leave room for the ribbon bands on every page; sides are 5mm. */
  @page { size: A4 portrait; margin: 15mm 5mm 14.2mm 5mm; }
  * { box-sizing: border-box; }
  /* The 2px side padding keeps the outer table borders inside the printable area; with a bare 100% width dompdf clips the
     left border (it is drawn half outside the box) and the boxes lose their left edge. */
  body { font-family: "Times", "DejaVu Serif", serif; font-size: 12.4px; color: {{ $ink }}; margin: 0; padding: 0 2px; line-height: 1.3; }
  table { width: 100%; border-collapse: collapse; }
  td, th { vertical-align: top; }
  .box { border: 1.3px solid {{ $ink }}; }
  .gap { height: 4px; }
  .gap-s { height: 6px; }
  .gap-m { height: 8px; }
  .gap-l { height: 13px; }
  .gap-t { height: 7px; }

  /* letterhead */
  .hdr td { vertical-align: middle; }
  .logo { width: 185px; padding: 0 20px 0 0; }
  /* the logo sits in the middle and centre of its box and is scaled down to fit entirely inside it */
  .logo-box { width: 100%; border: 1.3px solid {{ $ink }}; }
  .logo-box td { height: 104px; padding: 3px; text-align: center; vertical-align: middle; }
  .logo-box img { max-width: 156px; max-height: 96px; }
  .logo-box .ph { font-size: 11.6px; line-height: 1.45; }
  .co { text-align: center; }
  .co-name { font-size: {{ $nameSize }}; font-weight: bold; text-transform: uppercase; white-space: nowrap; line-height: 1.15; }
  .co-line { font-size: 11.8px; line-height: 1.5; }
  .co-gstin { font-size: 11.8px; font-weight: bold; }

  /* title: a filled bar in the theme colour, or a plain box for "Simple" */
  .title-bar { text-align: center; font-size: 20px; font-weight: bold; letter-spacing: 0.4px; text-transform: uppercase; height: 26px; padding-top: 3px; background: {{ $titleColor }}; color: #FFFFFF; }
  .title-box { border: 1.3px solid {{ $ink }}; text-align: center; font-size: 23px; font-weight: bold; text-transform: uppercase; height: 32px; padding-top: 4px; }

  .m1 td { border: 1.3px solid {{ $ink }}; padding: 4px 8px 3px; font-size: 11.8px; height: 22px; vertical-align: middle; }
  .m1 td.k { font-weight: bold; text-transform: uppercase; }
  .m1 td.v { font-weight: bold; text-align: center; }
  .m2 td { border: 1.3px solid {{ $ink }}; padding: 3px 5px; font-size: 10.3px; font-weight: bold; height: 20px; vertical-align: middle; }
  .m2 td.k { white-space: nowrap; }
  .m2 td.v { text-align: center; }

  /* receiver / consignee */
  .party td { padding: 0; }
  .party .l { border-right: 1.3px solid {{ $ink }}; width: 50%; }
  .party .h { border-bottom: 1.3px solid {{ $ink }}; font-weight: bold; font-size: 12.6px; padding: 7px 9px 6px; text-transform: uppercase; }
  .party .b { padding: 8px 12px 8px 11px; }
  .party-name { font-weight: bold; font-size: 13.6px; text-transform: uppercase; margin-bottom: 2px; }
  .kv td { padding: 1.5px 0; font-size: 12.4px; }
  .kv td.k { width: 56px; }
  .kv td.c { width: 12px; }

  /* items */
  .items th { border: 1.3px solid {{ $ink }}; font-weight: bold; font-size: 11.6px; padding: 5px 3px 4px; text-align: center; height: 18px; vertical-align: middle; }
  .items td { border: 1.3px solid {{ $ink }}; font-size: 12px; padding: 4px 4px; text-align: center; height: 21px; vertical-align: middle; }
  .items td.p { text-align: left; font-weight: bold; }
  .items td.r { text-align: center; }
  .items tr { page-break-inside: avoid; }

  /* bank details and totals sit in one row of the outer table, so the two boxes are always the same height */
  .bot > tbody > tr > td { vertical-align: top; }
  .bot td.left { width: 57.2%; border: 1.3px solid {{ $ink }}; padding: 0; }
  .bot td.gapc { width: 1%; padding: 0; }
  /* the totals sit at the bottom of their box, however many rows there are */
  .bot td.right { border: 1.3px solid {{ $ink }}; padding: 0; vertical-align: bottom; }
  .bank-h { font-weight: bold; font-size: 12.4px; padding: 7px 9px 6px; border-bottom: 1.3px solid {{ $ink }}; text-transform: uppercase; }
  .bank { padding: 5px 11px 6px; }
  .bank td { padding: 2px 0; font-size: 12.4px; }
  .bank td.k { width: 116px; }
  .sum tr:first-child td { border-top: 1.3px solid {{ $ink }}; }
  .sum td { padding: 3px 9px; font-size: 12.2px; line-height: 1.25; }
  .sum td.l { border-right: 1.3px solid {{ $ink }}; width: 59.2%; }
  .sum td.v { text-align: center; }
  .sum .b { font-weight: bold; text-transform: uppercase; font-size: 11.2px; }
  .sum tr.gt td { border-top: 1.3px solid {{ $ink }}; font-size: 15px; font-weight: bold; padding: 4px 9px 5px; }

  .words td { padding: 4px 9px 3px; font-size: 12.4px; }
  .words td.k { font-weight: bold; text-transform: uppercase; width: 25.9%; border-right: 1.3px solid {{ $ink }}; }
  .words td.v { font-weight: bold; }
  .foot td { padding: 5px 9px 5px; }
  .foot .t { font-weight: bold; text-transform: uppercase; font-size: 12.4px; }
  .terms-list { margin: 4px 0 0; padding-left: 18px; font-size: 11.4px; line-height: 1.5; }
  .terms-list li { margin-bottom: 3px; }
  .sign { text-align: right; }
  .sign-for { font-weight: bold; font-size: 12.4px; line-height: 1.3; }
  .sign-img { max-height: 44px; max-width: 120px; display: block; }
  .seal-img { max-height: 58px; max-width: 58px; display: block; }
</style>
</head>
<body>

  <table class="hdr">
    <tr>
      <td class="logo">
        <table class="logo-box">
          <tr>
            <td>
              @if(!empty($data['logo_path']))
                <img src="{{ $data['logo_path'] }}" alt="Logo">
              @else
                <div class="ph"><b>COMPANY LOGO</b><br>(Should Fit in Entire Box)<br>(Middle and Centre Alignment)</div>
              @endif
            </td>
          </tr>
        </table>
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

  <div class="gap-l"></div>
  @if($simple)
    <div class="title-box">{{ $data['document_title'] }}</div>
  @else
    <div class="title-bar">{{ $data['document_title'] }}</div>
  @endif

  <div class="gap-t"></div>
  <table class="m1">
    <tr>
      <td class="k" style="width: 19%;">{{ $data['doc_number_label'] }}</td>
      <td class="v" style="width: 38.6%;">{{ $data['invoice_no'] }}</td>
      <td class="k" style="width: 22.8%;">{{ $data['doc_date_label'] }}</td>
      <td class="v" style="width: 19.6%;">{{ $data['invoice_date'] }}</td>
    </tr>
  </table>
  <div class="gap"></div>
  <table class="m2">
    <tr>
      @foreach($m2 as $c)
        <td class="k" style="width: {{ round($c[2] * $m2Scale, 2) }}%;">{{ $c[0] }}</td>
        <td class="v" style="width: {{ round($c[3] * $m2Scale, 2) }}%;">{{ $c[1] }}</td>
      @endforeach
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

  <div class="gap-s"></div>
  <table class="items">
    <thead>
      <tr>
        <th style="width: 7.8%;">Sr. No.</th>
        <th style="width: 24.7%;">PARTICULARS</th>
        @if($data['show_hsn'])<th style="width: 10.7%;">HSN/SAC</th>@endif
        <th style="width: 10%;">QTY</th>
        <th style="width: 8.9%;">UQC</th>
        <th style="width: 11.7%;">RATE</th>
        @if($data['has_tax'])<th style="width: 9%;">GST (%)</th>@endif
        <th style="width: 17%;">{{ $data['has_tax'] ? 'TAXABLE VALUE' : 'AMOUNT' }}</th>
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
    </tbody>
  </table>

  <div class="gap-m"></div>
  <table class="bot">
    <tr>
      <td class="left">
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
      </td>
      <td class="gapc"></td>
      <td class="right">
        <table class="sum">
          <tr><td class="l b">{{ $data['has_tax'] ? 'TOTAL TAXABLE VALUE' : 'TOTAL AMOUNT' }}</td><td class="v">{{ $fmt($sm['taxable_value']) }}</td></tr>
          @if($data['has_tax'])
            @if($sampleAll || ($interState && (float) $sm['igst_amount'] != 0))<tr><td class="l">IGST{{ $rate($igstRate) }}</td><td class="v">{{ ($interState && (float) $sm['igst_amount'] != 0) ? $fmt($sm['igst_amount']) : $na }}</td></tr>@endif
            @if($sampleAll || (!$interState && (float) $sm['cgst_amount'] != 0))<tr><td class="l">CGST{{ $rate($halfRate) }}</td><td class="v">{{ (!$interState && (float) $sm['cgst_amount'] != 0) ? $fmt($sm['cgst_amount']) : $na }}</td></tr>@endif
            @if($sampleAll || (!$interState && (float) $sm['sgst_amount'] != 0))<tr><td class="l">SGST{{ $rate($halfRate) }}</td><td class="v">{{ (!$interState && (float) $sm['sgst_amount'] != 0) ? $fmt($sm['sgst_amount']) : $na }}</td></tr>@endif
          @endif
          @if($tds)
            <tr><td class="l">{{ $tds === 'tds' ? 'LESS: TDS' : 'ADD: TCS' }}{{ !empty($sm['tds_tcs_section']) ? ' ('.$sm['tds_tcs_section'].')' : '' }}</td><td class="v">{{ $fmt($sm['tds_tcs_amount']) }}</td></tr>
          @elseif($sampleAll && $data['has_tax'])
            <tr><td class="l">CESS/TDS/TCS</td><td class="v">{{ $na }}</td></tr>
          @endif
          @if($roundOff != 0)<tr><td class="l">Rounded off</td><td class="v">{{ ($roundOff < 0 ? '-' : '') . $fmt(abs($roundOff)) }}</td></tr>@elseif($sampleAll)<tr><td class="l">Rounded off</td><td class="v">{{ $na }}</td></tr>@endif
          <tr class="gt"><td class="l">Grand Total</td><td class="v">{{ $fmt($sm['grand_total']) }}</td></tr>
        </table>
      </td>
    </tr>
  </table>

  @if($data['is_delivery_challan'])
    <table class="box words" style="margin-top: -1.3px;">
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

  {{-- directly under the bank / totals boxes: they share this row's top border --}}
  <table class="box words" style="margin-top: -1.3px;">
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
        <table style="width: auto; margin: 3px 0 1px auto; height: 34px;">
          <tr>
            @if(!empty($data['seal_path']))<td style="vertical-align: middle; padding-right: 10px;"><img class="seal-img" src="{{ $data['seal_path'] }}" alt="Seal"></td>@endif
            @if(!empty($data['signature_path']))<td style="vertical-align: middle;"><img class="sign-img" src="{{ $data['signature_path'] }}" alt="Signature"></td>@endif
          </tr>
        </table>
        <div style="font-size: 12.4px;">Authorised Signatory</div>
      </td>
    </tr>
  </table>

  @if(!empty($data['reverse_charge']))
    <div style="margin-top: 6px; font-size: 8.4px; font-weight: bold; text-align: center;">Tax is payable on reverse charge basis.</div>
  @endif

</body>
</html>
