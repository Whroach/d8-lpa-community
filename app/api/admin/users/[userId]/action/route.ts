import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import { Notification } from '@/lib/models';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    await dbConnect();
    
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    
    // Check if admin
    const adminUser = await User.findById(decoded.userId);
    if (!adminUser || adminUser.role !== 'admin') {
      return NextResponse.json({ message: 'Admin access required' }, { status: 403 });
    }

    const { userId } = await params;
    const { action, reason } = await request.json();

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    let notificationTitle = '';
    let notificationMessage = '';

    switch (action) {
      case 'warning':
        targetUser.has_warning = true;
        targetUser.warning_count = (targetUser.warning_count || 0) + 1;
        targetUser.warning_message = reason;
        notificationTitle = 'Warning from Admin';
        notificationMessage = `You have received a warning: ${reason}`;
        break;
      case 'suspend':
        targetUser.is_suspended = true;
        notificationTitle = 'Account Suspended';
        notificationMessage = `Your account has been suspended. Reason: ${reason}`;
        break;
      case 'ban':
        targetUser.is_banned = true;
        notificationTitle = 'Account Banned';
        notificationMessage = `Your account has been banned. Reason: ${reason}`;
        break;
      case 'remove-warning':
        if (targetUser.warning_count > 0) {
          targetUser.warning_count -= 1;
        }
        if (targetUser.warning_count === 0) {
          targetUser.has_warning = false;
          targetUser.warning_message = '';
        }
        notificationTitle = 'Warning Removed';
        notificationMessage = 'A warning has been removed from your account.';
        break;
      case 'unsuspend':
        targetUser.is_suspended = false;
        notificationTitle = 'Suspension Lifted';
        notificationMessage = 'Your account suspension has been lifted.';
        break;
      case 'unban':
        targetUser.is_banned = false;
        notificationTitle = 'Ban Lifted';
        notificationMessage = 'Your account ban has been lifted.';
        break;
      default:
        return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
    }

    await targetUser.save();

    // Create notification for the user
    await Notification.create({
      user_id: userId,
      type: 'system',
      title: notificationTitle,
      message: notificationMessage,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: targetUser._id,
        has_warning: targetUser.has_warning,
        warning_count: targetUser.warning_count,
        is_suspended: targetUser.is_suspended,
        is_banned: targetUser.is_banned,
      }
    });
  } catch (error) {
    console.error('Admin user action error:', error);
    return NextResponse.json({ message: 'Error performing action' }, { status: 500 });
  }
}
