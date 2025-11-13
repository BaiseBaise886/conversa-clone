#!/bin/bash

# Conversa Clone - Automated Setup Script
# This script automates the setup process for the WhatsApp Business Automation Platform

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo -e "\n${BLUE}================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Main setup function
main() {
    print_header "🚀 Conversa Clone - Automated Setup"
    
    # Check prerequisites
    check_prerequisites
    
    # Setup environment files
    setup_environment_files
    
    # Install dependencies
    install_dependencies
    
    # Setup database
    setup_database
    
    # Setup Redis
    setup_redis
    
    # Run migrations
    run_migrations
    
    # Final checks
    final_checks
    
    print_header "✅ Setup Complete!"
    print_success "Conversa Clone is ready to use!"
    echo ""
    print_info "To start the development servers:"
    echo "  npm run dev"
    echo ""
    print_info "To start backend only:"
    echo "  npm run dev:backend"
    echo ""
    print_info "To start frontend only:"
    echo "  npm run dev:frontend"
    echo ""
    print_info "To run with PM2 in production:"
    echo "  npm run pm2:start"
    echo ""
}

# Check prerequisites
check_prerequisites() {
    print_header "📋 Checking Prerequisites"
    
    local all_good=true
    
    # Check Node.js
    if command_exists node; then
        NODE_VERSION=$(node -v)
        print_success "Node.js found: $NODE_VERSION"
        
        # Check if version is >= 18
        MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$MAJOR_VERSION" -lt 18 ]; then
            print_error "Node.js version 18.0.0 or higher is required"
            all_good=false
        fi
    else
        print_error "Node.js is not installed"
        print_info "Install from: https://nodejs.org/"
        all_good=false
    fi
    
    # Check npm
    if command_exists npm; then
        NPM_VERSION=$(npm -v)
        print_success "npm found: $NPM_VERSION"
    else
        print_error "npm is not installed"
        all_good=false
    fi
    
    # Check PostgreSQL
    if command_exists psql; then
        PSQL_VERSION=$(psql --version)
        print_success "PostgreSQL found: $PSQL_VERSION"
    else
        print_warning "PostgreSQL client not found in PATH"
        print_info "Make sure PostgreSQL is installed and accessible"
    fi
    
    # Check Redis
    if command_exists redis-cli; then
        REDIS_VERSION=$(redis-cli --version)
        print_success "Redis found: $REDIS_VERSION"
    else
        print_warning "Redis client not found"
        print_info "Install Redis: https://redis.io/download"
    fi
    
    # Check Git
    if command_exists git; then
        GIT_VERSION=$(git --version)
        print_success "Git found: $GIT_VERSION"
    else
        print_warning "Git not found"
    fi
    
    if [ "$all_good" = false ]; then
        print_error "Please install missing prerequisites and run setup again"
        exit 1
    fi
}

# Setup environment files
setup_environment_files() {
    print_header "🔧 Setting Up Environment Files"
    
    # Backend .env
    if [ ! -f "backend/.env" ]; then
        if [ -f "backend/.env.example" ]; then
            print_info "Creating backend/.env from .env.example..."
            cp backend/.env.example backend/.env
            print_success "backend/.env created"
            print_warning "Please update backend/.env with your configuration"
        else
            print_warning "backend/.env.example not found, creating default .env..."
            create_default_backend_env
            print_success "backend/.env created with defaults"
            print_warning "Please update backend/.env with your configuration"
        fi
    else
        print_success "backend/.env already exists"
    fi
    
    # Frontend .env
    if [ ! -f "frontend/.env" ]; then
        if [ -f "frontend/.env.example" ]; then
            print_info "Creating frontend/.env from .env.example..."
            cp frontend/.env.example frontend/.env
            print_success "frontend/.env created"
        else
            print_warning "frontend/.env.example not found, creating default .env..."
            create_default_frontend_env
            print_success "frontend/.env created with defaults"
        fi
    else
        print_success "frontend/.env already exists"
    fi
}

# Create default backend .env
create_default_backend_env() {
    cat > backend/.env << 'EOF'
# Server Configuration
NODE_ENV=development
PORT=3001
HOST=localhost

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=conversa_db
DB_USER=postgres
DB_PASSWORD=your_password_here

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT Configuration
JWT_SECRET=your_jwt_secret_here_change_in_production
JWT_EXPIRES_IN=7d

# WhatsApp API Configuration
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_ACCESS_TOKEN=your_whatsapp_token_here
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id_here

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4

# Email Configuration (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password_here
SMTP_FROM=noreply@conversa.app

# Frontend URL
FRONTEND_URL=http://localhost:5173

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads

# Rate Limiting
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX_REQUESTS=100

# Session Configuration
SESSION_SECRET=your_session_secret_here

# Logging
LOG_LEVEL=info
EOF
}

