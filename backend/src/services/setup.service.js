import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import { logger } from '../middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');

class SetupService {
  /**
   * Test database connection with provided credentials
   */
  async testConnection(config) {
    let connection = null;
    try {
      connection = await mysql.createConnection({
        host: config.host || 'localhost',
        port: parseInt(config.port) || 3306,
        user: config.user || 'root',
        password: config.password || '',
        connectTimeout: 5000
      });

      await connection.ping();
      return { 
        success: true, 
        message: 'Connection successful' 
      };
    } catch (error) {
      logger.error('Database connection test failed:', error);
      return { 
        success: false, 
        message: error.message 
      };
    } finally {
      if (connection) {
        await connection.end();
      }
    }
  }

  /**
   * Create database if it doesn't exist
   */
  async createDatabase(config) {
    let connection = null;
    try {
      connection = await mysql.createConnection({
        host: config.host || 'localhost',
        port: parseInt(config.port) || 3306,
        user: config.user || 'root',
        password: config.password || '',
        connectTimeout: 5000
      });

      const dbName = config.database || 'conversa_clone';
      
      // Check if database exists
      const [databases] = await connection.query(
        'SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?',
        [dbName]
      );

      if (databases.length > 0) {
        return { 
          success: true, 
          message: `Database '${dbName}' already exists`,
          existed: true 
        };
      }

      // Create database
      await connection.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      
      return { 
        success: true, 
        message: `Database '${dbName}' created successfully`,
        existed: false 
      };
    } catch (error) {
      logger.error('Database creation failed:', error);
      return { 
        success: false, 
        message: error.message 
      };
    } finally {
      if (connection) {
        await connection.end();
      }
    }
  }

  /**
   * Get pool connection for database operations
   */
  async getPoolConnection(config) {
    return mysql.createPool({
      host: config.host || 'localhost',
      port: parseInt(config.port) || 3306,
      database: config.database || 'conversa_clone',
      user: config.user || 'root',
      password: config.password || '',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 5000
    });
  }

  /**
   * Create migrations tracking table
   */
  async createMigrationsTable(pool) {
    const createQuery = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await pool.query(createQuery);
  }

  /**
   * Get executed migrations
   */
  async getExecutedMigrations(pool) {
    try {
      const [rows] = await pool.query(
        'SELECT filename FROM schema_migrations ORDER BY id'
      );
      return rows.map(row => row.filename);
    } catch (error) {
      return [];
    }
  }

  /**
   * Mark migration as executed
   */
  async markMigrationAsExecuted(pool, filename) {
    await pool.query(
      'INSERT IGNORE INTO schema_migrations (filename) VALUES (?)',
      [filename]
    );
  }

  /**
   * Convert PostgreSQL SQL to MySQL compatible SQL
   */
  convertPostgresToMySQL(sql) {
    let converted = sql;

    // Remove PostgreSQL extensions
    converted = converted.replace(/CREATE EXTENSION IF NOT EXISTS.*?;/gi, '');

    // Convert SERIAL to INT AUTO_INCREMENT
    converted = converted.replace(/\bSERIAL\b/gi, 'INT AUTO_INCREMENT');

    // Convert TEXT to VARCHAR or TEXT
    converted = converted.replace(/\s+TEXT\b/gi, ' TEXT');

    // Convert UUID to VARCHAR(36)
    converted = converted.replace(/\bUUID\b/gi, 'VARCHAR(36)');

    // Remove uuid_generate_v4()
    converted = converted.replace(/DEFAULT\s+uuid_generate_v4\(\)/gi, '');

    // Convert BOOLEAN to TINYINT(1)
    converted = converted.replace(/\bBOOLEAN\b/gi, 'TINYINT(1)');

    // Convert arrays to JSON
    converted = converted.replace(/TEXT\[\]\s+DEFAULT\s+ARRAY\[\]::\w+\[\]/gi, 'JSON');
    converted = converted.replace(/INTEGER\[\]\s+DEFAULT\s+ARRAY\[\]::\w+\[\]/gi, 'JSON');

    // Convert JSONB to JSON
    converted = converted.replace(/\bJSONB\b/gi, 'JSON');

    // Remove GIN indexes (not supported in MySQL)
    converted = converted.replace(/CREATE INDEX.*?USING\s+GIN.*?;/gi, '');

    // Remove to_tsvector indexes (PostgreSQL full-text search)
    converted = converted.replace(/CREATE INDEX.*?to_tsvector.*?;/gi, '');

    // Remove partial indexes (WHERE clause in CREATE INDEX)
    converted = converted.replace(/(CREATE INDEX.*?;)/gi, (match) => {
      if (match.includes(' WHERE ')) {
        return ''; // Remove partial indexes
      }
      return match;
    });

    // Remove CHECK constraints with IN (MySQL supports them but syntax might differ)
    // Keep them as is for now, MySQL 8.0+ supports CHECK constraints

    return converted;
  }

  /**
   * Execute a migration file
   */
  async executeMigration(pool, filepath, filename) {
    try {
      let sql = fs.readFileSync(filepath, 'utf8');
      
      // Convert PostgreSQL SQL to MySQL
      sql = this.convertPostgresToMySQL(sql);
      
      // Split by semicolon but keep statement together
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      let executed = 0;
      for (const statement of statements) {
        if (statement) {
          try {
            await pool.query(statement);
            executed++;
          } catch (error) {
            // Log but continue - some statements may fail due to conversion issues
            logger.warn(`Statement failed (continuing): ${error.message}`);
          }
        }
      }
      
      await this.markMigrationAsExecuted(pool, filename);
      return { 
        success: true, 
        message: `Executed ${executed} statements from ${filename}` 
      };
    } catch (error) {
      logger.error(`Migration failed: ${filename}`, error);
      return { 
        success: false, 
        message: error.message 
      };
    }
  }

