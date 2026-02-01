import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/db';
import { Notification, AdminAnnouncement } from '@/lib/models';

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

    // Get user's personal notifications (includes news notifications created for this user)
    const notifications = await Notification.find({ user_id: userId })
      .sort({ created_at: -1 })
      .limit(100);

    // Get AdminAnnouncement records as fallback (in case announcements weren't distributed as notifications)
    const announcements = await AdminAnnouncement.find({})
      .sort({ created_at: -1 })
      .limit(100);

    console.log('[NOTIFICATIONS API] Found', notifications.length, 'notifications for user', userId);
    console.log('[NOTIFICATIONS API] Found', announcements.length, 'AdminAnnouncement records');

    // Format user notifications
    const formattedNotifications = notifications.map(n => ({
      id: n._id.toString(),
      type: n.type,
      title: n.title,
      message: n.message,
      avatar: n.avatar,
      read: n.read,
      created_at: new Date(n.created_at).toISOString(),
      timestamp: new Date(n.created_at).toISOString(),
      related_user: n.related_user,
      related_match: n.related_match,
      related_event: n.related_event
    }));

    // Format announcements as notifications (fallback)
    const formattedAnnouncements = announcements.map(a => ({
      id: a._id.toString(),
      type: 'news',
      title: a.title,
      message: a.message,
      avatar: '',
      read: a.read_by?.includes(userId),
      created_at: new Date(a.created_at).toISOString(),
      timestamp: new Date(a.created_at).toISOString(),
      related_user: a.admin_id?.toString(),
      related_match: undefined,
      related_event: undefined
    }));

    // Combine notifications and announcements, remove duplicates by ID, and sort by created_at (latest first)
    const allNotifications = [...formattedNotifications, ...formattedAnnouncements]
      .filter((item, index, self) => 
        index === self.findIndex((t) => t.id === item.id)
      )
      .sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateB - dateA; // Newest first (descending)
      });

    console.log('[NOTIFICATIONS API] Returning', allNotifications.length, 'total notifications');
    return NextResponse.json(allNotifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    return NextResponse.json({ message: 'Error fetching notifications' }, { status: 500 });
  }
}
