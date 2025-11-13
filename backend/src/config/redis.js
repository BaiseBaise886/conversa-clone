import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisConfig = {
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.error('❌ Redis: Too many reconnection attempts');
        return new Error('Too many retries');
      }
      // Exponential backoff: 2^retries * 100ms
      const delay = Math.min(Math.pow(2, retries) * 100, 3000);
      console.log(`⏳ Redis: Reconnecting in ${delay}ms... (attempt ${retries})`);
      return delay;
    }
  }
};

// Add password if provided
if (process.env.REDIS_PASSWORD) {
  redisConfig.password = process.env.REDIS_PASSWORD;
}

const redisClient = createClient(redisConfig);

redisClient.on('connect', () => {
  console.log('🔄 Redis: Connecting...');
});

redisClient.on('ready', () => {
  console.log('✅ Redis connected successfully');
});

redisClient.on('error', (err) => {
  console.error('❌ Redis Client Error:', err.message);
  console.log('\n💡 Troubleshooting:');
  console.log('1. Check if Redis is running: redis-cli ping');
  console.log('2. Start Redis: sudo systemctl start redis');
  console.log('3. Check Redis logs: sudo journalctl -u redis -n 50');
  console.log('4. Verify connection settings in .env\n');
});

redisClient.on('reconnecting', () => {
  console.log('🔄 Redis: Reconnecting...');
});

redisClient.on('end', () => {
  console.log('⚠️  Redis: Connection closed');
});

// Connect to Redis
try {
  await redisClient.connect();
} catch (error) {
  console.error('❌ Failed to connect to Redis:', error.message);
  console.log('⚠️  Continuing without Redis - some features may be limited\n');
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n📛 Shutting down Redis connection...');
  await redisClient.quit();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n📛 Shutting down Redis connection...');
  await redisClient.quit();
  process.exit(0);
});

export default redisClient;