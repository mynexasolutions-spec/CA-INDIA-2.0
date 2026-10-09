<div style="border: 1px solid #D1D5DB;">
  <div style="background-color: {{ $theme['primary'] }}; color: #FFFFFF; font-size: 10.5px; font-weight: bold; padding: 5px 8px; letter-spacing: 0.5px; text-transform: uppercase;">
    TERMS AND CONDITIONS
  </div>
  <div style="padding: 7px 8px 10px;">
    <ol style="margin: 0; padding-left: 15px; font-size: 9px; color: #374151; line-height: 1.5;">
      @foreach($data['terms'] as $term)
        <li style="margin-bottom: 5.5px;">{{ $term }}</li>
      @endforeach
    </ol>
  </div>
</div>
