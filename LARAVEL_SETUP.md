# Conversa Clone - Laravel/PHP Version Setup Guide

## Overview

This project has been converted from Node.js/React to pure Laravel/PHP. All functionality is now powered by Laravel, eliminating the need for Node.js, npm, or any JavaScript build tools for the core application.

## Requirements

- PHP 8.3 or higher
- PostgreSQL 12 or higher
- Redis 6 or higher
- Composer 2.x
- Apache or Nginx web server

## Installation

### 1. Navigate to Laravel Directory

```bash
cd laravel-app
```

### 2. Install PHP Dependencies

```bash
composer install
```

### 3. Configure Environment

Copy the `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Update the following in `.env`:

```env
APP_NAME="Conversa Clone"
APP_URL=http://localhost:8000

# Database Configuration
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=conversa_clone
DB_USERNAME=conversa_user
DB_PASSWORD=conversa_pass_2025

# Redis Configuration
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# AI Configuration (Optional)
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
```

### 4. Generate Application Key

```bash
php artisan key:generate
```

### 5. Run Database Migrations

```bash
php artisan migrate
```

### 6. Start the Development Server

```bash
php artisan serve
```

The application will be available at `http://localhost:8000`

## Features

### ✅ Completed Features

- **Authentication System**
  - User registration with organization creation
  - Login/logout functionality
  - Laravel Sanctum for API tokens
  - Session-based web authentication

- **Core Database Structure**
  - Organizations (multi-tenancy support)
  - Users with role-based access
  - Contacts management
  - Channels (WhatsApp, Instagram, Telegram)
  - Messages tracking
  - Flow automation framework

- **Web Interface**
  - Modern, responsive dashboard (pure CSS, no build process)
  - Login and registration pages
  - Statistics overview
  - Recent contacts and channels display

- **API Endpoints**
  - RESTful API for all resources
  - Token-based authentication
  - Health check endpoint

### 🚧 Features to Implement

- **WhatsApp Integration**
  - Connection via web.whatsapp.com protocol
  - QR code generation for authentication
  - Message sending/receiving
  - Media handling

- **AI Integration**
  - Google Gemini AI for conversation intelligence
  - OpenAI integration (optional)
  - Sentiment analysis
  - Auto-tagging

- **Flow Automation**
  - Visual flow builder
  - Keyword triggers
  - Conditional logic
  - Variable management

- **Analytics**
  - Conversation metrics
  - A/B testing framework
  - Funnel analytics
  - Performance tracking

- **Media Library**
  - File upload and management
  - Media variants
  - Folder organization

## Architecture

### MVC Structure

```
laravel-app/
├── app/
│   ├── Http/
│   │   ├── Controllers/
│   │   │   ├── Api/          # API endpoints
│   │   │   └── Web/          # Web interface
│   │   └── Middleware/
│   ├── Models/               # Eloquent models
│   ├── Services/             # Business logic
│   └── Providers/
├── database/
│   ├── migrations/           # Database schema
│   └── seeders/
├── resources/
│   └── views/                # Blade templates
│       ├── auth/             # Login/Register
│       ├── dashboard/        # Dashboard views
│       └── layouts/          # Layout templates
├── routes/
│   ├── api.php               # API routes
│   └── web.php               # Web routes
└── storage/
    └── app/
        ├── private/          # Private uploads
        └── public/           # Public uploads
```

### Key Differences from Node.js Version

1. **No Node.js Required**: The frontend is built with Blade templates and vanilla CSS
2. **Laravel Queue**: Replaces Bull for job processing
3. **Laravel Broadcasting**: Replaces Socket.io for real-time features
4. **Laravel Storage**: Built-in file management system
5. **Eloquent ORM**: Replaces raw SQL queries with elegant model relationships
6. **Laravel Cache**: Redis integration for caching

## API Documentation

### Authentication

#### Register
```bash
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "organization_name": "My Company"
}
```

#### Login
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

Response:
```json
{
  "token": "1|abc123...",
  "user": {...},
  "organization": {...}
}
```

#### Get Current User
```bash
GET /api/auth/me
Authorization: Bearer {token}
```

### Resources

All resource endpoints follow RESTful conventions:

- `GET /api/contacts` - List contacts
- `POST /api/contacts` - Create contact
- `GET /api/contacts/{id}` - Show contact
- `PUT /api/contacts/{id}` - Update contact
- `DELETE /api/contacts/{id}` - Delete contact

Same pattern for: channels, messages, flows

## Database Schema

### Core Tables