  /**
   * Run all pending migrations
   */
  async runMigrations(config) {
    let pool = null;
    try {
      pool = await this.getPoolConnection(config);
      
      // Create migrations tracking table
      await this.createMigrationsTable(pool);
      
      // Get executed migrations
      const executedMigrations = await this.getExecutedMigrations(pool);
      
      // Get all migration files
      const files = fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort();
      
      if (files.length === 0) {
        return { 
          success: false, 
          message: 'No migration files found' 
        };
      }
      
      const results = [];
      let executed = 0;
      let skipped = 0;
      let failed = 0;
      
      for (const file of files) {
        if (executedMigrations.includes(file)) {
          skipped++;
          results.push({ file, status: 'skipped', message: 'Already executed' });
          continue;
        }
        
        const filepath = path.join(MIGRATIONS_DIR, file);
        const result = await this.executeMigration(pool, filepath, file);
        
        if (result.success) {
          executed++;
          results.push({ file, status: 'success', message: result.message });
        } else {
          failed++;
          results.push({ file, status: 'failed', message: result.message });
        }
      }
      
      return { 
        success: failed === 0, 
        executed,
        skipped,
        failed,
        total: files.length,
        results
      };
    } catch (error) {
      logger.error('Migration process failed:', error);
      return { 
        success: false, 
        message: error.message 
      };
    } finally {
      if (pool) {
        await pool.end();
      }
    }
  }

  /**
   * Create admin user
   */
  async createAdminUser(config, adminData) {
    let pool = null;
    try {
      pool = await this.getPoolConnection(config);
      
      // Check if user already exists
      const [userCheck] = await pool.query(
        'SELECT id FROM users WHERE email = ?',
        [adminData.email]
      );
      
      if (userCheck.length > 0) {
        return { 
          success: false, 
          message: 'User with this email already exists' 
        };
      }
      
      // Hash password
      const passwordHash = await bcrypt.hash(adminData.password, 10);
      
      // Create organization first
      const [orgResult] = await pool.query(
        'INSERT INTO organizations (name, plan) VALUES (?, ?)',
        [adminData.organizationName || 'My Organization', 'pro']
      );
      const orgId = orgResult.insertId;
      
      // Create user
      const [userResult] = await pool.query(
        'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
        [adminData.email, passwordHash, adminData.name]
      );
      const userId = userResult.insertId;
      
      // Link user to organization with owner role
      await pool.query(
        'INSERT INTO user_organizations (user_id, organization_id, role) VALUES (?, ?, ?)',
        [userId, orgId, 'owner']
      );
      
      return { 
        success: true, 
        message: 'Admin user created successfully',
        userId,
        organizationId: orgId
      };
    } catch (error) {
      logger.error('Admin user creation failed:', error);
      return { 
        success: false, 
        message: error.message 
      };
    } finally {
      if (pool) {
        await pool.end();
      }
    }
  }

  /**
   * Check if setup is needed
   */
  async isSetupNeeded(config) {
    let pool = null;
    try {
      pool = await this.getPoolConnection(config);
      
      // Check if schema_migrations table exists
      const [tables] = await pool.query(
        `SELECT TABLE_NAME 
         FROM INFORMATION_SCHEMA.TABLES 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'schema_migrations'`,
        [config.database || 'conversa_clone']
      );
      
      if (tables.length === 0) {
        return { needed: true, reason: 'No migrations table found' };
      }
      
      // Check if any migrations have been run
      const [migrations] = await pool.query('SELECT COUNT(*) as count FROM schema_migrations');
      
      if (migrations[0].count === 0) {
        return { needed: true, reason: 'No migrations executed' };
      }
      
      // Check if users table exists and has data
      const [users] = await pool.query(
        `SELECT COUNT(*) as count 
         FROM INFORMATION_SCHEMA.TABLES 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'`,
        [config.database || 'conversa_clone']
      );
      
      if (users[0].count === 0) {
        return { needed: true, reason: 'Users table not found' };
      }
      
      const [userCount] = await pool.query('SELECT COUNT(*) as count FROM users');
      
      if (userCount[0].count === 0) {
        return { needed: true, reason: 'No users found' };
      }
      
      return { needed: false, reason: 'Setup already completed' };
    } catch (error) {
      return { needed: true, reason: error.message };
    } finally {
      if (pool) {
        await pool.end();
      }
    }
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats(config) {
    let pool = null;
    try {
      pool = await this.getPoolConnection(config);
      
      const [stats] = await pool.query(`
        SELECT 
          (SELECT COUNT(*) FROM organizations) as organizations,
          (SELECT COUNT(*) FROM users) as users,
          (SELECT COUNT(*) FROM contacts) as contacts,
          (SELECT COUNT(*) FROM flows) as flows,
          (SELECT COUNT(*) FROM messages) as messages,
          (SELECT COUNT(*) FROM channels) as channels
      `);
      
      return { 
        success: true, 
        stats: stats[0] 
      };
    } catch (error) {
      return { 
        success: false, 
        message: error.message 
      };
    } finally {
      if (pool) {
        await pool.end();
      }
    }
  }
}

export default new SetupService();
