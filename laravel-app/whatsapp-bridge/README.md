# WhatsApp Bridge Service

This is a companion Node.js service that provides WhatsApp Web integration for the Laravel Conversa application using `whatsapp-web.js`.

## Why This Bridge?

While the main application is pure Laravel/PHP, WhatsApp Web integration requires browser automation which is best handled by Node.js. This small bridge service:

1. Runs `whatsapp-web.js` to connect to WhatsApp Web
2. Generates QR codes for authentication
3. Handles sending/receiving messages
4. Communicates with Laravel via HTTP API and webhooks

## Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
nano .env
```

## Configuration

Edit `.env`:

```bash
# Port for this service (default 3000)
PORT=3000

# Laravel API URL
LARAVEL_API_URL=http://localhost:8000

# API Key (must match Laravel's WHATSAPP_API_KEY)
API_KEY=your_secure_api_key_here
```

Also update your Laravel `.env`:

```bash
WHATSAPP_API_URL=http://localhost:3000
WHATSAPP_API_KEY=your_secure_api_key_here
```

## Running the Service

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

### With PM2
```bash
pm2 start server.js --name whatsapp-bridge
pm2 save
```

## API Endpoints

### Health Check
```
GET /health
```

### Initialize Channel
```
POST /channels/initialize
{
  "channel_id": 1,
  "organization_id": 1,
  "phone_number": "+1234567890"
}
```

### Check Status
```
GET /channels/:channelId/status
```

### Send Message
```
POST /messages/send
{
  "channel_id": 1,
  "phone": "+1234567890",
  "message": "Hello World",
  "message_id": 123
}
```

### Send Media
```
POST /messages/send-media
{
  "channel_id": 1,
  "phone": "+1234567890",
  "media_url": "https://example.com/image.jpg",
  "caption": "Check this out",
  "message_id": 124
}
```

### Disconnect Channel
```
POST /channels/:channelId/disconnect
```

## How It Works

1. Laravel creates a WhatsApp channel
2. Laravel calls this bridge service to initialize connection
3. Bridge generates QR code and sends it back to Laravel
4. User scans QR code with WhatsApp mobile app
5. Bridge connects to WhatsApp Web
6. Bridge sends webhook to Laravel when messages are received
7. Laravel can send messages through the bridge API

## Deployment

### Option 1: Same Server as Laravel
Run on `localhost:3000` alongside your Laravel application.

### Option 2: Separate Server
Run on a dedicated server and update `WHATSAPP_API_URL` in Laravel's `.env`.

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
CMD ["node", "server.js"]
```

## Security Notes

- Always use API key authentication
- Run behind a reverse proxy with HTTPS in production
- Keep sessions directory (`whatsapp-sessions/`) secure
- Never commit `.env` or session files to version control

## Troubleshooting

### QR Code Not Generating
- Check browser dependencies are installed
- Ensure puppeteer can run headless Chrome
- Check logs for puppeteer errors

### Messages Not Sending
- Verify channel is connected (`GET /channels/:id/status`)
- Check phone number format (should include country code)
- Review Laravel logs for webhook errors

### Connection Drops
- WhatsApp Web sessions can expire
- Phone loses connection
- Bridge service restarts
- Check both Laravel and bridge logs

## Alternative: Using WhatsApp Business API

If you don't want to run this bridge, you can:

1. Use WhatsApp Business API (official, paid)
2. Use third-party WhatsApp API services
3. Update `WhatsAppService.php` in Laravel to integrate with your chosen provider

Just update the `WHATSAPP_API_URL` to point to your alternative service.
