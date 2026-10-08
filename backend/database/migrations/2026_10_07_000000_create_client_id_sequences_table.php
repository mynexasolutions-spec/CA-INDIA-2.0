<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('client_id_sequences', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->unsignedBigInteger('last_number')->default(0);
            $table->timestamps();
        });

        // Backfill existing client_profiles client_code
        $clients = DB::table('client_profiles')->orderBy('id', 'asc')->get();
        $maxNum = 0;

        foreach ($clients as $client) {
            $code = $client->client_code;
            $num = null;

            if ($code && preg_match('/^CL-(\d+)$/i', trim($code), $m)) {
                $num = (int) $m[1];
            }

            if ($num === null) {
                // If code was NULL or non-standard, assign sequential by id
                $maxNum++;
                $num = $maxNum;
            } else {
                if ($num > $maxNum) {
                    $maxNum = $num;
                }
            }

            $formatted = 'CL-' . ($num < 1000 ? str_pad((string) $num, 3, '0', STR_PAD_LEFT) : (string) $num);
            DB::table('client_profiles')->where('id', $client->id)->update(['client_code' => $formatted]);
        }

        DB::table('client_id_sequences')->insert([
            'name' => 'clients',
            'last_number' => $maxNum,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('client_id_sequences');
    }
};
