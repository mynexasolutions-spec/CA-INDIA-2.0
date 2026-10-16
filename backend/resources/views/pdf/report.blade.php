<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
@page { margin: 10mm 10mm 14mm 10mm; size: A4 landscape; }
* { box-sizing: border-box; }
body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #111; margin: 0; padding: 0; line-height: 1.35; }
table { width: 100%; border-collapse: collapse; }

/* ── Company header ── */
.company-wrap  { text-align: center; margin-bottom: 4px; }
.company-name  { font-size: 18px; font-weight: bold; color: #000; margin: 0 0 4px; letter-spacing: 0.4px; text-transform: uppercase; }
.company-addr  { font-size: 9.5px; color: #222; margin: 0 0 3px; }
.company-meta  { font-size: 9.5px; color: #222; }
.company-meta b { color: #000; }
.company-meta .sep { color: #888; margin: 0 7px; }

/* ── Report title ── */
.report-title  { text-align: center; margin: 8px 0 2px; font-size: 17px; font-weight: bold; color: #000; }
.report-period { text-align: center; margin: 0 0 10px; font-size: 10px; color: #444; }

/* ── Table ── */
.report-table          { border: 1px solid #bbb; }
.report-table th       { background: #4b5563; color: #fff; font-size: 9.5px; font-weight: bold; padding: 7px 9px; text-align: center; white-space: nowrap; border: 1px solid #3d4654; }
.report-table th:first-child { text-align: left; }
.report-table td       { border: 1px solid #d1d5db; padding: 6px 9px; font-size: 10px; text-align: center; color: #111; }
.report-table td:first-child { text-align: left; }
.report-table tr:nth-child(odd)  td { background: #fff; }
.report-table tr:nth-child(even) td { background: #f3f4f6; }
.report-table tr.total-row td   { background: #fff !important; border-top: 2px solid #6b7280; border-bottom: 1px solid #6b7280; color: #000; font-weight: bold; font-size: 10.5px; }

.empty-note { text-align: center; color: #555; font-size: 10.5px; padding: 16px 0; border: 1px solid #bbb; }

/* ── Footer ── */
.report-footer { margin-top: 10px; font-size: 9px; color: #444; }
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
<table class="report-table">
  <thead>
    <tr>
      @foreach($headers as $h)
        <th>{{ $h }}@if($isMoneyCol($h)) (₹)@endif</th>
      @endforeach
    </tr>
  </thead>
  <tbody>
    @foreach($rows as $i => $row)
      @php $arr = (array) $row; @endphp
      <tr @if($isTotalRow($arr, $i)) class="total-row" @endif>
        @foreach($headers as $h)
          @php $v = $arr[$h] ?? ''; @endphp
          <td>{{ $isMoneyCol($h) && is_numeric($v) ? number_format((float)$v, 2) : (is_scalar($v) ? $v : json_encode($v)) }}</td>
        @endforeach
      </tr>
    @endforeach
  </tbody>
</table>
@endif

<div class="report-footer">Report Generated On: {{ $genDate }}</div>

</body>
</html>
