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
        Schema::create('messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('contact_id')->constrained()->onDelete('cascade');
            $table->foreignId('channel_id')->nullable()->constrained()->onDelete('set null');
            $table->text('content')->nullable();
            $table->enum('type', ['inbound', 'outbound_bot', 'outbound_agent', 'outbound_flow'])->default('inbound');
            $table->string('message_id')->nullable();
            $table->enum('media_type', ['text', 'image', 'video', 'audio', 'document', 'voice'])->nullable();
            $table->text('media_url')->nullable();
            $table->string('media_filename')->nullable();
            $table->string('media_mimetype', 100)->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->text('error_message')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('created_at')->useCurrent();
            
            $table->index(['contact_id', 'created_at']);
            $table->index('channel_id');
            $table->index('type');
            $table->index('read_at');
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('messages');
    }
};
