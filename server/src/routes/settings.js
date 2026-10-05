import express from 'express';
import { auth } from '../middleware/auth.js';
import User from '../models/User.js';
import Profile from '../models/Profile.js';
import UserNotificationSettings from '../models/UserNotificationSettings.js';
import UserPrivacySettings from '../models/UserPrivacySettings.js';
import logger from '../utils/logger.js';

const router = express.Router();

// GET /api/settings - Get user settings
router.get('/', auth, async (req, res) => {
  try {
    // Get profile to retrieve looking_for_gender
    const profile = await Profile.findOne({ user_id: req.userId });

    // Get or create notification settings
    let notificationSettings = await UserNotificationSettings.findOne({ user_id: req.userId });
    if (!notificationSettings) {
      notificationSettings = await UserNotificationSettings.create({ user_id: req.userId });
    }

    // Get or create privacy settings
    let privacySettings = await UserPrivacySettings.findOne({ user_id: req.userId });
    if (!privacySettings) {
      privacySettings = await UserPrivacySettings.create({ user_id: req.userId });
    }

    res.json({
      lookingFor: profile?.looking_for_gender || [],
      agePreferenceMin: profile?.age_preference_min ?? 18,
      agePreferenceMax: profile?.age_preference_max ?? 100,
      notifications: {
        matches: notificationSettings.matches,
        messages: notificationSettings.messages,
        likes: notificationSettings.likes,
        events: notificationSettings.events,
        admin_news: notificationSettings.admin_news,
        // Older documents predate this field; default it on rather than
        // letting `undefined` read as "sound off".
        sound: notificationSettings.sound !== false,
        quiet_hours_enabled: Boolean(notificationSettings.quiet_hours_enabled),
        quiet_hours_start: notificationSettings.quiet_hours_start || '21:00',
        quiet_hours_end: notificationSettings.quiet_hours_end || '08:00',
        email_digest: Boolean(notificationSettings.email_digest),
      },
      privacy: {
        profileVisible: privacySettings.profile_visible,
        selectiveMode: privacySettings.selective_mode,
        showOnline: privacySettings.show_online !== false,
        readReceipts: privacySettings.read_receipts !== false,
      },
    });
  } catch (error) {
    logger.error('Get settings error:', error.message);
    res.status(500).json({ message: 'Error fetching settings' });
  }
});

// PUT /api/settings - Update user settings
router.put('/', auth, async (req, res) => {
  try {
    const { lookingFor, notifications, privacy, agePreferenceMin, agePreferenceMax } = req.body;

    // Update the Profile-backed preferences (who you want to see in Browse)
    const hasAgeRange = agePreferenceMin !== undefined || agePreferenceMax !== undefined;
    if (Array.isArray(lookingFor) || hasAgeRange) {
      let profile = await Profile.findOne({ user_id: req.userId });
      if (!profile) {
        profile = new Profile({ user_id: req.userId });
      }
      if (Array.isArray(lookingFor)) {
        const allowed = ['male', 'female', 'non_binary', 'everyone'];
        profile.looking_for_gender = lookingFor.filter(value => allowed.includes(value));
      }
      if (hasAgeRange) {
        // Clamp to a sane range and keep min <= max so Browse can't be
        // filtered into returning nothing.
        const min = Math.min(120, Math.max(18, Number(agePreferenceMin) || 18));
        const max = Math.min(120, Math.max(18, Number(agePreferenceMax) || 100));
        profile.age_preference_min = Math.min(min, max);
        profile.age_preference_max = Math.max(min, max);
      }
      await profile.save();
      logger.log('[SETTINGS] Updated profile preferences for user:', req.userId);
    }

    // Update notification settings. Only the keys the client actually sent are
    // written, so a partial body can't silently reset the toggles it omitted —
    // and a missing `notifications` object no longer throws.
    if (notifications && typeof notifications === 'object') {
      const notificationUpdate = { updated_at: new Date() };
      for (const key of ['matches', 'messages', 'likes', 'events', 'admin_news', 'sound', 'quiet_hours_enabled', 'email_digest']) {
        if (notifications[key] !== undefined) {
          notificationUpdate[key] = Boolean(notifications[key]);
        }
      }
      for (const key of ['quiet_hours_start', 'quiet_hours_end']) {
        if (notifications[key] !== undefined) {
          if (typeof notifications[key] !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(notifications[key])) {
            return res.status(400).json({ message: 'Please choose a valid time for quiet hours.' });
          }
          notificationUpdate[key] = notifications[key];
        }
      }
      await UserNotificationSettings.findOneAndUpdate(
        { user_id: req.userId },
        notificationUpdate,
        { upsert: true, new: true }
      );
    }

    // Update privacy settings (same partial-body guard as above)
    if (privacy && typeof privacy === 'object') {
      const privacyUpdate = { updated_at: new Date() };
      if (privacy.profileVisible !== undefined) {
        privacyUpdate.profile_visible = Boolean(privacy.profileVisible);
      }
      if (privacy.selectiveMode !== undefined) {
        privacyUpdate.selective_mode = Boolean(privacy.selectiveMode);
      }
      if (privacy.showOnline !== undefined) {
        privacyUpdate.show_online = Boolean(privacy.showOnline);
      }
      if (privacy.readReceipts !== undefined) {
        privacyUpdate.read_receipts = Boolean(privacy.readReceipts);
      }
      await UserPrivacySettings.findOneAndUpdate(
        { user_id: req.userId },
        privacyUpdate,
        { upsert: true, new: true }
      );
    }

    logger.log('[SETTINGS] Updated settings for user:', req.userId);

    res.json({
      lookingFor,
      agePreferenceMin,
      agePreferenceMax,
      notifications,
      privacy,
    });
  } catch (error) {
    logger.error('Update settings error:', error.message);
    res.status(500).json({ message: 'Error updating settings' });
  }
});

// POST /api/settings/disable - Disable user account
router.post('/disable', auth, async (req, res) => {
  try {
    const { reason, password } = req.body;

    if (typeof password !== 'string' || !password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    // Get user and verify password
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      // 400 rather than 401: the client treats 401 as "your session ended"
      // and would sign the member out over a mistyped password.
      return res.status(400).json({ message: 'That password is not right. Please try again.' });
    }

    // Disable account
    user.is_disabled = true;
    user.disabled_at = new Date();
    user.disable_reason = typeof reason === 'string' ? reason.slice(0, 500) : '';
    await user.save();

    res.json({
      success: true,
      message: 'Account disabled successfully'
    });
  } catch (error) {
    console.error('Disable account error:', error);
    res.status(500).json({ message: 'Error disabling account' });
  }
});

// POST /api/settings/delete - Delete user account (soft delete)
router.post('/delete', auth, async (req, res) => {
  try {
    const { reason, password } = req.body;

    if (typeof password !== 'string' || !password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    // Get user and verify password
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'That password is not right. Please try again.' });
    }

    // Soft delete account
    user.is_deleted = true;
    user.deleted_at = new Date();
    user.delete_reason = typeof reason === 'string' ? reason.slice(0, 500) : '';
    user.is_disabled = true; // Also disable the account
    await user.save();

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ message: 'Error deleting account' });
  }
});

export default router;
