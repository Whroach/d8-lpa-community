import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Construct the Express backend URL
    // For development: http://localhost:5001/api
    // For production: use environment variable
    const expressBaseUrl = process.env.EXPRESS_API_URL || 'http://localhost:5001';
    const signupUrl = `${expressBaseUrl}/api/auth/signup`;
    
    console.log('Proxying signup to:', signupUrl);

    const response = await fetch(signupUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error: unknown) {
    console.error('Signup proxy error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ message: 'Error creating account', error: errorMessage }, { status: 500 });
  }
}
