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
import Favorite from '../models/Favorite.js';
import {
  calculateAge,
  isBlockedBetween,
  shouldCreateNotification,
  validateIdParams
} from '../utils/helpers.js';

const router = express.Router();

// Every /:userId route: the id must be well formed, must not be the caller,
// and must belong to a real account.
const validateTarget = [
  validateIdParams('userId'),
  (req, res, next) => {
    if (req.params.userId === req.userId.toString()) {
      return res.status(400).json({ message: 'You cannot do that to your own profile.' });
    }
    next();
  }
];

// Looks up someone the caller wants to like: they must exist, be visible, and
// neither person may have blocked the other.
async function findLikeableUser(req) {
  const targetUser = await User.findById(req.params.userId);
  if (
    !targetUser ||
    targetUser.is_deleted ||
    targetUser.is_banned ||
    targetUser.is_disabled ||
    targetUser.role === 'admin' ||
    await isBlockedBetween(req.userId, targetUser._id)
  ) {
    return null;
  }
  return targetUser;
}

// Lets both people know straight away (badge + chime) when they match.
function announceMatch(req, match, targetUser) {
  const io = req.app.get('io');
  if (!io) return;
  io.to(req.userId.toString()).emit('new-notification', {
    type: 'match', match_id: match._id.toString(), from: targetUser.first_name
  });
  io.to(targetUser._id.toString()).emit('new-notification', {
    type: 'match', match_id: match._id.toString(), from: req.user.first_name
  });
}

