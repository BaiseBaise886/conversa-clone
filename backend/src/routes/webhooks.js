import express from 'express';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import queueService from '../services/queue.service.js';
import { logger } from '../middleware/errorHandler.js';

const router = express.Router();

// Trigger flow manually (for testing)
router.post('/trigger', authenticate, asyncHandler(async (req, res) => {
  const { contactId, flowId, eventData } = req.body;
  
  if (!contactId || !flowId) {
    return res.status(400).json({ error: 'contactId and flowId required' });
  }
  
  // Verify contact and flow belong to organization
  const contactResult = await query(
    'SELECT * FROM contacts WHERE id = $1 AND organization_id = $2',
    [contactId, req.organizationId]
  );
  
  const flowResult = await query(
    'SELECT * FROM flows WHERE id = $1 AND organization_id = $2',
    [flowId, req.organizationId]
  );
  
  if (contactResult.rows.length === 0) {
    return res.status(404).json({ error: 'Contact not found' });
  }
  
  if (flowResult.rows.length === 0) {
    return res.status(404).json({ error: 'Flow not found' });
  }
  
  const flow = flowResult.rows[0];
  
  // Add to queue
  await queueService.executeFlow(flow, contactId, req.organizationId);
  
  // Log event
  await query(
    `INSERT INTO event_logs (organization_id, contact_id, event_name, metadata)
     VALUES ($1, $2, $3, $4)`,
    [req.organizationId, contactId, 'flow_triggered_manually', JSON.stringify(eventData || {})]
  );
  
  logger.info(`Flow ${flowId} triggered manually for contact ${contactId}`);
  
  res.json({ 
    success: true, 
    flowName: flow.name,
    message: 'Flow execution started'
  });
}));

