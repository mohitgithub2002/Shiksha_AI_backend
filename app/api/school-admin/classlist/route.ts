import { NextRequest } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { getDatabase, schema } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/utils/api-response';
import { handleOptions } from '@/lib/middleware/cors';
import { authenticateSchoolAdmin } from '@/lib/middleware/school-admin-auth';

/**
 * Get available classes from the master classlist
 * GET /api/school-admin/classlist
 * 
 * This returns the master list of classes (1-12 with streams) from NCERT curriculum
 * School admins use this to create classes for their school
 * 
 * Query Parameters:
 * - classNumber: number (filter by specific class number, e.g., 9, 10, 11)
 * 
 * Headers:
 * - Authorization: Bearer <token>
 */
export async function GET(request: NextRequest) {
  // Authenticate school admin
  const authResult = await authenticateSchoolAdmin(request);
  if (!authResult.success) {
    return authResult.response;
  }

  try {
    const db = await getDatabase();
    const searchParams = request.nextUrl.searchParams;
    const classNumber = searchParams.get('classNumber');

    // Build query
    let query = db
      .select({
        id: schema.classlist.id,
        className: schema.classlist.className,
        classNumber: schema.classlist.classNumber,
        stream: schema.classlist.stream,
        code: schema.classlist.code,
      })
      .from(schema.classlist);

    // Apply filter if provided
    if (classNumber) {
      const classNum = parseInt(classNumber, 10);
      if (!isNaN(classNum)) {
        query = query.where(eq(schema.classlist.classNumber, classNum)) as typeof query;
      }
    }

    // Order by class number and stream
    const classList = await query.orderBy(
      asc(schema.classlist.classNumber),
      asc(schema.classlist.stream)
    );

    // Group by class number for better organization
    const groupedByClass: Record<number, {
      classNumber: number;
      classes: typeof classList;
    }> = {};

    for (const cls of classList) {
      if (!groupedByClass[cls.classNumber]) {
        groupedByClass[cls.classNumber] = {
          classNumber: cls.classNumber,
          classes: [],
        };
      }
      groupedByClass[cls.classNumber].classes.push(cls);
    }

    return successResponse(
      {
        classList,
        groupedByClass: Object.values(groupedByClass),
      },
      'Class list retrieved successfully'
    );
  } catch (error) {
    console.error('Error fetching classlist:', error);
    return errorResponse(
      'Failed to fetch class list',
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

