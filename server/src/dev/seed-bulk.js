/**
 * A large, obviously fictional community for LOCAL development and tests
 * only: about 300 members and 250 member reports, so the admin screens can be
 * tried the way they will look once the community has grown.
 *
 * Switch it on with SEED_BULK=1 when starting the local stack
 * (`$env:SEED_BULK='1'; npm run dev:local`), or - in tests - through the
 * local-only route POST /api/__test/bulk-admin-data (DELETE removes it again).
 *
 * Everyone here is invented (example.test addresses). The members have not
 * finished sign-up, so they never appear in Browse or anywhere else members
 * look - only in the admin panel. It refuses to run in production or against
 * a database that is not on this computer.
 */
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Report from '../models/Report.js';
import Notification from '../models/Notification.js';
import ModerationAction from '../models/ModerationAction.js';
import { isLocalMongoUri } from '../utils/script-env.js';

export const BULK_EMAIL = /^bulk-member-\d+@example\.test$/;
const BULK_PASSWORD = 'Demo-Pass-2026!';

const FIRST = ['Alma', 'Bertie', 'Cecil', 'Dorothea', 'Edmund', 'Flora', 'Gideon', 'Harriet', 'Ignatius', 'Josephine',
  'Kit', 'Leona', 'Mortimer', 'Nell', 'Otis', 'Pearl', 'Quentin', 'Rosalind', 'Silas', 'Tabitha'];
const LAST = ['Applegarth', 'Birchwood', 'Coppersmith', 'Dunmore', 'Everleigh', 'Fairweather', 'Goodfellow', 'Hartwell',
  'Inglewood', 'Juniper', 'Kingfisher', 'Larkspur', 'Merriweather', 'Nightingale', 'Oakhurst'];
const CATEGORIES = [
  'Asked me for money, gift cards or crypto',
  'Rude or abusive messages',
  'Pretending to be someone else',
  'Made me feel unsafe',
  'Something else',
];
const DETAILS = [
  'Asked for a loan in the second message.',
  'Kept writing after I asked them to stop.',
  'The photos do not look like the person I met at the picnic.',
  'Used unkind words about another member.',
  '',
];
const SOURCES = ['chat', 'profile', 'browse', 'matches'];

function assertLocal() {
  const uri = `mongodb://${mongoose.connection.host}:${mongoose.connection.port}`;
  if (process.env.NODE_ENV === 'production' || !isLocalMongoUri(uri)) {
    throw new Error('The bulk seed only runs against a local database outside production.');
  }
}

const daysAgo = (days, minutes = 0) => new Date(Date.now() - days * 86400000 - minutes * 60000);

export async function clearBulk() {
  assertLocal();
  const members = await User.find({ email: BULK_EMAIL }).select('_id');
  const ids = members.map((m) => m._id.toString());
  const reports = await Report.deleteMany({ $or: [{ reporter: { $in: ids } }, { reported_user: { $in: ids } }] });
  await ModerationAction.deleteMany({ target_user: { $in: ids } });
  await Notification.deleteMany({ user_id: { $in: ids } });
  await User.deleteMany({ email: BULK_EMAIL });
  return { members: ids.length, reports: reports.deletedCount };
}

export async function seedBulk({ members = 300, reports = 250 } = {}) {
  assertLocal();
  members = Math.min(2000, Math.max(2, Number(members) || 300));
  reports = Math.min(2000, Math.max(0, Number(reports) || 0));
  if (await User.countDocuments({ email: BULK_EMAIL }) > 0) return { skipped: true };

  // One hash for everyone: insertMany skips the model's own hashing step.
  const password = await bcrypt.hash(BULK_PASSWORD, 4);
  const docs = [];
  for (let i = 1; i <= members; i += 1) {
    const banned = i % 33 === 0;
    const suspended = !banned && i % 20 === 0;
    const warnings = !banned && !suspended && i % 10 === 0 ? 1 + (i % 3) : 0;
    const history = [];
    const admin = 'admin@example.test';
    for (let w = 0; w < warnings; w += 1) history.push({ action: 'warn', reason: 'Please keep messages friendly.', admin, created_at: daysAgo(40 - w) });
    if (suspended) history.push({ action: 'suspend', reason: 'Cooling-off period after repeated reports.', admin, created_at: daysAgo(12) });
    if (banned) history.push({ action: 'ban', reason: 'Asked several members for money.', admin, created_at: daysAgo(20) });
    docs.push({
      email: `bulk-member-${String(i).padStart(3, '0')}@example.test`,
      password,
      first_name: FIRST[(i - 1) % FIRST.length],
      last_name: `${LAST[Math.floor((i - 1) / FIRST.length) % LAST.length]}${i > FIRST.length * LAST.length ? ' II' : ''}`,
      birthdate: new Date(Date.UTC(1961 + (i % 25), i % 12, 1 + (i % 27))),
      gender: ['female', 'male', 'non_binary'][i % 3],
      email_verified: true,
      onboarding_completed: false,
      agreed_to_guidelines: true,
      has_seen_tour: true,
      warnings,
      is_suspended: suspended,
      is_banned: banned,
      status: banned ? 'banned' : suspended ? 'suspended' : warnings ? 'warned' : 'active',
      moderation_history: history,
      // Spread over the last year, newest first, one minute apart within a day
      // so the order on screen is always the same.
      created_at: daysAgo(i, i),
      last_active: daysAgo(i % 30, i),
    });
  }
  const created = await User.insertMany(docs);
  const ids = created.map((u) => u._id.toString());

  const reportDocs = [];
  for (let i = 0; i < reports; i += 1) {
    const reported = ids[(i * 7) % ids.length];
    let reporter = ids[(i * 13 + 5) % ids.length];
    if (reporter === reported) reporter = ids[(i * 13 + 6) % ids.length];
    // Mostly waiting; some already closed either way.
    const status = i % 10 === 8 ? 'resolved' : i % 10 === 9 ? 'dismissed' : 'pending';
    const category = CATEGORIES[i % CATEGORIES.length];
    reportDocs.push({
      reporter,
      reported_user: reported,
      category,
      reason: DETAILS[i % DETAILS.length] || category,
      source: SOURCES[i % SOURCES.length],
      status,
      action_taken: status === 'resolved' ? 'warning' : 'none',
      ...(status === 'pending' ? {} : { reviewed_at: daysAgo(i % 60) }),
      created_at: daysAgo(i % 90, i),
    });
  }
  if (reportDocs.length) await Report.insertMany(reportDocs);

  return { skipped: false, members: created.length, reports: reportDocs.length };
}
