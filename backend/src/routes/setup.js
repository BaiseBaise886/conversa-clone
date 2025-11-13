import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import setupService from '../services/setup.service.js';

const router = express.Router();

/**
 * Check if setup is needed
 * GET /api/setup/status
 */
router.get('/status', asyncHandler(async (req, res) => {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    database: process.env.DB_NAME || 'conversa_clone',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || ''
  };

  const result = await setupService.isSetupNeeded(config);
  
  res.json({
    setupNeeded: result.needed,
    reason: result.reason,
    config: {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user
    }
  });
}));

/**
 * Test database connection
 * POST /api/setup/test-connection
 */
router.post('/test-connection', asyncHandler(async (req, res) => {
  const { host, port, user, password, database } = req.body;
  
  if (!host || !user) {
    return res.status(400).json({ 
      success: false, 
      message: 'Host and user are required' 
    });
  }

  const config = { host, port, user, password, database };
  const result = await setupService.testConnection(config);
  
  res.json(result);
}));

/**
 * Create database
 * POST /api/setup/create-database
 */
router.post('/create-database', asyncHandler(async (req, res) => {
  const { host, port, user, password, database } = req.body;
  
  if (!host || !user || !database) {
    return res.status(400).json({ 
      success: false, 
      message: 'Host, user, and database name are required' 
    });
  }

  const config = { host, port, user, password, database };
  const result = await setupService.createDatabase(config);
  
  res.json(result);
}));

/**
 * Run migrations
 * POST /api/setup/run-migrations
 */
router.post('/run-migrations', asyncHandler(async (req, res) => {
  const { host, port, user, password, database } = req.body;
  
  if (!host || !user || !database) {
    return res.status(400).json({ 
      success: false, 
      message: 'Host, user, and database name are required' 
    });
  }

  const config = { host, port, user, password, database };
  const result = await setupService.runMigrations(config);
  
  res.json(result);
}));

/**
 * Create admin user
 * POST /api/setup/create-admin
 */
router.post('/create-admin', asyncHandler(async (req, res) => {
  const { host, port, user, password, database, adminEmail, adminPassword, adminName, organizationName } = req.body;
  
  if (!host || !user || !database) {
    return res.status(400).json({ 
      success: false, 
      message: 'Database configuration is required' 
    });
  }

  if (!adminEmail || !adminPassword || !adminName) {
    return res.status(400).json({ 
      success: false, 
      message: 'Admin email, password, and name are required' 
    });
  }

  const config = { host, port, user, password, database };
  const adminData = {
    email: adminEmail,
    password: adminPassword,
    name: adminName,
    organizationName: organizationName || 'My Organization'
  };
  
  const result = await setupService.createAdminUser(config, adminData);
  
  res.json(result);
}));

/**
 * Get database statistics
 * POST /api/setup/stats
 */
router.post('/stats', asyncHandler(async (req, res) => {
  const { host, port, user, password, database } = req.body;
  
  if (!host || !user || !database) {
    return res.status(400).json({ 
      success: false, 
      message: 'Database configuration is required' 
    });
  }

  const config = { host, port, user, password, database };
  const result = await setupService.getDatabaseStats(config);
  
  res.json(result);
}));

/**
 * Complete setup (all-in-one)
 * POST /api/setup/complete
 */
router.post('/complete', asyncHandler(async (req, res) => {
  const { host, port, user, password, database, adminEmail, adminPassword, adminName, organizationName } = req.body;
  
  if (!host || !user || !database) {
    return res.status(400).json({ 
      success: false, 
      message: 'Database configuration is required' 
    });
  }

  if (!adminEmail || !adminPassword || !adminName) {
    return res.status(400).json({ 
      success: false, 
      message: 'Admin user information is required' 
    });
  }

  const config = { host, port, user, password, database };
  const results = {
    steps: []
  };

  try {
    // Step 1: Test connection
    const connectionTest = await setupService.testConnection(config);
    results.steps.push({ step: 'Test Connection', ...connectionTest });
    if (!connectionTest.success) {
      return res.status(400).json({ success: false, ...results });
    }

    // Step 2: Create database
    const dbCreation = await setupService.createDatabase(config);
    results.steps.push({ step: 'Create Database', ...dbCreation });
    if (!dbCreation.success) {
      return res.status(400).json({ success: false, ...results });
    }

    // Step 3: Run migrations
    const migrations = await setupService.runMigrations(config);
    results.steps.push({ step: 'Run Migrations', ...migrations });
    if (!migrations.success) {
      return res.status(400).json({ success: false, ...results });
    }

    // Step 4: Create admin user
    const adminData = {
      email: adminEmail,
      password: adminPassword,
      name: adminName,
      organizationName: organizationName || 'My Organization'
    };
    const adminCreation = await setupService.createAdminUser(config, adminData);
    results.steps.push({ step: 'Create Admin User', ...adminCreation });
    if (!adminCreation.success) {
      return res.status(400).json({ success: false, ...results });
    }

    // Step 5: Get stats
    const stats = await setupService.getDatabaseStats(config);
    results.steps.push({ step: 'Database Statistics', ...stats });

    res.json({ 
      success: true, 
      message: 'Setup completed successfully',
      ...results,
      credentials: {
        email: adminEmail,
        organizationId: adminCreation.organizationId
      }
    });

  } catch (error) {
    results.steps.push({ 
      step: 'Error', 
      success: false, 
      message: error.message 
    });
    res.status(500).json({ 
      success: false, 
      message: 'Setup failed',
      ...results 
    });
  }
}));

export default router;
