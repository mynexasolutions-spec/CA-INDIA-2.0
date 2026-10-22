<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>{{ $data['document_title'] }} - {{ $data['invoice_no'] }}</title>
@php
  /*
   * Layout 1 — classic boxed form (Simple / Royal Blue / Deep Teal / Mocha Brown / Dusty Plum).
   * One continuous black grid from the title to the signature box; the theme colour shows only in the document title
   * and in the corner ribbons the renderer draws on the page canvas ("Simple" has neither), with a thin frame round the
   * page edge.
   */
  $simple = ($theme['key'] ?? '') === 'simple';
  $accent = $simple ? '#111111' : ($theme['l1_title'] ?? $theme['primary']);
  $ink = '#111111';
  $dp = (int) ($data['decimals'] ?? 2);
  $fmt = fn ($n) => number_format((float) $n, $dp);

  $tds = $data['summary']['tds_tcs_type'] ?? null;

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
  $hasPo = !empty($data['po_number']);
  $hasAgainst = !empty($data['against_number']);
@endphp
<style>
  /* First page: 6mm top. Later pages start lower, clear of the corner ribbon drawn at the top-left. Sides 5mm. */
  @page { size: A4 portrait; margin: 18mm 5mm 13.4mm 5mm; }
  @page :first { margin: 6mm 5mm 13.4mm 5mm; }
  * { box-sizing: border-box; }
  /* The 2px side padding keeps the outer table borders inside the printable area; with a bare 100% width dompdf
     clips the left border (it is drawn half outside the box) and the form loses its left edge. */
  body { font-family: "Times", "DejaVu Serif", serif; font-size: 12px; color: {{ $ink }}; margin: 0; padding: 0 2px; line-height: 1.35; }
  table { width: 100%; border-collapse: collapse; }
  td, th { vertical-align: top; }
  .blk { border: 1.4px solid {{ $ink }}; }
  .nt { border-top: 0; }
  .title { text-align: center; font-size: 17px; font-weight: bold; color: {{ $accent }}; padding: 4px 4px 4px; letter-spacing: 0.4px; }

  /* header: logo | seller | document details (number/date, place/reverse charge, PO/against) */
  .logo-cell { width: 13%; text-align: center; vertical-align: middle; border-right: 1px solid {{ $ink }}; padding: 6px; }
  .logo-cell img { max-width: 84px; max-height: 84px; }
  .seller-cell { width: 41.5%; border-right: 1px solid {{ $ink }}; padding: 6px 8px; line-height: 1.45; font-size: 11.8px; }
  .seller-name { font-size: 13.4px; font-weight: bold; text-transform: uppercase; }
  .seller-line { font-weight: bold; font-size: 11.8px; }
  .meta-cell { padding: 0; }
  .meta-tbl td { padding: 4px 8px; border-bottom: 1px solid {{ $ink }}; font-size: 12.6px; height: 38px; }
  .meta-tbl tr:last-child td { border-bottom: 0; }
  .meta-tbl td.l { border-right: 1px solid {{ $ink }}; width: 48.4%; }
  .meta-k { color: {{ $ink }}; }
  .meta-v { margin-top: 1px; }
  /* with no PO No. / Against row the two remaining rows share the header's height */
  .meta-tall td { height: 61px; }

  /* receiver / consignee */
  .party-hdr td { font-weight: bold; font-size: 12.4px; padding: 4px 8px 3px; text-transform: uppercase; }
  .party-hdr td.l, .party td.l { border-right: 1px solid {{ $ink }}; width: 50%; }
  .party td { padding: 3px 8px 4px; font-size: 12.4px; }
  .party-name { font-weight: bold; font-size: 13.4px; text-transform: uppercase; margin-bottom: 1px; }
  .kv td { padding: 1px 0; font-size: 12.4px; }
  .kv td.k { width: 58px; }

  /* items */
  .items th { border-bottom: 1px solid {{ $ink }}; border-right: 1px solid {{ $ink }}; font-weight: bold; font-size: 12.2px; padding: 4px 3px 3px; text-align: center; }
  .items th:last-child { border-right: 0; }
  .items td { border-bottom: 1px solid {{ $ink }}; border-right: 1px solid {{ $ink }}; font-size: 12px; padding: 2px 4px; text-align: center; height: 20px; vertical-align: middle; }
  .items td:last-child { border-right: 0; }
  .items td.p { text-align: left; font-weight: bold; }
  .items td.r { text-align: center; }
  .items tr { page-break-inside: avoid; }

  /* amount in words + bank details (left) and the totals (right) share one row, so their boxes are one height */
  .bot td.left { width: 60%; padding: 0; border-right: 1px solid {{ $ink }}; }
  /* the totals sit at the bottom of their box (Grand Total level with the bank details), however many rows there are */
  .bot td.right { padding: 0; vertical-align: bottom; }
  .sec { padding: 5px 9px 6px; }
  .sec-h { font-weight: bold; font-size: 12.2px; text-transform: uppercase; }
  .sec + .sec { border-top: 1px solid {{ $ink }}; }
  /* dompdf adds the padding on top of a cell's height: these give 52.8pt (amount in words) and 81pt (bank details) */
  .sec-words { height: 60px; }
  .sec-bank { height: 97px; }
  .bank td { padding: 1px 0; font-size: 12px; }
  .bank td.k { width: 92px; }
  /* the top line closes the totals and carries the words/bank divider across to the right edge */
  .sum tr:first-child td { border-top: 1px solid {{ $ink }}; }
  .sum td { border-bottom: 1px solid {{ $ink }}; padding: 3.5px 8px; font-size: 12.4px; line-height: 1.3; }
  .sum tr:last-child td { border-bottom: 0; }
  /* 56.2% of the totals box makes the value column as wide as the items table's last column (17.5% of the page), so the
     divider here lines up with that column's left border. */
  .sum td.l { border-right: 1px solid {{ $ink }}; width: 56.2%; }
  .sum td.v { text-align: center; }
  .sum .b { font-weight: bold; text-transform: uppercase; font-size: 11.4px; white-space: nowrap; }
  /* fixed height: rows above it are 24px each, so the words/bank divider (3 rows down) meets a row line whatever the row count */
  .sum .gt td { font-size: 14.4px; font-weight: bold; padding: 5px 9px; height: 26px; vertical-align: middle; }

  /* terms | signature */
  /* only the two cells of the box itself: a bare ".foot td" also hit the cells of the seal / signature table inside it */
  .foot td.terms, .foot td.sign { height: 112px; }   /* + padding = 93.7pt, the height of the terms / signature box */
  .foot td.terms { width: 49.9%; border-right: 1px solid {{ $ink }}; padding: 5px 9px 8px; }
  .terms-list { margin: 3px 0 0; padding-left: 17px; font-size: 11.8px; line-height: 1.4; }
  .terms-list li { margin-bottom: 3px; }
  .sign { padding: 5px 9px; text-align: right; }
  .sign-for { font-weight: bold; font-size: 12.4px; line-height: 1.3; }
  .sign-img { max-height: 44px; max-width: 120px; display: block; }
  .seal-img { max-height: 58px; max-width: 58px; display: block; }
  .sign-role { font-size: 12.4px; margin-top: 2px; }
