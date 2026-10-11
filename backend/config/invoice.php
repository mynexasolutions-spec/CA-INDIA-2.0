<?php

return [
    /*
    |--------------------------------------------------------------------------
    | New Document Renderer Feature Flag
    |--------------------------------------------------------------------------
    |
    | When enabled (true), invoices and commercial documents are rendered
    | using the new modular layout system (Layout 1-4 with themes).
    | When false, the legacy pdf.invoice template is used as a fallback.
    |
    */
    'new_renderer' => env('INVOICE_NEW_RENDERER', true),
];
