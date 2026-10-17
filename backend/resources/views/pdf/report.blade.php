<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
@page { margin: 10mm 10mm 14mm 10mm; size: A4 landscape; }
* { box-sizing: border-box; }
body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #000; margin: 0; padding: 0; line-height: 1.35; }
table { width: 100%; border-collapse: collapse; table-layout: auto; }

/* Company header */
.company-wrap  { text-align: center; margin-bottom: 6px; }
.company-name  { font-size: 24px; font-weight: bold; color: #000; margin: 0 0 5px; text-transform: uppercase; }
.company-addr  { font-size: 11px; color: #000; margin: 0 0 3px; }
.company-meta  { font-size: 11px; color: #000; }
.company-meta .sep { margin: 0 7px; }

/* Report title (no separator line above it) */
.report-title  { text-align: center; margin: 12px 0 2px; font-size: 21px; font-weight: bold; color: #000; }
.report-period { text-align: center; margin: 0 0 12px; font-size: 12px; font-weight: bold; color: #000; }

/* Table: grey header / white body, black text only */
.report-table          { border: 1px solid #6b7280; }
.report-table th       { background: #4b5563; color: #fff; font-weight: bold; padding: 6px 5px; text-align: center; border: 1px solid #374151; word-wrap: break-word; }
.report-table td       { background: #fff; border: 1px solid #9ca3af; padding: 5px 5px; text-align: center; color: #000; word-wrap: break-word; }
.report-table td.lbl   { text-align: left; }
.report-table td.num   { text-align: right; }
.report-table tr.total-row td { background: #fff; color: #000; font-weight: bold; border-top: 2px solid #111; }

.empty-note { text-align: center; color: #000; font-size: 11px; padding: 16px 0; border: 1px solid #6b7280; }

/* Footer: only the generated date, bottom-left */
.report-footer { margin-top: 14px; font-size: 10px; color: #000; text-align: left; }
</style>
</head>
<body>

@php
  $business = $meta['name'] ?? null;
  $address  = $meta['address'] ?? '';
  $pan      = $meta['pan'] ?? null;
  $gstin    = $meta['gstin'] ?? null;
  $phone    = $meta['phone'] ?? null;
  $email    = $meta['email'] ?? null;

  $headers     = count($rows) ? array_keys((array) $rows[0]) : [];
  $isMoneyCol  = fn ($h) => in_array($h, $moneyHeaders, true);
  $isTotalRow  = function ($row, $index) use ($rows) {
    if ($index !== count($rows) - 1) return false;
    $first = is_array($row) ? reset($row) : $row;
    return is_string($first) && stripos($first, 'total') !== false;
  };

  $genDate = $generatedOn ?? now()->format('d-m-Y');
  $nCols = max(count($headers), 1);
  $fs = $nCols > 14 ? 6.5 : ($nCols > 11 ? 7.5 : ($nCols > 8 ? 8.5 : 10));
@endphp

@if($business)
<div class="company-wrap">
  <div class="company-name">{{ $business }}</div>
  @if($address)<div class="company-addr">{{ $address }}</div>@endif
  @php
    $parts = array_filter([
      $pan   ? 'PAN: '.$pan        : null,
      $gstin ? 'GSTIN: '.$gstin    : null,
      $email ? 'Email: '.$email    : null,
      $phone ? 'Mobile: '.$phone   : null,
    ]);
  @endphp
  @if($parts)
  <div class="company-meta">
    @foreach(array_values($parts) as $pi => $part)
      @if($pi > 0)<span class="sep">|</span>@endif<b>{{ $part }}</b>
    @endforeach
  </div>
  @endif
</div>
@endif

<div class="report-title">{{ $title }}</div>
<div class="report-period">Period: {{ $periodText }}</div>

@if(!count($rows))
  <div class="empty-note">No data for this period.</div>
@else
<table class="report-table" style="font-size: {{ $fs }}px;">
  <thead>
    <tr>
      @foreach($headers as $h)
        <th style="font-size: {{ $fs }}px;">{{ $h }}@if($isMoneyCol($h)) (₹)@endif</th>
      @endforeach
    </tr>
  </thead>
  <tbody>
    @foreach($rows as $i => $row)
      @php $arr = (array) $row; @endphp
      <tr @if($isTotalRow($arr, $i)) class="total-row" @endif>
        @foreach($headers as $hi => $h)
          @php $v = $arr[$h] ?? ''; @endphp
          <td class="{{ $hi === 0 ? 'lbl' : ($isMoneyCol($h) ? 'num' : '') }}" style="font-size: {{ $fs }}px;">{{ $isMoneyCol($h) && is_numeric($v) ? number_format((float)$v, 2) : (is_scalar($v) ? $v : json_encode($v)) }}</td>
        @endforeach
      </tr>
    @endforeach
  </tbody>
</table>
@endif

<div class="report-footer">Report Generated On: {{ $genDate }}</div>

</body>
</html>
