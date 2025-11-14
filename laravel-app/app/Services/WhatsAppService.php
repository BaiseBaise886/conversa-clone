<?php

namespace App\Services;

use App\Models\Channel;
use App\Models\Contact;
use App\Models\Message;
use Endroid\QrCode\Builder\Builder;
use Endroid\QrCode\Encoding\Encoding;
use Endroid\QrCode\ErrorCorrectionLevel;
use Endroid\QrCode\Writer\PngWriter;
use GuzzleHttp\Client as HttpClient;
use GuzzleHttp\Exception\GuzzleException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * WhatsApp Service for Laravel
 * 
 * This service provides WhatsApp integration compatible with whatsapp-web.js protocol.
 * It can work in two modes:
 * 1. Direct integration with whatsapp-web.js running as a separate Node.js service
 * 2. HTTP API mode using WhatsApp Web API services
 * 
 * Configuration (add to .env):
 * WHATSAPP_API_URL=http://localhost:3000  # URL to whatsapp-web.js API or compatible service
 * WHATSAPP_API_KEY=your_api_key          # Optional API key for authentication
 * WHATSAPP_SESSION_PATH=storage/app/whatsapp-sessions
 */
class WhatsAppService
{
    protected HttpClient $httpClient;
    protected string $apiUrl;
    protected ?string $apiKey;
    protected string $sessionPath;

    public function __construct()
    {
        $this->apiUrl = config('services.whatsapp.api_url', 'http://localhost:3000');
        $this->apiKey = config('services.whatsapp.api_key');
        $this->sessionPath = storage_path('app/whatsapp-sessions');
        
        $this->httpClient = new HttpClient([
            'base_uri' => $this->apiUrl,
            'timeout' => 30,
            'headers' => array_filter([
                'Content-Type' => 'application/json',
                'X-API-Key' => $this->apiKey,
            ]),
        ]);

        // Ensure session directory exists
        if (!is_dir($this->sessionPath)) {
            mkdir($this->sessionPath, 0755, true);
        }
    }

    /**
     * Initialize a WhatsApp channel and generate QR code
     * 
     * @param Channel $channel
     * @return array Contains 'qr_code' (base64) and 'status'
     */
    public function initializeChannel(Channel $channel): array
    {
        try {
            // Try to connect via API first
            if ($this->apiUrl !== 'http://localhost:3000') {
                return $this->initializeViaApi($channel);
            }

            // Fallback: Generate QR code for manual scanning
            return $this->generateQRCode($channel);
        } catch (\Exception $e) {
            Log::error("WhatsApp initialization failed for channel {$channel->id}: " . $e->getMessage());
            
            $channel->update([
                'status' => 'error',
                'qr_code' => null,
            ]);

            throw $e;
        }
    }

    /**
     * Initialize channel via WhatsApp Web API (whatsapp-web.js or compatible)
     */
    protected function initializeViaApi(Channel $channel): array
    {
        try {
            $response = $this->httpClient->post('/channels/initialize', [
                'json' => [
                    'channel_id' => $channel->id,
                    'organization_id' => $channel->organization_id,
                    'phone_number' => $channel->phone_number,
                ],
            ]);

            $data = json_decode($response->getBody()->getContents(), true);

            if (isset($data['qr_code'])) {
                $channel->update([
                    'status' => 'pending_qr',
                    'qr_code' => $data['qr_code'],
                ]);

                return [
                    'qr_code' => $data['qr_code'],
                    'status' => 'pending_qr',
                ];
            }

            if (isset($data['status']) && $data['status'] === 'connected') {
                $channel->update([
                    'status' => 'connected',
                    'qr_code' => null,
                ]);

                return [
                    'status' => 'connected',
                ];
            }

            throw new \Exception('Unexpected response from WhatsApp API');
        } catch (GuzzleException $e) {
            Log::error("WhatsApp API error: " . $e->getMessage());
            throw new \Exception("Could not connect to WhatsApp API. Please ensure the WhatsApp service is running.");
        }
    }

    /**
     * Generate QR code for manual WhatsApp Web connection
     */
    protected function generateQRCode(Channel $channel): array
    {
        // Generate a unique session identifier
        $sessionId = "channel-{$channel->id}-" . time();
        
        // Generate QR code data (this would be the actual WhatsApp Web URL in production)
        // For demonstration, we create a placeholder QR code
        $qrData = "whatsapp://connect?session={$sessionId}&channel={$channel->id}";
        
        // Generate QR code image
        $result = Builder::create()
            ->writer(new PngWriter())
            ->data($qrData)
            ->encoding(new Encoding('UTF-8'))
            ->errorCorrectionLevel(ErrorCorrectionLevel::High)
            ->size(300)
            ->margin(10)
            ->build();

        // Convert to base64
        $qrCodeBase64 = 'data:image/png;base64,' . base64_encode($result->getString());

        // Update channel
        $channel->update([
            'status' => 'pending_qr',
            'qr_code' => $qrCodeBase64,
            'metadata' => array_merge($channel->metadata ?? [], [
                'session_id' => $sessionId,
                'qr_generated_at' => now()->toISOString(),
            ]),
        ]);

        return [
            'qr_code' => $qrCodeBase64,
            'status' => 'pending_qr',
            'session_id' => $sessionId,
        ];
    }

    /**
     * Check channel connection status
     */
    public function checkStatus(Channel $channel): array
    {
        try {
            $response = $this->httpClient->get("/channels/{$channel->id}/status");
            $data = json_decode($response->getBody()->getContents(), true);

            // Update channel status
            if (isset($data['status'])) {
                $channel->update([
                    'status' => $data['status'],
                    'qr_code' => $data['status'] === 'connected' ? null : $channel->qr_code,
                ]);
            }

            return $data;
        } catch (GuzzleException $e) {
            Log::warning("Could not check WhatsApp status: " . $e->getMessage());
            
            return [
                'status' => $channel->status,
                'connected' => $channel->status === 'connected',
            ];
        }
    }

