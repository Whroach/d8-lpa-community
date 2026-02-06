import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import Profile from '../models/Profile.js';
import { auth } from '../middleware/auth.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/email.js';
import logger from '../utils/logger.js';

const router = express.Router();
const isProduction = process.env.NODE_ENV === 'production';

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
  return Math.floor(100000 + Math.random() * 900000).toString();
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
      logger.warn('[SIGNUP] Weak password attempt for email:', email);
      return res.status(400).json({ message: 'Password does not meet security requirements', errors: passwordValidation.errors });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      logger.warn('[SIGNUP] Duplicate email registration attempt:', email);
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

    // Send verification email only in production
    if (isProduction) {
      try {
        await sendVerificationEmail(email, verificationCode);
        logger.info(`[SIGNUP] Verification email sent to: ${email}`);
      } catch (emailError) {
        logger.error(`[SIGNUP] Failed to send verification email to ${email}:`, emailError.message);
        // Don't fail the signup if email fails, but user won't be verified
      }
    } else {
      logger.log(`[DEV] Auto-verifying user: ${email} (verification code: ${verificationCode})`);
    }

    const token = generateToken(user._id);

    logger.info(`[SIGNUP] Account created successfully: ${email}, requiresVerification: ${isProduction}`);

    res.status(201).json({
      user_id: user._id,
      email: user.email,
      token,
      requiresVerification: isProduction  // Only requires verification in production
    });
  } catch (error) {
    logger.error('[SIGNUP] Error creating account:', error.message);
    logger.error('[SIGNUP] Error stack:', error.stack);
    res.status(500).json({ message: 'Error creating account', error: error.message });
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

    logger.log('[VERIFY] Email verification attempt for:', email);

    const user = await User.findOne({ email });
    if (!user) {
      logger.warn('[VERIFY] User not found:', email);
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.email_verified) {
      logger.log('[VERIFY] Email already verified for:', email);
      return res.json({ message: 'Email already verified' });
    }

    logger.debug('[VERIFY] Verification attempt for:', email, 'with code:', code.substring(0, 3) + '***');

    if (user.verification_code !== code) {
      logger.warn('[VERIFY] Invalid code attempt for:', email);
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    if (user.verification_code_expires < new Date()) {
      logger.warn('[VERIFY] Expired code attempt for:', email);
      return res.status(400).json({ message: 'Verification code expired' });
    }

    user.email_verified = true;
    user.verification_code = undefined;
    user.verification_code_expires = undefined;
    await user.save();

    logger.info('[VERIFY] Email verified successfully for:', email);
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

    logger.log('[RESEND] Verification code resend requested for:', email);

    const user = await User.findOne({ email });
    if (!user) {
      logger.warn('[RESEND] User not found:', email);
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.email_verified) {
      logger.log('[RESEND] Email already verified for:', email);
      return res.json({ message: 'Email already verified' });
    }

    const verificationCode = generateVerificationCode();
    user.verification_code = verificationCode;
    user.verification_code_expires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    logger.log('[RESEND] Verification code generated for:', email);

    // Send verification email
    if (isProduction) {
      try {
        await sendVerificationEmail(email, verificationCode);
        logger.info('[RESEND] Verification email sent successfully to:', email);
      } catch (emailError) {
        logger.error('[RESEND] Failed to send verification email to', email, ':', emailError.message);
        logger.error('[RESEND] Email error details:', {
          code: emailError.code,
          message: emailError.message,
          command: emailError.command
        });
        return res.status(500).json({ 
          message: 'Failed to send verification email. Please try again later.',
          error: emailError.message 
        });
      }
    } else {
      logger.log(`[DEV] New verification code for ${email}: ${verificationCode}`);
    }

    res.json({ message: 'Verification code sent' });
  } catch (error) {
    logger.error('[RESEND] Error sending verification code:', error.message);
    logger.error('[RESEND] Error stack:', error.stack);
    res.status(500).json({ message: 'Error sending verification code', error: error.message });
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
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const { email, password } = req.body;
    
    logger.log(`[LOGIN] Login attempt for email: ${email}`);

    const user = await User.findOne({ email });
    if (!user) {
      logger.warn(`[LOGIN] User not found: ${email}`);
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      logger.warn(`[LOGIN] Invalid password for user: ${email}`);
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (user.is_banned) {
      logger.warn(`[LOGIN] Login attempt on banned account: ${email}`);
      return res.status(403).json({ message: 'Account has been banned' });
    }

    if (user.is_suspended) {
      logger.warn(`[LOGIN] Login attempt on suspended account: ${email}`);
      return res.status(403).json({ message: 'Account is suspended' });
    }

    const profile = await Profile.findOne({ user_id: user._id });
    const token = generateToken(user._id);

    user.last_active = new Date();
    await user.save();

    logger.info(`[LOGIN] Successful login for user: ${email}, User ID: ${user._id}`);

    res.json({
      user: user.toJSON(),
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
    const profile = await Profile.findOne({ user_id: req.userId });
    res.json({
      user: req.user.toJSON(),
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
      lpa_membership_id,
      district_number,
      bio,
      occupation,
      education,
      interests,
      location_city,
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
      agreed_to_guidelines
    } = req.body;

    logger.log('[ONBOARDING] Updating profile for user:', req.userId);
    logger.log('[ONBOARDING] Received payload keys:', Object.keys(req.body));

    // Update user with only basic info
    const user = req.user;
    user.first_name = first_name || user.first_name;
    user.last_name = last_name || user.last_name;
    user.birthdate = birthdate || user.birthdate;
    user.gender = gender || user.gender;
    user.agreed_to_guidelines = agreed_to_guidelines !== undefined ? agreed_to_guidelines : user.agreed_to_guidelines;
    user.onboarding_completed = true;
    await user.save();

    logger.log('[ONBOARDING] User saved with:', { first_name, last_name, birthdate, gender });

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
    profile.photos = photos || profile.photos;
    
    // Set profile picture from photos array (use first photo if available)
    if (photos && Array.isArray(photos) && photos.length > 0 && !profile.profile_picture_url) {
      profile.profile_picture_url = photos[0];
      logger.log('[ONBOARDING] Set profile picture to first photo:', photos[0]);
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
      profile.looking_for_gender = looking_for;
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
    
    await profile.save();

    logger.log('[ONBOARDING] Profile saved with:', { 
      animals: profile.animals, 
      favorite_music: profile.favorite_music,
      custom_animal: profile.custom_animal,
      pet_peeves: profile.pet_peeves 
    });

    res.json({
      user: user.toJSON(),
      profile
    });
  } catch (error) {
    logger.error('[ONBOARDING] Error completing onboarding:', error.message);
    logger.error('[ONBOARDING] Error stack:', error.stack);
    res.status(500).json({ message: 'Error completing onboarding' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail()
], async (req, res, next) => {
  try {
    const { email } = req.body;
    
    logger.log(`[FORGOT-PASSWORD] Request initiated for email: ${email}`);

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if email exists
      logger.warn(`[FORGOT-PASSWORD] Account not found for email: ${email}`);
      return res.json({ message: 'If an account exists, a reset link will be sent' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.password_reset_token = resetToken;
    user.password_reset_expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    logger.log(`[FORGOT-PASSWORD] Reset token generated for: ${email}`);
    logger.log(`[FORGOT-PASSWORD] Reset token expiry: ${user.password_reset_expires}`);

    // Send reset email
    if (isProduction) {
      try {
        await sendPasswordResetEmail(email, resetToken);
        logger.info(`[FORGOT-PASSWORD] Password reset email sent successfully to: ${email}`);
      } catch (emailError) {
        logger.error(`[FORGOT-PASSWORD] Failed to send email to ${email}:`, emailError.message);
        logger.error(`[FORGOT-PASSWORD] Email error details:`, emailError);
        throw emailError;
      }
    } else {
      logger.log(`[DEV] Password reset token for ${email}: ${resetToken}`);
      logger.log(`[DEV] Reset link: ${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`);
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
    
    logger.log(`[RESET-PASSWORD] Reset attempt with token: ${token.substring(0, 10)}...`);

    const user = await User.findOne({
      password_reset_token: token,
      password_reset_expires: { $gt: new Date() }
    });

    if (!user) {
      logger.warn(`[RESET-PASSWORD] Invalid or expired reset token attempted`);
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    logger.log(`[RESET-PASSWORD] Valid token found for user: ${user.email}`);

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      logger.warn(`[RESET-PASSWORD] Weak password attempted for user: ${user.email}`);
      return res.status(400).json({ message: 'Password does not meet security requirements', errors: passwordValidation.errors });
    }

    user.password = password;
    user.password_reset_token = undefined;
    user.password_reset_expires = undefined;
    await user.save();

    logger.info(`[RESET-PASSWORD] Password reset successfully for user: ${user.email}`);

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    logger.error('[RESET-PASSWORD] Reset password error:', error.message);
    logger.error('[RESET-PASSWORD] Error stack:', error.stack);
    res.status(500).json({ message: 'Error resetting password' });
  }
});

// POST /api/auth/signup-admin - Create new admin account
router.post('/signup-admin', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).trim()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('[SIGNUP-ADMIN] Validation error:', errors.array()[0].msg);
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { email, password } = req.body;

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      logger.warn('[SIGNUP-ADMIN] Weak password attempt for email:', email);
      return res.status(400).json({ message: 'Password does not meet security requirements', errors: passwordValidation.errors });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      logger.warn('[SIGNUP-ADMIN] Duplicate email registration attempt:', email);
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Create admin user
    const user = new User({
      email,
      password,
      role: 'admin',  // Set role to admin
      email_verified: true,  // Admin accounts auto-verified
      onboarding_completed: false
    });

    await user.save();

    // Create empty profile
    const profile = new Profile({ user_id: user._id });
    await profile.save();

    const token = generateToken(user._id);

    logger.info(`[SIGNUP-ADMIN] Admin account created successfully: ${email}`);

    res.status(201).json({
      user_id: user._id,
      email: user.email,
      token,
      requiresVerification: false
    });
  } catch (error) {
    logger.error('[SIGNUP-ADMIN] Error creating admin account:', error.message);
    logger.error('[SIGNUP-ADMIN] Error stack:', error.stack);
    res.status(500).json({ message: 'Error creating admin account', error: error.message });
  }
});

export default router;
