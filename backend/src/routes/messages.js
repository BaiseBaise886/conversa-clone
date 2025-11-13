import express from 'express';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import whatsappService from '../services/whatsapp.service.js';
import antiBanService from '../services/antiban.service.js';

const router = express.Router();

// Get messages for a contact
router.get('/contact/:contactId', authenticate, asyncHandler(async (req, res) => {
  const { page = 1, limit = 100 } = req.query;
  const offset = (page - 1) * limit;
  
  const result = await query(
    `SELECT m.* FROM messages m
     JOIN contacts c ON m.contact_id = c.id
     WHERE c.id = $1 AND c.organization_id = $2
     ORDER BY m.created_at ASC
     LIMIT $3 OFFSET $4`,
    [req.params.contactId, req.organizationId, limit, offset]
  );
  
  res.json(result.rows);
}));

// Send message to contact
router.post('/send', authenticate, asyncHandler(async (req, res) => {
  const { contactId, content, mediaType, mediaUrl } = req.body;
  
  if (!contactId) {
    return res.status(400).json({ error: 'contactId required' });
  }
  
  if (!content && !mediaUrl) {
    return res.status(400).json({ error: 'content or mediaUrl required' });
  }
  
  // Get contact with channel
  const contactResult = await query(
    `SELECT c.*, ch.id as channel_id, ch.type as channel_type
     FROM contacts c
     LEFT JOIN channels ch ON ch.organization_id = c.organization_id 
       AND ch.type = c.channel_type 
       AND ch.status = 'connected'
     WHERE c.id = $1 AND c.organization_id = $2`,
    [contactId, req.organizationId]
  );
  
  if (contactResult.rows.length === 0) {
    return res.status(404).json({ error: 'Contact not found' });
  }
  
  const contact = contactResult.rows[0];
  
  if (!contact.channel_id) {
    return res.status(400).json({ error: 'No connected channel for this contact' });
  }
  
  // Queue message with anti-ban delay
  await antiBanService.queueMessage(
    contact.channel_id,
    contactId,
    content || '[Media]',
    { 
      mediaType, 
      mediaUrl,
      sentBy: req.user.id 
    }
  );
  
  // Save message to database
  const msgResult = await query(
    `INSERT INTO messages (contact_id, channel_id, content, type, media_type, media_url)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [contactId, contact.channel_id, content || '[Media]', 'outbound_agent', mediaType, mediaUrl]
  );
  
  // Emit via WebSocket
  const io = req.app.get('io');
  if (io) {
    io.to(`org-${req.organizationId}`).emit('new_message', msgResult.rows[0]);
  }
  
  res.json(msgResult.rows[0]);
}));

// Send voice note
router.post('/send-voice', authenticate, asyncHandler(async (req, res) => {
  const { contactId, mediaId } = req.body;
  
  if (!contactId || !mediaId) {
    return res.status(400).json({ error: 'contactId and mediaId required' });
  }
  
  // Get media file
  const mediaResult = await query(
    'SELECT * FROM media_library WHERE id = $1 AND organization_id = $2',
    [mediaId, req.organizationId]
  );
  
  if (mediaResult.rows.length === 0) {
    return res.status(404).json({ error: 'Media file not found' });
  }
  
  const media = mediaResult.rows[0];
  
  if (media.file_type !== 'audio') {
    return res.status(400).json({ error: 'Media must be audio type for voice notes' });
  }
  
  // Get contact
  const contactResult = await query(
    `SELECT c.*, ch.id as channel_id 
     FROM contacts c
     LEFT JOIN channels ch ON ch.organization_id = c.organization_id 
       AND ch.type = c.channel_type AND ch.status = 'connected'
     WHERE c.id = $1 AND c.organization_id = $2`,
    [contactId, req.organizationId]
  );
  
  if (contactResult.rows.length === 0) {
    return res.status(404).json({ error: 'Contact not found' });
  }
  
  const contact = contactResult.rows[0];
  
  if (!contact.channel_id) {
    return res.status(400).json({ error: 'No connected channel' });
  }
  
  // Send voice note
  await whatsappService.sendVoiceNote(contact.channel_id, contact.phone, media.file_path);
  
  // Save message
  const msgResult = await query(
    `INSERT INTO messages (contact_id, channel_id, content, type, media_type, media_url, media_filename)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [contactId, contact.channel_id, '[Voice Note]', 'outbound_agent', 'audio', media.file_path, media.file_name]
  );
  
  res.json(msgResult.rows[0]);
}));

// Get conversation stats
router.get('/stats', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT 
       COUNT(DISTINCT m.contact_id) as total_conversations,
       COUNT(*) as total_messages,
       COUNT(*) FILTER (WHERE m.type = 'inbound') as inbound_messages,
       COUNT(*) FILTER (WHERE m.type LIKE 'outbound%') as outbound_messages,
       COUNT(*) FILTER (WHERE m.created_at >= NOW() - INTERVAL '24 hours') as last_24h
     FROM messages m
     JOIN contacts c ON m.contact_id = c.id
     WHERE c.organization_id = $1`,
    [req.organizationId]
  );
  
  res.json(result.rows[0]);
}));

// Search messages
router.get('/search', authenticate, asyncHandler(async (req, res) => {
  const { q, limit = 50 } = req.query;
  
  if (!q) {
    return res.status(400).json({ error: 'Search query required' });
  }
  
  const result = await query(
    `SELECT m.*, c.name as contact_name, c.phone
     FROM messages m
     JOIN contacts c ON m.contact_id = c.id
     WHERE c.organization_id = $1
     AND m.search_vector @@ plainto_tsquery('english', $2)
     ORDER BY m.created_at DESC
     LIMIT $3`,
    [req.organizationId, q, limit]
  );
  
  res.json(result.rows);
}));

// Bulk send messages
router.post('/bulk-send', authenticate, asyncHandler(async (req, res) => {
  const { contactIds, content } = req.body;
  
  if (!Array.isArray(contactIds) || contactIds.length === 0) {
    return res.status(400).json({ error: 'contactIds array required' });
  }
  
  if (!content) {
    return res.status(400).json({ error: 'content required' });
  }
  
  const sent = [];
  const errors = [];
  
  for (const contactId of contactIds) {
    try {
      const contactResult = await query(
        `SELECT c.*, ch.id as channel_id 
         FROM contacts c
         LEFT JOIN channels ch ON ch.organization_id = c.organization_id 
           AND ch.type = c.channel_type AND ch.status = 'connected'
         WHERE c.id = $1 AND c.organization_id = $2`,
        [contactId, req.organizationId]
      );
