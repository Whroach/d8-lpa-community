import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import Profile from '@/lib/models/Profile';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

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
    jwt.verify(token, JWT_SECRET);

    const { userId } = await params;

    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    // Check if user is disabled or deleted
    if (user.is_disabled || user.is_deleted) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    const profile = await Profile.findOne({ user_id: user._id });

    // Calculate age
    const birthDate = new Date(user.birthdate);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    // Convert profile to plain object to ensure all fields are included
    const profileData = profile ? profile.toObject() : {};

    console.log('[GET_USER] Profile data from DB:', profileData);
    console.log('[GET_USER] favorite_music:', profileData.favorite_music);
    console.log('[GET_USER] animals:', profileData.animals);
    console.log('[GET_USER] pet_peeves:', profileData.pet_peeves);

    return NextResponse.json({
      user: {
        _id: user._id,
        first_name: user.first_name,
        last_name: user.last_name,
        age,
        gender: user.gender,
        photos: user.photos,
        birthdate: user.birthdate,
      },
      profile: profileData,
    });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json({ message: 'Error fetching user' }, { status: 500 });
  }
}
