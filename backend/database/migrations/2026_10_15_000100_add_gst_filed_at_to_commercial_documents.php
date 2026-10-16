<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('commercial_documents', function (Blueprint $table) {
            if (! Schema::hasColumn('commercial_documents', 'gst_filed_at')) {
                $table->datetime('gst_filed_at')->nullable()->after('status');
            }
            if (! Schema::hasColumn('commercial_documents', 'gst_return_type')) {
                $table->string('gst_return_type')->nullable()->after('gst_filed_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('commercial_documents', function (Blueprint $table) {
            $table->dropColumn(['gst_filed_at', 'gst_return_type']);
        });
    }
};
