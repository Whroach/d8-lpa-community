import '../config/env.js';
import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { auth } from '../middleware/auth.js';
import User from '../models/User.js';
import Profile from '../models/Profile.js';
import Event from '../models/Event.js';
import Report from '../models/Report.js';
import ModerationAction, { MODERATION_ACTIONS } from '../models/ModerationAction.js';
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

// What each member filter means. These use the flags the sign-in check uses
// (is_suspended / is_banned), so the list always agrees with who can sign in.
const MEMBER_FILTERS = {
  active: { is_banned: { $ne: true }, is_suspended: { $ne: true }, warnings: { $not: { $gt: 0 } } },
  warned: { is_banned: { $ne: true }, is_suspended: { $ne: true }, warnings: { $gt: 0 } },
  suspended: { is_suspended: true },
  banned: { is_banned: true }
};

// A search box value turned into a query: every word must appear in the first
// name, last name or email address. Typed text is never treated as a pattern.
function memberSearch(text) {
  const words = String(text).trim().slice(0, 100).split(/\s+/).filter(Boolean).slice(0, 5);
  if (words.length === 0) return null;
  if (words.length === 1 && /^[a-f0-9]{24}$/i.test(words[0])) {
    return { _id: words[0] };
  }
  return {
    $and: words.map((word) => {
      const pattern = escapeRegex(word);
      return {
        $or: [
          { first_name: { $regex: pattern, $options: 'i' } },
          { last_name: { $regex: pattern, $options: 'i' } },
          { email: { $regex: pattern, $options: 'i' } }
        ]
      };
    })
  };
}

const pageNumber = (value) => Math.max(1, parseInt(value) || 1);

// GET /api/admin/users?page=&limit=&q=&status=
//   q (or the older name, search): words to look for in names and emails
//   status: all | active | warned | suspended | banned
// Without page/limit it answers as it always did (first 500, newest first).
router.get('/users', auth, checkAdmin, async (req, res) => {
  try {
    const { status, page = 1, limit = 500 } = req.query;
    const search = typeof req.query.q === 'string' ? req.query.q : req.query.search;
    const pageSize = Math.min(1000, Math.max(1, parseInt(limit) || 500));

    const query = {};

    if (typeof status === 'string' && status !== 'all') {
      if (!MEMBER_FILTERS[status]) {
        return res.status(400).json({ message: 'Please choose a valid filter.' });
      }
      Object.assign(query, MEMBER_FILTERS[status]);
    }

    if (typeof search === 'string' && search.trim()) {
      Object.assign(query, memberSearch(search));
    }

    const [total, all, active, warned, suspended, banned] = await Promise.all([
      User.countDocuments(query),
      User.countDocuments(),
      User.countDocuments(MEMBER_FILTERS.active),
      User.countDocuments(MEMBER_FILTERS.warned),
      User.countDocuments(MEMBER_FILTERS.suspended),
      User.countDocuments(MEMBER_FILTERS.banned)
    ]);

    // Asking for a page past the end (the last member on it was just moved by
    // an action) gives the last page rather than an empty one.
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(pageNumber(page), totalPages);

    const users = await User.find(query)
      .sort({ created_at: -1, _id: -1 })
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize);

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
        notes_count: (u.admin_notes || []).length,
        moderation_history: (u.moderation_history || []).map(h => ({
          id: h._id,
          action: h.action,
          reason: h.reason,
          admin: h.admin,
          report_id: h.report_id || null,
          created_at: h.created_at
        }))
      })),
      total,
      page: currentPage,
      totalPages,
      // Whole-community numbers for the filter buttons (not just this page).
      counts: { all, active, warned, suspended, banned }
    });
  } catch (error) {
    logger.error('Admin get users error:', error.message);
    res.status(500).json({ message: 'Error fetching users' });
  }
});

// ---------------------------------------------------------------------------
// Moderation: warn / suspend / ban and lifting them again.
// Every route below goes through moderate(), so each decision is checked the
// same way, takes effect the same way and is written to the activity log.
// ---------------------------------------------------------------------------

const ACTIONS = ['warn', 'suspend', 'unsuspend', 'ban', 'unban', 'remove_warning'];
// A suspension or a ban locks a member out, so the admin has to say why.
const REASON_REQUIRED = ['suspend', 'ban'];
const REPORT_OUTCOME = { warn: 'warning', suspend: 'suspension', ban: 'ban' };
const NOTICE = {
  warn: ['Account Warning', 'Your account has received a warning for violating our community guidelines.'],
  suspend: ['Account Suspended', 'Your account has been suspended for violating our community guidelines.'],
  ban: ['Account Banned', 'Your account has been permanently banned.']
};

