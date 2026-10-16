<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hsn_sac_codes', function (Blueprint $table) {
            $table->boolean('is_active')->default(true)->after('code_length');
        });
    }

    public function down(): void
    {
        Schema::table('hsn_sac_codes', function (Blueprint $table) {
            $table->dropColumn('is_active');
        });
    }
};
