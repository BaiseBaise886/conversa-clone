# WhatsApp Web Integration Guide

This document explains how the Laravel Conversa application integrates with WhatsApp Web using the same `whatsapp-web.js` library as the original Node.js version.

## Architecture Overview

```
┌─────────────────────┐         HTTP API         ┌──────────────────────┐
│                     │ ◄──────────────────────► │   WhatsApp Bridge    │
│   Laravel App       │      & Webhooks          │   (Node.js Service)  │
│   (PHP - Port 8000) │                          │   (Port 3000)        │
│                     │                          │                      │
│  - WhatsAppService  │                          │  - whatsapp-web.js   │
│  - Controllers      │                          │  - QR Generation     │
│  - Models           │                          │  - Session Mgmt      │
└─────────────────────┘                          └──────────────────────┘
                                                           │
                                                           │
                                                           ▼
                                                  ┌──────────────────┐
                                                  │  WhatsApp Web    │
                                                  │  (Puppeteer)     │
                                                  └──────────────────┘
```

## Components

### 1. Laravel WhatsApp Service (PHP)

**File:** `laravel-app/app/Services/WhatsAppService.php`

Handles all WhatsApp operations:
- Channel initialization
- QR code generation
- Message sending (text & media)
- Webhook processing
- Status checking

**Key Methods:**
```php
initializeChannel(Channel $channel): array
sendMessage(Contact $contact, string $message): Message
sendMedia(Contact $contact, string $path, string $type): Message
handleIncomingMessage(array $data): void
```

### 2. WhatsApp Bridge Service (Node.js)

**Location:** `laravel-app/whatsapp-bridge/`

Small Node.js service that:
- Runs whatsapp-web.js (same as original implementation)
- Provides HTTP API for Laravel
- Sends webhooks for events
- Manages WhatsApp sessions

**Dependencies:**
```json
{
  "whatsapp-web.js": "^1.23.0",  // Same version as original
  "express": "^4.18.2",
  "qrcode": "^1.5.3"
}
```

## Setup Instructions

### Step 1: Install Laravel Dependencies

```bash
cd laravel-app
composer install
```

### Step 2: Configure Laravel

Add to `.env`:
```env
WHATSAPP_API_URL=http://localhost:3000
WHATSAPP_API_KEY=your_secure_api_key_here
WHATSAPP_SESSION_PATH=storage/app/whatsapp-sessions
```

### Step 3: Install WhatsApp Bridge

```bash
cd laravel-app/whatsapp-bridge
npm install
```

### Step 4: Configure Bridge

Create `.env` in `whatsapp-bridge/`:
```env
PORT=3000
LARAVEL_API_URL=http://localhost:8000
API_KEY=your_secure_api_key_here  # Must match Laravel
```

### Step 5: Start Services

**Terminal 1 - Laravel:**
```bash
cd laravel-app
php artisan serve
```

**Terminal 2 - WhatsApp Bridge:**
```bash
cd laravel-app/whatsapp-bridge
npm start
```

## Usage Examples

### Initialize a Channel

**Via API:**
```bash
curl -X POST http://localhost:8000/api/channels/1/connect \
  -H "Authorization: ******" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "qr_code": "data:image/png;base64,iVBORw0KG...",
  "status": "pending_qr",
  "session_id": "channel-1-1234567890"
}
```

**Via PHP:**
```php
use App\Services\WhatsAppService;
use App\Models\Channel;

$whatsapp = app(WhatsAppService::class);
$channel = Channel::find(1);

$result = $whatsapp->initializeChannel($channel);
// User scans the QR code from $result['qr_code']
```

### Send a Text Message

**Via API:**
```bash
curl -X POST http://localhost:3000/messages/send \
  -H "X-API-Key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "channel_id": 1,
    "phone": "+1234567890",
    "message": "Hello from Laravel!"
  }'
```

**Via PHP:**
```php
$contact = Contact::where('phone', '+1234567890')->first();
$message = $whatsapp->sendMessage($contact, "Hello from Laravel!");

echo "Message sent! ID: " . $message->id;
```

### Send Media

**Via PHP:**
```php
$contact = Contact::find(1);
$imagePath = 'uploads/image.jpg';

$message = $whatsapp->sendMedia(
    $contact,
    $imagePath,
    'image',
    'Check out this image!'  // caption
);
```

### Handle Incoming Messages

Webhooks are automatically processed. When a message arrives:

1. Bridge receives message from WhatsApp
2. Bridge sends webhook to Laravel: `POST /api/webhooks/whatsapp`
3. `WebhookController` processes the webhook
4. `WhatsAppService::handleIncomingMessage()` creates Contact and Message records
5. Laravel app can trigger flows, AI responses, etc.

## API Endpoints

### Bridge Service Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/channels/initialize` | Initialize WhatsApp connection |
| GET | `/channels/:id/status` | Check connection status |
| POST | `/messages/send` | Send text message |
| POST | `/messages/send-media` | Send media message |
| POST | `/channels/:id/disconnect` | Disconnect channel |

### Laravel API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/channels/:id/connect` | Initialize channel |
| POST | `/api/channels/:id/disconnect` | Disconnect channel |
| GET | `/api/channels/:id/qr` | Get QR code |
| POST | `/api/webhooks/whatsapp` | Receive webhook events |