// The reason arrives as `message` (action route) or `reason` (older routes).
function reasonFrom(body) {
  const raw = [body?.message, body?.reason].find((value) => typeof value === 'string' && value.trim());
  return raw ? raw.trim().slice(0, 1000) : '';
}

async function logModeration(req, { action, user, reason = '', reportId = null }) {
  return ModerationAction.create({
    action,
    target_user: String(user?._id ?? user?.id ?? ''),
    target_name: `${user?.first_name || ''} ${user?.last_name || ''}`.trim(),
    target_email: user?.email || '',
    admin_id: String(req.userId),
    admin_name: `${req.user?.first_name || ''} ${req.user?.last_name || ''}`.trim(),
    admin_email: req.user?.email || '',
    reason,
    report_id: reportId
  });
}

/**
 * Carries out one moderation action. Returns { status, body } for a refusal,
 * or { user, entry } when it was done.
 */
async function moderate(req, { userId, action, reason, reportId = null, reopenReport = false }) {
  if (!ACTIONS.includes(action)) {
    return { status: 400, body: { message: 'Invalid action' } };
  }
  const user = await User.findById(userId);
  if (!user) {
    return { status: 404, body: { message: 'User not found' } };
  }

  // An admin can't suspend or ban themselves (and lock the panel), or act
  // against another admin from here.
  if (['warn', 'suspend', 'ban'].includes(action) && (user.role === 'admin' || user._id.toString() === req.userId.toString())) {
    return { status: 400, body: { message: 'This action cannot be used on an admin account.' } };
  }
  if (REASON_REQUIRED.includes(action) && !reason) {
    return {
      status: 400,
      body: { message: `Please give a reason for the ${action === 'ban' ? 'ban' : 'suspension'}. It is kept in the activity log.` }
    };
  }

  let report = null;
  if (reportId) {
    report = /^[a-f0-9]{24}$/i.test(String(reportId)) ? await Report.findById(reportId) : null;
    if (!report || String(report.reported_user) !== user._id.toString()) {
      return { status: 400, body: { message: 'That report is not about this member.' } };
    }
  }

  switch (action) {
    case 'warn':
      user.warnings = (user.warnings || 0) + 1;
      if (!user.is_banned && !user.is_suspended) user.status = 'warned';
      break;
    case 'suspend':
      user.is_suspended = true;
      user.status = user.is_banned ? 'banned' : 'suspended';
      break;
    case 'unsuspend':
      user.is_suspended = false;
      user.status = user.is_banned ? 'banned' : (user.warnings > 0 ? 'warned' : 'active');
      break;
    case 'ban':
      user.is_banned = true;
      user.status = 'banned';
      break;
    case 'unban':
      user.is_banned = false;
      user.status = user.is_suspended ? 'suspended' : (user.warnings > 0 ? 'warned' : 'active');
      break;
    case 'remove_warning':
      user.warnings = Math.max(0, (user.warnings || 1) - 1);
      user.status = user.is_banned ? 'banned' : (user.is_suspended ? 'suspended' : (user.warnings > 0 ? 'warned' : 'active'));
      break;
  }

  // Record the action so the admin panel's History shows a real audit trail.
  user.moderation_history = user.moderation_history || [];
  user.moderation_history.push({
    action,
    reason,
    admin: req.user?.email || 'admin',
    ...(report ? { report_id: report._id.toString() } : {}),
    created_at: new Date()
  });
  await user.save();

  if (NOTICE[action]) {
    await Notification.create({
      user_id: user._id,
      type: 'system',
      title: NOTICE[action][0],
      message: reason || NOTICE[action][1]
    });
  }

  // A suspended or banned member is signed out of live chat immediately.
  if (action === 'suspend' || action === 'ban') {
    req.app.get('io')?.in(user._id.toString()).disconnectSockets(true);
  } else if (action === 'warn') {
    pingUsers(req, [user._id], 'system');
  }

  // The report this answered is closed with the outcome - or, when an admin
  // undoes the action straight away, put back in the queue.
  if (report && REPORT_OUTCOME[action]) {
    report.status = 'resolved';
    report.action_taken = REPORT_OUTCOME[action];
    report.reviewed_by = String(req.userId);
    report.reviewed_at = new Date();
    await report.save();
  } else if (report && reopenReport) {
    report.status = 'pending';
    report.action_taken = 'none';
    await report.save();
  }

  const entry = await logModeration(req, { action, user, reason, reportId: report ? report._id.toString() : null });
  return { user, entry };
}

