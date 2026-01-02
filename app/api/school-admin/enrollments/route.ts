import { NextRequest } from 'next/server';
import { eq, and, desc, sql } from 'drizzle-orm';
import { getDatabase, schema } from '@/lib/db';
import { successResponse, errorResponse, notFoundResponse } from '@/lib/utils/api-response';
import { handleOptions } from '@/lib/middleware/cors';
import { authenticateSchoolAdmin } from '@/lib/middleware/school-admin-auth';
import { z } from 'zod';

// Validation schema for creating an enrollment
const createEnrollmentSchema = z.object({
  studentId: z.number().positive('Valid student ID is required'),
  classId: z.number().positive('Valid class ID is required'),
});

/**
 * List all enrollments for the authenticated school
 * GET /api/school-admin/enrollments
 * 
 * Query Parameters:
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 * - studentId: number (filter by student)
 * - classId: number (filter by class)
 * - isActive: boolean (filter by active status)
 * - session: string (filter by session)
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

  const { schoolId } = authResult.context;

  try {
    const db = await getDatabase();
    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const studentIdFilter = searchParams.get('studentId');
    const classIdFilter = searchParams.get('classId');
    const isActiveFilter = searchParams.get('isActive');
    const sessionFilter = searchParams.get('session')?.trim();

    const offset = (page - 1) * limit;

    // Build conditions
    let conditions = [eq(schema.classes.schoolId, schoolId)];

    if (studentIdFilter) {
      const studentId = parseInt(studentIdFilter, 10);
      if (!isNaN(studentId)) {
        conditions.push(eq(schema.enrollments.studentId, studentId));
      }
    }

    if (classIdFilter) {
      const classId = parseInt(classIdFilter, 10);
      if (!isNaN(classId)) {
        conditions.push(eq(schema.enrollments.classId, classId));
      }
    }

    if (isActiveFilter !== null && isActiveFilter !== undefined) {
      const isActive = isActiveFilter === 'true';
      conditions.push(eq(schema.enrollments.isActive, isActive));
    }

    if (sessionFilter) {
      conditions.push(eq(schema.classes.session, sessionFilter));
    }

    const whereCondition = and(...conditions);

    // Execute queries
    const [enrollmentsRaw, countResult] = await Promise.all([
      db
        .select({
          id: schema.enrollments.id,
          studentId: schema.enrollments.studentId,
          studentName: schema.students.name,
          studentEmail: schema.students.email,
          studentStatus: schema.students.status,
          classId: schema.enrollments.classId,
          className: schema.classlist.className,
          classNumber: schema.classlist.classNumber,
          section: schema.classes.section,
          session: schema.classes.session,
          stream: schema.classlist.stream,
          enrollmentDate: schema.enrollments.enrollmentDate,
          isActive: schema.enrollments.isActive,
          createdAt: schema.enrollments.createdAt,
        })
        .from(schema.enrollments)
        .innerJoin(schema.students, eq(schema.enrollments.studentId, schema.students.id))
        .innerJoin(schema.classes, eq(schema.enrollments.classId, schema.classes.id))
        .innerJoin(schema.classlist, eq(schema.classes.classId, schema.classlist.id))
        .where(whereCondition)
        .orderBy(desc(schema.enrollments.enrollmentDate))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.enrollments)
        .innerJoin(schema.classes, eq(schema.enrollments.classId, schema.classes.id))
        .where(whereCondition),
    ]);

    const totalCount = countResult[0]?.count || 0;
    const totalPages = Math.ceil(totalCount / limit);

    return successResponse(
      {
        enrollments: enrollmentsRaw,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
      'Enrollments retrieved successfully'
    );
  } catch (error) {
    console.error('Error fetching enrollments:', error);
    return errorResponse(
      'Failed to fetch enrollments',
      500,
      error instanceof Error ? error.message : 'An unexpected error occurred'
    );
  }
}

/**
 * Create a new enrollment (enroll student in a class)
 * POST /api/school-admin/enrollments
 * 
 * This is the final step in student registration:
 * 1. Check phone (done)
 * 2. Create user (done if needed)
 * 3. Create student profile (done)
 * 4. Enroll in class <-- This step
 * 
 * Request Body:
 * {
 *   "studentId": 123,
 *   "classId": 5 (ID from classes table, not classlist)
 * }
 * 
 * Headers:
 * - Authorization: Bearer <token>
 */