// External webhook endpoint (no auth - uses org ID in URL)
router.post('/external/:organizationId', asyncHandler(async (req, res) => {
  const organizationId = parseInt(req.params.organizationId);
  const { phone, email, eventName, data, flowId } = req.body;
  
  if (!eventName) {
    return res.status(400).json({ error: 'eventName required' });
  }
  
  if (!phone && !email) {
    return res.status(400).json({ error: 'phone or email required' });
  }
  
  // Validate organization exists
  const orgResult = await query(
    'SELECT id FROM organizations WHERE id = $1',
    [organizationId]
  );
  
  if (orgResult.rows.length === 0) {
    return res.status(404).json({ error: 'Organization not found' });
  }
  
  // Find or create contact
  let contactResult;
  if (phone) {
    contactResult = await query(
      'SELECT * FROM contacts WHERE organization_id = $1 AND phone = $2',
      [organizationId, phone]
    );
  } else {
    contactResult = await query(
      'SELECT * FROM contacts WHERE organization_id = $1 AND email = $2',
      [organizationId, email]
    );
  }
  
  let contact;
  if (contactResult.rows.length === 0) {
    const insertResult = await query(
      `INSERT INTO contacts (organization_id, phone, email, name, channel_type)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [organizationId, phone, email, phone || email, 'whatsapp']
    );
    contact = insertResult.rows[0];
    logger.info(`New contact created via webhook: ${contact.id}`);
  } else {
    contact = contactResult.rows[0];
  }
  
  // Find flow to trigger
  let flow;
  if (flowId) {
    // Specific flow requested
    const flowResult = await query(
      'SELECT * FROM flows WHERE id = $1 AND organization_id = $2 AND is_active = true',
      [flowId, organizationId]
    );
    if (flowResult.rows.length > 0) {
      flow = flowResult.rows[0];
    }
  } else {
    // Find flow by event name in keywords
    const flowResult = await query(
      `SELECT * FROM flows 
       WHERE organization_id = $1 
       AND is_active = true 
       AND $2 = ANY(keyword_triggers)
       LIMIT 1`,
      [organizationId, eventName]
    );
    if (flowResult.rows.length > 0) {
      flow = flowResult.rows[0];
    }
  }
  
  // Execute flow if found
  if (flow) {
    await queueService.executeFlow(flow, contact.id, organizationId);
    logger.info(`External webhook triggered flow ${flow.id} for contact ${contact.id}`);
  }
  
  // Log event
  await query(
    `INSERT INTO event_logs (organization_id, contact_id, event_name, metadata)
     VALUES ($1, $2, $3, $4)`,
    [organizationId, contact.id, eventName, JSON.stringify(data || {})]
  );
  
  res.json({ 
    success: true, 
    contactId: contact.id,
    flowTriggered: !!flow,
    flowName: flow?.name
  });
}));

// Get webhook URL for organization
router.get('/url', authenticate, asyncHandler(async (req, res) => {
  const baseUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 3001}`;
  const webhookUrl = `${baseUrl}/api/webhooks/external/${req.organizationId}`;
  
  res.json({
    webhookUrl,
    instructions: {
      method: 'POST',
      contentType: 'application/json',
      requiredFields: ['eventName', 'phone or email'],
      optionalFields: ['data', 'flowId'],
      example: {
        phone: '+5511999999999',
        eventName: 'abandoned_cart',
        data: {
          cartValue: 99.99,
          items: ['product1', 'product2']
        },
        flowId: 1
      }
    }
  });
}));

// Get dashboard stats
router.get('/stats', authenticate, asyncHandler(async (req, res) => {
  const contactsResult = await query(
    'SELECT COUNT(*) as count FROM contacts WHERE organization_id = $1',
    [req.organizationId]
  );
  
  const messagesResult = await query(
    `SELECT COUNT(*) as count FROM messages m
     JOIN contacts c ON m.contact_id = c.id
     WHERE c.organization_id = $1`,
    [req.organizationId]
  );
  
  const conversationsResult = await query(
    `SELECT COUNT(DISTINCT contact_id) as count FROM messages m
     JOIN contacts c ON m.contact_id = c.id
     WHERE c.organization_id = $1`,
    [req.organizationId]
  );
  
  const sessionsResult = await query(
    `SELECT 
       COUNT(*) FILTER (WHERE status = 'pending') as pending_chats,
       COUNT(*) FILTER (WHERE status = 'active') as active_chats,
       COUNT(*) FILTER (WHERE status = 'resolved') as resolved_chats
     FROM live_chat_sessions lcs
     JOIN contacts c ON lcs.contact_id = c.id
     WHERE c.organization_id = $1`,
    [req.organizationId]
  );
  
  const flowsResult = await query(
    'SELECT COUNT(*) as count FROM flows WHERE organization_id = $1 AND is_active = true',
    [req.organizationId]
  );
  
  const channelsResult = await query(
    "SELECT COUNT(*) as count FROM channels WHERE organization_id = $1 AND status = 'connected'",
    [req.organizationId]
  );
  
  res.json({
    totalContacts: parseInt(contactsResult.rows[0].count),
    totalMessages: parseInt(messagesResult.rows[0].count),
    totalConversations: parseInt(conversationsResult.rows[0].count),
    pendingChats: parseInt(sessionsResult.rows[0]?.pending_chats || 0),
    activeChats: parseInt(sessionsResult.rows[0]?.active_chats || 0),
    resolvedChats: parseInt(sessionsResult.rows[0]?.resolved_chats || 0),
    activeFlows: parseInt(flowsResult.rows[0].count),
    connectedChannels: parseInt(channelsResult.rows[0].count)
  });
}));

// Get recent events
router.get('/events', authenticate, asyncHandler(async (req, res) => {
  const { limit = 50, eventName } = req.query;
  
  let whereClause = 'WHERE organization_id = $1';
  const params = [req.organizationId];
  
  if (eventName) {
    whereClause += ' AND event_name = $2';
    params.push(eventName);
  }
  
  const result = await query(
    `SELECT el.*, c.name as contact_name, c.phone
     FROM event_logs el
     LEFT JOIN contacts c ON el.contact_id = c.id
     ${whereClause}
     ORDER BY el.created_at DESC
     LIMIT $${params.length + 1}`,
    [...params, limit]
  );
  
  res.json(result.rows);
}));

// Get event names (for filtering)
router.get('/events/names', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT DISTINCT event_name, COUNT(*) as count
     FROM event_logs
     WHERE organization_id = $1
     GROUP BY event_name
     ORDER BY count DESC`,
    [req.organizationId]
  );
  
  res.json(result.rows);
}));

export default router;