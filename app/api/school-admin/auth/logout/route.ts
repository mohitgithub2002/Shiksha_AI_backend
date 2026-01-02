import { NextRequest } from 'next/server';
import { successResponse } from '@/lib/utils/api-response';
import { handleOptions } from '@/lib/middleware/cors';

/**
 * School Admin Logout API
 * POST /api/school-admin/auth/logout
 * 
 * Clears the school admin authentication cookie
 */
export async function POST(request: NextRequest) {
  const response = successResponse(
    { loggedOut: true },
    'Logout successful'
  );

  // Clear the school admin token cookie
  response.cookies.set('school_admin_token', '', {
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

