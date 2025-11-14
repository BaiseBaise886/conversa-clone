# Conversa WhatsApp Tampermonkey Script

A Tampermonkey userscript that automates WhatsApp Web using WA-JS and integrates with the Laravel Conversa backend.

## Overview

This browser-based solution runs directly on WhatsApp Web (web.whatsapp.com) and provides:
- Automatic message sending/receiving
- Media support (images, videos, documents, audio)
- Real-time integration with Laravel backend
- No server-side Node.js required
- Easy configuration via UI panel

## Features

✅ **Browser-Based** - Runs directly in your browser via Tampermonkey
✅ **WA-JS Integration** - Uses WPPConnect's WA-JS library for WhatsApp automation
✅ **Laravel Integration** - Communicates with Laravel backend via API
✅ **Real-Time Messaging** - Polls Laravel for messages to send
✅ **Incoming Messages** - Forwards received messages to Laravel webhook
✅ **Media Support** - Send/receive images, videos, audio, documents
✅ **Configuration UI** - Easy setup with in-browser control panel
✅ **No Installation** - Just install the userscript and configure

## Requirements

- **Browser**: Chrome, Firefox, or Edge
- **Tampermonkey**: Browser extension installed
- **Laravel Backend**: Conversa Laravel application running
- **WhatsApp Web**: Access to web.whatsapp.com

## Installation

### Step 1: Install Tampermonkey

