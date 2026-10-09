<div style="text-align: right; margin-top: 46px; page-break-inside: avoid;">
  <div style="height: 50px; text-align: right; margin-bottom: 3px;">
    @if(!empty($data['seal_path']))
      <img src="{{ $data['seal_path'] }}" style="max-height: 48px; max-width: 90px; vertical-align: middle; margin-right: 6px;" alt="Seal">
    @endif
    @if(!empty($data['signature_path']))
      <img src="{{ $data['signature_path'] }}" style="max-height: 48px; max-width: 135px; vertical-align: middle;" alt="Signature">
    @endif
  </div>
  <div style="font-size: 9.5px; font-weight: bold; color: #111827; letter-spacing: 0.3px;">
    AUTHORISED SIGNATORY FOR
  </div>
  <div style="font-size: 11px; font-weight: bold; color: #111827; letter-spacing: 0.3px;">
    {{ $data['company_name'] }}
  </div>
</div>
