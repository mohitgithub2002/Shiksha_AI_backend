import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse } from '@/lib/utils/api-response';
import { handleOptions } from '@/lib/middleware/cors';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const ADMIN_TOKEN_EXPIRES = '24h';

interface AdminJWTPayload {
  username: string;
  role: 'super_admin';
  iat?: number;
  exp?: number;
}

/**
 * Admin Login
 * POST /api/admin/auth/login
 * 
 * Request Body:
 * {
 *   "username": "admin_username",
 *   "password": "admin_password"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    // Validate required fields
    if (!username || !password) {
      return errorResponse('Username and password are required', 400);
    }

    // Get admin credentials from environment variables
    const adminUsername = process.env.admin_username;
    const adminPassword = process.env.admin_password;

    // Check if admin credentials are configured
    if (!adminUsername || !adminPassword) {
      console.error('Admin credentials not configured in environment variables');
      return errorResponse('Admin authentication is not configured', 500);
    }

    // Verify credentials
    if (username !== adminUsername || password !== adminPassword) {
      return errorResponse('Invalid username or password', 401);
    }

    // Generate admin JWT token
    const payload: AdminJWTPayload = {
      username: adminUsername,
      role: 'super_admin',
    };

    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: ADMIN_TOKEN_EXPIRES,
    });

    // Create response with token in cookie
    const response = successResponse(
      {
        user: {
          username: adminUsername,
          role: 'super_admin',
        },
        token,
        expiresIn: ADMIN_TOKEN_EXPIRES,
      },
      'Login successful'
    );

    // Set HTTP-only cookie for security
    response.cookies.set('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24 hours in seconds
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Admin login error:', error);
    return errorResponse(
      'Login failed',
      500,
      error instanceof Error ? error.message : 'An unexpected error occurred'
    );
  }
}

/**
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
  return handleOptions();
}

