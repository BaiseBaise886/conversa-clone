# Conversa Clone - WhatsApp Marketing Automation Platform

> **Note**: This project has been converted to pure Laravel/PHP. No Node.js or JavaScript build tools required!

## 🚀 Quick Start

This is a complete WhatsApp marketing automation platform built with Laravel and PHP. It provides AI-powered conversations, flow automation, contact management, and multi-channel support.

## ✨ Features

- 💬 **Multi-Channel Support** - WhatsApp, Instagram, Telegram
- 🤖 **AI-Powered Conversations** - Google Gemini & OpenAI integration
- 🎨 **Flow Automation** - Visual flow builder with conditions
- 👥 **Contact Management** - CRM with tags and custom fields
- 📊 **Analytics & Reporting** - Track performance and conversions
- 🧪 **A/B Testing** - Optimize your messaging strategy
- 📱 **Responsive Dashboard** - Modern web interface (pure CSS, no build process)
- 🔐 **Multi-tenancy** - Organization-based access control
- 🚦 **Rate Limiting** - Built-in anti-ban protection

## 🛠️ Technology Stack

- **Backend**: Laravel 11 (PHP 8.3+)
- **Database**: PostgreSQL 12+
- **Cache/Queue**: Redis 6+
- **Authentication**: Laravel Sanctum
- **Frontend**: Blade Templates (No Node.js required!)

## 📋 Requirements

- PHP 8.3 or higher
- PostgreSQL 12 or higher  
- Redis 6 or higher
- Composer 2.x
- Apache or Nginx

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/BaiseBaise886/conversa-clone.git
cd conversa-clone/laravel-app
```

### 2. Install Dependencies

```bash
composer install
```

### 3. Configure Environment

```bash
cp .env.example .env
php artisan key:generate
```

Edit `.env` with your database and Redis credentials:

```env
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=conversa_clone
DB_USERNAME=conversa_user
DB_PASSWORD=your_password

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

### 4. Run Migrations

```bash
php artisan migrate
```

### 5. Start the Server

```bash
php artisan serve
```

Visit `http://localhost:8000` and create your account!

## 📖 Documentation

- **[Laravel Setup Guide](LARAVEL_SETUP.md)** - Detailed installation and configuration
- **[API Documentation](API_DOCUMENTATION.md)** - REST API endpoints
- **[Multimedia Guide](MULTIMEDIA_GUIDE.md)** - Media handling
- **[Production Deployment](PRODUCTION_DEPLOYMENT_GUIDE.md)** - Production setup

## 🏗️ Project Structure

```
conversa-clone/
├── laravel-app/          # Main Laravel application
│   ├── app/
│   │   ├── Http/
│   │   │   ├── Controllers/
│   │   │   │   ├── Api/      # RESTful API
│   │   │   │   └── Web/      # Web interface  
│   │   ├── Models/           # Eloquent models
│   │   └── Services/         # Business logic
│   ├── database/
│   │   └── migrations/       # Database schema
│   ├── resources/
│   │   └── views/            # Blade templates
│   └── routes/
│       ├── api.php           # API routes
│       └── web.php           # Web routes
├── backend/              # [DEPRECATED] Old Node.js backend
└── frontend/             # [DEPRECATED] Old React frontend
```

## 🔑 Key Features

### Authentication
- User registration with automatic organization creation
- Role-based access control (Owner, Admin, Agent, Viewer)
- API token authentication (Laravel Sanctum)
- Session-based web authentication

### Contact Management
- Import/export contacts
- Custom fields and tags
- Conversation history
- Activity tracking

### Flow Automation
- Visual flow builder
- Keyword triggers
- Conditional branching
- Variable management
- Integration with AI

### AI Integration
- Google Gemini AI for intelligent responses
- OpenAI support (optional)
- Sentiment analysis
- Auto-tagging and categorization

## 🌐 API Examples

### Authentication

```bash
# Register
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123",
    "organization_name": "My Company"
  }'

# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

### Resource Management

```bash
# List contacts
curl -X GET http://localhost:8000/api/contacts \
  -H "Authorization: Bearer YOUR_TOKEN"

# Create contact
curl -X POST http://localhost:8000/api/contacts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Smith",
    "phone": "+1234567890",
    "tags": ["lead", "interested"]
  }'
```

## 🚀 Production Deployment

```bash
# Optimize for production
composer install --optimize-autoloader --no-dev
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Set permissions
chmod -R 755 storage bootstrap/cache

# Start queue workers (use supervisor)
php artisan queue:work redis --tries=3
```

See [PRODUCTION_DEPLOYMENT_GUIDE.md](PRODUCTION_DEPLOYMENT_GUIDE.md) for detailed instructions.

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## 📝 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file.

## 🙏 Acknowledgments

- Laravel Framework
- WhatsApp Web API
- Google Gemini AI
- OpenAI

## 📧 Support

For support and questions:
- Open an issue on GitHub
- Check the documentation
- Review the Laravel Setup Guide

---

**Note**: The old Node.js/React version is still available in the `backend/` and `frontend/` directories but is now deprecated. Please use the Laravel version in `laravel-app/` for all new development.
