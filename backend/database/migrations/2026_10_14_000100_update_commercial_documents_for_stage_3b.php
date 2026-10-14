<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('commercial_documents', function (Blueprint $table) {
            if (! Schema::hasColumn('commercial_documents', 'deleted_at')) {
                $table->softDeletes()->after('status')->index();
            }

            if (! Schema::hasColumn('commercial_documents', 'cancelled_by')) {
                // On SQLite, adding a foreign key constraint via ALTER TABLE can force a table rebuild
                // or fail foreign key checks. Add as plain nullable column on SQLite to avoid table rebuild;
                // use constrained foreignId on MySQL.
                if (DB::getDriverName() === 'sqlite') {
                    $table->unsignedBigInteger('cancelled_by')->nullable()->after('cancellation_reason');
                } else {
                    $table->foreignId('cancelled_by')->nullable()->after('cancellation_reason')
                        ->constrained('users')->nullOnDelete();
                }
            }

            // Drop composite unique index and replace with plain index for number reuse support
            $table->dropUnique('commercial_documents_client_profile_id_type_number_unique');
            $table->index(['client_profile_id', 'type', 'number'], 'commercial_documents_client_profile_id_type_number_index');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // On SQLite, an index on a column must be dropped before dropping the column itself.
        Schema::table('commercial_documents', function (Blueprint $table) {
            $table->dropIndex('commercial_documents_client_profile_id_type_number_index');

            if (Schema::hasColumn('commercial_documents', 'deleted_at')) {
                $table->dropIndex('commercial_documents_deleted_at_index');
            }
        });

        Schema::table('commercial_documents', function (Blueprint $table) {
            // Guard against duplicates: only re-add unique index if no duplicates exist
            $hasDuplicates = DB::table('commercial_documents')
                ->select('client_profile_id', 'type', 'number')
                ->groupBy('client_profile_id', 'type', 'number')
                ->havingRaw('COUNT(*) > 1')
                ->exists();

            if (! $hasDuplicates) {
                $table->unique(['client_profile_id', 'type', 'number'], 'commercial_documents_client_profile_id_type_number_unique');
            }

            if (Schema::hasColumn('commercial_documents', 'cancelled_by')) {
                if (DB::getDriverName() !== 'sqlite') {
                    $table->dropForeign(['cancelled_by']);
                }
                $table->dropColumn('cancelled_by');
            }

            if (Schema::hasColumn('commercial_documents', 'deleted_at')) {
                $table->dropSoftDeletes();
            }
        });
    }
};
