import { config } from '../config/index.js';
import { query } from '../config/database.js';
import { logger } from '../middleware/errorHandler.js';

class AntiBanService {
  constructor() {
    this.messageDelayMin = config.antiban.messageDelayMin;
    this.messageDelayMax = config.antiban.messageDelayMax;
    this.dailyLimit = config.antiban.dailyMessageLimit;
    this.typingSpeed = config.antiban.humanTypingSpeed; // chars per second
  }

  /**
   * Calculate human-like delay based on message length
   */
  calculateDelay(messageLength) {
    // Base delay
    const baseDelay = Math.random() * (this.messageDelayMax - this.messageDelayMin) + this.messageDelayMin;
    
    // Typing simulation: longer messages = longer delay
    const typingDelay = (messageLength / this.typingSpeed) * 1000;
    
    // Add some randomness (±20%)
    const randomness = 0.8 + (Math.random() * 0.4);
    
    return Math.floor((baseDelay + typingDelay) * randomness);
  }

  /**
   * Check if channel can send message (not over daily limit)
   */
  async canSendMessage(channelId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const result = await query(
      `SELECT COUNT(*) as count FROM messages 
       WHERE channel_id = $1 
       AND type LIKE 'outbound%' 
       AND created_at >= $2`,
      [channelId, today]
    );
    
    const count = parseInt(result.rows[0].count);
    
    if (count >= this.dailyLimit) {
      logger.warn(`Channel ${channelId} has reached daily message limit (${this.dailyLimit})`);
      return false;
    }
    
    return true;
  }

  /**
   * Queue message with smart delay
   */
  async queueMessage(channelId, contactId, content, metadata = {}) {
    try {
      // Check if can send
      if (!await this.canSendMessage(channelId)) {
        throw new Error('Daily message limit reached');
      }
      
      // Calculate delay
      const delay = this.calculateDelay(content.length);
      const scheduledAt = new Date(Date.now() + delay);
      
      // Insert into queue
      const result = await query(
        `INSERT INTO message_queue (channel_id, contact_id, content, scheduled_at, metadata)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [channelId, contactId, content, scheduledAt, metadata]
      );
      
      logger.info(`Message queued for ${scheduledAt.toISOString()} (delay: ${delay}ms)`);
      return result.rows[0];
      
    } catch (error) {
      logger.error('Error queuing message:', error);
      throw error;
    }
  }

  /**
   * Process queued messages (run this in a worker)
   */
  async processMessageQueue() {
    try {
      const now = new Date();
      
      // Get messages ready to send
      const result = await query(
        `SELECT mq.*, c.phone, ch.type as channel_type
         FROM message_queue mq
         JOIN contacts c ON mq.contact_id = c.id
         JOIN channels ch ON mq.channel_id = ch.id
         WHERE mq.status = 'pending' 
         AND mq.scheduled_at <= $1
         ORDER BY mq.scheduled_at ASC
         LIMIT 10`,
        [now]
      );
      
      for (const msg of result.rows) {
        try {
          // Send via WhatsApp
          const whatsappService = (await import('./whatsapp.service.js')).default;
          
          if (msg.metadata?.mediaUrl) {
            await whatsappService.sendMedia(
              msg.channel_id, 
              msg.phone, 
              msg.metadata.mediaUrl, 
              msg.content
            );
          } else {
            await whatsappService.sendMessage(msg.channel_id, msg.phone, msg.content);
          }
          
          // Update queue status
          await query(
            `UPDATE message_queue 
             SET status = 'sent', sent_at = NOW() 
             WHERE id = $1`,
            [msg.id]
          );
          
          // Log message
          await query(
            `INSERT INTO messages (contact_id, channel_id, content, type, media_type, media_url)
             VALUES ($1, $2, $3, 'outbound_bot', $4, $5)`,
            [msg.contact_id, msg.channel_id, msg.content, msg.metadata?.mediaType, msg.metadata?.mediaUrl]
          );
          
          logger.info(`Sent queued message ${msg.id} to ${msg.phone}`);
          
        } catch (error) {
          logger.error(`Failed to send queued message ${msg.id}:`, error);
          
          // Update retry count
          await query(
            `UPDATE message_queue 
             SET retry_count = retry_count + 1,
                 status = CASE WHEN retry_count >= 3 THEN 'failed' ELSE 'pending' END,
                 scheduled_at = CASE WHEN retry_count < 3 THEN NOW() + INTERVAL '5 minutes' ELSE scheduled_at END
             WHERE id = $1`,
            [msg.id]
          );
        }
      }
      
    } catch (error) {
      logger.error('Error processing message queue:', error);
    }
  }

  /**
   * Get channel message stats
   */
  async getChannelStats(channelId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const result = await query(
      `SELECT 
         COUNT(*) FILTER (WHERE created_at >= $2) as today_count,
         COUNT(*) as total_count
       FROM messages 
       WHERE channel_id = $1 AND type LIKE 'outbound%'`,
      [channelId, today]
    );
    
    return {
      todayCount: parseInt(result.rows[0].today_count),
      totalCount: parseInt(result.rows[0].total_count),
      remainingToday: this.dailyLimit - parseInt(result.rows[0].today_count)
    };
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const result = await query(
      `SELECT 
         COUNT(*) FILTER (WHERE status = 'pending') as pending,
         COUNT(*) FILTER (WHERE status = 'sent') as sent,
         COUNT(*) FILTER (WHERE status = 'failed') as failed,
         AVG(EXTRACT(EPOCH FROM (sent_at - scheduled_at))) FILTER (WHERE status = 'sent') as avg_delay
       FROM message_queue
       WHERE created_at >= NOW() - INTERVAL '24 hours'`
    );
    
    return result.rows[0];
  }

  /**
   * Clear old messages from queue
   */
  async cleanupQueue() {
    const result = await query(
      `DELETE FROM message_queue 
       WHERE status IN ('sent', 'failed') 
       AND created_at < NOW() - INTERVAL '7 days'
       RETURNING id`
    );
    
    logger.info(`Cleaned up ${result.rows.length} old messages from queue`);
    return result.rows.length;
  }
}

export default new AntiBanService();