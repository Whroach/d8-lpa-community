import '../config/env.js';
import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { auth } from '../middleware/auth.js';
import User from '../models/User.js';
import Profile from '../models/Profile.js';
import Event from '../models/Event.js';
import Report from '../models/Report.js';
import Notification from '../models/Notification.js';
import UserNotificationSettings from '../models/UserNotificationSettings.js';
import logger from '../utils/logger.js';
import { shouldCreateNotification, validateIdParams } from '../utils/helpers.js';
import {
  ENVIRONMENT_FOLDER,
  imageExtensionFor,
  imageFileFilter,
  looksLikeImage,
  randomFileName,
  storeFile
} from '../providers/storage.js';

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1
  },
  fileFilter: imageFileFilter,
});

const router = express.Router();

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const EVENT_CATEGORIES = ['local-chapter', 'regional', 'national', 'dating', 'outdoor', 'food', 'social', 'fitness', 'arts'];

// Only these fields of an event can be set through the API. The update route
// used to pass the whole request body to the database, so attendees,
// created_by and anything else could be overwritten.
function pickEventFields(body) {
  const out = {};
  for (const key of ['title', 'description', 'image', 'start_date', 'end_date', 'location', 'category', 'max_attendees', 'is_hidden']) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  if (out.max_attendees === '' || out.max_attendees === null) out.max_attendees = undefined;
  if (out.end_date === '') out.end_date = undefined;
  return out;
}

function eventProblem(fields, { partial = false } = {}) {
  if (!partial || fields.title !== undefined) {
    if (typeof fields.title !== 'string' || !fields.title.trim()) return 'Please give the event a title.';
  }
  if (!partial || fields.location !== undefined) {
    if (typeof fields.location !== 'string' || !fields.location.trim()) return 'Please say where the event is.';
  }
  if (!partial || fields.start_date !== undefined) {
    if (!fields.start_date || Number.isNaN(new Date(fields.start_date).getTime())) return 'Please choose a start date and time.';
  }
  if (fields.end_date && Number.isNaN(new Date(fields.end_date).getTime())) return 'The end date is not valid.';
  if (fields.end_date && fields.start_date && new Date(fields.end_date) < new Date(fields.start_date)) {
    return 'The event cannot end before it starts.';
  }
  if (fields.category !== undefined && !EVENT_CATEGORIES.includes(fields.category)) return 'Please choose a category from the list.';
  if (fields.max_attendees !== undefined && (!Number.isFinite(Number(fields.max_attendees)) || Number(fields.max_attendees) < 1)) {
    return 'The number of places must be 1 or more.';
  }
  if (typeof fields.description === 'string' && fields.description.length > 2000) return 'The description is too long (2000 characters at most).';
  return null;
}

// Sends one live "something arrived" ping to each of these members.
function pingUsers(req, userIds, type) {
  const io = req.app.get('io');
  if (!io) return;
  for (const id of userIds) io.to(String(id)).emit('new-notification', { type });
}

// Middleware to check admin role
const checkAdmin = async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// The older one-purpose routes below (warn / suspend / ban) had no guard, so
// an admin could suspend or ban themselves or another admin through them and
// lock the panel. Same rule as the generic action route.
const notOnAdmins = async (req, res, next) => {
  try {
    const target = await User.findById(req.params.userId).select('role');
    if (target && (target.role === 'admin' || target._id.toString() === req.userId.toString())) {
      return res.status(400).json({ message: 'This action cannot be used on an admin account.' });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: 'Error performing user action' });
  }
};

// GET /api/admin/users
router.use('/users/:userId', validateIdParams('userId'));
router.use('/events/:eventId', (req, res, next) =>
  req.params.eventId === 'photo' ? next() : validateIdParams('eventId')(req, res, next));
router.use('/reports/:reportId', validateIdParams('reportId'));

