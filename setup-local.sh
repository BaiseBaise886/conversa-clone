#!/bin/bash

# ============================================
# Conversa Clone - Local Setup Script
# ============================================
# This script sets up Conversa Clone on Linux
# Prerequisites: MySQL/MariaDB, Node.js 18+
# ============================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Emojis
CHECK="✓"
CROSS="✗"
ROCKET="🚀"
DATABASE="🗄️"
LOCK="🔒"
WRENCH="🔧"
PACKAGE="📦"

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ============================================
# Functions
# ============================================

print_header() {
    echo ""
    echo -e "${CYAN}============================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}============================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}${CHECK}${NC} $1"
}

print_error() {
    echo -e "${RED}${CROSS}${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC}  $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC}  $1"
}

check_command() {
    if command -v "$1" &> /dev/null; then
        print_success "$1 is installed"
        return 0
    else
        print_error "$1 is not installed"
        return 1
    fi
}

# ============================================
# Welcome
# ============================================

clear
echo ""
echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                                        ║${NC}"
echo -e "${CYAN}║      ${GREEN}CONVERSA CLONE SETUP${CYAN}             ║${NC}"
echo -e "${CYAN}║      ${YELLOW}Local Installation Script${CYAN}       ║${NC}"
echo -e "${CYAN}║                                        ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}This script will:${NC}"
echo "  1. Check system requirements"
echo "  2. Install dependencies"
echo "  3. Configure database"
echo "  4. Run migrations"
echo "  5. Create admin user"
echo "  6. Start the application"
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."

# ============================================
# Step 1: Check Requirements
# ============================================

print_header "${WRENCH} Step 1: Checking System Requirements"

REQUIREMENTS_MET=true

# Check Node.js
if check_command "node"; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 18 ]; then
        print_success "Node.js version is compatible (v$(node -v))"
    else
        print_error "Node.js version must be 18 or higher (current: v$(node -v))"
        REQUIREMENTS_MET=false
    fi
else
    print_error "Node.js is not installed"
    print_info "Install Node.js 18+ from: https://nodejs.org/"
    REQUIREMENTS_MET=false
fi

# Check npm
if check_command "npm"; then
    print_success "npm is installed (v$(npm -v))"
else
    print_error "npm is not installed"
    REQUIREMENTS_MET=false
fi

# Check MySQL
MYSQL_CMD=""
if check_command "mysql"; then
    MYSQL_CMD="mysql"
    print_success "MySQL is installed"
elif check_command "mariadb"; then
    MYSQL_CMD="mariadb"
    print_success "MariaDB is installed"
else
    print_error "MySQL or MariaDB is not installed"
    print_info "Install MySQL: sudo apt-get install mysql-server"
    print_info "Or MariaDB: sudo apt-get install mariadb-server"
    REQUIREMENTS_MET=false
fi

# Check if MySQL is running
if [ -n "$MYSQL_CMD" ]; then
    if systemctl is-active --quiet mysql || systemctl is-active --quiet mariadb || pgrep -x mysqld > /dev/null; then
        print_success "MySQL/MariaDB service is running"
    else
        print_warning "MySQL/MariaDB service is not running"
        echo -e "${YELLOW}Would you like to start it? (requires sudo)${NC}"
        read -p "Start MySQL/MariaDB? (y/n): " START_MYSQL
        if [ "$START_MYSQL" = "y" ] || [ "$START_MYSQL" = "Y" ]; then
            if sudo systemctl start mysql 2>/dev/null || sudo systemctl start mariadb 2>/dev/null; then
                print_success "MySQL/MariaDB started successfully"
            else
                print_error "Failed to start MySQL/MariaDB"
                REQUIREMENTS_MET=false
            fi
        else
            print_error "MySQL/MariaDB must be running to continue"
            REQUIREMENTS_MET=false
        fi
    fi
fi

if [ "$REQUIREMENTS_MET" = false ]; then
    echo ""
    print_error "Please install missing requirements and run this script again"
    exit 1
fi

echo ""
print_success "All requirements met!"

# ============================================
# Step 2: Database Configuration
# ============================================

print_header "${DATABASE} Step 2: Database Configuration"

# Default values
DB_HOST="localhost"
DB_PORT="3306"
DB_NAME="conversa_clone"
DB_USER="root"
DB_PASSWORD=""

echo "Enter your database configuration (press Enter for defaults):"
echo ""

read -p "Database host [localhost]: " input
DB_HOST="${input:-$DB_HOST}"

read -p "Database port [3306]: " input
DB_PORT="${input:-$DB_PORT}"

read -p "Database name [conversa_clone]: " input
DB_NAME="${input:-$DB_NAME}"

read -p "Database user [root]: " input
DB_USER="${input:-$DB_USER}"

