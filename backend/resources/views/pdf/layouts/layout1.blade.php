<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>{{ $data['document_title'] }} - {{ $data['invoice_no'] }}</title>
@php
  /*
   * Layout 1 — classic boxed form (Simple / Royal Blue / Deep Teal / Mocha Brown / Dusty Plum).
   * Black grid throughout; the theme colour shows only in the document title and in the corner ribbons the
   * renderer draws on the page canvas ("Simple" has neither).
   */
  $simple = ($theme['key'] ?? '') === 'simple';
  $accent = $simple ? '#111111' : ($theme['l1_title'] ?? $theme['primary']);
  $ink = '#111111';
  $fmt = fn ($n) => number_format((float) $n, 2);

  // Blank grid rows keep the items area looking like a printed form on short documents.
  // The form is meant to fill one page. The blank rows shrink to make room for anything taller than the standard
  // content (wrapped names/addresses/terms, wrapped item descriptions, a seal + signature), so a short document
  // never spills its terms/signature block onto a second page. One wrapped line costs ~0.65 of a blank row.
  $wrap = fn ($text, $perLine) => max(1, (int) ceil(mb_strlen(trim((string) $text)) / $perLine));
  $extraLines = max(0, $wrap($data['company_name'] ?? '', 24) - 1)
      + max(0, $wrap($data['seller_address'] ?? '', 50) - 2)
      + max(0, max($wrap($data['bill_to']['address'] ?? '', 52), $wrap($data['ship_to']['address'] ?? '', 52)) - 1)
      + max(0, $wrap(($data['bill_to']['name'] ?? ''), 36) - 1)
      + max(0, array_sum(array_map(fn ($t) => $wrap($t, 95), $data['terms'] ?? [])) - 3)
      + ((!empty($data['seal_path']) || !empty($data['signature_path'])) ? 3 : 0)
      + (!empty($data['logo_path']) ? 1 : 0)
      + array_sum(array_map(fn ($i) => max(0, $wrap($i['particulars'] ?? '', 34) - 1) + (!empty($i['description']) ? 1 : 0), $data['items']));
  $minRows = 15;
  $fillRows = max(0, $minRows - count($data['items']) - (int) ceil($extraLines * 0.65));
  $cols = 6 + ($data['show_hsn'] ? 1 : 0) + ($data['has_tax'] ? 1 : 0);   // Sr, Particulars, Qty, UQC, Rate, Amount (+HSN) (+GST)

  $tds = $data['summary']['tds_tcs_type'] ?? null;
