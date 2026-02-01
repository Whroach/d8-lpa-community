import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import Profile from '@/lib/models/Profile';
import { Match } from '@/lib/models';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// GET /api/users/profile
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

    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    const profile = await Profile.findOne({ user_id: userId });
    
    // Get stats
    const matchCount = await Match.countDocuments({ users: userId });

    return NextResponse.json({
      user: user.toJSON(),
      profile,
      stats: {
        matches: matchCount,
        views: Math.floor(Math.random() * 100) + 10,
        likes: Math.floor(Math.random() * 50) + 5
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json({ message: 'Error fetching profile' }, { status: 500 });
  }
}

// PUT /api/users/profile
export async function PUT(request: NextRequest) {
  try {
    await dbConnect();
    
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const userId = decoded.userId;

    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    
    // Update user fields
    const userFields = ['first_name', 'last_name', 'birthdate', 'gender', 'looking_for', 'looking_for_relationship', 'photos'];
    userFields.forEach(field => {
      if (body[field] !== undefined) {
        (user as any)[field] = body[field];
      }
    });
    await user.save();

    // Update profile fields
    let profile = await Profile.findOne({ user_id: userId });
    if (!profile) {
      profile = new Profile({ user_id: userId });
    }
    
    const profileFields = ['bio', 'occupation', 'height', 'education', 'drinking', 'smoking', 'wants_kids', 'interests', 'looking_for_description', 'life_goals', 'languages', 'cultural_background', 'religion', 'personal_preferences', 'location_city', 'location_state', 'favorite_music', 'animals', 'pet_peeves', 'prompt_good_at', 'prompt_perfect_weekend', 'prompt_message_if'];
    profileFields.forEach(field => {
      if (body[field] !== undefined) {
        (profile as any)[field] = body[field];
      }
    });
    await profile.save();

    return NextResponse.json({
      user: user.toJSON(),
      profile
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json({ message: 'Error updating profile' }, { status: 500 });
  }
}
