/**
 * Production-safe logger for backend
 * In production (NODE_ENV=production), logs are minimized
 * In development, all logs are shown
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

const logger = {
  log: (...args) => {
    if (isDevelopment) {
      console.log('[INFO]', ...args);
    }
  },

  error: (...args) => {
    // Always log errors, but be careful not to expose sensitive info
    if (isDevelopment) {
      console.error('[ERROR]', ...args);
    } else {
      // In production, only log non-sensitive error info
      console.error('[ERROR] An error occurred - check error tracking service');
    }
  },

  warn: (...args) => {
    if (isDevelopment) {
      console.warn('[WARN]', ...args);
    }
  },

  info: (...args) => {
    if (isDevelopment) {
      console.info('[INFO]', ...args);
    }
  },

  debug: (...args) => {
    if (isDevelopment) {
      console.debug('[DEBUG]', ...args);
    }
  },

  // Security event logging (always log in both modes for audit trail)
  security: (...args) => {
    console.log('[SECURITY]', new Date().toISOString(), ...args);
  },

  // Request logging (abbreviated in production)
  request: (method, path, status, userId) => {
    if (isDevelopment) {
      console.log(`[${method}] ${path} -> ${status} ${userId ? `(user: ${userId})` : ''}`);
    } else {
      // Only log failures and security-relevant requests
      if (status >= 400) {
        console.log(`[${method}] ${path} -> ${status}`);
      }
    }
  }
};

export default logger;
