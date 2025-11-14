<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ChannelController;
use App\Http\Controllers\Api\ContactController;
use App\Http\Controllers\Api\FlowController;
use App\Http\Controllers\Api\MessageController;
use App\Http\Controllers\Api\WebhookController;
use Illuminate\Support\Facades\Route;

// Health check endpoint
Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'timestamp' => now()->toISOString(),
        'environment' => config('app.env'),
        'version' => '1.0.0',
    ]);
});

// Public authentication routes
Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/register', [AuthController::class, 'register']);
});

// Webhook routes (no auth required, but should be validated)
Route::post('/webhooks/whatsapp', [WebhookController::class, 'handleWhatsApp']);

// Protected API routes (require authentication)
Route::middleware('auth:sanctum')->group(function () {
    // Auth routes
    Route::prefix('auth')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);
    });

    // Resource routes
    Route::apiResource('contacts', ContactController::class);
    Route::apiResource('channels', ChannelController::class);
    Route::apiResource('messages', MessageController::class);
    Route::apiResource('flows', FlowController::class);

    // Additional routes
    Route::post('/channels/{channel}/connect', [ChannelController::class, 'connect']);
    Route::post('/channels/{channel}/disconnect', [ChannelController::class, 'disconnect']);
    Route::get('/channels/{channel}/qr', [ChannelController::class, 'getQR']);
});
