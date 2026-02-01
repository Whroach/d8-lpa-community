import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Server-side logout is a no-op for JWT tokens
  // The client handles token removal
  // This endpoint exists for completeness and potential future server-side session tracking
  return NextResponse.json({ message: 'Logged out successfully' });
}
