<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /** Settings -> Admin Security: how this admin logs in and how they open the Clients module. */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('login_2fa_enabled')->default(false);
            $table->string('clients_verify_method', 12)->default('secondary'); // secondary | 2fa
            $table->string('clients_secondary_password')->nullable();          // hashed
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['login_2fa_enabled', 'clients_verify_method', 'clients_secondary_password']);
        });
    }
};
