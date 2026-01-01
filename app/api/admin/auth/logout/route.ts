import { NextRequest } from 'next/server';
import { successResponse } from '@/lib/utils/api-response';
import { handleOptions } from '@/lib/middleware/cors';

/**
 * Admin Logout
 * POST /api/admin/auth/logout
 */
export async function POST(request: NextRequest) {
  const response = successResponse(
    { loggedOut: true },
    'Logged out successfully'
  );

  // Clear the admin token cookie
  response.cookies.set('admin_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0, // Expire immediately
    path: '/',
  });

  return response;
}

/**
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
  return handleOptions();
}

