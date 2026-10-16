<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('client_gstr2b_projected_invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_profile_id')->constrained()->cascadeOnDelete();
            $table->string('financial_year', 10);
            $table->string('tax_period', 10);
            $table->date('invoice_date')->nullable();
            $table->string('invoice_number')->nullable();
            $table->string('party_name')->nullable();
            $table->string('gstin', 20)->nullable();
            $table->decimal('taxable_value', 15, 2)->default(0);
            $table->decimal('igst', 15, 2)->default(0);
            $table->decimal('cgst', 15, 2)->default(0);
            $table->decimal('sgst_utgst', 15, 2)->default(0);
            $table->decimal('itc_amount', 15, 2)->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_gstr2b_projected_invoices');
    }
};
