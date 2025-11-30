import { NextResponse } from 'next/server';

/**
 * CORS middleware for API routes
 * Note: CORS is also configured in next.config.ts
 * This can be used for more granular control if needed
 */
export function corsHeaders(response: NextResponse): NextResponse {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];
  const origin = process.env.NODE_ENV === 'production' 
    ? (allowedOrigins.includes('*') ? '*' : allowedOrigins[0])
    : '*';

  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Access-Control-Allow-Credentials', 'true');

  return response;
}

/**
 * Handle OPTIONS request for CORS preflight
 */
export function handleOptions(): NextResponse {
  const response = new NextResponse(null, { status: 200 });
  return corsHeaders(response);
}

