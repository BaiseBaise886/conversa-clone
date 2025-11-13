# First-Run Setup Guide

This guide explains how to use the first-run setup wizard to configure your Conversa Clone installation.

## Overview

The first-run setup wizard automatically appears when you start the application for the first time. It guides you through:

1. Database connection configuration
2. Database creation
3. Schema migration
4. Admin user creation
5. Setup completion verification

## Prerequisites

Before starting the setup:

1. **MySQL/MariaDB Server**: Make sure MySQL or MariaDB is installed and running
   - For XAMPP: Start MySQL service in XAMPP Control Panel
   - For standalone: Run `mysql.server start` or `systemctl start mariadb`

2. **Database Credentials**: Have your database credentials ready
   - Default XAMPP: username `root`, password `` (empty)
   - Default MySQL: username `root`, password set during installation

3. **Port**: Ensure MySQL is running on port 3306 (or note your custom port)

## Setup Steps

### Step 1: Database Configuration

When you first access the application, you'll see the setup wizard.

**Fields to Configure:**
- **Host**: Database server hostname (default: `localhost`)
- **Port**: MySQL port (default: `3306`)
- **Username**: Database user (default: `root`)
- **Password**: Database password (leave empty for XAMPP default)
- **Database Name**: Name for your database (default: `conversa_clone`)

**Actions:**
1. Enter your database connection details
2. Click "Test Connection & Continue"
3. Wait for connection verification

**Troubleshooting:**
- "Connection refused": MySQL server is not running
- "Access denied": Check username and password
- "Unknown MySQL server host": Check hostname

### Step 2: Create Database

The wizard will create the database if it doesn't exist.

**Actions:**
1. Review the database name
2. Click "Create Database & Continue"

**Note:** If the database already exists, the wizard will detect it and continue.

### Step 3: Run Migrations

This step creates all necessary tables and schema.

**What Happens:**
- Creates 40+ tables for the application
- Sets up indexes for performance
- Creates default data structures
- Converts PostgreSQL schema to MySQL automatically

**Actions:**
1. Click "Run Migrations & Continue"
2. Wait for all migrations to complete (may take 30-60 seconds)

**Migration Files Executed:**
- `001_initial_schema.sql` - Core tables (users, organizations, contacts, channels)
- `002_ai_features.sql` - AI conversation and marketing features
- `003_ab_testing_analytics.sql` - A/B testing and analytics
- `004_multimedia_support.sql` - Media library and attachments
- `005_production_optimizations.sql` - Performance indexes and views

### Step 4: Create Admin User

Create your organization and admin user account.

**Fields to Configure:**
- **Organization Name**: Your company/organization name (e.g., "My Company")
- **Admin Name**: Your full name (e.g., "John Doe")
- **Email**: Your email address (used for login)
- **Password**: Choose a strong password (minimum 8 characters)
- **Confirm Password**: Re-enter password for verification

**Actions:**
1. Fill in all fields
2. Ensure passwords match
3. Click "Create Admin & Complete Setup"

**Password Requirements:**
- Minimum 8 characters
- Recommended: Mix of uppercase, lowercase, numbers, and symbols

**Role:** The user created here will have the "owner" role with full administrative access.

### Step 5: Setup Complete

You'll see a summary of the completed setup.

**Information Displayed:**
- Login credentials (email)
- Organization name
- Database statistics (number of tables, initial data)

**Actions:**
1. Note your login credentials
2. Click "Go to Login"
3. Log in with your email and password

## After Setup

### First Login

1. Navigate to `http://localhost:3000` (or your configured URL)
2. Enter your email and password
3. Click "Login"

### Next Steps

1. **Connect a Channel**: Go to Channels → Add WhatsApp or Instagram
2. **Create a Flow**: Design your first conversation flow
3. **Import Contacts**: Add contacts manually or via CSV
4. **Configure AI**: Set up OpenAI API key for AI features (optional)

### Update Environment Variables

After setup, you should update your `.env` file with the database credentials:

```bash
# Backend .env file
DB_HOST=localhost
DB_PORT=3306
DB_NAME=conversa_clone
DB_USER=root
DB_PASSWORD=your_password_here
```

This ensures the application uses the correct database on subsequent starts.

## Troubleshooting

### Setup Wizard Doesn't Appear

The wizard only appears when:
- No schema_migrations table exists, OR
- No migrations have been executed, OR
- No users exist in the database

**To Force Setup:**
1. Drop the database: `DROP DATABASE conversa_clone;`
2. Restart the application

### Migration Errors

**Error: "Table already exists"**
- The migration has been partially completed
- Safe to continue - the wizard tracks executed migrations

**Error: "Syntax error near..."**
- Some PostgreSQL-specific syntax wasn't converted
- Check the error details and report as an issue

**Error: "Permission denied"**
- Database user doesn't have CREATE/ALTER privileges
- Grant privileges: `GRANT ALL PRIVILEGES ON conversa_clone.* TO 'root'@'localhost';`

### Admin User Creation Fails

**Error: "User already exists"**
- A user with that email already exists
- Use a different email or reset the database

**Error: "Password too short"**
- Password must be at least 8 characters
- Choose a longer password

### Can't Access After Setup

**Browser shows "Cannot connect"**
- Backend server is not running
- Start backend: `cd backend && npm run dev`
- Start frontend: `cd frontend && npm run dev`

**Login fails with correct credentials**
- Check browser console for errors
- Verify backend is running on port 3001
- Check `.env` file has correct database credentials

## Security Notes

1. **Change Password**: After first login, change your password to something even stronger
2. **Database Password**: Use a strong password for your MySQL user in production
3. **Firewall**: Don't expose MySQL port (3306) to the internet
4. **HTTPS**: Use HTTPS in production (not HTTP)
5. **Backup**: Set up regular database backups

## Manual Setup (Alternative)

If you prefer to use the command-line migration tool:

```bash
cd backend
npm run migrate
```

This runs the same migrations but without the web UI.

## Database Schema

After setup completes, you'll have these main tables:

**Core Tables:**
- `organizations` - Company/organization data
- `users` - User accounts
- `user_organizations` - Links users to organizations
- `contacts` - Customer/contact information
- `channels` - Communication channels (WhatsApp, Instagram)
- `messages` - All messages sent/received

**Flow Tables:**
- `flows` - Conversation flow definitions
- `flow_nodes` - Individual nodes in flows
- `flow_edges` - Connections between nodes
- `flow_executions` - Flow execution tracking

**AI Tables:**
- `ai_conversations` - AI conversation sessions
- `marketing_brain` - AI marketing insights

**Analytics Tables:**
- `flow_journeys` - User journey through flows
- `ab_test_results` - A/B test metrics
- `node_analytics` - Per-node analytics

**Other Tables:**
- `media_library` - Uploaded files and media
- `message_queue` - Outbound message queue
- `typing_indicators` - Real-time typing status
- `user_presence` - User online/offline status

## Support

If you encounter issues during setup:

1. Check the browser console for JavaScript errors
2. Check backend logs for server errors
3. Verify MySQL is running and accessible
4. Review this guide for troubleshooting steps
5. Open an issue on GitHub with error details

## API Endpoints

The setup wizard uses these API endpoints:

- `GET /api/setup/status` - Check if setup is needed
- `POST /api/setup/test-connection` - Test database connection
- `POST /api/setup/create-database` - Create database
- `POST /api/setup/run-migrations` - Run migrations
- `POST /api/setup/create-admin` - Create admin user
- `POST /api/setup/stats` - Get database statistics
- `POST /api/setup/complete` - Run all steps at once

These endpoints are available without authentication for first-run setup only.
