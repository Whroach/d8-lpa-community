import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import { UserNotificationSettings, UserPrivacySettings } from '@/lib/models';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const userId = decoded.userId;

    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    // Get or create notification settings
    let notificationSettings = await UserNotificationSettings.findOne({ user_id: userId });
    if (!notificationSettings) {
      notificationSettings = await UserNotificationSettings.create({ user_id: userId });
    }

    // Get or create privacy settings
    let privacySettings = await UserPrivacySettings.findOne({ user_id: userId });
    if (!privacySettings) {
      privacySettings = await UserPrivacySettings.create({ user_id: userId });
    }

    return NextResponse.json({
      notifications: {
        matches: notificationSettings.matches,
        messages: notificationSettings.messages,
        likes: notificationSettings.likes,
        events: notificationSettings.events,
        admin_news: notificationSettings.admin_news,
      },
      lookingFor: currentUser.looking_for || [],
      privacy: {
        profileVisible: privacySettings.profile_visible,
        selectiveMode: privacySettings.selective_mode,
      },
    });
  } catch (error) {
    console.error('Get settings error:', error);
    return NextResponse.json({ message: 'Error fetching settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await dbConnect();
    
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const userId = decoded.userId;

    const { notifications, privacy, lookingFor } = await request.json();

    // Update notification settings
    await UserNotificationSettings.findOneAndUpdate(
      { user_id: userId },
      {
        matches: notifications.matches,
        messages: notifications.messages,
        likes: notifications.likes,
        events: notifications.events,
        admin_news: notifications.admin_news,
        updated_at: new Date(),
      },
      { upsert: true, new: true }
    );

    // Update privacy settings
    await UserPrivacySettings.findOneAndUpdate(
      { user_id: userId },
      {
        profile_visible: privacy.profileVisible,
        selective_mode: privacy.selectiveMode,
        updated_at: new Date(),
      },
      { upsert: true, new: true }
    );

    // Update looking_for on user
    if (Array.isArray(lookingFor)) {
      await User.findByIdAndUpdate(userId, {
        looking_for: lookingFor,
      });
    }

    return NextResponse.json({
      notifications,
      lookingFor: Array.isArray(lookingFor) ? lookingFor : [],
      privacy,
    });
  } catch (error) {
    console.error('Update settings error:', error);
    return NextResponse.json({ message: 'Error updating settings' }, { status: 500 });
  }
}
