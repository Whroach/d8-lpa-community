import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcryptjs from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import Profile from '../models/Profile.js';
import LPAMembership from '../models/LPAMembership.js';
import { auth } from '../middleware/auth.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/email.js';
import logger from '../utils/logger.js';
import config from '../config/env.js';
import { calculateAge, keepOwnPhotos, normalizeLookingFor, validationMessage } from '../utils/helpers.js';

const router = express.Router();
// Production always sends real verification emails. Elsewhere accounts are
// auto-verified unless REQUIRE_EMAIL_VERIFICATION=true (used by the tests).
const isProduction = config.requireEmailVerification;
// Opt-in: refuse sign-in until the email address has been verified.
const enforceVerificationAtLogin = () => process.env.ENFORCE_EMAIL_VERIFICATION === 'true';
const INVALID_LOGIN = 'That email or password is not right. Please check both and try again.';

// Generate JWT token with expiration
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// Generate refresh token (longer expiration for refresh)
const generateRefreshToken = (userId) => {
  return jwt.sign({ userId, type: 'refresh' }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// Validate password complexity
const validatePasswordStrength = (password) => {
  const errors = [];
  if (password.length < 8) errors.push('Password must be at least 8 characters long');
  if (!/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter');
  if (!/\d/.test(password)) errors.push('Password must contain at least one number');
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push('Password must contain at least one special character');
  return { isValid: errors.length === 0, errors };
};

// Generate verification code
const generateVerificationCode = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

// POST /api/auth/signup
router.post('/signup', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).trim()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('[SIGNUP] Validation error:', errors.array()[0].msg);
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { email, password } = req.body;

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ message: 'Password does not meet security requirements', errors: passwordValidation.errors });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Generate verification code
    const verificationCode = generateVerificationCode();

    // Create user
    const user = new User({
      email,
      password,
      verification_code: verificationCode,
      verification_code_expires: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    });

    // In development, auto-verify the email
    if (!isProduction) {
      user.email_verified = true;
      user.verification_code = undefined;
      user.verification_code_expires = undefined;
    }

    await user.save();

    // Create empty profile
    const profile = new Profile({ user_id: user._id });
    await profile.save();

    const token = generateToken(user._id);

    logger.info(`[SIGNUP] Account created: ${user._id}, requiresVerification: ${isProduction}`);

    // Send verification email in background (don't await, don't block response)
    if (isProduction) {
      sendVerificationEmail(email, verificationCode)
        .catch((emailError) => {
          logger.error('[SIGNUP] Failed to send verification email:', emailError.message);
        });
    }

    res.status(201).json({
      user_id: user._id,
      email: user.email,
      token,
      requiresVerification: isProduction  // Only requires verification in production
    });
  } catch (error) {
    logger.error('[SIGNUP] Error creating account:', error.message);
    logger.error('[SIGNUP] Error stack:', error.stack);
    res.status(500).json({ message: 'We could not create your account just now. Please try again.' });
  }
});

// POST /api/auth/verify-email
router.post('/verify-email', [
  body('email').isEmail().normalizeEmail(),
  body('code').isLength({ min: 6, max: 6 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('[VERIFY] Validation error:', errors.array()[0].msg);
      return res.status(400).json({ message: 'Invalid email or code format' });
    }

    const { email, code } = req.body;


    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    if (user.email_verified) {
      return res.json({ message: 'Email already verified' });
    }

    if (!user.verification_code || user.verification_code !== String(code)) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    if (!user.verification_code_expires || user.verification_code_expires < new Date()) {
      return res.status(400).json({ message: 'Verification code expired' });
    }

    user.email_verified = true;
    user.verification_code = undefined;
    user.verification_code_expires = undefined;
    await user.save();

    logger.info('[VERIFY] Email verified for user id:', String(user._id));
    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    logger.error('[VERIFY] Error verifying email:', error.message);
    logger.error('[VERIFY] Error stack:', error.stack);
    res.status(500).json({ message: 'Error verifying email' });
  }
});

// POST /api/auth/resend-verification
router.post('/resend-verification', [
  body('email').isEmail().normalizeEmail()
], async (req, res, next) => {
  try {
    const { email } = req.body;


    const user = await User.findOne({ email });
    if (!user || user.email_verified) {
      // Same answer either way, so this can't be used to test which
      // addresses have accounts.
      return res.json({ message: 'Verification code sent' });
    }

    const verificationCode = generateVerificationCode();
    user.verification_code = verificationCode;
    user.verification_code_expires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();


    // Send verification email in background (don't await, don't block response)
    if (isProduction) {
      sendVerificationEmail(email, verificationCode)
        .catch((emailError) => {
          logger.error('[RESEND] Failed to send verification email:', emailError.message);
        });
    }

    res.json({ message: 'Verification code sent' });
  } catch (error) {
    logger.error('[RESEND] Error sending verification code:', error.message);
    logger.error('[RESEND] Error stack:', error.stack);
    res.status(500).json({ message: 'Error sending verification code' });
  }
});

