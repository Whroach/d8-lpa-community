import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import { Like } from '@/lib/models';

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

    // Get all likes from current user (excluding passes)
    const likes = await Like.find({ 
      from_user: userId,
      type: { $in: ['like', 'superlike'] }
    }).sort({ created_at: -1 });

    // Get user details for each liked profile
    const likedProfiles = await Promise.all(
      likes.map(async (like) => {
        const user = await User.findById(like.to_user);
        if (!user || user.role === 'admin') return null;
        
        return {
          id: user._id,
          like_id: like._id,
          first_name: user.first_name,
          last_name: user.last_name,
          age: user.birthdate ? Math.floor((Date.now() - new Date(user.birthdate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null,
          photos: user.photos || [],
          bio: user.bio || '',
          location_city: user.location_city || '',
          type: like.type,
          liked_at: like.created_at
        };
      })
    );

    return NextResponse.json(likedProfiles.filter(Boolean));
  } catch (error) {
    console.error('Get liked profiles error:', error);
    return NextResponse.json({ message: 'Error fetching liked profiles' }, { status: 500 });
  }
}
