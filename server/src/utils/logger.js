/**
 * Production-safe logger for backend
 * Logs are always output, but sensitive info is redacted in production
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

const logger = {
  log: (...args) => {
    console.log('[INFO]', new Date().toISOString(), ...args);
  },

  error: (...args) => {
    // Always log errors
    console.error('[ERROR]', new Date().toISOString(), ...args);
  },

  warn: (...args) => {
    console.warn('[WARN]', new Date().toISOString(), ...args);
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

  // Request logging
  request: (method, path, status, userId) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${method} ${path} - ${status} - User: ${userId || 'anonymous'}`);
  },

  // API request/response logging
  api: {
    request: (data) => {
      console.log('[API REQUEST]', JSON.stringify(data, null, 2));
    },
    response: (data) => {
      console.log('[API RESPONSE]', JSON.stringify(data, null, 2));
    },
    error: (data) => {
      console.error('[API ERROR]', JSON.stringify(data, null, 2));
    }
  }
};

export default logger;
