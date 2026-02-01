import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import { Event, Notification } from '@/lib/models';

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

    // Check if user is admin to show hidden events
    const currentUser = await User.findById(userId);
    const isAdmin = currentUser?.role === 'admin';

    // Filter out hidden events for non-admin users
    const query = isAdmin ? {} : { is_hidden: { $ne: true } };

    const events = await Event.find(query)
      .sort({ start_date: 1 })
      .populate('attendees', 'first_name photos');

    const formattedEvents = events.map(event => ({
      id: event._id,
      title: event.title,
      description: event.description,
      image: event.image,
      start_date: event.start_date,
      end_date: event.end_date,
      created_at: event.created_at,
      location: event.location,
      category: event.category,
      event_type: event.event_type || 'local_chapter',
      attendees: event.attendees.length,
      max_attendees: event.max_attendees,
      is_joined: event.attendees.some((a: any) => a._id.toString() === userId),
      is_cancelled: event.is_cancelled || false,
      is_hidden: event.is_hidden || false
    }));

    return NextResponse.json(formattedEvents);
  } catch (error) {
    console.error('Get events error:', error);
    return NextResponse.json({ message: 'Error fetching events' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const userId = decoded.userId;

    // Check if user is admin
    const currentUser = await User.findById(userId);
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ message: 'Admin access required' }, { status: 403 });
    }

    const eventData = await request.json();

    const event = await Event.create({
      ...eventData,
      created_by: userId
    });

    // Create notifications for all users about the new event
    const allUsers = await User.find({ _id: { $ne: userId } }).select('_id');
    const notifications = allUsers.map(user => ({
      user_id: user._id,
      type: 'event',
      title: 'New Event!',
      message: `Check out the new event: ${event.title}`,
      avatar: event.image || '',
      related_event: event._id
    }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }

    return NextResponse.json({
      id: event._id,
      title: event.title,
      description: event.description,
      image: event.image,
      start_date: event.start_date,
      location: event.location
    }, { status: 201 });
  } catch (error) {
    console.error('Create event error:', error);
    return NextResponse.json({ message: 'Error creating event' }, { status: 500 });
  }
}
