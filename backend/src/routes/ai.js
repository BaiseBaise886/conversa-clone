import express from 'express';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import geminiService from '../services/gemini.service.js';

const router = express.Router();

// Generate flow from natural language
router.post('/generate-flow', authenticate, asyncHandler(async (req, res) => {
  const { prompt } = req.body;
  
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt required' });
  }
  
  const flowData = await geminiService.generateFlowFromPrompt(prompt, req.organizationId);
  
  // Optionally save as template
  await query(
    `INSERT INTO flow_templates (organization_id, name, description, category, flow_definition, is_ai_generated, generation_prompt)
     VALUES ($1, $2, $3, $4, $5, true, $6) RETURNING *`,
    [
      req.organizationId, 
      flowData.name, 
      flowData.description, 
      flowData.category, 
      flowData, 
      prompt
    ]
  );
  
  res.json(flowData);
}));

// Get AI support response
router.post('/support-response', authenticate, asyncHandler(async (req, res) => {
  const { contactId, message } = req.body;
  
  if (!contactId || !message) {
    return res.status(400).json({ error: 'contactId and message required' });
  }
  
  // Get conversation history
  const historyResult = await query(
    `SELECT * FROM ai_conversations 
     WHERE contact_id = $1 
     ORDER BY created_at DESC 
     LIMIT 20`,
    [contactId]
  );
  
  const response = await geminiService.generateSupportResponse(
    contactId,
    message,
    historyResult.rows.reverse()
  );
  
  res.json(response);
}));

// Analyze message sentiment
router.post('/analyze', authenticate, asyncHandler(async (req, res) => {
  const { message } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message required' });
  }
  
  const analysis = await geminiService.analyzeMessage(message);
  res.json(analysis);
}));

// Auto-tag contact
router.post('/auto-tag/:contactId', authenticate, asyncHandler(async (req, res) => {
  const { contactId } = req.params;
  
  // Calculate behavior metrics
  const metricsResult = await query(
    `SELECT 
       COUNT(*) as message_count,
       COUNT(*) FILTER (WHERE type = 'inbound') as response_count,
       EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at)))/60 as time_spent
     FROM messages 
     WHERE contact_id = $1`,
    [contactId]
  );
  
  const metrics = metricsResult.rows[0];
  const responseRate = metrics.message_count > 0 
    ? (metrics.response_count / metrics.message_count * 100) 
    : 0;
  
  const tags = await geminiService.autoTagContact(parseInt(contactId), {
    messages: parseInt(metrics.message_count),
    responses: Math.round(responseRate),
    timeSpent: Math.round(metrics.time_spent || 0),
    clickedLinks: 0 // TODO: Track this
  });
  
  res.json({ tags });
}));

// Optimize message
router.post('/optimize-message', authenticate, asyncHandler(async (req, res) => {
  const { message, context } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message required' });
  }
  
  const optimized = await geminiService.optimizeMessage(message, context);
  res.json({ 
    original: message, 
    optimized,
    improvements: {
      length: message.length - optimized.length,
      spamScore: 'reduced'
    }
  });
}));

// Select marketing angle
router.post('/select-angle', authenticate, asyncHandler(async (req, res) => {
  const { contactId, productId } = req.body;
  
  if (!contactId || !productId) {
    return res.status(400).json({ error: 'contactId and productId required' });
  }
  
  const angle = await geminiService.selectMarketingAngle(
    parseInt(contactId),
    parseInt(productId)
  );
  
  res.json(angle);
}));

// Get AI conversation history
router.get('/conversations/:contactId', authenticate, asyncHandler(async (req, res) => {
  const { contactId } = req.params;
  const { limit = 50 } = req.query;
  
  const result = await query(
    `SELECT ac.* FROM ai_conversations ac
     JOIN contacts c ON ac.contact_id = c.id
     WHERE ac.contact_id = $1 AND c.organization_id = $2
     ORDER BY ac.created_at DESC
     LIMIT $3`,
    [contactId, req.organizationId, limit]
  );
  
  res.json(result.rows.reverse());
}));

// Get AI usage statistics
router.get('/stats', authenticate, asyncHandler(async (req, res) => {
  const flowsGenerated = await query(
    'SELECT COUNT(*) as count FROM flow_templates WHERE organization_id = $1 AND is_ai_generated = true',
    [req.organizationId]
  );
  
  const conversationsHandled = await query(
    `SELECT COUNT(DISTINCT contact_id) as count FROM ai_conversations ac
     JOIN contacts c ON ac.contact_id = c.id
     WHERE c.organization_id = $1`,
    [req.organizationId]
  );
  
  const messagesAnalyzed = await query(
    `SELECT COUNT(*) as count FROM ai_conversations ac
     JOIN contacts c ON ac.contact_id = c.id
     WHERE c.organization_id = $1`,
    [req.organizationId]
  );
  
  const avgSentiment = await query(
    `SELECT sentiment, COUNT(*) as count FROM ai_conversations ac
     JOIN contacts c ON ac.contact_id = c.id
     WHERE c.organization_id = $1 AND sentiment IS NOT NULL
     GROUP BY sentiment`,
    [req.organizationId]
  );
  
  res.json({
    flowsGenerated: parseInt(flowsGenerated.rows[0].count),
    conversationsHandled: parseInt(conversationsHandled.rows[0].count),
    messagesAnalyzed: parseInt(messagesAnalyzed.rows[0].count),
    sentimentBreakdown: avgSentiment.rows
  });
}));

export default router;