## Webhook Events

The bridge sends these events to Laravel:

### QR Code Event
```json
{
  "event": "qr",
  "channel_id": 1,
  "qr_code": "data:image/png;base64,..."
}
```

### Connected Event
```json
{
  "event": "ready",
  "channel_id": 1
}
```

### Message Received Event
```json
{
  "event": "message",
  "channel_id": 1,
  "from": "+1234567890",
  "message": "Hello",
  "message_id": "whatsapp_msg_id",
  "media_type": "text"
}
```

### Disconnected Event
```json
{
  "event": "disconnected",
  "channel_id": 1,
  "reason": "Connection lost"
}
```

## Deployment

### Development

Run both services locally:
```bash
# Terminal 1
cd laravel-app && php artisan serve

# Terminal 2
cd laravel-app/whatsapp-bridge && npm start
```

### Production

**Option 1: Same Server**
```bash
# Laravel with PHP-FPM/Nginx
cd laravel-app
composer install --no-dev --optimize-autoloader

# WhatsApp Bridge with PM2
cd laravel-app/whatsapp-bridge
npm install --production
pm2 start server.js --name whatsapp-bridge
pm2 save
```

**Option 2: Separate Servers**
- Deploy Laravel on main server
- Deploy bridge on separate server (or serverless)
- Update `WHATSAPP_API_URL` to point to bridge server
- Ensure bridge can reach Laravel for webhooks

**Option 3: Docker Compose**
```yaml
version: '3.8'
services:
  laravel:
    build: ./laravel-app
    ports:
      - "8000:8000"
    environment:
      - WHATSAPP_API_URL=http://whatsapp-bridge:3000
  
  whatsapp-bridge:
    build: ./laravel-app/whatsapp-bridge
    ports:
      - "3000:3000"
    environment:
      - LARAVEL_API_URL=http://laravel:8000
    volumes:
      - ./whatsapp-sessions:/app/whatsapp-sessions
```

## Security Considerations

1. **API Key Authentication**
   - Always use strong API keys
   - Match keys between Laravel and bridge
   - Rotate regularly

2. **Webhook Validation**
   - Verify API key on webhook requests
   - Use HTTPS in production

3. **Session Storage**
   - Keep `whatsapp-sessions/` directory secure
   - Backup sessions for disaster recovery
   - Never commit sessions to git

4. **Network Security**
   - Run bridge on private network if possible
   - Use reverse proxy with HTTPS
   - Implement rate limiting

## Troubleshooting

### QR Code Not Generating

**Problem:** Channel initializes but no QR code
**Solution:**
- Check bridge is running: `curl http://localhost:3000/health`
- Check Laravel logs: `tail -f storage/logs/laravel.log`
- Verify `WHATSAPP_API_URL` in Laravel .env

### Messages Not Sending

**Problem:** API returns success but message not delivered
**Solution:**
- Check channel is connected: `GET /api/channels/:id`
- Verify phone number format (include country code)
- Check bridge logs for errors
- Ensure WhatsApp Web session is active

### Connection Drops

**Problem:** Channel shows connected then disconnects
**Solution:**
- WhatsApp Web sessions can expire naturally
- Phone may need to be online
- Check bridge server resources
- Review bridge logs for disconnection reason

### Webhooks Not Received

**Problem:** Messages arrive but Laravel doesn't see them
**Solution:**
- Verify `LARAVEL_API_URL` in bridge .env
- Check Laravel API is accessible from bridge
- Ensure webhook endpoint is not rate-limited
- Check API key matches

## Alternative Integration Options

If you don't want to run the bridge service:

### Option A: WhatsApp Business API (Official)
- Use Meta's official API
- Update WhatsAppService to use Guzzle HTTP calls
- No Node.js required
- Requires business verification

### Option B: Third-Party Services
- Twilio, MessageBird, Infobip, etc.
- Update WhatsAppService integration
- Usually more expensive
- Better uptime guarantees

### Option C: Hosted whatsapp-web.js
- Deploy bridge separately
- Use services like Render, Railway, etc.
- Point Laravel to hosted bridge URL

## Performance Tips

1. **Connection Pooling**
   - Keep channels connected
   - Reconnect on disconnection events
   - Monitor connection health

2. **Message Queue**
   - Use Laravel Queue for sending
   - Avoid overwhelming WhatsApp
   - Implement retry logic

3. **Caching**
   - Cache channel statuses
   - Cache contact lookups
   - Use Redis for session data

4. **Scaling**
   - Run multiple bridge instances with load balancer
   - Use shared Redis for sessions
   - Separate database for high throughput

## Comparison with Original Node.js Version

| Feature | Node.js Version | Laravel + Bridge |
|---------|----------------|------------------|
| Backend Language | JavaScript | PHP |
| Frontend | React + Vite | Blade Templates |
| WhatsApp Library | whatsapp-web.js | Same (whatsapp-web.js) |
| Build Process | npm build | None required |
| Deployment | PM2 for both | PHP-FPM + PM2 for bridge |
| Architecture | Monolithic | Separated concerns |
| Maintainability | Medium | High (clear separation) |

## Support

For issues:
1. Check `whatsapp-bridge/README.md`
2. Review Laravel logs
3. Check bridge console output
4. Open GitHub issue with logs

## License

Same as parent project (MIT)
