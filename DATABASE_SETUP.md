# PostgreSQL Setup Instructions

## 1. PostgreSQL Installation

### On Ubuntu:
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
```

### On macOS using Homebrew:
```bash
brew install postgresql
```

### On Windows:
Download the installer from the [official PostgreSQL website](https://www.postgresql.org/download/windows/) and follow the setup instructions.

## 2. Password Configuration

After installing PostgreSQL, it’s important to set a password for the default superuser (usually `postgres`). Use the following command:
```bash
sudo -u postgres psql
```
Then run:
```sql
ALTER USER postgres PASSWORD 'your_password';
```
Remember to replace `your_password` with a strong password.

## 3. Database Creation

To create a new database and user, run the following commands in `psql`:
```sql
CREATE DATABASE your_database;
CREATE USER your_user WITH PASSWORD 'your_user_password';
GRANT ALL PRIVILEGES ON DATABASE your_database TO your_user;
```
Replace `your_database` and `your_user` with your desired names and make sure to use a strong password for `your_user_password`.

## 4. Troubleshooting "Password Authentication Failed" Error

If you encounter the "password authentication failed" error, here are common causes and solutions:
- **Incorrect Password**: Ensure that you are typing the correct password.
- **pg_hba.conf Configuration**: Check the `pg_hba.conf` file for the authentication method. It should have an entry like:
  ```
  host    all             all             127.0.0.1/32            md5
  ```
  This means that passwords will be authenticated using MD5 encryption.
- **User Existence**: Ensure that the user exists. List users with:
  ```sql
  \oles
  ```
- **Server Running**: Make sure that the PostgreSQL server is running. You can start it with:
```bash
sudo service postgresql start
```

If you continue facing issues, check PostgreSQL logs for more details.
