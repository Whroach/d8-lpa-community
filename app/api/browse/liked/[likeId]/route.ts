import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/db';
import { Like, Notification } from '@/lib/models';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ likeId: string }> }
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

    const { likeId } = await params;

    // Find and delete the like
    const like = await Like.findOne({ _id: likeId, from_user: userId });
    
    if (!like) {
      return NextResponse.json({ message: 'Like not found' }, { status: 404 });
    }

    await Like.deleteOne({ _id: likeId });

    // Also delete the related notification if exists
    await Notification.deleteOne({ 
      related_user: userId,
      user_id: like.to_user,
      type: 'like'
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unlike error:', error);
    return NextResponse.json({ message: 'Error removing like' }, { status: 500 });
  }
}
