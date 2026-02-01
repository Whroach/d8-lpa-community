import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/db';
import { Match, Message } from '@/lib/models';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// GET /api/messages/[matchId] - Get messages for a conversation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
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
    
    const { matchId } = await params;

    const messages = await Message.find({
      match_id: matchId,
      deleted_for: { $ne: userId }
    }).sort({ created_at: 1 });

    // Mark messages as read
    await Message.updateMany(
      { match_id: matchId, sender_id: { $ne: userId }, read: false },
      { read: true }
    );

    const formattedMessages = messages.map(msg => ({
      id: msg._id,
      sender_id: msg.sender_id,
      content: msg.content,
      created_at: msg.created_at,
      read: msg.read
    }));

    return NextResponse.json(formattedMessages);
  } catch (error) {
    console.error('Get messages error:', error);
    return NextResponse.json({ message: 'Error fetching messages' }, { status: 500 });
  }
}

// POST /api/messages/[matchId] - Send a message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
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
    
    const { matchId } = await params;
    const { content } = await request.json();

    if (!content?.trim()) {
      return NextResponse.json({ message: 'Message content required' }, { status: 400 });
    }

    const match = await Match.findById(matchId);
    if (!match) {
      return NextResponse.json({ message: 'Conversation not found' }, { status: 404 });
    }

    const message = await Message.create({
      match_id: matchId,
      sender_id: userId,
      content: content.trim()
    });

    // Update match last_message_at
    match.last_message_at = new Date();
    await match.save();

    const messageData = {
      id: message._id,
      sender_id: message.sender_id,
      content: message.content,
      created_at: message.created_at,
      read: message.read
    };

    // Emit message event via separate backend call
    try {
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:5001';
      const broadcastUrl = `${backendUrl}/api/messages/broadcast`;
      console.log('[MESSAGES] Broadcasting to:', broadcastUrl);
      
      const broadcastResponse = await fetch(broadcastUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          matchId,
          message: messageData,
          otherUserId: match.users.find(id => id.toString() !== userId)?.toString()
        })
      });
      
      if (!broadcastResponse.ok) {
        console.log('[MESSAGES] Broadcast response error:', broadcastResponse.status);
      } else {
        console.log('[MESSAGES] Broadcast sent successfully');
      }
    } catch (err) {
      console.log('[MESSAGES] Broadcast error:', err);
    }

    return NextResponse.json(messageData);
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json({ message: 'Error sending message' }, { status: 500 });
  }
}