@endphp
<style>
  @page { size: A4 portrait; margin: 5mm 7mm 13mm 7mm; }
  * { box-sizing: border-box; }
  /* The 2px side padding keeps the outer table borders inside the printable area; with a bare 100% width dompdf
     clips one of the side borders at the page edge. */
  body { font-family: "Times", "DejaVu Serif", serif; font-size: 10.6px; color: {{ $ink }}; margin: 0; padding: 0; line-height: 1.35; }
  table { width: 100%; border-collapse: collapse; }
  td, th { vertical-align: top; }
  .blk { border: 1.4px solid {{ $ink }}; }
  .nt { border-top: 0; }
  .title { text-align: center; font-size: 15.3px; font-weight: bold; color: {{ $accent }}; padding: 6px 4px; letter-spacing: 0.4px; }
  .cell { border-right: 1px solid {{ $ink }}; padding: 5px 7px; }
  .cell-last { padding: 5px 7px; }
  .logo-cell { width: 13.5%; text-align: center; vertical-align: middle; border-right: 1px solid {{ $ink }}; padding: 6px; }
  .logo-cell img { max-width: 84px; max-height: 76px; }
  .seller-cell { width: 39%; border-right: 1px solid {{ $ink }}; padding: 5px 7px; }
  .seller-name { font-size: 12.4px; font-weight: bold; text-transform: uppercase; }
  .seller-line { font-weight: bold; font-size: 10.1px; }
  .meta-cell { padding: 0; }
  .meta-tbl td { padding: 4px 7px; border-bottom: 1px solid {{ $ink }}; font-size: 10.1px; }
  .meta-tbl tr:last-child td { border-bottom: 0; }
  .meta-tbl td.l { border-right: 1px solid {{ $ink }}; width: 52%; }
  .meta-k { color: #1F2937; }
  .meta-v { font-weight: bold; margin-top: 1px; }
  .party-hdr td { font-weight: bold; font-size: 10.6px; padding: 5px 8px; text-transform: uppercase; }
  .party-hdr td.l, .party td.l { border-right: 1px solid {{ $ink }}; width: 50%; }
  .party td { padding: 5px 8px 7px; font-size: 10.1px; }
  .party-name { font-weight: bold; font-size: 11.3px; text-transform: uppercase; margin-bottom: 2px; }
  .kv td { padding: 1px 0; font-size: 10.1px; }
  .kv td.k { width: 50px; }
  .kv td.c { width: 8px; }
  .items th { border-bottom: 1px solid {{ $ink }}; border-right: 1px solid {{ $ink }}; font-weight: bold; font-size: 10.1px; padding: 5px 3px; text-align: center; }
  .items th:last-child { border-right: 0; }
  .items td { border-bottom: 1px solid {{ $ink }}; border-right: 1px solid {{ $ink }}; font-size: 10.4px; padding: 4px 4px; text-align: center; height: 22px; }
  .items td:last-child { border-right: 0; }
  .items td.p { text-align: left; font-weight: bold; }
  .items td.r { text-align: right; }
  .items tr { page-break-inside: avoid; }
  .bot td.left { width: 62%; padding: 0; border-right: 1px solid {{ $ink }}; }
  .bot td.right { padding: 0; }
  .sec { padding: 5px 8px 6px; }
  .sec-h { font-weight: bold; font-size: 10.6px; text-transform: uppercase; }
  .sec + .sec { border-top: 1px solid {{ $ink }}; }
  .bank td { padding: 1px 0; font-size: 10.1px; }
  .bank td.k { width: 78px; }
  .sum td { border-bottom: 1px solid {{ $ink }}; padding: 4px 8px; font-size: 10.4px; }
  .sum tr:last-child td { border-bottom: 0; }
  .sum td.l { border-right: 1px solid {{ $ink }}; width: 64%; }
  .sum td.v { text-align: center; }
  .sum .b { font-weight: bold; text-transform: uppercase; }
  .sum .gt td { font-size: 12.4px; font-weight: bold; padding: 6px 8px; }
  .foot td { height: 92px; }
  .foot td.terms { width: 50%; border-right: 1px solid {{ $ink }}; padding: 5px 8px 8px; }
  .terms-list { margin: 3px 0 0; padding-left: 14px; font-size: 9.9px; }
  .terms-list li { margin-bottom: 3px; }
  .sign { padding: 5px 8px; text-align: right; }
  .sign-for { font-weight: bold; font-size: 10.6px; line-height: 1.3; }
  .sign-img { max-height: 44px; max-width: 120px; display: block; }
  .seal-img { max-height: 58px; max-width: 58px; display: block; }
  .sign-role { font-size: 10.4px; margin-top: 2px; }
</style>
</head>
<body>

  <table class="blk">
    <tr><td class="title">{{ $data['document_title'] }}</td></tr>
  </table>

  <table class="blk nt">
    <tr>
      <td class="logo-cell">
        @if(!empty($data['logo_path']))<img src="{{ $data['logo_path'] }}" alt="Logo">@endif
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
        <table class="meta-tbl">
          <tr>
            <td class="l"><div class="meta-k">{{ $data['doc_number_label'] }}</div><div class="meta-v">{{ $data['invoice_no'] }}</div></td>
            <td><div class="meta-k">{{ $data['doc_date_label'] }}</div><div class="meta-v">{{ $data['invoice_date'] }}</div></td>
          </tr>
          <tr>
            <td class="l"><div class="meta-k">Place of Supply</div><div class="meta-v">{{ $data['place_of_supply'] }}</div></td>
            <td><div class="meta-k">Reverse Charge:</div><div class="meta-v">{{ $data['reverse_charge'] ? 'Yes' : 'No' }}</div></td>
          </tr>
          <tr>
            <td class="l"><div class="meta-k">PO No.</div><div class="meta-v">{{ $data['po_number'] ?? '—' }}</div></td>
            <td><div class="meta-k">Against</div><div class="meta-v">{{ !empty($data['against_number']) ? $data['against_number'] : '—' }}</div></td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <table class="blk nt party-hdr">
    <tr>
      <td class="l">DETAILS OF RECEIVER / BILL TO</td>
      <td>DETAILS OF CONSIGNEE | SHIP TO</td>
    </tr>
  </table>
  <table class="blk nt party">
    <tr>
      @foreach([$data['bill_to'], $data['ship_to']] as $i => $party)
        <td class="{{ $i === 0 ? 'l' : '' }}">
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

  <table class="blk nt items">
    <thead>
      <tr>
        <th style="width: 7%;">Sr. No.</th>
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

  <table class="blk nt bot">
    <tr>
      <td class="left">
        <div class="sec">
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
        <div class="sec">
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
        <table style="width: auto; margin: 8px 0 4px auto; height: 64px;">
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
