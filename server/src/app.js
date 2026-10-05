import './config/env.js';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

import config from './config/env.js';
import {
  securityHeaders,
  dataSanitization,
  validateRequest,
  errorHandler,
  requestLogger,
  createLimiters
} from './middleware/security.js';
import { setupRealtime } from './realtime.js';
import { LOCAL_UPLOAD_DIR } from './providers/storage.js';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import browseRoutes from './routes/browse.js';
import matchRoutes from './routes/matches.js';
import messageRoutes from './routes/messages.js';
import eventRoutes from './routes/events.js';
import notificationRoutes from './routes/notifications.js';
import settingsRoutes from './routes/settings.js';
import adminRoutes from './routes/admin.js';
import favoriteRoutes from './routes/favorites.js';
import testRoutes from './routes/test-support.js';

/**
 * Builds the Express app and Socket.io server without connecting to a database
 * or opening a port, so tests can drive it directly. `index.js` does the
 * connecting and listening for real deployments.
 */
export function createApp() {
  const app = express();
  const httpServer = createServer(app);

  // Origins allowed to call the API. Production reads ALLOWED_ORIGINS exactly
  // as before; development also honours it so the app can run on other ports.
  const extraOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',').map(origin => origin.trim()).filter(Boolean);
  const allowedOrigins = process.env.NODE_ENV === 'production'
    ? (extraOrigins.length ? extraOrigins : ['https://app.d8lpa.com'])
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5001', ...extraOrigins];

  const io = new Server(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'production'
        ? Array.from(new Set(['https://app.d8lpa.com', ...allowedOrigins]))
        : allowedOrigins,
      credentials: true
    }
  });
  setupRealtime(io);
  app.set('io', io);

  // Railway (and most hosts) put the app behind one proxy. Without this every
  // visitor appears to come from the proxy's address, and a per-address rate
  // limit would lock the whole community out together.
  if (process.env.TRUST_PROXY) {
    const value = process.env.TRUST_PROXY;
    app.set('trust proxy', /^\d+$/.test(value) ? Number(value) : value);
  } else if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  // 1. CORS configuration (MUST be first for preflight requests)
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      const error = new Error('Not allowed by CORS');
      error.status = 403;
      return callback(error);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400 // 24 hours
  }));

  // 2. Security headers with Helmet
  app.use(securityHeaders());

  // 3. Request validation
  app.use(validateRequest);

  // 4. Body parsing with limits. Photos go through multer, so JSON bodies
  // never need to be large.
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // 5. Data sanitization
  app.use(...dataSanitization());

  // 6. Request logging
  app.use(requestLogger);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 7. Rate limits. These were defined but never attached to anything.
  const limiters = createLimiters();
  app.use('/api', limiters.apiLimiter);
  app.use('/api/auth/login', limiters.authLimiter);
  app.use('/api/auth/verify-email', limiters.authLimiter);
  app.use('/api/auth/reset-password', limiters.authLimiter);
  app.use('/api/auth/forgot-password', limiters.emailLimiter);
  app.use('/api/auth/resend-verification', limiters.emailLimiter);
  app.use('/api/auth/signup', limiters.signupLimiter);

  // Local photo storage (development / tests only - never in production).
  if (config.storageDriver === 'local') {
    app.use('/local-uploads', (req, res, next) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      next();
    }, express.static(LOCAL_UPLOAD_DIR));
  }

  // Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/browse', browseRoutes);
  app.use('/api/matches', matchRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/events', eventRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/favorites', favoriteRoutes);

  // Helpers for automated tests (read the captured outbox). Never mounted in
  // production: config ignores the switch there and the router re-checks.
  if (config.testRoutesEnabled) {
    app.use('/api/__test', testRoutes);
  }

  // Error handling middleware
  app.use(errorHandler);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ message: 'Route not found' });
  });

  return { app, httpServer, io };
}

export default createApp;
