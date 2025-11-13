import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './database.js';
import bcrypt from 'bcrypt';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  title: (msg) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}\n`)
};

async function createMigrationsTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  
  try {
    await pool.query(query);
    log.success('Migrations tracking table ready');
  } catch (error) {
    log.error('Failed to create migrations table');
    throw error;
  }
}

async function getExecutedMigrations() {
  try {
    const result = await pool.query(
      'SELECT filename FROM schema_migrations ORDER BY id'
    );
    return result.rows.map(row => row.filename);
  } catch (error) {
    return [];
  }
}

async function markMigrationAsExecuted(filename) {
  await pool.query(
    'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
    [filename]
  );
}

async function executeMigration(filepath, filename) {
  log.info(`Executing: ${filename}`);
  
  try {
    const sql = fs.readFileSync(filepath, 'utf8');
    
    // Split by semicolon but keep statement together
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      if (statement) {
        await pool.query(statement);
      }
    }
    
    await markMigrationAsExecuted(filename);
    log.success(`Completed: ${filename}`);
    return true;
  } catch (error) {
    log.error(`Failed: ${filename}`);
    log.error(`Error: ${error.message}`);
    return false;
  }
}

async function runMigrations() {
  log.title('🚀 Database Migration Tool');
  
  try {
    // Create migrations tracking table
    await createMigrationsTable();
    
    // Get list of executed migrations
    const executedMigrations = await getExecutedMigrations();
    log.info(`Previously executed: ${executedMigrations.length} migrations`);
    
    // Get all migration files
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    if (files.length === 0) {
      log.warning('No migration files found');
      return;
    }
    
    log.info(`Found ${files.length} migration file(s)`);
    
    // Execute pending migrations
    let executed = 0;
    let skipped = 0;
    
    for (const file of files) {
      if (executedMigrations.includes(file)) {
        log.info(`Skipping (already executed): ${file}`);
        skipped++;
        continue;
      }
      
      const filepath = path.join(MIGRATIONS_DIR, file);
      const success = await executeMigration(filepath, file);
      
      if (success) {
        executed++;
      } else {
        throw new Error(`Migration failed: ${file}`);
      }
    }
    
    console.log('\n' + '═'.repeat(50));
    log.success(`Migration Summary:`);
    console.log(`  Executed: ${executed}`);
    console.log(`  Skipped:  ${skipped}`);
    console.log(`  Total:    ${files.length}`);
    console.log('═'.repeat(50) + '\n');
    
  } catch (error) {
    log.error('Migration process failed');
    log.error(error.message);
    throw error;
  }
}

async function fixDefaultUser() {
  log.title('🔧 Fixing Default User Password');
  
  try {
    // Check if default user exists
    const userCheck = await pool.query(
      "SELECT id FROM users WHERE email = 'admin@demo.com'"
    );
    
    if (userCheck.rows.length === 0) {
      log.warning('Default user not found, creating...');
      
      const passwordHash = await bcrypt.hash('admin123', 10);
      
      // Create organization first
      const orgResult = await pool.query(
        "INSERT INTO organizations (name, plan) VALUES ('Demo Organization', 'pro') RETURNING id"
      );
      const orgId = orgResult.rows[0].id;
      
      // Create user
      const userResult = await pool.query(
        "INSERT INTO users (email, password_hash, name) VALUES ('admin@demo.com', $1, 'Admin User') RETURNING id",
        [passwordHash]
      );
      const userId = userResult.rows[0].id;
      
      // Link user to organization
      await pool.query(
        'INSERT INTO user_organizations (user_id, organization_id, role) VALUES ($1, $2, $3)',
        [userId, orgId, 'admin']
      );
      
      log.success('Default user created successfully');
    } else {
      log.info('Default user exists, updating password...');
      
      const passwordHash = await bcrypt.hash('admin123', 10);
      await pool.query(
        "UPDATE users SET password_hash = $1 WHERE email = 'admin@demo.com'",
        [passwordHash]
      );
      
      log.success('Default user password updated');
    }
    
    log.info('Login credentials:');
    console.log(`  Email:    admin@demo.com`);
    console.log(`  Password: admin123`);
    console.log(`  ${colors.yellow}⚠  Please change this password after first login!${colors.reset}\n`);
    
  } catch (error) {
    log.error('Failed to fix default user');
    log.error(error.message);
    throw error;
  }
}

async function refreshMaterializedViews() {
  log.title('🔄 Refreshing Materialized Views');
  
  try {
    // Check if materialized view exists
    const viewCheck = await pool.query(
      `SELECT schemaname, matviewname 
       FROM pg_matviews 
       WHERE matviewname = 'conversation_list'`
    );
    
    if (viewCheck.rows.length > 0) {
      log.info('Refreshing conversation_list view...');
      await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY conversation_list');
      log.success('Materialized views refreshed');
    } else {
      log.info('No materialized views to refresh yet');
    }
  } catch (error) {
    log.warning('Could not refresh materialized views (this is normal for new installations)');
  }
}

async function showDatabaseStats() {
  log.title('📊 Database Statistics');
  
  try {
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM organizations) as organizations,
        (SELECT COUNT(*) FROM users) as users,
        (SELECT COUNT(*) FROM contacts) as contacts,
        (SELECT COUNT(*) FROM flows) as flows,
        (SELECT COUNT(*) FROM messages) as messages,
        (SELECT COUNT(*) FROM channels) as channels,
        (SELECT pg_size_pretty(pg_database_size(current_database()))) as db_size
    `);
    
    const data = stats.rows[0];
    
    console.log(`  Organizations: ${data.organizations}`);
    console.log(`  Users:         ${data.users}`);
    console.log(`  Contacts:      ${data.contacts}`);
    console.log(`  Flows:         ${data.flows}`);
    console.log(`  Messages:      ${data.messages}`);
    console.log(`  Channels:      ${data.channels}`);
    console.log(`  Database Size: ${data.db_size}`);
    console.log('');
    
  } catch (error) {
    log.warning('Could not fetch database statistics');
  }
}

// Main execution
async function main() {
  try {
    // Run migrations
    await runMigrations();
    
    // Fix default user
    await fixDefaultUser();
    
    // Refresh materialized views
    await refreshMaterializedViews();
    
    // Show stats
    await showDatabaseStats();
    
    log.title('✅ Migration Complete!');
    console.log('You can now start the application:\n');
    console.log('  cd backend');
    console.log('  npm run dev\n');
    
    process.exit(0);
    
  } catch (error) {
    log.title('❌ Migration Failed!');
    console.error(error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { runMigrations, fixDefaultUser, refreshMaterializedViews };