// The older one-purpose routes. They keep their addresses and answers, and now
// follow the same rules as the action route (reason needed to suspend or ban,
// never on an admin, recorded in the activity log).
const legacyRoute = (action, extra = () => ({})) => async (req, res) => {
  try {
    const done = await moderate(req, { userId: req.params.userId, action, reason: reasonFrom(req.body) });
    if (done.status) {
      return res.status(done.status).json(done.body);
    }
    res.json({ success: true, ...extra(done.user) });
  } catch (error) {
    logger.error(`Admin ${action} error:`, error.message);
    res.status(500).json({ message: 'Error performing user action' });
  }
};

// PUT /api/admin/users/:userId/warn
router.put('/users/:userId/warn', auth, checkAdmin, notOnAdmins, legacyRoute('warn', (user) => ({ warnings: user.warnings })));
// PUT /api/admin/users/:userId/suspend
router.put('/users/:userId/suspend', auth, checkAdmin, notOnAdmins, legacyRoute('suspend'));
// PUT /api/admin/users/:userId/unsuspend
router.put('/users/:userId/unsuspend', auth, checkAdmin, legacyRoute('unsuspend'));
// PUT /api/admin/users/:userId/ban
router.put('/users/:userId/ban', auth, checkAdmin, notOnAdmins, legacyRoute('ban'));
// PUT /api/admin/users/:userId/unban
router.put('/users/:userId/unban', auth, checkAdmin, legacyRoute('unban'));

// POST /api/admin/users/:userId/action
//   { action, message, report_id?, reopen_report? }
// `message` is the reason. It is required for suspend and ban. With report_id
// the report is closed with the outcome in the same step; with reopen_report
// (used by Undo) it goes back in the queue.
router.post('/users/:userId/action', auth, checkAdmin, async (req, res) => {
  try {
    const done = await moderate(req, {
      userId: req.params.userId,
      action: req.body?.action,
      reason: reasonFrom(req.body),
      reportId: req.body?.report_id || null,
      reopenReport: req.body?.reopen_report === true
    });
    if (done.status) {
      return res.status(done.status).json(done.body);
    }
    const { user, entry } = done;
    res.json({
      success: true,
      action_id: entry._id,
      user: {
        id: user._id,
        warnings: user.warnings,
        is_suspended: user.is_suspended,
        is_banned: user.is_banned,
        status: user.status
      },
      moderation_history: user.moderation_history
    });
  } catch (error) {
    logger.error('User action error:', error.message);
    res.status(500).json({ message: 'Error performing user action' });
  }
});