read -s -p "Database password (leave empty if no password): " DB_PASSWORD
echo ""

echo ""
print_info "Testing database connection..."

# Test connection
if [ -z "$DB_PASSWORD" ]; then
    MYSQL_CONNECT="$MYSQL_CMD -h$DB_HOST -P$DB_PORT -u$DB_USER"
else
    MYSQL_CONNECT="$MYSQL_CMD -h$DB_HOST -P$DB_PORT -u$DB_USER -p$DB_PASSWORD"
fi

if $MYSQL_CONNECT -e "SELECT 1;" &> /dev/null; then
    print_success "Database connection successful"
else
    print_error "Failed to connect to database"
    print_info "Please check your credentials and try again"
    exit 1
fi

# Check if database exists
DB_EXISTS=$($MYSQL_CONNECT -e "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME='$DB_NAME';" 2>/dev/null | grep -c "$DB_NAME" || true)

if [ "$DB_EXISTS" -eq 1 ]; then
    print_warning "Database '$DB_NAME' already exists"
    read -p "Do you want to drop and recreate it? (y/n): " DROP_DB
    if [ "$DROP_DB" = "y" ] || [ "$DROP_DB" = "Y" ]; then
        print_info "Dropping existing database..."
        $MYSQL_CONNECT -e "DROP DATABASE \`$DB_NAME\`;" 2>/dev/null || true
        print_success "Database dropped"
    fi
fi

# Create database
DB_EXISTS=$($MYSQL_CONNECT -e "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME='$DB_NAME';" 2>/dev/null | grep -c "$DB_NAME" || true)
if [ "$DB_EXISTS" -eq 0 ]; then
    print_info "Creating database '$DB_NAME'..."
    $MYSQL_CONNECT -e "CREATE DATABASE \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    print_success "Database created"
else
    print_info "Using existing database '$DB_NAME'"
fi

# ============================================
# Step 3: Create .env Files
# ============================================

print_header "${WRENCH} Step 3: Creating Environment Files"

# Backend .env
BACKEND_ENV="backend/.env"
print_info "Creating backend/.env file..."

cat > "$BACKEND_ENV" << EOF
# Database Configuration
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD

# Server Configuration
PORT=3001
NODE_ENV=development

# JWT Secret (change in production!)
JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || echo "change-this-secret-in-production-$(date +%s)")

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Redis Configuration (optional - leave commented if not using Redis)
# REDIS_HOST=localhost
# REDIS_PORT=6379
# REDIS_PASSWORD=

# OpenAI Configuration (optional - for AI features)
# OPENAI_API_KEY=your_openai_api_key_here

# File Upload Configuration
UPLOAD_DIR=uploads
MAX_FILE_SIZE=10485760

# Session Configuration
SESSION_SECRET=$(openssl rand -base64 32 2>/dev/null || echo "change-this-session-secret-$(date +%s)")

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
EOF

print_success "Backend .env created"

# Frontend .env
FRONTEND_ENV="frontend/.env"
print_info "Creating frontend/.env file..."

cat > "$FRONTEND_ENV" << EOF
# API Configuration
VITE_API_URL=http://localhost:3001/api
VITE_WS_URL=http://localhost:3001

# App Configuration
VITE_APP_NAME=Conversa Clone
VITE_APP_VERSION=1.0.0
EOF

print_success "Frontend .env created"

# ============================================
# Step 4: Install Dependencies
# ============================================

print_header "${PACKAGE} Step 4: Installing Dependencies"

print_info "Installing backend dependencies..."
cd backend
npm install --silent
cd ..
print_success "Backend dependencies installed"

print_info "Installing frontend dependencies..."
cd frontend
npm install --silent
cd ..
print_success "Frontend dependencies installed"

# ============================================
# Step 5: Run Database Migrations
# ============================================

print_header "${DATABASE} Step 5: Running Database Migrations"

print_info "Running database migrations..."
cd backend
npm run migrate
cd ..

# ============================================
# Step 6: Create Admin User
# ============================================

print_header "${LOCK} Step 6: Create Admin User"

echo "Create your admin account:"
echo ""

read -p "Organization name [My Organization]: " ORG_NAME
ORG_NAME="${ORG_NAME:-My Organization}"

read -p "Admin name [Admin User]: " ADMIN_NAME
ADMIN_NAME="${ADMIN_NAME:-Admin User}"

read -p "Admin email [admin@conversa.com]: " ADMIN_EMAIL
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@conversa.com}"