router.get('/users', auth, checkAdmin, async (req, res) => {
  try {
    // The admin UI loads the full roster client-side, so default to a page
    // size that covers it. Hard-capped so a bad query can't pull everything.
    const { status, search, page = 1, limit = 500 } = req.query;
    const pageSize = Math.min(1000, Math.max(1, parseInt(limit) || 500));

    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (typeof search === 'string' && search.trim()) {
      const pattern = escapeRegex(search.trim().slice(0, 100));
      query.$or = [
        { first_name: { $regex: pattern, $options: 'i' } },
        { last_name: { $regex: pattern, $options: 'i' } },
        { email: { $regex: pattern, $options: 'i' } }
      ];
    }

    const skip = (Math.max(1, parseInt(page) || 1) - 1) * pageSize;

    const [users, total] = await Promise.all([
      User.find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(pageSize),
      User.countDocuments(query)
    ]);

    res.json({
      users: users.map(u => ({
        id: u._id,
        first_name: u.first_name,
        last_name: u.last_name,
        email: u.email,
        role: u.role,
        email_verified: u.email_verified,
        is_disabled: u.is_disabled,
        is_deleted: u.is_deleted,
        status: u.status,
        created_at: u.created_at,
        last_active: u.last_active,
        warnings: u.warnings,
        is_suspended: u.is_suspended,
        is_banned: u.is_banned,
        moderation_history: (u.moderation_history || []).map(h => ({
          id: h._id,
          action: h.action,
          reason: h.reason,
          admin: h.admin,
          created_at: h.created_at
        }))
      })),
      total,
      page: Math.max(1, parseInt(page) || 1),
      totalPages: Math.ceil(total / pageSize)
    });
  } catch (error) {
    console.error('Admin get users error:', error);
    res.status(500).json({ message: 'Error fetching users' });
  }
});

// PUT /api/admin/users/:userId/warn
router.put('/users/:userId/warn', auth, checkAdmin, notOnAdmins, async (req, res) => {
  try {
    const { reason } = req.body;
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.warnings += 1;
    user.status = 'warned';
    await user.save();

    // Notify user
    await Notification.create({
      user_id: user._id,
      type: 'system',
      title: 'Account Warning',
      message: reason || 'Your account has received a warning for violating our community guidelines.'
    });

    res.json({ success: true, warnings: user.warnings });
  } catch (error) {
    console.error('Warn user error:', error);
    res.status(500).json({ message: 'Error warning user' });
  }
});

// PUT /api/admin/users/:userId/suspend
router.put('/users/:userId/suspend', auth, checkAdmin, notOnAdmins, async (req, res) => {
  try {
    const { reason, duration } = req.body;
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.is_suspended = true;
    user.status = 'suspended';
    await user.save();

    await Notification.create({
      user_id: user._id,
      type: 'system',
      title: 'Account Suspended',
      message: reason || 'Your account has been suspended for violating our community guidelines.'
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Suspend user error:', error);
    res.status(500).json({ message: 'Error suspending user' });
  }
});

// PUT /api/admin/users/:userId/unsuspend
router.put('/users/:userId/unsuspend', auth, checkAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.is_suspended = false;
    user.status = user.warnings > 0 ? 'warned' : 'active';
    await user.save();

    res.json({ success: true });
  } catch (error) {
    console.error('Unsuspend user error:', error);
    res.status(500).json({ message: 'Error unsuspending user' });
  }
});

// PUT /api/admin/users/:userId/ban
router.put('/users/:userId/ban', auth, checkAdmin, notOnAdmins, async (req, res) => {
  try {
    const { reason } = req.body;
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.is_banned = true;
    user.status = 'banned';
    await user.save();

    res.json({ success: true });
  } catch (error) {
    console.error('Ban user error:', error);
    res.status(500).json({ message: 'Error banning user' });
  }
});

// PUT /api/admin/users/:userId/unban
router.put('/users/:userId/unban', auth, checkAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.is_banned = false;
    user.status = user.warnings > 0 ? 'warned' : 'active';
    await user.save();

    res.json({ success: true });
  } catch (error) {
    console.error('Unban user error:', error);
    res.status(500).json({ message: 'Error unbanning user' });
  }
});

