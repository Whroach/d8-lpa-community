/**
 * In-app event reminders.
 *
 * A member who said "I'm going" gets one notification the day before the
 * event and one on the day. No email is sent.
 *
 * Nothing has to be scheduled for this to work: the reminders that are due
 * for a member are created when that member's notifications are read (see
 * routes/notifications.js). `createDueEventReminders()` with no member does
 * the same for everybody, for a scheduled task if one is ever set up
 * (jobs/run-event-reminders.js).
 *
 * Each reminder is created at most once: the event keeps a list of the
 * reminders already given (`reminders_sent`, entries like "<userId>:eve"),
 * and an entry is added with a conditional update, so two requests arriving
 * together cannot both create it. Deleting the notification does not bring
 * it back.
 *
 * "Today" and "tomorrow" are judged on the community's clock (US Central by
 * default, COMMUNITY_TIME_ZONE), because the server does not know where each
 * member is; the time in the message carries the time-zone letters for the
 * same reason.
 */
import Event from '../models/Event.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { shouldCreateNotification } from '../utils/helpers.js';

const timeZone = () => process.env.COMMUNITY_TIME_ZONE || 'America/Chicago';

/** The calendar day (YYYY-MM-DD) of an instant, on the community's clock. */
export function communityDay(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone(), year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

const nextDay = (day) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
};

/** "eve" the day before, "day" on the day (until it starts), otherwise null. */
export function reminderKind(event, now = new Date()) {
  const start = new Date(event.start_date);
  if (Number.isNaN(start.getTime()) || start <= now) return null;
  const today = communityDay(now);
  const eventDay = communityDay(start);
  if (eventDay === today) return 'day';
  if (eventDay === nextDay(today)) return 'eve';
  return null;
}

export function reminderText(event, kind) {
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone(), hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
  }).format(new Date(event.start_date));
  return {
    title: kind === 'day' ? `Today: ${event.title}` : `Tomorrow: ${event.title}`,
    message: `${kind === 'day' ? 'Today' : 'Tomorrow'} at ${time}, ${event.location}. You said you are going.`
  };
}

/**
 * Creates the reminders that are due. With `userId`, only that member's.
 * Returns how many notifications were created.
 */
export async function createDueEventReminders({ userId = null, now = new Date(), io = null } = {}) {
  // Nothing further ahead than the end of "tomorrow" anywhere can be due.
  const horizon = new Date(now.getTime() + 49 * 60 * 60 * 1000);
  const query = {
    start_date: { $gt: now, $lte: horizon },
    is_cancelled: { $ne: true },
    is_hidden: { $ne: true }
  };
  if (userId) query.attendees = String(userId);

  const events = await Event.find(query);
  let created = 0;

  for (const event of events) {
    const kind = reminderKind(event, now);
    if (!kind) continue;
    const attendeeIds = userId ? [String(userId)] : (event.attendees || []).map(String);

    for (const attendeeId of attendeeIds) {
      const key = `${attendeeId}:${kind}`;
      if ((event.reminders_sent || []).includes(key)) continue;

      if (!userId) {
        // The scheduled version must not write to closed or banned accounts.
        // (The on-request version only ever runs for a signed-in member.)
        const member = await User.findById(attendeeId).select('is_banned is_deleted is_disabled');
        if (!member || member.is_banned || member.is_deleted || member.is_disabled) continue;
      }

      // Claim the reminder first; only the request that claims it creates it.
      const claim = await Event.updateOne(
        { _id: event._id, attendees: attendeeId, reminders_sent: { $ne: key } },
        { $addToSet: { reminders_sent: key } }
      );
      if (claim.modifiedCount !== 1) continue;

      if (!(await shouldCreateNotification(attendeeId, 'event'))) continue;

      await Notification.create({
        user_id: attendeeId,
        type: 'event',
        ...reminderText(event, kind),
        related_event: event._id.toString()
      });
      io?.to(attendeeId).emit('new-notification', { type: 'event' });
      created += 1;
    }
  }

  return created;
}