// POST /api/auth/login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').exists()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('[LOGIN] Validation error:', errors.array()[0].msg);
      return res.status(400).json({ message: INVALID_LOGIN });
    }

    const { email, password } = req.body;
    if (typeof password !== 'string') {
      return res.status(400).json({ message: INVALID_LOGIN });
    }

    // One answer for "no such account" and "wrong password", so the login
    // form can't be used to discover who is a member.
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: INVALID_LOGIN });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      logger.warn(`[LOGIN] Wrong password for user id: ${user._id}`);
      return res.status(401).json({ message: INVALID_LOGIN });
    }

    if (enforceVerificationAtLogin() && !user.email_verified && user.role !== 'admin') {
      return res.status(403).json({
        message: 'Please verify your email address first. Use the code we emailed you, or ask for a new one.',
        requiresVerification: true,
        email: user.email
      });
    }

    if (user.is_banned) {
      return res.status(403).json({ message: 'Your account has been suspended or banned. Please contact d8lpa.community@gmail.com for more info.' });
    }

    if (user.is_suspended) {
      return res.status(403).json({ message: 'Your account has been suspended or banned. Please contact d8lpa.community@gmail.com for more info.' });
    }

    if (user.is_deleted) {
      return res.status(403).json({ message: 'Your account has been deleted. Please contact d8lpa.community@gmail.com if you believe this is an error.' });
    }

    // "Take a Break" promises the member they can log back in any time to
    // reactivate, so signing in is what undoes it.
    if (user.is_disabled) {
      user.is_disabled = false;
      user.disabled_at = null;
      user.disable_reason = '';
      logger.info(`[LOGIN] Reactivated disabled account on login: ${user._id}`);
    }

    const profile = await Profile.findOne({ user_id: user._id });
    const token = generateToken(user._id);

    user.last_active = new Date();
    await user.save();

    logger.info(`[LOGIN] Successful login, user id: ${user._id}`);

    const userJson = user.toJSON();
    res.json({
      user: {
        ...userJson,
        id: userJson._id,
        role: user.role  // Explicitly include role
      },
      profile,
      token
    });
  } catch (error) {
    logger.error('[LOGIN] Login error:', error.message);
    logger.error('[LOGIN] Error stack:', error.stack);
    res.status(500).json({ message: 'Error logging in' });
  }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  try {
    // Check if user has been banned or suspended since login
    const currentUser = await User.findById(req.userId);
    if (!currentUser || currentUser.is_banned || currentUser.is_suspended) {
      logger.warn(`[AUTH/ME] Unauthorized access attempt on banned/suspended account: ${req.userId}`);
      return res.status(403).json({ message: 'Your account has been suspended or banned. Please contact d8lpa.community@gmail.com for more info.' });
    }

    const profile = await Profile.findOne({ user_id: req.userId });
    const userJson = currentUser.toJSON();
    res.json({
      user: {
        ...userJson,
        id: userJson._id,
        role: currentUser.role  // Explicitly include role
      },
      profile
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ message: 'Error fetching user data' });
  }
});

