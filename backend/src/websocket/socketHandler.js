import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { query } from '../config/database.js';
import { logger } from '../middleware/errorHandler.js';

export function initializeWebSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: config.frontendUrl,
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication required'));
      }
      
      const decoded = jwt.verify(token, config.jwt.secret);
      
      const result = await query(
        `SELECT u.*, uo.organization_id, uo.role
         FROM users u
         JOIN user_organizations uo ON u.id = uo.user_id
         WHERE u.id = $1`,
        [decoded.userId]
      );
      
      if (result.rows.length === 0) {
        return next(new Error('User not found'));
      }
      
      socket.user = result.rows[0];
      socket.organizationId = result.rows[0].organization_id;
      
      next();
    } catch (error) {
      logger.error('WebSocket auth error:', error);
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', async (socket) => {
    logger.info(`WebSocket connected: User ${socket.user.id} (${socket.user.email}), Org ${socket.organizationId}`);
    
    // Join organization room
    socket.join(`org-${socket.organizationId}`);
    
    // Update user presence
    await query(
      `INSERT INTO user_presence (user_id, organization_id, status, last_seen, socket_id)
       VALUES ($1, $2, 'online', NOW(), $3)
       ON CONFLICT (user_id) 
       DO UPDATE SET status = 'online', last_seen = NOW(), socket_id = $3`,
      [socket.user.id, socket.organizationId, socket.id]
    );
    
    // Broadcast user online to organization
    io.to(`org-${socket.organizationId}`).emit('user_presence', {
      userId: socket.user.id,
      userName: socket.user.name,
      status: 'online',
      timestamp: new Date().toISOString()
    });

    // Get online users in organization
    socket.on('get_online_users', async (callback) => {
      try {
        const result = await query(
          `SELECT u.id, u.name, u.email, up.status, up.last_seen
           FROM user_presence up
           JOIN users u ON up.user_id = u.id
           WHERE up.organization_id = $1 AND up.status = 'online'`,
          [socket.organizationId]
        );
        
        if (callback) callback({ users: result.rows });
      } catch (error) {
        logger.error('Error getting online users:', error);
        if (callback) callback({ error: 'Failed to get online users' });
      }
    });

    // Join active chat rooms
    socket.on('join_chat', async (data) => {
      const { contactId } = data;
      
      if (!contactId) {
        socket.emit('error', { message: 'contactId required' });
        return;
      }
      
      // Verify contact belongs to organization
      const contactCheck = await query(
        'SELECT id FROM contacts WHERE id = $1 AND organization_id = $2',
        [contactId, socket.organizationId]
      );
      
      if (contactCheck.rows.length === 0) {
        socket.emit('error', { message: 'Contact not found or access denied' });
        return;
      }
      
      socket.join(`chat-${contactId}`);
      
      // Note: Active chats tracking removed for MySQL compatibility
      // The active_chats array field requires PostgreSQL-specific array operations
      // Real-time presence is still tracked via socket connections
      
      logger.info(`User ${socket.user.id} joined chat ${contactId}`);
      
      // Notify other users in the chat
      socket.to(`chat-${contactId}`).emit('user_joined_chat', {
        contactId,
        userId: socket.user.id,
        userName: socket.user.name
      });
    });

    // Leave chat room
    socket.on('leave_chat', async (data) => {
      const { contactId } = data;
      
      if (!contactId) {
        socket.emit('error', { message: 'contactId required' });
        return;
      }
      
      socket.leave(`chat-${contactId}`);
      
      // Note: Active chats tracking removed for MySQL compatibility
      
      logger.info(`User ${socket.user.id} left chat ${contactId}`);
      
      // Notify other users
      socket.to(`chat-${contactId}`).emit('user_left_chat', {
        contactId,
        userId: socket.user.id,
        userName: socket.user.name
      });
    });

    // Typing indicator
    socket.on('typing_start', async (data) => {
      const { contactId } = data;
      
      if (!contactId) return;
      
      await query(
        `INSERT INTO typing_indicators (contact_id, user_id, is_typing, updated_at)
         VALUES ($1, $2, true, NOW())
         ON CONFLICT ON CONSTRAINT typing_indicators_pkey 
         DO UPDATE SET is_typing = true, updated_at = NOW()`,
        [contactId, socket.user.id]
      ).catch(() => {
        // If constraint doesn't exist, try without it
        query(
          `DELETE FROM typing_indicators WHERE contact_id = $1 AND user_id = $2;
           INSERT INTO typing_indicators (contact_id, user_id, is_typing, updated_at)
           VALUES ($1, $2, true, NOW())`,
          [contactId, socket.user.id]
        );
      });
      
      socket.to(`chat-${contactId}`).emit('user_typing', {
        contactId,
        userId: socket.user.id,
        userName: socket.user.name
      });
    });

    socket.on('typing_stop', async (data) => {
      const { contactId } = data;
      
      if (!contactId) return;
      
      await query(
        `DELETE FROM typing_indicators WHERE contact_id = $1 AND user_id = $2`,
        [contactId, socket.user.id]
      );
      
      socket.to(`chat-${contactId}`).emit('user_stopped_typing', {
        contactId,
        userId: socket.user.id
      });
    });

    // Mark messages as read
    socket.on('mark_read', async (data) => {
      const { contactId } = data;
      
      if (!contactId) return;
      
      try {
        await query(
          `UPDATE messages 
           SET read_at = NOW() 
           WHERE contact_id = $1 AND read_at IS NULL AND type = 'inbound'`,
          [contactId]
        );
        
        await query(
          'UPDATE contacts SET unread_count = 0 WHERE id = $1',
          [contactId]
        );
        
        // Notify other users in organization
        io.to(`org-${socket.organizationId}`).emit('messages_read', {
          contactId,
          readBy: socket.user.id,
          readByName: socket.user.name,
          timestamp: new Date().toISOString()
        });
        
        logger.info(`Messages marked as read for contact ${contactId} by user ${socket.user.id}`);
      } catch (error) {
        logger.error('Error marking messages as read:', error);
        socket.emit('error', { message: 'Failed to mark messages as read' });
      }
    });

    // Send message
    socket.on('send_message', async (data) => {
      const { contactId, content, mediaType, mediaUrl } = data;
      
      if (!contactId || (!content && !mediaUrl)) {
        socket.emit('error', { message: 'contactId and content or mediaUrl required' });
        return;
      }
      
      try {
        // Verify contact belongs to organization
        const contactCheck = await query(
          'SELECT c.*, ch.id as channel_id FROM contacts c LEFT JOIN channels ch ON ch.organization_id = c.organization_id AND ch.type = c.channel_type AND ch.status = \'connected\' WHERE c.id = $1 AND c.organization_id = $2',
          [contactId, socket.organizationId]
        );
        
        if (contactCheck.rows.length === 0) {
          socket.emit('error', { message: 'Contact not found or access denied' });
          return;
        }
        
        const contact = contactCheck.rows[0];
        
        // Save message to database
        const result = await query(
          `INSERT INTO messages (contact_id, channel_id, content, type, media_type, media_url, created_at)
           VALUES ($1, $2, $3, 'outbound_agent', $4, $5, NOW())
           RETURNING *`,
          [contactId, contact.channel_id, content || '[Media]', mediaType, mediaUrl]
        );
        
        const message = result.rows[0];
        
        // Broadcast to all users in organization
        io.to(`org-${socket.organizationId}`).emit('new_message', {
          message,
          sentBy: socket.user.id,
          sentByName: socket.user.name
        });
        
        // Send via WhatsApp if channel is available
        if (contact.channel_id) {
          const whatsappService = (await import('../services/whatsapp.service.js')).default;
          
          if (mediaUrl) {
            await whatsappService.sendMedia(contact.channel_id, contact.phone, mediaUrl, content);
          } else {
            await whatsappService.sendMessage(contact.channel_id, contact.phone, content);
          }
        }
        
        logger.info(`Message sent by user ${socket.user.id} to contact ${contactId}`);
        
      } catch (error) {
        logger.error('Error sending message via socket:', error);
        socket.emit('message_error', { error: error.message });
      }
    });

    // Live chat actions
    socket.on('claim_chat', async (data) => {
      const { contactId } = data;
      
      if (!contactId) {
        socket.emit('error', { message: 'contactId required' });
        return;
      }
      
      try {
        // Verify contact belongs to organization
        const contactCheck = await query(
          'SELECT id FROM contacts WHERE id = $1 AND organization_id = $2',
          [contactId, socket.organizationId]
        );
        
        if (contactCheck.rows.length === 0) {
          socket.emit('error', { message: 'Contact not found or access denied' });
          return;
        }
        
        const result = await query(
          `INSERT INTO live_chat_sessions (contact_id, assigned_user_id, status, created_at)
           VALUES ($1, $2, 'active', NOW())
           ON CONFLICT (contact_id) DO UPDATE 
           SET assigned_user_id = $2, status = 'active', created_at = NOW()
           RETURNING *`,
          [contactId, socket.user.id]
        );
        
        io.to(`org-${socket.organizationId}`).emit('chat_claimed', {
          session: result.rows[0],
          claimedBy: { id: socket.user.id, name: socket.user.name, email: socket.user.email }
        });
        
        logger.info(`Chat ${contactId} claimed by user ${socket.user.id}`);
      } catch (error) {
        logger.error('Error claiming chat:', error);
        socket.emit('error', { message: 'Failed to claim chat' });
      }
    });

    socket.on('resolve_chat', async (data) => {
      const { contactId } = data;
      
      if (!contactId) {
        socket.emit('error', { message: 'contactId required' });
        return;
      }
      
      try {
        await query(
          `UPDATE live_chat_sessions 
           SET status = 'resolved', resolved_at = NOW()
           WHERE contact_id = $1 AND status = 'active'`,
          [contactId]
        );
        
        io.to(`org-${socket.organizationId}`).emit('chat_resolved', {
          contactId,
          resolvedBy: socket.user.id,
          resolvedByName: socket.user.name,
          timestamp: new Date().toISOString()
        });
        
        logger.info(`Chat ${contactId} resolved by user ${socket.user.id}`);
      } catch (error) {
        logger.error('Error resolving chat:', error);
        socket.emit('error', { message: 'Failed to resolve chat' });
      }
    });

    socket.on('transfer_chat', async (data) => {
      const { contactId, toUserId } = data;
      
      if (!contactId || !toUserId) {
        socket.emit('error', { message: 'contactId and toUserId required' });
        return;
      }
      
      try {
        // Verify target user is in same organization
        const userCheck = await query(
          `SELECT u.id, u.name FROM users u
           JOIN user_organizations uo ON u.id = uo.user_id
           WHERE u.id = $1 AND uo.organization_id = $2`,
          [toUserId, socket.organizationId]
        );
        
        if (userCheck.rows.length === 0) {
          socket.emit('error', { message: 'Target user not found in organization' });
          return;
        }
        
        await query(
          `UPDATE live_chat_sessions 
           SET assigned_user_id = $1
           WHERE contact_id = $2`,
          [toUserId, contactId]
        );
        
        io.to(`org-${socket.organizationId}`).emit('chat_transferred', {
          contactId,
          fromUserId: socket.user.id,
          fromUserName: socket.user.name,
          toUserId,
          toUserName: userCheck.rows[0].name,
          timestamp: new Date().toISOString()
        });
        
        logger.info(`Chat ${contactId} transferred from user ${socket.user.id} to user ${toUserId}`);
      } catch (error) {
        logger.error('Error transferring chat:', error);
        socket.emit('error', { message: 'Failed to transfer chat' });
      }
    });

    // Notify about new contact
    socket.on('new_contact_created', (data) => {
      io.to(`org-${socket.organizationId}`).emit('contact_created', {
        contact: data.contact,
        createdBy: socket.user.id,
        createdByName: socket.user.name
      });
    });

    // Notify about flow execution
    socket.on('flow_started', (data) => {
      const { contactId, flowId, flowName } = data;
      
      io.to(`org-${socket.organizationId}`).emit('flow_execution_started', {
        contactId,
        flowId,
        flowName,
        startedBy: socket.user.id,
        timestamp: new Date().toISOString()
      });
    });

    // Get conversation statistics in real-time
    socket.on('get_stats', async (callback) => {
      try {
        const stats = await query(
          `SELECT 
             COUNT(DISTINCT c.id) as total_contacts,
             COUNT(DISTINCT m.id) as total_messages,
             COUNT(DISTINCT CASE WHEN m.created_at >= NOW() - INTERVAL 24 HOUR THEN m.id END) as messages_24h,
             COUNT(DISTINCT CASE WHEN lcs.status = 'pending' THEN lcs.id END) as pending_chats,
             COUNT(DISTINCT CASE WHEN lcs.status = 'active' THEN lcs.id END) as active_chats
           FROM contacts c
           LEFT JOIN messages m ON c.id = m.contact_id
           LEFT JOIN live_chat_sessions lcs ON c.id = lcs.contact_id
           WHERE c.organization_id = $1`,
          [socket.organizationId]
        );
        
        if (callback) callback({ stats: stats.rows[0] });
      } catch (error) {
        logger.error('Error getting stats:', error);
        if (callback) callback({ error: 'Failed to get statistics' });
      }
    });

    // Heartbeat / Keep-alive
    socket.on('ping', (callback) => {
      if (callback) callback({ pong: true, timestamp: new Date().toISOString() });
    });

    // Disconnect handler
    socket.on('disconnect', async (reason) => {
      logger.info(`WebSocket disconnected: User ${socket.user.id}, Reason: ${reason}`);
      
      try {
        // Update presence
        await query(
          `UPDATE user_presence 
           SET status = 'offline', last_seen = NOW()
           WHERE user_id = $1`,
          [socket.user.id]
        );
        
        // Clear typing indicators
        await query(
          'DELETE FROM typing_indicators WHERE user_id = $1',
          [socket.user.id]
        );
        
        // Broadcast user offline
        io.to(`org-${socket.organizationId}`).emit('user_presence', {
          userId: socket.user.id,
          userName: socket.user.name,
          status: 'offline',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('Error handling disconnect:', error);
      }
    });

    // Error handler
    socket.on('error', (error) => {
      logger.error('Socket error:', error);
      socket.emit('error', { message: 'An error occurred', details: error.message });
    });
  });

  // Refresh conversation list periodically
  // Note: Stored procedure refresh_conversation_list() removed as it's not required for MySQL
  // The conversation list is updated in real-time via WebSocket events

  // Clean up stale typing indicators
  setInterval(async () => {
    try {
      await query(
        `DELETE FROM typing_indicators 
         WHERE updated_at < NOW() - INTERVAL 10 SECOND`
      );
    } catch (error) {
      logger.error('Error cleaning typing indicators:', error);
    }
  }, 5000); // Every 5 seconds

  // Clean up stale user presence
  setInterval(async () => {
    try {
      await query(
        `UPDATE user_presence 
         SET status = 'offline' 
         WHERE status = 'online' 
         AND last_seen < NOW() - INTERVAL 5 MINUTE`
      );
    } catch (error) {
      logger.error('Error cleaning user presence:', error);
    }
  }, 60000); // Every minute

  logger.info('✅ WebSocket server initialized');

  return io;
}

export default initializeWebSocket;