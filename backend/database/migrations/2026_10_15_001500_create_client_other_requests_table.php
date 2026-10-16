<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('client_other_requests', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('client_profile_id');
            $table->unsignedBigInteger('submitted_by');
            $table->string('request_type', 60);
            $table->string('document_type', 40)->nullable();
            $table->string('document_number', 80)->nullable();
            $table->string('subject', 200);
            $table->text('request_details');
            $table->text('please_specify')->nullable();
            $table->string('attachment_path', 500)->nullable();
            $table->string('status', 30)->default('pending');
            $table->text('admin_remarks')->nullable();
            $table->timestamps();

            $table->foreign('client_profile_id')->references('id')->on('client_profiles')->cascadeOnDelete();
            $table->foreign('submitted_by')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_other_requests');
    }
};
