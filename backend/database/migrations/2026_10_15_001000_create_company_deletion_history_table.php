<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('company_deletion_history', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('client_profile_id');
            $table->string('company_name', 255);
            $table->string('gstin', 20)->nullable();
            $table->string('pan', 12)->nullable();
            $table->unsignedBigInteger('deleted_by_user_id')->nullable();
            $table->string('deleted_by_name', 255)->nullable();
            $table->string('reason', 255)->nullable();
            $table->text('remarks')->nullable();
            $table->timestamp('deleted_at_time')->useCurrent();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('company_deletion_history');
    }
};
