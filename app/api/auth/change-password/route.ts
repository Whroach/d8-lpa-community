import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export async function POST(request: NextRequest) {
  console.log('[CHANGE_PASSWORD] Starting change password request...');
  try {
    // Get the token from the Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[CHANGE_PASSWORD] No valid authorization token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // Verify the token
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      console.log('[CHANGE_PASSWORD] Invalid or expired token');
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const userId = decoded.userId;
    console.log('[CHANGE_PASSWORD] User ID from token:', userId);

    await dbConnect();
    console.log('[CHANGE_PASSWORD] Database connected successfully');

    const { current_password, new_password } = await request.json();
    console.log('[CHANGE_PASSWORD] Request body parsed');

    if (!current_password || !new_password) {
      console.log('[CHANGE_PASSWORD] Missing current_password or new_password');
      return NextResponse.json({ error: 'Current password and new password are required' }, { status: 400 });
    }

    if (new_password.length < 8) {
      console.log('[CHANGE_PASSWORD] New password too short');
      return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
    }

    // Find the user
    console.log('[CHANGE_PASSWORD] Looking up user:', userId);
    const user = await User.findById(userId);
    if (!user) {
      console.log('[CHANGE_PASSWORD] User not found:', userId);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    console.log('[CHANGE_PASSWORD] User found:', user.email);

    // Verify current password
    console.log('[CHANGE_PASSWORD] Verifying current password...');
    const isMatch = await user.comparePassword(current_password);
    if (!isMatch) {
      console.log('[CHANGE_PASSWORD] Current password does not match');
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
    }
    console.log('[CHANGE_PASSWORD] Current password verified');

    // Check if new password is the same as current password
    if (current_password === new_password) {
      console.log('[CHANGE_PASSWORD] New password same as current');
      return NextResponse.json({ error: 'New password must be different from current password' }, { status: 400 });
    }

    // Update the password
    console.log('[CHANGE_PASSWORD] Setting new password...');
    user.password = new_password;
    await user.save();
    console.log('[CHANGE_PASSWORD] Password changed successfully for user:', user.email);

    return NextResponse.json({ message: 'Password changed successfully' });
  } catch (error: unknown) {
    console.error('[CHANGE_PASSWORD] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    return NextResponse.json(
      {
        error: 'Error changing password',
        message: errorMessage,
        stack: errorStack,
      },
      { status: 500 }
    );
  }
}
