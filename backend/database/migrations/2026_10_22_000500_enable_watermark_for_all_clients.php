<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Watermark is ON by default for every client. Existing clients were created with it
        // OFF (the old default), so switch them on too; admins can still turn it off per client.
        DB::table('client_profiles')->update(['watermark_enabled' => true]);

        // A watermark with no text would print nothing, so give those clients the default text.
        DB::table('client_profiles')
            ->where(fn ($q) => $q->whereNull('watermark_text')->orWhere('watermark_text', ''))
            ->update(['watermark_text' => 'www.abkhanassociates.com']);

        if (Schema::hasTable('client_document_settings')) {
            DB::table('client_document_settings')->update(['watermark_applies' => true]);
        }
    }

    public function down(): void
    {
        // The previous per-client choices were not recorded, so there is nothing to restore.
    }
};
