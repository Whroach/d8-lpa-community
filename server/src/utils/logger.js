/**
 * Production-safe logger for backend.
 *
 * LOG_LEVEL=silent (tests) switches everything off; otherwise behaviour is as
 * before: everything is printed, debug only outside production.
 */
const isDevelopment = process.env.NODE_ENV !== 'production';
const silent = () => process.env.LOG_LEVEL === 'silent';

const logger = {
  log: (...args) => {
    if (silent()) return;
    console.log('[INFO]', new Date().toISOString(), ...args);
  },

  error: (...args) => {
    if (silent()) return;
    console.error('[ERROR]', new Date().toISOString(), ...args);
  },

  warn: (...args) => {
    if (silent()) return;
    console.warn('[WARN]', new Date().toISOString(), ...args);
  },

  info: (...args) => {
    if (silent()) return;
    console.info('[INFO]', new Date().toISOString(), ...args);
  },

  debug: (...args) => {
    if (silent()) return;
    if (isDevelopment) {
      console.debug('[DEBUG]', new Date().toISOString(), ...args);
    }
  },

  // Security event logging (always log in both modes for audit trail)
  security: (...args) => {
    if (silent()) return;
    console.log('[SECURITY]', new Date().toISOString(), ...args);
  },
};

export default logger;
