import './config/env.js';
import mongoose from 'mongoose';
import { createApp } from './app.js';

if (!process.env.JWT_SECRET) {
  // Without a secret every token check throws and nobody can sign in.
  console.error('JWT_SECRET is not set. Refusing to start.');
  process.exit(1);
}

const { app, httpServer } = createApp();
const PORT = process.env.PORT || 5001;

// Connect to MongoDB and start server
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dating-app';

mongoose.connect(mongoURI)
  .then(() => {
    console.log('Connected to MongoDB');
    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Socket.io server ready`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });

export default app;
