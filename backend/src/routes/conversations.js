import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import conversationService from '../services/conversation.service.js';

const router = express.Router();

// Get conversation list
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { page, limit, status, search, archived, assignedTo } = req.query;
  
  const result = await conversationService.getConversationList(req.organizationId, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 50,
    status,
    search,
    archived: archived === 'true',
    assignedTo: assignedTo ? parseInt(assignedTo) : null
  });
  
  res.json(result);
}));

// Get messages for a contact
router.get('/:contactId/messages', authenticate, asyncHandler(async (req, res) => {
  const { contactId } = req.params;
  const { page, limit, before, after } = req.query;
  
  // Verify contact belongs to organization
  const { query } = await import('../config/database.js');
  const contactCheck = await query(
    'SELECT id FROM contacts WHERE id = $1 AND organization_id = $2',
    [contactId, req.organizationId]
  );
  
  if (contactCheck.rows.length === 0) {
    return res.status(404).json({ error: 'Contact not found' });
  }
  
  const messages = await conversationService.getMessages(parseInt(contactId), {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 50,
    before,
    after
  });
  
  res.json(messages);
}));

// Mark messages as read
router.post('/:contactId/read', authenticate, asyncHandler(async (req, res) => {
  const { contactId } = req.params;
  
  // Verify contact belongs to organization
  const { query } = await import('../config/database.js');
  const contactCheck = await query(
    'SELECT id FROM contacts WHERE id = $1 AND organization_id = $2',
    [contactId, req.organizationId]
  );
  
  if (contactCheck.rows.length === 0) {
    return res.status(404).json({ error: 'Contact not found' });
  }
  
  await conversationService.markAsRead(parseInt(contactId), req.user.id);
  
  res.json({ success: true });
}));

// Search messages
router.get('/search/messages', authenticate, asyncHandler(async (req, res) => {
  const { q, limit } = req.query;
  
  if (!q) {
    return res.status(400).json({ error: 'Search query (q) required' });
  }
  
  const results = await conversationService.searchMessages(
    req.organizationId, 
    q,
    parseInt(limit) || 50
  );
  
  res.json(results);
}));

// Archive conversation
router.post('/:contactId/archive', authenticate, asyncHandler(async (req, res) => {
  const { contactId } = req.params;
  
  // Verify contact belongs to organization
  const { query } = await import('../config/database.js');
  const contactCheck = await query(
    'SELECT id FROM contacts WHERE id = $1 AND organization_id = $2',
    [contactId, req.organizationId]
  );
  
  if (contactCheck.rows.length === 0) {
    return res.status(404).json({ error: 'Contact not found' });
  }
  
  await conversationService.toggleArchive(parseInt(contactId), true);
  
  res.json({ success: true, message: 'Conversation archived' });
}));

// Unarchive conversation
router.post('/:contactId/unarchive', authenticate, asyncHandler(async (req, res) => {
  const { contactId } = req.params;
  
  // Verify contact belongs to organization
  const { query } = await import('../config/database.js');
  const contactCheck = await query(
    'SELECT id FROM contacts WHERE id = $1 AND organization_id = $2',
    [contactId, req.organizationId]
  );
  
  if (contactCheck.rows.length === 0) {
    return res.status(404).json({ error: 'Contact not found' });
  }
  
  await conversationService.toggleArchive(parseInt(contactId), false);
  
  res.json({ success: true, message: 'Conversation unarchived' });
}));

// Pin conversation
router.post('/:contactId/pin', authenticate, asyncHandler(async (req, res) => {
  const { contactId } = req.params;
  
  // Verify contact belongs to organization
  const { query } = await import('../config/database.js');
  const contactCheck = await query(
    'SELECT id FROM contacts WHERE id = $1 AND organization_id = $2',
    [contactId, req.organizationId]
  );
  
  if (contactCheck.rows.length === 0) {
    return res.status(404).json({ error: 'Contact not found' });
  }
  
  await conversationService.togglePin(parseInt(contactId), true);
  
  res.json({ success: true, message: 'Conversation pinned' });
}));

// Unpin conversation
router.post('/:contactId/unpin', authenticate, asyncHandler(async (req, res) => {
  const { contactId } = req.params;
  
  await conversationService.togglePin(parseInt(contactId), false);
  
  res.json({ success: true, message: 'Conversation unpinned' });
}));

