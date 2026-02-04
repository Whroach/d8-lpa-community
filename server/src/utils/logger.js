/**
 * Production-safe logger for backend
 * In production (NODE_ENV=production), logs are minimized
 * In development, all logs are shown
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

const logger = {
  log: (...args) => {
    if (isDevelopment) {
      console.log('[INFO]', new Date().toISOString(), ...args);
    }
  },

  error: (...args) => {
    // Always log errors, but be careful not to expose sensitive info
    console.error('[ERROR]', new Date().toISOString(), ...args);
  },

  warn: (...args) => {
    if (isDevelopment) {
      console.warn('[WARN]', new Date().toISOString(), ...args);
    }
  },

  info: (...args) => {
    console.info('[INFO]', new Date().toISOString(), ...args);
  },

  debug: (...args) => {
    if (isDevelopment) {
      console.debug('[DEBUG]', new Date().toISOString(), ...args);
    }
  },

  // Security event logging (always log in both modes for audit trail)
  security: (...args) => {
    console.log('[SECURITY]', new Date().toISOString(), ...args);
  },

  // Request logging (abbreviated in production)
  request: (method, path, status, userId) => {
    const timestamp = new Date().toISOString();
    if (isDevelopment) {
      console.log(`[${timestamp}] ${method} ${path} - ${status} - User: ${userId || 'anonymous'}`);
    } else {
      // Minimal logging in production
      if (status >= 400) {
        console.log(`[${timestamp}] ${method} ${path} - ${status}`);
      }
    }
  },

  // API request/response logging
  api: {
    request: (data) => {
      if (isDevelopment) {
        console.log('[API REQUEST]', JSON.stringify(data, null, 2));
      }
    },
    response: (data) => {
      if (isDevelopment) {
        console.log('[API RESPONSE]', JSON.stringify(data, null, 2));
      }
    },
    error: (data) => {
      console.error('[API ERROR]', JSON.stringify(data, null, 2));
    }
  }
};

export default logger;
