/**
 * Security middleware for Express server
 * Implements multiple layers of protection:
 * - Helmet for security headers
 * - Rate limiting for brute-force and DoS protection
 * - Request sanitization for NoSQL injection
 * - HPP for parameter pollution
 */

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import logger from '../utils/logger.js';
import config from '../config/env.js';

// Rate limiting middleware - protect against brute force and DoS attacks
export const createLimiters = (overrides = {}) => {
  // Tests and local demos switch limits off (ignored in production).
  const disabled = () => config.rateLimitDisabled && !overrides.force;
  const common = {
    standardHeaders: true, // Return rate limit info in RateLimit-* headers
    legacyHeaders: false, // Disable X-RateLimit-* headers
    // Don't crash or spam the log if the proxy setup is unusual.
    validate: { xForwardedForHeader: false, trustProxy: false },
  };

  // General API limiter. Generous on purpose: several members can share one
  // address (a chapter meeting, a family home) and the app polls for badges.
  const apiLimiter = rateLimit({
    ...common,
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: overrides.apiMax ?? 1500,
    skip: (req) => disabled() || req.path === '/health',
    handler: (req, res) => {
      logger.security('Rate limit exceeded for IP:', req.ip);
      res.status(429).json({
        message: 'You are going a little fast. Please wait a minute and try again.'
      });
    }
  });

  // Sign-in, code and reset attempts: counted per address AND per email, and
  // only failures count, so a busy shared address is not locked out by other
  // people signing in successfully.
  const authLimiter = rateLimit({
    ...common,
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: overrides.authMax ?? 10,
    skipSuccessfulRequests: true,
    skip: () => disabled(),
    keyGenerator: (req) =>
      `${req.ip}|${String(req.body?.email || req.body?.token || '').toLowerCase().slice(0, 100)}`,
    handler: (req, res) => {
      logger.security('Auth rate limit exceeded from IP:', req.ip);
      res.status(429).json({
        message: 'Too many attempts. Please wait 15 minutes and try again.'
      });
    }
  });

  // Anything that makes us send an email.
  const emailLimiter = rateLimit({
    ...common,
    windowMs: 60 * 60 * 1000, // 1 hour
    max: overrides.emailMax ?? 8,
    skip: () => disabled(),
    keyGenerator: (req) =>
      `${req.ip}|${String(req.body?.email || '').toLowerCase().slice(0, 100)}`,
    handler: (req, res) => {
      logger.security('Email rate limit exceeded from IP:', req.ip);
      res.status(429).json({
        message: 'We have sent several emails already. Please check your inbox and spam folder, then try again in an hour.'
      });
    }
  });

  // Limiter for sign-up endpoint
  const signupLimiter = rateLimit({
    ...common,
    windowMs: 60 * 60 * 1000, // 1 hour
    max: overrides.signupMax ?? 10,
    skip: () => disabled(),
    handler: (req, res) => {
      logger.security('Signup rate limit exceeded for IP:', req.ip);
      res.status(429).json({
        message: 'Too many sign-up attempts. Please try again later.'
      });
    }
  });

  return {
    apiLimiter,
    authLimiter,
    emailLimiter,
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
      onSanitize: ({ key }) => {
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
  // Prevent large payloads (photo uploads are capped separately by multer)
  if (req.headers['content-length'] && parseInt(req.headers['content-length']) > 10 * 1024 * 1024) {
    logger.security('Payload too large from IP:', req.ip);
    return res.status(413).json({ message: 'Payload too large' });
  }

  // Validate content type for POST/PUT requests
  // Only when there is a body: "like", "RSVP" and "mark read" send none.
  const hasBody = Number(req.headers['content-length'] || 0) > 0 || Boolean(req.headers['transfer-encoding']);
  if (hasBody && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.headers['content-type'];
    if (!contentType || (!contentType.includes('application/json') && !contentType.includes('multipart/form-data'))) {
      return res.status(415).json({ message: 'Unsupported Media Type' });
    }
  }

  next();
};

// Error handling middleware that doesn't expose sensitive info
export const errorHandler = (err, req, res, next) => {
  // Upload problems are the member's to fix, so say what went wrong plainly.
  if (err?.name === 'MulterError') {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'That picture is too large. Please choose one under 5 MB.'
      : 'We could not read that file. Please try a different picture.';
    return res.status(400).json({ message });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Invalid request' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Payload too large' });
  }

  const status = err.status || 500;
  logger.error('[API ERROR HANDLER]', JSON.stringify({
    message: err.message,
    status,
    path: req.path,
    method: req.method,
    userId: req.userId ? String(req.userId) : 'anonymous'
  }));

  // Messages on 4xx errors are written for the member; anything else stays
  // generic so internals never leak. Stack traces are never sent.
  let message = 'Something went wrong on our side. Please try again.';
  if (status === 400) message = err.message || 'Bad request';
  else if (status === 401) message = 'Unauthorized';
  else if (status === 403) message = 'Forbidden';
  else if (status === 404) message = 'Not found';

  res.status(status).json({ message, status });
};

/**
 * Request logging: who called what, how it went, how long it took.
 *
 * This used to print every request body and every response body. That put
 * private messages, profile answers, verification codes, reset tokens and the
 * `current_password` / `new_password` fields (which the old redaction list did
 * not cover) into the hosting provider's logs. Bodies are no longer logged.
 */
export const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const line = JSON.stringify({
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${Date.now() - start}ms`,
      userId: req.userId ? String(req.userId) : 'anonymous'
    });
    if (res.statusCode >= 500) {
      logger.error('[API]', line);
    } else if (res.statusCode >= 400) {
      logger.warn('[API]', line);
    } else {
      logger.log('[API]', line);
    }
  });

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
