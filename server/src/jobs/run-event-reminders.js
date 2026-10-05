/**
 * Creates the in-app event reminders that are due, for every member.
 *
 * Optional: reminders are also created when a member opens the app, so this
 * only matters if you want the reminder waiting for them beforehand. If you
 * schedule it, once an hour is plenty:  node src/jobs/run-event-reminders.js
 * Uses the same environment as the API (MONGODB_URI). Sends no email.
 */
import '../config/env.js';
import mongoose from 'mongoose';
import { requireMongoUri } from '../utils/script-env.js';
import { createDueEventReminders } from './event-reminders.js';

await mongoose.connect(requireMongoUri());
const created = await createDueEventReminders();
console.log(`Event reminders: ${created} created.`);
await mongoose.disconnect();
