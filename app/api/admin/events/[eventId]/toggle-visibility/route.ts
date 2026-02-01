import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import { Event } from '@/lib/models';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
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

    const currentUser = await User.findById(userId);
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ message: 'Admin access required' }, { status: 403 });
    }

    const { eventId } = await params;
    const event = await Event.findById(eventId);
    
    if (!event) {
      return NextResponse.json({ message: 'Event not found' }, { status: 404 });
    }

    // Toggle is_hidden
    event.is_hidden = !event.is_hidden;
    await event.save();

    return NextResponse.json({
      success: true,
      is_hidden: event.is_hidden,
      message: event.is_hidden ? 'Event hidden from users' : 'Event is now visible to users'
    });
  } catch (error) {
    console.error('Toggle event visibility error:', error);
    return NextResponse.json({ message: 'Error toggling event visibility' }, { status: 500 });
  }
}
