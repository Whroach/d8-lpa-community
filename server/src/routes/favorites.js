import express from 'express';
import { auth } from '../middleware/auth.js';
import User from '../models/User.js';
import Profile from '../models/Profile.js';
import Favorite from '../models/Favorite.js';
import Block from '../models/Block.js';
import logger from '../utils/logger.js';
import { calculateAge, isBlockedBetween, validateIdParams } from '../utils/helpers.js';

const router = express.Router();

// GET /api/favorites - profiles this member has saved (private to them)
router.get('/', auth, async (req, res) => {
  try {
    const me = req.userId.toString();
    const favorites = await Favorite.find({ user_id: me }).sort({ created_at: -1 });
    const ids = favorites.map(f => f.favorite_user_id);

    const blocks = await Block.find({ $or: [{ blocker: me }, { blocked: me }] });
    const hidden = new Set(blocks.map(b => (b.blocker === me ? b.blocked : b.blocker)));

    const users = await User.find({
      _id: { $in: ids.filter(id => !hidden.has(id)) },
      is_deleted: { $ne: true },
      is_banned: { $ne: true },
      is_disabled: { $ne: true }
    });
    const usersById = new Map(users.map(u => [u._id.toString(), u]));
    const profiles = await Profile.find({ user_id: { $in: [...usersById.keys()] } });
    const profilesById = new Map(profiles.map(p => [p.user_id.toString(), p]));

    res.json(favorites
      .map(f => {
        const user = usersById.get(f.favorite_user_id);
        if (!user) return null;
        const profile = profilesById.get(f.favorite_user_id);
        return {
          id: user._id,
          first_name: user.first_name,
          age: calculateAge(user.birthdate),
          photos: profile?.photos || [],
          profile_picture_url: profile?.profile_picture_url || profile?.photos?.[0] || null,
          location_city: profile?.location_city || '',
          location_state: profile?.location_state || '',
          bio: profile?.bio || '',
          saved_at: f.created_at
        };
      })
      .filter(Boolean));
  } catch (error) {
    logger.error('Get favorites error:', error.message);
    res.status(500).json({ message: 'Error fetching saved profiles' });
  }
});

// PUT /api/favorites/:userId - save a profile
router.put('/:userId', auth, validateIdParams('userId'), async (req, res) => {
  try {
    const me = req.userId.toString();
    const target = req.params.userId;
    if (target === me) {
      return res.status(400).json({ message: 'You cannot save your own profile.' });
    }
    const user = await User.findById(target).select('is_deleted is_banned role');
    if (!user || user.is_deleted || user.is_banned || user.role === 'admin' || await isBlockedBetween(me, target)) {
      return res.status(404).json({ message: 'User not found' });
    }
    await Favorite.updateOne(
      { user_id: me, favorite_user_id: target },
      { $setOnInsert: { user_id: me, favorite_user_id: target } },
      { upsert: true }
    );
    res.json({ success: true, is_favorite: true });
  } catch (error) {
    logger.error('Save favorite error:', error.message);
    res.status(500).json({ message: 'Error saving profile' });
  }
});

// DELETE /api/favorites/:userId - remove a saved profile
router.delete('/:userId', auth, validateIdParams('userId'), async (req, res) => {
  try {
    await Favorite.deleteOne({ user_id: req.userId.toString(), favorite_user_id: req.params.userId });
    res.json({ success: true, is_favorite: false });
  } catch (error) {
    logger.error('Remove favorite error:', error.message);
    res.status(500).json({ message: 'Error removing saved profile' });
  }
});

export default router;
