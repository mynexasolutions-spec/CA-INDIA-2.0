<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Line-item descriptions may now be up to 5,000 characters (was a 255-char string).
        Schema::table('document_line_items', function (Blueprint $table) {
            $table->text('description')->change();
        });
    }

    public function down(): void
    {
        Schema::table('document_line_items', function (Blueprint $table) {
            $table->string('description')->change();
        });
    }
};
