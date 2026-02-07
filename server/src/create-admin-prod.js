import mongoose from 'mongoose';
import User from './models/User.js';
import Profile from './models/Profile.js';

// Production database URI
const MONGODB_URI = 'mongodb+srv://lpa-d8:Qd1gXd48ljTQDzGP3477UeNrlQrdRjhG7eXpQ@cluster0.iogpu.mongodb.net/prod?retryWrites=true&w=majority&appName=Cluster0';

const adminEmail = 'williamsonroach@gmail.com';
const adminPassword = 'UhhcHB5SGVuc';

async function createAdminAccount() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      console.log('✗ Admin account already exists - deleting old one...');
      await User.deleteOne({ email: adminEmail });
      // Also delete associated profile
      if (existingAdmin._id) {
        await Profile.deleteOne({ user_id: existingAdmin._id });
      }
      console.log('✓ Old admin account deleted');
    }

    // Create admin user without pre-hashing - let the model handle it
    const adminUser = new User({
      email: adminEmail,
      password: adminPassword, // Don't hash here - let the pre-save hook do it
      role: 'admin',
      email_verified: true,
      onboarding_completed: false,
      first_name: 'Admin',
      last_name: 'Account',
      status: 'active',
    });

    await adminUser.save();
    console.log('✓ Admin user created:', adminUser._id);

    // Create profile for admin
    const adminProfile = new Profile({
      user_id: adminUser._id,
    });

    await adminProfile.save();
    console.log('✓ Admin profile created');

    // Verify the password works
    const savedUser = await User.findOne({ email: adminEmail });
    const passwordMatch = await savedUser.comparePassword(adminPassword);
    console.log('✓ Password verification: ' + (passwordMatch ? 'PASS' : 'FAIL'));

    console.log('\n✅ Admin account created successfully!');
    console.log('Email:', adminEmail);
    console.log('Password:', adminPassword);
    console.log('Role: admin');
    console.log('User ID:', adminUser._id);

    await mongoose.disconnect();
    console.log('\n✓ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('✗ Error creating admin account:', error.message);
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

createAdminAccount();
