import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Database configuration with MySQL/XAMPP defaults
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME || 'conversa_clone',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  connectTimeout: 10000,
  acquireTimeout: 10000,
  timeout: 60000, // 60 second query timeout for long migrations
};

// Create pool with configuration
export const pool = mysql.createPool(dbConfig);

// Connection event handlers
pool.on('connection', (connection) => {
  console.log('✅ MySQL database connection established');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected MySQL database error:', err);
  console.log('\n💡 MySQL/XAMPP Troubleshooting Guide:');
  console.log('1. Verify MySQL is running in XAMPP Control Panel');
  console.log('   - Start Apache and MySQL services');
  console.log('\n2. Check if database exists:');
  console.log('   - Open phpMyAdmin: http://localhost/phpmyadmin');
  console.log('   - Or use MySQL CLI: mysql -u root');
  console.log('\n3. Create database if missing:');
  console.log('   - In phpMyAdmin, click "New" and create "conversa_clone"');
  console.log('   - Or use MySQL CLI: CREATE DATABASE conversa_clone;');
  console.log('\n4. Verify credentials in backend/.env file');
  console.log('   - Default XAMPP user: root');
  console.log('   - Default XAMPP password: (empty string)');
  console.log('   - Default port: 3306');
  console.log('\n5. Run migrations:');
  console.log('   cd backend && npm run migrate\n');
});

// Test connection with retry logic
async function testConnection(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const [rows] = await pool.query('SELECT NOW() as now');
      console.log('✅ MySQL database connected successfully at:', rows[0].now);
      console.log(`📊 Database: ${dbConfig.database} on ${dbConfig.host}:${dbConfig.port}`);
      return true;
    } catch (err) {
      console.error(`❌ MySQL connection attempt ${i + 1}/${retries} failed:`, err.message);
      
      if (i === retries - 1) {
        console.log('\n💡 Quick Fix for XAMPP:');
        console.log('1. Ensure MySQL is running in XAMPP Control Panel');
        console.log('2. Create the database in phpMyAdmin: http://localhost/phpmyadmin');
        console.log('3. Database name: conversa_clone');
        console.log('4. Update backend/.env with correct credentials (user: root, password: empty)');
        console.log('5. Run: cd backend && npm run migrate\n');
        return false;
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  return false;
}

// Run connection test
testConnection();

// Query helper function that converts PostgreSQL parameterized queries ($1, $2, etc.) to MySQL format (?, ?)
export const query = async (text, params) => {
  // Convert PostgreSQL parameter syntax ($1, $2, etc.) to MySQL syntax (?, ?)
  let mysqlQuery = text;
  if (params && params.length > 0) {
    // Replace $1, $2, $3, etc. with ?
    for (let i = params.length; i >= 1; i--) {
      mysqlQuery = mysqlQuery.replace(new RegExp(`\\$${i}\\b`, 'g'), '?');
    }
  }
  
  const [rows] = await pool.query(mysqlQuery, params);
  
  // Return result in PostgreSQL-compatible format for backward compatibility
  return { rows };
};

export default pool;