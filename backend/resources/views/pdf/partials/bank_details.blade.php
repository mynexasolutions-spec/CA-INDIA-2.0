<div style="border: 1px solid #D1D5DB; margin-bottom: 10px;">
  <div style="background-color: {{ $theme['primary'] }}; color: #FFFFFF; font-size: 10.5px; font-weight: bold; padding: 5px 8px; letter-spacing: 0.5px; text-transform: uppercase;">
    BANK DETAILS
  </div>
  <div style="padding: 6px 8px;">
    <table style="width: 100%; border-collapse: collapse; font-size: 9.5px;">
      <tr>
        <td style="width: 80px; color: #4B5563; padding: 2.5px 0;">Name</td>
        <td style="width: 10px; color: #4B5563; padding: 2.5px 0;">:</td>
        <td style="color: #111827; font-weight: bold; padding: 2.5px 0;">{{ $data['bank']['account_name'] ?: $data['bank']['name'] }}</td>
      </tr>
      <tr>
        <td style="color: #4B5563; padding: 2.5px 0;">IFSC Code</td>
        <td style="width: 10px; color: #4B5563; padding: 2.5px 0;">:</td>
        <td style="color: #111827; font-weight: bold; padding: 2.5px 0;">{{ $data['bank']['ifsc'] ?: '—' }}</td>
      </tr>
      <tr>
        <td style="color: #4B5563; padding: 2.5px 0;">Account No.</td>
        <td style="width: 10px; color: #4B5563; padding: 2.5px 0;">:</td>
        <td style="color: #111827; font-weight: bold; padding: 2.5px 0;">{{ $data['bank']['account_no'] ?: '—' }}</td>
      </tr>
      <tr>
        <td style="color: #4B5563; padding: 2.5px 0;">Bank</td>
        <td style="width: 10px; color: #4B5563; padding: 2.5px 0;">:</td>
        <td style="color: #111827; padding: 2.5px 0;">{{ $data['bank']['name'] }}{{ $data['bank']['branch'] ? ' ,' . $data['bank']['branch'] : '' }}</td>
      </tr>
    </table>
  </div>
</div>
