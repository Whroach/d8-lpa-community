import express from 'express';
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { auth, adminAuth } from '../middleware/auth.js';
import User from '../models/User.js';
import Profile from '../models/Profile.js';
import Event from '../models/Event.js';
import Report from '../models/Report.js';
import Notification from '../models/Notification.js';
import UserNotificationSettings from '../models/UserNotificationSettings.js';
import logger from '../utils/logger.js';

// Load environment variables from root .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootEnvPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: rootEnvPath });

const AWS_REGION = process.env.AWS_REGION;
const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;
const NODE_ENV = process.env.NODE_ENV || 'production';
const ENVIRONMENT_FOLDER = NODE_ENV === 'development' ? 'development' : 'production';

const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

const router = express.Router();

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

// POST /api/admin/users/:userId/action - Generic action endpoint
router.post('/users/:userId/action', auth, checkAdmin, async (req, res) => {
  try {
    const { action, message } = req.body;
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
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

    res.json({ success: true });
  } catch (error) {
    console.error('User action error:', error);
    res.status(500).json({ message: 'Error performing user action' });
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
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${ENVIRONMENT_FOLDER}/events/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;

    logger.log('[UPLOAD] Starting event photo upload:', { fileName });

    // Upload to S3
    const uploadParams = {
      Bucket: BUCKET_NAME,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    await s3Client.send(new PutObjectCommand(uploadParams));
    
    const photoUrl = `https://${BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${fileName}`;
    
    logger.log('[UPLOAD] Event photo uploaded to S3:', { photoUrl });

    res.json({ url: photoUrl });
  } catch (error) {
    logger.error('Upload event photo error:', error.message);
    res.status(500).json({ message: 'Error uploading event photo' });
  }
});

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

    // Create notifications for all users about the new event
    const allUsers = await User.find({ _id: { $ne: req.userId }, is_banned: false }).select('_id');
    const notifications = allUsers.map(user => ({
      user_id: user._id,
      type: 'event',
      title: 'New Event!',
      message: `Check out the new event: ${event.title}`,
      avatar: event.image || '',
      related_event: event._id
    }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }

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
