import express from 'express';
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { auth } from '../middleware/auth.js';
import User from '../models/User.js';
import Profile from '../models/Profile.js';
import Match from '../models/Match.js';
import Message from '../models/Message.js';
import Like from '../models/Like.js';
import Notification from '../models/Notification.js';
import logger from '../utils/logger.js';

// Load environment variables from root .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootEnvPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: rootEnvPath });

const router = express.Router();

// Configure S3 client
const AWS_REGION = process.env.AWS_REGION;
const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;
const NODE_ENV = process.env.NODE_ENV || 'production';
const ENVIRONMENT_FOLDER = NODE_ENV === 'development' ? 'development' : 'production';

logger.log('AWS Configuration:', {
  region: AWS_REGION,
  bucket: BUCKET_NAME,
  environment: ENVIRONMENT_FOLDER,
  hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
  hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY
});

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
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// GET /api/users/profile
router.get('/profile', auth, async (req, res) => {
  try {
    const profile = await Profile.findOne({ user_id: req.userId });
    
    // Get stats
    const matchesCount = await Match.countDocuments({ 
      users: req.userId, 
      is_active: true 
    });
    
    const likesReceived = await Like.countDocuments({ 
      to_user: req.userId, 
      type: { $in: ['like', 'superlike'] } 
    });

    const stats = {
      matches_count: matchesCount,
      likes_received: likesReceived,
      profile_views: Math.floor(Math.random() * 200) // Placeholder
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
      build_with_person
    } = req.body;

    // Update user - only basic user info
    const user = req.user;
    if (first_name !== undefined) user.first_name = first_name;
    if (last_name !== undefined) user.last_name = last_name;
    if (birthdate !== undefined) user.birthdate = birthdate;
    if (gender !== undefined) user.gender = gender;
    await user.save();

    // Update profile - all profile-related fields
    let profile = await Profile.findOne({ user_id: req.userId });
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
    
    // Music, Animals, Pet Peeves
    if (favorite_music !== undefined) profile.favorite_music = favorite_music;
    if (custom_music !== undefined) profile.custom_music = custom_music;
    if (animals !== undefined) profile.animals = animals;
    if (custom_animal !== undefined) profile.custom_animal = custom_animal;
    if (pet_peeves !== undefined) profile.pet_peeves = pet_peeves;
    if (custom_peeve !== undefined) profile.custom_peeve = custom_peeve;
    if (photos !== undefined) profile.photos = photos;
    
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
    logger.error('[PROFILE] Error updating profile:', error.message);
    res.status(500).json({ message: 'Error updating profile' });
  }
});

// DELETE /api/users/profile
router.delete('/profile', auth, async (req, res) => {
  try {
    const userId = req.userId;

    // Delete user's data
    await Profile.deleteOne({ user_id: userId });
    await Like.deleteMany({ $or: [{ from_user: userId }, { to_user: userId }] });
    await Message.deleteMany({ sender_id: userId });
    await Notification.deleteMany({ user_id: userId });
    
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
      return res.status(400).json({ message: 'No photo provided' });
    }

    const file = req.file;
    const userId = req.userId;
    const isProfilePicture = req.body.isProfilePicture === 'true' || req.body.isProfilePicture === true;

    // Generate unique filename with subfolder based on type
    // Format: {environment}/users/{userId}/{subfolder}/{timestamp}-{random}.{ext}
    const fileExtension = file.originalname.split('.').pop();
    const subfolder = isProfilePicture ? 'profilePicture' : 'photos';
    const fileName = `${ENVIRONMENT_FOLDER}/users/${userId}/${subfolder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;

    logger.log('[UPLOAD] Starting photo upload:', { fileName, isProfilePicture, userId });

    // Upload to S3
    const uploadParams = {
      Bucket: BUCKET_NAME,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    await s3Client.send(new PutObjectCommand(uploadParams));
    logger.log('[UPLOAD] Photo uploaded to S3:', { fileName, photoUrl: `https://${BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${fileName}` });

    // Generate the photo URL
    const photoUrl = `https://${BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${fileName}`;

    // Add photo to profile's photos array (not user)
    let profile = await Profile.findOne({ user_id: userId });
    if (!profile) {
      profile = new Profile({ user_id: userId });
    }
    
    if (!profile.photos) {
      profile.photos = [];
    }
    profile.photos.push(photoUrl);
    
    // If this is the first photo or explicitly marked as profile picture, set it as profile_picture_url
    if (profile.photos.length === 1 || isProfilePicture) {
      profile.profile_picture_url = photoUrl;
      logger.log('[UPLOAD] Set as profile picture:', { url: photoUrl });
    }
    
    await profile.save();

    logger.log('[UPLOAD] Photo added to profile successfully:', { url: photoUrl, totalPhotos: profile.photos.length, isProfilePicture });

    res.json({ url: photoUrl, isProfilePicture: profile.profile_picture_url === photoUrl });
  } catch (error) {
    logger.error('[UPLOAD] Error uploading photo:', error.message);
    logger.error('[UPLOAD] Error stack:', error.stack);
    res.status(500).json({ message: 'Error uploading photo', error: error.message });
  }
});

// DELETE /api/users/photos
router.delete('/photos', auth, async (req, res) => {
  try {
    const { url } = req.body;
    
    // Delete from profile (not user)
    const profile = await Profile.findOne({ user_id: req.userId });
    if (profile) {
      profile.photos = profile.photos.filter(p => p !== url);
      
      // If deleted photo was the profile picture, set the first remaining photo
      if (profile.profile_picture_url === url) {
        profile.profile_picture_url = profile.photos.length > 0 ? profile.photos[0] : null;
      }
      
      await profile.save();
      logger.log('[DELETE] Photo deleted from profile:', { url, remainingPhotos: profile.photos.length });
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
    
    if (!photoUrl) {
      return res.status(400).json({ message: 'Photo URL required' });
    }
    
    const profile = await Profile.findOne({ user_id: req.userId });
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    
    // Verify the photo exists in the user's photos array
    if (!profile.photos.includes(photoUrl)) {
      return res.status(400).json({ message: 'Photo not found in user\'s photos' });
    }
    
    profile.profile_picture_url = photoUrl;
    await profile.save();
    
    logger.log('[PROFILE-PICTURE] Updated profile picture:', { userId: req.userId, photoUrl });
    
    res.json({ success: true, profile_picture_url: photoUrl });
  } catch (error) {
    logger.error('[PROFILE-PICTURE] Error updating profile picture:', error.message);
    res.status(500).json({ message: 'Error updating profile picture' });
  }
});

// GET /api/users/:id - Get another user's public profile
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Hide deleted users
    if (user.is_deleted) {
      return res.status(404).json({ message: 'User not found' });
    }

    const profile = await Profile.findOne({ user_id: user._id });

    // Calculate age
    const birthDate = new Date(user.birthdate);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    res.json({
      user: {
        _id: user._id,
        first_name: user.first_name,
        last_name: user.last_name,
        age,
        gender: user.gender,
        photos: profile?.photos || [],
        birthdate: user.birthdate,
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
