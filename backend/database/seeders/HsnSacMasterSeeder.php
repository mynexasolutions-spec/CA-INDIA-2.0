<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Imports 21,935 HSN codes and 681 SAC codes from the master data JSON file.
 * Uses upsert on (type, code) so re-running this seeder is safe — existing
 * manually-added records are updated with the authoritative description but
 * no records are deleted.
 */
class HsnSacMasterSeeder extends Seeder
{
    public function run(): void
    {
        $path = database_path('seeders/data/hsn_sac_master.json');

        if (! file_exists($path)) {
            $this->command->error("Data file not found: {$path}");
            return;
        }

        $records = json_decode(file_get_contents($path), true);
        $total   = count($records);
        $now     = now()->toDateTimeString();

        $this->command->info("Importing {$total} HSN/SAC master records…");

        // Add timestamps to every record
        $records = array_map(fn ($r) => array_merge($r, [
            'created_at' => $now,
            'updated_at' => $now,
        ]), $records);

        // Chunk to avoid hitting SQLite/MySQL parameter limits
        $chunks    = array_chunk($records, 500);
        $imported  = 0;

        foreach ($chunks as $chunk) {
            DB::table('hsn_sac_codes')->upsert(
                $chunk,
                ['type', 'code'],                          // unique keys
                ['description', 'code_length', 'updated_at'] // columns to update on conflict
            );
            $imported += count($chunk);
            $this->command->getOutput()->write('.');
        }

        $this->command->newLine();
        $this->command->info("Done. {$imported} records upserted.");
        $this->command->info('HSN: '.DB::table('hsn_sac_codes')->where('type', 'hsn')->count());
        $this->command->info('SAC: '.DB::table('hsn_sac_codes')->where('type', 'sac')->count());
    }
}
