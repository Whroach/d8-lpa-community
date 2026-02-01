import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { Match } from '@/lib/models/index';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    await dbConnect();
    
    const { matchId } = await params;
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Delete the match
    const result = await Match.findByIdAndDelete(matchId);
    
    if (!result) {
      return NextResponse.json({ message: 'Match not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Unmatched successfully' });
  } catch (error: unknown) {
    console.error('Unmatch error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ message: 'Error unmatching', error: errorMessage }, { status: 500 });
  }
}
