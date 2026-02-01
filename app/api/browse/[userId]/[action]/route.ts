import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import { Like, Match, Notification } from '@/lib/models';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string; userId: string }> }
) {
  try {
    await dbConnect();
    
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const currentUserId = decoded.userId;
    
    const { action, userId: targetUserId } = await params;

    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findById(targetUserId);
    
    if (!targetUser) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    // Check if already interacted
    const existingLike = await Like.findOne({ 
      from_user: currentUserId, 
      to_user: targetUserId 
    });
    
    if (existingLike) {
      return NextResponse.json({ message: 'Already interacted with this user' }, { status: 400 });
    }

    // Determine like type
    const likeType = action === 'superlike' ? 'superlike' : action === 'pass' ? 'pass' : 'like';

    // Create like
    await Like.create({
      from_user: currentUserId,
      to_user: targetUserId,
      type: likeType
    });

    if (action === 'pass') {
      return NextResponse.json({ success: true });
    }

    // Create notification for the liked user
    await Notification.create({
      user_id: targetUserId,
      type: 'like',
      title: action === 'superlike' ? 'Someone Super Liked You!' : 'Someone Liked You!',
      message: `${currentUser?.first_name || 'Someone'} ${action === 'superlike' ? 'super liked' : 'liked'} your profile!`,
      avatar: currentUser?.photos?.[0] || '',
      related_user: currentUserId
    });

    // Check for mutual like (match)
    const mutualLike = await Like.findOne({
      from_user: targetUserId,
      to_user: currentUserId,
      type: { $in: ['like', 'superlike'] }
    });

    let match = null;
    if (mutualLike) {
      match = await Match.create({
        users: [currentUserId, targetUserId]
      });

      // Create notifications
      await Notification.create({
        user_id: currentUserId,
        type: 'match',
        title: 'New Match!',
        message: `You and ${targetUser.first_name} matched!`,
        avatar: targetUser.photos?.[0] || '',
        related_user: targetUserId,
        related_match: match._id
      });

      await Notification.create({
        user_id: targetUserId,
        type: 'match',
        title: 'New Match!',
        message: `You and ${currentUser?.first_name} matched!`,
        avatar: currentUser?.photos?.[0] || '',
        related_user: currentUserId,
        related_match: match._id
      });
    }

    return NextResponse.json({
      success: true,
      is_match: !!match,
      match: match ? {
        id: match._id,
        user: {
          id: targetUser._id,
          first_name: targetUser.first_name,
          photos: targetUser.photos
        }
      } : null
    });
  } catch (error) {
    console.error('Browse action error:', error);
    return NextResponse.json({ message: 'Error processing action' }, { status: 500 });
  }
}
