import { query } from '../config/database.js';
import { logger } from '../middleware/errorHandler.js';
import redisClient from '../config/redis.js';

class ConversationService {
  
  /**
   * Get conversation list with pagination and filtering
   */
  async getConversationList(organizationId, options = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        status = null, // all, pending, active, resolved, bot
        search = null,
        archived = false,
        assignedTo = null
      } = options;
      
      const offset = (page - 1) * limit;
      
      // Try cache first
      const cacheKey = `conversations:${organizationId}:${JSON.stringify(options)}`;
      
      if (redisClient.isOpen) {
        try {
          const cached = await redisClient.get(cacheKey);
          if (cached) {
            return JSON.parse(cached);
          }
        } catch (error) {
          logger.warn('Redis cache error:', error.message);
        }
      }
      
      let whereClause = 'WHERE cl.organization_id = $1';
      const params = [organizationId];
      let paramCount = 1;
      
      if (archived) {
        whereClause += ` AND c.archived_at IS NOT NULL`;
      } else {
        whereClause += ` AND c.archived_at IS NULL`;
      }
      
      if (status && status !== 'all') {
        paramCount++;
        whereClause += ` AND cl.chat_status = $${paramCount}`;
        params.push(status);
      }
      
      if (assignedTo) {
        paramCount++;
        whereClause += ` AND cl.assigned_user_id = $${paramCount}`;
        params.push(assignedTo);
      }
      
      if (search) {
        paramCount++;
        whereClause += ` AND (cl.name ILIKE $${paramCount} OR cl.phone ILIKE $${paramCount})`;
        params.push(`%${search}%`);
      }
      
      // Get total count
      const countResult = await query(
        `SELECT COUNT(*) FROM conversation_list cl 
         LEFT JOIN contacts c ON cl.contact_id = c.id
         ${whereClause}`,
        params
      );
      
      const totalCount = parseInt(countResult.rows[0].count);
      
      // Get conversations
      const result = await query(
        `SELECT 
          cl.*,
          c.custom_fields,
          c.pinned,
          c.muted,
          u.name as assigned_user_name
         FROM conversation_list cl
         LEFT JOIN contacts c ON cl.contact_id = c.id
         LEFT JOIN users u ON cl.assigned_user_id = u.id
         ${whereClause}
         ORDER BY c.pinned DESC, cl.last_message_at DESC NULLS LAST
         LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
        [...params, limit, offset]
      );
      
      const response = {
        conversations: result.rows,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasMore: offset + result.rows.length < totalCount
        }
      };
      
      // Cache for 10 seconds
      if (redisClient.isOpen) {
        try {
          await redisClient.setEx(cacheKey, 10, JSON.stringify(response));
        } catch (error) {
          logger.warn('Redis cache set error:', error.message);
        }
      }
      
      return response;
    } catch (error) {
      logger.error('Error getting conversation list:', error);
      throw error;
    }
  }

  /**
   * Get messages for a contact with pagination
   */
  async getMessages(contactId, options = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        before = null, // timestamp
        after = null
      } = options;
      
      const offset = (page - 1) * limit;
      
      let whereClause = 'WHERE contact_id = $1';
      const params = [contactId];
      let paramCount = 1;
      
      if (before) {
        paramCount++;
        whereClause += ` AND created_at < $${paramCount}`;
        params.push(before);
      }
      
      if (after) {
        paramCount++;
        whereClause += ` AND created_at > $${paramCount}`;
        params.push(after);
      }
      
      const result = await query(
        `SELECT * FROM messages
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
        [...params, limit, offset]
      );
      
