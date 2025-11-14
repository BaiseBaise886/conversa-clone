<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\WhatsAppService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class WebhookController extends Controller
{
    protected WhatsAppService $whatsappService;

    public function __construct(WhatsAppService $whatsappService)
    {
        $this->whatsappService = $whatsappService;
    }

    /**
     * Handle incoming WhatsApp webhook
     * 
     * This endpoint receives messages from the WhatsApp Web API service
     */
    public function handleWhatsApp(Request $request)
    {
        try {
            $data = $request->all();
            
            Log::info('WhatsApp webhook received', ['data' => $data]);

            // Handle different webhook events
            $event = $data['event'] ?? 'message';

            switch ($event) {
                case 'message':
                    $this->whatsappService->handleIncomingMessage($data);
                    break;

                case 'qr':
                    // QR code event - channel is waiting for scan
                    Log::info('QR code event', ['channel_id' => $data['channel_id'] ?? null]);
                    break;

                case 'ready':
                    // Channel is connected
                    if (isset($data['channel_id'])) {
                        $channel = \App\Models\Channel::find($data['channel_id']);
                        if ($channel) {
                            $channel->update([
                                'status' => 'connected',
                                'qr_code' => null,
                            ]);
                        }
                    }
                    break;

                case 'disconnected':
                    // Channel disconnected
                    if (isset($data['channel_id'])) {
                        $channel = \App\Models\Channel::find($data['channel_id']);
                        if ($channel) {
                            $channel->update(['status' => 'disconnected']);
                        }
                    }
                    break;

                default:
                    Log::warning('Unknown webhook event', ['event' => $event]);
            }

            return response()->json(['success' => true]);
        } catch (\Exception $e) {
            Log::error('Webhook processing failed: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