// GET /api/browse - Get profiles to browse
router.get('/', auth, async (req, res) => {
  try {
    const currentUser = req.user;
    const currentProfile = await Profile.findOne({ user_id: req.userId });

    // Who the viewer wants to see. This lives on the Profile — the User model
    // has no `looking_for` field, so the old check against it never matched.
    //
    // An empty list means "no preference stated", which shows everyone. It
    // used to fall back to the opposite gender, so a member who never answered
    // the question silently had half of Browse hidden from them without any
    // way to tell why.
    const genderPreference =
      currentProfile?.looking_for_gender?.length > 0
        ? currentProfile.looking_for_gender
        : [];

    // Everything the current user has already decided on. Profiles they
    // passed on are left out; profiles they liked stay, marked as liked.
    const me = req.userId.toString();
    const interactions = await Like.find({ from_user: me });
    const likes = interactions.filter(i => i.type !== 'pass');
    const likedUserIds = likes.map(i => i.to_user.toString());
    const passedUserIds = interactions.filter(i => i.type === 'pass').map(i => i.to_user.toString());

    // Get blocked users (both directions)
    const blocks = await Block.find({
      $or: [{ blocker: me }, { blocked: me }]
    });
    const blockedUserIds = blocks.map(b =>
      b.blocker.toString() === me ? b.blocked : b.blocker
    );

    // Build query for potential matches (exclude blocked and self, but include liked)
    const query = {
      _id: {
        $nin: [...blockedUserIds, ...passedUserIds, me]
      },
      onboarding_completed: true,
      // $ne: true rather than false — an equality check on false does not match
      // documents where the field is absent, so any account saved before one of
      // these flags existed would have been excluded from Browse for good.
      is_banned: { $ne: true },
      is_suspended: { $ne: true },
      is_disabled: { $ne: true },
      is_deleted: { $ne: true },
      role: { $ne: 'admin' }
    };

    // Apply gender filter - handle "everyone" specially
    if (genderPreference.length > 0 && !genderPreference.includes('everyone')) {
      query.gender = { $in: genderPreference };
    }

    // Get users
    const users = await User.find(query).sort({ last_active: -1 }).limit(200);
    const userIds = users.map(u => u._id.toString());

    // Privacy settings, likes and profiles for just these members. This used
    // to load every privacy setting and every like in the database on each
    // visit to Browse, plus one profile query per member.
    const [privacySettings, likesTowardsMe, profileDocs, favorites] = await Promise.all([
      UserPrivacySettings.find({ user_id: { $in: userIds } }),
      Like.find({ from_user: { $in: userIds }, to_user: me, type: { $in: ['like', 'superlike'] } }),
      Profile.find({ user_id: { $in: userIds } }),
      Favorite.find({ user_id: me, favorite_user_id: { $in: userIds } })
    ]);
    const privacySettingsMap = new Map(privacySettings.map(s => [s.user_id.toString(), s]));
    const likesMeSet = new Set(likesTowardsMe.map(l => l.from_user.toString()));
    const profileMap = new Map(profileDocs.map(p => [p.user_id.toString(), p]));
    const favoriteSet = new Set(favorites.map(fav => fav.favorite_user_id));

    // Get their profiles and format response
    const profiles = await Promise.all(users.map(async (user) => {
      // Check privacy settings first
      const privacySettings = privacySettingsMap.get(user._id.toString());

      // If profile_visible is false, hide from browse
      if (privacySettings && privacySettings.profile_visible === false) {
        return null;
      }

      // If selective_mode is true, only show to users they have liked
      if (privacySettings && privacySettings.selective_mode) {
        if (!likesMeSet.has(user._id.toString())) {
          return null;
        }
      }

      const profile = profileMap.get(user._id.toString());

      // Check mutual compatibility - the other user should be open to the
      // current user's gender.
      //
      // Only an explicitly stated preference filters anyone out. This used to
      // assume anyone who had not chosen was looking for the opposite gender
      // ("male" for everybody who was not male), which quietly hid three
      // groups of real profiles:
      //   - anyone who signed up before this question existed, or skipped it
      //   - non-binary members, who no invented default ever matched
      //   - members whose own gender is "prefer_not_to_say" or blank, who
      //     matched nobody's preference list and so saw an almost empty Browse
      // Someone who has not said who they want to meet has not said "not you".
      const otherUserPreference =
        profile?.looking_for_gender?.length > 0 ? profile.looking_for_gender : [];

      // With no gender recorded for the viewer there is nothing to test
      // against, so let the profile through rather than hiding everyone.
      const viewerGenderIsKnown =
        currentUser.gender &&
        currentUser.gender !== 'prefer_not_to_say';

      if (
        otherUserPreference.length > 0 &&
        viewerGenderIsKnown &&
        !otherUserPreference.includes('everyone') &&
        !otherUserPreference.includes(currentUser.gender)
      ) {
        return null;
      }

      const age = calculateAge(user.birthdate);

      // Filter by age preference. A member whose age is unknown is shown
      // rather than silently hidden.
      if (currentProfile && age !== null) {
        if (age < currentProfile.age_preference_min || age > currentProfile.age_preference_max) {
          return null;
        }
      }

      // Check if already liked
      const isLiked = likedUserIds.includes(user._id.toString());
      const likedEntry = likes.find(like => like.to_user.toString() === user._id.toString());

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
        location_state: profile?.location_state || '',
        district_number: profile?.district_number || '',
        // Distance is not calculated. This used to be a random number that
        // changed on every visit.
        distance: null,
        email_verified: Boolean(user.email_verified),
        is_favorite: favoriteSet.has(user._id.toString()),
        has_liked_me: likesMeSet.has(user._id.toString()) && isLiked,
        occupation: profile?.occupation || '',
        interests: profile?.interests || [],
        favorite_music: profile?.favorite_music || [],
        animals: profile?.animals || [],
        pet_peeves: profile?.pet_peeves || [],
        is_liked: isLiked,
        like_id: isLiked ? likedEntry?._id : null
      };
    }));

    // Filter out nulls (users outside age range)
    const filteredProfiles = profiles.filter(p => p !== null);

    res.json(filteredProfiles);
  } catch (error) {
    logger.error('Browse profiles error:', error.message);
    res.status(500).json({ message: 'Error fetching profiles' });
  }
});

