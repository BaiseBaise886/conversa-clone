import express from 'express';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// Get all contacts
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, search = '' } = req.query;
  const offset = (page - 1) * limit;
  
  let whereClause = 'WHERE organization_id = $1';
  const params = [req.organizationId];
  
  if (search) {
    whereClause += ' AND (name ILIKE $2 OR phone ILIKE $2 OR email ILIKE $2)';
    params.push(`%${search}%`);
  }
  
  const result = await query(
    `SELECT * FROM contacts 
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  
  res.json(result.rows);
}));

// Get single contact
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    'SELECT * FROM contacts WHERE id = $1 AND organization_id = $2',
    [req.params.id, req.organizationId]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Contact not found' });
  }
  
  res.json(result.rows[0]);
}));

// Create contact
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const { name, phone, email, instagram_username, channel_type, tags, custom_fields } = req.body;
  
  if (!phone && !email && !instagram_username) {
    return res.status(400).json({ error: 'At least one contact method required (phone, email, or instagram)' });
  }
  
  const result = await query(
    `INSERT INTO contacts (organization_id, name, phone, email, instagram_username, channel_type, tags, custom_fields)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      req.organizationId, 
      name, 
      phone, 
      email, 
      instagram_username, 
      channel_type || 'whatsapp', 
      tags || [], 
      custom_fields || {}
    ]
  );
  
  res.status(201).json(result.rows[0]);
}));

// Update contact
router.put('/:id', authenticate, asyncHandler(async (req, res) => {
  const { name, phone, email, instagram_username, channel_type, tags, custom_fields } = req.body;
  
  const result = await query(
    `UPDATE contacts 
     SET name = COALESCE($1, name),
         phone = COALESCE($2, phone),
         email = COALESCE($3, email),
         instagram_username = COALESCE($4, instagram_username),
         channel_type = COALESCE($5, channel_type),
         tags = COALESCE($6, tags),
         custom_fields = COALESCE($7, custom_fields),
         updated_at = NOW()
     WHERE id = $8 AND organization_id = $9
     RETURNING *`,
    [name, phone, email, instagram_username, channel_type, tags, custom_fields, req.params.id, req.organizationId]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Contact not found' });
  }
  
  res.json(result.rows[0]);
}));

// Delete contact
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    'DELETE FROM contacts WHERE id = $1 AND organization_id = $2 RETURNING id',
    [req.params.id, req.organizationId]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Contact not found' });
  }
  
  res.json({ success: true, id: result.rows[0].id });
}));

// Bulk import contacts
router.post('/bulk-import', authenticate, asyncHandler(async (req, res) => {
  const { contacts } = req.body;
  
  if (!Array.isArray(contacts) || contacts.length === 0) {
    return res.status(400).json({ error: 'Contacts array required' });
  }
  
  const imported = [];
  const errors = [];
  
  for (const contact of contacts) {
    try {
      const result = await query(
        `INSERT INTO contacts (organization_id, name, phone, email, channel_type, tags, custom_fields)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          req.organizationId,
          contact.name,
          contact.phone,
          contact.email,
          contact.channel_type || 'whatsapp',
          contact.tags || [],
          contact.custom_fields || {}
        ]
      );
      imported.push(result.rows[0]);
    } catch (error) {
      errors.push({ contact, error: error.message });
    }
  }
  
  res.json({
    success: true,
    imported: imported.length,
    errors: errors.length,
    data: imported,
    errorDetails: errors
  });
}));

export default router;