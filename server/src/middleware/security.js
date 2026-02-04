/**
 * Security middleware for Express server
 * Implements multiple layers of protection:
 * - Helmet for security headers
 * - Rate limiting for DDoS protection
 * - Request sanitization for NoSQL injection
 * - HPP for parameter pollution
 * - CORS for cross-origin requests
 */

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import logger from '../utils/logger.js';

// Rate limiting middleware - protect against brute force and DoS attacks
export const createLimiters = () => {
  // General API limiter
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true, // Return rate limit info in RateLimit-* headers
    legacyHeaders: false, // Disable X-RateLimit-* headers
    skip: (req) => {
      // Skip logging for health checks
      return req.path === '/health';
    },
    handler: (req, res) => {
      logger.security('Rate limit exceeded for IP:', req.ip);
      res.status(429).json({
        message: 'Too many requests, please try again later.'
      });
    }
  });

  // Strict limiter for authentication endpoints (prevent brute force)
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per windowMs
    message: 'Too many login attempts, please try again later.',
    skip: (req) => {
      // Skip on successful requests
      return req.res?.statusCode === 200;
    },
    handler: (req, res) => {
      logger.security('Auth rate limit exceeded for user:', req.body?.email);
      res.status(429).json({
        message: 'Too many login attempts. Please try again later.'
      });
    }
  });

  // Limiter for sign-up endpoint
  const signupLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 registrations per hour per IP
    message: 'Too many accounts created from this IP, please try again later.',
    handler: (req, res) => {
      logger.security('Signup rate limit exceeded for IP:', req.ip);
      res.status(429).json({
        message: 'Too many signup attempts. Please try again later.'
      });
    }
  });

  return {
    apiLimiter,
    authLimiter,
    signupLimiter
  };
};

// Apply security headers with Helmet
export const securityHeaders = () => {
  return helmet({
    // Prevent MIME type sniffing
    noSniff: true,
    // Enable XSS filtering
    xssFilter: true,
    // Prevent clickjacking
    frameguard: {
      action: 'deny'
    },
    // Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
      useDefaults: true,
    },
    // Enforce HTTPS
    hsts: {
      maxAge: 31536000, // 1 year in seconds
      includeSubDomains: true,
      preload: true
    },
    // Prevent referrer information leakage
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin'
    }
  });
};

// Data sanitization middleware
export const dataSanitization = () => {
  return [
    // Sanitize against NoSQL injection
    mongoSanitize({
      replaceWith: '_',
      onSanitize: ({ req, key }) => {
        logger.security('NoSQL injection attempt detected on field:', key);
      }
    }),
    // Sanitize against parameter pollution
    hpp({
      whitelist: ['sort', 'page', 'limit', 'fields', 'search']
    })
  ];
};

// Request validation middleware
export const validateRequest = (req, res, next) => {
  // Prevent large payloads
  if (req.headers['content-length'] && parseInt(req.headers['content-length']) > 10 * 1024 * 1024) {
    logger.security('Payload too large from IP:', req.ip);
    return res.status(413).json({ message: 'Payload too large' });
  }

  // Validate content type for POST/PUT requests
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.headers['content-type'];
    if (!contentType || (!contentType.includes('application/json') && !contentType.includes('multipart/form-data'))) {
      return res.status(415).json({ message: 'Unsupported Media Type' });
    }
  }

  next();
};

// Error handling middleware that doesn't expose sensitive info
export const errorHandler = (err, req, res, next) => {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const requestId = req.requestId || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const errorLog = {
    requestId,
    timestamp: new Date().toISOString(),
    message: err.message,
    status: err.status || 500,
    path: req.path,
    method: req.method,
    userId: req.userId || 'anonymous',
    ip: req.ip
  };

  if (isDevelopment) {
    errorLog.stack = err.stack;
    errorLog.details = err;
  }

  logger.error('[API ERROR HANDLER]', JSON.stringify(errorLog, null, 2));

  // Default error object
  let error = {
    message: 'Internal server error',
    status: err.status || 500
  };

  // Only expose detailed error info in development
  if (isDevelopment) {
    error = {
      message: err.message || 'Internal server error',
      status: err.status || 500,
      stack: err.stack
    };
  } else {
    // In production, only expose safe information
    if (err.status === 400) {
      error.message = err.message || 'Bad request';
    } else if (err.status === 401) {
      error.message = 'Unauthorized';
    } else if (err.status === 403) {
      error.message = 'Forbidden';
    } else if (err.status === 404) {
      error.message = 'Not found';
    }
  }

  res.status(error.status || 500).json(error);
};

// Enhanced request logging middleware with payload and response logging
export const requestLogger = (req, res, next) => {
  const start = Date.now();
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Extract sensitive fields to redact
  const sensitiveFields = ['password', 'token', 'authorization', 'secret', 'api_key', 'apiKey', 'refresh_token'];
  
  const redactSensitiveData = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    
    const redacted = JSON.parse(JSON.stringify(obj));
    const walk = (o) => {
      for (const key in o) {
        if (sensitiveFields.some(field => field.toLowerCase() === key.toLowerCase())) {
          o[key] = '***REDACTED***';
        } else if (typeof o[key] === 'object' && o[key] !== null) {
          walk(o[key]);
        }
      }
    };
    walk(redacted);
    return redacted;
  };

  // Log incoming request
  const logRequest = () => {
    const requestData = {
      requestId,
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      query: req.query,
      userId: req.userId || 'anonymous',
      ip: req.ip,
      userAgent: req.headers['user-agent']
    };

    // Log body for non-GET requests
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      requestData.payload = redactSensitiveData(req.body);
    }

    logger.log('[API REQUEST]', JSON.stringify(requestData, null, 2));
  };

  // Intercept response data
  const originalJson = res.json;
  let responseData = null;

  res.json = function(data) {
    responseData = data;
    return originalJson.call(this, data);
  };

  logRequest();

  // Log response and errors when sent
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    const responseLog = {
      requestId,
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.userId || 'anonymous',
      ip: req.ip
    };

    // Log response data (redacted)
    if (responseData) {
      responseLog.response = redactSensitiveData(responseData);
    }

    // Log errors
    if (res.statusCode >= 400) {
      logger.error('[API ERROR]', JSON.stringify(responseLog, null, 2));
    } else {
      logger.log('[API RESPONSE]', JSON.stringify(responseLog, null, 2));
    }
  });

  // Log any errors thrown during request processing
  const originalSend = res.send;
  res.send = function(data) {
    if (res.statusCode >= 400 && data) {
      const errorLog = {
        requestId,
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        error: typeof data === 'string' ? data : redactSensitiveData(data),
        userId: req.userId || 'anonymous',
        ip: req.ip
      };
      logger.error('[API ERROR]', JSON.stringify(errorLog, null, 2));
    }
    return originalSend.call(this, data);
  };

  next();
};

export default {
  createLimiters,
  securityHeaders,
  dataSanitization,
  validateRequest,
  errorHandler,
  requestLogger
};
