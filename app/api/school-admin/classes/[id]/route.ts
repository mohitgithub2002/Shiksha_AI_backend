import { NextRequest } from 'next/server';
import { eq, and, sql } from 'drizzle-orm';
import { getDatabase, schema } from '@/lib/db';
import { successResponse, errorResponse, notFoundResponse } from '@/lib/utils/api-response';
import { handleOptions } from '@/lib/middleware/cors';
import { authenticateSchoolAdmin } from '@/lib/middleware/school-admin-auth';
import { z } from 'zod';

// Validation schema for updating a class
const updateClassSchema = z.object({
  session: z.string().min(1, 'Session is required').max(100).optional(),
  section: z.string().min(1, 'Section is required').max(100).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Get a specific class by ID
 * GET /api/school-admin/classes/[id]
 * 
 * Headers:
 * - Authorization: Bearer <token>
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  // Authenticate school admin
  const authResult = await authenticateSchoolAdmin(request);
  if (!authResult.success) {
    return authResult.response;
  }

  const { schoolId } = authResult.context;
  const { id } = await params;
  const classId = parseInt(id, 10);

  if (isNaN(classId)) {
    return errorResponse('Invalid class ID', 400);
  }

  try {
    const db = await getDatabase();

    // Fetch class with details
    const classData = await db
      .select({
        id: schema.classes.id,
        classId: schema.classes.classId,
        className: schema.classlist.className,
        classNumber: schema.classlist.classNumber,
        stream: schema.classlist.stream,
        classCode: schema.classlist.code,
        session: schema.classes.session,
        section: schema.classes.section,
        createdAt: schema.classes.createdAt,
        updatedAt: schema.classes.updatedAt,
        schoolId: schema.classes.schoolId,
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
      return notFoundResponse('Class not found');
    }

    // Get student count
    const studentCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.enrollments)
      .where(
        and(
          eq(schema.enrollments.classId, classId),
          eq(schema.enrollments.isActive, true)
        )
      );

    // Get enrolled students
    const students = await db
      .select({
        id: schema.students.id,
        name: schema.students.name,
        email: schema.students.email,
        gender: schema.students.gender,
        status: schema.students.status,
        enrollmentId: schema.enrollments.id,
        enrollmentDate: schema.enrollments.enrollmentDate,
        isActive: schema.enrollments.isActive,
      })
      .from(schema.enrollments)
      .innerJoin(schema.students, eq(schema.enrollments.studentId, schema.students.id))
      .where(
        and(
          eq(schema.enrollments.classId, classId),
          eq(schema.enrollments.isActive, true)
        )
      );

    return successResponse(
      {
        class: {
          ...classData[0],
          studentCount: studentCount[0]?.count || 0,
          students,
        },
      },
      'Class retrieved successfully'
    );
  } catch (error) {
    console.error('Error fetching class:', error);
    return errorResponse(
      'Failed to fetch class',
      500,
      error instanceof Error ? error.message : 'An unexpected error occurred'
    );
  }
}

/**
 * Update a class
 * PATCH /api/school-admin/classes/[id]
 * 
 * Request Body:
 * {
 *   "session": "2024-25", (optional)
 *   "section": "B" (optional)
 * }
 * 
 * Headers:
 * - Authorization: Bearer <token>
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  // Authenticate school admin
  const authResult = await authenticateSchoolAdmin(request);
  if (!authResult.success) {
    return authResult.response;
  }

  const { schoolId } = authResult.context;
  const { id } = await params;
  const classId = parseInt(id, 10);

  if (isNaN(classId)) {
    return errorResponse('Invalid class ID', 400);
  }

  try {
    const db = await getDatabase();
    const body = await request.json();

    // Validate request body
    const validationResult = updateClassSchema.safeParse(body);
    if (!validationResult.success) {
      return errorResponse(
        'Validation failed',
        400,
        validationResult.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      );
    }

    const updateData = validationResult.data;

    // Check if there's anything to update
    if (!updateData.session && !updateData.section) {
      return errorResponse('No fields to update provided', 400);
    }

    // Verify the class exists and belongs to this school
    const existingClass = await db
      .select({
        id: schema.classes.id,
        classId: schema.classes.classId,
        session: schema.classes.session,
        section: schema.classes.section,
      })
      .from(schema.classes)
      .where(
        and(
          eq(schema.classes.id, classId),
          eq(schema.classes.schoolId, schoolId)
        )
      )
      .limit(1);

    if (existingClass.length === 0) {
      return notFoundResponse('Class not found');
    }

    // Check for duplicate if updating session or section
    const newSession = updateData.session?.trim() || existingClass[0].session;
    const newSection = updateData.section?.trim().toUpperCase() || existingClass[0].section;

    const duplicate = await db
      .select({ id: schema.classes.id })
      .from(schema.classes)
      .where(
        and(
          eq(schema.classes.schoolId, schoolId),
          eq(schema.classes.session, newSession),
          eq(schema.classes.classId, existingClass[0].classId),
          eq(schema.classes.section, newSection),
          sql`${schema.classes.id} != ${classId}`
        )
      )
      .limit(1);

    if (duplicate.length > 0) {
      return errorResponse(
        'Class already exists',
        409,
        `A class with this section already exists for the selected session`
      );
    }

    // Update the class
    const updatedClass = await db
      .update(schema.classes)
      .set({
        session: newSession,
        section: newSection,
        updatedAt: new Date(),
      })
      .where(eq(schema.classes.id, classId))
      .returning();

    // Fetch full class details
    const classDetails = await db
      .select({
        id: schema.classes.id,
        classId: schema.classes.classId,
        className: schema.classlist.className,
        classNumber: schema.classlist.classNumber,
        stream: schema.classlist.stream,
        classCode: schema.classlist.code,
        session: schema.classes.session,
        section: schema.classes.section,
        createdAt: schema.classes.createdAt,
        updatedAt: schema.classes.updatedAt,
      })
      .from(schema.classes)
      .innerJoin(schema.classlist, eq(schema.classes.classId, schema.classlist.id))
      .where(eq(schema.classes.id, classId))
      .limit(1);

    return successResponse(
      { class: classDetails[0] },
      'Class updated successfully'
    );
  } catch (error) {
    console.error('Error updating class:', error);
    return errorResponse(
      'Failed to update class',
      500,
      error instanceof Error ? error.message : 'An unexpected error occurred'
    );
  }
}

/**
 * Delete a class
 * DELETE /api/school-admin/classes/[id]
 * 
 * Note: Can only delete classes with no active enrollments
 * 
 * Headers:
 * - Authorization: Bearer <token>
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  // Authenticate school admin
  const authResult = await authenticateSchoolAdmin(request);
  if (!authResult.success) {
    return authResult.response;
  }

  const { schoolId } = authResult.context;
  const { id } = await params;
  const classId = parseInt(id, 10);

  if (isNaN(classId)) {
    return errorResponse('Invalid class ID', 400);
  }

  try {
    const db = await getDatabase();

    // Verify the class exists and belongs to this school
    const existingClass = await db
      .select({ id: schema.classes.id })
      .from(schema.classes)
      .where(
        and(
          eq(schema.classes.id, classId),
          eq(schema.classes.schoolId, schoolId)
        )
      )
      .limit(1);

    if (existingClass.length === 0) {
      return notFoundResponse('Class not found');
    }

    // Check for active enrollments
    const activeEnrollments = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.enrollments)
      .where(
        and(
          eq(schema.enrollments.classId, classId),
          eq(schema.enrollments.isActive, true)
        )
      );

    if ((activeEnrollments[0]?.count || 0) > 0) {
      return errorResponse(
        'Cannot delete class',
        409,
        'This class has active enrollments. Please unenroll all students before deleting.'
      );
    }

    // Delete the class (will cascade to inactive enrollments)
    await db
      .delete(schema.classes)
      .where(eq(schema.classes.id, classId));

    return successResponse(
      { deleted: true },
      'Class deleted successfully'
    );
  } catch (error) {
    console.error('Error deleting class:', error);
    return errorResponse(
      'Failed to delete class',
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

