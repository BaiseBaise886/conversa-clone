import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
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
      
      // Validate database name to prevent SQL injection (alphanumeric, underscore, hyphen only)
      if (!/^[a-zA-Z0-9_-]+$/.test(dbName)) {
        return {
          success: false,
          message: 'Invalid database name. Only alphanumeric characters, underscores, and hyphens are allowed.'
        };
      }
      
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

      // Create database (safe because we validated the name above)
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
   * Get embedded MySQL schema statements
   */
  getEmbeddedSchema() {
    return [
      // Disable foreign key checks
      'SET FOREIGN_KEY_CHECKS = 0',
      
      // Organizations
      `CREATE TABLE IF NOT EXISTS organizations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        plan VARCHAR(50) DEFAULT 'starter',
        settings JSON DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CHECK (plan IN ('starter', 'pro', 'enterprise'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      
      // Users
      `CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        avatar_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_users_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      
      // User Organizations
      `CREATE TABLE IF NOT EXISTS user_organizations (
        user_id INT NOT NULL,
        organization_id INT NOT NULL,
        role VARCHAR(50) DEFAULT 'member',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, organization_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        CHECK (role IN ('owner', 'admin', 'agent', 'viewer'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      
      // Contacts
      `CREATE TABLE IF NOT EXISTS contacts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        organization_id INT NOT NULL,
        name VARCHAR(255),
        phone VARCHAR(50),
        email VARCHAR(255),
        instagram_username VARCHAR(255),
        channel_type VARCHAR(50) DEFAULT 'whatsapp',
        tags JSON DEFAULT NULL,
        custom_fields JSON DEFAULT NULL,
        last_message_at TIMESTAMP NULL,
        last_message_preview TEXT,
        unread_count INT DEFAULT 0,
        archived_at TIMESTAMP NULL,
        pinned TINYINT(1) DEFAULT 0,
        muted TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        INDEX idx_contacts_org (organization_id),
        INDEX idx_contacts_phone (phone),
        INDEX idx_contacts_email (email),
        INDEX idx_contacts_last_message (last_message_at DESC),
        CHECK (channel_type IN ('whatsapp', 'instagram', 'telegram'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      
      // Channels
      `CREATE TABLE IF NOT EXISTS channels (
        id INT AUTO_INCREMENT PRIMARY KEY,
        organization_id INT NOT NULL,
        type VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        phone_number VARCHAR(50),
        status VARCHAR(50) DEFAULT 'disconnected',
        qr_code TEXT,
        credentials JSON DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        INDEX idx_channels_org (organization_id),
        INDEX idx_channels_type (type),
        CHECK (type IN ('whatsapp', 'instagram', 'telegram')),
        CHECK (status IN ('connected', 'disconnected', 'pending_qr', 'error'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      
      // Messages
      `CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        contact_id INT NOT NULL,
        channel_id INT,
        content TEXT,
        type VARCHAR(50) DEFAULT 'inbound',
        media_type VARCHAR(50),
        media_url TEXT,
        status VARCHAR(50) DEFAULT 'sent',
        error_message TEXT,
        external_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
        FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE SET NULL,
        INDEX idx_messages_contact (contact_id),
        INDEX idx_messages_channel (channel_id),
        INDEX idx_messages_created (created_at DESC),
        INDEX idx_messages_type (type),
        CHECK (type IN ('inbound', 'outbound_api', 'outbound_agent', 'outbound_flow'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      
      // Flows
      `CREATE TABLE IF NOT EXISTS flows (
        id INT AUTO_INCREMENT PRIMARY KEY,
        organization_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        trigger_type VARCHAR(50),
        trigger_config JSON DEFAULT NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        INDEX idx_flows_org (organization_id),
        INDEX idx_flows_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      
      // Flow Nodes
      `CREATE TABLE IF NOT EXISTS flow_nodes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        flow_id INT NOT NULL,
        node_id VARCHAR(100) NOT NULL,
        node_type VARCHAR(50) NOT NULL,
        node_data JSON DEFAULT NULL,
        position_x FLOAT,
        position_y FLOAT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE,
        INDEX idx_flow_nodes_flow (flow_id),
        UNIQUE KEY unique_flow_node (flow_id, node_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      
      // Flow Edges
      `CREATE TABLE IF NOT EXISTS flow_edges (
        id INT AUTO_INCREMENT PRIMARY KEY,
        flow_id INT NOT NULL,
        source_node_id VARCHAR(100) NOT NULL,
        target_node_id VARCHAR(100) NOT NULL,
        edge_data JSON DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE,
        INDEX idx_flow_edges_flow (flow_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      
      // Live Chat Sessions
      `CREATE TABLE IF NOT EXISTS live_chat_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        contact_id INT NOT NULL,
        assigned_user_id INT,
        status VARCHAR(50) DEFAULT 'pending',
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP NULL,
        FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_live_chat_contact (contact_id),
        INDEX idx_live_chat_user (assigned_user_id),
        INDEX idx_live_chat_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      
      // User Presence
      `CREATE TABLE IF NOT EXISTS user_presence (
        user_id INT PRIMARY KEY,
        organization_id INT,
        status VARCHAR(50) DEFAULT 'offline',
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        socket_id VARCHAR(255),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        INDEX idx_user_presence_org (organization_id),
        INDEX idx_user_presence_status (status),
        CHECK (status IN ('online', 'away', 'offline'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      
      // Typing Indicators
      `CREATE TABLE IF NOT EXISTS typing_indicators (
        id INT AUTO_INCREMENT PRIMARY KEY,
        contact_id INT NOT NULL,
        user_id INT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_typing_contact (contact_id),
        INDEX idx_typing_updated (updated_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      
      // Message Queue
      `CREATE TABLE IF NOT EXISTS message_queue (
        id INT AUTO_INCREMENT PRIMARY KEY,
        channel_id INT NOT NULL,
        contact_id INT NOT NULL,
        content TEXT NOT NULL,
        media_type VARCHAR(50),
        media_url TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        scheduled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sent_at TIMESTAMP NULL,
        retry_count INT DEFAULT 0,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
        FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
        INDEX idx_queue_status (status),
        INDEX idx_queue_scheduled (scheduled_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      
      // Marketing Brain
      `CREATE TABLE IF NOT EXISTS marketing_brain (
        id INT AUTO_INCREMENT PRIMARY KEY,
        organization_id INT NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        product_description TEXT,
        price DECIMAL(10, 2),
        target_audience TEXT,
        marketing_angles JSON DEFAULT NULL,
        pain_points JSON DEFAULT NULL,
        benefits JSON DEFAULT NULL,
        objections JSON DEFAULT NULL,
        competitors JSON DEFAULT NULL,
        unique_selling_points JSON DEFAULT NULL,
        tone_of_voice VARCHAR(100) DEFAULT 'friendly',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        INDEX idx_marketing_org (organization_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      
      // AI Conversations
      `CREATE TABLE IF NOT EXISTS ai_conversations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        contact_id INT NOT NULL,
        session_id VARCHAR(255) NOT NULL,
        context JSON DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
        INDEX idx_ai_conv_contact (contact_id),
        INDEX idx_ai_conv_session (session_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      
      // Flow Variants
      `CREATE TABLE IF NOT EXISTS flow_variants (
        id INT AUTO_INCREMENT PRIMARY KEY,
        flow_id INT NOT NULL,
        variant_name VARCHAR(255) NOT NULL,
        flow_definition JSON NOT NULL,
        traffic_percentage INT DEFAULT 50,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE,
        INDEX idx_variants_flow (flow_id),
        CHECK (traffic_percentage >= 0 AND traffic_percentage <= 100)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      
      // Flow Journeys
      `CREATE TABLE IF NOT EXISTS flow_journeys (
        id INT AUTO_INCREMENT PRIMARY KEY,
        flow_id INT NOT NULL,
        variant_id INT,
        contact_id INT NOT NULL,
        status VARCHAR(50) DEFAULT 'in_progress',
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP NULL,
        total_time_seconds INT,
        conversion_value DECIMAL(10, 2),
        FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE,
        FOREIGN KEY (variant_id) REFERENCES flow_variants(id) ON DELETE SET NULL,
        FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
        INDEX idx_journeys_flow (flow_id),
        INDEX idx_journeys_variant (variant_id),
        INDEX idx_journeys_contact (contact_id),
        INDEX idx_journeys_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      
      // AB Test Results
      `CREATE TABLE IF NOT EXISTS ab_test_results (
        id INT AUTO_INCREMENT PRIMARY KEY,
        flow_id INT NOT NULL,
        variant_id INT NOT NULL,
        metric_date DATE NOT NULL,
        total_starts INT DEFAULT 0,
        total_completions INT DEFAULT 0,
        conversion_rate DECIMAL(5, 2) DEFAULT 0,
        total_revenue DECIMAL(10, 2) DEFAULT 0,
        avg_revenue_per_user DECIMAL(10, 2) DEFAULT 0,
        FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE,
        FOREIGN KEY (variant_id) REFERENCES flow_variants(id) ON DELETE CASCADE,
        UNIQUE KEY unique_metric (flow_id, variant_id, metric_date),
        INDEX idx_abtest_flow (flow_id),
        INDEX idx_abtest_date (metric_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      
      // Media Library
      `CREATE TABLE IF NOT EXISTS media_library (
        id INT AUTO_INCREMENT PRIMARY KEY,
        organization_id INT NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_type VARCHAR(50) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        file_size BIGINT NOT NULL,
        file_path TEXT NOT NULL,
        thumbnail_path TEXT,
        duration_seconds INT,
        width INT,
        height INT,
        uploaded_by INT,
        tags JSON DEFAULT NULL,
        metadata JSON DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_media_org (organization_id),
        INDEX idx_media_type (file_type),
        CHECK (file_type IN ('image', 'video', 'audio', 'document'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      
      // API Keys
      `CREATE TABLE IF NOT EXISTS api_keys (
        id INT AUTO_INCREMENT PRIMARY KEY,
        organization_id INT NOT NULL,
        \`key\` VARCHAR(64) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        permissions JSON DEFAULT NULL,
        is_active TINYINT(1) DEFAULT 1,
        last_used_at TIMESTAMP NULL,
        expires_at TIMESTAMP NULL,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_apikeys_org (organization_id),
        INDEX idx_apikeys_key (\`key\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      
      // Conversation List
      `CREATE TABLE IF NOT EXISTS conversation_list (
        id INT AUTO_INCREMENT PRIMARY KEY,
        contact_id INT NOT NULL,
        organization_id INT NOT NULL,
        last_message_at TIMESTAMP NULL,
        last_message_preview TEXT,
        unread_count INT DEFAULT 0,
        assigned_user_id INT,
        FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_conv_list_org (organization_id),
        INDEX idx_conv_list_updated (last_message_at DESC)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      
      // Node Analytics
      `CREATE TABLE IF NOT EXISTS node_analytics (
        id INT AUTO_INCREMENT PRIMARY KEY,
        flow_id INT NOT NULL,
        variant_id INT,
        node_id VARCHAR(100) NOT NULL,
        contact_id INT NOT NULL,
        action VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE,
        FOREIGN KEY (variant_id) REFERENCES flow_variants(id) ON DELETE SET NULL,
        FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
        INDEX idx_node_analytics_flow (flow_id),
        INDEX idx_node_analytics_node (node_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      
      // Re-enable foreign key checks
      'SET FOREIGN_KEY_CHECKS = 1'
    ];
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
      
      // Check if embedded schema already executed
      if (!executedMigrations.includes('embedded_schema')) {
        // Use embedded MySQL schema
        logger.info('Using embedded MySQL schema');
        
        const statements = this.getEmbeddedSchema();
        
        let executed = 0;
        let failed = 0;
        
        for (const statement of statements) {
          if (statement && statement.trim()) {
            try {
              await pool.query(statement);
              executed++;
            } catch (error) {
              // Log but continue for "already exists" errors
              if (!error.message.includes('already exists') && !error.message.includes('Duplicate')) {
                logger.warn(`Statement warning: ${error.message.substring(0, 80)}`);
                failed++;
              } else {
                executed++; // Count as successful if table already exists
              }
            }
          }
        }
        
        await this.markMigrationAsExecuted(pool, 'embedded_schema');
        
        return { 
          success: true, 
          executed,
          skipped: 0,
          failed,
          total: statements.length,
          results: [{
            file: 'embedded_schema',
            status: 'success',
            message: `Executed ${executed} statements (${failed} warnings)`
          }]
        };
      }
      
      // Schema already executed
      return { 
        success: true, 
        executed: 0,
        skipped: 1,
        failed: 0,
        total: 1,
        results: [{
          file: 'embedded_schema',
          status: 'skipped',
          message: 'Already executed'
        }]
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
      
      // Generate JWT token for auto-login
      const token = jwt.sign(
        { 
          userId, 
          email: adminData.email,
          organizationId: orgId,
          role: 'owner'
        },
        process.env.JWT_SECRET || 'default-secret-key-change-in-production',
        { expiresIn: '7d' }
      );
      
      return { 
        success: true, 
        message: 'Admin user created successfully',
        userId,
        organizationId: orgId,
        token,
        user: {
          id: userId,
          email: adminData.email,
          name: adminData.name,
          role: 'owner'
        },
        organization: {
          id: orgId,
          name: adminData.organizationName || 'My Organization',
          plan: 'pro'
        }
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
