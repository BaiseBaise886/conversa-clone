import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { query } from '../config/database.js';
import { logger } from './errorHandler.js';

/**
 * Authentication middleware
 * Verifies JWT token and attaches user/organization info to request
 */
export const authenticate = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Please provide a valid Bearer token in the Authorization header'
      });
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          error: 'Token expired',
          message: 'Your session has expired. Please login again.'
        });
      }
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'The provided token is invalid or malformed.'
      });
    }
    
    // Get user and organization from database
    const result = await query(
      `SELECT 
        u.id, 
        u.email, 
        u.name,
        uo.organization_id,
        uo.role,
        o.name as organization_name,
        o.plan
       FROM users u
       JOIN user_organizations uo ON u.id = uo.user_id
       JOIN organizations o ON uo.organization_id = o.id
       WHERE u.id = $1`,
      [decoded.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ 
        error: 'User not found',
        message: 'The authenticated user no longer exists.'
      });
    }
    
    const userData = result.rows[0];
    
    // Attach to request object
    req.user = {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      role: userData.role
    };
    
    req.organizationId = userData.organization_id;
    req.organization = {
      id: userData.organization_id,
      name: userData.organization_name,
      plan: userData.plan
    };
    
    next();
    
  } catch (error) {
    logger.error('Authentication middleware error:', error);
    return res.status(500).json({ 
      error: 'Authentication error',
      message: 'An error occurred while authenticating your request.'
    });
  }
};

/**
 * Role-based authorization middleware
 * Checks if user has required role
 */
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Not authenticated',
        message: 'You must be logged in to access this resource.'
      });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: `Access denied. Required role: ${allowedRoles.join(' or ')}`
      });
    }
    
    next();
  };
};

/**
 * Optional authentication middleware
 * Attaches user info if token is present, but doesn't fail if missing
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      
      const result = await query(
        `SELECT 
          u.id, 
          u.email, 
          u.name,
          uo.organization_id,
          uo.role
         FROM users u
         JOIN user_organizations uo ON u.id = uo.user_id
         WHERE u.id = $1`,
        [decoded.userId]
      );
      
      if (result.rows.length > 0) {
        const userData = result.rows[0];
        req.user = {
          id: userData.id,
          email: userData.email,
          name: userData.name,
          role: userData.role
        };
        req.organizationId = userData.organization_id;
      }
    } catch (error) {
      // Token invalid or expired, but we don't fail
      logger.warn('Optional auth token invalid:', error.message);
    }
    
    next();
    
  } catch (error) {
    logger.error('Optional auth middleware error:', error);
    next();
  }
};

/**
 * API Key authentication (for webhooks and integrations)
 */
export const authenticateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
      return res.status(401).json({ 
        error: 'API key required',
        message: 'Please provide an API key in the X-API-Key header'
      });
    }
    
    // Validate API key
    const result = await query(
      `SELECT 
        ak.organization_id,
        o.name as organization_name,
        ak.permissions
       FROM api_keys ak
       JOIN organizations o ON ak.organization_id = o.id
       WHERE ak.key = $1 AND ak.is_active = true`,
      [apiKey]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ 
        error: 'Invalid API key',
        message: 'The provided API key is invalid or has been revoked.'
      });
    }
    
    const keyData = result.rows[0];
    
    req.organizationId = keyData.organization_id;
    req.organization = {
      id: keyData.organization_id,
      name: keyData.organization_name
    };
    req.apiKeyPermissions = keyData.permissions || [];
    
    next();
    
  } catch (error) {
    logger.error('API key authentication error:', error);
    return res.status(500).json({ 
      error: 'Authentication error',
      message: 'An error occurred while validating your API key.'
    });
  }
};

/**
 * Check if user has permission for specific action
 */
export const checkPermission = (permission) => {
  return (req, res, next) => {
    // Admin users have all permissions
    if (req.user && req.user.role === 'admin') {
      return next();
    }
    
    // Check API key permissions
    if (req.apiKeyPermissions && req.apiKeyPermissions.includes(permission)) {
      return next();
    }
    
    // Check user role permissions
    const rolePermissions = {
      owner: ['*'], // All permissions
      admin: ['flows', 'contacts', 'messages', 'channels', 'analytics', 'settings'],
      agent: ['contacts', 'messages', 'live_chat'],
      viewer: ['analytics']
    };
    
    const userPermissions = rolePermissions[req.user?.role] || [];
    
    if (userPermissions.includes('*') || userPermissions.includes(permission)) {
      return next();
    }
    
    return res.status(403).json({ 
      error: 'Permission denied',
      message: `You don't have permission to: ${permission}`
    });
  };
};

/**
 * Verify organization ownership/membership
 */
export const verifyOrganization = async (req, res, next) => {
  try {
    const organizationId = req.params.organizationId || req.body.organizationId;
    
    if (!organizationId) {
      return next(); // No organization to verify
    }
    
    if (parseInt(organizationId) !== req.organizationId) {
      return res.status(403).json({ 
        error: 'Organization access denied',
        message: 'You do not have access to this organization.'
      });
    }
    
    next();
    
  } catch (error) {
    logger.error('Organization verification error:', error);
    return res.status(500).json({ 
      error: 'Verification error',
      message: 'An error occurred while verifying organization access.'
    });
  }
};

export default {
  authenticate,
  authorize,
  optionalAuth,
  authenticateApiKey,
  checkPermission,
  verifyOrganization
};