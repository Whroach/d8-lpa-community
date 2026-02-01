import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import Profile from '@/lib/models/Profile';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// GET /api/admin/users - Get all users for admin
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    
    // TODO: Add admin role check here
    // For now, any authenticated user can access (should restrict to admins only)
    
    // Get all users with their profiles
    const users = await User.find().select('-password').sort({ created_at: -1 });
    
    const usersWithDetails = await Promise.all(
      users.map(async (user) => {
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
          id: user._id.toString(),
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          photos: user.photos || [],
          status: user.is_banned ? 'banned' : user.is_suspended ? 'suspended' : 'active',
          created_at: user.created_at,
          last_active: user.last_active || user.created_at,
          warnings: user.warnings || 0,
          is_suspended: user.is_suspended || false,
          is_banned: user.is_banned || false,
          age,
          location_city: profile?.location_city || '',
          bio: profile?.bio || '',
        };
      })
    );

    return NextResponse.json(usersWithDetails);
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json({ message: 'Error fetching users' }, { status: 500 });
  }
}
