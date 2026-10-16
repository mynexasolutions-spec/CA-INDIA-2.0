<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('client_requests', function (Blueprint $table) {
            $table->id();
            $table->string('request_id', 30)->unique(); // REQ-2026-001
            $table->unsignedBigInteger('client_profile_id');
            $table->string('request_type', 50); // profile_update, document_change, bank_details, invoice_setting, invoice_amendment, other
            $table->string('subject', 255);
            $table->text('description')->nullable();
            $table->json('update_details')->nullable(); // [{field_name, existing_value, requested_value}]
            $table->json('attachments')->nullable();    // [{name, size, url}]
            $table->text('client_remarks')->nullable();
            $table->enum('status', ['pending','completed','rejected'])->default('pending');
            $table->text('rejection_reason')->nullable();
            $table->unsignedBigInteger('submitted_by_user_id')->nullable();
            $table->unsignedBigInteger('reviewed_by_user_id')->nullable();
            $table->timestamps();
            $table->foreign('client_profile_id')->references('id')->on('client_profiles')->onDelete('cascade');
        });
    }

    public function down(): void { Schema::dropIfExists('client_requests'); }
};
