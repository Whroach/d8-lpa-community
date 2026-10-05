import '../config/env.js';
import express from 'express';
import multer from 'multer';
import { auth } from '../middleware/auth.js';
import User from '../models/User.js';
import Profile from '../models/Profile.js';
import Match from '../models/Match.js';
import Message from '../models/Message.js';
import Like from '../models/Like.js';
import Notification from '../models/Notification.js';
import Favorite from '../models/Favorite.js';
import logger from '../utils/logger.js';
import {
  calculateAge,
  isBlockedBetween,
  keepOwnPhotos,
  validateIdParams,
  validationMessage
} from '../utils/helpers.js';
import {
  ENVIRONMENT_FOLDER,
  imageExtensionFor,
  imageFileFilter,
  looksLikeImage,
  randomFileName,
  storeFile
} from '../providers/storage.js';
import { isOnline, sharesOnlineStatus } from '../realtime.js';

const router = express.Router();

const MAX_PHOTOS = 9;

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1
  },
  fileFilter: imageFileFilter,
});

// GET /api/users/profile
router.get('/profile', auth, async (req, res) => {
  try {
    const me = req.userId.toString();
    const profile = await Profile.findOne({ user_id: me });

    // Get stats
    const matchesCount = await Match.countDocuments({
      users: me,
      is_active: true
    });

    const likesReceived = await Like.countDocuments({
      to_user: me,
      type: { $in: ['like', 'superlike'] }
    });

    const stats = {
      matches_count: matchesCount,
      likes_received: likesReceived,
      // Profile views are not tracked. This used to return a random number,
      // which the member would reasonably have believed.
      profile_views: null
    };

    res.json({
      user: req.user.toJSON(),
      profile,
      stats
    });
  } catch (error) {
    logger.error('[PROFILE] Error fetching profile:', error.message);
    res.status(500).json({ message: 'Error fetching profile' });
  }
});

