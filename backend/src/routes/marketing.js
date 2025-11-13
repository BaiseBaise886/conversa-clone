import express from 'express';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// Get all products in marketing brain
router.get('/products', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    'SELECT * FROM marketing_brain WHERE organization_id = $1 ORDER BY created_at DESC',
    [req.organizationId]
  );
  
  res.json(result.rows);
}));

// Get single product
router.get('/products/:id', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    'SELECT * FROM marketing_brain WHERE id = $1 AND organization_id = $2',
    [req.params.id, req.organizationId]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Product not found' });
  }
  
  res.json(result.rows[0]);
}));

// Add product to marketing brain
router.post('/products', authenticate, asyncHandler(async (req, res) => {
  const {
    product_name,
    product_description,
    price,
    target_audience,
    marketing_angles,
    pain_points,
    benefits,
    objections,
    competitors,
    unique_selling_points,
    tone_of_voice
  } = req.body;
  
  if (!product_name) {
    return res.status(400).json({ error: 'product_name required' });
  }
  
  const result = await query(
    `INSERT INTO marketing_brain (
      organization_id, product_name, product_description, price, target_audience,
      marketing_angles, pain_points, benefits, objections, competitors,
      unique_selling_points, tone_of_voice
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *`,
    [
      req.organizationId,
      product_name,
      product_description,
      price,
      target_audience,
      marketing_angles,
      pain_points,
      benefits,
      objections,
      competitors,
      unique_selling_points,
      tone_of_voice
    ]
  );
  
  res.status(201).json(result.rows[0]);
}));

// Update product
router.put('/products/:id', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  const fields = [];
  const values = [];
  let paramCount = 1;
  
  // Build dynamic UPDATE query
  Object.keys(updates).forEach(key => {
    if (key !== 'id' && key !== 'organization_id') {
      fields.push(`${key} = $${paramCount}`);
      values.push(updates[key]);
      paramCount++;
    }
  });
  
  if (fields.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  
  fields.push(`updated_at = NOW()`);
  values.push(id, req.organizationId);
  
  const result = await query(
    `UPDATE marketing_brain 
     SET ${fields.join(', ')}
     WHERE id = $${paramCount} AND organization_id = $${paramCount + 1}
     RETURNING *`,
    values
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Product not found' });
  }
  
  res.json(result.rows[0]);
}));

// Delete product
router.delete('/products/:id', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    'DELETE FROM marketing_brain WHERE id = $1 AND organization_id = $2 RETURNING id',
    [req.params.id, req.organizationId]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Product not found' });
  }
  
  res.json({ success: true, id: result.rows[0].id });
}));

// Get funnel analytics
router.get('/funnel-analytics/:flowId', authenticate, asyncHandler(async (req, res) => {
  const { flowId } = req.params;
  
  const result = await query(
    `SELECT 
       stage,
       COUNT(*) as contacts,
       COUNT(*) FILTER (WHERE converted = true) as conversions,
       ROUND(AVG(EXTRACT(EPOCH FROM (exited_at - entered_at))/3600)::numeric, 2) as avg_hours,
       SUM(revenue) as total_revenue,
       ROUND(AVG(revenue)::numeric, 2) as avg_revenue
     FROM funnel_analytics 
     WHERE flow_id = $1 AND organization_id = $2
     GROUP BY stage
     ORDER BY 
       CASE stage
         WHEN 'awareness' THEN 1
         WHEN 'interest' THEN 2
         WHEN 'decision' THEN 3
         WHEN 'action' THEN 4
         ELSE 5
       END`,
    [flowId, req.organizationId]
  );
  
  res.json(result.rows);
}));

// Get flow templates
router.get('/templates', authenticate, asyncHandler(async (req, res) => {
  const { category } = req.query;
  
  let sql = 'SELECT * FROM flow_templates WHERE organization_id = $1';
  const params = [req.organizationId];
  
  if (category) {
    sql += ' AND category = $2';
    params.push(category);
  }
  
  sql += ' ORDER BY usage_count DESC, created_at DESC';
  
  const result = await query(sql, params);
  res.json(result.rows);
}));

// Use template (increment usage count)
router.post('/templates/:id/use', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    `UPDATE flow_templates 
     SET usage_count = usage_count + 1
     WHERE id = $1 AND organization_id = $2
     RETURNING *`,
    [req.params.id, req.organizationId]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Template not found' });
  }
  
  res.json(result.rows[0]);
}));

// Get contact tags
router.get('/tags/:contactId', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT ct.* FROM contact_tags ct
     JOIN contacts c ON ct.contact_id = c.id
     WHERE ct.contact_id = $1 AND c.organization_id = $2
     ORDER BY ct.created_at DESC`,
    [req.params.contactId, req.organizationId]
  );
  
  res.json(result.rows);
}));

// Add tag to contact
router.post('/tags/:contactId', authenticate, asyncHandler(async (req, res) => {
  const { contactId } = req.params;
  const { tag_name, tag_value } = req.body;
  
  if (!tag_name) {
    return res.status(400).json({ error: 'tag_name required' });
  }
  
  // Verify contact belongs to organization
  const contactCheck = await query(
    'SELECT id FROM contacts WHERE id = $1 AND organization_id = $2',
    [contactId, req.organizationId]
  );
  
  if (contactCheck.rows.length === 0) {
    return res.status(404).json({ error: 'Contact not found' });
  }
  
  const result = await query(
    `INSERT INTO contact_tags (contact_id, tag_name, tag_value, auto_generated)
     VALUES ($1, $2, $3, false)
     ON CONFLICT (contact_id, tag_name) 
     DO UPDATE SET tag_value = $3, created_at = NOW()
     RETURNING *`,
    [contactId, tag_name, tag_value]
  );
  
  res.json(result.rows[0]);
}));

// Remove tag
router.delete('/tags/:contactId/:tagName', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    `DELETE FROM contact_tags ct
     USING contacts c
     WHERE ct.contact_id = c.id
     AND ct.contact_id = $1 
     AND ct.tag_name = $2
     AND c.organization_id = $3
     RETURNING ct.id`,
    [req.params.contactId, req.params.tagName, req.organizationId]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Tag not found' });
  }
  
  res.json({ success: true });
}));

// Get all tags used in organization
router.get('/tags-list', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT tag_name, COUNT(*) as usage_count
     FROM contact_tags ct
     JOIN contacts c ON ct.contact_id = c.id
     WHERE c.organization_id = $1
     GROUP BY tag_name
     ORDER BY usage_count DESC`,
    [req.organizationId]
  );
  
  res.json(result.rows);
}));

export default router;