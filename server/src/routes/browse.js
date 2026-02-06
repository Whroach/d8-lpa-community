import express from 'express';
import { auth } from '../middleware/auth.js';
import User from '../models/User.js';
import Profile from '../models/Profile.js';
import Like from '../models/Like.js';
import Match from '../models/Match.js';
import Block from '../models/Block.js';
import Report from '../models/Report.js';
import Notification from '../models/Notification.js';
import ActionHistory from '../models/ActionHistory.js';
import logger from '../utils/logger.js';
import UserPrivacySettings from '../models/UserPrivacySettings.js';
import UserNotificationSettings from '../models/UserNotificationSettings.js';

const router = express.Router();

// Helper function to check if user wants this type of notification
async function shouldCreateNotification(userId, notificationType) {
  const settings = await UserNotificationSettings.findOne({ user_id: userId });
  if (!settings) return true; // Default to enabled if no settings found
  
  // Map notification types to settings fields
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

// GET /api/browse - Get profiles to browse
router.get('/', auth, async (req, res) => {
  try {
    const currentUser = req.user;
    const currentProfile = await Profile.findOne({ user_id: req.userId });

    // Determine gender preference - check both User.looking_for and Profile.looking_for_gender
    let genderPreference = [];
    if (currentUser.looking_for && currentUser.looking_for.length > 0) {
      genderPreference = currentUser.looking_for;
    } else if (currentProfile?.looking_for_gender && currentProfile.looking_for_gender.length > 0) {
      genderPreference = currentProfile.looking_for_gender;
    } else if (currentUser.gender) {
      // Default: show opposite gender if no preference is set
      genderPreference = currentUser.gender === 'male' ? ['female'] : ['male'];
    }

    logger.log('[BROWSE] Gender preference:', { 
      userGender: currentUser.gender,
      lookingFor: genderPreference,
      source: currentUser.looking_for?.length > 0 ? 'user_model' : 'profile_model'
    });

    // Get users the current user has already liked
    const likes = await Like.find({ from_user: req.userId });
    const likedUserIds = likes.map(i => i.to_user.toString());

    // Get blocked users (both directions)
    const blocks = await Block.find({
      $or: [{ blocker: req.userId }, { blocked: req.userId }]
    });
    const blockedUserIds = blocks.map(b => 
      b.blocker.toString() === req.userId.toString() ? b.blocked : b.blocker
    );

    // Build query for potential matches (exclude blocked and self, but include liked)
    const query = {
      _id: { 
        $nin: [...blockedUserIds, req.userId] 
      },
      onboarding_completed: true,
      is_banned: false,
      is_suspended: false,
      is_disabled: false,
      is_deleted: false,
      role: { $ne: 'admin' }
    };

    // Apply gender filter - handle "everyone" specially
    if (genderPreference.length > 0 && !genderPreference.includes('everyone')) {
      query.gender = { $in: genderPreference };
      logger.log('[BROWSE] Applied gender filter:', genderPreference);
    } else if (genderPreference.includes('everyone')) {
      logger.log('[BROWSE] User wants to see everyone - no gender filter applied');
    }

    // Get users
    const users = await User.find(query).limit(50);
    logger.log('[BROWSE] Found total matching users:', users.length);

    // Get privacy settings for filtering
    const allPrivacySettings = await UserPrivacySettings.find({});
    const privacySettingsMap = new Map(
      allPrivacySettings.map(s => [s.user_id.toString(), s])
    );

    // Get all likes for selective mode checking
    const allLikes = await Like.find({ type: { $in: ['like', 'superlike'] } });
    const likesMap = new Map();
    allLikes.forEach(like => {
      const fromUserId = like.from_user.toString();
      const toUserId = like.to_user.toString();
      if (!likesMap.has(fromUserId)) {
        likesMap.set(fromUserId, []);
      }
      likesMap.get(fromUserId).push(toUserId);
    });

    // Get their profiles and format response
    const profiles = await Promise.all(users.map(async (user) => {
      // Check privacy settings first
      const privacySettings = privacySettingsMap.get(user._id.toString());
      
      // If profile_visible is false, hide from browse
      if (privacySettings && !privacySettings.profile_visible) {
        logger.log('[BROWSE] Filtered out (profile_visible=false):', user._id);
        return null;
      }
      
      // If selective_mode is true, only show to users they have liked
      if (privacySettings && privacySettings.selective_mode) {
        const profileOwnerLikes = likesMap.get(user._id.toString()) || [];
        if (!profileOwnerLikes.includes(req.userId.toString())) {
          logger.log('[BROWSE] Filtered out (selective_mode and no like back):', user._id);
          return null;
        }
      }

      const profile = await Profile.findOne({ user_id: user._id });
      
      // Check mutual compatibility - other user should be interested in current user's gender
      let otherUserPreference = [];
      if (user.looking_for && user.looking_for.length > 0) {
        otherUserPreference = user.looking_for;
      } else if (profile?.looking_for_gender && profile.looking_for_gender.length > 0) {
        otherUserPreference = profile.looking_for_gender;
      } else if (user.gender) {
        // Default: assume they want opposite gender
        otherUserPreference = user.gender === 'male' ? ['female'] : ['male'];
      }
      
      // Check if other user is interested in current user's gender (handle "everyone" case)
      if (otherUserPreference.length > 0 && 
          !otherUserPreference.includes('everyone') && 
          !otherUserPreference.includes(currentUser.gender)) {
        logger.log('[BROWSE] Filtered out (other user not interested in current gender):', {
          userId: user._id,
          otherUserPreference,
          currentUserGender: currentUser.gender
        });
        return null;
      }
      
      // Calculate age
      const birthDate = new Date(user.birthdate);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      // Filter by age preference
      if (currentProfile) {
        if (age < currentProfile.age_preference_min || age > currentProfile.age_preference_max) {
          logger.log('[BROWSE] Filtered out (age preference):', {
            userId: user._id,
            age,
            minPref: currentProfile.age_preference_min,
            maxPref: currentProfile.age_preference_max
          });
          return null;
        }
      }

      // Check if already liked
      const isLiked = likedUserIds.includes(user._id.toString());

      return {
        id: user._id,
        first_name: user.first_name,
        last_name: user.last_name,
        age,
        gender: user.gender,
        photos: profile?.photos || [],
        profile_picture_url: profile?.profile_picture_url || null,
        bio: profile?.bio || '',
        location_city: profile?.location_city || '',
        distance: Math.floor(Math.random() * 25) + 1, // Placeholder - would calculate from coordinates
        occupation: profile?.occupation || '',
        interests: profile?.interests || [],
        favorite_music: profile?.favorite_music || [],
        animals: profile?.animals || [],
        pet_peeves: profile?.pet_peeves || [],
        is_liked: isLiked
      };
    }));

    // Filter out nulls (users outside age range)
    const filteredProfiles = profiles.filter(p => p !== null);

    logger.log('[BROWSE] Final response:', {
      totalUsersQueried: users.length,
      profilesAfterFilter: filteredProfiles.length,
      genderPreference
    });

    res.json(filteredProfiles);
  } catch (error) {
    logger.error('Browse profiles error:', error.message);
    res.status(500).json({ message: 'Error fetching profiles' });
  }
});

// POST /api/browse/:userId/like
router.post('/:userId/like', auth, async (req, res) => {
  try {
    const targetUserId = req.params.userId;

    // Check if target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get target user's profile for photos
    const targetUserProfile = await Profile.findOne({ user_id: targetUserId });
    const currentUserProfile = await Profile.findOne({ user_id: req.userId });

    // Check if already liked
    const existingLike = await Like.findOne({ 
      from_user: req.userId, 
      to_user: targetUserId 
    });
    
    if (existingLike) {
      return res.status(400).json({ message: 'Already interacted with this user' });
    }

    // Create like
    const like = await Like.create({
      from_user: req.userId,
      to_user: targetUserId,
      type: 'like'
    });

    // Archive the like action
    await ActionHistory.create({
      action_type: 'like',
      user_id: req.userId,
      target_user_id: targetUserId,
      original_data: {
        like_id: like._id,
        like_type: 'like'
      }
    });

    // Check if it's a match (other user already liked current user)
    const mutualLike = await Like.findOne({
      from_user: targetUserId,
      to_user: req.userId,
      type: { $in: ['like', 'superlike'] }
    });

    let match = null;
    if (mutualLike) {
      // Create match
      match = await Match.create({
        users: [req.userId, targetUserId]
      });

      // Create notifications for both users (check settings first)
      if (await shouldCreateNotification(req.userId, 'match')) {
        await Notification.create({
          user_id: req.userId,
          type: 'match',
          title: 'New Match!',
          message: `You and ${targetUser.first_name} matched! Start a conversation now.`,
          avatar: targetUserProfile?.profile_picture_url || (targetUserProfile?.photos && targetUserProfile.photos[0]),
          related_user: targetUserId,
          related_match: match._id
        });
      }

      if (await shouldCreateNotification(targetUserId, 'match')) {
        await Notification.create({
          user_id: targetUserId,
          type: 'match',
          title: 'New Match!',
          message: `You and ${req.user.first_name} matched! Start a conversation now.`,
          avatar: currentUserProfile?.profile_picture_url || (currentUserProfile?.photos && currentUserProfile.photos[0]),
          related_user: req.userId,
          related_match: match._id
        });
      }
    } else {
      // Notify target user they received a like (check settings first)
      if (await shouldCreateNotification(targetUserId, 'like')) {
        await Notification.create({
          user_id: targetUserId,
          type: 'like',
          title: 'Someone Likes You!',
          message: 'Someone new has liked your profile. Keep swiping to find out who!',
          related_user: req.userId
        });
      }
    }

    res.json({
      success: true,
      is_match: !!match,
      match: match ? {
        id: match._id,
        user: {
          id: targetUser._id,
          first_name: targetUser.first_name,
          photos: targetUserProfile?.photos || []
        }
      } : null
    });
  } catch (error) {
    logger.error('Like error:', error.message);
    res.status(500).json({ message: 'Error processing like' });
  }
});

// POST /api/browse/:userId/superlike
router.post('/:userId/superlike', auth, async (req, res) => {
  try {
    const targetUserId = req.params.userId;

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get target user's profile for photos
    const targetUserProfile = await Profile.findOne({ user_id: targetUserId });
    const currentUserProfile = await Profile.findOne({ user_id: req.userId });

    const existingLike = await Like.findOne({ 
      from_user: req.userId, 
      to_user: targetUserId 
    });
    
    if (existingLike) {
      return res.status(400).json({ message: 'Already interacted with this user' });
    }

    const superlike = await Like.create({
      from_user: req.userId,
      to_user: targetUserId,
      type: 'superlike'
    });

    // Archive the superlike action
    await ActionHistory.create({
      action_type: 'superlike',
      user_id: req.userId,
      target_user_id: targetUserId,
      original_data: {
        like_id: superlike._id,
        like_type: 'superlike'
      }
    });

    // Check for match
    const mutualLike = await Like.findOne({
      from_user: targetUserId,
      to_user: req.userId,
      type: { $in: ['like', 'superlike'] }
    });

    let match = null;
    if (mutualLike) {
      match = await Match.create({
        users: [req.userId, targetUserId]
      });

      // Archive the match action
      await ActionHistory.create({
        action_type: 'match',
        user_id: req.userId,
        target_user_id: targetUserId,
        original_data: {
          match_id: match._id,
          matched_at: match.matched_at
        }
      });

      if (await shouldCreateNotification(req.userId, 'match')) {
        await Notification.create({
          user_id: req.userId,
          type: 'match',
          title: 'New Match!',
          message: `You and ${targetUser.first_name} matched! Start a conversation now.`,
          avatar: targetUserProfile?.profile_picture_url || (targetUserProfile?.photos && targetUserProfile.photos[0]),
          related_user: targetUserId,
          related_match: match._id
        });
      }

      if (await shouldCreateNotification(targetUserId, 'match')) {
        await Notification.create({
          user_id: targetUserId,
          type: 'match',
          title: 'New Match!',
          message: `You and ${req.user.first_name} matched! Start a conversation now.`,
          avatar: currentUserProfile?.profile_picture_url || (currentUserProfile?.photos && currentUserProfile.photos[0]),
          related_user: req.userId,
          related_match: match._id
        });
      }
    }

    res.json({
      success: true,
      is_match: !!match,
      match: match ? {
        id: match._id,
        user: {
          id: targetUser._id,
          first_name: targetUser.first_name,
          photos: targetUserProfile?.photos || []
        }
      } : null
    });
  } catch (error) {
    logger.error('Superlike error:', error.message);
    res.status(500).json({ message: 'Error processing superlike' });
  }
});

// POST /api/browse/:userId/pass
router.post('/:userId/pass', auth, async (req, res) => {
  try {
    const targetUserId = req.params.userId;

    const existingLike = await Like.findOne({ 
      from_user: req.userId, 
      to_user: targetUserId 
    });
    
    if (existingLike) {
      return res.status(400).json({ message: 'Already interacted with this user' });
    }

    await Like.create({
      from_user: req.userId,
      to_user: targetUserId,
      type: 'pass'
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Pass error:', error);
    res.status(500).json({ message: 'Error processing pass' });
  }
});

// GET /api/browse/liked - Get profiles the user has liked
router.get('/liked', auth, async (req, res) => {
  try {
    // Get all likes by the current user (not passes)
    const likes = await Like.find({ 
      from_user: req.userId,
      type: { $in: ['like', 'superlike'] }
    }).sort({ created_at: -1 });

    // Get user details for each liked profile
    const likedProfiles = await Promise.all(likes.map(async (like) => {
      const user = await User.findById(like.to_user);
      if (!user || user.role === 'admin') return null;

      const profile = await Profile.findOne({ user_id: user._id });

      // Calculate age
      const birthDate = new Date(user.birthdate);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      return {
        id: user._id,
        first_name: user.first_name,
        last_name: user.last_name,
        age,
        gender: user.gender,
        photos: profile?.photos || [],
        profile_picture_url: profile?.profile_picture_url || null,
        bio: profile?.bio || '',
        location_city: profile?.location_city || '',
        occupation: profile?.occupation || '',
        interests: profile?.interests || [],
        like_id: like._id,
        liked_at: like.created_at,
        type: like.type
      };
    }));

    // Filter out nulls (deleted users)
    const filteredProfiles = likedProfiles.filter(p => p !== null);

    res.json(filteredProfiles);
  } catch (error) {
    console.error('Get liked profiles error:', error);
    res.status(500).json({ message: 'Error fetching liked profiles' });
  }
});

// DELETE /api/browse/liked/:likeId - Unlike a profile
router.delete('/liked/:likeId', auth, async (req, res) => {
  try {
    const like = await Like.findById(req.params.likeId);
    
    if (!like) {
      return res.status(404).json({ message: 'Like not found' });
    }

    // Verify the like belongs to the current user
    if (like.from_user.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const likedUserId = like.to_user.toString();

    // Archive the like in ActionHistory
    await ActionHistory.create({
      action_type: 'unlike',
      user_id: req.userId,
      target_user_id: like.to_user,
      original_data: {
        like_id: like._id,
        like_type: like.type,
        created_at: like.created_at
      }
    });

    // Delete the like
    await Like.findByIdAndDelete(req.params.likeId);

    // If there's an active match between these users, unmatch them
    const match = await Match.findOne({
      users: { $all: [req.userId, likedUserId] },
      is_active: true
    });

    if (match) {
      match.is_active = false;
      await match.save();
      logger.log('[UNLIKE] Unmatched when unlike action performed:', {
        userId: req.userId,
        likedUserId,
        matchId: match._id
      });
    }

    logger.log('[UNLIKE] User unliked profile:', {
      userId: req.userId,
      likedUserId,
      likeId: req.params.likeId
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Unlike error:', error.message);
    res.status(500).json({ message: 'Error unliking profile' });
  }
});

// POST /api/browse/:userId/block - Block a user
router.post('/:userId/block', auth, async (req, res) => {
  try {
    const targetUserId = req.params.userId;

    // Check if already blocked
    const existingBlock = await Block.findOne({
      blocker: req.userId,
      blocked: targetUserId
    });

    if (existingBlock) {
      return res.status(400).json({ message: 'User already blocked' });
    }

    // Create block
    const block = await Block.create({
      blocker: req.userId,
      blocked: targetUserId
    });

    // Archive the block action
    await ActionHistory.create({
      action_type: 'block',
      user_id: req.userId,
      target_user_id: targetUserId,
      original_data: {
        block_id: block._id
      }
    });

    // Delete any matches between them
    const deletedMatches = await Match.find({
      users: { $all: [req.userId, targetUserId] }
    });

    // Archive unmatch if there was a match
    for (const match of deletedMatches) {
      await ActionHistory.create({
        action_type: 'unmatch',
        user_id: req.userId,
        target_user_id: targetUserId,
        original_data: {
          match_id: match._id,
          matched_at: match.matched_at,
          reason: 'blocked'
        }
      });
    }

    await Match.deleteMany({
      users: { $all: [req.userId, targetUserId] }
    });

    // Delete any likes between them
    await Like.deleteMany({
      $or: [
        { from_user: req.userId, to_user: targetUserId },
        { from_user: targetUserId, to_user: req.userId }
      ]
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Block error:', error);
    res.status(500).json({ message: 'Error blocking user' });
  }
});

// GET /api/browse/blocked-list - Get list of blocked users
router.get('/blocked-list', auth, async (req, res) => {
  try {
    // Get all users blocked by current user
    const blockedRecords = await Block.find({ blocker: req.userId }).populate('blocked', 'first_name last_name');
    
    const blockedUsers = await Promise.all(
      blockedRecords.map(async (record) => {
        const profile = await Profile.findOne({ user_id: record.blocked._id });
        return {
          id: record.blocked._id,
          first_name: record.blocked.first_name,
          last_name: record.blocked.last_name,
          profile_picture_url: profile?.profile_picture_url || null,
          blocked_at: record.created_at || new Date()
        };
      })
    );

    res.json(blockedUsers);
  } catch (error) {
    logger.error('Get blocked list error:', error.message);
    res.status(500).json({ message: 'Error fetching blocked users' });
  }
});

// DELETE /api/browse/:userId/unblock - Unblock a user
router.delete('/:userId/unblock', auth, async (req, res) => {
  try {
    const targetUserId = req.params.userId;

    // Check if blocked
    const block = await Block.findOne({
      blocker: req.userId,
      blocked: targetUserId
    });

    if (!block) {
      return res.status(404).json({ message: 'User not blocked' });
    }

    // Delete the block
    await Block.deleteOne({
      blocker: req.userId,
      blocked: targetUserId
    });

    // Archive the unblock action
    await ActionHistory.create({
      action_type: 'unblock',
      user_id: req.userId,
      target_user_id: targetUserId,
      original_data: {
        block_id: block._id
      }
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Unblock error:', error.message);
    res.status(500).json({ message: 'Error unblocking user' });
  }
});

// POST /api/browse/:userId/report - Report a user
router.post('/:userId/report', auth, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const { reason } = req.body;

    // Create report
    const report = await Report.create({
      reporter: req.userId,
      reported_user: targetUserId,
      reason: reason || 'No reason provided',
      status: 'pending'
    });

    // Archive the report action
    await ActionHistory.create({
      action_type: 'report',
      user_id: req.userId,
      target_user_id: targetUserId,
      reason: reason || 'No reason provided',
      original_data: {
        report_id: report._id
      }
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Report error:', error.message);
    res.status(500).json({ message: 'Error reporting user' });
  }
});

export default router;
