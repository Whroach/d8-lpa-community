import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import Profile from '@/lib/models/Profile';
import { Like, Block, UserPrivacySettings } from '@/lib/models';

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

    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    // Get users the current user has already interacted with
    const interactions = await Like.find({ from_user: userId });
    const interactedUserIds = interactions.map(i => i.to_user);

    // Get blocked users (both directions)
    const blocks = await Block.find({
      $or: [{ blocker: userId }, { blocked: userId }]
    });
    const blockedUserIds = blocks.map(b => 
      b.blocker.toString() === userId ? b.blocked : b.blocker
    );

    // Get all likes for selective mode checking (who has liked whom)
    const allLikes = await Like.find({
      type: { $in: ['like', 'superlike'] }
    });
    
    // Create a map of userId -> array of userIds they have liked
    const likesMap = new Map<string, string[]>();
    allLikes.forEach(like => {
      const fromUserId = like.from_user.toString();
      const toUserId = like.to_user.toString();
      if (!likesMap.has(fromUserId)) {
        likesMap.set(fromUserId, []);
      }
      likesMap.get(fromUserId)!.push(toUserId);
    });

    // Get all privacy settings
    const allPrivacySettings = await UserPrivacySettings.find({});
    const privacySettingsMap = new Map(
      allPrivacySettings.map(s => [s.user_id.toString(), s])
    );

    // Build query
    const query: any = {
      _id: { $nin: [...interactedUserIds, ...blockedUserIds, userId] },
      onboarding_completed: true,
      is_banned: false,
      is_suspended: false,
      role: { $ne: 'admin' }
    };

    // Filter by gender preference
    if (currentUser.looking_for && currentUser.looking_for.length > 0) {
      if (!currentUser.looking_for.includes('everyone')) {
        query.gender = { $in: currentUser.looking_for };
      }
    }

    let users = await User.find(query).limit(100);
    
    // Apply privacy filtering
    users = users.filter(user => {
      const privacySettings = privacySettingsMap.get(user._id.toString());
      
      // If no privacy settings, default to visible
      if (!privacySettings) return true;
      
      // If profile_visible is false, hide from browse
      if (!privacySettings.profile_visible) return false;
      
      // If selective_mode is true, only show to users they have liked
      if (privacySettings.selective_mode) {
        // Check if the profile owner (user) has liked the current viewer (userId)
        const profileOwnerLikes = likesMap.get(user._id.toString()) || [];
        return profileOwnerLikes.includes(userId);
      }
      
      return true;
    }).slice(0, 50);

    // Get profiles and format response
    const profiles = await Promise.all(users.map(async (user) => {
      if (user.role === 'admin') return null;
      const profile = await Profile.findOne({ user_id: user._id });
      
      // Calculate age
      const birthDate = new Date(user.birthdate);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      return {
        id: user._id,
        first_name: user.first_name,
        last_name: user.last_name,
        age: age || 25,
        gender: user.gender,
        photos: user.photos || [],
        bio: profile?.bio || '',
        location_city: profile?.location_city || '',
        location_state: profile?.location_state || 'California',
        district_number: profile?.district_number || 5,
        distance: Math.floor(Math.random() * 25) + 1,
        occupation: profile?.occupation || '',
        education: profile?.education || '',
        interests: profile?.interests || [],
        favorite_music: profile?.favorite_music || [],
        animals: profile?.animals || [],
        pet_peeves: profile?.pet_peeves || [],
        looking_for_description: profile?.looking_for_description || [],
        life_goals: profile?.life_goals || [],
        languages: profile?.languages || [],
        cultural_background: profile?.cultural_background || '',
        religion: profile?.religion || '',
        personal_preferences: profile?.personal_preferences || '',
        prompt_good_at: profile?.prompt_good_at || '',
        prompt_perfect_weekend: profile?.prompt_perfect_weekend || '',
        prompt_message_if: profile?.prompt_message_if || ''
      };
    }));

    return NextResponse.json(profiles.filter(Boolean));
  } catch (error) {
    console.error('Browse profiles error:', error);
    return NextResponse.json({ message: 'Error fetching profiles' }, { status: 500 });
  }
}
