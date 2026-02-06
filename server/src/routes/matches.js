import express from 'express';
import { auth } from '../middleware/auth.js';
import User from '../models/User.js';
import Profile from '../models/Profile.js';
import Match from '../models/Match.js';
import Like from '../models/Like.js';
import ActionHistory from '../models/ActionHistory.js';
import logger from '../utils/logger.js';

const router = express.Router();

// GET /api/matches - Get all matches
router.get('/', auth, async (req, res) => {
  try {
    // Prevent caching
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    
    const allMatches = await Match.find({
      users: req.userId
    }).sort({ matched_at: -1 });

    // Format matches with user details
    const formattedMatches = await Promise.all(allMatches.map(async (match) => {
      // Get the other user in the match
      const otherUserId = match.users.find(id => id.toString() !== req.userId.toString());
      const otherUser = await User.findById(otherUserId);
      const otherProfile = await Profile.findOne({ user_id: otherUserId });

      if (!otherUser || otherUser.role === 'admin') return null;

      // Calculate age
      const birthDate = new Date(otherUser.birthdate);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      // Get unread count for current user
      const unreadCount = match.unread_counts?.get(req.userId.toString()) || 0;

      return {
        id: match._id,
        user: {
          id: otherUser._id,
          first_name: otherUser.first_name,
          last_name: otherUser.last_name,
          age,
          photos: otherUser.photos,
          bio: otherProfile?.bio || '',
          location_city: otherProfile?.location_city || '',
          location_state: otherProfile?.location_state || '',
          occupation: otherProfile?.occupation || '',
          interests: otherProfile?.interests || [],
          looking_for_description: otherProfile?.looking_for_description || '',
          life_goals: otherProfile?.life_goals || '',
          languages: otherProfile?.languages || [],
          cultural_background: otherProfile?.cultural_background || '',
          religion: otherProfile?.religion || '',
          personal_preferences: otherProfile?.personal_preferences || ''
        },
        matched_at: match.matched_at,
        last_message: match.last_message,
        last_message_at: match.last_message_at,
        unread_count: unreadCount,
        is_active: match.is_active
      };
    }));

    // Filter out nulls and separate active/inactive
    const validMatches = formattedMatches.filter(m => m !== null);
    const activeMatches = validMatches.filter(m => m.is_active !== false);
    const inactiveMatches = validMatches.filter(m => m.is_active === false);

    res.json({
      active: activeMatches,
      inactive: inactiveMatches
    });
  } catch (error) {
    console.error('Get matches error:', error);
    res.status(500).json({ message: 'Error fetching matches' });
  }
});

// GET /api/matches/:matchId
router.get('/:matchId', auth, async (req, res) => {
  try {
    const match = await Match.findOne({
      _id: req.params.matchId,
      users: req.userId,
      is_active: true
    });

    if (!match) {
      return res.status(404).json({ message: 'Match not found' });
    }

    const otherUserId = match.users.find(id => id.toString() !== req.userId.toString());
    const otherUser = await User.findById(otherUserId);
    const otherProfile = await Profile.findOne({ user_id: otherUserId });

    if (!otherUser || otherUser.role === 'admin') {
      return res.status(404).json({ message: 'User not found' });
    }

    // Calculate age
    const birthDate = new Date(otherUser.birthdate);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    res.json({
      id: match._id,
      user: {
        id: otherUser._id,
        first_name: otherUser.first_name,
        last_name: otherUser.last_name,
        age,
        photos: otherUser.photos,
        bio: otherProfile?.bio || '',
        location_city: otherProfile?.location_city || ''
      },
      matched_at: match.matched_at,
      last_message: match.last_message,
      last_message_at: match.last_message_at
    });
  } catch (error) {
    console.error('Get match error:', error);
    res.status(500).json({ message: 'Error fetching match' });
  }
});

// DELETE /api/matches/:matchId - Unmatch
router.delete('/:matchId', auth, async (req, res) => {
  try {
    const match = await Match.findOne({
      _id: req.params.matchId,
      users: req.userId
    });

    if (!match) {
      return res.status(404).json({ message: 'Match not found' });
    }

    // Get the other user ID for the archive
    const otherUserId = match.users.find(id => id.toString() !== req.userId.toString());

    // Archive the unmatch action
    await ActionHistory.create({
      action_type: 'unmatch',
      user_id: req.userId,
      target_user_id: otherUserId,
      original_data: {
        match_id: match._id,
        matched_at: match.matched_at,
        last_message: match.last_message,
        last_message_at: match.last_message_at
      }
    });

    // Set match as inactive instead of deleting
    match.is_active = false;
    await match.save();

    // Remove likes between the two users when unmatching
    // This removes the unmatcher's like on the other user
    const deletedLikes = await Like.deleteMany({
      $or: [
        { from_user: req.userId, to_user: otherUserId },
        { from_user: otherUserId, to_user: req.userId }
      ]
    });

    logger.log('[UNMATCH] User unmatched with another user:', {
      matchId: req.params.matchId,
      userId: req.userId,
      otherUserId,
      likesRemoved: deletedLikes.deletedCount
    });

    res.json({ success: true, likesRemoved: deletedLikes.deletedCount });
  } catch (error) {
    logger.error('Unmatch error:', error.message);
    res.status(500).json({ message: 'Error unmatching' });
  }
});

export default router;
