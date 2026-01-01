import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/utils/api-response';
import { handleOptions } from '@/lib/middleware/cors';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

interface AdminJWTPayload {
  username: string;
  role: 'super_admin';
  iat?: number;
  exp?: number;
}

/**
 * Verify Admin Token
 * GET /api/admin/auth/verify
 * 
 * Checks if the current session is valid
 */
export async function GET(request: NextRequest) {
  try {
    // Get token from cookie
    const token = request.cookies.get('admin_token')?.value;

    if (!token) {
      return errorResponse('Not authenticated', 401);
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as AdminJWTPayload;

    // Check if it's an admin token
    if (decoded.role !== 'super_admin') {
      return errorResponse('Invalid admin token', 401);
    }

    return successResponse(
      {
        authenticated: true,
        user: {
          username: decoded.username,
          role: decoded.role,
        },
      },
      'Token is valid'
    );
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return errorResponse('Session expired', 401);
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return errorResponse('Invalid token', 401);
    }
    return errorResponse('Authentication failed', 401);
  }
}

/**
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
  return handleOptions();
}

