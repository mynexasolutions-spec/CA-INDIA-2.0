<?php

namespace App\Services\Client;

use Illuminate\Support\Facades\DB;

class ClientIdService
{
    /**
     * Generate the next sequential client code in a locked transaction.
     * Guaranteed to be monotonic and non-reusable.
     * Format: CL-001, CL-002, ..., CL-999, CL-1000, etc.
     */
    public static function generateNext(): string
    {
        return DB::transaction(function () {
            $row = DB::table('client_id_sequences')
                ->where('name', 'clients')
                ->lockForUpdate()
                ->first();

            $current = $row ? (int) $row->last_number : 0;
            $next = $current + 1;

            if ($row) {
                DB::table('client_id_sequences')
                    ->where('id', $row->id)
                    ->update([
                        'last_number' => $next,
                        'updated_at' => now(),
                    ]);
            } else {
                DB::table('client_id_sequences')->insert([
                    'name' => 'clients',
                    'last_number' => $next,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            return static::formatCode($next);
        });
    }

    /**
     * Format numeric sequence into CL-NNN format.
     */
    public static function formatCode(int $number): string
    {
        return 'CL-' . ($number < 1000 ? str_pad((string) $number, 3, '0', STR_PAD_LEFT) : (string) $number);
    }
}