</style>
</head>
<body>

  <table class="blk">
    <tr><td class="title">{{ $data['document_title'] }}</td></tr>
  </table>

  <table class="blk nt">
    <tr>
      <td class="logo-cell">
        @if(!empty($data['logo_path']))
          <img src="{{ $data['logo_path'] }}" alt="Logo">
        @else
          LOGO (Should Fit in Entire BOX)
        @endif
      </td>
      <td class="seller-cell">
        <div class="seller-name">{{ $data['company_name'] }}</div>
        @if(!empty($data['seller_gstin']) || !empty($data['seller_pan']))
          <div class="seller-line">@if(!empty($data['seller_gstin']))GSTIN: {{ $data['seller_gstin'] }}@endif @if(!empty($data['seller_pan']))&nbsp;&nbsp; PAN: {{ $data['seller_pan'] }}@endif</div>
        @endif
        @if(!empty($data['seller_state']))<div class="seller-line">STATE: {{ $data['seller_state'] }}</div>@endif
        @if(!empty($data['seller_address']))<div>Address: {{ $data['seller_address'] }}</div>@endif
        @if(!empty($data['seller_email']))<div>E-Mail ID: {{ $data['seller_email'] }}</div>@endif
        @if(!empty($data['seller_phone']))<div>Mobile: {{ $data['seller_phone'] }}</div>@endif
      </td>
      <td class="meta-cell">
        <table class="meta-tbl{{ ($hasPo || $hasAgainst) ? '' : ' meta-tall' }}{{ ($hasPo xor $hasAgainst) ? ' no-div' : '' }}">
          <tr>
            <td class="l"><div class="meta-k">{{ $data['doc_number_label'] }}</div><div class="meta-v">{{ $data['invoice_no'] }}</div></td>
            <td><div class="meta-k">{{ $data['doc_date_label'] }}</div><div class="meta-v">{{ $data['invoice_date'] }}</div></td>
          </tr>
          <tr>
            <td class="l"><div class="meta-k">Place of Supply</div><div class="meta-v">{{ $data['place_of_supply'] }}</div></td>
            <td><div class="meta-k">Reverse Charge:</div><div class="meta-v">{{ $data['reverse_charge'] ? 'Yes' : 'No' }}</div></td>
          </tr>
          {{-- PO No. / Against: only the ones that are filled; with neither, the row is left out. --}}
          @if($hasPo || $hasAgainst)
            <tr>
              @if($hasPo)
                <td class="{{ $hasAgainst ? 'l' : '' }}" colspan="{{ $hasAgainst ? 1 : 2 }}"><div class="meta-k">PO No.</div><div class="meta-v">{{ $data['po_number'] }}</div></td>
              @endif
              @if($hasAgainst)
                <td colspan="{{ $hasPo ? 1 : 2 }}"><div class="meta-k">Against</div><div class="meta-v">{{ $data['against_number'] }}</div></td>
              @endif
            </tr>
          @endif
        </table>
      </td>
    </tr>
  </table>

  <table class="blk nt party-hdr">
    <tr>
      <td class="l">DETAILS OF RECEIVER/ BILL TO</td>
      <td>DETAILS OF CONSIGNEE | SHIP TO</td>
    </tr>
  </table>
  <table class="blk nt party">
    <tr>
      @foreach([$data['bill_to'], $data['ship_to']] as $i => $party)
        <td class="{{ $i === 0 ? 'l' : '' }}">
          <div class="party-name">{{ $party['name'] ?? '—' }}</div>
          <table class="kv">
            <tr><td class="k">GSTIN:</td><td>{{ $party['gstin'] ?? '' }}</td></tr>
            <tr><td class="k">State:</td><td>{{ $party['state'] ?? '' }}</td></tr>
            <tr><td class="k">Address:</td><td>{{ $party['address'] ?? '' }}</td></tr>
            <tr><td class="k">Email ID:</td><td>{{ $party['email'] ?? '' }}</td></tr>
            <tr><td class="k">Mobile:</td><td>{{ $party['mobile'] ?? '' }}</td></tr>
          </table>
        </td>
      @endforeach
    </tr>
  </table>

  <table class="blk nt items">
    <thead>
      <tr>
        <th style="width: 8.1%;">Sr. No.</th>
        <th style="width: 24.9%;">PARTICULARS</th>
        @if($data['show_hsn'])<th style="width: 12.8%;">HSN/SAC</th>@endif
        <th style="width: 8.6%;">QTY</th>
        <th style="width: 8.7%;">UQC</th>
        <th style="width: 11.1%;">RATE</th>
        @if($data['has_tax'])<th style="width: 8.1%;">GST (%)</th>@endif
        <th style="width: 17.5%;">{{ $data['has_tax'] ? 'TAXABLE VALUE' : 'AMOUNT' }}</th>
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

  <table class="blk nt bot">
    <tr>
      <td class="left">
        <div class="sec sec-words">
          <div class="sec-h">AMOUNT IN WORDS</div>
          <div style="margin-top: 2px;">{{ $data['amount_in_words'] }}</div>
        </div>
        @if($data['is_delivery_challan'])
          <div class="sec">
            <div class="sec-h">TRANSPORTATION DETAILS</div>
            <table class="bank">
              <tr><td class="k">Reason</td><td>: {{ $data['challan']['reason'] ?? '—' }}</td></tr>
              <tr><td class="k">Vehicle No.</td><td>: {{ $data['challan']['vehicle_no'] ?? '—' }}</td></tr>
              <tr><td class="k">Transporter</td><td>: {{ $data['challan']['transporter_name'] ?? '—' }}</td></tr>
              <tr><td class="k">E-Way Bill</td><td>: {{ $data['challan']['eway_bill_no'] ?? '—' }}</td></tr>
              <tr><td class="k">Receiver</td><td>: {{ $data['challan']['receiver_name'] ?? '—' }}</td></tr>
            </table>
          </div>
        @endif
        <div class="sec sec-bank">
          <div class="sec-h">BANK DETAILS (FOR RTGS/NEFT TRANSFERS)</div>
          <table class="bank">
            <tr><td class="k">Bank Name</td><td>: {{ $data['bank']['name'] ?? '' }}</td></tr>
            <tr><td class="k">Account Name</td><td>: {{ $data['bank']['account_name'] ?? '' }}</td></tr>
            <tr><td class="k">Account Number</td><td>: {{ $data['bank']['account_no'] ?? '' }}@if(!empty($data['bank']['ifsc'])) &nbsp;&nbsp; IFSC CODE: {{ $data['bank']['ifsc'] }}@endif</td></tr>
            <tr><td class="k">Branch</td><td>: {{ $data['bank']['branch'] ?? '' }}</td></tr>
          </table>
        </div>
      </td>
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
            <tr><td class="l">LESS/ADD: TDS/TCS</td><td class="v">{{ $na }}</td></tr>
          @endif
          @if($roundOff != 0)<tr><td class="l">Rounded off</td><td class="v">{{ ($roundOff < 0 ? '-' : '') . $fmt(abs($roundOff)) }}</td></tr>@elseif($sampleAll)<tr><td class="l">Rounded off</td><td class="v">{{ $na }}</td></tr>@endif
          <tr class="gt"><td class="l">Grand Total</td><td class="v">{{ $fmt($sm['grand_total']) }}</td></tr>
        </table>
      </td>
    </tr>
  </table>

  <table class="blk nt foot">
    <tr>
      <td class="terms">
        <div class="sec-h">TERMS &amp; CONDITIONS</div>
        <ol class="terms-list">
          @foreach($data['terms'] as $term)<li>{{ $term }}</li>@endforeach
        </ol>
      </td>
      <td class="sign">
        <div class="sign-for">For {{ $data['company_name_title_case'] }}</div>
        {{-- seal and signature sit in their own fixed-height row, clear of the company line above --}}
        <table style="width: auto; margin: 4px 0 3px auto; height: 40px;">
          <tr>
            @if(!empty($data['seal_path']))<td style="vertical-align: middle; padding-right: 10px;"><img class="seal-img" src="{{ $data['seal_path'] }}" alt="Seal"></td>@endif
            @if(!empty($data['signature_path']))<td style="vertical-align: middle;"><img class="sign-img" src="{{ $data['signature_path'] }}" alt="Signature"></td>@endif
          </tr>
        </table>
        <div class="sign-role">Authorised Signatory</div>
      </td>
    </tr>
  </table>

  @if(!empty($data['reverse_charge']))
    <div style="margin-top: 6px; font-size: 8.4px; font-weight: bold; text-align: center;">Tax is payable on reverse charge basis.</div>
  @endif

</body>
</html>
