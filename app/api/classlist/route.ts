import { NextRequest } from 'next/server';
import { getDatabase, schema } from '@/lib/db';
import { successResponse, errorResponse, notFoundResponse } from '@/lib/utils/api-response';
import { handleOptions } from '@/lib/middleware/cors';
import { asc } from 'drizzle-orm';

/**
 * Get all class lists
 * GET /api/classlist
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "classes": [
 *       {
 *         "id": 1,
 *         "className": "9",
 *         "classNumber": 9,
 *         "stream": null,
 *         "code": "9"
 *       },
 *       {
 *         "id": 2,
 *         "className": "11",
 *         "classNumber": 11,
 *         "stream": "science",
 *         "code": "11-SCIENCE"
 *       }
 *     ]
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();

    // Get all class lists ordered by class number and stream
    const classLists = await db
      .select({
        id: schema.classlist.id,
        className: schema.classlist.className,
        classNumber: schema.classlist.classNumber,
        stream: schema.classlist.stream,
        code: schema.classlist.code,
      })
      .from(schema.classlist)
      .orderBy(
        asc(schema.classlist.classNumber),
        asc(schema.classlist.stream)
      );

    return successResponse(
      { classes: classLists },
      'Class lists retrieved successfully'
    );
  } catch (error) {
    console.error('Error fetching class lists:', error);
    return errorResponse(
      'Failed to fetch class lists',
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

