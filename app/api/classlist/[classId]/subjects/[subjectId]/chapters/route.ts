import { NextRequest } from 'next/server';
import { eq, and, asc } from 'drizzle-orm';
import { getDatabase, schema } from '@/lib/db';
import { successResponse, errorResponse, notFoundResponse } from '@/lib/utils/api-response';
import { handleOptions } from '@/lib/middleware/cors';

/**
 * Get chapters for a particular class and subject
 * GET /api/classlist/[classId]/subjects/[subjectId]/chapters
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "classId": 1,
 *     "className": "9",
 *     "subjectId": 1,
 *     "subjectName": "Mathematics",
 *     "chapters": [
 *       {
 *         "id": 1,
 *         "chapterName": "Geometry",
 *         "chapterNumber": 1,
 *         "description": "Introduction to geometry"
 *       },
 *       {
 *         "id": 2,
 *         "chapterName": "Algebra",
 *         "chapterNumber": 2,
 *         "description": null
 *       }
 *     ]
 *   }
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string; subjectId: string }> }
) {
  try {
    const { classId, subjectId } = await params;
    const classIdNum = parseInt(classId, 10);
    const subjectIdNum = parseInt(subjectId, 10);

    if (isNaN(classIdNum)) {
      return errorResponse('Invalid class ID', 400, 'Class ID must be a valid number');
    }

    if (isNaN(subjectIdNum)) {
      return errorResponse('Invalid subject ID', 400, 'Subject ID must be a valid number');
    }

    const db = await getDatabase();

    // Verify that the class exists
    const classList = await db
      .select()
      .from(schema.classlist)
      .where(eq(schema.classlist.id, classIdNum))
      .limit(1);

    if (classList.length === 0) {
      return notFoundResponse(`Class with ID ${classId} not found`);
    }

    // Verify that the subject exists
    const subject = await db
      .select()
      .from(schema.subjects)
      .where(eq(schema.subjects.id, subjectIdNum))
      .limit(1);

    if (subject.length === 0) {
      return notFoundResponse(`Subject with ID ${subjectId} not found`);
    }

    // Find the subjectClassId that links this class and subject
    const subjectClass = await db
      .select()
      .from(schema.subjectClasses)
      .where(
        and(
          eq(schema.subjectClasses.classlistId, classIdNum),
          eq(schema.subjectClasses.subjectId, subjectIdNum)
        )
      )
      .limit(1);

    if (subjectClass.length === 0) {
      return notFoundResponse(
        `No subject-class relationship found for class ID ${classId} and subject ID ${subjectId}`
      );
    }

    const subjectClassId = subjectClass[0].id;

    // Get all chapters for this subject-class combination
    const chapters = await db
      .select({
        id: schema.ncertChapters.id,
        chapterName: schema.ncertChapters.chapterName,
        chapterNumber: schema.ncertChapters.chapterNumber,
        description: schema.ncertChapters.description,
      })
      .from(schema.ncertChapters)
      .where(eq(schema.ncertChapters.subjectClassId, subjectClassId))
      .orderBy(
        asc(schema.ncertChapters.chapterNumber),
        asc(schema.ncertChapters.chapterName)
      );

    return successResponse(
      {
        classId: classIdNum,
        className: classList[0].className,
        classNumber: classList[0].classNumber,
        stream: classList[0].stream,
        code: classList[0].code,
        subjectId: subjectIdNum,
        subjectName: subject[0].name,
        chapters,
      },
      'Chapters retrieved successfully'
    );
  } catch (error) {
    console.error('Error fetching chapters:', error);
    return errorResponse(
      'Failed to fetch chapters',
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

