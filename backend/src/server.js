import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

// Load environment variables
dotenv.config();

// Import configurations
import { config } from './config/index.js';
import { pool } from './config/database.js';
import redisClient from './config/redis.js';

// Import middleware
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFound, logger } from './middleware/errorHandler.js';

// Import routes
import authRoutes from './routes/auth.js';
import contactRoutes from './routes/contacts.js';
import flowRoutes from './routes/flows.js';
import channelRoutes from './routes/channels.js';
import messageRoutes from './routes/messages.js';
import webhookRoutes from './routes/webhooks.js';
import mediaRoutes from './routes/media.js';
import aiRoutes from './routes/ai.js';
import marketingRoutes from './routes/marketing.js';
import analyticsRoutes from './routes/analytics.js';
import conversationRoutes from './routes/conversations.js';
import setupRoutes from './routes/setup.js';

// Import WebSocket handler
import initializeWebSocket from './websocket/socketHandler.js';

// Import services
import queueService from './services/queue.service.js';
import antiBanService from './services/antiban.service.js';
import analyticsService from './services/analytics.service.js';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app = express();
const httpServer = createServer(app);

// Trust proxy (important for rate limiting behind nginx/load balancers)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware (development only)
if (config.nodeEnv === 'development') {
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`, {
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
    next();
  });
}

// Health check endpoint (no auth, no rate limit)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
    version: '1.0.0',
    services: {
      database: pool ? 'connected' : 'disconnected',
      redis: redisClient.isOpen ? 'connected' : 'disconnected'
    }
  });
});

// API info endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Conversa Clone API',
    version: '1.0.0',
    description: 'AI-Powered Marketing Automation Platform',
    documentation: '/api/docs',
    health: '/health',
    author: 'BaiseBaise886',
    repository: 'https://github.com/BaiseBaise886/conversa-clone'
  });
});

// Setup routes (no rate limiting or auth required for first-run setup)
app.use('/api/setup', setupRoutes);

// Apply rate limiting to all API routes
app.use('/api', apiLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/flows', flowRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/marketing', marketingRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/conversations', conversationRoutes);

// Serve uploaded files (with authentication would be better, but for simplicity)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API documentation endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    message: 'API Documentation',
    version: '1.0.0',
    baseUrl: '/api',
    endpoints: {
      authentication: {
        'POST /api/auth/register': 'Register new user and organization',
        'POST /api/auth/login': 'Login with email and password',
        'GET /api/auth/me': 'Get current user information',
        'POST /api/auth/change-password': 'Change password'
      },
      contacts: {
        'GET /api/contacts': 'Get all contacts',
        'GET /api/contacts/:id': 'Get single contact',
        'POST /api/contacts': 'Create new contact',
        'PUT /api/contacts/:id': 'Update contact',
        'DELETE /api/contacts/:id': 'Delete contact',
        'POST /api/contacts/bulk-import': 'Bulk import contacts'
      },
      flows: {
        'GET /api/flows': 'Get all flows',
        'GET /api/flows/:id': 'Get single flow',
        'POST /api/flows': 'Create new flow',
        'PUT /api/flows/:id': 'Update flow',
        'DELETE /api/flows/:id': 'Delete flow',
        'PATCH /api/flows/:id/toggle': 'Toggle flow active status'
      },
      channels: {
        'GET /api/channels': 'Get all channels',
        'POST /api/channels/whatsapp': 'Create WhatsApp channel',
        'POST /api/channels/:id/connect': 'Connect channel',
        'POST /api/channels/:id/disconnect': 'Disconnect channel',
        'GET /api/channels/:id/qr': 'Get QR code for WhatsApp'
      },
      messages: {
        'GET /api/messages/contact/:contactId': 'Get messages for contact',
        'POST /api/messages/send': 'Send message',
        'POST /api/messages/send-voice': 'Send voice note',
        'POST /api/messages/bulk-send': 'Send bulk messages'
      },
      media: {
        'POST /api/media/upload': 'Upload single file',
        'POST /api/media/upload-multiple': 'Upload multiple files',
        'GET /api/media/library': 'Get media library',
        'GET /api/media/:id': 'Get media file info',
        'GET /api/media/:id/file': 'Download media file',
        'DELETE /api/media/:id': 'Delete media file'
      },
      ai: {
        'POST /api/ai/generate-flow': 'Generate flow from natural language',
        'POST /api/ai/support-response': 'Get AI support response',
        'POST /api/ai/analyze': 'Analyze message sentiment',
        'POST /api/ai/auto-tag/:contactId': 'Auto-tag contact'
      },
      analytics: {
        'GET /api/analytics/dropoff/:flowId': 'Get drop-off analysis',
        'GET /api/analytics/funnel/:flowId': 'Get funnel visualization',
        'POST /api/analytics/abtest/variant': 'Create A/B test variant',
        'GET /api/analytics/abtest/:flowId': 'Get A/B test results',
        'GET /api/analytics/abtest/:flowId/winner': 'Detect winning variant',
        'POST /api/analytics/abtest/:flowId/promote': 'Promote winning variant'
      },
      conversations: {
        'GET /api/conversations': 'Get conversation list',
        'GET /api/conversations/:contactId/messages': 'Get messages',
        'POST /api/conversations/:contactId/read': 'Mark as read',
        'POST /api/conversations/:contactId/archive': 'Archive conversation',
        'POST /api/conversations/:contactId/pin': 'Pin conversation'
      },
      webhooks: {
        'POST /api/webhooks/trigger': 'Manually trigger flow',
        'POST /api/webhooks/external/:organizationId': 'External webhook (no auth)',
        'GET /api/webhooks/url': 'Get webhook URL',
        'GET /api/webhooks/stats': 'Get dashboard statistics'
      }
    },
    authentication: {
      type: 'Bearer Token (JWT)',
      header: 'Authorization: Bearer YOUR_TOKEN',
      exampleLogin: {
        url: 'POST /api/auth/login',
        body: {
          email: 'admin@demo.com',
          password: 'admin123'
        }
      }
    },
    rateLimits: {
      general: '100 requests per 15 minutes',
      authentication: '5 requests per 15 minutes',
      messaging: '50 requests per minute',
      uploads: '20 requests per hour',
      ai: '10 requests per hour'
    }
  });
});

// 404 handler - must be after all routes
app.use(notFound);

// Global error handler - must be last
app.use(errorHandler);

// Initialize WebSocket
const io = initializeWebSocket(httpServer);

// Make io available to routes
app.set('io', io);

// Background jobs setup
function setupBackgroundJobs() {
  // Process message queue every 5 seconds
  setInterval(async () => {
    try {
      await antiBanService.processMessageQueue();
    } catch (error) {
      logger.error('Error processing message queue:', error);
    }
  }, 5000);

  // Calculate daily analytics at midnight
  const now = new Date();
  const midnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0, 0, 0
  );
  const msUntilMidnight = midnight - now;

  setTimeout(() => {
    // Run first time at midnight
    analyticsService.calculateDailyAggregates().catch(error => {
      logger.error('Error calculating daily aggregates:', error);
    });

    // Then run daily
    setInterval(() => {
      analyticsService.calculateDailyAggregates().catch(error => {
        logger.error('Error calculating daily aggregates:', error);
      });
    }, 24 * 60 * 60 * 1000); // Every 24 hours
  }, msUntilMidnight);

  // Clean up old queue entries every hour
  setInterval(async () => {
    try {
      await antiBanService.cleanupQueue();
    } catch (error) {
      logger.error('Error cleaning up queue:', error);
    }
  }, 60 * 60 * 1000);

  logger.info('✅ Background jobs scheduled');
}

// Start server
const PORT = config.port;

httpServer.listen(PORT, () => {
  console.log('\n' + '='.repeat(50));
  console.log('🚀 Conversa Clone - AI Marketing Automation Platform');
  console.log('='.repeat(50));
  console.log(`📡 Server running on port: ${PORT}`);
  console.log(`🌍 Environment: ${config.nodeEnv}`);
  console.log(`🔗 API URL: http://localhost:${PORT}`);
  console.log(`🔗 Frontend URL: ${config.frontendUrl}`);
  console.log(`📚 API Docs: http://localhost:${PORT}/api/docs`);
  console.log(`💚 Health Check: http://localhost:${PORT}/health`);
  console.log('='.repeat(50));
  console.log('📊 Services Status:');
  console.log(`   Database: ${pool ? '✅ Connected' : '❌ Disconnected'}`);
  console.log(`   Redis: ${redisClient.isOpen ? '✅ Connected' : '❌ Disconnected'}`);
  console.log(`   WebSocket: ✅ Initialized`);
  console.log(`   Queue: ✅ Running`);
  console.log('='.repeat(50));
  console.log('🔑 Default Login Credentials:');
  console.log('   Email: admin@demo.com');
  console.log('   Password: admin123');
  console.log('   ⚠️  Change these after first login!');
  console.log('='.repeat(50));
  console.log('\n💡 Quick Start:');
  console.log('   1. Frontend: cd frontend && npm run dev');
  console.log('   2. Open: http://localhost:3000');
  console.log('   3. Login with credentials above');
  console.log('   4. Connect WhatsApp channel');
  console.log('   5. Create your first flow!');
  console.log('\n📖 Documentation:');
  console.log('   - Setup Guide: ./SETUP_GUIDE.md');
  console.log('   - AI Features: ./AI_SETUP_GUIDE.md');
  console.log('   - Analytics: ./AB_TESTING_ANALYTICS_GUIDE.md');
  console.log('   - Multimedia: ./MULTIMEDIA_GUIDE.md');
  console.log('   - Production: ./PRODUCTION_DEPLOYMENT_GUIDE.md');
  console.log('\n' + '='.repeat(50) + '\n');

  logger.info(`Server started successfully on port ${PORT}`);

  // Setup background jobs
  setupBackgroundJobs();
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} signal received: closing HTTP server`);
  
  console.log('\n🛑 Shutting down gracefully...');
  
  // Stop accepting new connections
  httpServer.close(async () => {
    console.log('✅ HTTP server closed');
    
    try {
      // Close database connections
      if (pool) {
        await pool.end();
        console.log('✅ Database connections closed');
      }
      
      // Close Redis connection
      if (redisClient.isOpen) {
        await redisClient.quit();
        console.log('✅ Redis connection closed');
      }
      
      // Close WebSocket connections
      if (io) {
        io.close(() => {
          console.log('✅ WebSocket server closed');
        });
      }
      
      console.log('✅ Graceful shutdown completed\n');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    console.error('❌ Forced shutdown - some connections may not have closed properly');
    process.exit(1);
  }, 10000);
};

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  console.error('💥 Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  console.error('💥 Unhandled Rejection:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Log startup success
logger.info('Application started successfully', {
  port: PORT,
  environment: config.nodeEnv,
  nodeVersion: process.version,
  platform: process.platform
});

export default app;