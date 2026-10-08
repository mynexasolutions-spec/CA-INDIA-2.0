<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('client_document_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_profile_id')->constrained('client_profiles')->cascadeOnDelete();
            $table->string('document_type', 50); // tax_invoice, bill_of_supply, credit_note, debit_note, quotation, delivery_challan
            $table->unsignedTinyInteger('layout_id')->default(1);
            $table->string('colour_scheme', 50)->default('slate_blue');
            $table->boolean('watermark_applies')->default(false);
            $table->timestamps();

            $table->unique(['client_profile_id', 'document_type'], 'client_doc_settings_unique');
        });

        // Backfill 6 rows per existing client profile
        $clients = DB::table('client_profiles')->select('id')->get();
        $docTypes = [
            'tax_invoice',
            'bill_of_supply',
            'credit_note',
            'debit_note',
            'quotation',
            'delivery_challan',
        ];

        $now = now();
        foreach ($clients as $client) {
            foreach ($docTypes as $docType) {
                DB::table('client_document_settings')->insertOrIgnore([
                    'client_profile_id' => $client->id,
                    'document_type' => $docType,
                    'layout_id' => 1,
                    'colour_scheme' => 'slate_blue',
                    'watermark_applies' => false,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('client_document_settings');
    }
};
