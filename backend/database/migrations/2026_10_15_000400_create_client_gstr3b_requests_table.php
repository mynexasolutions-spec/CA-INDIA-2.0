<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('client_gstr3b_requests', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('client_profile_id');
            $table->string('tax_period', 10);
            $table->enum('status', ['pending_client', 'accepted', 'rejected', 'completed'])->default('pending_client');
            $table->enum('initiated_by', ['admin', 'client'])->default('admin');
            $table->unsignedBigInteger('initiated_by_user_id')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->timestamps();
            $table->foreign('client_profile_id')->references('id')->on('client_profiles')->onDelete('cascade');
        });
    }

    public function down(): void { Schema::dropIfExists('client_gstr3b_requests'); }
};
