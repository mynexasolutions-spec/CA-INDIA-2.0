<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_payment_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('commercial_document_id');
            $table->unsignedBigInteger('client_profile_id');
            $table->string('action', 30); // 'mark_paid' | 'unmark_paid'
            $table->date('paid_on')->nullable();
            $table->string('payment_time', 10)->nullable(); // e.g. "02:35 PM"
            $table->string('payment_mode', 30)->nullable(); // UPI, Cash, Bank Transfer, Cheque, Others
            $table->string('reference_number', 120)->nullable(); // UPI ID / UTR / Cheque No.
            $table->string('received_by', 200)->nullable();
            $table->decimal('paid_amount', 14, 2)->nullable();
            $table->text('remarks')->nullable();
            $table->text('unmark_reason')->nullable();
            $table->unsignedBigInteger('recorded_by')->nullable();
            $table->timestamps();

            $table->index('commercial_document_id');
            $table->index('client_profile_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_payment_logs');
    }
};
