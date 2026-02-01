import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/db';
import { Notification } from '@/lib/models';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// PUT /api/notifications/[notificationId]/read - Mark as read
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  try {
    await dbConnect();
    
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const userId = decoded.userId;
    
    const { notificationId } = await params;

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, user_id: userId },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return NextResponse.json({ message: 'Notification not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Mark notification read error:', error);
    return NextResponse.json({ message: 'Error updating notification' }, { status: 500 });
  }
}
