/**
 * Production-safe logger
 * In production (NODE_ENV=production), all logs are silenced
 * In development, logs are passed through normally
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

// Override console methods based on environment
const logger = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  
  error: (...args: any[]) => {
    if (isDevelopment) {
      console.error(...args);
    }
  },
  
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
  
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },
  
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },
  
  // Always log errors in production (for error tracking services)
  logError: (error: Error, context?: string) => {
    // In production, you could send this to an error tracking service like Sentry
    // For now, we silently skip it to prevent console pollution
    if (isDevelopment) {
      console.error(`[${context || 'ERROR'}]`, error);
    }
  }
};

// Suppress console warnings in production
if (!isDevelopment) {
  window.console = {
    ...window.console,
    log: () => {},
    warn: () => {},
    info: () => {},
    debug: () => {},
    error: () => {},
  } as any;
}

export default logger;