// Mute conversation
router.post('/:contactId/mute', authenticate, asyncHandler(async (req, res) => {
  const { contactId } = req.params;
  
  // Verify contact belongs to organization
  const { query } = await import('../config/database.js');
  const contactCheck = await query(
    'SELECT id FROM contacts WHERE id = $1 AND organization_id = $2',
    [contactId, req.organizationId]
  );
  
  if (contactCheck.rows.length === 0) {
    return res.status(404).json({ error: 'Contact not found' });
  }
  
  await conversationService.toggleMute(parseInt(contactId), true);
  
  res.json({ success: true, message: 'Conversation muted' });
}));

// Unmute conversation
router.post('/:contactId/unmute', authenticate, asyncHandler(async (req, res) => {
  const { contactId } = req.params;
  
  await conversationService.toggleMute(parseInt(contactId), false);
  
  res.json({ success: true, message: 'Conversation unmuted' });
}));

// Get conversation stats
router.get('/stats/summary', authenticate, asyncHandler(async (req, res) => {
  const stats = await conversationService.getStats(req.organizationId);
  
  res.json(stats);
}));

// Get conversation details with full context
router.get('/:contactId/details', authenticate, asyncHandler(async (req, res) => {
  const { contactId } = req.params;
  const { query } = await import('../config/database.js');
  
  // Get contact with full details
  const contactResult = await query(
    `SELECT 
       c.*,
       lcs.status as chat_status,
       lcs.assigned_user_id,
       u.name as assigned_user_name,
       fs.engagement_score,
       fs.user_sentiment,
       fs.last_interaction
     FROM contacts c
     LEFT JOIN live_chat_sessions lcs ON c.id = lcs.contact_id
     LEFT JOIN users u ON lcs.assigned_user_id = u.id
     LEFT JOIN flow_states fs ON c.id = fs.contact_id
     WHERE c.id = $1 AND c.organization_id = $2`,
    [contactId, req.organizationId]
  );
  
  if (contactResult.rows.length === 0) {
    return res.status(404).json({ error: 'Contact not found' });
  }
  
  const contact = contactResult.rows[0];
  
  // Get tags
  const tagsResult = await query(
    'SELECT * FROM contact_tags WHERE contact_id = $1',
    [contactId]
  );
  
  // Get message count
  const messageCount = await query(
    'SELECT COUNT(*) as count FROM messages WHERE contact_id = $1',
    [contactId]
  );
  
  // Get active flows
  const activeFlows = await query(
    `SELECT f.id, f.name, fs.current_node_id, fs.variables
     FROM flow_states fs
     JOIN flows f ON fs.flow_id = f.id
     WHERE fs.contact_id = $1`,
    [contactId]
  );
  
  res.json({
    contact,
    tags: tagsResult.rows,
    messageCount: parseInt(messageCount.rows[0].count),
    activeFlows: activeFlows.rows
  });
}));

// Bulk archive conversations
router.post('/bulk/archive', authenticate, asyncHandler(async (req, res) => {
  const { contactIds } = req.body;
  
  if (!Array.isArray(contactIds) || contactIds.length === 0) {
    return res.status(400).json({ error: 'contactIds array required' });
  }
  
  const { query } = await import('../config/database.js');
  
  const result = await query(
    `UPDATE contacts 
     SET archived_at = NOW()
     WHERE id = ANY($1) AND organization_id = $2
     RETURNING id`,
    [contactIds, req.organizationId]
  );
  
  res.json({ 
    success: true, 
    archived: result.rows.length,
    ids: result.rows.map(r => r.id)
  });
}));

// Bulk assign conversations
router.post('/bulk/assign', authenticate, asyncHandler(async (req, res) => {
  const { contactIds, userId } = req.body;
  
  if (!Array.isArray(contactIds) || contactIds.length === 0) {
    return res.status(400).json({ error: 'contactIds array required' });
  }
  
  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }
  
  const { query } = await import('../config/database.js');
  
  // Verify user belongs to organization
  const userCheck = await query(
    `SELECT u.id FROM users u
     JOIN user_organizations uo ON u.id = uo.user_id
     WHERE u.id = $1 AND uo.organization_id = $2`,
    [userId, req.organizationId]
  );
  
  if (userCheck.rows.length === 0) {
    return res.status(404).json({ error: 'User not found in organization' });
  }
  
  // Create or update live chat sessions
  for (const contactId of contactIds) {
    await query(
      `INSERT INTO live_chat_sessions (contact_id, assigned_user_id, status)
       VALUES ($1, $2, 'active')
       ON CONFLICT (contact_id) 
       DO UPDATE SET assigned_user_id = $2, status = 'active', created_at = NOW()`,
      [contactId, userId]
    );
  }
  
  res.json({ 
    success: true, 
    assigned: contactIds.length,
    userId
  });
}));

export default router;