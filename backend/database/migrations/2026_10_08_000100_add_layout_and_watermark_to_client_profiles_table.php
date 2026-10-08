<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('client_profiles', function (Blueprint $table) {
            if (! Schema::hasColumn('client_profiles', 'default_layout_id')) {
                $table->unsignedTinyInteger('default_layout_id')->default(1);
            }
            if (! Schema::hasColumn('client_profiles', 'default_colour_scheme')) {
                $table->string('default_colour_scheme', 50)->default('slate_blue');
            }
            if (! Schema::hasColumn('client_profiles', 'layout_applied_from')) {
                $table->date('layout_applied_from')->nullable();
            }
            if (! Schema::hasColumn('client_profiles', 'layout_updated_at')) {
                $table->timestamp('layout_updated_at')->nullable();
            }
            if (! Schema::hasColumn('client_profiles', 'watermark_enabled')) {
                $table->boolean('watermark_enabled')->default(false);
            }
            if (! Schema::hasColumn('client_profiles', 'watermark_text')) {
                $table->string('watermark_text', 255)->nullable();
            }
            if (! Schema::hasColumn('client_profiles', 'gst_reminder_enabled')) {
                $table->boolean('gst_reminder_enabled')->default(false);
            }
        });

        // Backfill existing clients to Layout 1 + Slate Blue
        DB::table('client_profiles')
            ->whereNull('default_layout_id')
            ->orWhere('default_layout_id', 0)
            ->update([
                'default_layout_id' => 1,
            ]);

        DB::table('client_profiles')
            ->whereNull('default_colour_scheme')
            ->orWhere('default_colour_scheme', '')
            ->update([
                'default_colour_scheme' => 'slate_blue',
            ]);

        // (5) layout_updated_at is explicitly null on backfill for existing rows
        DB::table('client_profiles')->update([
            'layout_updated_at' => null,
        ]);
    }

    public function down(): void
    {
        Schema::table('client_profiles', function (Blueprint $table) {
            $cols = [];
            foreach ([
                'default_layout_id',
                'default_colour_scheme',
                'layout_applied_from',
                'layout_updated_at',
                'watermark_enabled',
                'watermark_text',
                'gst_reminder_enabled',
            ] as $col) {
                if (Schema::hasColumn('client_profiles', $col)) {
                    $cols[] = $col;
                }
            }

            if (! empty($cols)) {
                $table->dropColumn($cols);
            }
        });
    }
};
