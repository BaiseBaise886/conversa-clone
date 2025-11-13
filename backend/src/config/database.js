import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Database configuration with better defaults
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'conversa_clone',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

// Create pool with configuration
export const pool = new Pool(dbConfig);

// Connection event handlers
pool.on('connect', (client) => {
  console.log('✅ Database connection established');
});

pool.on('error', (err, client) => {
  console.error('❌ Unexpected database error:', err);
  console.log('\n💡 Database Troubleshooting Guide:');
  console.log('1. Verify PostgreSQL is running:');
  console.log('   sudo systemctl status postgresql');
  console.log('   OR');
  console.log('   brew services list (macOS)');
  console.log('\n2. Check if database exists:');
  console.log('   psql -U postgres -l');
  console.log('\n3. Create database if missing:');
  console.log('   psql -U postgres -c "CREATE DATABASE conversa_clone;"');
  console.log('\n4. Verify credentials in backend/.env file');
  console.log('\n5. Run migrations:');
  console.log('   cd backend && npm run migrate\n');
});

// Test connection with retry logic
async function testConnection(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await pool.query('SELECT NOW()');
      console.log('✅ Database connected successfully at:', res.rows[0].now);
      console.log(`📊 Database: ${dbConfig.database} on ${dbConfig.host}:${dbConfig.port}`);
      return true;
    } catch (err) {
      console.error(`❌ Database connection attempt ${i + 1}/${retries} failed:`, err.message);
      
      if (i === retries - 1) {
        console.log('\n💡 Quick Fix:');
        console.log('1. Ensure PostgreSQL is installed and running');
        console.log('2. Create the database: createdb conversa_clone');
        console.log('3. Update backend/.env with correct credentials');
        console.log('4. Run: cd backend && npm run migrate\n');
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

// Query helper function
export const query = (text, params) => pool.query(text, params);

export default pool;