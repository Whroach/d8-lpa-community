import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import { Event } from '@/lib/models';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

async function requireAdmin(request: NextRequest) {
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
  } catch {
    return null;
  }
}

async function parseJsonBody(request: NextRequest) {
  try {
    const text = await request.text();
    if (!text) {
      return {} as Record<string, unknown>;
    }
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {} as Record<string, unknown>;
  }
}

function normalizeEventUpdate(input: Record<string, unknown>) {
  const update: Record<string, unknown> = {};
  const fields = [
    'title',
    'description',
    'image',
    'start_date',
    'start_time',
    'end_date',
    'end_time',
    'location',
    'max_attendees',
    'category',
    'event_type',
    'is_cancelled',
    'is_hidden',
  ];

  for (const field of fields) {
    if (field in input) {
      update[field] = input[field];
    }
  }

  if (update.start_date) {
    update.start_date = new Date(update.start_date as string);
  }
  if (update.end_date) {
    update.end_date = new Date(update.end_date as string);
  }

  return update;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    await dbConnect();

    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
    }

    const { eventId } = await params;
    const event = await Event.findById(eventId);
    if (!event) {
      return NextResponse.json({ message: 'Event not found' }, { status: 404 });
    }

    return NextResponse.json(event);
  } catch (error) {
    console.error('[ADMIN EVENT] GET error:', error);
    return NextResponse.json({ message: 'Error fetching event' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    await dbConnect();

    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
    }

    const { eventId } = await params;
    const body = await parseJsonBody(request);
    const updateData = normalizeEventUpdate(body);

    const updated = await Event.findByIdAndUpdate(
      eventId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return NextResponse.json({ message: 'Event not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[ADMIN EVENT] UPDATE error:', error);
    return NextResponse.json({ message: 'Error updating event' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    await dbConnect();

    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
    }

    const { eventId } = await params;
    const deleted = await Event.findByIdAndDelete(eventId);
    if (!deleted) {
      return NextResponse.json({ message: 'Event not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ADMIN EVENT] DELETE error:', error);
    return NextResponse.json({ message: 'Error deleting event' }, { status: 500 });
  }
}
