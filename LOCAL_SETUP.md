# Local Setup Guide for Linux

This guide shows you how to set up Conversa Clone on your Linux machine using the automated setup script.

## Quick Start (One Command)

```bash
chmod +x setup-local.sh && ./setup-local.sh
```

That's it! The script will guide you through the entire setup process.

## What the Script Does

The `setup-local.sh` script automates the entire installation process:

1. ✓ Checks system requirements (Node.js, MySQL/MariaDB)
2. ✓ Configures database connection
3. ✓ Creates database and schema
4. ✓ Generates environment files (.env)
5. ✓ Installs all dependencies
6. ✓ Runs database migrations
7. ✓ Creates your admin user account
8. ✓ Sets up start/stop scripts
9. ✓ Optionally starts the application

## Prerequisites

Before running the setup script, ensure you have:

### Required

- **Linux** (Ubuntu, Debian, Fedora, Arch, etc.)
- **Node.js 18+** 
- **npm** (comes with Node.js)
- **MySQL 8.0+** or **MariaDB 10.3+**

### Installation Commands

**Ubuntu/Debian:**
```bash
# Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# MySQL
sudo apt-get install mysql-server
sudo systemctl start mysql
sudo mysql_secure_installation

# OR MariaDB
sudo apt-get install mariadb-server
sudo systemctl start mariadb
sudo mysql_secure_installation
```

**Fedora/RHEL/CentOS:**
```bash
# Node.js 18+
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo dnf install -y nodejs

# MySQL
sudo dnf install mysql-server
sudo systemctl start mysqld

# OR MariaDB
sudo dnf install mariadb-server
sudo systemctl start mariadb
```

**Arch Linux:**
```bash
# Node.js
sudo pacman -S nodejs npm

# MySQL
sudo pacman -S mysql
sudo systemctl start mysqld

# OR MariaDB
sudo pacman -S mariadb
sudo systemctl start mariadb
```

## Step-by-Step Usage

### 1. Download and Run

```bash
# Make the script executable (if not already)
chmod +x setup-local.sh

# Run the setup
./setup-local.sh
```

### 2. Follow the Prompts

The script will ask you for:

#### Database Configuration
- **Host**: Usually `localhost` (press Enter for default)
- **Port**: Usually `3306` (press Enter for default)
- **Database Name**: `conversa_clone` (or your preferred name)
- **Username**: Usually `root` (press Enter for default)
- **Password**: Your MySQL/MariaDB root password

#### Admin User Creation
- **Organization Name**: Your company/organization name
- **Admin Name**: Your full name
- **Admin Email**: Email for login (e.g., `admin@mycompany.com`)
- **Admin Password**: Secure password (minimum 8 characters)

### 3. Start the Application

After setup completes, you can start the application:

```bash
./start.sh
```

Or the script will offer to start it automatically.

### 4. Access the Application

Open your browser and go to:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001

Login with the email and password you created during setup.

## Managing the Application

### Start Services

```bash
./start.sh
```

This starts both backend (port 3001) and frontend (port 3000) servers.

### Stop Services

```bash
./stop.sh
```

Or press `Ctrl+C` in the terminal running `start.sh`.

### Restart Services

```bash
./stop.sh && ./start.sh
```

### View Logs

When running `./start.sh`, logs from both services appear in the terminal.

To run in background:
```bash
./start.sh > logs.txt 2>&1 &
```

## Configuration Files

After setup, you'll have these configuration files:

### backend/.env
```bash
DB_HOST=localhost
DB_PORT=3306
DB_NAME=conversa_clone
DB_USER=root
DB_PASSWORD=your_password

PORT=3001
NODE_ENV=development
JWT_SECRET=generated_secret
FRONTEND_URL=http://localhost:3000
```

### frontend/.env
```bash
VITE_API_URL=http://localhost:3001/api
VITE_WS_URL=http://localhost:3001
```

You can edit these files to change configuration.

## Troubleshooting

### Script Fails at Requirements Check

**Problem**: Node.js version too old
```bash
# Update Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Problem**: MySQL not running
```bash
# Start MySQL
sudo systemctl start mysql

# OR MariaDB
sudo systemctl start mariadb

# Enable on boot
sudo systemctl enable mysql
```

### Database Connection Fails

**Problem**: Access denied for user 'root'
```bash
# Reset MySQL root password
sudo mysql
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'new_password';
FLUSH PRIVILEGES;
exit;
```

**Problem**: Can't connect to MySQL socket
```bash
# Check if MySQL is running
sudo systemctl status mysql

# Check MySQL socket location
sudo mysqladmin -u root -p variables | grep socket
```

### Port Already in Use

**Problem**: Port 3000 or 3001 already in use

```bash
# Find and kill process on port 3001
sudo lsof -ti:3001 | xargs kill -9

# Find and kill process on port 3000
sudo lsof -ti:3000 | xargs kill -9

