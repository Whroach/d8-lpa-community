import express from 'express';
import { auth, adminAuth } from '../middleware/auth.js';
import User from '../models/User.js';
import Profile from '../models/Profile.js';
import Event from '../models/Event.js';
import Report from '../models/Report.js';
import Notification from '../models/Notification.js';
import UserNotificationSettings from '../models/UserNotificationSettings.js';

const router = express.Router();

// Admin code - Set this to your desired code
const ADMIN_CODE = process.env.ADMIN_CODE || "ljTQDzGP3477UeNrlQrdRjhG7";

// Helper function to check if user wants this type of notification
async function shouldCreateNotification(userId, notificationType) {
  const settings = await UserNotificationSettings.findOne({ user_id: userId });
  if (!settings) return true; // Default to enabled if no settings found
  
  const typeMap = {
    'match': 'matches',
    'message': 'messages',
    'like': 'likes',
    'event': 'events',
    'news': 'admin_news',
    'system': true // Always send system notifications
  };
  
  const settingField = typeMap[notificationType];
  return settingField === true || settings[settingField] !== false;
}

// Middleware to check admin role
const checkAdmin = async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// POST /api/admin/verify-code - Verify admin code (no auth required)
router.post('/verify-code', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ message: 'Admin code is required' });
    }

    if (code !== ADMIN_CODE) {
      return res.status(401).json({ message: 'Invalid admin code' });
    }

    res.json({ verified: true });
  } catch (error) {
    console.error('[ADMIN-VERIFY] Error verifying code:', error);
    res.status(500).json({ message: 'Error verifying code' });
  }
});

// GET /api/admin/users
router.get('/users', auth, checkAdmin, async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    
    const query = {};
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (search) {
      query.$or = [
        { first_name: { $regex: search, $options: 'i' } },
        { last_name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [users, total] = await Promise.all([
      User.find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query)
    ]);

    res.json({
      users: users.map(u => ({
        id: u._id,
        first_name: u.first_name,
        last_name: u.last_name,
        email: u.email,
        photos: u.photos,
        status: u.status,
        created_at: u.created_at,
        last_active: u.last_active,
        warnings: u.warnings,
        is_suspended: u.is_suspended,
        is_banned: u.is_banned
      })),
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('Admin get users error:', error);
    res.status(500).json({ message: 'Error fetching users' });
  }
});

// PUT /api/admin/users/:userId/warn
router.put('/users/:userId/warn', auth, checkAdmin, async (req, res) => {
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
router.put('/users/:userId/suspend', auth, checkAdmin, async (req, res) => {
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
router.put('/users/:userId/ban', auth, checkAdmin, async (req, res) => {
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

// Events management
// POST /api/admin/events
router.post('/events', auth, checkAdmin, async (req, res) => {
  try {
    const {
      title,
      description,
      image,
      start_date,
      end_date,
      location,
      category,
      max_attendees
    } = req.body;

    const event = await Event.create({
      title,
      description,
      image,
      start_date,
      end_date,
      location,
      category,
      max_attendees,
      created_by: req.userId
    });

    res.status(201).json({
      id: event._id,
      ...event.toObject()
    });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ message: 'Error creating event' });
  }
});

// PUT /api/admin/events/:eventId
router.put('/events/:eventId', auth, checkAdmin, async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(
      req.params.eventId,
      req.body,
      { new: true }
    );

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    res.json(event);
  } catch (error) {
    console.error('Update event error:', error);
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
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Cancel event error:', error);
    res.status(500).json({ message: 'Error cancelling event' });
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
    const { title, message } = req.body;

    // Get all active users
    const users = await User.find({ 
      is_banned: false, 
      is_suspended: false 
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

    await Notification.insertMany(notifications);

    res.json({ 
      success: true, 
      sent_to: usersWhoWantNews.length 
    });
  } catch (error) {
    console.error('Send news error:', error);
    res.status(500).json({ message: 'Error sending news' });
  }
});

// Reports
// GET /api/admin/reports
router.get('/reports', auth, checkAdmin, async (req, res) => {
  try {
    const { status = 'pending' } = req.query;
    
    const reports = await Report.find({ status })
      .populate('reporter', 'first_name last_name photos')
      .populate('reported_user', 'first_name last_name photos email')
      .sort({ created_at: -1 });

    res.json(reports);
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ message: 'Error fetching reports' });
  }
});

// PUT /api/admin/reports/:reportId
router.put('/reports/:reportId', auth, checkAdmin, async (req, res) => {
  try {
    const { status, action_taken } = req.body;

    const report = await Report.findByIdAndUpdate(
      req.params.reportId,
      {
        status,
        action_taken,
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
      Event.countDocuments({ start_date: { $gte: new Date() }, is_cancelled: false }),
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
