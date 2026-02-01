import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import Profile from '@/lib/models/Profile';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export async function POST(request: NextRequest) {
  console.log('[LOGIN] Starting login request...');
  try {
    console.log('[LOGIN] Connecting to database...');
    await dbConnect();
    console.log('[LOGIN] Database connected successfully');
    
    const { email, password } = await request.json();
    console.log('[LOGIN] Request body parsed:', { email, passwordLength: password?.length });

    if (!email || !password) {
      console.log('[LOGIN] Missing email or password');
      return NextResponse.json({ message: 'Email and password required' }, { status: 400 });
    }

    console.log('[LOGIN] Looking up user with email:', email.toLowerCase());
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      console.log('[LOGIN] User not found for email:', email.toLowerCase());
      return NextResponse.json({ message: 'Invalid email or password' }, { status: 401 });
    }
    console.log('[LOGIN] User found:', { id: user._id, email: user.email, hasPassword: !!user.password });
    console.log('[LOGIN] Stored password hash preview:', user.password?.substring(0, 29) + '...');
    console.log('[LOGIN] Received password:', password);

    console.log('[LOGIN] Comparing password...');
    const isMatch = await user.comparePassword(password);
    console.log('[LOGIN] Password match result:', isMatch);
    if (!isMatch) {
      console.log('[LOGIN] Password does not match');
      return NextResponse.json({ message: 'Invalid email or password' }, { status: 401 });
    }

    if (user.is_banned) {
      console.log('[LOGIN] User is banned');
      return NextResponse.json({ message: 'Account has been banned' }, { status: 403 });
    }

    console.log('[LOGIN] Fetching user profile...');
    const profile = await Profile.findOne({ user_id: user._id });
    console.log('[LOGIN] Profile found:', !!profile);
    
    // Token expires in 8 hours for session management
    console.log('[LOGIN] Generating JWT token...');
    const token = jwt.sign({ userId: user._id.toString() }, JWT_SECRET, { expiresIn: '8h' });
    console.log('[LOGIN] Token generated successfully');

    console.log('[LOGIN] Updating last_active...');
    user.last_active = new Date();
    await user.save();

    console.log('[LOGIN] Login successful for user:', user.email);
    return NextResponse.json({
      user: user.toJSON(),
      profile,
      token
    });
  } catch (error: unknown) {
    console.error('[LOGIN] Login error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    return NextResponse.json({ 
      message: 'Error logging in', 
      error: errorMessage,
      stack: errorStack 
    }, { status: 500 });
  }
}
