import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDatabase, schema } from '@/lib/db';
import { successResponse, errorResponse, notFoundResponse } from '@/lib/utils/api-response';
import { handleOptions } from '@/lib/middleware/cors';

/**
 * Get subjects for a particular class
 * GET /api/classlist/[classId]/subjects
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "classId": 1,
 *     "className": "9",
 *     "subjects": [
 *       {
 *         "id": 1,
 *         "name": "Mathematics",
 *         "subjectClassId": 5
 *       },
 *       {
 *         "id": 2,
 *         "name": "Science",
 *         "subjectClassId": 6
 *       }
 *     ]
 *   }
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const { classId } = await params;
    const classIdNum = parseInt(classId, 10);

    if (isNaN(classIdNum)) {
      return errorResponse('Invalid class ID', 400, 'Class ID must be a valid number');
    }

    const db = await getDatabase();

    // First, verify that the class exists
    const classList = await db
      .select()
      .from(schema.classlist)
      .where(eq(schema.classlist.id, classIdNum))
      .limit(1);

    if (classList.length === 0) {
      return notFoundResponse(`Class with ID ${classId} not found`);
    }

    // Get all subjects for this class by joining subjectClasses with subjects
    const subjects = await db
      .select({
        id: schema.subjects.id,
        name: schema.subjects.name,
        subjectClassId: schema.subjectClasses.id,
      })
      .from(schema.subjectClasses)
      .innerJoin(
        schema.subjects,
        eq(schema.subjectClasses.subjectId, schema.subjects.id)
      )
      .where(eq(schema.subjectClasses.classlistId, classIdNum))
      .orderBy(schema.subjects.name);

    return successResponse(
      {
        classId: classIdNum,
        className: classList[0].className,
        classNumber: classList[0].classNumber,
        stream: classList[0].stream,
        code: classList[0].code,
        subjects,
      },
      'Subjects retrieved successfully'
    );
  } catch (error) {
    console.error('Error fetching subjects:', error);
    return errorResponse(
      'Failed to fetch subjects',
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

