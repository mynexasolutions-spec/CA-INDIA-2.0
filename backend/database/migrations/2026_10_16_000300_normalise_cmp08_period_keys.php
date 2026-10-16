<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    /**
     * CMP-08 used its own period key ("2026-27-Q1") while the billing lock, the client's
     * filing requests and the GST period grid use "2026-Q1" (year = FY start year,
     * Q4 = Jan-Mar of the following year). Everything now uses "2026-Q1".
     *
     * If a row already exists under the new key for the same client, that row is kept and the
     * legacy duplicate is dropped (the unique key (client, period) would otherwise clash).
     */
    public function up(): void
    {
        $this->convert('client_cmp08_data', null, fn (string $p) => substr($p, 0, 4).'-'.substr($p, 8), '____-__-Q_');
        $this->convert('client_gst_returns', 'CMP08', fn (string $p) => substr($p, 0, 4).'-'.substr($p, 8), '____-__-Q_');
    }

    public function down(): void
    {
        // Best effort: "2026-Q1" -> "2026-27-Q1".
        $legacy = fn (string $p) => substr($p, 0, 4).'-'.substr((string) ((int) substr($p, 0, 4) + 1), -2).'-'.substr($p, 5);
        $this->convert('client_cmp08_data', null, $legacy, '____-Q_');
        $this->convert('client_gst_returns', 'CMP08', $legacy, '____-Q_');
    }

    private function convert(string $table, ?string $returnType, callable $map, string $like): void
    {
        $q = DB::table($table)->where('tax_period', 'like', $like);
        if ($returnType) {
            $q->where('return_type', $returnType);
        }

        foreach ($q->get() as $row) {
            $new = $map($row->tax_period);
            $clash = DB::table($table)
                ->where('client_profile_id', $row->client_profile_id)
                ->where('tax_period', $new)
                ->when($returnType, fn ($w) => $w->where('return_type', $returnType))
                ->exists();

            if ($clash) {
                DB::table($table)->where('id', $row->id)->delete();
            } else {
                DB::table($table)->where('id', $row->id)->update(['tax_period' => $new]);
            }
        }
    }
};
