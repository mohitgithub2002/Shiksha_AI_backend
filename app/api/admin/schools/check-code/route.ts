import { NextRequest } from 'next/server';
import { getDatabase, schema } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/utils/api-response';
import { handleOptions } from '@/lib/middleware/cors';
import { ilike, ne, and } from 'drizzle-orm';

/**
 * Check if a school code is available
 * GET /api/admin/schools/check-code?code=SCHOOL_CODE&excludeId=123
 * 
 * Query Parameters:
 * - code: string (required) - The code to check
 * - excludeId: number (optional) - School ID to exclude from check (for updates)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code')?.trim();
    const excludeId = searchParams.get('excludeId');
    
    if (!code) {
      return errorResponse('Code parameter is required', 400);
    }
    
    // Validate code format
    const codeRegex = /^[A-Za-z0-9_-]+$/;
    if (!codeRegex.test(code)) {
      return successResponse(
        { 
          available: false, 
          reason: 'Code must contain only alphanumeric characters, hyphens, and underscores' 
        },
        'Code validation failed'
      );
    }
    
    if (code.length > 50) {
      return successResponse(
        { 
          available: false, 
          reason: 'Code must be 50 characters or less' 
        },
        'Code validation failed'
      );
    }
    
    const db = await getDatabase();
    
    // Build where clause
    let whereClause = ilike(schema.schools.code, code);
    
    if (excludeId) {
      const excludeIdNum = parseInt(excludeId, 10);
      if (!isNaN(excludeIdNum) && excludeIdNum > 0) {
        whereClause = and(
          ilike(schema.schools.code, code),
          ne(schema.schools.id, excludeIdNum)
        ) as typeof whereClause;
      }
    }
    
    const existingSchool = await db
      .select({ id: schema.schools.id, code: schema.schools.code })
      .from(schema.schools)
      .where(whereClause)
      .limit(1);
    
    if (existingSchool.length > 0) {
      return successResponse(
        { 
          available: false, 
          reason: 'This code is already in use by another school' 
        },
        'Code is not available'
      );
    }
    
    return successResponse(
      { 
        available: true,
        suggestedCode: code.toUpperCase()
      },
      'Code is available'
    );
  } catch (error) {
    console.error('Error checking school code:', error);
    return errorResponse(
      'Failed to check school code',
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

