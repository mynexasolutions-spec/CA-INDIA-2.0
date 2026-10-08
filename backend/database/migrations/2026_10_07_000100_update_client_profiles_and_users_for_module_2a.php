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
            $table->date('applicable_from')->nullable()->after('client_name');
            $table->string('contact_person_name')->nullable()->after('client_name');
            $table->string('designation')->nullable()->after('contact_person_name');
            $table->string('gender')->nullable()->after('designation');
            $table->text('address_line_1')->nullable()->after('address');
            $table->text('address_line_2')->nullable()->after('address_line_1');
            $table->string('registration_type')->nullable()->after('gstin');
            $table->boolean('comm_same_as_above')->default(true)->after('country');
            $table->text('comm_address_line_1')->nullable()->after('comm_same_as_above');
            $table->text('comm_address_line_2')->nullable()->after('comm_address_line_1');
            $table->string('comm_city')->nullable()->after('comm_address_line_2');
            $table->string('comm_state')->nullable()->after('comm_city');
            $table->string('comm_state_code', 2)->nullable()->after('comm_state');
            $table->string('comm_pincode', 10)->nullable()->after('comm_state_code');
            $table->string('comm_country')->default('India')->after('comm_pincode');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('password_updated_at')->nullable()->after('password');
            $table->string('password_updated_by')->nullable()->after('password_updated_at');
        });

        // Backfill existing client profiles
        $clients = DB::table('client_profiles')->get();
        foreach ($clients as $c) {
            $regType = null;
            if ($c->dealer_type) {
                $regType = strtolower($c->dealer_type) === 'composition' ? 'Composition' : 'Regular';
            } elseif ($c->has_gst) {
                $regType = 'Regular';
            }

            DB::table('client_profiles')->where('id', $c->id)->update([
                'applicable_from' => '2026-04-01',
                'address_line_1' => $c->address ?: null,
                'contact_person_name' => $c->client_name ?: null,
                'registration_type' => $regType,
                'comm_same_as_above' => 1,
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['password_updated_at', 'password_updated_by']);
        });

        Schema::table('client_profiles', function (Blueprint $table) {
            $table->dropColumn([
                'applicable_from',
                'contact_person_name',
                'designation',
                'gender',
                'address_line_1',
                'address_line_2',
                'registration_type',
                'comm_same_as_above',
                'comm_address_line_1',
                'comm_address_line_2',
                'comm_city',
                'comm_state',
                'comm_state_code',
                'comm_pincode',
                'comm_country',
            ]);
        });
    }
};
