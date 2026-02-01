import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/db';
import { Event } from '@/lib/models';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// POST /api/events/[eventId]/join
export async function POST(
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
    
    const { eventId } = await params;

    const event = await Event.findById(eventId);
    if (!event) {
      return NextResponse.json({ message: 'Event not found' }, { status: 404 });
    }

    if (event.is_cancelled) {
      return NextResponse.json({ message: 'Event has been cancelled' }, { status: 400 });
    }

    if (event.attendees.some((id: any) => id.toString() === userId)) {
      return NextResponse.json({ message: 'Already joined this event' }, { status: 400 });
    }

    if (event.max_attendees && event.attendees.length >= event.max_attendees) {
      return NextResponse.json({ message: 'Event is full' }, { status: 400 });
    }

    event.attendees.push(userId as any);
    await event.save();

    return NextResponse.json({ success: true, is_joined: true });
  } catch (error) {
    console.error('Join event error:', error);
    return NextResponse.json({ message: 'Error joining event' }, { status: 500 });
  }
}
