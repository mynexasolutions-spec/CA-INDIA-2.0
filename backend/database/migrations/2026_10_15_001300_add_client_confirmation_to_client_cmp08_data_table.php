<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('client_cmp08_data', function (Blueprint $table) {
            $table->timestamp('client_confirmed_at')->nullable()->after('remarks');
            $table->unsignedBigInteger('client_confirmed_by')->nullable()->after('client_confirmed_at');
        });
    }

    public function down(): void
    {
        Schema::table('client_cmp08_data', function (Blueprint $table) {
            $table->dropColumn(['client_confirmed_at', 'client_confirmed_by']);
        });
    }
};
