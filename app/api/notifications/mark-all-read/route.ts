import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/db';
import { Notification, AdminAnnouncement } from '@/lib/models';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

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

    // Mark all unread notifications as read for this user
    await Notification.updateMany(
      { user_id: userId, read: false },
      { $set: { read: true } }
    );

    // Mark all announcements as read for this user by adding them to read_by array
    await AdminAnnouncement.updateMany(
      { read_by: { $ne: userId } },
      { $push: { read_by: userId } }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    return NextResponse.json({ message: 'Error marking notifications as read' }, { status: 500 });
  }
}