// POST /api/admin/users/:userId/action - Generic action endpoint
router.post('/users/:userId/action', auth, checkAdmin, async (req, res) => {
  try {
    const action = req.body?.action;
    const message = typeof req.body?.message === 'string' ? req.body.message.trim().slice(0, 1000) : '';
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // An admin can't suspend or ban themselves (and lock the panel), or act
    // against another admin from here.
    if (['warn', 'suspend', 'ban'].includes(action) && (user.role === 'admin' || user._id.toString() === req.userId.toString())) {
      return res.status(400).json({ message: 'This action cannot be used on an admin account.' });
    }

    switch(action) {
      case 'warn':
        user.warnings = (user.warnings || 0) + 1;
        user.status = 'warned';
        await user.save();

        await Notification.create({
          user_id: user._id,
          type: 'system',
          title: 'Account Warning',
          message: message || 'Your account has received a warning for violating our community guidelines.'
        });
        break;

      case 'suspend':
        user.is_suspended = true;
        user.status = 'suspended';
        await user.save();

        await Notification.create({
          user_id: user._id,
          type: 'system',
          title: 'Account Suspended',
          message: message || 'Your account has been suspended for violating our community guidelines.'
        });
        break;

      case 'unsuspend':
        user.is_suspended = false;
        user.status = user.warnings > 0 ? 'warned' : 'active';
        await user.save();
        break;

      case 'ban':
        user.is_banned = true;
        user.status = 'banned';
        await user.save();

        await Notification.create({
          user_id: user._id,
          type: 'system',
          title: 'Account Banned',
          message: message || 'Your account has been permanently banned.'
        });
        break;

      case 'unban':
        user.is_banned = false;
        user.status = user.warnings > 0 ? 'warned' : 'active';
        await user.save();
        break;

      case 'remove_warning':
        user.warnings = Math.max(0, (user.warnings || 1) - 1);
        user.status = user.warnings > 0 ? 'warned' : (user.is_suspended ? 'suspended' : (user.is_banned ? 'banned' : 'active'));
        await user.save();
        break;

      default:
        return res.status(400).json({ message: 'Invalid action' });
    }

    // Record the action so the admin panel's History tab shows a real audit
    // trail rather than sample data.
    // A suspended or banned member is signed out of live chat immediately.
    if (action === 'suspend' || action === 'ban') {
      req.app.get('io')?.in(user._id.toString()).disconnectSockets(true);
    } else if (action === 'warn') {
      pingUsers(req, [user._id], 'system');
    }

    user.moderation_history = user.moderation_history || [];
    user.moderation_history.push({
      action,
      reason: message || '',
      admin: req.user?.email || 'admin',
      created_at: new Date()
    });
    await user.save();

    res.json({ success: true, moderation_history: user.moderation_history });
  } catch (error) {
    console.error('User action error:', error);
    res.status(500).json({ message: 'Error performing user action' });
  }
});

// GET /api/admin/users/:userId/notes
router.get('/users/:userId/notes', auth, checkAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('admin_notes');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(
      (user.admin_notes || []).map(n => ({
        id: n._id,
        content: n.content,
        admin: n.admin,
        created_at: n.created_at
      }))
    );
  } catch (error) {
    console.error('Get notes error:', error);
    res.status(500).json({ message: 'Error fetching notes' });
  }
});

// POST /api/admin/users/:userId/notes
router.post('/users/:userId/notes', auth, checkAdmin, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Note content is required' });
    }

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.admin_notes = user.admin_notes || [];
    user.admin_notes.push({
      content: content.trim(),
      admin: req.user?.email || 'admin'
    });
    await user.save();

    const note = user.admin_notes[user.admin_notes.length - 1];
    res.status(201).json({
      id: note._id,
      content: note.content,
      admin: note.admin,
      created_at: note.created_at
    });
  } catch (error) {
    console.error('Add note error:', error);
    res.status(500).json({ message: 'Error adding note' });
  }
});

// PUT /api/admin/users/:userId/notes - edit a note
router.put('/users/:userId/notes', auth, checkAdmin, async (req, res) => {
  try {
    const { noteId, content } = req.body || {};
    if (typeof noteId !== 'string' || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ message: 'Note content is required' });
    }

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const note = (user.admin_notes || []).find(n => n._id.toString() === noteId);
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }
    note.content = content.trim().slice(0, 2000);
    note.updated_at = new Date();
    await user.save();

    res.json({ id: note._id, content: note.content, admin: note.admin, created_at: note.created_at, updated_at: note.updated_at });
  } catch (error) {
    logger.error('Update note error:', error.message);
    res.status(500).json({ message: 'Error updating note' });
  }
});

// DELETE /api/admin/users/:userId/notes?noteId=...
router.delete('/users/:userId/notes', auth, checkAdmin, async (req, res) => {
  try {
    const { noteId } = req.query;
    if (!noteId) {
      return res.status(400).json({ message: 'noteId is required' });
    }

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.admin_notes = (user.admin_notes || []).filter(
      n => n._id.toString() !== noteId
    );
    await user.save();

    res.json({ success: true });
  } catch (error) {
    console.error('Delete note error:', error);
    res.status(500).json({ message: 'Error deleting note' });
  }
});

