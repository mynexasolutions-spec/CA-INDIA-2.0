<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('client_profiles', function (Blueprint $table) {
            $table->boolean('two_factor_enabled')->default(false)->after('it_portal_username');
            $table->unsignedInteger('session_timeout_minutes')->default(30)->after('two_factor_enabled');
        });

        Schema::create('client_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_profile_id')->constrained('client_profiles')->cascadeOnDelete();
            $table->text('note');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_notes');

        Schema::table('client_profiles', function (Blueprint $table) {
            $table->dropColumn(['two_factor_enabled', 'session_timeout_minutes']);
        });
    }
};
