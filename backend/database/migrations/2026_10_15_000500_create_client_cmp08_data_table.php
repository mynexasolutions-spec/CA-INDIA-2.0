<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('client_cmp08_data', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('client_profile_id');
            $table->string('tax_period', 10); // e.g. 2026-Q1
            $table->json('turnover')->nullable();
            $table->json('adjustments')->nullable();
            $table->json('payments')->nullable();
            $table->text('remarks')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
            $table->unique(['client_profile_id', 'tax_period']);
            $table->foreign('client_profile_id')->references('id')->on('client_profiles')->onDelete('cascade');
        });
    }

    public function down(): void { Schema::dropIfExists('client_cmp08_data'); }
};