    /**
     * Send a text message
     */
    public function sendMessage(Contact $contact, string $message, ?Channel $channel = null): Message
    {
        if (!$channel) {
            $channel = Channel::where('organization_id', $contact->organization_id)
                ->where('type', 'whatsapp')
                ->where('status', 'connected')
                ->first();

            if (!$channel) {
                throw new \Exception('No connected WhatsApp channel found for this organization');
            }
        }

        // Create message record
        $messageRecord = Message::create([
            'contact_id' => $contact->id,
            'channel_id' => $channel->id,
            'content' => $message,
            'type' => 'outbound_agent',
            'media_type' => 'text',
        ]);

        try {
            // Try to send via API
            $response = $this->httpClient->post('/messages/send', [
                'json' => [
                    'channel_id' => $channel->id,
                    'phone' => $contact->phone,
                    'message' => $message,
                    'message_id' => $messageRecord->id,
                ],
            ]);

            $data = json_decode($response->getBody()->getContents(), true);

            $messageRecord->update([
                'message_id' => $data['whatsapp_message_id'] ?? null,
                'delivered_at' => now(),
            ]);

            // Update contact last message
            $contact->update([
                'last_message_at' => now(),
                'last_message_preview' => substr($message, 0, 100),
            ]);
        } catch (GuzzleException $e) {
            Log::error("Failed to send WhatsApp message: " . $e->getMessage());
            
            $messageRecord->update([
                'failed_at' => now(),
                'error_message' => $e->getMessage(),
            ]);

            throw $e;
        }

        return $messageRecord;
    }

    /**
     * Send media message (image, video, document)
     */
    public function sendMedia(Contact $contact, string $mediaPath, string $mediaType, ?string $caption = null, ?Channel $channel = null): Message
    {
        if (!$channel) {
            $channel = Channel::where('organization_id', $contact->organization_id)
                ->where('type', 'whatsapp')
                ->where('status', 'connected')
                ->first();

            if (!$channel) {
                throw new \Exception('No connected WhatsApp channel found');
            }
        }

        // Get file info
        $fileName = basename($mediaPath);
        $mimeType = Storage::mimeType($mediaPath);
        $fileUrl = Storage::url($mediaPath);

        // Create message record
        $messageRecord = Message::create([
            'contact_id' => $contact->id,
            'channel_id' => $channel->id,
            'content' => $caption,
            'type' => 'outbound_agent',
            'media_type' => $mediaType,
            'media_url' => $fileUrl,
            'media_filename' => $fileName,
            'media_mimetype' => $mimeType,
        ]);

        try {
            // Send via API
            $response = $this->httpClient->post('/messages/send-media', [
                'json' => [
                    'channel_id' => $channel->id,
                    'phone' => $contact->phone,
                    'media_url' => $fileUrl,
                    'media_type' => $mediaType,
                    'caption' => $caption,
                    'message_id' => $messageRecord->id,
                ],
            ]);

            $data = json_decode($response->getBody()->getContents(), true);

            $messageRecord->update([
                'message_id' => $data['whatsapp_message_id'] ?? null,
                'delivered_at' => now(),
            ]);

            // Update contact
            $contact->update([
                'last_message_at' => now(),
                'last_message_preview' => $caption ?? "Sent {$mediaType}",
            ]);
        } catch (GuzzleException $e) {
            Log::error("Failed to send WhatsApp media: " . $e->getMessage());
            
            $messageRecord->update([
                'failed_at' => now(),
                'error_message' => $e->getMessage(),
            ]);

            throw $e;
        }

        return $messageRecord;
    }

    /**
     * Disconnect a channel
     */
    public function disconnect(Channel $channel): bool
    {
        try {
            $this->httpClient->post("/channels/{$channel->id}/disconnect");

            $channel->update([
                'status' => 'disconnected',
                'qr_code' => null,
            ]);

            return true;
        } catch (GuzzleException $e) {
            Log::error("Failed to disconnect WhatsApp channel: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Handle incoming webhook from WhatsApp
     * This should be called from the WebhookController
     */
    public function handleIncomingMessage(array $data): void
    {
        $channelId = $data['channel_id'] ?? null;
        $phone = $data['from'] ?? null;
        $message = $data['message'] ?? null;
        $messageId = $data['message_id'] ?? null;

        if (!$channelId || !$phone || !$message) {
            Log::warning('Invalid webhook data received');
            return;
        }

        $channel = Channel::find($channelId);
        if (!$channel) {
            Log::warning("Channel {$channelId} not found for incoming message");
            return;
        }

        // Find or create contact
        $contact = Contact::firstOrCreate(
            [
                'organization_id' => $channel->organization_id,
                'phone' => $phone,
            ],
            [
                'channel_type' => 'whatsapp',
            ]
        );

        // Create message
        Message::create([
            'contact_id' => $contact->id,
            'channel_id' => $channel->id,
            'content' => $message,
            'type' => 'inbound',
            'message_id' => $messageId,
            'media_type' => $data['media_type'] ?? 'text',
            'media_url' => $data['media_url'] ?? null,
            'media_filename' => $data['media_filename'] ?? null,
            'media_mimetype' => $data['media_mimetype'] ?? null,
        ]);

        // Update contact
        $contact->update([
            'last_message_at' => now(),
            'last_message_preview' => substr($message, 0, 100),
            'unread_count' => $contact->unread_count + 1,
        ]);
    }
}