// PUT /api/users/profile
router.put('/profile', auth, async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      birthdate,
      gender,
      looking_for,
      looking_for_relationship,
      photos,
      bio,
      height,
      body_type,
      occupation,
      education,
      religion,
      drinking,
      smoking,
      wants_kids,
      interests,
      looking_for_description,
      life_goals,
      languages,
      cultural_background,
      personal_preferences,
      distance_preference,
      age_preference_min,
      age_preference_max,
      location_city,
      location_state,
      location_country,
      district_number,
      favorite_music,
      custom_music,
      animals,
      custom_animal,
      pet_peeves,
      custom_peeve,
      prompt_good_at,
      prompt_perfect_weekend,
      prompt_message_if,
      hoping_to_find,
      great_day,
      relationship_values,
      show_affection,
      build_with_person,
      has_seen_tour
    } = req.body;

    if (birthdate !== undefined && birthdate !== null && birthdate !== '') {
      const age = calculateAge(birthdate);
      if (age === null || age < 18 || age > 120) {
        return res.status(400).json({ message: 'You must be 18 or older. Please check your date of birth.' });
      }
    }
    if (first_name !== undefined && (typeof first_name !== 'string' || !first_name.trim())) {
      return res.status(400).json({ message: 'Please enter your first name.' });
    }

    // Update user - only basic user info
    const user = req.user;
    if (first_name !== undefined) user.first_name = first_name;
    if (last_name !== undefined) user.last_name = last_name;
    if (birthdate !== undefined && birthdate) user.birthdate = birthdate;
    if (gender !== undefined) user.gender = gender;
    if (has_seen_tour !== undefined) user.has_seen_tour = Boolean(has_seen_tour);
    await user.save();

    // Update profile - all profile-related fields
    let profile = await Profile.findOne({ user_id: req.userId.toString() });
    if (!profile) {
      profile = new Profile({ user_id: req.userId });
    }

    // Profile content
    if (bio !== undefined) profile.bio = bio;
    if (height !== undefined) profile.height = height;
    if (body_type !== undefined) profile.body_type = body_type;
    if (occupation !== undefined) profile.occupation = occupation;
    if (education !== undefined) profile.education = education;
    if (religion !== undefined) profile.religion = religion;
    if (drinking !== undefined) profile.drinking = drinking;
    if (smoking !== undefined) profile.smoking = smoking;
    if (wants_kids !== undefined) profile.wants_kids = wants_kids;
    if (interests !== undefined) profile.interests = interests;
    if (personal_preferences !== undefined) profile.personal_preferences = personal_preferences;

    // Looking for
    if (looking_for !== undefined) profile.looking_for_gender = looking_for;
    if (looking_for_relationship !== undefined) profile.looking_for_relationship = looking_for_relationship;
    if (looking_for_description !== undefined) profile.looking_for_description = looking_for_description;

    // Preferences
    if (life_goals !== undefined) profile.life_goals = life_goals;
    if (languages !== undefined) profile.languages = languages;
    if (cultural_background !== undefined) profile.cultural_background = cultural_background;
    if (distance_preference !== undefined) profile.distance_preference = distance_preference;
    if (age_preference_min !== undefined) profile.age_preference_min = age_preference_min;
    if (age_preference_max !== undefined) profile.age_preference_max = age_preference_max;

    // Location
    if (location_city !== undefined) profile.location_city = location_city;
    if (location_state !== undefined) profile.location_state = location_state;
    if (location_country !== undefined) profile.location_country = location_country;
    if (district_number !== undefined) profile.district_number = String(district_number);

    // Music, Animals, Pet Peeves
    if (favorite_music !== undefined) profile.favorite_music = favorite_music;
    if (custom_music !== undefined) profile.custom_music = custom_music;
    if (animals !== undefined) profile.animals = animals;
    if (custom_animal !== undefined) profile.custom_animal = custom_animal;
    if (pet_peeves !== undefined) profile.pet_peeves = pet_peeves;
    if (custom_peeve !== undefined) profile.custom_peeve = custom_peeve;

    // The photo list can be reordered or trimmed here, but every URL must be
    // one this member uploaded. It used to accept any URL at all, which let a
    // profile point other members' browsers at an arbitrary server.
    if (photos !== undefined) {
      profile.photos = keepOwnPhotos(photos, profile.photos);
      if (!profile.photos.includes(profile.profile_picture_url)) {
        profile.profile_picture_url = profile.photos[0] || null;
      }
    }

    // Prompts and open-ended questions
    if (prompt_good_at !== undefined) profile.prompt_good_at = prompt_good_at;
    if (prompt_perfect_weekend !== undefined) profile.prompt_perfect_weekend = prompt_perfect_weekend;
    if (prompt_message_if !== undefined) profile.prompt_message_if = prompt_message_if;
    if (hoping_to_find !== undefined) profile.hoping_to_find = hoping_to_find;
    if (great_day !== undefined) profile.great_day = great_day;
    if (relationship_values !== undefined) profile.relationship_values = relationship_values;
    if (show_affection !== undefined) profile.show_affection = show_affection;
    if (build_with_person !== undefined) profile.build_with_person = build_with_person;

    await profile.save();

    res.json({
      user: user.toJSON(),
      profile
    });
  } catch (error) {
    const friendly = validationMessage(error);
    if (friendly) return res.status(400).json({ message: friendly });
    logger.error('[PROFILE] Error updating profile:', error.message);
    res.status(500).json({ message: 'We could not save your changes just now. Please try again.' });
  }
});

