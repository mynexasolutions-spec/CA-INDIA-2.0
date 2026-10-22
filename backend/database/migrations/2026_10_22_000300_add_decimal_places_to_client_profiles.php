<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Money columns that must be able to hold up to 6 decimal places. */
    private const DOCUMENT_COLUMNS = [
        'discount_total', 'taxable_amount', 'cgst_amount', 'sgst_amount', 'igst_amount',
        'total_amount', 'round_off', 'grand_total', 'tds_tcs_amount',
    ];

    private const LINE_COLUMNS = [
        'rate', 'discount_amount', 'taxable_amount', 'cgst_amount', 'sgst_amount', 'igst_amount', 'total_amount',
    ];

    public function up(): void
    {
        // The per-document-type decimal setting itself lives on client_document_settings
        // (see 2026_10_22_000400). This migration only makes the money columns wide enough.
        // SQLite stores decimals at full precision whatever the declared scale, so only
        // MySQL/MariaDB/Postgres need the columns widened (a no-op on SQLite).
        if (Schema::getConnection()->getDriverName() === 'sqlite') {
            return;
        }

        Schema::table('commercial_documents', function (Blueprint $table) {
            foreach (self::DOCUMENT_COLUMNS as $col) {
                if (Schema::hasColumn('commercial_documents', $col)) {
                    $table->decimal($col, 18, 6)->nullable()->default(0)->change();
                }
            }
        });
        Schema::table('document_line_items', function (Blueprint $table) {
            foreach (self::LINE_COLUMNS as $col) {
                if (Schema::hasColumn('document_line_items', $col)) {
                    $table->decimal($col, 18, 6)->nullable()->default(0)->change();
                }
            }
        });
    }

    public function down(): void
    {
        // Widened decimal columns are intentionally left as they are.
    }
};