// Events management
// POST /api/admin/events/photo - Upload event photo
router.post('/events/photo', auth, checkAdmin, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No photo provided' });
    }

    const file = req.file;
    const extension = imageExtensionFor(file.mimetype);
    if (!extension || !looksLikeImage(file.buffer, file.mimetype)) {
      return res.status(400).json({ message: 'That file does not look like a picture. Please choose a JPG, PNG, WebP or GIF.' });
    }
    const key = `${ENVIRONMENT_FOLDER}/events/${randomFileName(extension)}`;
    const photoUrl = await storeFile({ key, body: file.buffer, contentType: file.mimetype });

    res.json({ url: photoUrl });
  } catch (error) {
    logger.error('Upload event photo error:', error.message);
    res.status(500).json({ message: 'Error uploading event photo' });
  }
});

// POST /api/admin/events
router.post('/events', auth, checkAdmin, async (req, res) => {
  try {
    const fields = pickEventFields(req.body || {});
    const problem = eventProblem(fields);
    if (problem) {
      return res.status(400).json({ message: problem });
    }

    const event = await Event.create({
      ...fields,
      created_by: req.userId
    });

    // Tell members about the new event - those who want event notices, and
    // not for a hidden draft. (This used to notify everybody regardless of
    // their setting, including deleted accounts.)
    if (!event.is_hidden) {
      const allUsers = await User.find({
        _id: { $ne: req.userId },
        is_banned: { $ne: true },
        is_deleted: { $ne: true }
      }).select('_id');
      const optedOut = await UserNotificationSettings.find({ events: false }).select('user_id');
      const optedOutIds = new Set(optedOut.map(s => s.user_id));
      const recipients = allUsers.filter(u => !optedOutIds.has(u._id.toString()));
      const notifications = recipients.map(user => ({
        user_id: user._id,
        type: 'event',
        title: 'New Event!',
        message: `Check out the new event: ${event.title}`,
        avatar: event.image || '',
        related_event: event._id
      }));

      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
        pingUsers(req, recipients.map(u => u._id), 'event');
      }
    }

    res.status(201).json({
      id: event._id,
      ...event.toObject()
    });
  } catch (error) {
    logger.error('Create event error:', error.message);
    res.status(500).json({ message: 'Error creating event' });
  }
});

// PUT /api/admin/events/:eventId
router.put('/events/:eventId', auth, checkAdmin, async (req, res) => {
  try {
    const fields = pickEventFields(req.body || {});
    const problem = eventProblem(fields, { partial: true });
    if (problem) {
      return res.status(400).json({ message: problem });
    }

    // An empty value means "clear this": no end time, no limit on places, no
    // photo. (These used to be ignored, so an end time or a photo could never
    // be removed from an event once set.)
    const unset = {};
    for (const key of ['end_date', 'max_attendees', 'image']) {
      if (req.body?.[key] === '' || req.body?.[key] === null) {
        unset[key] = 1;
        delete fields[key];
      }
    }
    for (const key of Object.keys(fields)) {
      if (fields[key] === undefined) delete fields[key];
    }
    // The end must still come after the start when only one of them changes.
    if ((fields.start_date || fields.end_date) && !unset.end_date) {
      const current = await Event.findById(req.params.eventId).select('start_date end_date');
      if (!current) {
        return res.status(404).json({ message: 'Event not found' });
      }
      const start = new Date(fields.start_date || current.start_date);
      const end = fields.end_date ? new Date(fields.end_date) : current.end_date;
      if (end && end < start) {
        return res.status(400).json({ message: 'The event cannot end before it starts.' });
      }
    }

    const update = {};
    if (Object.keys(fields).length > 0) update.$set = fields;
    if (Object.keys(unset).length > 0) update.$unset = unset;

    const event = await Event.findByIdAndUpdate(
      req.params.eventId,
      update,
      { new: true, runValidators: true }
    );

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    res.json({ id: event._id, ...event.toObject() });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ message: 'Error updating event' });
  }
});

// PUT /api/admin/events/:eventId/toggle-visibility - hide or show an event
router.put('/events/:eventId/toggle-visibility', auth, checkAdmin, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    event.is_hidden = !event.is_hidden;
    await event.save();
    res.json({ success: true, is_hidden: event.is_hidden });
  } catch (error) {
    logger.error('Toggle event visibility error:', error.message);
    res.status(500).json({ message: 'Error updating event' });
  }
});

