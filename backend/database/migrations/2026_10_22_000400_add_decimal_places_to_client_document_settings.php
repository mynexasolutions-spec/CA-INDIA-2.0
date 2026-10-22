<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Number of decimal places (2–6) used in each document type's amounts, per client.
        Schema::table('client_document_settings', function (Blueprint $table) {
            if (! Schema::hasColumn('client_document_settings', 'decimal_places')) {
                $table->unsignedTinyInteger('decimal_places')->default(2);
            }
        });

        // An earlier draft of this feature stored a single client-wide value here.
        if (Schema::hasColumn('client_profiles', 'decimal_places')) {
            Schema::table('client_profiles', function (Blueprint $table) {
                $table->dropColumn('decimal_places');
            });
        }
    }

    public function down(): void
    {
        Schema::table('client_document_settings', function (Blueprint $table) {
            if (Schema::hasColumn('client_document_settings', 'decimal_places')) {
                $table->dropColumn('decimal_places');
            }
        });
    }
};
