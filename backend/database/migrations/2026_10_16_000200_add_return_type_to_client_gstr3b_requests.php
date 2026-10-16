<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * The request flow (Admin initiates -> client accepts / rejects, or client submits -> Admin
     * rejects) is shared by GSTR-3B and CMP-08. The table keeps its name; this column says which
     * return a row is for. Existing rows are all GSTR-3B.
     */
    public function up(): void
    {
        Schema::table('client_gstr3b_requests', function (Blueprint $table) {
            $table->string('return_type', 10)->default('GSTR3B')->after('client_profile_id');
            $table->index(['client_profile_id', 'return_type', 'tax_period'], 'gst_requests_client_return_period_index');
        });
    }

    public function down(): void
    {
        Schema::table('client_gstr3b_requests', function (Blueprint $table) {
            $table->dropIndex('gst_requests_client_return_period_index');
            $table->dropColumn('return_type');
        });
    }
};