// PUT /api/admin/events/:eventId/cancel
router.put('/events/:eventId/cancel', auth, checkAdmin, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    event.is_cancelled = true;
    event.cancelled_at = new Date();
    await event.save();

    // Notify attendees who want event notifications
    for (const attendeeId of event.attendees) {
      if (await shouldCreateNotification(attendeeId, 'event')) {
        await Notification.create({
          user_id: attendeeId,
          type: 'event',
          title: 'Event Cancelled',
          message: `The event "${event.title}" has been cancelled.`,
          related_event: event._id
        });
        pingUsers(req, [attendeeId], 'event');
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Cancel event error:', error);
    res.status(500).json({ message: 'Error cancelling event' });
  }
});

// PUT /api/admin/events/:eventId/uncancel - Reinstate a cancelled event
router.put('/events/:eventId/uncancel', auth, checkAdmin, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    event.is_cancelled = false;
    event.cancelled_at = null;
    await event.save();

    for (const attendeeId of event.attendees) {
      if (await shouldCreateNotification(attendeeId, 'event')) {
        await Notification.create({
          user_id: attendeeId,
          type: 'event',
          title: 'Event Back On',
          message: `The event "${event.title}" is no longer cancelled.`,
          related_event: event._id
        });
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Uncancel event error:', error);
    res.status(500).json({ message: 'Error reinstating event' });
  }
});

// GET /api/admin/events/:eventId/attendees - Who has RSVP'd
router.get('/events/:eventId/attendees', auth, checkAdmin, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const users = await User.find({ _id: { $in: event.attendees || [] } })
      .select('first_name last_name email');

    const profiles = await Profile.find({ user_id: { $in: users.map(u => u._id.toString()) } })
      .select('user_id photos profile_picture_url');

    const photoByUser = new Map(
      profiles.map(p => [
        p.user_id.toString(),
        p.profile_picture_url || p.photos?.[0] || null
      ])
    );

    res.json(
      users.map(u => ({
        id: u._id,
        first_name: u.first_name,
        last_name: u.last_name,
        email: u.email,
        note: event.rsvp_notes?.get(u._id.toString()) || '',
        photo: photoByUser.get(u._id.toString()) || null
      }))
    );
  } catch (error) {
    console.error('Get event attendees error:', error);
    res.status(500).json({ message: 'Error fetching attendees' });
  }
});

// DELETE /api/admin/events/:eventId
router.delete('/events/:eventId', auth, checkAdmin, async (req, res) => {
  try {
    const result = await Event.deleteOne({ _id: req.params.eventId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ message: 'Error deleting event' });
  }
});

// News/Announcements
// POST /api/admin/news
router.post('/news', auth, checkAdmin, async (req, res) => {
  try {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 150) : '';
    const message = typeof req.body?.message === 'string' ? req.body.message.trim().slice(0, 2000) : '';
    if (!message) {
      return res.status(400).json({ message: 'Please write the announcement first.' });
    }

    // Get all active users ($ne: true also matches older accounts where the
    // flag was never written)
    const users = await User.find({
      is_banned: { $ne: true },
      is_suspended: { $ne: true },
      is_deleted: { $ne: true }
    }).select('_id');

    // Filter users who want admin news notifications
    const usersWhoWantNews = [];
    for (const user of users) {
      if (await shouldCreateNotification(user._id, 'news')) {
        usersWhoWantNews.push(user._id);
      }
    }

    // Create notification for users who want them
    const notifications = usersWhoWantNews.map(userId => ({
      user_id: userId,
      type: 'news',
      title: title || 'D8-LPA News',
      message,
      avatar: null
    }));

    // Stamp every copy with a shared batch id so the announcement can be
    // listed and withdrawn as a single item afterwards.
    const batchId = new mongoose.Types.ObjectId().toString();
    await Notification.insertMany(
      notifications.map((n) => ({ ...n, announcement_id: batchId }))
    );

    pingUsers(req, usersWhoWantNews, 'news');

    res.json({
      success: true,
      id: batchId,
      title: title || 'D8-LPA News',
      message,
      created_at: new Date().toISOString(),
      sent_to: usersWhoWantNews.length
    });
  } catch (error) {
    console.error('Send news error:', error);
    res.status(500).json({ message: 'Error sending news' });
  }
});

