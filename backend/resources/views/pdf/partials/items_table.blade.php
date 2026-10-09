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

<table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; border: 1px solid #D1D5DB;">
  <thead>
    <tr style="background-color: {{ $theme['primary'] }}; color: #FFFFFF; font-size: 9.5px; font-weight: bold;">
      <th style="width: 28px; padding: 6px 2px; text-align: center; border-right: 1px solid rgba(255,255,255,0.2);">Sr.<br>No.</th>
      <th style="padding: 6px 7px; text-align: left; border-right: 1px solid rgba(255,255,255,0.2);">Description of Goods / Services</th>
      <th style="width: 62px; padding: 6px 3px; text-align: center; border-right: 1px solid rgba(255,255,255,0.2);">HSN</th>
      <th style="width: 40px; padding: 6px 3px; text-align: center; border-right: 1px solid rgba(255,255,255,0.2);">Qty</th>
      <th style="width: 36px; padding: 6px 3px; text-align: center; border-right: 1px solid rgba(255,255,255,0.2);">Unit</th>
      <th style="width: 65px; padding: 6px 4px; text-align: right; border-right: 1px solid rgba(255,255,255,0.2);">Rate (₹)</th>
      @if($data['has_tax'])
      <th style="width: 46px; padding: 6px 3px; text-align: center; border-right: 1px solid rgba(255,255,255,0.2);">GST (%)</th>
      @endif
      <th style="width: 82px; padding: 6px 7px; text-align: right;">Amount (₹)</th>
    </tr>
  </thead>
  <tbody>
    @forelse($data['items'] as $item)
    <tr style="border-bottom: 1px solid #E5E7EB; font-size: 9.5px; page-break-inside: avoid;">
      <td style="padding: 10px 3px; text-align: center; vertical-align: top; border-right: 1px solid #E5E7EB;">{{ $item['sr_no'] }}</td>
      <td style="padding: 10px 7px; text-align: left; vertical-align: top; border-right: 1px solid #E5E7EB;">
        <div style="font-weight: bold; font-size: 11px; color: #111827; text-transform: uppercase;">{{ $item['particulars'] }}</div>
        @if(!empty($item['description']))
        <div style="font-size: 9.2px; color: #374151; line-height: 1.4; margin-top: 4px;">
          {!! nl2br(e($item['description'])) !!}
        </div>
        @endif
      </td>
      <td style="padding: 10px 3px; text-align: center; vertical-align: top; border-right: 1px solid #E5E7EB; color: #374151; font-size: 10px;">{{ $item['hsn_sac'] ?: '—' }}</td>
      <td style="padding: 10px 3px; text-align: center; vertical-align: top; border-right: 1px solid #E5E7EB; font-weight: bold; color: #111827; font-size: 10.5px;">{{ $item['qty'] !== null ? $item['qty'] : '—' }}</td>
      <td style="padding: 10px 3px; text-align: center; vertical-align: top; border-right: 1px solid #E5E7EB; color: #374151; font-size: 10px;">{{ $item['uqc'] }}</td>
      <td style="padding: 10px 4px; text-align: right; vertical-align: top; border-right: 1px solid #E5E7EB; color: #111827; font-size: 10px;">{{ number_format($item['rate'], 2) }}</td>
      @if($data['has_tax'])
      <td style="padding: 10px 3px; text-align: center; vertical-align: top; border-right: 1px solid #E5E7EB; color: #374151; font-size: 10px;">{{ $item['gst_pct'] }}</td>
      @endif
      <td style="padding: 10px 7px; text-align: right; vertical-align: top; font-weight: bold; color: #111827; font-size: 11px;">{{ number_format($item['taxable_value'], 2) }}</td>
    </tr>
    @empty
    <tr>
      <td colspan="{{ $data['has_tax'] ? 8 : 7 }}" style="padding: 14px; text-align: center; color: #6B7280; font-size: 10px;">No items found.</td>
    </tr>
    @endforelse
  </tbody>
  <tfoot>
    <tr style="background-color: {{ $theme['light_tint'] }}; border-top: 1.5px solid #9CA3AF; border-bottom: 1px solid #9CA3AF;">
      <td colspan="3" style="padding: 7px 7px; text-align: left; text-transform: uppercase; font-size: 12px; font-weight: bold; color: #111827; letter-spacing: 0.5px;">
        SUBTOTAL
      </td>
      <td style="padding: 7px 3px; text-align: center; font-size: 12px; font-weight: bold; color: #111827;">
        {{ $totalQtyDisplay ?: '' }}
      </td>
      <td colspan="{{ $data['has_tax'] ? 3 : 2 }}" style="padding: 7px;"></td>
      <td style="padding: 7px 7px; text-align: right; font-size: 12.5px; font-weight: bold; color: #111827;">
        {{ number_format($totalAmount, 2) }}
      </td>
    </tr>
  </tfoot>
</table>
