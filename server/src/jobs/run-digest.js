/**
 * Sends the email summary to members who opted in. Intended for a scheduled
 * task (for example once a day):  node src/jobs/run-digest.js
 * Uses the same environment as the API (MONGODB_URI, Mailgun settings).
 */
import '../config/env.js';
import mongoose from 'mongoose';
import { requireMongoUri } from '../utils/script-env.js';
import { sendDigests } from './digest.js';

await mongoose.connect(requireMongoUri());
const result = await sendDigests();
console.log(`Digest: ${result.sent} sent of ${result.considered} members who opted in.`);
await mongoose.disconnect();
