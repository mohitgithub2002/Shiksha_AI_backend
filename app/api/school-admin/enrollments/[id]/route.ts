import { NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { getDatabase, schema } from '@/lib/db';
import { successResponse, errorResponse, notFoundResponse } from '@/lib/utils/api-response';
import { handleOptions } from '@/lib/middleware/cors';
import { authenticateSchoolAdmin } from '@/lib/middleware/school-admin-auth';
import { z } from 'zod';

// Validation schema for updating enrollment
const updateEnrollmentSchema = z.object({
  isActive: z.boolean().optional(),
  classId: z.number().positive('Valid class ID is required').optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Get a specific enrollment by ID
 * GET /api/school-admin/enrollments/[id]
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
  const enrollmentId = parseInt(id, 10);

  if (isNaN(enrollmentId)) {
    return errorResponse('Invalid enrollment ID', 400);
  }

  try {
    const db = await getDatabase();

    // Fetch enrollment with details
    const enrollment = await db
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
        schoolId: schema.classes.schoolId,
      })
      .from(schema.enrollments)
      .innerJoin(schema.students, eq(schema.enrollments.studentId, schema.students.id))
      .innerJoin(schema.classes, eq(schema.enrollments.classId, schema.classes.id))
      .innerJoin(schema.classlist, eq(schema.classes.classId, schema.classlist.id))
      .where(
        and(
          eq(schema.enrollments.id, enrollmentId),
          eq(schema.classes.schoolId, schoolId)
        )
      )
      .limit(1);

    if (enrollment.length === 0) {
      return notFoundResponse('Enrollment not found');
    }

    return successResponse(
      { enrollment: enrollment[0] },
      'Enrollment retrieved successfully'
    );
  } catch (error) {
    console.error('Error fetching enrollment:', error);
    return errorResponse(
      'Failed to fetch enrollment',
      500,
      error instanceof Error ? error.message : 'An unexpected error occurred'
    );
  }
}

/**
 * Update an enrollment (change class or active status)
 * PATCH /api/school-admin/enrollments/[id]
 * 
 * Request Body:
 * {
 *   "isActive": false, (to deactivate/unenroll)
 *   "classId": 10 (to transfer to different class)
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
  const enrollmentId = parseInt(id, 10);

  if (isNaN(enrollmentId)) {
    return errorResponse('Invalid enrollment ID', 400);
  }

  try {
    const db = await getDatabase();
    const body = await request.json();

    // Validate request body
    const validationResult = updateEnrollmentSchema.safeParse(body);
    if (!validationResult.success) {
      return errorResponse(
        'Validation failed',
        400,
        validationResult.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      );
    }

    const updateData = validationResult.data;

    // Check if there's anything to update
    if (updateData.isActive === undefined && updateData.classId === undefined) {
      return errorResponse('No fields to update provided', 400);
    }

    // Verify enrollment exists and belongs to this school
    const existingEnrollment = await db
      .select({
        id: schema.enrollments.id,
        studentId: schema.enrollments.studentId,
        classId: schema.enrollments.classId,
        isActive: schema.enrollments.isActive,
        schoolId: schema.classes.schoolId,
      })
      .from(schema.enrollments)
      .innerJoin(schema.classes, eq(schema.enrollments.classId, schema.classes.id))
      .where(
        and(
          eq(schema.enrollments.id, enrollmentId),
          eq(schema.classes.schoolId, schoolId)
        )
      )
      .limit(1);

    if (existingEnrollment.length === 0) {
      return notFoundResponse('Enrollment not found');
    }

    // If changing class, verify new class belongs to this school
    if (updateData.classId !== undefined) {
      const newClass = await db
        .select({ id: schema.classes.id, schoolId: schema.classes.schoolId })
        .from(schema.classes)
        .where(
          and(
            eq(schema.classes.id, updateData.classId),
            eq(schema.classes.schoolId, schoolId)
          )
        )
        .limit(1);

      if (newClass.length === 0) {
        return errorResponse('New class not found in this school', 400);
      }

      // Check if enrollment already exists for this student in new class
      const duplicateEnrollment = await db
        .select({ id: schema.enrollments.id })
        .from(schema.enrollments)
        .where(
          and(
            eq(schema.enrollments.studentId, existingEnrollment[0].studentId),
            eq(schema.enrollments.classId, updateData.classId)
          )
        )
        .limit(1);

      if (duplicateEnrollment.length > 0 && duplicateEnrollment[0].id !== enrollmentId) {
        return errorResponse(
          'Duplicate enrollment',
          409,
          'Student already has an enrollment in the target class'
        );
      }
    }

    // Update enrollment
    const updatedEnrollment = await db
      .update(schema.enrollments)
      .set({
        isActive: updateData.isActive ?? existingEnrollment[0].isActive,
        classId: updateData.classId ?? existingEnrollment[0].classId,
      })
      .where(eq(schema.enrollments.id, enrollmentId))
      .returning();

    // Fetch updated enrollment with full details
    const fullEnrollment = await db
      .select({
        id: schema.enrollments.id,
        studentId: schema.enrollments.studentId,
        studentName: schema.students.name,
        studentEmail: schema.students.email,
        classId: schema.enrollments.classId,
        className: schema.classlist.className,
        classNumber: schema.classlist.classNumber,
        section: schema.classes.section,
        session: schema.classes.session,
        enrollmentDate: schema.enrollments.enrollmentDate,
        isActive: schema.enrollments.isActive,
      })
      .from(schema.enrollments)
      .innerJoin(schema.students, eq(schema.enrollments.studentId, schema.students.id))
      .innerJoin(schema.classes, eq(schema.enrollments.classId, schema.classes.id))
      .innerJoin(schema.classlist, eq(schema.classes.classId, schema.classlist.id))
      .where(eq(schema.enrollments.id, enrollmentId))
      .limit(1);

    return successResponse(
      { enrollment: fullEnrollment[0] },
      updateData.isActive === false ? 'Student unenrolled successfully' : 'Enrollment updated successfully'
    );
  } catch (error) {
    console.error('Error updating enrollment:', error);
    return errorResponse(
      'Failed to update enrollment',
      500,
      error instanceof Error ? error.message : 'An unexpected error occurred'
    );
  }
}

/**
 * Delete an enrollment
 * DELETE /api/school-admin/enrollments/[id]
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
  const enrollmentId = parseInt(id, 10);

  if (isNaN(enrollmentId)) {
    return errorResponse('Invalid enrollment ID', 400);
  }

  try {
    const db = await getDatabase();

    // Verify enrollment exists and belongs to this school
    const existingEnrollment = await db
      .select({ id: schema.enrollments.id })
      .from(schema.enrollments)
      .innerJoin(schema.classes, eq(schema.enrollments.classId, schema.classes.id))
      .where(
        and(
          eq(schema.enrollments.id, enrollmentId),
          eq(schema.classes.schoolId, schoolId)
        )
      )
      .limit(1);

    if (existingEnrollment.length === 0) {
      return notFoundResponse('Enrollment not found');
    }

    // Delete enrollment
    await db
      .delete(schema.enrollments)
      .where(eq(schema.enrollments.id, enrollmentId));

    return successResponse(
      { deleted: true },
      'Enrollment deleted successfully'
    );
  } catch (error) {
    console.error('Error deleting enrollment:', error);
    return errorResponse(
      'Failed to delete enrollment',
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