      // Reverse to show oldest first
      return result.rows.reverse();
    } catch (error) {
      logger.error('Error getting messages:', error);
      throw error;
    }
  }

  /**
   * Mark messages as read
   */
  async markAsRead(contactId, userId) {
    try {
      await query(
        `UPDATE messages 
         SET read_at = NOW() 
         WHERE contact_id = $1 
         AND read_at IS NULL 
         AND type = 'inbound'`,
        [contactId]
      );
      
      // Reset unread count
      await query(
        'UPDATE contacts SET unread_count = 0 WHERE id = $1',
        [contactId]
      );
      
      // Invalidate cache
      const contactResult = await query('SELECT organization_id FROM contacts WHERE id = $1', [contactId]);
      if (contactResult.rows.length > 0) {
        const orgId = contactResult.rows[0].organization_id;
        
        if (redisClient.isOpen) {
          try {
            const keys = await redisClient.keys(`conversations:${orgId}:*`);
            if (keys.length > 0) {
              await redisClient.del(keys);
            }
          } catch (error) {
            logger.warn('Redis cache invalidation error:', error.message);
          }
        }
      }
      
      logger.info(`Messages marked as read for contact ${contactId} by user ${userId}`);
    } catch (error) {
      logger.error('Error marking messages as read:', error);
      throw error;
    }
  }

  /**
   * Update last message cache
   */
  async updateLastMessage(contactId, message) {
    try {
      await query(
        `UPDATE contacts 
         SET last_message_at = $1,
             last_message_preview = $2,
             unread_count = CASE WHEN $3 = 'inbound' THEN unread_count + 1 ELSE unread_count END
         WHERE id = $4`,
        [message.created_at, message.content?.substring(0, 100), message.type, contactId]
      );
      
      // Refresh materialized view
      try {
        await query('REFRESH MATERIALIZED VIEW CONCURRENTLY conversation_list');
      } catch (error) {
        logger.warn('Could not refresh materialized view:', error.message);
      }
      
      // Invalidate cache
      const contactResult = await query('SELECT organization_id FROM contacts WHERE id = $1', [contactId]);
      if (contactResult.rows.length > 0 && redisClient.isOpen) {
        const orgId = contactResult.rows[0].organization_id;
        try {
          const keys = await redisClient.keys(`conversations:${orgId}:*`);
          if (keys.length > 0) {
            await redisClient.del(keys);
          }
        } catch (error) {
          logger.warn('Redis cache invalidation error:', error.message);
        }
      }
    } catch (error) {
      logger.error('Error updating last message:', error);
    }
  }

  /**
   * Search messages
   */
  async searchMessages(organizationId, searchQuery, limit = 50) {
    try {
      const result = await query(
        `SELECT m.*, c.name, c.phone
         FROM messages m
         JOIN contacts c ON m.contact_id = c.id
         WHERE c.organization_id = $1
         AND m.search_vector @@ plainto_tsquery('english', $2)
         ORDER BY m.created_at DESC
         LIMIT $3`,
        [organizationId, searchQuery, limit]
      );
      
      return result.rows;
    } catch (error) {
      logger.error('Error searching messages:', error);
      throw error;
    }
  }

  /**
   * Archive/Unarchive conversation
   */
  async toggleArchive(contactId, archive = true) {
    try {
      await query(
        'UPDATE contacts SET archived_at = $1 WHERE id = $2',
        [archive ? new Date() : null, contactId]
      );
      
      logger.info(`Contact ${contactId} ${archive ? 'archived' : 'unarchived'}`);
    } catch (error) {
      logger.error('Error toggling archive:', error);
      throw error;
    }
  }

  /**
   * Pin/Unpin conversation
   */
  async togglePin(contactId, pin = true) {
    try {
      await query(
        'UPDATE contacts SET pinned = $1 WHERE id = $2',
        [pin, contactId]
      );
      
      logger.info(`Contact ${contactId} ${pin ? 'pinned' : 'unpinned'}`);
    } catch (error) {
      logger.error('Error toggling pin:', error);
      throw error;
    }
  }

  /**
   * Mute/Unmute conversation
   */
  async toggleMute(contactId, mute = true) {
    try {
      await query(
        'UPDATE contacts SET muted = $1 WHERE id = $2',
        [mute, contactId]
      );
      
      logger.info(`Contact ${contactId} ${mute ? 'muted' : 'unmuted'}`);
    } catch (error) {
      logger.error('Error toggling mute:', error);
      throw error;
    }
  }

  /**
   * Get conversation statistics
   */
  async getStats(organizationId) {
    try {
      const result = await query(
        `SELECT 
          COUNT(*) as total_conversations,
          COUNT(*) FILTER (WHERE chat_status = 'pending') as pending,
          COUNT(*) FILTER (WHERE chat_status = 'active') as active,
          COUNT(*) FILTER (WHERE chat_status = 'bot') as bot,
          COUNT(*) FILTER (WHERE unread_count > 0) as unread,
          COUNT(*) FILTER (WHERE archived_at IS NOT NULL) as archived
         FROM conversation_list cl
         LEFT JOIN contacts c ON cl.contact_id = c.id
         WHERE cl.organization_id = $1`,
        [organizationId]
      );
      
      return result.rows[0];
    } catch (error) {
      logger.error('Error getting conversation stats:', error);
      throw error;
    }
  }
}

export default new ConversationService();