export async function POST(request: NextRequest) {
  // Authenticate school admin
  const authResult = await authenticateSchoolAdmin(request);
  if (!authResult.success) {
    return authResult.response;
  }

  const { schoolId } = authResult.context;

  try {
    const db = await getDatabase();
    const body = await request.json();

    // Validate request body
    const validationResult = createEnrollmentSchema.safeParse(body);
    if (!validationResult.success) {
      return errorResponse(
        'Validation failed',
        400,
        validationResult.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      );
    }

    const { studentId, classId } = validationResult.data;

    // Verify student exists and belongs to this school
    const student = await db
      .select({
        id: schema.students.id,
        name: schema.students.name,
        status: schema.students.status,
        schoolId: schema.students.schoolId,
      })
      .from(schema.students)
      .where(
        and(
          eq(schema.students.id, studentId),
          eq(schema.students.schoolId, schoolId)
        )
      )
      .limit(1);

    if (student.length === 0) {
      return notFoundResponse('Student not found in this school');
    }

    if (student[0].status !== 'active') {
      return errorResponse(
        'Cannot enroll student',
        400,
        `Student status is '${student[0].status}'. Only active students can be enrolled.`
      );
    }

    // Verify class exists and belongs to this school
    const classData = await db
      .select({
        id: schema.classes.id,
        schoolId: schema.classes.schoolId,
        session: schema.classes.session,
        section: schema.classes.section,
        className: schema.classlist.className,
        classNumber: schema.classlist.classNumber,
      })
      .from(schema.classes)
      .innerJoin(schema.classlist, eq(schema.classes.classId, schema.classlist.id))
      .where(
        and(
          eq(schema.classes.id, classId),
          eq(schema.classes.schoolId, schoolId)
        )
      )
      .limit(1);

    if (classData.length === 0) {
      return notFoundResponse('Class not found in this school');
    }

    // Check if enrollment already exists
    const existingEnrollment = await db
      .select({ id: schema.enrollments.id, isActive: schema.enrollments.isActive })
      .from(schema.enrollments)
      .where(
        and(
          eq(schema.enrollments.studentId, studentId),
          eq(schema.enrollments.classId, classId)
        )
      )
      .limit(1);

    if (existingEnrollment.length > 0) {
      if (existingEnrollment[0].isActive) {
        return errorResponse(
          'Already enrolled',
          409,
          `Student is already enrolled in Class ${classData[0].className} Section ${classData[0].section}`
        );
      } else {
        // Reactivate existing enrollment
        const reactivatedEnrollment = await db
          .update(schema.enrollments)
          .set({ isActive: true })
          .where(eq(schema.enrollments.id, existingEnrollment[0].id))
          .returning();

        return successResponse(
          {
            enrollment: {
              ...reactivatedEnrollment[0],
              studentName: student[0].name,
              className: classData[0].className,
              classNumber: classData[0].classNumber,
              section: classData[0].section,
              session: classData[0].session,
            },
          },
          'Enrollment reactivated successfully'
        );
      }
    }

    // Create new enrollment
    const newEnrollment = await db
      .insert(schema.enrollments)
      .values({
        studentId,
        classId,
        isActive: true,
      })
      .returning();

    return successResponse(
      {
        enrollment: {
          ...newEnrollment[0],
          studentName: student[0].name,
          className: classData[0].className,
          classNumber: classData[0].classNumber,
          section: classData[0].section,
          session: classData[0].session,
        },
      },
      'Student enrolled successfully',
      201
    );
  } catch (error) {
    console.error('Error creating enrollment:', error);

    // Handle unique constraint violation
    if (error instanceof Error && error.message.includes('unique')) {
      return errorResponse('Student is already enrolled in this class', 409);
    }

    return errorResponse(
      'Failed to create enrollment',
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

