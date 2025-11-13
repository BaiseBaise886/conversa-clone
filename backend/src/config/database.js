import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'conversa_clone',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
  console.log('✅ Database connection established');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err);
  process.exit(-1);
});

// Test connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection failed:', err);
    console.log('\n💡 Troubleshooting:');
    console.log('1. Check if PostgreSQL is running: sudo systemctl status postgresql');
    console.log('2. Verify database exists: psql -U postgres -l');
    console.log('3. Check credentials in .env file');
    console.log('4. Run setup: ./setup.sh\n');
  } else {
    console.log('✅ Database connected successfully at:', res.rows[0].now);
  }
});

export const query = (text, params) => pool.query(text, params);

export default pool;