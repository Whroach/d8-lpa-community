/**
 * Email summary ("digest") of unread messages and upcoming events.
 *
 * Only for members who switched it on in Settings. Never includes message
 * text - just who wrote and how many. Sent at most once every `minHours`.
 *
 * Nothing schedules this yet: call sendDigests() from a cron job or a Railway
 * scheduled task (see docs/ROLLOUT.md), or run `node src/jobs/run-digest.js`.
 */
import User from '../models/User.js';
import Match from '../models/Match.js';
import Event from '../models/Event.js';
import UserNotificationSettings from '../models/UserNotificationSettings.js';
import { sendDigestEmail } from '../utils/email.js';
import { isWithinQuietHoursServer } from './quiet-hours.js';

const formatWhen = (date) =>
  new Date(date).toLocaleString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit'
  });

export async function buildDigestFor(user, now = new Date()) {
  const me = user._id.toString();

  const matches = await Match.find({ users: me, is_active: true });
  const unread = [];
  for (const match of matches) {
    const count = match.unread_counts?.get(me) || 0;
    if (count <= 0) continue;
    const otherId = match.users.find((id) => id !== me);
    const other = await User.findById(otherId).select('first_name is_deleted is_banned');
    if (!other || other.is_deleted || other.is_banned) continue;
    unread.push({ from: other.first_name, count });
  }

  const inTwoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const events = await Event.find({
    start_date: { $gte: now, $lte: inTwoWeeks },
    is_cancelled: { $ne: true },
    is_hidden: { $ne: true }
  }).sort({ start_date: 1 }).limit(5);

  return {
    firstName: user.first_name,
    unread,
    events: events.map((event) => ({
      title: event.title,
      when: formatWhen(event.start_date),
      location: event.location
    }))
  };
}

/**
 * @returns {Promise<{ considered: number, sent: number }>}
 */
export async function sendDigests({ now = new Date(), minHours = 72 } = {}) {
  const optedIn = await UserNotificationSettings.find({ email_digest: true });
  let sent = 0;

  for (const settings of optedIn) {
    const last = settings.email_digest_last_sent;
    if (last && now.getTime() - new Date(last).getTime() < minHours * 60 * 60 * 1000) continue;
    if (isWithinQuietHoursServer(settings, now)) continue;

    const user = await User.findById(settings.user_id);
    if (!user || user.is_deleted || user.is_banned || user.is_suspended || user.is_disabled || !user.email_verified) continue;

    const digest = await buildDigestFor(user, now);
    // Nothing waiting and nothing coming up: don't send an empty email.
    if (digest.unread.length === 0 && digest.events.length === 0) continue;

    const ok = await sendDigestEmail(user.email, digest);
    if (ok) {
      settings.email_digest_last_sent = now;
      await settings.save();
      sent += 1;
    }
  }

  return { considered: optedIn.length, sent };
}
