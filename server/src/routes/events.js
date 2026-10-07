import express from 'express';
import { auth } from '../middleware/auth.js';
import Event from '../models/Event.js';
import User from '../models/User.js';
import Profile from '../models/Profile.js';
import Block from '../models/Block.js';
import logger from '../utils/logger.js';
import { validateIdParams } from '../utils/helpers.js';

const router = express.Router();

const MAX_NOTE_LENGTH = 140;

// `attendees` is a list of user-id strings. The old code called
// .populate('attendees') on it (a no-op, since the field has no ref) and then
// read `attendee._id`, which is undefined on a string - so as soon as anyone
// had RSVP'd, the whole events list failed with a 500.
const hasJoined = (event, userId) =>
  (event.attendees || []).some(id => String(id) === String(userId));

function formatEvent(event, userId) {
  return {
    id: event._id,
    title: event.title,
    description: event.description,
    image: event.image,
    start_date: event.start_date,
    end_date: event.end_date,
    location: event.location,
    category: event.category,
    attendees: (event.attendees || []).length,
    max_attendees: event.max_attendees,
    is_joined: hasJoined(event, userId),
    my_note: event.rsvp_notes?.get(String(userId)) || '',
    is_cancelled: event.is_cancelled || false,
    is_hidden: event.is_hidden || false
  };
}

const canSee = (event, req) => !event.is_hidden || req.user.role === 'admin';

// GET /api/events - Get all events
router.get('/', auth, async (req, res) => {
  try {
    const { category, upcoming } = req.query;

    const query = {};

    if (typeof category === 'string' && category) {
      query.category = category;
    }

    if (upcoming === 'true') {
      query.start_date = { $gte: new Date() };
      query.is_cancelled = { $ne: true };
    }

    if (req.user.role !== 'admin') {
      query.is_hidden = { $ne: true };
    }

    const events = await Event.find(query).sort({ start_date: 1 });

    res.json(events.map(event => formatEvent(event, req.userId)));
  } catch (error) {
    logger.error('Get events error:', error.message);
    res.status(500).json({ message: 'Error fetching events' });
  }
});

/**
 * Who is going: first name, photo and their optional note. Members who have
 * blocked (or been blocked by) the viewer are left out, as are paused,
 * banned and deleted accounts.
 */
async function listAttendees(event, viewerId) {
  const ids = (event.attendees || []).map(String);
  if (ids.length === 0) return [];

  const viewer = String(viewerId);
  const blocks = await Block.find({
    $or: [{ blocker: viewer }, { blocked: viewer }]
  });
  const hidden = new Set(blocks.map(b => (b.blocker === viewer ? b.blocked : b.blocker)));

  const users = await User.find({
    _id: { $in: ids.filter(id => !hidden.has(id)) },
    is_deleted: { $ne: true },
    is_banned: { $ne: true },
    is_disabled: { $ne: true }
  }).select('first_name');
  const profiles = await Profile.find({ user_id: { $in: users.map(u => u._id.toString()) } })
    .select('user_id profile_picture_url photos');
  const photoByUser = new Map(profiles.map(p => [
    p.user_id.toString(),
    p.profile_picture_url || p.photos?.[0] || null
  ]));

  return users.map(u => ({
    id: u._id,
    first_name: u.first_name,
    photo: photoByUser.get(u._id.toString()) || null,
    note: event.rsvp_notes?.get(u._id.toString()) || '',
    is_me: u._id.toString() === viewer
  }));
}

// GET /api/events/:eventId
router.get('/:eventId', auth, validateIdParams('eventId'), async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);

    if (!event || !canSee(event, req)) {
      return res.status(404).json({ message: 'Event not found' });
    }

    res.json({
      ...formatEvent(event, req.userId),
      attendees_list: await listAttendees(event, req.userId)
    });
  } catch (error) {
    logger.error('Get event error:', error.message);
    res.status(500).json({ message: 'Error fetching event' });
  }
});

// GET /api/events/:eventId/attendees - who's going
router.get('/:eventId/attendees', auth, validateIdParams('eventId'), async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event || !canSee(event, req)) {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.json(await listAttendees(event, req.userId));
  } catch (error) {
    logger.error('Get attendees error:', error.message);
    res.status(500).json({ message: 'Error fetching attendees' });
  }
});

// POST /api/events/:eventId/join
router.post('/:eventId/join', auth, validateIdParams('eventId'), async (req, res) => {
  try {
    const me = req.userId.toString();
    const event = await Event.findById(req.params.eventId);

    if (!event || !canSee(event, req)) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.is_cancelled) {
      return res.status(400).json({ message: 'Event has been cancelled' });
    }

    if (hasJoined(event, me)) {
      return res.status(400).json({ message: 'Already joined this event' });
    }

    // Conditional update, so two people taking the last place at the same
    // moment can't both get in, and nobody is ever listed twice.
    const filter = { _id: event._id, attendees: { $ne: me } };
    if (event.max_attendees) {
      filter[`attendees.${event.max_attendees - 1}`] = { $exists: false };
    }
    const updated = await Event.findOneAndUpdate(
      filter,
      { $addToSet: { attendees: me } },
      { new: true }
    );
    if (!updated) {
      return res.status(400).json({ message: 'Event is full' });
    }

    res.json({ success: true, is_joined: true, attendees: updated.attendees.length });
  } catch (error) {
    logger.error('Join event error:', error.message);
    res.status(500).json({ message: 'Error joining event' });
  }
});

// POST /api/events/:eventId/leave
router.post('/:eventId/leave', auth, validateIdParams('eventId'), async (req, res) => {
  try {
    const me = req.userId.toString();
    const updated = await Event.findOneAndUpdate(
      { _id: req.params.eventId },
      { $pull: { attendees: me }, $unset: { [`rsvp_notes.${me}`]: '' } },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Event not found' });
    }

    res.json({ success: true, is_joined: false, attendees: updated.attendees.length });
  } catch (error) {
    logger.error('Leave event error:', error.message);
    res.status(500).json({ message: 'Error leaving event' });
  }
});

// PUT /api/events/:eventId/note - carpool / meet-up note shown next to your
// name in "Who's going". Only for members who have RSVP'd.
router.put('/:eventId/note', auth, validateIdParams('eventId'), async (req, res) => {
  try {
    const me = req.userId.toString();
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
    if (note.length > MAX_NOTE_LENGTH) {
      return res.status(400).json({ message: `Please keep your note under ${MAX_NOTE_LENGTH} characters.` });
    }

    const event = await Event.findById(req.params.eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    if (!hasJoined(event, me)) {
      return res.status(400).json({ message: 'Say you are going first, then you can add a note.' });
    }

    if (!event.rsvp_notes) event.rsvp_notes = new Map();
    if (note) event.rsvp_notes.set(me, note);
    else event.rsvp_notes.delete(me);
    await event.save();

    res.json({ success: true, note });
  } catch (error) {
    logger.error('Event note error:', error.message);
    res.status(500).json({ message: 'Error saving note' });
  }
});

export default router;
