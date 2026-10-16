<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('staff_client_assignments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');           // staff/admin user
            $table->unsignedBigInteger('client_profile_id');
            $table->json('module_permissions')->nullable();   // {billing:{enabled,tax_invoice,...}, gst_compliance:{...}, reports:{...}}
            $table->timestamps();
            $table->unique(['user_id', 'client_profile_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('staff_client_assignments');
    }
};
