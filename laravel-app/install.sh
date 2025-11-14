#!/bin/bash

# Conversa Clone - Laravel Installation Script
# This script sets up the Laravel application

set -e

echo "🗨️  Conversa Clone - Laravel Installation"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if PHP is installed
if ! command -v php &> /dev/null; then
    echo -e "${RED}Error: PHP is not installed. Please install PHP 8.3 or higher.${NC}"
    exit 1
fi

# Check PHP version
PHP_VERSION=$(php -r "echo PHP_VERSION;")
echo -e "${GREEN}✓${NC} PHP $PHP_VERSION detected"

# Check if Composer is installed
if ! command -v composer &> /dev/null; then
    echo -e "${RED}Error: Composer is not installed. Please install Composer.${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Composer detected"

# Check if PostgreSQL is available
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}⚠${NC} PostgreSQL client not found. Make sure PostgreSQL is installed."
else
    echo -e "${GREEN}✓${NC} PostgreSQL client detected"
fi

# Check if Redis is available
if ! command -v redis-cli &> /dev/null; then
    echo -e "${YELLOW}⚠${NC} Redis client not found. Make sure Redis is installed."
else
    echo -e "${GREEN}✓${NC} Redis client detected"
fi

echo ""
echo "Installing Composer dependencies..."
composer install --no-interaction --prefer-dist

echo ""
# Check if .env exists
if [ ! -f .env ]; then
    echo "Creating .env file from .env.example..."
    cp .env.example .env
    echo -e "${GREEN}✓${NC} .env file created"
    
    echo ""
    echo "Generating application key..."
    php artisan key:generate
else
    echo -e "${YELLOW}⚠${NC} .env file already exists, skipping..."
fi

echo ""
echo "=========================================="
echo ""
echo -e "${GREEN}Installation complete!${NC}"
echo ""
echo "Next steps:"
echo ""
echo "1. Configure your .env file:"
echo "   - Set database credentials (DB_*)"
echo "   - Set Redis configuration (REDIS_*)"
echo "   - Add API keys (GEMINI_API_KEY, OPENAI_API_KEY)"
echo ""
echo "2. Create the database:"
echo "   createdb conversa_clone"
echo ""
echo "3. Run migrations:"
echo "   php artisan migrate"
echo ""
echo "4. Start the development server:"
echo "   php artisan serve"
echo ""
echo "5. Visit http://localhost:8000 in your browser"
echo ""
echo "For detailed setup instructions, see: ../LARAVEL_SETUP.md"
echo ""