// GET /api/admin/audit-log?page=&limit=&q=&action=&user_id=
// The activity log, newest first: who did what to whom, when and why.
router.get('/audit-log', auth, checkAdmin, async (req, res) => {
  try {
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
    const query = {};
    if (typeof req.query.action === 'string' && req.query.action !== 'all') {
      if (!MODERATION_ACTIONS.includes(req.query.action)) {
        return res.status(400).json({ message: 'Please choose a valid action.' });
      }
      query.action = req.query.action;
    }
    if (typeof req.query.user_id === 'string' && req.query.user_id) {
      query.target_user = req.query.user_id;
    }
    if (typeof req.query.q === 'string' && req.query.q.trim()) {
      const pattern = escapeRegex(req.query.q.trim().slice(0, 100));
      query.$or = ['target_name', 'target_email', 'admin_name', 'admin_email', 'reason']
        .map((field) => ({ [field]: { $regex: pattern, $options: 'i' } }));
    }

    const total = await ModerationAction.countDocuments(query);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(pageNumber(req.query.page), totalPages);
    const entries = await ModerationAction.find(query)
      .sort({ created_at: -1, _id: -1 })
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize);

    res.json({
      entries: entries.map((e) => ({
        id: e._id,
        action: e.action,
        target: { id: e.target_user, name: e.target_name, email: e.target_email },
        admin: { id: e.admin_id, name: e.admin_name, email: e.admin_email },
        reason: e.reason,
        report_id: e.report_id,
        created_at: e.created_at
      })),
      total,
      page: currentPage,
      totalPages
    });
  } catch (error) {
    logger.error('Audit log error:', error.message);
    res.status(500).json({ message: 'Error fetching the activity log' });
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
const REPORT_STATUSES = ['pending', 'reviewed', 'resolved', 'dismissed'];
const isObjectId = (id) => /^[a-f0-9]{24}$/i.test(String(id));

// GET /api/admin/reports?status=&page=&limit=&q=
//   status: pending (default) | reviewed | resolved | dismissed | all
//   q: words to look for in either person's name or email, or in the report
// Without `page` it answers as it always did: a plain list of up to 200.
// With `page` it answers { reports, total, page, totalPages, counts }.
router.get('/reports', auth, checkAdmin, async (req, res) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : 'pending';
    const query = status === 'all' ? {} : { status };
    const paged = req.query.page !== undefined;

    if (typeof req.query.q === 'string' && req.query.q.trim()) {
      const text = req.query.q.trim().slice(0, 100);
      const pattern = escapeRegex(text);
      const people = await User.find(memberSearch(text)).select('_id').limit(500);
      const ids = people.map((u) => u._id.toString());
      query.$or = [
        { reported_user: { $in: ids } },
        { reporter: { $in: ids } },
        { reason: { $regex: pattern, $options: 'i' } },
        { category: { $regex: pattern, $options: 'i' } }
      ];
    }

    let reports;
    let envelope = null;
    if (paged) {
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
      const [total, pending, resolved, dismissed, all] = await Promise.all([
        Report.countDocuments(query),
        Report.countDocuments({ status: 'pending' }),
        Report.countDocuments({ status: 'resolved' }),
        Report.countDocuments({ status: 'dismissed' }),
        Report.countDocuments()
      ]);
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const currentPage = Math.min(pageNumber(req.query.page), totalPages);
      reports = await Report.find(query)
        .sort({ created_at: -1, _id: -1 })
        .skip((currentPage - 1) * pageSize)
        .limit(pageSize);
      envelope = { total, page: currentPage, totalPages, counts: { pending, resolved, dismissed, all } };
    } else {
      reports = await Report.find(query).sort({ created_at: -1 }).limit(200);
    }

    // reporter / reported_user are plain id strings, so .populate() never
    // filled them in and the admin saw ids instead of people.
    const ids = [...new Set(reports.flatMap(r => [r.reporter, r.reported_user]))].filter(isObjectId);
    const users = await User.find({ _id: { $in: ids } })
      .select('first_name last_name email role is_banned is_suspended warnings');
    const usersById = new Map(users.map(u => [u._id.toString(), u]));
    const person = (id) => {
      const u = usersById.get(String(id));
      return u
        ? { id: u._id, first_name: u.first_name, last_name: u.last_name, email: u.email, role: u.role,
            is_banned: u.is_banned, is_suspended: u.is_suspended, warnings: u.warnings }
        : { id, first_name: 'Deleted', last_name: 'account', email: '', is_deleted: true };
    };

    const rows = reports.map(r => ({
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
    }));

    res.json(envelope ? { reports: rows, ...envelope } : rows);
  } catch (error) {
    logger.error('Get reports error:', error.message);
    res.status(500).json({ message: 'Error fetching reports' });
  }
});

// PUT /api/admin/reports/:reportId
router.put('/reports/:reportId', auth, checkAdmin, async (req, res) => {
  try {
    const { status, action_taken } = req.body || {};
    if (!REPORT_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Please choose a valid status.' });
    }
    if (action_taken !== undefined && !['none', 'warning', 'suspension', 'ban'].includes(action_taken)) {
      return res.status(400).json({ message: 'Please choose a valid action.' });
    }

    const before = await Report.findById(req.params.reportId).select('status');
    if (!before) {
      return res.status(404).json({ message: 'Report not found' });
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

    // Dismissing a report, or putting one back in the queue, is a decision
    // too, so it goes in the activity log. (Closing a report with a warning,
    // suspension or ban is logged by that action.)
    const logged = status === 'dismissed' && before.status !== 'dismissed'
      ? 'dismiss_report'
      : status === 'pending' && before.status !== 'pending' ? 'reopen_report' : null;
    if (logged) {
      const reported = isObjectId(report.reported_user)
        ? await User.findById(report.reported_user).select('first_name last_name email')
        : null;
      await logModeration(req, {
        action: logged,
        user: reported || { _id: report.reported_user, first_name: 'Deleted', last_name: 'account' },
        reason: reasonFrom(req.body),
        reportId: report._id.toString()
      });
    }

    res.json(report);
  } catch (error) {
    logger.error('Update report error:', error.message);
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
