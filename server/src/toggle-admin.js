import mongoose from 'mongoose';
import User from './models/User.js';

// Production database URI
const MONGODB_URI = 'mongodb+srv://lpa-d8:Qd1gXd48ljTQDzGP3477UeNrlQrdRjhG7eXpQ@cluster0.iogpu.mongodb.net/prod?retryWrites=true&w=majority&appName=Cluster0';

async function toggleAdminStatus() {
  const email = process.argv[2];
  const action = process.argv[3]?.toLowerCase() || 'status';

  if (!email) {
    console.log('Usage: node toggle-admin.js <email> [grant|revoke|status]');
    console.log('Examples:');
    console.log('  node toggle-admin.js user@example.com status    # Check admin status');
    console.log('  node toggle-admin.js user@example.com grant     # Grant admin access');
    console.log('  node toggle-admin.js user@example.com revoke    # Revoke admin access');
    process.exit(1);
  }

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    const user = await User.findOne({ email });
    if (!user) {
      console.log(`✗ User not found: ${email}`);
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log(`\nUser: ${user.email}`);
    console.log(`Current Role: ${user.role}`);

    if (action === 'grant') {
      if (user.role === 'admin') {
        console.log('✓ User is already an admin');
      } else {
        user.role = 'admin';
        await user.save();
        console.log('✓ Admin access granted');
      }
    } else if (action === 'revoke') {
      if (user.role === 'user') {
        console.log('✓ User is already a regular user');
      } else {
        user.role = 'user';
        await user.save();
        console.log('✓ Admin access revoked');
      }
    } else if (action === 'status') {
      console.log(`✓ Status: ${user.role === 'admin' ? 'ADMIN' : 'REGULAR USER'}`);
    } else {
      console.log(`✗ Unknown action: ${action}`);
      process.exit(1);
    }

    console.log(`\nUpdated Role: ${user.role}`);

    await mongoose.disconnect();
    console.log('\n✓ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('✗ Error:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

toggleAdminStatus();
