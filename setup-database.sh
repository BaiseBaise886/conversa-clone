#!/bin/bash

# Variables
DB_USER="your_pg_user"
DB_PASSWORD="your_pg_password"
DB_NAME="your_database_name"

# Function to configure PostgreSQL
configure_postgresql() {
    echo "Configuring PostgreSQL..."
    sudo apt-get update
    sudo apt-get install -y postgresql postgresql-contrib

    # Setting up PostgreSQL user and database
    sudo -u postgres psql <<EOF
    CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
    CREATE DATABASE $DB_NAME OWNER $DB_USER;
    EOF

    echo "PostgreSQL has been configured. User and Database created."
}

# Function to run migrations
run_migrations() {
    echo "Running migrations..."
    # Assuming a Node.js app using a migration tool like Sequelize or TypeORM
    npm run migrate
    echo "Migrations completed."
}

# Function to start the application
start_application() {
    echo "Starting application..."
    npm start
}

# Main script execution
configure_postgresql
run_migrations
start_application