# Create default frontend .env
create_default_frontend_env() {
    cat > frontend/.env << 'EOF'
# Backend API URL
VITE_API_URL=http://localhost:3001/api

# App Configuration
VITE_APP_NAME=Conversa Clone
VITE_APP_VERSION=1.0.0

# Feature Flags
VITE_ENABLE_AI_FEATURES=true
VITE_ENABLE_ANALYTICS=false

# Environment
VITE_ENV=development
EOF
}

# Install dependencies
install_dependencies() {
    print_header "📦 Installing Dependencies"
    
    # Root dependencies
    print_info "Installing root dependencies..."
    npm install
    print_success "Root dependencies installed"
    
    # Backend dependencies
    print_info "Installing backend dependencies..."
    cd backend
    npm install
    cd ..
    print_success "Backend dependencies installed"
    
    # Frontend dependencies
    print_info "Installing frontend dependencies..."
    cd frontend
    npm install
    cd ..
    print_success "Frontend dependencies installed"
}

# Setup database
setup_database() {
    print_header "🗄️  Setting Up Database"
    
    # Load backend environment variables
    if [ -f "backend/.env" ]; then
        export $(cat backend/.env | grep -v '^#' | xargs)
    fi
    
    print_info "Database: $DB_NAME"
    print_info "Host: $DB_HOST:$DB_PORT"
    
    # Check if database exists
    if command_exists psql; then
        print_info "Checking if database exists..."
        
        # Try to create database
        PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -lqt | cut -d \| -f 1 | grep -qw $DB_NAME
        
        if [ $? -eq 0 ]; then
            print_success "Database '$DB_NAME' already exists"
        else
            print_info "Creating database '$DB_NAME'..."
            PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -c "CREATE DATABASE $DB_NAME;" 2>/dev/null
            
            if [ $? -eq 0 ]; then
                print_success "Database created successfully"
            else
                print_warning "Could not create database automatically"
                print_info "Please create the database manually:"
                echo "  CREATE DATABASE $DB_NAME;"
            fi
        fi
    else
        print_warning "PostgreSQL client not available, skipping database creation"
        print_info "Please ensure database '$DB_NAME' exists"
    fi
}

# Setup Redis
setup_redis() {
    print_header "🔴 Checking Redis"
    
    if command_exists redis-cli; then
        # Check if Redis is running
        redis-cli ping >/dev/null 2>&1
        
        if [ $? -eq 0 ]; then
            print_success "Redis is running"
        else
            print_warning "Redis is not running"
            print_info "Start Redis with: redis-server"
            print_info "Or on macOS: brew services start redis"
            print_info "Or on Linux: sudo systemctl start redis"
        fi
    else
        print_warning "Redis not found"
        print_info "The application will work without Redis, but with limited features"
    fi
}

# Run migrations
run_migrations() {
    print_header "🔄 Running Database Migrations"
    
    if [ -f "backend/package.json" ]; then
        cd backend
        
        # Check if migrate script exists
        if npm run | grep -q "migrate"; then
            print_info "Running migrations..."
            npm run migrate 2>/dev/null
            
            if [ $? -eq 0 ]; then
                print_success "Migrations completed successfully"
            else
                print_warning "Migration script encountered an issue"
                print_info "You may need to run migrations manually later"
            fi
        else
            print_warning "No migration script found"
            print_info "Migrations may need to be run manually"
        fi
        
        cd ..
    fi
}

# Final checks
final_checks() {
    print_header "🔍 Running Final Checks"
    
    # Check if all required files exist
    local files_ok=true
    
    if [ -f "backend/.env" ]; then
        print_success "backend/.env exists"
    else
        print_error "backend/.env missing"
        files_ok=false
    fi
    
    if [ -f "frontend/.env" ]; then
        print_success "frontend/.env exists"
    else
        print_error "frontend/.env missing"
        files_ok=false
    fi
    
    if [ -d "backend/node_modules" ]; then
        print_success "backend/node_modules exists"
    else
        print_error "backend/node_modules missing"
        files_ok=false
    fi
    
    if [ -d "frontend/node_modules" ]; then
        print_success "frontend/node_modules exists"
    else
        print_error "frontend/node_modules missing"
        files_ok=false
    fi
    
    if [ "$files_ok" = false ]; then
        print_error "Some required files are missing"
        exit 1
    fi
}

# Run main function
main
