/**
 * LOCAL ONLY. Gives one account the admin role in a throwaway local database,
 * for the production-like smoke run (scripts/smoke-prod.mjs), where the usual
 * demo seed is not available because the API runs with NODE_ENV=production.
 *
 * Refuses anything that is not a local database, never reads a .env file.
 *
 *   MONGODB_URI=mongodb://127.0.0.1:<port>/<db> node src/dev/local-make-admin.js someone@example.test
 */
import mongoose from 'mongoose';
import { isLocalMongoUri } from '../utils/script-env.js';

const uri = process.env.MONGODB_URI;
const email = String(process.argv[2] || '').toLowerCase();

if (!isLocalMongoUri(uri) || !email.endsWith('@example.test')) {
  console.error('local-make-admin.js only works on a local database and an @example.test address.');
  process.exit(1);
}

await mongoose.connect(uri);
const result = await mongoose.connection.collection('users').updateOne({ email }, { $set: { role: 'admin' } });
await mongoose.disconnect();
if (result.matchedCount !== 1) {
  console.error(`No account with the address ${email}.`);
  process.exit(1);
}
console.log(`${email} is now an admin (local database).`);
