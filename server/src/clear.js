import { requireMongoUri, requireEnv } from './utils/script-env.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootEnvPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: rootEnvPath });

// Import models
import User from './models/User.js';
import Profile from './models/Profile.js';
import Event from './models/Event.js';
import Match from './models/Match.js';
import Like from './models/Like.js';
import Message from './models/Message.js';
import Notification from './models/Notification.js';
import Block from './models/Block.js';
import Report from './models/Report.js';

const MONGODB_URI = requireMongoUri({ destructive: true });

const clearAllData = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Delete all documents from each collection
    console.log('\n🗑️  Clearing all data from collections...\n');

    // Use the collection directly to bypass any Mongoose middleware/hooks
    const db = mongoose.connection.db;

    const usersResult = await db.collection('users').deleteMany({});
    console.log(`✓ Deleted ${usersResult.deletedCount} users`);

    const profilesResult = await db.collection('profiles').deleteMany({});
    console.log(`✓ Deleted ${profilesResult.deletedCount} profiles`);

    const eventsResult = await db.collection('events').deleteMany({});
    console.log(`✓ Deleted ${eventsResult.deletedCount} events`);

    const matchesResult = await db.collection('matches').deleteMany({});
    console.log(`✓ Deleted ${matchesResult.deletedCount} matches`);

    const likesResult = await db.collection('likes').deleteMany({});
    console.log(`✓ Deleted ${likesResult.deletedCount} likes`);

    const messagesResult = await db.collection('messages').deleteMany({});
    console.log(`✓ Deleted ${messagesResult.deletedCount} messages`);

    const notificationsResult = await db.collection('notifications').deleteMany({});
    console.log(`✓ Deleted ${notificationsResult.deletedCount} notifications`);

    const blocksResult = await db.collection('blocks').deleteMany({});
    console.log(`✓ Deleted ${blocksResult.deletedCount} blocks`);

    const reportsResult = await db.collection('reports').deleteMany({});
    console.log(`✓ Deleted ${reportsResult.deletedCount} reports`);

    console.log('\n✅ All data cleared successfully!');
    console.log('📝 Collections are still intact, only documents were removed.\n');

    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  } catch (error) {
    console.error('❌ Error clearing data:', error);
    process.exit(1);
  }
};

clearAllData();
