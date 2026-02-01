import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Profile from './models/Profile.js';
import User from './models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootEnvPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: rootEnvPath });

const updateGenderPreference = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const email = process.argv[2];
    const genderPreference = process.argv[3]; // 'male', 'female', or 'male,female'

    if (!email || !genderPreference) {
      console.log('Usage: npm run update-gender <email> <gender-preference>');
      console.log('Example: npm run update-gender user@example.com female');
      console.log('Example: npm run update-gender user@example.com male,female');
      process.exit(1);
    }

    const user = await User.findOne({ email });
    if (!user) {
      console.log(`User with email ${email} not found`);
      process.exit(1);
    }

    const genderArray = genderPreference.split(',').map(g => g.trim().toLowerCase());
    
    user.looking_for = genderArray;
    await user.save();

    console.log(`✓ Updated ${email}'s gender preference to: ${genderArray.join(', ')}`);
    console.log(`User ID: ${user._id}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

updateGenderPreference();
