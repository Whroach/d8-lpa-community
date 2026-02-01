import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import Profile from '@/lib/models/Profile';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export async function PUT(request: NextRequest) {
  try {
    await dbConnect();
    
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

    const user = await User.findById(decoded.userId);
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      first_name,
      last_name,
      birthdate,
      gender,
      location_state,
      district_number,
      lpa_membership_id,
      looking_for,
      looking_for_relationship,
      photos,
      bio,
      occupation,
      education,
      interests,
      location_city,
      favorite_music,
      animals,
      pet_peeves,
      languages,
      cultural_background,
      religion,
      personal_preferences,
      looking_for_description,
      life_goals,
      prompt_good_at,
      prompt_perfect_weekend,
      prompt_message_if
    } = body;

    // Update user
    if (first_name) user.first_name = first_name;
    if (last_name) user.last_name = last_name;
    if (birthdate) user.birthdate = birthdate;
    if (gender) user.gender = gender;
    if (location_state) user.location_state = location_state;
    if (district_number) user.district_number = district_number;
    if (lpa_membership_id) user.lpa_membership_id = lpa_membership_id;
    if (looking_for) user.looking_for = looking_for;
    if (looking_for_relationship) user.looking_for_relationship = looking_for_relationship;
    if (photos) user.photos = photos;
    if (favorite_music) user.favorite_music = favorite_music;
    if (animals) user.animals = animals;
    if (pet_peeves) user.pet_peeves = pet_peeves;
    user.onboarding_completed = true;
    await user.save();

    // Update profile
    let profile = await Profile.findOne({ user_id: user._id });
    
    // Create profile if it doesn't exist
    if (!profile) {
      profile = new Profile({ user_id: user._id });
    }
    
    if (profile) {
      if (bio) profile.bio = bio;
      if (occupation) profile.occupation = occupation;
      if (education) profile.education = education;
      if (interests) profile.interests = interests;
      if (location_city) profile.location_city = location_city;
      if (location_state) profile.location_state = location_state;
      if (favorite_music) profile.favorite_music = typeof favorite_music === 'string' ? [favorite_music] : favorite_music;
      if (animals) profile.animals = typeof animals === 'string' ? [animals] : animals;
      if (pet_peeves) profile.pet_peeves = typeof pet_peeves === 'string' ? [pet_peeves] : pet_peeves;
      if (languages) profile.languages = languages;
      if (cultural_background) profile.cultural_background = cultural_background;
      if (religion) profile.religion = religion;
      if (personal_preferences) profile.personal_preferences = personal_preferences;
      if (looking_for_description) profile.looking_for_description = Array.isArray(looking_for_description) ? looking_for_description : (looking_for_description ? [looking_for_description] : []);
      if (life_goals) profile.life_goals = Array.isArray(life_goals) ? life_goals : (life_goals ? [life_goals] : []);
      if (prompt_good_at) profile.prompt_good_at = prompt_good_at;
      if (prompt_perfect_weekend) profile.prompt_perfect_weekend = prompt_perfect_weekend;
      if (prompt_message_if) profile.prompt_message_if = prompt_message_if;
      await profile.save();
    }

    return NextResponse.json({
      user: user.toJSON(),
      profile
    });
  } catch (error) {
    console.error('Complete onboarding error:', error);
    return NextResponse.json({ message: 'Error completing onboarding' }, { status: 500 });
  }
}