// DELETE /api/users/profile - permanent removal of the account and its data.
// The app's own "Delete account" uses POST /api/settings/delete (a soft
// delete). This harder version now asks for the password too: before, a
// single request with a borrowed token erased everything.
router.delete('/profile', auth, async (req, res) => {
  try {
    const userId = req.userId.toString();
    const { password } = req.body || {};

    if (typeof password !== 'string' || !(await req.user.comparePassword(password))) {
      return res.status(400).json({ message: 'Please enter your password to delete your account.' });
    }

    // Delete user's data
    await Profile.deleteOne({ user_id: userId });
    await Like.deleteMany({ $or: [{ from_user: userId }, { to_user: userId }] });
    await Message.deleteMany({ sender_id: userId });
    await Notification.deleteMany({ user_id: userId });
    await Favorite.deleteMany({ $or: [{ user_id: userId }, { favorite_user_id: userId }] });

    // Remove user from matches
    await Match.updateMany(
      { users: userId },
      { is_active: false }
    );

    // Delete user
    await User.deleteOne({ _id: userId });

    res.json({ success: true });
  } catch (error) {
    logger.error('[DELETE] Error deleting account:', error.message);
    res.status(500).json({ message: 'Error deleting account' });
  }
});

// POST /api/users/photos
router.post('/photos', auth, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please choose a picture to upload.' });
    }

    const file = req.file;
    const userId = req.userId.toString();
    const isProfilePicture = req.body.isProfilePicture === 'true' || req.body.isProfilePicture === true;

    // The extension comes from the checked file type, never from the name the
    // browser sent, and the first bytes must really be that kind of image.
    const extension = imageExtensionFor(file.mimetype);
    if (!extension || !looksLikeImage(file.buffer, file.mimetype)) {
      return res.status(400).json({ message: 'That file does not look like a picture. Please choose a JPG, PNG, WebP or GIF.' });
    }

    let profile = await Profile.findOne({ user_id: userId });
    if (!profile) {
      profile = new Profile({ user_id: userId });
    }
    if (!profile.photos) {
      profile.photos = [];
    }
    if (profile.photos.length >= MAX_PHOTOS) {
      return res.status(400).json({ message: `You can have up to ${MAX_PHOTOS} photos. Remove one to add another.` });
    }

    // Format: {environment}/users/{userId}/{subfolder}/{timestamp}-{random}.{ext}
    const subfolder = isProfilePicture ? 'profilePicture' : 'photos';
    const key = `${ENVIRONMENT_FOLDER}/users/${userId}/${subfolder}/${randomFileName(extension)}`;

    const photoUrl = await storeFile({ key, body: file.buffer, contentType: file.mimetype });

    profile.photos.push(photoUrl);

    // If this is the first photo or explicitly marked as profile picture, set it as profile_picture_url
    if (profile.photos.length === 1 || isProfilePicture) {
      profile.profile_picture_url = photoUrl;
    }

    await profile.save();

    res.json({ url: photoUrl, isProfilePicture: profile.profile_picture_url === photoUrl });
  } catch (error) {
    logger.error('[UPLOAD] Error uploading photo:', error.message);
    res.status(500).json({ message: 'We could not upload that picture. Please try again.' });
  }
});

