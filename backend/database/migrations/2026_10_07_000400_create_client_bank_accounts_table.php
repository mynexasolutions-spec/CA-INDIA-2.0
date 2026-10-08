<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('client_bank_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_profile_id')->constrained('client_profiles')->cascadeOnDelete();
            $table->string('bank_name');
            $table->string('account_holder_name');
            $table->string('account_number');
            $table->string('ifsc_code');
            $table->string('branch')->nullable();
            $table->string('account_type')->default('Current Account');
            $table->boolean('is_primary')->default(false);
            $table->string('status')->default('Active');
            $table->text('remarks')->nullable();
            $table->timestamps();
        });

        // Migrate existing bank accounts from client_profiles into client_bank_accounts (only with real account number)
        $profiles = DB::table('client_profiles')->get();
        foreach ($profiles as $p) {
            if (!empty($p->bank_account)) {
                DB::table('client_bank_accounts')->insert([
                    'client_profile_id' => $p->id,
                    'bank_name' => $p->bank_name ?: '',
                    'account_holder_name' => $p->account_holder_name ?: ($p->client_name ?: ''),
                    'account_number' => $p->bank_account,
                    'ifsc_code' => $p->bank_ifsc ?: '',
                    'branch' => $p->bank_branch,
                    'account_type' => $p->account_type ?: 'Current Account',
                    'is_primary' => true,
                    'status' => 'Active',
                    'remarks' => 'Primary settlement account',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('client_bank_accounts');
    }
};
