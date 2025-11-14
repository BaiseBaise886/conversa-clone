<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('channels', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->onDelete('cascade');
            $table->enum('type', ['whatsapp', 'instagram', 'telegram']);
            $table->string('name');
            $table->string('phone_number', 50)->nullable();
            $table->enum('status', ['connected', 'disconnected', 'pending_qr', 'error'])->default('disconnected');
            $table->text('qr_code')->nullable();
            $table->json('credentials')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
            
            $table->index('organization_id');
            $table->index('status');
            $table->index('type');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('channels');
    }
};
