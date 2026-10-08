<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('client_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_profile_id')->unique()->constrained('client_profiles')->cascadeOnDelete();
            $table->string('status', 20)->default('active'); // active, inactive
            $table->date('from_date');
            $table->date('to_date')->nullable();
            $table->decimal('total_fees', 12, 2)->nullable();
            $table->decimal('amount_paid', 12, 2)->nullable();
            $table->decimal('amount_receivable', 12, 2)->nullable();
            $table->decimal('outstanding', 12, 2)->nullable();
            $table->timestamps();
        });

        // Backfill existing clients to status=active, from_date=created_at date, to_date=null, fees=null
        $clients = DB::table('client_profiles')->select('id', 'created_at')->get();
        $now = now();
        foreach ($clients as $client) {
            $fromDate = $client->created_at ? substr((string) $client->created_at, 0, 10) : $now->toDateString();
            DB::table('client_subscriptions')->insertOrIgnore([
                'client_profile_id' => $client->id,
                'status' => 'active',
                'from_date' => $fromDate,
                'to_date' => null,
                'total_fees' => null,
                'amount_paid' => null,
                'amount_receivable' => null,
                'outstanding' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('client_subscriptions');
    }
};
