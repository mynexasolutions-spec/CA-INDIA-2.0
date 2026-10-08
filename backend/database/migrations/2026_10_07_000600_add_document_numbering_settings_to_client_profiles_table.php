<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('client_profiles', function (Blueprint $table) {
            if (! Schema::hasColumn('client_profiles', 'delivery_challan_prefix')) {
                $table->string('delivery_challan_prefix', 20)->default('DC')->after('quotation_next_number');
            }
            if (! Schema::hasColumn('client_profiles', 'delivery_challan_next_number')) {
                $table->unsignedInteger('delivery_challan_next_number')->default(1)->after('delivery_challan_prefix');
            }
            if (! Schema::hasColumn('client_profiles', 'document_numbering_settings')) {
                $table->json('document_numbering_settings')->nullable()->after('delivery_challan_next_number');
            }
        });
    }

    public function down(): void
    {
        Schema::table('client_profiles', function (Blueprint $table) {
            $cols = [];
            if (Schema::hasColumn('client_profiles', 'delivery_challan_prefix')) {
                $cols[] = 'delivery_challan_prefix';
            }
            if (Schema::hasColumn('client_profiles', 'delivery_challan_next_number')) {
                $cols[] = 'delivery_challan_next_number';
            }
            if (Schema::hasColumn('client_profiles', 'document_numbering_settings')) {
                $cols[] = 'document_numbering_settings';
            }
            if (! empty($cols)) {
                $table->dropColumn($cols);
            }
        });
    }
};
