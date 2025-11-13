#!/bin/bash

set -e

echo "=========================================="
echo "🚀 Conversa Clone Database Setup"
echo "=========================================="
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "📦 Checking PostgreSQL installation..."
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ PostgreSQL is not installed${NC}"
    echo "Installing PostgreSQL..."
    sudo apt update
    sudo apt install -y postgresql postgresql-contrib
    echo -e "${GREEN}✅ PostgreSQL installed${NC}"
else
    echo -e "${GREEN}✅ PostgreSQL is already installed${NC}"
fi

echo ""
echo "🔄 Starting PostgreSQL service..."
sudo systemctl start postgresql
sudo systemctl enable postgresql
echo -e "${GREEN}✅ PostgreSQL service started${NC}"

echo ""
echo "🔐 Configuring PostgreSQL authentication..."
DB_PASSWORD="password"

sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || {
    PG_HBA_FILE=$(sudo -u postgres psql -t -P format=unaligned -c "SHOW hba_file;" 2>/dev/null | head -1)
    if [ -n "$PG_HBA_FILE" ]; then
        sudo sed -i.backup 's/local.*all.*postgres.*peer/local   all             postgres                                trust/' "$PG_HBA_FILE"
        sudo systemctl restart postgresql
        sleep 2
        sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD '$DB_PASSWORD';"
        sudo sed -i 's/local.*all.*postgres.*trust/local   all             postgres                                md5/' "$PG_HBA_FILE"
        sudo systemctl restart postgresql
        sleep 2
    fi
}

echo -e "${GREEN}✅ PostgreSQL authentication configured${NC}"

echo ""
echo "🗄️  Creating database..."
export PGPASSWORD="$DB_PASSWORD"
psql -U postgres -h localhost -c "DROP DATABASE IF EXISTS conversa_clone;" 2>/dev/null || true
psql -U postgres -h localhost -c "CREATE DATABASE conversa_clone;"
echo -e "${GREEN}✅ Database 'conversa_clone' created${NC}"

echo ""
echo "📝 Updating backend/.env file..."
cd backend
sed -i 's/^DB_PASSWORD=.*/DB_PASSWORD=password/' .env
echo -e "${GREEN}✅ .env file updated${NC}"

echo ""
echo "🔄 Running database migrations..."
npm run migrate 2>/dev/null || echo -e "${YELLOW}⚠️  Migrations skipped${NC}"

unset PGPASSWORD

echo ""
echo "=========================================="
echo -e "${GREEN}✅ Database setup completed!${NC}"
echo "=========================================="
echo ""
echo "You can now start with: cd .. && npm run dev"
echo ""