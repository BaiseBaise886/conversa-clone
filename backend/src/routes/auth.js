import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';
import { config } from '../config/index.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logger } from '../middleware/errorHandler.js';

const router = express.Router();

// Register new user
router.post('/register', authLimiter, asyncHandler(async (req, res) => {
  const { email, password, name, organizationName } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  
  // Validate password strength
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  
  // Check if user exists
  const existingUser = await query('SELECT * FROM users WHERE email = $1', [email]);
  if (existingUser.rows.length > 0) {
    return res.status(400).json({ error: 'User already exists' });
  }
  
  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);
  
  // Create organization
  const orgResult = await query(
    'INSERT INTO organizations (name, plan) VALUES ($1, $2) RETURNING *',
    [organizationName || `${name}'s Organization`, 'starter']
  );
  const organization = orgResult.rows[0];
  
  // Create user
  const userResult = await query(
    'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name',
    [email, passwordHash, name]
  );
  const user = userResult.rows[0];
  
  // Link user to organization
  await query(
    'INSERT INTO user_organizations (user_id, organization_id, role) VALUES ($1, $2, $3)',
    [user.id, organization.id, 'admin']
  );
  
  // Generate JWT
  const token = jwt.sign(
    { userId: user.id, organizationId: organization.id },
    config.jwt.secret,
    { expiresIn: config.jwt.expire }
  );
  
  logger.info(`New user registered: ${email}`);
  
  res.status(201).json({
    token,
    user: { 
      id: user.id, 
      email: user.email, 
      name: user.name, 
      role: 'admin' 
    },
    organization: { 
      id: organization.id, 
      name: organization.name,
      plan: organization.plan
    }
  });
}));

// Login
router.post('/login', authLimiter, asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  
  // Get user with organization
  const result = await query(
    `SELECT u.*, uo.organization_id, uo.role, o.name as org_name, o.plan
     FROM users u
     JOIN user_organizations uo ON u.id = uo.user_id
     JOIN organizations o ON uo.organization_id = o.id
     WHERE u.email = $1`,
    [email]
  );
  
  if (result.rows.length === 0) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const user = result.rows[0];
  
  // Verify password
  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  // Generate JWT
  const token = jwt.sign(
    { userId: user.id, organizationId: user.organization_id },
    config.jwt.secret,
    { expiresIn: config.jwt.expire }
  );
  
  logger.info(`User logged in: ${email}`);
  
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    },
    organization: {
      id: user.organization_id,
      name: user.org_name,
      plan: user.plan
    }
  });
}));

// Get current user
router.get('/me', asyncHandler(async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    
    const result = await query(
      `SELECT u.id, u.email, u.name, uo.role, o.id as org_id, o.name as org_name, o.plan
       FROM users u
       JOIN user_organizations uo ON u.id = uo.user_id
       JOIN organizations o ON uo.organization_id = o.id
       WHERE u.id = $1`,
      [decoded.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = result.rows[0];
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      organization: {
        id: user.org_id,
        name: user.org_name,
        plan: user.plan
      }
    });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}));

// Change password
router.post('/change-password', asyncHandler(async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const { currentPassword, newPassword } = req.body;
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password required' });
  }
  
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }
  
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    
    // Get user
    const userResult = await query(
      'SELECT * FROM users WHERE id = $1',
      [decoded.userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);
    
    // Update password
    await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, decoded.userId]
    );
    
    logger.info(`Password changed for user: ${user.email}`);
    
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}));

export default router;