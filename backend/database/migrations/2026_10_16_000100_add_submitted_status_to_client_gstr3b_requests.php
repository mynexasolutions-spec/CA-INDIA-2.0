<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * A GSTR-3B request raised by the client from the Client Portal starts as "Submitted"
     * (awaiting the Admin). "pending_client" stays for requests the Admin initiates on the
     * client's behalf (awaiting the client's Accept / Reject).
     */
    public function up(): void
    {
        Schema::table('client_gstr3b_requests', function (Blueprint $table) {
            $table->enum('status', ['pending_client', 'submitted', 'accepted', 'rejected', 'completed'])
                ->default('pending_client')
                ->change();
        });
    }

    public function down(): void
    {
        Schema::table('client_gstr3b_requests', function (Blueprint $table) {
            $table->enum('status', ['pending_client', 'accepted', 'rejected', 'completed'])
                ->default('pending_client')
                ->change();
        });
    }
};