// POST /api/browse/:userId/like
router.post('/:userId/like', auth, validateTarget, async (req, res) => {
  try {
    const targetUserId = req.params.userId;

    // Check if target user exists (and can be liked)
    const targetUser = await findLikeableUser(req);
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

    if (existingLike && existingLike.type !== 'pass') {
      return res.status(400).json({ message: 'You have already liked this member.' });
    }

    // Create like - or change an earlier "pass" into a like. Before, passing
    // on someone once meant you could never like them.
    let like;
    if (existingLike) {
      existingLike.type = 'like';
      like = await existingLike.save();
    } else {
      like = await Like.create({
        from_user: req.userId,
        to_user: targetUserId,
        type: 'like'
      });
    }

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
      // Create match - or bring back the earlier one, so two people who
      // unmatched and found each other again keep a single conversation.
      match = await Match.findOne({ users: { $all: [req.userId.toString(), targetUserId] } });
      if (match) {
        match.is_active = true;
        match.matched_at = new Date();
        await match.save();
      } else {
        match = await Match.create({
          users: [req.userId, targetUserId]
        });
      }
      announceMatch(req, match, targetUser);

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
          message: 'Someone new has liked your profile. Keep browsing to find out who!'
          // No related_user: the point of this notice is that it does not say
          // who. The id used to be included, so it could be read off the
          // network response.
        });
        req.app.get('io')?.to(targetUserId).emit('new-notification', { type: 'like' });
      }
    }

    res.json({
      success: true,
      is_match: !!match,
      like_id: like._id,
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
router.post('/:userId/superlike', auth, validateTarget, async (req, res) => {
  try {
    const targetUserId = req.params.userId;

    const targetUser = await findLikeableUser(req);
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
      match = await Match.findOne({ users: { $all: [req.userId.toString(), targetUserId] } });
      if (match) {
        match.is_active = true;
        match.matched_at = new Date();
        await match.save();
      } else {
        match = await Match.create({
          users: [req.userId, targetUserId]
        });
      }
      announceMatch(req, match, targetUser);

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
router.post('/:userId/pass', auth, validateTarget, async (req, res) => {
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
      if (!user || user.role === 'admin' || user.is_deleted || user.is_banned) return null;

      const profile = await Profile.findOne({ user_id: user._id });

      const age = calculateAge(user.birthdate);

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
router.delete('/liked/:likeId', auth, validateIdParams('likeId'), async (req, res) => {
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
      users: { $all: [req.userId.toString(), likedUserId] },
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
router.post('/:userId/block', auth, validateTarget, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const me = req.userId.toString();

    const targetExists = await User.exists({ _id: targetUserId });
    if (!targetExists) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if already blocked
    const existingBlock = await Block.findOne({
      blocker: me,
      blocked: targetUserId
    });

    if (existingBlock) {
      // Blocking twice is not an error from the member's point of view.
      return res.json({ success: true, already_blocked: true });
    }

    // Create block
    const block = await Block.create({
      blocker: me,
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
      users: { $all: [me, targetUserId] }
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
      users: { $all: [me, targetUserId] }
    });

    // Delete any likes between them
    await Like.deleteMany({
      $or: [
        { from_user: me, to_user: targetUserId },
        { from_user: targetUserId, to_user: me }
      ]
    });

    // ...and any saved-profile bookmarks, and notifications that point at
    // each other, so nothing of either person lingers in the other's app.
    await Favorite.deleteMany({
      $or: [
        { user_id: me, favorite_user_id: targetUserId },
        { user_id: targetUserId, favorite_user_id: me }
      ]
    });
    await Notification.deleteMany({
      $or: [
        { user_id: me, related_user: targetUserId },
        { user_id: targetUserId, related_user: me }
      ]
    });

    // Close the conversation on the other person's screen straight away.
    const io = req.app.get('io');
    for (const match of deletedMatches) {
      io?.to(targetUserId).emit('conversation-closed', { match_id: match._id.toString() });
      io?.in(`match-${match._id}`).socketsLeave(`match-${match._id}`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Block error:', error);
    res.status(500).json({ message: 'Error blocking user' });
  }
});

// GET /api/browse/blocked-list - Get list of blocked users
router.get('/blocked-list', auth, async (req, res) => {
  try {
    // Block.blocked is a plain String, not a ref, so .populate() could never
    // resolve it — every row came back with an undefined id and name, which
    // left Settings showing blank entries whose Unblock button did nothing.
    // Look the users up directly instead.
    const blockedRecords = await Block.find({ blocker: req.userId.toString() });
    const blockedIds = blockedRecords.map(record => record.blocked);

    const users = await User.find({ _id: { $in: blockedIds } })
      .select('first_name last_name');
    const usersById = new Map(users.map(user => [user._id.toString(), user]));

    const profiles = await Profile.find({ user_id: { $in: blockedIds } })
      .select('user_id profile_picture_url photos');
    const profilesByUserId = new Map(
      profiles.map(profile => [profile.user_id.toString(), profile])
    );

    const blockedUsers = blockedRecords
      .map(record => {
        const blockedId = record.blocked.toString();
        const user = usersById.get(blockedId);
        // Skip blocks pointing at an account that no longer exists rather than
        // rendering an empty row.
        if (!user) return null;

        const profile = profilesByUserId.get(blockedId);
        return {
          id: blockedId,
          first_name: user.first_name,
          last_name: user.last_name,
          profile_picture_url:
            profile?.profile_picture_url || profile?.photos?.[0] || null,
          blocked_at: record.created_at || new Date()
        };
      })
      .filter(Boolean);

    res.json(blockedUsers);
  } catch (error) {
    logger.error('Get blocked list error:', error.message);
    res.status(500).json({ message: 'Error fetching blocked users' });
  }
});

// DELETE /api/browse/:userId/unblock - Unblock a user
router.delete('/:userId/unblock', auth, validateTarget, async (req, res) => {
  try {
    const targetUserId = req.params.userId;

    // Check if blocked
    const block = await Block.findOne({
      blocker: req.userId.toString(),
      blocked: targetUserId
    });

    if (!block) {
      return res.status(404).json({ message: 'User not blocked' });
    }

    // Delete the block
    await Block.deleteOne({
      blocker: req.userId.toString(),
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
router.post('/:userId/report', auth, validateTarget, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const me = req.userId.toString();
    const body = req.body || {};
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 1000) : '';
    const category = typeof body.category === 'string' ? body.category.trim().slice(0, 80) : '';
    const source = ['profile', 'chat', 'browse', 'matches'].includes(body.source) ? body.source : '';
    const matchId = typeof body.match_id === 'string' && /^[a-f0-9]{24}$/i.test(body.match_id)
      ? body.match_id : null;

    const targetExists = await User.exists({ _id: targetUserId });
    if (!targetExists) {
      return res.status(404).json({ message: 'User not found' });
    }

    // One open report per person is enough for the moderators; a second one
    // adds to the first instead of flooding the queue.
    const openReport = await Report.findOne({ reporter: me, reported_user: targetUserId, status: 'pending' });
    if (openReport) {
      const addition = [category, reason].filter(Boolean).join(': ');
      if (addition && !String(openReport.reason || '').includes(addition)) {
        openReport.reason = `${openReport.reason || ''}\n---\n${addition}`.slice(0, 1000);
        await openReport.save();
      }
      return res.json({ success: true, already_reported: true });
    }

    // Create report
    const report = await Report.create({
      reporter: me,
      reported_user: targetUserId,
      reason: reason || category || 'No reason provided',
      category,
      source,
      match_id: matchId,
      status: 'pending'
    });

    // Archive the report action
    await ActionHistory.create({
      action_type: 'report',
      user_id: me,
      target_user_id: targetUserId,
      reason: reason || category || 'No reason provided',
      original_data: {
        report_id: report._id
      }
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Report error:', error.message);
    res.status(500).json({ message: 'We could not send your report. Please try again.' });
  }
});

export default router;
