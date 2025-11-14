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
        Schema::create('contacts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->onDelete('cascade');
            $table->string('name')->nullable();
            $table->string('phone', 50)->nullable();
            $table->string('email')->nullable();
            $table->string('instagram_username')->nullable();
            $table->enum('channel_type', ['whatsapp', 'instagram', 'telegram'])->default('whatsapp');
            $table->json('tags')->nullable();
            $table->json('custom_fields')->nullable();
            $table->timestamp('last_message_at')->nullable();
            $table->text('last_message_preview')->nullable();
            $table->integer('unread_count')->default(0);
            $table->timestamp('archived_at')->nullable();
            $table->boolean('pinned')->default(false);
            $table->boolean('muted')->default(false);
            $table->timestamps();
            
            $table->index('organization_id');
            $table->index('phone');
            $table->index('email');
            $table->index('last_message_at');
            $table->index('archived_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('contacts');
    }
};
