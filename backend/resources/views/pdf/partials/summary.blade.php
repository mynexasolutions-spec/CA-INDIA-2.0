@php $dp = (int) ($data['decimals'] ?? 2); @endphp
<div style="border: 1px solid #D1D5DB;">
  <div style="background-color: {{ $theme['primary'] }}; color: #FFFFFF; font-size: 10.5px; font-weight: bold; padding: 5px 8px;">
    <table style="width: 100%; border-collapse: collapse; color: #FFFFFF;">
      <tr>
        <td style="text-align: left; letter-spacing: 0.5px; text-transform: uppercase;">Summary / Tax Bifurcation</td>
        <td style="text-align: right; width: 90px;">Amount (₹)</td>
      </tr>
    </table>
  </div>
  <div style="padding: 6px 8px;">
    <table style="width: 100%; border-collapse: collapse; font-size: 9.5px;">
      <tr>
        <td style="padding: 2.5px 0; color: #374151;">Taxable Amount</td>
        <td style="padding: 2.5px 0; text-align: right; color: #111827;">{{ number_format($data['summary']['taxable_value'], $dp) }}</td>
      </tr>
      @if($data['has_tax'])
        @if(!empty($data['summary']['igst_amount']) || ($data['doc_type'] !== 'bill_of_supply' && !empty($data['summary']['igst_rate'])))
        <tr>
          <td style="padding: 2.5px 0; color: #374151;">IGST @ {{ $data['summary']['igst_rate'] ?? 18 }}%</td>
          <td style="padding: 2.5px 0; text-align: right; color: #111827;">{{ number_format($data['summary']['igst_amount'], $dp) }}</td>
        </tr>
        @else
        <tr>
          <td style="padding: 2.5px 0; color: #374151;">CGST @ {{ $data['summary']['cgst_rate'] ?? 9 }}%</td>
          <td style="padding: 2.5px 0; text-align: right; color: #111827;">{{ number_format($data['summary']['cgst_amount'], $dp) }}</td>
        </tr>
        <tr>
          <td style="padding: 2.5px 0; color: #374151;">SGST @ {{ $data['summary']['sgst_rate'] ?? 9 }}%</td>
          <td style="padding: 2.5px 0; text-align: right; color: #111827;">{{ number_format($data['summary']['sgst_amount'], $dp) }}</td>
        </tr>
        @endif
      @endif
      <tr>
        <td style="padding: 2.5px 0; color: #374151;">Round Off</td>
        <td style="padding: 2.5px 0; text-align: right; color: #111827;">{{ number_format($data['summary']['round_off'], $dp) }}</td>
      </tr>
    </table>
  </div>
  <div style="background-color: {{ $theme['light_tint'] }}; border-top: 1.5px solid #9CA3AF; padding: 7px 8px;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="font-weight: bold; font-size: 12px; color: #111827;">Total Amount (₹)</td>
        <td style="font-weight: bold; font-size: 13px; color: #111827; text-align: right;">{{ number_format($data['summary']['grand_total'], $dp) }}</td>
      </tr>
    </table>
  </div>
</div>

<div style="margin-top: 10px; padding: 0 2px;">
  <div style="font-size: 9.5px; font-weight: bold; color: #111827;">Amount in words:</div>
  <div style="font-size: 9px; color: #374151; line-height: 1.4; margin-top: 2px;">{{ $data['amount_in_words'] }}</div>
</div>
