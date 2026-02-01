import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import { AdminAnnouncement, Notification } from '@/lib/models';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Get all announcements (for admin panel - with pagination)
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    
    const adminUser = await User.findById(decoded.userId);
    if (!adminUser || adminUser.role !== 'admin') {
      return NextResponse.json({ message: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '5');
    const skip = (page - 1) * limit;

    const total = await AdminAnnouncement.countDocuments();
    const announcements = await AdminAnnouncement.find()
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);

    return NextResponse.json({
      announcements: announcements.map(a => ({
        id: a._id,
        title: a.title,
        message: a.message,
        admin: a.admin_name,
        is_active: a.is_active,
        created_at: a.created_at,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Get announcements error:', error);
    return NextResponse.json({ message: 'Error fetching announcements' }, { status: 500 });
  }
}

// Create a new announcement and notify all users
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    
    const adminUser = await User.findById(decoded.userId);
    if (!adminUser || adminUser.role !== 'admin') {
      return NextResponse.json({ message: 'Admin access required' }, { status: 403 });
    }

    const { title, message } = await request.json();

    if (!title?.trim() || !message?.trim()) {
      return NextResponse.json({ message: 'Title and message are required' }, { status: 400 });
    }

    // Create announcement
    const announcement = await AdminAnnouncement.create({
      title: title.trim(),
      message: message.trim(),
      admin_id: decoded.userId,
      admin_name: `${adminUser.first_name} ${adminUser.last_name}`,
    });

    // Create notifications for all users
    const allUsers = await User.find({ 
      _id: { $ne: decoded.userId },
      is_banned: false 
    }).select('_id');

    const notifications = allUsers.map(user => ({
      user_id: user._id,
      type: 'news',
      title: title.trim(),
      message: message.trim(),
      avatar: '',
    }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }

    return NextResponse.json({
      id: announcement._id,
      title: announcement.title,
      message: announcement.message,
      admin: announcement.admin_name,
      created_at: announcement.created_at,
    }, { status: 201 });
  } catch (error) {
    console.error('Create announcement error:', error);
    return NextResponse.json({ message: 'Error creating announcement' }, { status: 500 });
  }
}

// Delete an announcement
export async function DELETE(request: NextRequest) {
  try {
    await dbConnect();
    
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    
    const adminUser = await User.findById(decoded.userId);
    if (!adminUser || adminUser.role !== 'admin') {
      return NextResponse.json({ message: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const announcementId = searchParams.get('id');

    if (!announcementId) {
      return NextResponse.json({ message: 'Announcement ID is required' }, { status: 400 });
    }

    await AdminAnnouncement.findByIdAndDelete(announcementId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete announcement error:', error);
    return NextResponse.json({ message: 'Error deleting announcement' }, { status: 500 });
  }
}
