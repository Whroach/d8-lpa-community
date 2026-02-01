import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import { Event } from '@/lib/models';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

async function checkAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = await User.findById(decoded.userId);
    
    if (!user || user.role !== 'admin') {
      return null;
    }
    
    return user;
  } catch (error) {
    return null;
  }
}

export async function POST(request: NextRequest) {
  console.log('[ADMIN EVENTS] POST request received');
  try {
    await dbConnect();
    console.log('[ADMIN EVENTS] Database connected');
    
    const user = await checkAdmin(request);
    if (!user) {
      console.log('[ADMIN EVENTS] Unauthorized - not admin');
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
    }
    console.log('[ADMIN EVENTS] Admin verified:', user.email);

    const eventData = await request.json();
    console.log('[ADMIN EVENTS] Event data received:', eventData);

    const event = await Event.create({
      ...eventData,
      created_by: user._id,
      attendees: [],
      is_cancelled: false,
      is_hidden: false,
    });
    console.log('[ADMIN EVENTS] Event created:', event._id);

    return NextResponse.json(event);
  } catch (error: unknown) {
    console.error('[ADMIN EVENTS] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ 
      message: 'Error creating event',
      error: errorMessage 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  console.log('[ADMIN EVENTS] GET request received');
  try {
    await dbConnect();
    
    const user = await checkAdmin(request);
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
    }

    const events = await Event.find().sort({ start_date: -1 });
    console.log('[ADMIN EVENTS] Found events:', events.length);

    return NextResponse.json(events);
  } catch (error: unknown) {
    console.error('[ADMIN EVENTS] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ 
      message: 'Error fetching events',
      error: errorMessage 
    }, { status: 500 });
  }
}
