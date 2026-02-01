import express from 'express';
import bcrypt from 'bcryptjs';
import { auth } from '../middleware/auth.js';
import User from '../models/User.js';
import UserNotificationSettings from '../models/UserNotificationSettings.js';
import UserPrivacySettings from '../models/UserPrivacySettings.js';

const router = express.Router();

// GET /api/settings - Get user settings
router.get('/', auth, async (req, res) => {
  try {
    // Get user to retrieve looking_for
    const user = await User.findById(req.userId);

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
      lookingFor: user?.looking_for || [],
      notifications: {
        matches: notificationSettings.matches,
        messages: notificationSettings.messages,
        likes: notificationSettings.likes,
        events: notificationSettings.events,
        admin_news: notificationSettings.admin_news,
      },
      privacy: {
        profileVisible: privacySettings.profile_visible,
        selectiveMode: privacySettings.selective_mode,
      },
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ message: 'Error fetching settings' });
  }
});

// PUT /api/settings - Update user settings
router.put('/', auth, async (req, res) => {
  try {
    const { lookingFor, notifications, privacy } = req.body;

    // Update looking_for on User model
    if (Array.isArray(lookingFor)) {
      await User.findByIdAndUpdate(
        req.userId,
        { looking_for: lookingFor },
        { new: true }
      );
    }

    // Update notification settings
    await UserNotificationSettings.findOneAndUpdate(
      { user_id: req.userId },
      {
        matches: notifications.matches,
        messages: notifications.messages,
        likes: notifications.likes,
        events: notifications.events,
        admin_news: notifications.admin_news,
        updated_at: new Date(),
      },
      { upsert: true, new: true }
    );

    // Update privacy settings
    await UserPrivacySettings.findOneAndUpdate(
      { user_id: req.userId },
      {
        profile_visible: privacy.profileVisible,
        selective_mode: privacy.selectiveMode,
        updated_at: new Date(),
      },
      { upsert: true, new: true }
    );

    res.json({
      lookingFor,
      notifications,
      privacy,
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ message: 'Error updating settings' });
  }
});

// POST /api/settings/disable - Disable user account
router.post('/disable', auth, async (req, res) => {
  try {
    const { reason, password } = req.body;

    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    // Get user and verify password
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    // Disable account
    user.is_disabled = true;
    user.disabled_at = new Date();
    user.disable_reason = reason || '';
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

    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    // Get user and verify password
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    // Soft delete account
    user.is_deleted = true;
    user.deleted_at = new Date();
    user.delete_reason = reason || '';
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