// GET /api/admin/news - List announcements that have been sent
router.get('/news', auth, checkAdmin, async (req, res) => {
  try {
    // One document per announcement batch, newest first.
    const announcements = await Notification.aggregate([
      { $match: { type: 'news', announcement_id: { $ne: null } } },
      {
        $group: {
          _id: '$announcement_id',
          title: { $first: '$title' },
          message: { $first: '$message' },
          // The schema stamps creation time as `timestamp`, not `created_at`.
          created_at: { $first: '$timestamp' },
          sent_to: { $sum: 1 }
        }
      },
      { $sort: { created_at: -1 } },
      { $limit: 50 }
    ]);

    res.json(
      announcements.map((a) => ({
        id: a._id,
        title: a.title,
        message: a.message,
        created_at: a.created_at,
        sent_to: a.sent_to
      }))
    );
  } catch (error) {
    console.error('List news error:', error);
    res.status(500).json({ message: 'Error fetching announcements' });
  }
});

// DELETE /api/admin/news?id=... - Withdraw an announcement from every inbox
router.delete('/news', auth, checkAdmin, async (req, res) => {
  try {
    const { id } = req.query;
    if (typeof id !== 'string' || !id) {
      return res.status(400).json({ message: 'Announcement id is required' });
    }

    const result = await Notification.deleteMany({
      type: 'news',
      announcement_id: id
    });

    res.json({ success: true, removed: result.deletedCount });
  } catch (error) {
    console.error('Delete news error:', error);
    res.status(500).json({ message: 'Error deleting announcement' });
  }
});

// Reports
// GET /api/admin/reports
router.get('/reports', auth, checkAdmin, async (req, res) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : 'pending';
    const query = status === 'all' ? {} : { status };

    const reports = await Report.find(query).sort({ created_at: -1 }).limit(200);

    // reporter / reported_user are plain id strings, so .populate() never
    // filled them in and the admin saw ids instead of people.
    const ids = [...new Set(reports.flatMap(r => [r.reporter, r.reported_user]))]
      .filter(id => /^[a-f0-9]{24}$/i.test(id));
    const users = await User.find({ _id: { $in: ids } })
      .select('first_name last_name email is_banned is_suspended warnings');
    const usersById = new Map(users.map(u => [u._id.toString(), u]));
    const person = (id) => {
      const u = usersById.get(String(id));
      return u
        ? { id: u._id, first_name: u.first_name, last_name: u.last_name, email: u.email,
            is_banned: u.is_banned, is_suspended: u.is_suspended, warnings: u.warnings }
        : { id, first_name: 'Deleted', last_name: 'account', email: '' };
    };

    res.json(reports.map(r => ({
      id: r._id,
      _id: r._id,
      reporter: person(r.reporter),
      reported_user: person(r.reported_user),
      reason: r.reason,
      category: r.category || '',
      source: r.source || '',
      match_id: r.match_id || null,
      status: r.status,
      action_taken: r.action_taken,
      reviewed_at: r.reviewed_at,
      created_at: r.created_at
    })));
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ message: 'Error fetching reports' });
  }
});

// PUT /api/admin/reports/:reportId
router.put('/reports/:reportId', auth, checkAdmin, async (req, res) => {
  try {
    const { status, action_taken } = req.body || {};
    if (!['pending', 'reviewed', 'resolved', 'dismissed'].includes(status)) {
      return res.status(400).json({ message: 'Please choose a valid status.' });
    }
    if (action_taken !== undefined && !['none', 'warning', 'suspension', 'ban'].includes(action_taken)) {
      return res.status(400).json({ message: 'Please choose a valid action.' });
    }

    const report = await Report.findByIdAndUpdate(
      req.params.reportId,
      {
        status,
        ...(action_taken !== undefined ? { action_taken } : {}),
        reviewed_by: req.userId,
        reviewed_at: new Date()
      },
      { new: true }
    );

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    res.json(report);
  } catch (error) {
    console.error('Update report error:', error);
    res.status(500).json({ message: 'Error updating report' });
  }
});

// Stats
// GET /api/admin/stats
router.get('/stats', auth, checkAdmin, async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      bannedUsers,
      totalEvents,
      upcomingEvents,
      pendingReports
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: 'active' }),
      User.countDocuments({ is_suspended: true }),
      User.countDocuments({ is_banned: true }),
      Event.countDocuments(),
      Event.countDocuments({ start_date: { $gte: new Date() }, is_cancelled: { $ne: true } }),
      Report.countDocuments({ status: 'pending' })
    ]);

    res.json({
      users: {
        total: totalUsers,
        active: activeUsers,
        suspended: suspendedUsers,
        banned: bannedUsers
      },
      events: {
        total: totalEvents,
        upcoming: upcomingEvents
      },
      reports: {
        pending: pendingReports
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Error fetching stats' });
  }
});

export default router;
