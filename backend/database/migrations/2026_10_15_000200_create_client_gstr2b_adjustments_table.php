<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('client_gstr2b_adjustments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('client_profile_id');
            $table->string('tax_period', 10);   // 2026-04 or 2026-Q1
            $table->string('financial_year', 10);
            $table->string('from_previous_period', 10)->nullable();
            $table->decimal('prev_igst', 14, 2)->default(0);
            $table->decimal('prev_cgst', 14, 2)->default(0);
            $table->decimal('prev_sgst', 14, 2)->default(0);
            $table->decimal('adj_igst', 14, 2)->default(0);
            $table->decimal('adj_cgst', 14, 2)->default(0);
            $table->decimal('adj_sgst', 14, 2)->default(0);
            $table->string('adjustment_reason')->nullable();
            $table->text('remarks')->nullable();
            $table->unsignedBigInteger('adjusted_by')->nullable();
            $table->timestamps();
            $table->unique(['client_profile_id', 'tax_period']);
        });
    }
    public function down(): void { Schema::dropIfExists('client_gstr2b_adjustments'); }
};
