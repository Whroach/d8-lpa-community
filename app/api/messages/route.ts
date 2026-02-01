import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import Profile from '@/lib/models/Profile';
import { Match, Message } from '@/lib/models';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// GET /api/messages - Get all conversations
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

    const conversations = await Promise.all(matches.map(async (match) => {
      const otherUserId = match.users.find(id => id.toString() !== userId);
      const otherUser = await User.findById(otherUserId);
      
      // Get last message
      const lastMessage = await Message.findOne({ 
        match_id: match._id,
        deleted_for: { $ne: userId }
      }).sort({ created_at: -1 });

      // Count unread
      const unreadCount = await Message.countDocuments({
        match_id: match._id,
        sender_id: { $ne: userId },
        read: false,
        deleted_for: { $ne: userId }
      });

      return {
        id: match._id,
        match_id: match._id,
        user: {
          id: otherUser?._id,
          first_name: otherUser?.first_name || '',
          last_name: otherUser?.last_name || '',
          photos: otherUser?.photos || []
        },
        last_message: lastMessage?.content || null,
        last_message_at: lastMessage?.created_at || match.last_message_at || null,
        unread_count: unreadCount
      };
    }));

    return NextResponse.json(conversations);
  } catch (error) {
    console.error('Get conversations error:', error);
    return NextResponse.json({ message: 'Error fetching conversations' }, { status: 500 });
  }
}
