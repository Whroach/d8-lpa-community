import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from './models/User.js';
import Profile from './models/Profile.js';

// Load environment variables from root .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootEnvPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: rootEnvPath });

async function createAdminAccount() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/dating-app');
    console.log('Connected to MongoDB');

    // Admin account details
    const adminEmail = 'admin@d8lpa.com';
    const adminPassword = 'Admin123!'; // Change this to a secure password
    const adminFirstName = 'Admin';
    const adminLastName = 'User';

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      console.log('Admin account already exists!');
      console.log('Email:', adminEmail);
      console.log('You can update the password if needed.');
      
      // Optionally update the password
      const updatePassword = process.argv.includes('--update-password');
      if (updatePassword) {
        // Set password directly - let the pre-save hook hash it
        existingAdmin.password = adminPassword;
        await existingAdmin.save();
        console.log('Password updated successfully!');
      }
      
      await mongoose.disconnect();
      return;
    }

    // Create admin user - password will be hashed by the pre-save hook
    const adminUser = await User.create({
      email: adminEmail,
      password: adminPassword, // Pass plain password - model will hash it
      first_name: adminFirstName,
      last_name: adminLastName,
      birthdate: new Date('1990-01-01'), // Set a default birthdate
      gender: 'other',
      looking_for: ['male', 'female', 'non-binary', 'everyone'],
      looking_for_relationship: 'not-sure',
      photos: [],
      onboarding_completed: true,
      role: 'admin', // Set admin role
      is_verified: true,
      is_banned: false,
      is_suspended: false
    });

    // Create admin profile
    await Profile.create({
      user_id: adminUser._id,
      bio: 'System Administrator',
      occupation: 'Administrator',
      location_city: 'Admin',
      location_state: 'PA',
      education: 'other',
      height: 170,
      body_type: 'average',
      ethnicity: 'other',
      religion: 'prefer-not-to-say',
      smoking: 'never',
      drinking: 'never',
      wants_kids: 'not-sure',
      has_kids: 'no',
      relationship_status: 'single',
      interests: ['Technology', 'Management'],
      age_preference_min: 18,
      age_preference_max: 99,
      distance_preference: 100,
      looking_for_gender: ['male', 'female', 'non-binary'],
      looking_for_description: 'N/A',
      life_goals: 'System administration',
      languages: ['English'],
      cultural_background: 'N/A',
      personal_preferences: 'N/A'
    });

    console.log('\n✅ Admin account created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email:', adminEmail);
    console.log('🔑 Password:', adminPassword);
    console.log('👤 Role: admin');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n⚠️  IMPORTANT: Please change the password after first login!');
    console.log('\nYou can now login at http://localhost:3000/login\n');

  } catch (error) {
    console.error('Error creating admin account:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
createAdminAccount();
