import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';

/**
 * General API rate limiter
 * 100 requests per 15 minutes per IP
 */
export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    error: 'Too many requests',
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil(config.rateLimit.windowMs / 1000 / 60) + ' minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Store in memory (for production, use Redis)
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      message: 'You have exceeded the rate limit. Please try again later.',
      retryAfter: res.getHeader('RateLimit-Reset')
    });
  }
});

/**
 * Strict rate limiter for authentication endpoints
 * 5 requests per 15 minutes per IP
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  skipSuccessfulRequests: false,
  message: {
    error: 'Too many authentication attempts',
    message: 'Too many login attempts from this IP, please try again after 15 minutes.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many authentication attempts',
      message: 'Account temporarily locked due to multiple failed login attempts. Please try again in 15 minutes.',
      retryAfter: res.getHeader('RateLimit-Reset')
    });
  }
});

/**
 * Moderate rate limiter for message sending
 * 50 requests per minute per user
 */
export const messageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50,
  skipSuccessfulRequests: false,
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise IP
    return req.user?.id?.toString() || req.ip;
  },
  message: {
    error: 'Message rate limit exceeded',
    message: 'Too many messages sent. Please slow down.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * File upload rate limiter
 * 20 uploads per hour per user
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  skipSuccessfulRequests: false,
  keyGenerator: (req) => {
    return req.user?.id?.toString() || req.ip;
  },
  message: {
    error: 'Upload limit exceeded',
    message: 'Too many file uploads. Please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Webhook rate limiter
 * 100 requests per minute per organization
 */
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  skipSuccessfulRequests: false,
  keyGenerator: (req) => {
    // Use organization ID from URL params
    return req.params.organizationId || req.ip;
  },
  message: {
    error: 'Webhook rate limit exceeded',
    message: 'Too many webhook requests. Please slow down.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * AI generation rate limiter
 * 10 requests per hour per user (AI is expensive)
 */
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  skipSuccessfulRequests: false,
  keyGenerator: (req) => {
    return req.user?.id?.toString() || req.ip;
  },
  message: {
    error: 'AI generation limit exceeded',
    message: 'Too many AI generation requests. Please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'AI generation limit exceeded',
      message: 'You have reached the hourly limit for AI-powered features. This limit helps us manage costs. Please try again in an hour.',
      retryAfter: res.getHeader('RateLimit-Reset'),
      tip: 'Consider upgrading your plan for higher AI limits.'
    });
  }
});

/**
 * Dynamic rate limiter based on user plan
 */
export const planBasedLimiter = (limits) => {
  return rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: async (req) => {
      const plan = req.organization?.plan || 'starter';
      return limits[plan] || limits.starter;
    },
    skipSuccessfulRequests: false,
    keyGenerator: (req) => {
      return req.organizationId?.toString() || req.ip;
    },
    message: (req) => {
      const plan = req.organization?.plan || 'starter';
      return {
        error: 'Plan limit exceeded',
        message: `You have reached the ${plan} plan limit for this feature.`,
        tip: 'Upgrade your plan for higher limits.',
        currentPlan: plan
      };
    },
    standardHeaders: true,
    legacyHeaders: false
  });
};

/**
 * Create custom rate limiter
 */
export const createRateLimiter = (options) => {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000,
    max: options.max || 100,
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    keyGenerator: options.keyGenerator || ((req) => req.ip),
    message: options.message || {
      error: 'Rate limit exceeded',
      message: 'Too many requests, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: options.handler || ((req, res) => {
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many requests, please try again later.',
        retryAfter: res.getHeader('RateLimit-Reset')
      });
    })
  });
};

export default {
  apiLimiter,
  authLimiter,
  messageLimiter,
  uploadLimiter,
  webhookLimiter,
  aiLimiter,
  planBasedLimiter,
  createRateLimiter
};