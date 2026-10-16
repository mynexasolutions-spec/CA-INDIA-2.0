<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('client_amendment_requests', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('client_profile_id');
            $table->unsignedBigInteger('commercial_document_id')->nullable();
            $table->unsignedBigInteger('submitted_by');
            $table->string('document_type', 40);
            $table->string('bill_number', 80);
            $table->date('document_date')->nullable();
            $table->string('customer_name', 200)->nullable();
            $table->string('gstin', 20)->nullable();
            $table->decimal('original_amount', 14, 2)->nullable();
            $table->string('reason', 120);
            $table->text('remarks')->nullable();
            $table->string('status', 30)->default('pending');
            $table->text('admin_remarks')->nullable();
            $table->unsignedBigInteger('amendment_document_id')->nullable();
            $table->timestamps();

            $table->foreign('client_profile_id')->references('id')->on('client_profiles')->cascadeOnDelete();
            $table->foreign('submitted_by')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_amendment_requests');
    }
};