// PUT /api/auth/complete-onboarding
router.put('/complete-onboarding', auth, async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      birthdate,
      gender,
      location_state,
      location_city,
      lpa_membership_id,
      district_number,
      bio,
      occupation,
      education,
      interests,
      favorite_music,
      custom_music,
      animals,
      custom_animal,
      pet_peeves,
      custom_peeve,
      photos,
      looking_for,
      looking_for_relationship,
      looking_for_description,
      life_goals,
      languages,
      cultural_background,
      religion,
      personal_preferences,
      prompt_good_at,
      prompt_perfect_weekend,
      prompt_message_if,
      hoping_to_find,
      great_day,
      relationship_values,
      show_affection,
      build_with_person,
      agreed_to_guidelines,
      age_preference_min,
      age_preference_max
    } = req.body;

    // Members must be adults. The form checks this too, but the form is not
    // the only way to reach this endpoint.
    if (birthdate) {
      const age = calculateAge(birthdate);
      if (age === null || age < 18 || age > 120) {
        return res.status(400).json({ message: 'You must be 18 or older to join. Please check your date of birth.' });
      }
    }

    // Get fresh user object from database
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update user with only basic info
    user.first_name = first_name || user.first_name;
    user.last_name = last_name || user.last_name;
    user.birthdate = birthdate || user.birthdate;
    user.gender = gender || user.gender;
    user.agreed_to_guidelines = agreed_to_guidelines !== undefined ? agreed_to_guidelines : user.agreed_to_guidelines;
    user.onboarding_completed = true;
    await user.save();


    // Update or create profile
    let profile = await Profile.findOne({ user_id: req.userId });
    if (!profile) {
      profile = new Profile({ user_id: req.userId });
    }

    // Basic profile info
    profile.location_state = location_state || profile.location_state;
    profile.location_city = location_city || profile.location_city;
    profile.district_number = district_number || profile.district_number;
    profile.lpa_membership_id = lpa_membership_id || profile.lpa_membership_id;
    profile.bio = bio || profile.bio;
    profile.occupation = occupation || profile.occupation;
    profile.education = education || profile.education;
    // Photos are uploaded through /users/photos; this list may only reorder
    // or drop them, never add a URL of the client's choosing.
    if (Array.isArray(photos)) {
      const kept = keepOwnPhotos(photos, profile.photos);
      if (kept.length > 0 || photos.length === 0) profile.photos = kept;
    }

    // Set profile picture from photos array (use first photo if available)
    if (profile.photos.length > 0 && !profile.profile_picture_url) {
      profile.profile_picture_url = profile.photos[0];
    }

    // Age range chosen during onboarding (it used to be thrown away here).
    if (age_preference_min !== undefined || age_preference_max !== undefined) {
      const min = Math.min(120, Math.max(18, Number(age_preference_min) || 18));
      const max = Math.min(120, Math.max(18, Number(age_preference_max) || 99));
      profile.age_preference_min = Math.min(min, max);
      profile.age_preference_max = Math.max(min, max);
    }

    // Interests and preferences
    profile.interests = interests || profile.interests;
    profile.favorite_music = favorite_music || profile.favorite_music;
    profile.custom_music = custom_music || profile.custom_music;
    profile.animals = animals || profile.animals;
    profile.custom_animal = custom_animal || profile.custom_animal;
    profile.pet_peeves = pet_peeves || profile.pet_peeves;
    profile.custom_peeve = custom_peeve || profile.custom_peeve;

    // Looking for
    if (looking_for && Array.isArray(looking_for)) {
      profile.looking_for_gender = normalizeLookingFor(looking_for);
    }
    profile.looking_for_relationship = looking_for_relationship || profile.looking_for_relationship;
    profile.looking_for_description = looking_for_description ? (Array.isArray(looking_for_description) ? looking_for_description : [looking_for_description]) : profile.looking_for_description;
    profile.life_goals = life_goals ? (Array.isArray(life_goals) ? life_goals : [life_goals]) : profile.life_goals;
    profile.languages = languages || profile.languages;
    profile.cultural_background = cultural_background || profile.cultural_background;
    profile.religion = religion || profile.religion;
    profile.personal_preferences = personal_preferences || profile.personal_preferences;

    // Prompts
    profile.prompt_good_at = prompt_good_at || profile.prompt_good_at;
    profile.prompt_perfect_weekend = prompt_perfect_weekend || profile.prompt_perfect_weekend;
    profile.prompt_message_if = prompt_message_if || profile.prompt_message_if;

    // Open-ended questions
    profile.hoping_to_find = hoping_to_find || profile.hoping_to_find;
    profile.great_day = great_day || profile.great_day;
    profile.relationship_values = relationship_values || profile.relationship_values;
    profile.show_affection = show_affection || profile.show_affection;
    profile.build_with_person = build_with_person || profile.build_with_person;

    await profile.save();

    logger.log('[ONBOARDING] Profile saved successfully');

    // Save LPA Membership
    if (lpa_membership_id) {
      try {
        const normalizedId = lpa_membership_id.trim().toUpperCase();

        // Check if membership already exists and update, or create new
        let membership = await LPAMembership.findOne({ user_id: req.userId });

        if (membership) {
          membership.lpa_membership_id = normalizedId;
          membership.is_active = true;
        } else {
          membership = new LPAMembership({
            user_id: req.userId,
            lpa_membership_id: normalizedId,
            is_active: true
          });
        }

        await membership.save();
        logger.log('[ONBOARDING] LPA Membership saved for user:', req.userId);
      } catch (error) {
        logger.error('[ONBOARDING] Error saving LPA Membership:', error.message);
        // Don't fail the onboarding if membership save fails
      }
    }

    res.json({
      user: user.toJSON(),
      profile: profile.toJSON()
    });
  } catch (error) {
    logger.error('[ONBOARDING] Error completing onboarding:', error.message);
    const friendly = validationMessage(error);
    if (friendly) return res.status(400).json({ message: friendly });
    res.status(500).json({ message: 'We could not save your profile just now. Please try again.' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail()
], async (req, res, next) => {
  try {
    const { email } = req.body;


    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if email exists
      return res.json({ message: 'If an account exists, a reset link will be sent' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.password_reset_token = resetToken;
    user.password_reset_expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();


    // Send reset email in background (don't await, don't block response)
    if (isProduction) {
      sendPasswordResetEmail(email, resetToken)
        .catch((emailError) => {
          logger.error('[FORGOT-PASSWORD] Failed to send email:', emailError.message);
        });
    }

    res.json({ message: 'If an account exists, a reset link will be sent' });
  } catch (error) {
    logger.error('[FORGOT-PASSWORD] Error in forgot password:', error.message);
    logger.error('[FORGOT-PASSWORD] Error stack:', error.stack);
    res.status(500).json({ message: 'Error processing request' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', [
  body('token').exists(),
  body('password').isLength({ min: 6 })
], async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (typeof token !== 'string' || typeof password !== 'string' || token.length < 32) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    const user = await User.findOne({
      password_reset_token: token,
      password_reset_expires: { $gt: new Date() }
    });

    if (!user) {
      logger.warn(`[RESET-PASSWORD] Invalid or expired reset token attempted`);
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }


    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ message: 'Password does not meet security requirements', errors: passwordValidation.errors });
    }

    user.password = password;
    user.password_reset_token = undefined;
    user.password_reset_expires = undefined;
    await user.save();

    logger.info(`[RESET-PASSWORD] Password reset for user id: ${user._id}`);

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    logger.error('[RESET-PASSWORD] Reset password error:', error.message);
    logger.error('[RESET-PASSWORD] Error stack:', error.stack);
    res.status(500).json({ message: 'Error resetting password' });
  }
});

// POST /api/auth/check-membership-id - Check if LPA membership ID exists
router.post('/check-membership-id', auth, async (req, res) => {
  try {
    const { lpa_membership_id } = req.body;

    if (typeof lpa_membership_id !== 'string' || lpa_membership_id.trim() === '') {
      return res.status(400).json({
        exists: false,
        message: 'Membership ID is required'
      });
    }

    const normalizedId = lpa_membership_id.trim().toUpperCase();

    // Check if membership ID already exists
    const existingMembership = await LPAMembership.findOne({
      lpa_membership_id: normalizedId,
      is_active: true,
      // Your own number is not "already taken".
      user_id: { $ne: req.userId.toString() }
    });

    if (existingMembership) {
      return res.json({
        exists: true,
        message: 'This LPA Membership ID already exists'
      });
    }

    res.json({
      exists: false,
      message: 'Membership ID is available'
    });
  } catch (error) {
    logger.error('[CHECK-MEMBERSHIP-ID] Error:', error.message);
    res.status(500).json({
      exists: false,
      message: 'Error checking membership ID'
    });
  }
});

// POST /api/auth/change-password
// Change user's password
// Requires: current_password, new_password
// Authentication: Required (JWT token)
router.post('/change-password', auth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (typeof current_password !== 'string' || typeof new_password !== 'string' || !current_password || !new_password) {
      return res.status(400).json({ message: 'Please enter your current password and a new password.' });
    }

    const strength = validatePasswordStrength(new_password);
    if (!strength.isValid) {
      return res.status(400).json({ message: strength.errors[0], errors: strength.errors });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isPasswordValid = await bcryptjs.compare(current_password, user.password);
    if (!isPasswordValid) {
      // 400, not 401: the client treats 401 as "session ended" and would sign
      // the member out for a simple typo.
      return res.status(400).json({ message: 'Your current password is not right. Please try again.' });
    }

    if (await bcryptjs.compare(new_password, user.password)) {
      return res.status(400).json({ message: 'Your new password must be different from your current one.' });
    }

    // Assign the plain password and let the model's pre-save hook hash it.
    // This used to hash here as well, so the stored value was a hash of a
    // hash and the member could never sign in again after changing password.
    user.password = new_password;
    await user.save();

    logger.info('[CHANGE-PASSWORD] Password changed for user id:', String(req.userId));
    return res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    logger.error('[CHANGE-PASSWORD] Error:', error.message);
    return res.status(500).json({ message: 'We could not change your password just now. Please try again.' });
  }
});

export default router;
