<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('client_additional_infos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_profile_id')->constrained()->cascadeOnDelete();
            $table->string('information', 255);
            $table->text('remarks');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_additional_infos');
    }
};
