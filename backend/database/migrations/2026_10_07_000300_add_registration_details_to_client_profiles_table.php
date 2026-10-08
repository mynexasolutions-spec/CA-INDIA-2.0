<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('client_profiles', function (Blueprint $table) {
            // PAN
            $table->string('pan_status')->default('Active')->nullable();
            $table->string('name_as_per_pan')->nullable();
            $table->date('pan_allotment_date')->nullable();
            $table->boolean('pan_enabled')->default(false);

            // GST
            $table->string('gst_status')->default('Active')->nullable();
            $table->date('gst_registration_date')->nullable();
            $table->string('state_jurisdiction')->nullable();
            $table->boolean('gst_enabled')->default(false);

            // TAN
            $table->string('tan_status')->default('Active')->nullable();
            $table->date('tan_allotment_date')->nullable();
            $table->boolean('tan_enabled')->default(false);

            // CIN
            $table->date('cin_incorporation_date')->nullable();
            $table->string('cin_certificate_no')->nullable();
            $table->string('cin_incorporation_place')->nullable();
            $table->boolean('cin_enabled')->default(false);

            // UDYAM
            $table->string('udyam_enterprise_type')->default('Micro')->nullable();
            $table->date('udyam_registration_date')->nullable();
            $table->string('udyam_status')->default('Active')->nullable();
            $table->boolean('udyam_enabled')->default(false);

            // Shop Act
            $table->string('shop_act_issuing_authority')->nullable();
            $table->date('shop_act_registration_date')->nullable();
            $table->string('shop_act_status')->default('Inactive')->nullable();
            $table->boolean('shop_act_enabled')->default(false);

            // FSSAI
            $table->string('fssai_no')->nullable();
            $table->string('fssai_license_type')->default('Basic')->nullable();
            $table->date('fssai_registration_date')->nullable();
            $table->string('fssai_status')->default('Active')->nullable();
            $table->boolean('fssai_enabled')->default(false);

            // IEC
            $table->date('iec_registration_date')->nullable();
            $table->string('iec_status')->default('Inactive')->nullable();
            $table->boolean('iec_enabled')->default(false);

            // PTRC
            $table->string('ptrc_state')->default('Maharashtra')->nullable();
            $table->date('ptrc_registration_date')->nullable();
            $table->string('ptrc_status')->default('Active')->nullable();
            $table->boolean('ptrc_enabled')->default(false);

            // PTEC
            $table->string('ptec_no')->nullable();
            $table->string('ptec_state')->default('Maharashtra')->nullable();
            $table->date('ptec_registration_date')->nullable();
            $table->string('ptec_status')->default('Active')->nullable();
            $table->boolean('ptec_enabled')->default(false);

            // Portal usernames
            $table->string('tan_portal_username')->nullable();
            $table->string('it_portal_username')->nullable();
        });

        // Backfill existing clients by data presence
        $profiles = DB::table('client_profiles')->get();
        foreach ($profiles as $p) {
            $panOn = !empty(trim((string) ($p->pan ?? '')));
            $gstOn = !empty($p->has_gst) || !empty(trim((string) ($p->gstin ?? '')));
            $tanOn = !empty(trim((string) ($p->tan ?? '')));
            $cinOn = !empty(trim((string) ($p->cin ?? '')));
            $udyamOn = !empty(trim((string) ($p->udyam ?? '')));
            $shopActOn = !empty(trim((string) ($p->shop_establishment ?? '')));
            $fssaiOn = !empty(trim((string) ($p->fssai_no ?? '')));
            $iecOn = !empty(trim((string) ($p->iec ?? '')));
            $ptrcOn = !empty(trim((string) ($p->pt_reg ?? '')));
            $ptecOn = !empty(trim((string) ($p->ptec_no ?? '')));

            $updates = [
                'pan_enabled' => $panOn,
                'gst_enabled' => $gstOn,
                'tan_enabled' => $tanOn,
                'cin_enabled' => $cinOn,
                'udyam_enabled' => $udyamOn,
                'shop_act_enabled' => $shopActOn,
                'fssai_enabled' => $fssaiOn,
                'iec_enabled' => $iecOn,
                'ptrc_enabled' => $ptrcOn,
                'ptec_enabled' => $ptecOn,
            ];

            if ($gstOn && empty(trim((string) ($p->registration_type ?? '')))) {
                $dealer = strtolower(trim((string) ($p->dealer_type ?? '')));
                if ($dealer === 'composition') {
                    $updates['registration_type'] = 'Composition';
                } elseif ($dealer === 'regular') {
                    $updates['registration_type'] = 'Regular';
                }
            }

            DB::table('client_profiles')->where('id', $p->id)->update($updates);
        }
    }

    public function down(): void
    {
        Schema::table('client_profiles', function (Blueprint $table) {
            $table->dropColumn([
                'pan_status', 'name_as_per_pan', 'pan_allotment_date', 'pan_enabled',
                'gst_status', 'gst_registration_date', 'state_jurisdiction', 'gst_enabled',
                'tan_status', 'tan_allotment_date', 'tan_enabled',
                'cin_incorporation_date', 'cin_certificate_no', 'cin_incorporation_place', 'cin_enabled',
                'udyam_enterprise_type', 'udyam_registration_date', 'udyam_status', 'udyam_enabled',
                'shop_act_issuing_authority', 'shop_act_registration_date', 'shop_act_status', 'shop_act_enabled',
                'fssai_no', 'fssai_license_type', 'fssai_registration_date', 'fssai_status', 'fssai_enabled',
                'iec_registration_date', 'iec_status', 'iec_enabled',
                'ptrc_state', 'ptrc_registration_date', 'ptrc_status', 'ptrc_enabled',
                'ptec_no', 'ptec_state', 'ptec_registration_date', 'ptec_status', 'ptec_enabled',
                'tan_portal_username', 'it_portal_username',
            ]);
        });
    }
};
