import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import { AdminNote } from '@/lib/models';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Get notes for a user
export async function GET(
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
    
    const adminUser = await User.findById(decoded.userId);
    if (!adminUser || adminUser.role !== 'admin') {
      return NextResponse.json({ message: 'Admin access required' }, { status: 403 });
    }

    const { userId } = await params;
    const notes = await AdminNote.find({ user_id: userId }).sort({ created_at: -1 });

    return NextResponse.json(notes.map(n => ({
      id: n._id,
      content: n.content,
      admin: n.admin_name,
      created_at: n.created_at,
    })));
  } catch (error) {
    console.error('Get admin notes error:', error);
    return NextResponse.json({ message: 'Error fetching notes' }, { status: 500 });
  }
}

// Create a new note
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
    
    const adminUser = await User.findById(decoded.userId);
    if (!adminUser || adminUser.role !== 'admin') {
      return NextResponse.json({ message: 'Admin access required' }, { status: 403 });
    }

    const { userId } = await params;
    const { content } = await request.json();

    if (!content?.trim()) {
      return NextResponse.json({ message: 'Content is required' }, { status: 400 });
    }

    const note = await AdminNote.create({
      user_id: userId,
      content: content.trim(),
      admin_id: decoded.userId,
      admin_name: `${adminUser.first_name} ${adminUser.last_name}`,
    });

    return NextResponse.json({
      id: note._id,
      content: note.content,
      admin: note.admin_name,
      created_at: note.created_at,
    }, { status: 201 });
  } catch (error) {
    console.error('Create admin note error:', error);
    return NextResponse.json({ message: 'Error creating note' }, { status: 500 });
  }
}

// Delete a note
export async function DELETE(
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
    
    const adminUser = await User.findById(decoded.userId);
    if (!adminUser || adminUser.role !== 'admin') {
      return NextResponse.json({ message: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const noteId = searchParams.get('noteId');

    if (!noteId) {
      return NextResponse.json({ message: 'Note ID is required' }, { status: 400 });
    }

    await AdminNote.findByIdAndDelete(noteId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete admin note error:', error);
    return NextResponse.json({ message: 'Error deleting note' }, { status: 500 });
  }
}
