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
        Schema::create('flows', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->onDelete('cascade');
            $table->string('name');
            $table->text('description')->nullable();
            $table->json('keyword_triggers')->nullable();
            $table->json('flow_definition');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            
            $table->index('organization_id');
            $table->index('is_active');
        });
        
        Schema::create('flow_states', function (Blueprint $table) {
            $table->foreignId('contact_id')->constrained()->onDelete('cascade');
            $table->foreignId('flow_id')->constrained()->onDelete('cascade');
            $table->string('current_node_id', 100)->nullable();
            $table->json('variables')->nullable();
            $table->boolean('completed')->default(false);
            $table->boolean('awaiting_input')->default(false);
            $table->integer('engagement_score')->default(50);
            $table->string('user_sentiment', 50)->nullable();
            $table->timestamp('last_interaction')->useCurrent();
            $table->timestamps();
            
            $table->primary(['contact_id', 'flow_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('flow_states');
        Schema::dropIfExists('flows');
    }
};
