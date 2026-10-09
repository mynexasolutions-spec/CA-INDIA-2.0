<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page {
    size: A4 portrait;
    margin: 8mm 9mm 12mm 9mm;
  }
  * {
    box-sizing: border-box;
  }
  body {
    font-family: DejaVu Sans, sans-serif;
    font-size: 10px;
    color: #1E293B;
    margin: 0;
    padding: 4px 4px 0;
    line-height: 1.4;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  td, th {
    vertical-align: top;
  }

  /* 1. Header Box */
  .hdr-table {
    width: 100%;
    margin-bottom: 11px;
    border-collapse: separate;
  }
  .hdr-logo-box {
    width: 92px;
    height: 90px;
    border: 1.3px solid {{ $theme['primary'] }};
    border-radius: 9px;
    padding: 6px;
    text-align: center;
    vertical-align: middle;
    background: #ffffff;
  }
  .hdr-logo-box img {
    width: 76px;
    height: 76px;
    max-width: 76px;
    max-height: 76px;
    display: block;
    margin: 0 auto;
  }
  .hdr-gap {
    width: 8px;
  }
  .hdr-title-box {
    height: 90px;
    border: 1.3px solid {{ $theme['primary'] }};
    border-radius: 9px;
    padding: 0 14px;
    text-align: center;
    vertical-align: middle;
    background: #ffffff;
  }
  .hdr-company-name {
    color: {{ $theme['primary'] }};
    font-size: 15.5pt;
    font-weight: 900;
    letter-spacing: 0;
    margin: 0;
    line-height: 1.25;
    text-transform: uppercase;
    white-space: nowrap;
  }

  /* 2. 2-Panel Meta Section */
  .panel-table {
    width: 100%;
    margin-bottom: 11px;
  }
  .panel-left {
    width: 53.5%;
    border: 1.3px solid {{ $theme['primary'] }};
    border-radius: 9px;
    padding: 9px 12px;
    background: #ffffff;
    vertical-align: top;
  }
  .panel-gap {
    width: 1.2%;
  }
  .panel-right {
    width: 45.3%;
    border: 1.3px solid {{ $theme['primary'] }};
    border-radius: 9px;
    padding: 9px 12px;
    background: #ffffff;
    vertical-align: top;
  }

  /* Meta table inside panels */
  .meta-tbl {
    width: 100%;
  }
  .meta-tbl td {
    padding: 3px 0;
    font-size: 9.6px;
    vertical-align: top;
  }
  .meta-ico {
    width: 22px;
    padding-right: 5px;
  }
  .meta-ico img {
    width: 17px;
    height: 17px;
    display: block;
    margin-top: 1px;
  }
  .meta-label {
    width: 52px;
    font-weight: bold;
    color: #1E293B;
    white-space: nowrap;
  }
  .meta-colon {
    width: 10px;
    font-weight: bold;
    color: #1E293B;
    text-align: center;
  }
  .meta-val {
    color: #0F172A;
    font-weight: bold;
  }

  /* Pill title */
  .pill-wrap {
    text-align: center;
    margin: 2px 0 8px;
  }
  .tax-pill {
    display: inline-block;
    background-color: {{ $theme['primary'] }};
    color: {{ $theme['text_on_primary'] }};
    font-size: 11px;
    font-weight: bold;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    padding: 4.5px 24px;
    border-radius: 18px;
  }

  .meta-right-tbl {
    width: 100%;
  }
  .meta-right-tbl td {
    padding: 3px 0;
    font-size: 9.6px;
    vertical-align: middle;
  }
  .meta-right-label {
    width: 104px;
    font-weight: bold;
    color: #1E293B;
    white-space: nowrap;
  }

  /* 3. Bill To / Ship To Section */
  .party-table {
    width: 100%;
    margin-bottom: 11px;
    border-collapse: separate;
    border-spacing: 0;
  }
  .party-box {
    width: 49.4%;
    border: 1.3px solid {{ $theme['primary'] }};
    border-radius: 9px;
    background: #ffffff;
    vertical-align: top;
    padding: 0;
  }
  .party-hdr {
    background-color: {{ $theme['primary'] }};
    color: {{ $theme['text_on_primary'] }};
    font-size: 9.2px;
    font-weight: bold;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    padding: 6.5px 12px;
    border-top-left-radius: 9px;
    border-top-right-radius: 9px;
    margin: -1.3px -1.3px 0 -1.3px;
  }
  .party-body {
    padding: 8px 12px 10px;
  }
  .party-name {
    font-weight: bold;
    font-size: 11.2px;
    color: #0F172A;
    margin-bottom: 4px;
  }
  .party-fields {
    width: 100%;
  }
  .party-fields td {
    padding: 2px 0;
    font-size: 9.5px;
    vertical-align: top;
  }
  .pf-lab {
    width: 52px;
    font-weight: bold;
    color: #1E293B;
    white-space: nowrap;
  }
  .pf-colon {
    width: 10px;
    font-weight: bold;
    color: #1E293B;
    text-align: center;
  }
  .pf-val {
    color: #1E293B;
  }

  /* 4. Line Items Table */
  .items-wrap {
    border: 1.3px solid {{ $theme['primary'] }};
    border-radius: 9px;
    margin-bottom: 11px;
    overflow: hidden;
    background: #ffffff;
  }
  .items-table {
    width: 100%;
    border-collapse: collapse;
  }
  .items-table thead {
    display: table-header-group;
  }
  .items-table th {
    background-color: {{ $theme['primary'] }};
    color: {{ $theme['text_on_primary'] }};
    font-size: 8.8px;
    font-weight: bold;
    padding: 8px 4px;
    text-align: center;
    text-transform: uppercase;
    border-right: 1px solid rgba(255, 255, 255, 0.25);
    line-height: 1.3;
  }
  .items-table th:last-child {
    border-right: none;
  }
  .items-table th:first-child {
    border-top-left-radius: 7.7px;
  }
  .items-table th:last-child {
    border-top-right-radius: 7.7px;
  }
  .items-table td {
    border-bottom: 1px solid #E2E8F0;
    border-right: 1px solid #E2E8F0;
    padding: 8px 5px;
    font-size: 9.6px;
    color: #1E293B;
    vertical-align: middle;
    text-align: center;
  }
  .items-table td:last-child {
    border-right: none;
  }
  .items-table tr:last-child td {
    border-bottom: none;
  }
  .items-table tr {
    page-break-inside: avoid;
  }
  .items-table .desc-cell {
    text-align: left;
    font-weight: bold;
    color: #0F172A;
    padding-left: 8px;
  }

  /* 5. Bottom Split: Left Cards vs Right Summary & Signatory */
  .bottom-table {
    width: 100%;
    margin-top: 4px;
  }
  .bottom-left {
    width: 50.5%;
    vertical-align: top;
  }
  .bottom-gap {
    width: 1.5%;
  }
  .bottom-right {
    width: 48%;
    vertical-align: top;
  }

  .card {
    border: 1.3px solid {{ $theme['primary'] }};
    border-radius: 9px;
    padding: 8px 12px;
    background: #ffffff;
    margin-bottom: 8px;
    page-break-inside: avoid;
  }
  .card-hdr {
    color: {{ $theme['primary'] }};
    font-weight: bold;
    font-size: 9.6px;
    letter-spacing: 0.4px;
    text-transform: uppercase;
  }
  .card-hdr img {
    width: 15px;
    height: 15px;
    vertical-align: -2.5px;
    margin-right: 5px;
  }
  .card-sep {
    border-top: 1px dashed #CBD5E1;
    margin: 5px 0 6px;
  }
  .card-val {
    font-size: 10px;
    font-weight: bold;
    color: #0F172A;
    line-height: 1.45;
  }
  .bank-tbl {
    width: 100%;
  }
  .bank-tbl td {
    padding: 2px 0;
    font-size: 9.2px;
    vertical-align: top;
  }
  .bt-lab {
    width: 82px;
    font-weight: bold;
    color: #1E293B;
    white-space: nowrap;
  }
  .bt-colon {
    width: 10px;
    font-weight: bold;
    color: #1E293B;
    text-align: center;
  }
  .bt-val {
    color: #0F172A;
  }
  .terms-list {
    margin: 0;
    padding-left: 15px;
    font-size: 8.8px;
    color: #1E293B;
    line-height: 1.45;
  }
  .terms-list li {
    margin-bottom: 2px;
  }

  /* Summary Table */
  .summary-box {
    border: 1.3px solid {{ $theme['primary'] }};
    border-radius: 9px;
    overflow: hidden;
    background: #ffffff;
    margin-bottom: 14px;
    page-break-inside: avoid;
  }
  .sum-tbl {
    width: 100%;
    border-collapse: collapse;
  }
  .sum-tbl td {
    padding: 6.5px 12px;
    font-size: 9.8px;
    border-bottom: 1px solid #E2E8F0;
  }
  .sum-tbl .lab {
    color: #334155;
    font-weight: normal;
  }
  .sum-tbl .val {
    text-align: right;
    color: #0F172A;
    font-weight: bold;
  }
  .grand-row td {
    background-color: {{ $theme['light_tint'] }};
    border-top: 2px solid {{ $theme['primary'] }};
    border-bottom: 2px solid {{ $theme['dark'] }} !important;
    padding: 8.5px 12px;
  }
  .grand-row td:first-child {
    border-bottom-left-radius: 7.7px;
  }
  .grand-row td:last-child {
    border-bottom-right-radius: 7.7px;
  }
  .grand-row .lab {
    color: #0F172A;
    font-size: 11.5px;
    font-weight: bold;
    letter-spacing: 0.4px;
  }
  .grand-row .val {
    color: #0F172A;
    font-size: 13.5px;
    font-weight: bold;
  }

  /* Signatory Block */
  .sign-wrap {
    page-break-inside: avoid;
    margin-top: 12px;
  }
  .sign-company {
    text-align: right;
    font-size: 11.5px;
    font-weight: bold;
    color: #0F172A;
    margin-bottom: 10px;
  }
  .sign-tbl {
    width: 100%;
  }
  .seal-cell {
    width: 65px;
    vertical-align: middle;
    text-align: left;
  }
  .seal-cell img {
    width: 60px;
    height: 60px;
    max-width: 60px;
    max-height: 60px;
    display: block;
  }
  .sig-cell {
    vertical-align: middle;
    text-align: right;
  }
  .sig-img {
    max-height: 30px;
    display: block;
    margin-left: auto;
    margin-bottom: 2px;
  }
  .sig-name {
    font-size: 10px;
    font-weight: bold;
    color: #0F172A;
    margin-top: 2px;
  }
  .sig-role {
    font-size: 8.8px;
    color: #64748B;
    margin-top: 1px;
    font-weight: normal;
  }
</style>
</head>
<body>

  <!-- 1. Header: Logo Box + Company Name Box -->
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

  <!-- 2. Seller Info Panel + Invoice Meta Panel -->
  <table class="panel-table">
    <tr>
      <!-- Left Panel: Seller Details -->
      <td class="panel-left">
        <table class="meta-tbl">
          <tr>
            <td class="meta-ico"><img src="{{ $icons['pin'] }}" alt=""></td>
            <td class="meta-label">Address</td>
            <td class="meta-colon">:</td>
            <td class="meta-val">{!! str_replace(['B-71', ' - '], ['<span style="white-space: nowrap;">B&#8209;71</span>', '&nbsp;&ndash;&nbsp;'], e($data['seller_address'])) !!}</td>
          </tr>
          <tr>
            <td class="meta-ico"><img src="{{ $icons['gstin'] }}" alt=""></td>
            <td class="meta-label">GSTIN</td>
            <td class="meta-colon">:</td>
            <td class="meta-val">{{ $data['seller_gstin'] }} | PAN : {{ $data['seller_pan'] }}</td>
          </tr>
          <tr>
            <td class="meta-ico"><img src="{{ $icons['email'] }}" alt=""></td>
            <td class="meta-label">Email</td>
            <td class="meta-colon">:</td>
            <td class="meta-val">{{ $data['seller_email'] }}</td>
          </tr>
          <tr>
            <td class="meta-ico"><img src="{{ $icons['phone'] }}" alt=""></td>
            <td class="meta-label">Phone</td>
            <td class="meta-colon">:</td>
            <td class="meta-val">{{ $data['seller_phone'] }}</td>
          </tr>
          <tr>
            <td class="meta-ico"><img src="{{ $icons['pin'] }}" alt=""></td>
            <td class="meta-label">State</td>
            <td class="meta-colon">:</td>
            <td class="meta-val">{{ $data['seller_state'] }}</td>
          </tr>
        </table>
      </td>
      <td class="panel-gap"></td>
      <!-- Right Panel: Invoice Meta -->
      <td class="panel-right">
        <div class="pill-wrap">
          <span class="tax-pill">— {{ $data['document_title'] }} —</span>
        </div>
        <table class="meta-right-tbl">
          <tr>
            <td class="meta-ico"><img src="{{ $icons['doc'] }}" alt=""></td>
            <td class="meta-right-label">Tax Invoice No.</td>
            <td class="meta-colon">:</td>
            <td class="meta-val">{{ $data['invoice_no'] }}</td>
          </tr>
          <tr>
            <td class="meta-ico"><img src="{{ $icons['calendar'] }}" alt=""></td>
            <td class="meta-right-label">Tax Invoice Date</td>
            <td class="meta-colon">:</td>
            <td class="meta-val">{{ $data['invoice_date'] }}</td>
          </tr>
          <tr>
            <td class="meta-ico"><img src="{{ $icons['chart'] }}" alt=""></td>
            <td class="meta-right-label">Financial Year</td>
            <td class="meta-colon">:</td>
            <td class="meta-val">{{ $data['financial_year'] }}</td>
          </tr>
          <tr>
            <td class="meta-ico"><img src="{{ $icons['pin'] }}" alt=""></td>
            <td class="meta-right-label">Place of Supply</td>
            <td class="meta-colon">:</td>
            <td class="meta-val">{{ $data['place_of_supply'] }}</td>
          </tr>
          <tr>
            <td class="meta-ico"><img src="{{ $icons['reverse'] }}" alt=""></td>
            <td class="meta-right-label">Reverse Charge</td>
            <td class="meta-colon">:</td>
            <td class="meta-val">{{ $data['reverse_charge'] }}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- 3. Details of Receiver | Details of Consignee -->
  <table class="party-table">
    <tr>
      <!-- Bill To -->
      <td class="party-box">
        <div class="party-hdr">DETAILS OF RECEIVER | BILL TO</div>
        <div class="party-body">
          <div class="party-name">{{ $data['bill_to']['name'] }}</div>
          <table class="party-fields">
            <tr>
              <td class="pf-lab">Address</td>
              <td class="pf-colon">:</td>
              <td class="pf-val">{{ $data['bill_to']['address'] }}</td>
            </tr>
            <tr>
              <td class="pf-lab">GSTIN</td>
              <td class="pf-colon">:</td>
              <td class="pf-val">{{ $data['bill_to']['gstin'] }}</td>
            </tr>
            <tr>
              <td class="pf-lab">State</td>
              <td class="pf-colon">:</td>
              <td class="pf-val">{{ $data['bill_to']['state'] }}</td>
            </tr>
            <tr>
              <td class="pf-lab">Mobile</td>
              <td class="pf-colon">:</td>
              <td class="pf-val">{{ $data['bill_to']['mobile'] }}</td>
            </tr>
          </table>
        </div>
      </td>
      <td class="panel-gap"></td>
      <!-- Ship To -->
      <td class="party-box">
        <div class="party-hdr">DETAILS OF CONSIGNEE | SHIP TO</div>
        <div class="party-body">
          <div class="party-name">{{ $data['ship_to']['name'] }}</div>
          <table class="party-fields">
            <tr>
              <td class="pf-lab">Address</td>
              <td class="pf-colon">:</td>
              <td class="pf-val">{{ $data['ship_to']['address'] }}</td>
            </tr>
            <tr>
              <td class="pf-lab">GSTIN</td>
              <td class="pf-colon">:</td>
              <td class="pf-val">{{ $data['ship_to']['gstin'] }}</td>
            </tr>
            <tr>
              <td class="pf-lab">State</td>
              <td class="pf-colon">:</td>
              <td class="pf-val">{{ $data['ship_to']['state'] }}</td>
            </tr>
            <tr>
              <td class="pf-lab">Mobile</td>
              <td class="pf-colon">:</td>
              <td class="pf-val">{{ $data['ship_to']['mobile'] }}</td>
            </tr>
          </table>
        </div>
      </td>
    </tr>
  </table>

  <!-- 4. Line Items Table -->
  <div class="items-wrap">
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 6%;">SR.<br>NO.</th>
          <th style="width: 32%;">PARTICULARS</th>
          <th style="width: 10%;">HSN /<br>SAC</th>
          <th style="width: 8%;">QTY</th>
          <th style="width: 8%;">UQC</th>
          <th style="width: 11%;">RATE<br>(₹)</th>
          <th style="width: 8%;">GST %</th>
          <th style="width: 17%;">TAXABLE VALUE<br>(₹)</th>
        </tr>
      </thead>
      <tbody>
        @foreach($data['items'] as $index => $item)
          <tr>
            <td style="font-weight: bold;">{{ $item['sr_no'] ?? ($index + 1) }}</td>
            <td class="desc-cell">{{ $item['particulars'] }}</td>
            <td>{{ $item['hsn_sac'] }}</td>
            <td style="font-weight: bold;">{{ $item['qty'] }}</td>
            <td>{{ $item['uqc'] }}</td>
            <td>{{ number_format($item['rate'], 0) }}</td>
            <td>{{ $item['gst_pct'] }}</td>
            <td style="font-weight: bold; color: #0F172A;">{{ number_format($item['taxable_value'], 0) }}</td>
          </tr>
        @endforeach
      </tbody>
    </table>
  </div>

  <!-- 5. Bottom Section: Cards (Left) vs Summary & Signatory (Right) -->
  <table class="bottom-table">
    <tr>
      <!-- Left Column: 3 Cards -->
      <td class="bottom-left">
        <!-- Amount In Words -->
        <div class="card">
          <div class="card-hdr">
            <img src="{{ $icons['rupee'] }}" alt=""> AMOUNT IN WORDS
          </div>
          <div class="card-sep"></div>
          <div class="card-val">{{ $data['amount_in_words'] }}</div>
        </div>

        <!-- Bank Details -->
        <div class="card">
          <div class="card-hdr">
            <img src="{{ $icons['bank'] }}" alt=""> BANK DETAILS (FOR RTGS/NEFT TRANSFERS)
          </div>
          <div class="card-sep"></div>
          <table class="bank-tbl">
            <tr>
              <td class="bt-lab">Bank Name</td>
              <td class="bt-colon">:</td>
              <td class="bt-val"><strong>{{ $data['bank']['name'] }}</strong></td>
            </tr>
            <tr>
              <td class="bt-lab">Account Name</td>
              <td class="bt-colon">:</td>
              <td class="bt-val">{{ $data['bank']['account_name'] }}</td>
            </tr>
            <tr>
              <td class="bt-lab">Account Number</td>
              <td class="bt-colon">:</td>
              <td class="bt-val">{{ $data['bank']['account_no'] }} &nbsp;|&nbsp; IFSC Code : {{ $data['bank']['ifsc'] }}</td>
            </tr>
            <tr>
              <td class="bt-lab">Branch</td>
              <td class="bt-colon">:</td>
              <td class="bt-val">{{ $data['bank']['branch'] }}</td>
            </tr>
          </table>
        </div>

        <!-- Terms and Conditions -->
        <div class="card">
          <div class="card-hdr">
            <img src="{{ $icons['terms'] }}" alt=""> TERMS AND CONDITIONS
          </div>
          <div class="card-sep"></div>
          <ol class="terms-list">
            @foreach($data['terms'] as $term)
              <li>{{ $term }}</li>
            @endforeach
          </ol>
        </div>
      </td>

      <td class="bottom-gap"></td>

      <!-- Right Column: Summary + Signatory -->
      <td class="bottom-right">
        <!-- Summary Card -->
        <div class="summary-box">
          <table class="sum-tbl">
            <tr>
              <td class="lab">Total Taxable Value</td>
              <td class="val">₹ {{ number_format($data['summary']['taxable_value'], 0) }}</td>
            </tr>
            <tr>
              <td class="lab">IGST ({{ $data['summary']['igst_rate'] ?? '18%' }})</td>
              <td class="val">₹ {{ number_format($data['summary']['igst_amount'], 0) }}</td>
            </tr>
            <tr>
              <td class="lab">Round Off</td>
              <td class="val">₹ {{ number_format($data['summary']['round_off'] ?? 0, 2) }}</td>
            </tr>
            <tr class="grand-row">
              <td class="lab">GRAND TOTAL</td>
              <td class="val">₹ {{ number_format($data['summary']['grand_total'], 0) }}</td>
            </tr>
          </table>
        </div>

        <!-- Signatory Section -->
        <div class="sign-wrap">
          <div class="sign-company">For {{ $data['company_name_title_case'] ?? ucwords(strtolower($data['company_name'])) }}</div>
          <table class="sign-tbl">
            <tr>
              <td class="seal-cell">
                @if(!empty($data['seal_path']))
                  <img src="{{ $data['seal_path'] }}" alt="Seal">
                @endif
              </td>
              <td class="sig-cell">
                @if(!empty($data['signature_path']))
                  <img class="sig-img" src="{{ $data['signature_path'] }}" alt="Signature">
                @endif
                <div class="sig-name">{{ $data['signatory_name'] }}</div>
                <div class="sig-role">Authorised Signatory</div>
              </td>
            </tr>
          </table>
        </div>
      </td>
    </tr>
  </table>

</body>
</html>
