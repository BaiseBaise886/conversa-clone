import express from 'express';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import whatsappService from '../services/whatsapp.service.js';

const router = express.Router();

// Get all channels
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    'SELECT id, organization_id, type, name, phone_number, status, created_at, updated_at FROM channels WHERE organization_id = $1',
    [req.organizationId]
  );
  
  res.json(result.rows);
}));

// Get single channel
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    'SELECT id, organization_id, type, name, phone_number, status, created_at, updated_at FROM channels WHERE id = $1 AND organization_id = $2',
    [req.params.id, req.organizationId]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Channel not found' });
  }
  
  res.json(result.rows[0]);
}));

// Create WhatsApp channel
router.post('/whatsapp', authenticate, asyncHandler(async (req, res) => {
  const { name, phone_number } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Channel name required' });
  }
  
  const result = await query(
    `INSERT INTO channels (organization_id, type, name, phone_number, status)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [req.organizationId, 'whatsapp', name, phone_number, 'disconnected']
  );
  
  const channel = result.rows[0];
  
  res.status(201).json(channel);
}));

// Connect WhatsApp channel (initialize)
router.post('/:id/connect', authenticate, asyncHandler(async (req, res) => {
  const channelId = parseInt(req.params.id);
  
  const result = await query(
    'SELECT * FROM channels WHERE id = $1 AND organization_id = $2',
    [channelId, req.organizationId]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Channel not found' });
  }
  
  const channel = result.rows[0];
  
  if (channel.type !== 'whatsapp') {
    return res.status(400).json({ error: 'Only WhatsApp channels supported' });
  }
  
  // Initialize WhatsApp client
  const io = req.app.get('io');
  await whatsappService.initializeChannel(channelId, req.organizationId, io);
  
  res.json({ 
    success: true, 
    message: 'WhatsApp client initializing. Check for QR code.' 
  });
}));

// Disconnect channel
router.post('/:id/disconnect', authenticate, asyncHandler(async (req, res) => {
  const channelId = parseInt(req.params.id);
  
  const result = await query(
    'SELECT * FROM channels WHERE id = $1 AND organization_id = $2',
    [channelId, req.organizationId]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Channel not found' });
  }
  
  await whatsappService.disconnectChannel(channelId);
  
  res.json({ success: true, message: 'Channel disconnected' });
}));

// Get channel QR code
router.get('/:id/qr', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    'SELECT qr_code, status FROM channels WHERE id = $1 AND organization_id = $2',
    [req.params.id, req.organizationId]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Channel not found' });
  }
  
  res.json({ 
    qr_code: result.rows[0].qr_code,
    status: result.rows[0].status
  });
}));

// Delete channel
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  const channelId = parseInt(req.params.id);
  
  // Disconnect first
  try {
    await whatsappService.disconnectChannel(channelId);
  } catch (error) {
    // Continue even if disconnect fails
  }
  
  const result = await query(
    'DELETE FROM channels WHERE id = $1 AND organization_id = $2 RETURNING id',
    [channelId, req.organizationId]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Channel not found' });
  }
  
  res.json({ success: true, id: result.rows[0].id });
}));

// Get channel statistics
router.get('/:id/stats', authenticate, asyncHandler(async (req, res) => {
  const channelId = parseInt(req.params.id);
  
  const result = await query(
    `SELECT 
       COUNT(*) as total_messages,
       SUM(CASE WHEN type = 'inbound' THEN 1 ELSE 0 END) as received,
       SUM(CASE WHEN type LIKE 'outbound%' THEN 1 ELSE 0 END) as sent,
       SUM(CASE WHEN created_at >= NOW() - INTERVAL 24 HOUR THEN 1 ELSE 0 END) as last_24h
     FROM messages
     WHERE channel_id = $1`,
    [channelId]
  );
  
  res.json(result.rows[0]);
}));

export default router;