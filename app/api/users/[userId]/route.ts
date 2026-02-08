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

    const profile = await Profile.findOne({ user_id: user._id }).lean();

    // Calculate age
    const birthDate = new Date(user.birthdate);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    console.log('[GET_USER] Profile exists:', !!profile);
    console.log('[GET_USER] Profile from DB:', profile);

    // Build response with all fields explicitly set
    const profileData = {
      bio: profile?.bio || '',
      occupation: profile?.occupation || '',
      education: profile?.education || '',
      interests: Array.isArray(profile?.interests) ? profile.interests : [],
      location_city: profile?.location_city || '',
      location_state: profile?.location_state || '',
      district_number: profile?.district_number || '',
      favorite_music: Array.isArray(profile?.favorite_music) ? profile.favorite_music : [],
      animals: Array.isArray(profile?.animals) ? profile.animals : [],
      pet_peeves: Array.isArray(profile?.pet_peeves) ? profile.pet_peeves : [],
      looking_for_description: Array.isArray(profile?.looking_for_description) ? profile.looking_for_description : [],
      life_goals: Array.isArray(profile?.life_goals) ? profile.life_goals : [],
      languages: Array.isArray(profile?.languages) ? profile.languages : [],
      cultural_background: profile?.cultural_background || '',
      religion: profile?.religion || '',
      personal_preferences: profile?.personal_preferences || '',
      height: profile?.height || '',
      body_type: profile?.body_type || '',
      ethnicity: profile?.ethnicity || '',
      drinking: profile?.drinking || '',
      smoking: profile?.smoking || '',
      wants_kids: profile?.wants_kids || '',
      prompt_good_at: profile?.prompt_good_at || '',
      prompt_perfect_weekend: profile?.prompt_perfect_weekend || '',
      prompt_message_if: profile?.prompt_message_if || '',
      hoping_to_find: profile?.hoping_to_find || '',
      great_day: profile?.great_day || '',
      relationship_values: profile?.relationship_values || '',
      show_affection: profile?.show_affection || '',
      build_with_person: profile?.build_with_person || '',
    };

    console.log('[GET_USER] Response profileData:', profileData);

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
