<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('notifications', 'link')) {
            Schema::table('notifications', function (Blueprint $table) {
                $table->string('link')->nullable()->after('type');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('notifications', 'link')) {
            Schema::table('notifications', function (Blueprint $table) {
                $table->dropColumn('link');
            });
        }
    }
};
