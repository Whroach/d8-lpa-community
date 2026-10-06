/**
 * Entry point for the LOCAL demo / test server (started by scripts/dev-local.mjs).
 * Seeds the throwaway database with fictional members, then starts the normal
 * API. It refuses to run in production or against a remote database.
 */
import '../config/env.js';
import mongoose from 'mongoose';
import { isLocalMongoUri } from '../utils/script-env.js';

if (process.env.NODE_ENV === 'production' || !isLocalMongoUri(process.env.MONGODB_URI)) {
  console.error('local-server.js only runs against a local database outside production.');
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);
const { seedDemo } = await import('./seed-demo.js');
const result = await seedDemo({ reset: process.env.SEED_RESET === '1' });
console.log(result.skipped ? 'Demo data already present.' : `Seeded demo data: ${result.members} members, ${result.events} events.`);

// SEED_BULK=1 adds about 300 more fictional members and 250 reports, for
// trying the admin screens at scale (see seed-bulk.js). Off by default.
if (process.env.SEED_BULK === '1') {
  const { seedBulk } = await import('./seed-bulk.js');
  const bulk = await seedBulk();
  console.log(bulk.skipped ? 'Bulk admin data already present.' : `Seeded bulk admin data: ${bulk.members} members, ${bulk.reports} reports.`);
}
await mongoose.disconnect();

await import('../index.js');