Install Tampermonkey extension for your browser:
- **Chrome**: [Chrome Web Store](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- **Firefox**: [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
- **Edge**: [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)

### Step 2: Install the Userscript

1. Click on the Tampermonkey icon in your browser
2. Click "Create a new script"
3. Copy the contents of `conversa-whatsapp.user.js`
4. Paste into the editor
5. Click File > Save (or Ctrl+S)

**Or** simply open the `.user.js` file and Tampermonkey will prompt to install it.

### Step 3: Configure Laravel Backend

Make sure your Laravel application is running and accessible:

```bash
cd laravel-app
php artisan serve
```

The default URL is `http://localhost:8000`

### Step 4: Open WhatsApp Web

1. Navigate to https://web.whatsapp.com
2. Scan the QR code with your phone if not already logged in
3. Wait for WhatsApp to load completely

### Step 5: Configure the Script

1. Look for the **Conversa** control panel in the top-right corner
2. Click the **⚙️ Configure** button
3. Enter your settings:
   - **Laravel API URL**: Your Laravel backend URL (e.g., `http://localhost:8000`)
   - **API Key**: Your API key (must match `WHATSAPP_API_KEY` in Laravel .env)
   - **Channel ID**: The channel ID from Laravel database
   - **Organization ID**: Your organization ID from Laravel
4. Click **Save**

## Configuration

### Laravel .env Configuration

Add to your Laravel `.env`:

```env
# Tampermonkey script API key (create a secure random key)
WHATSAPP_API_KEY=your_secure_api_key_here
```

### Get Your Channel ID

Create a channel in Laravel:

```bash
# Using Laravel tinker
php artisan tinker

# Create a channel
$channel = App\Models\Channel::create([
    'organization_id' => 1,
    'name' => 'Tampermonkey Channel',
    'type' => 'whatsapp',
    'status' => 'connected'
]);

echo $channel->id; // Use this ID in the Tampermonkey script
```

Or via API:

```bash
curl -X POST http://localhost:8000/api/channels \
  -H "Authorization: ******" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Tampermonkey Channel",
    "type": "whatsapp"
  }'
```

## Usage

### Automatic Operation

Once configured, the script will:
1. Connect to WhatsApp Web automatically
2. Listen for incoming messages and forward to Laravel
3. Poll Laravel every 5 seconds for messages to send
4. Send messages/media automatically

### Control Panel

The control panel shows:
- **Status**: Connection status (Connected/Connecting)
- **Channel**: Currently configured channel ID
- **Configure Button**: Opens settings dialog

Click **Hide** to minimize the panel (it remains functional).

### Sending Messages from Laravel

The script polls this endpoint for pending messages:

```
GET /api/channels/{channelId}/pending-messages
```

Laravel should return:

```json
{
  "messages": [
    {
      "id": 123,
      "phone": "+1234567890",
      "message": "Hello World",
      "media_url": null,
      "media_type": null,
      "caption": null
    }
  ]
}
```

The script will send each message and call:

```
POST /api/messages/{messageId}/sent
{
  "sent": true
}
```

### Receiving Messages

When messages arrive, the script posts to:

```
POST /api/webhooks/whatsapp
{
  "event": "message",
  "channel_id": 1,
  "from": "+1234567890",
  "message": "Hello",
  "message_id": "whatsapp_msg_id",
  "media_type": "chat",
  "timestamp": 1699999999999
}
```

## API Integration

### Required Laravel Endpoints

Your Laravel application should implement these endpoints:

#### 1. Webhook Endpoint
```php
POST /api/webhooks/whatsapp
```
Receives incoming messages and events.

#### 2. Pending Messages Endpoint
```php
GET /api/channels/{channelId}/pending-messages
```
Returns messages that need to be sent.

#### 3. Message Sent Confirmation
```php
POST /api/messages/{messageId}/sent
```
Confirms a message was sent successfully.

### Laravel Controller Example

```php
// app/Http/Controllers/Api/TampermonkeyController.php
namespace App\Http\Controllers\Api;

class TampermonkeyController extends Controller
{
    public function pendingMessages($channelId)
    {
        $messages = Message::where('channel_id', $channelId)
            ->whereNull('delivered_at')
            ->where('type', 'outbound_agent')
            ->limit(10)
            ->get()
            ->map(function($msg) {
                return [
                    'id' => $msg->id,
                    'phone' => $msg->contact->phone,
                    'message' => $msg->content,
                    'media_url' => $msg->media_url,
                    'media_type' => $msg->media_type,
                    'caption' => $msg->content,
                ];
            });

        return response()->json(['messages' => $messages]);
    }

    public function messageSent($messageId)
    {
        $message = Message::findOrFail($messageId);
        $message->update(['delivered_at' => now()]);
        
        return response()->json(['success' => true]);
    }
}
```

Add routes in `routes/api.php`:

```php
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/channels/{channelId}/pending-messages', 
        [TampermonkeyController::class, 'pendingMessages']);
    Route::post('/messages/{messageId}/sent', 
        [TampermonkeyController::class, 'messageSent']);
});
```

## How It Works

```
┌─────────────────────┐         ┌──────────────────────┐
│                     │         │                      │
│  WhatsApp Web       │ ◄─────► │  Tampermonkey        │
│  (Browser)          │   WA-JS │  Script              │
│                     │         │                      │
└─────────────────────┘         └──────────────────────┘
                                          │
                                          │ HTTP API
                                          │
                                          ▼
                                ┌──────────────────────┐
                                │                      │
                                │  Laravel Backend     │
                                │  (Port 8000)         │
                                │                      │
                                └──────────────────────┘
```

1. Script loads when you visit WhatsApp Web
2. WA-JS library hooks into WhatsApp's internal API
3. Script listens for incoming messages
4. Incoming messages are posted to Laravel webhook
5. Script polls Laravel for messages to send
6. Messages are sent via WA-JS
7. Delivery confirmations sent back to Laravel

## Features Comparison

| Feature | Tampermonkey Script | WhatsApp Bridge |
|---------|-------------------|-----------------|
| Setup Complexity | Easy (browser only) | Medium (Node.js service) |
| Deployment | User's browser | Server required |
| Reliability | Depends on browser | More reliable |
| Multiple Channels | One per browser | Multiple supported |
| Resource Usage | Browser memory | Server resources |
| Best For | Personal use, testing | Production, scale |

## Troubleshooting

### Script Not Loading

1. Check Tampermonkey is enabled
2. Verify script is enabled in Tampermonkey dashboard
3. Refresh WhatsApp Web page
4. Check browser console for errors (F12)

### Not Connecting to Laravel

1. Verify Laravel URL is correct
2. Check CORS is enabled for your domain
3. Verify API key matches between script and Laravel
4. Check Laravel is running: `curl http://localhost:8000/health`

### Messages Not Sending

1. Check channel ID is correct
2. Verify phone numbers include country code
3. Check browser console for errors
4. Verify Laravel endpoint returns messages correctly

### Messages Not Being Received

1. Check webhook endpoint is accessible
2. Verify API key authentication
3. Check Laravel logs: `tail -f storage/logs/laravel.log`
4. Test webhook manually with curl

## Security Considerations

1. **API Key**: Use a strong, random API key
2. **HTTPS**: Use HTTPS for Laravel in production
3. **CORS**: Restrict CORS to trusted domains only
4. **Rate Limiting**: Implement rate limiting on Laravel endpoints
5. **Browser Security**: Script runs with your WhatsApp session

## Advantages

✅ **No Server Required** - Runs in your browser
✅ **Easy Setup** - Just install and configure
✅ **WA-JS Power** - Full WhatsApp Web API access
✅ **Laravel Integration** - Works with existing backend
✅ **Free** - No additional hosting costs
✅ **Real-Time** - Instant message handling

## Limitations

⚠️ **Browser Dependent** - Requires browser to be open
⚠️ **Single Channel** - One channel per browser/profile
⚠️ **Computer Online** - Computer must be running
⚠️ **WhatsApp Session** - Uses your personal WhatsApp Web session

## Advanced Configuration

### Change Poll Interval

Edit the script:

```javascript
const CONFIG = {
    // ...
    pollInterval: 3000, // Check every 3 seconds instead of 5
};
```

### Disable Auto-Connect

```javascript
const CONFIG = {
    // ...
    autoConnect: false, // Require manual configuration
};
```

### Custom API Endpoints

Modify the polling function to use different endpoints:

```javascript
async function pollForMessages() {
    const response = await sendToLaravel(`/api/custom/endpoint`);
    // ...
}
```

## Development

### Testing the Script

1. Open WhatsApp Web
2. Open browser console (F12)
3. Watch for `[Conversa]` log messages
4. Test sending a message to yourself

### Debugging

Enable verbose logging:

```javascript
// Add to the script
console.log('[Conversa] Debug info:', {
    config: CONFIG,
    isConnected: isConnected,
    isInitialized: isInitialized
});
```

### Modifying the Script

1. Edit the script in Tampermonkey
2. Save changes
3. Refresh WhatsApp Web
4. Changes take effect immediately

## Support

For issues or questions:
1. Check browser console for errors
2. Verify Laravel logs
3. Test API endpoints manually
4. Open an issue on GitHub

## License

Same as parent project (MIT)

## Credits

- **WA-JS**: WPPConnect Team (https://github.com/wppconnect-team/wa-js)
- **Tampermonkey**: Jan Biniok
- **Laravel**: Taylor Otwell
