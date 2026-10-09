<table style="width: 100%; border-collapse: collapse; margin-bottom: 14px;">
  <tr>
    <td style="width: 49%; vertical-align: top; padding: 0;">
      <div style="border: 1px solid #D1D5DB;">
        <div style="background-color: {{ $theme['primary'] }}; color: #FFFFFF; font-weight: bold; font-size: 11px; padding: 5.5px 10px; text-transform: uppercase; letter-spacing: 0.5px;">
          BILL TO
        </div>
        <div style="padding: 8px 10px 10px; min-height: 96px;">
          <div style="font-weight: bold; font-size: 12px; color: #111827; margin-bottom: 3.5px; text-transform: uppercase;">
            {{ $data['bill_to']['name'] }}
          </div>
          <div style="font-size: 9.5px; color: #374151; line-height: 1.38; margin-bottom: 7px;">
            {!! nl2br(e($data['bill_to']['address'] ?: '—')) !!}
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 9.5px;">
            <tr>
              <td style="width: 85px; color: #4B5563; padding: 2px 0;">GSTIN</td>
              <td style="width: 10px; color: #4B5563; padding: 2px 0;">:</td>
              <td style="color: #111827; font-weight: bold; padding: 2px 0;">{{ $data['bill_to']['gstin'] ?: 'Unregistered' }}</td>
            </tr>
            @if(!empty($data['bill_to']['pan']))
            <tr>
              <td style="color: #4B5563; padding: 2px 0;">PAN Number</td>
              <td style="color: #4B5563; padding: 2px 0;">:</td>
              <td style="color: #111827; font-weight: bold; padding: 2px 0;">{{ $data['bill_to']['pan'] }}</td>
            </tr>
            @endif
            <tr>
              <td style="color: #4B5563; padding: 2px 0;">Place of Supply</td>
              <td style="color: #4B5563; padding: 2px 0;">:</td>
              <td style="color: #111827; font-weight: bold; padding: 2px 0;">{{ $data['place_of_supply'] ?: ($data['bill_to']['state'] ?: '—') }}</td>
            </tr>
          </table>
        </div>
      </div>
    </td>
    <td style="width: 2%;"></td>
    <td style="width: 49%; vertical-align: top; padding: 0;">
      <div style="border: 1px solid #D1D5DB;">
        <div style="background-color: {{ $theme['primary'] }}; color: #FFFFFF; font-weight: bold; font-size: 11px; padding: 5.5px 10px; text-transform: uppercase; letter-spacing: 0.5px;">
          SHIP TO <span style="font-size: 9px; font-weight: normal; text-transform: none; opacity: 0.95;">(If different from Bill To)</span>
        </div>
        <div style="padding: 8px 10px 10px; min-height: 96px;">
          <div style="font-weight: bold; font-size: 12px; color: #111827; margin-bottom: 3.5px; text-transform: uppercase;">
            {{ $data['ship_to']['name'] }}
          </div>
          <div style="font-size: 9.5px; color: #374151; line-height: 1.38; margin-bottom: 7px;">
            {!! nl2br(e($data['ship_to']['address'] ?: '—')) !!}
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 9.5px;">
            <tr>
              <td style="width: 85px; color: #4B5563; padding: 2px 0;">GSTIN</td>
              <td style="width: 10px; color: #4B5563; padding: 2px 0;">:</td>
              <td style="color: #111827; font-weight: bold; padding: 2px 0;">{{ $data['ship_to']['gstin'] ?: 'Unregistered' }}</td>
            </tr>
            @if(!empty($data['ship_to']['pan']))
            <tr>
              <td style="color: #4B5563; padding: 2px 0;">PAN Number</td>
              <td style="color: #4B5563; padding: 2px 0;">:</td>
              <td style="color: #111827; font-weight: bold; padding: 2px 0;">{{ $data['ship_to']['pan'] }}</td>
            </tr>
            @endif
            <tr>
              <td style="color: #4B5563; padding: 2px 0;">Place of Supply</td>
              <td style="color: #4B5563; padding: 2px 0;">:</td>
              <td style="color: #111827; font-weight: bold; padding: 2px 0;">{{ $data['ship_to']['state'] ?: ($data['place_of_supply'] ?: '—') }}</td>
            </tr>
          </table>
        </div>
      </div>
    </td>
  </tr>
</table>
