import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import User from './models/User.js';
import Profile from './models/Profile.js';

// Production MongoDB URI (passed as argument or environment variable)
const prodMongoDBUri = 'mongodb+srv://lpa-d8:Qd1gXd48ljTQDzGP3477UeNrlQrdRjhG7eXpQ@cluster0.iogpu.mongodb.net/prod?retryWrites=true&w=majority&appName=Cluster0';

async function createProdAdminAccount() {
  try {
    console.log('🚀 Creating Production Admin Account...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Connect to Production MongoDB
    await mongoose.connect(prodMongoDBUri);
    console.log('✅ Connected to Production MongoDB');

    // Admin account details
    const adminEmail = 'd8lpa.community@gmail.com';
    const adminPassword = 'bxPqkfzBpSFJ8ih7lOO3p';
    const adminFirstName = 'Admin';
    const adminLastName = 'Community';

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      console.log('\n⚠️  Admin account already exists!');
      console.log('Email:', adminEmail);
      console.log('Role:', existingAdmin.role);
      
      // Ask if user wants to update password
      const updatePassword = process.argv.includes('--update-password');
      if (updatePassword) {
        existingAdmin.password = adminPassword;
        await existingAdmin.save();
        console.log('✅ Password updated successfully!');
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
      bio: 'D8 LPA Community Administrator',
      occupation: 'System Administrator',
      location_city: 'Philadelphia',
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
      interests: ['Technology', 'Community Management'],
      age_preference_min: 18,
      age_preference_max: 99,
      distance_preference: 100,
      looking_for_gender: ['male', 'female', 'non-binary'],
      looking_for_description: 'N/A',
      life_goals: 'Community management',
      languages: ['English'],
      cultural_background: 'N/A',
      personal_preferences: 'N/A'
    });

    console.log('\n✅ Production Admin Account Created Successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email:', adminEmail);
    console.log('🔑 Password:', adminPassword);
    console.log('👤 Role: admin');
    console.log('🌍 Database: prod');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n⚠️  IMPORTANT: ');
    console.log('• Save these credentials securely');
    console.log('• Change the password after first login');
    console.log('• Enable 2FA for production security');

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error creating admin account:', error.message);
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the function
createProdAdminAccount();