- **organizations** - Multi-tenant organization data
- **users** - User accounts
- **user_organizations** - Many-to-many relationship with roles
- **contacts** - Contact information and metadata
- **channels** - Communication channels (WhatsApp, etc.)
- **messages** - Message history
- **flows** - Automation flow definitions
- **flow_states** - User progress through flows

## Development

### Running Migrations

```bash
php artisan migrate
```

### Rolling Back Migrations

```bash
php artisan migrate:rollback
```

### Creating New Controllers

```bash
php artisan make:controller ControllerName
```

### Creating New Models

```bash
php artisan make:model ModelName -m  # with migration
```

### Running Queue Workers

```bash
php artisan queue:work
```

### Clearing Cache

```bash
php artisan cache:clear
php artisan config:clear
php artisan route:clear
```

## Production Deployment

### 1. Optimize Application

```bash
composer install --optimize-autoloader --no-dev
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

### 2. Set Permissions

```bash
chmod -R 755 storage bootstrap/cache
```

### 3. Configure Web Server

#### Nginx Example

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/laravel-app/public;

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";

    index index.php;

    charset utf-8;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.3-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }
}
```

### 4. Set Up Supervisor for Queue Workers

```ini
[program:conversa-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /path/to/laravel-app/artisan queue:work redis --sleep=3 --tries=3
autostart=true
autorestart=true
user=www-data
numprocs=2
redirect_stderr=true
stdout_logfile=/path/to/laravel-app/storage/logs/worker.log
```

## Testing

### Run Tests

```bash
php artisan test
```

### Run Specific Test

```bash
php artisan test --filter=TestName
```

## Troubleshooting

### Permission Errors

```bash
chmod -R 775 storage bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache
```

### Database Connection Issues

- Verify PostgreSQL is running
- Check database credentials in `.env`
- Ensure database exists: `createdb conversa_clone`

### Redis Connection Issues

- Verify Redis is running: `redis-cli ping`
- Check Redis configuration in `.env`

## Migration from Node.js Version

If you're migrating data from the Node.js version:

1. Export data from the Node.js PostgreSQL database
2. Transform data to match Laravel's conventions (e.g., `password_hash` → `password`)
3. Import using Laravel seeders or direct SQL import

## Support

For issues or questions:
- Check the Laravel documentation: https://laravel.com/docs
- Review the original conversa-clone documentation
- Open an issue on GitHub

## License

MIT License - Same as the original project

## Credits

- Original Conversa Clone by BaiseBaise886
- Converted to Laravel/PHP version
- Built with Laravel 11, PostgreSQL, and Redis

## WhatsApp Integration

The Laravel application integrates with WhatsApp Web using a compatible API. There are two options:

### Option 1: WhatsApp Bridge Service (Recommended)

We provide a lightweight Node.js bridge service that uses `whatsapp-web.js` - the same library as the original Node.js version.

**Setup:**

```bash
# Navigate to bridge directory
cd laravel-app/whatsapp-bridge

# Install dependencies
npm install

# Configure environment
cp .env.example .env
nano .env

# Start the bridge
npm start
```

Configure Laravel's `.env`:
```env
WHATSAPP_API_URL=http://localhost:3000
WHATSAPP_API_KEY=your_secure_api_key_here
```

**Features:**
- Full whatsapp-web.js compatibility
- QR code generation
- Send/receive messages
- Media support
- Session persistence

See `laravel-app/whatsapp-bridge/README.md` for detailed documentation.

### Option 2: Third-Party WhatsApp API

Use any WhatsApp API service (like WhatsApp Business API, Twilio, or others) by updating the `WhatsAppService.php` to integrate with your chosen provider.

### How It Works

1. **Laravel Application** - Main PHP application handling all business logic
2. **WhatsApp Bridge** (optional) - Small Node.js service for whatsapp-web.js integration
3. **Communication** - Bridge sends webhooks to Laravel for incoming messages

```
[Laravel App :8000] <--HTTP API--> [WhatsApp Bridge :3000] <--> [WhatsApp Web]
```

### API Usage Example

```php
use App\Services\WhatsAppService;

// Initialize channel (generates QR code)
$whatsapp = app(WhatsAppService::class);
$result = $whatsapp->initializeChannel($channel);

// Send message
$whatsapp->sendMessage($contact, "Hello from Laravel!");

// Send media
$whatsapp->sendMedia($contact, 'path/to/image.jpg', 'image', 'Check this out');
```

### Deployment

For production, run the WhatsApp bridge as a separate service:

```bash
# Using PM2
cd laravel-app/whatsapp-bridge
pm2 start server.js --name whatsapp-bridge
pm2 save
```

Or use Docker:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY whatsapp-bridge/package*.json ./
RUN npm install --production
COPY whatsapp-bridge/ .
CMD ["node", "server.js"]
```

