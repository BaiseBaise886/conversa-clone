import express from 'express';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// Get all flows
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    'SELECT * FROM flows WHERE organization_id = $1 ORDER BY created_at DESC',
    [req.organizationId]
  );
  
  res.json(result.rows);
}));

// Get single flow
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    'SELECT * FROM flows WHERE id = $1 AND organization_id = $2',
    [req.params.id, req.organizationId]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Flow not found' });
  }
  
  res.json(result.rows[0]);
}));

// Create flow
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const { name, description, keyword_triggers, flow_definition, is_active } = req.body;
  
  if (!name || !flow_definition) {
    return res.status(400).json({ error: 'Name and flow_definition required' });
  }
  
  // Validate flow_definition has required structure
  if (!flow_definition.nodes || !Array.isArray(flow_definition.nodes)) {
    return res.status(400).json({ error: 'flow_definition must have nodes array' });
  }
  
  const result = await query(
    `INSERT INTO flows (organization_id, name, description, keyword_triggers, flow_definition, is_active)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [
      req.organizationId, 
      name, 
      description, 
      keyword_triggers || [], 
      flow_definition, 
      is_active !== false
    ]
  );
  
  res.status(201).json(result.rows[0]);
}));

// Update flow
router.put('/:id', authenticate, asyncHandler(async (req, res) => {
  const { name, description, keyword_triggers, flow_definition, is_active } = req.body;
  
  const result = await query(
    `UPDATE flows 
     SET name = COALESCE($1, name),
         description = COALESCE($2, description),
         keyword_triggers = COALESCE($3, keyword_triggers),
         flow_definition = COALESCE($4, flow_definition),
         is_active = COALESCE($5, is_active),
         updated_at = NOW()
     WHERE id = $6 AND organization_id = $7
     RETURNING *`,
    [name, description, keyword_triggers, flow_definition, is_active, req.params.id, req.organizationId]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Flow not found' });
  }
  
  res.json(result.rows[0]);
}));

// Delete flow
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    'DELETE FROM flows WHERE id = $1 AND organization_id = $2 RETURNING id',
    [req.params.id, req.organizationId]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Flow not found' });
  }
  
  res.json({ success: true, id: result.rows[0].id });
}));

// Toggle flow active status
router.patch('/:id/toggle', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    `UPDATE flows 
     SET is_active = NOT is_active, updated_at = NOW()
     WHERE id = $1 AND organization_id = $2
     RETURNING *`,
    [req.params.id, req.organizationId]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Flow not found' });
  }
  
  res.json(result.rows[0]);
}));

// Duplicate flow
router.post('/:id/duplicate', authenticate, asyncHandler(async (req, res) => {
  const originalFlow = await query(
    'SELECT * FROM flows WHERE id = $1 AND organization_id = $2',
    [req.params.id, req.organizationId]
  );
  
  if (originalFlow.rows.length === 0) {
    return res.status(404).json({ error: 'Flow not found' });
  }
  
  const flow = originalFlow.rows[0];
  
  const result = await query(
    `INSERT INTO flows (organization_id, name, description, keyword_triggers, flow_definition, is_active)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [
      req.organizationId,
      `${flow.name} (Copy)`,
      flow.description,
      flow.keyword_triggers,
      flow.flow_definition,
      false // Duplicates start inactive
    ]
  );
  
  res.status(201).json(result.rows[0]);
}));

export default router;