while true; do
    read -s -p "Admin password (min 8 characters): " ADMIN_PASSWORD
    echo ""
    if [ ${#ADMIN_PASSWORD} -lt 8 ]; then
        print_error "Password must be at least 8 characters"
        continue
    fi
    read -s -p "Confirm password: " ADMIN_PASSWORD_CONFIRM
    echo ""
    if [ "$ADMIN_PASSWORD" = "$ADMIN_PASSWORD_CONFIRM" ]; then
        break
    else
        print_error "Passwords do not match"
    fi
done

# Create admin user using Node.js script
print_info "Creating admin user..."

cat > backend/create-admin.js << 'EOFSCRIPT'
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

async function createAdmin() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  });

  try {
    const orgName = process.argv[2];
    const adminName = process.argv[3];
    const adminEmail = process.argv[4];
    const adminPassword = process.argv[5];

    // Check if user exists
    const [existingUsers] = await pool.query(
      'SELECT id FROM users WHERE email = ?',
      [adminEmail]
    );

    if (existingUsers.length > 0) {
      console.log('User with this email already exists');
      process.exit(1);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    // Create organization
    const [orgResult] = await pool.query(
      'INSERT INTO organizations (name, plan) VALUES (?, ?)',
      [orgName, 'pro']
    );
    const orgId = orgResult.insertId;

    // Create user
    const [userResult] = await pool.query(
      'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
      [adminEmail, passwordHash, adminName]
    );
    const userId = userResult.insertId;

    // Link user to organization
    await pool.query(
      'INSERT INTO user_organizations (user_id, organization_id, role) VALUES (?, ?, ?)',
      [userId, orgId, 'owner']
    );

    console.log('SUCCESS');
    process.exit(0);
  } catch (error) {
    console.error('ERROR:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createAdmin();
EOFSCRIPT

cd backend
RESULT=$(node create-admin.js "$ORG_NAME" "$ADMIN_NAME" "$ADMIN_EMAIL" "$ADMIN_PASSWORD" 2>&1)
rm -f create-admin.js
cd ..

if echo "$RESULT" | grep -q "SUCCESS"; then
    print_success "Admin user created successfully"
else
    print_error "Failed to create admin user: $RESULT"
    exit 1
fi

# ============================================
# Step 7: Create Start Scripts
# ============================================

print_header "${ROCKET} Step 7: Creating Start Scripts"

# Create start script
cat > start.sh << 'EOF'
#!/bin/bash

# Start script for Conversa Clone

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Starting Conversa Clone..."
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start backend
echo "Starting backend server..."
cd backend
npm run dev &
BACKEND_PID=$!
cd ..

# Wait a bit for backend to start
sleep 3

# Start frontend
echo "Starting frontend server..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "╔════════════════════════════════════════╗"
echo "║                                        ║"
echo "║      Conversa Clone is running!        ║"
echo "║                                        ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "📊 Backend:  http://localhost:3001"
echo "🌐 Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for processes
wait $BACKEND_PID $FRONTEND_PID
EOF

chmod +x start.sh
print_success "Created start.sh script"

# Create stop script
cat > stop.sh << 'EOF'
#!/bin/bash

echo "Stopping Conversa Clone..."

# Kill processes on ports
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

echo "✓ All services stopped"
EOF

chmod +x stop.sh
print_success "Created stop.sh script"

# ============================================
# Final Summary
# ============================================

print_header "${CHECK} Setup Complete!"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                        ║${NC}"
echo -e "${GREEN}║      Setup completed successfully!     ║${NC}"
echo -e "${GREEN}║                                        ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Your Configuration:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  ${BLUE}Database:${NC}      $DB_NAME"
echo -e "  ${BLUE}Host:${NC}          $DB_HOST:$DB_PORT"
echo -e "  ${BLUE}Organization:${NC}  $ORG_NAME"
echo -e "  ${BLUE}Admin Email:${NC}   $ADMIN_EMAIL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${CYAN}Next Steps:${NC}"
echo ""
echo "  1. Start the application:"
echo -e "     ${GREEN}./start.sh${NC}"
echo ""
echo "  2. Open your browser:"
echo -e "     ${BLUE}http://localhost:3000${NC}"
echo ""
echo "  3. Login with your credentials:"
echo -e "     Email: ${YELLOW}$ADMIN_EMAIL${NC}"
echo ""
echo "  4. To stop the application:"
echo -e "     ${GREEN}./stop.sh${NC} or press ${GREEN}Ctrl+C${NC}"
echo ""
echo -e "${YELLOW}⚠  Important:${NC}"
echo "  - Save your password securely"
echo "  - Change JWT_SECRET in backend/.env for production"
echo "  - Configure OpenAI API key in backend/.env for AI features"
echo "  - Set up Redis for better performance (optional)"
echo ""
echo -e "${GREEN}Happy automating! 🚀${NC}"
echo ""

# Ask if user wants to start now
read -p "Start the application now? (y/n): " START_NOW
if [ "$START_NOW" = "y" ] || [ "$START_NOW" = "Y" ]; then
    echo ""
    ./start.sh
fi
