import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDatabase, schema } from '@/lib/db';
import { verifyToken, extractTokenFromHeader, JWTPayload } from '@/lib/utils/jwt';
import { unauthorizedResponse, errorResponse } from '@/lib/utils/api-response';

export interface SchoolAdminContext {
  schoolId: number;
  schoolCode: string;
  schoolName: string;
}

/**
 * Middleware to authenticate school admin requests
 * Validates JWT token and ensures the school exists
 * Returns school context for use in API handlers
 */
export async function authenticateSchoolAdmin(
  request: NextRequest
): Promise<{ success: true; context: SchoolAdminContext } | { success: false; response: ReturnType<typeof unauthorizedResponse> }> {
  try {
    // Extract token from Authorization header
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return {
        success: false,
        response: unauthorizedResponse('Authorization token is required'),
      };
    }

    // Verify and decode token
    let payload: JWTPayload;
    try {
      payload = verifyToken(token);
    } catch (error) {
      return {
        success: false,
        response: unauthorizedResponse(
          error instanceof Error ? error.message : 'Invalid token'
        ),
      };
    }

    // Validate that this is a school admin token
    if (payload.role !== 'admin') {
      return {
        success: false,
        response: unauthorizedResponse('Access denied. School admin role required.'),
      };
    }

    // Validate schoolId exists in token
    if (!payload.schoolId) {
      return {
        success: false,
        response: unauthorizedResponse('Invalid token: school ID missing'),
      };
    }

    // Fetch school details to verify it exists and is valid
    const db = await getDatabase();
    const school = await db
      .select({
        id: schema.schools.id,
        code: schema.schools.code,
        name: schema.schools.name,
      })
      .from(schema.schools)
      .where(eq(schema.schools.id, payload.schoolId))
      .limit(1);

    if (school.length === 0) {
      return {
        success: false,
        response: unauthorizedResponse('School not found or access revoked'),
      };
    }

    // Return successful context
    return {
      success: true,
      context: {
        schoolId: school[0].id,
        schoolCode: school[0].code,
        schoolName: school[0].name,
      },
    };
  } catch (error) {
    console.error('School admin authentication error:', error);
    return {
      success: false,
      response: errorResponse(
        'Authentication failed',
        500,
        error instanceof Error ? error.message : 'An unexpected error occurred'
      ) as ReturnType<typeof unauthorizedResponse>,
    };
  }
}

/**
 * Helper to validate that the requested school code matches the authenticated school
 * Used when client sends school code in request body/params
 */
export function validateSchoolCode(
  requestedCode: string | undefined,
  authenticatedCode: string
): boolean {
  if (!requestedCode) {
    return true; // If no code provided, allow (use authenticated school)
  }
  return requestedCode.toUpperCase() === authenticatedCode.toUpperCase();
}