// DELETE /api/users/photos
router.delete('/photos', auth, async (req, res) => {
  try {
    const { url } = req.body || {};
    if (typeof url !== 'string' || !url) {
      return res.status(400).json({ message: 'Photo URL required' });
    }

    // Delete from profile (not user)
    const profile = await Profile.findOne({ user_id: req.userId.toString() });
    if (profile) {
      profile.photos = profile.photos.filter(p => p !== url);

      // If deleted photo was the profile picture, set the first remaining photo
      if (profile.profile_picture_url === url) {
        profile.profile_picture_url = profile.photos.length > 0 ? profile.photos[0] : null;
      }

      await profile.save();
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('[DELETE] Error deleting photo:', error.message);
    res.status(500).json({ message: 'Error deleting photo' });
  }
});

// PUT /api/users/profile-picture - Set which photo is the profile picture
router.put('/profile-picture', auth, async (req, res) => {
  try {
    const { photoUrl } = req.body;

    if (typeof photoUrl !== 'string' || !photoUrl) {
      return res.status(400).json({ message: 'Photo URL required' });
    }

    const profile = await Profile.findOne({ user_id: req.userId.toString() });
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    // Verify the photo exists in the user's photos array
    if (!profile.photos.includes(photoUrl)) {
      return res.status(400).json({ message: 'Photo not found in user\'s photos' });
    }

    profile.profile_picture_url = photoUrl;
    await profile.save();

    res.json({ success: true, profile_picture_url: photoUrl });
  } catch (error) {
    logger.error('[PROFILE-PICTURE] Error updating profile picture:', error.message);
    res.status(500).json({ message: 'Error updating profile picture' });
  }
});

// GET /api/users/:id - Get another user's public profile
router.get('/:id', auth, validateIdParams('id'), async (req, res) => {
  try {
    const me = req.userId.toString();
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isSelf = user._id.toString() === me;
    const viewerIsAdmin = req.user.role === 'admin';

    // Deleted, banned and paused accounts are not shown to other members.
    if (!isSelf && !viewerIsAdmin && (user.is_deleted || user.is_banned || user.is_disabled)) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.is_deleted) {
      return res.status(404).json({ message: 'User not found' });
    }

    // A block hides each person from the other completely. Before this check
    // a blocked member could still open the profile by its address.
    if (!isSelf && !viewerIsAdmin && await isBlockedBetween(me, user._id)) {
      return res.status(404).json({ message: 'User not found' });
    }

    const profile = await Profile.findOne({ user_id: user._id.toString() });

    const [favorite, match, like, online] = await Promise.all([
      Favorite.findOne({ user_id: me, favorite_user_id: user._id.toString() }),
      Match.findOne({ users: { $all: [me, user._id.toString()] }, is_active: true }),
      Like.findOne({ from_user: me, to_user: user._id.toString(), type: { $in: ['like', 'superlike'] } }),
      (async () => isOnline(user._id) && await sharesOnlineStatus(user._id))()
    ]);

    res.json({
      user: {
        _id: user._id,
        id: user._id,
        first_name: user.first_name,
        last_name: user.last_name,
        // Age only: the full date of birth is nobody else's business.
        age: calculateAge(user.birthdate),
        gender: user.gender,
        photos: profile?.photos || [],
        profile_picture_url: profile?.profile_picture_url || null,
        email_verified: Boolean(user.email_verified),
        member_since: user.created_at,
        is_online: Boolean(online),
      },
      relationship: {
        is_favorite: Boolean(favorite),
        match_id: match ? match._id : null,
        is_liked: Boolean(like),
        like_id: like ? like._id : null
      },
      profile: {
        bio: profile?.bio || '',
        occupation: profile?.occupation || '',
        education: profile?.education || '',
        interests: profile?.interests || [],
        location_city: profile?.location_city || '',
        location_state: profile?.location_state || '',
        district_number: profile?.district_number || '',
        favorite_music: profile?.favorite_music || [],
        animals: profile?.animals || [],
        pet_peeves: profile?.pet_peeves || [],
        looking_for_description: profile?.looking_for_description || [],
        life_goals: profile?.life_goals || [],
        languages: profile?.languages || [],
        cultural_background: profile?.cultural_background || '',
        religion: profile?.religion || '',
        personal_preferences: profile?.personal_preferences || '',
        height: profile?.height || '',
        body_type: profile?.body_type || '',
        ethnicity: profile?.ethnicity || '',
        drinking: profile?.drinking || '',
        smoking: profile?.smoking || '',
        wants_kids: profile?.wants_kids || '',
        prompt_good_at: profile?.prompt_good_at || '',
        prompt_perfect_weekend: profile?.prompt_perfect_weekend || '',
        prompt_message_if: profile?.prompt_message_if || '',
        hoping_to_find: profile?.hoping_to_find || '',
        great_day: profile?.great_day || '',
        relationship_values: profile?.relationship_values || '',
        show_affection: profile?.show_affection || '',
        build_with_person: profile?.build_with_person || ''
      }
    });
  } catch (error) {
    logger.error('[USER] Error fetching user:', error.message);
    res.status(500).json({ message: 'Error fetching user' });
  }
});

export default router;
