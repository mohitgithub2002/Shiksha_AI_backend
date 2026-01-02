import { NextRequest } from 'next/server';
import { eq, ilike } from 'drizzle-orm';
import { getDatabase, schema } from '@/lib/db';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/utils/api-response';
import { generateToken } from '@/lib/utils/jwt';
import { verifyPassword } from '@/lib/utils/password';
import { handleOptions } from '@/lib/middleware/cors';
import { z } from 'zod';

// Validation schema for login request
const loginSchema = z.object({
  schoolCode: z.string().min(1, 'School code is required'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits').max(20),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

/**
 * School Admin Login API
 * POST /api/school-admin/auth/login
 * 
 * Request body:
 * {
 *   "schoolCode": "SCHOOL_CODE",
 *   "phone": "1234567890",
 *   "password": "password123"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "token": "jwt_token_here",
 *     "school": {
 *       "id": 1,
 *       "name": "ABC School",
 *       "code": "SCHOOL_CODE",
 *       "city": "City Name",
 *       "state": "State Name"
 *     },
 *     "expiresIn": "7d"
 *   },
 *   "message": "Login successful"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validationResult = loginSchema.safeParse(body);

    if (!validationResult.success) {
      return errorResponse(
        'Validation failed',
        400,
        validationResult.error.issues.map(e => e.message).join(', ')
      );
    }

    const { schoolCode, phone, password } = validationResult.data;

    // Get database instance
    const db = await getDatabase();

    // Find school by code (case-insensitive)
    const school = await db
      .select({
        id: schema.schools.id,
        name: schema.schools.name,
        code: schema.schools.code,
        city: schema.schools.city,
        state: schema.schools.state,
        contactPhone: schema.schools.contactPhone,
        passwordHash: schema.schools.passwordHash,
        ownerName: schema.schools.ownerName,
      })
      .from(schema.schools)
      .where(ilike(schema.schools.code, schoolCode.trim()))
      .limit(1);

    if (school.length === 0) {
      return unauthorizedResponse('Invalid school code, phone number, or password');
    }

    const schoolData = school[0];

    // Validate phone number matches school's contact phone
    // Normalize phone numbers for comparison (remove spaces, dashes, etc.)
    const normalizePhone = (p: string) => p.replace(/[\s\-\(\)]/g, '');
    if (normalizePhone(schoolData.contactPhone) !== normalizePhone(phone)) {
      return unauthorizedResponse('Invalid school code, phone number, or password');
    }

    // Check if password is set for this school
    if (!schoolData.passwordHash) {
      return errorResponse(
        'Password not set',
        403,
        'Password has not been set for this school. Please contact the administrator to set up your password.'
      );
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, schoolData.passwordHash);
    if (!isPasswordValid) {
      return unauthorizedResponse('Invalid school code, phone number, or password');
    }

    // Generate JWT token with school admin role
    const token = generateToken({
      schoolId: schoolData.id,
      role: 'admin',
    });

    // Prepare response (exclude sensitive data)
    const responseData = {
      token,
      school: {
        id: schoolData.id,
        name: schoolData.name,
        code: schoolData.code,
        city: schoolData.city,
        state: schoolData.state,
        ownerName: schoolData.ownerName,
      },
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    };

    // Create response with optional cookie
    const response = successResponse(responseData, 'Login successful');

    // Set HTTP-only cookie for added security
    response.cookies.set('school_admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('School admin login error:', error);
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

