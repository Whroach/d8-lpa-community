import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import Profile from '@/lib/models/Profile';
import { Match } from '@/lib/models';

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

    const matches = await Match.find({ users: userId })
      .sort({ last_message_at: -1 });

    const formattedMatches = await Promise.all(matches.map(async (match) => {
      const otherUserId = match.users.find(id => id.toString() !== userId);
      const otherUser = await User.findById(otherUserId);
      const otherProfile = await Profile.findOne({ user_id: otherUserId });

      // Determine unread count for current user
      const userIndex = match.users[0].toString() === userId ? 0 : 1;
      const unreadCount = userIndex === 0 ? match.unread_count_user1 : match.unread_count_user2;

      return {
        id: match._id,
        user: {
          id: otherUser?._id,
          first_name: otherUser?.first_name || '',
          last_name: otherUser?.last_name || '',
          photos: otherUser?.photos || [],
          occupation: otherProfile?.occupation || ''
        },
        matched_at: match.created_at,
        last_message_at: match.last_message_at,
        unread_count: unreadCount
      };
    }));

    return NextResponse.json(formattedMatches);
  } catch (error) {
    console.error('Get matches error:', error);
    return NextResponse.json({ message: 'Error fetching matches' }, { status: 500 });
  }
}
