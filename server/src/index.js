import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from root .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootEnvPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: rootEnvPath });

// Import security middleware
import {
  securityHeaders,
  dataSanitization,
  validateRequest,
  errorHandler,
  requestLogger
} from './middleware/security.js';
import logger from './utils/logger.js';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import browseRoutes from './routes/browse.js';
import matchRoutes from './routes/matches.js';
import messageRoutes from './routes/messages.js';
import eventRoutes from './routes/events.js';
import notificationRoutes from './routes/notifications.js';
import settingsRoutes from './routes/settings.js';
import adminRoutes from './routes/admin.js';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'development' 
      ? ['http://localhost:3000', 'http://localhost:3001', 'https://*.vercel.app']
      : ['https://*.vercel.app'],
    credentials: true
  }
});

const PORT = process.env.PORT || 5001;

// Make io accessible to routes
app.set('io', io);

// ============================================
// SECURITY MIDDLEWARE - Apply in order
// ============================================

// 1. CORS configuration (MUST be first for preflight requests)
app.use(cors({
  origin: process.env.NODE_ENV === 'development'
    ? ['http://localhost:3000', 'http://localhost:3001', 'https://*.vercel.app']
    : ['https://*.vercel.app'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // 24 hours
}));

// 2. Security headers with Helmet
app.use(securityHeaders());

// 3. Request validation
app.use(validateRequest);

// 4. Body parsing with limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 5. Data sanitization
app.use(...dataSanitization());

// 6. Request logging
app.use(requestLogger);

// Socket.io connection handlingapp.use(requestLogger);

// Socket.io connection handling
io.on('connection', (socket) => {
  logger.log('[SOCKET] User connected:', socket.id);

  // User joins their personal room based on userId
  socket.on('join', (userId) => {
    socket.join(userId);
    logger.log('[SOCKET] User joined room:', userId, 'socket:', socket.id);
  });

  // User joins a conversation room
  socket.on('join-conversation', (matchId) => {
    socket.join(`match-${matchId}`);
    logger.log('[SOCKET] User joined match room: match-' + matchId, 'socket:', socket.id);
  });

  // User leaves a conversation room
  socket.on('leave-conversation', (matchId) => {
    socket.leave(`match-${matchId}`);
    logger.log('[SOCKET] User left match room: match-' + matchId, 'socket:', socket.id);
  });

  socket.on('disconnect', () => {
    logger.log('[SOCKET] User disconnected:', socket.id);
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Not found' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Connect to MongoDB and start server
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Socket.io server ready`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

export default app;