# Or use stop script
./stop.sh
```

### Dependencies Installation Fails

**Problem**: npm install errors

```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
cd backend
rm -rf node_modules package-lock.json
npm install

cd ../frontend
rm -rf node_modules package-lock.json
npm install
```

### Migration Fails

**Problem**: Table already exists

The setup script tracks migrations. If migration fails:

```bash
# Option 1: Drop database and rerun
mysql -u root -p
DROP DATABASE conversa_clone;
exit
./setup-local.sh

# Option 2: Manual migration
cd backend
npm run migrate
```

## Manual Setup (Alternative)

If you prefer manual setup:

### 1. Create Database
```bash
mysql -u root -p
CREATE DATABASE conversa_clone CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
exit;
```

### 2. Create .env Files
Copy and edit:
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Edit with your configuration.

### 3. Install Dependencies
```bash
cd backend && npm install
cd ../frontend && npm install
```

### 4. Run Migrations
```bash
cd backend
npm run migrate
```

### 5. Start Services
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

## Production Deployment

For production deployment:

1. Change `NODE_ENV=production` in backend/.env
2. Generate new `JWT_SECRET` and `SESSION_SECRET`
3. Use a process manager like PM2
4. Set up Nginx as reverse proxy
5. Enable HTTPS with Let's Encrypt
6. Set up proper database backups

See [PRODUCTION_DEPLOYMENT_GUIDE.md](PRODUCTION_DEPLOYMENT_GUIDE.md) for details.

## What Gets Installed

### Backend Dependencies
- Express.js (web framework)
- MySQL2 (database driver)
- Socket.io (WebSocket)
- JWT (authentication)
- Bcrypt (password hashing)
- And more...

### Frontend Dependencies
- React 18
- Vite (build tool)
- Socket.io-client
- TailwindCSS (optional)
- And more...

### Database Schema
- 40+ tables for complete functionality
- Users, organizations, contacts
- Channels (WhatsApp, Instagram)
- Flows and automation
- AI conversations
- Analytics and A/B testing
- Media library
- Message queue

## Environment Variables

### Backend Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| DB_HOST | Database hostname | localhost |
| DB_PORT | Database port | 3306 |
| DB_NAME | Database name | conversa_clone |
| DB_USER | Database user | root |
| DB_PASSWORD | Database password | (empty) |
| PORT | Backend port | 3001 |
| NODE_ENV | Environment | development |
| JWT_SECRET | JWT signing secret | (generated) |
| FRONTEND_URL | Frontend URL | http://localhost:3000 |
| OPENAI_API_KEY | OpenAI API key (optional) | - |

### Frontend Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| VITE_API_URL | Backend API URL | http://localhost:3001/api |
| VITE_WS_URL | WebSocket URL | http://localhost:3001 |

## Next Steps After Setup

1. **Connect a Channel**
   - Go to Channels → Add WhatsApp/Instagram
   - Scan QR code to connect

2. **Create Your First Flow**
   - Go to Flows → Create New Flow
   - Design conversation automation

3. **Add Contacts**
   - Go to Contacts → Add Contact
   - Import from CSV (optional)

4. **Configure AI** (optional)
   - Add OpenAI API key in backend/.env
   - Restart backend: `./stop.sh && ./start.sh`

5. **Explore Features**
   - Multi-chat interface
   - Live chat
   - Marketing automation
   - Analytics dashboard
   - A/B testing

## Getting Help

If you encounter issues:

1. Check this troubleshooting guide
2. Review the logs in terminal
3. Check [FIRST_RUN_SETUP.md](FIRST_RUN_SETUP.md) for web-based setup
4. Open an issue on GitHub with:
   - Error message
   - Linux distribution and version
   - Node.js version (`node -v`)
   - MySQL/MariaDB version
   - Steps to reproduce

## System Requirements

### Minimum
- 2 GB RAM
- 2 CPU cores
- 5 GB disk space
- Ubuntu 20.04+ / Debian 11+ / Fedora 35+

### Recommended
- 4 GB RAM
- 4 CPU cores
- 10 GB disk space
- Ubuntu 22.04+ / Debian 12+

## Security Notes

For local development, the defaults are fine. For production:

- ✓ Change all default passwords
- ✓ Use strong JWT_SECRET
- ✓ Enable HTTPS
- ✓ Set up firewall
- ✓ Regular database backups
- ✓ Keep dependencies updated
- ✓ Use environment-specific configs

## Uninstall

To completely remove Conversa Clone:

```bash
# Stop services
./stop.sh

# Remove database
mysql -u root -p
DROP DATABASE conversa_clone;
exit;

# Remove files
cd ..
rm -rf conversa-clone

# Remove dependencies (optional)
# This removes Node.js and MySQL - only do if not needed for other apps
sudo apt-get remove nodejs mysql-server
```

## License

MIT License - See LICENSE file for details
