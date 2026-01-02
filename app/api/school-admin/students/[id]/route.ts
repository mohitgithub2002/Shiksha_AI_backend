import { NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { getDatabase, schema } from '@/lib/db';
import { successResponse, errorResponse, notFoundResponse } from '@/lib/utils/api-response';
import { handleOptions } from '@/lib/middleware/cors';
import { authenticateSchoolAdmin } from '@/lib/middleware/school-admin-auth';
import { z } from 'zod';

// Validation schema for updating a student
const updateStudentSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(200).optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  email: z.string().email('Invalid email format').optional(),
  address: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  fatherName: z.string().max(200).optional().nullable(),
  motherName: z.string().max(200).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  aadharNumber: z.string().max(20).optional().nullable(),
  status: z.enum(['active', 'inactive', 'suspended', 'graduated', 'transferred']).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Get a specific student by ID
 * GET /api/school-admin/students/[id]
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
  const studentId = parseInt(id, 10);

  if (isNaN(studentId)) {
    return errorResponse('Invalid student ID', 400);
  }

  try {
    const db = await getDatabase();

    // Fetch student with user phone
    const studentData = await db
      .select({
        id: schema.students.id,
        name: schema.students.name,
        gender: schema.students.gender,
        email: schema.students.email,
        address: schema.students.address,
        dateOfBirth: schema.students.dateOfBirth,
        fatherName: schema.students.fatherName,
        motherName: schema.students.motherName,
        category: schema.students.category,
        aadharNumber: schema.students.aadharNumber,
        enrollmentDate: schema.students.enrollmentDate,
        status: schema.students.status,
        createdAt: schema.students.createdAt,
        updatedAt: schema.students.updatedAt,
        userId: schema.students.userId,
        userPhone: schema.users.phone,
        schoolId: schema.students.schoolId,
      })
      .from(schema.students)
      .innerJoin(schema.users, eq(schema.students.userId, schema.users.id))
      .where(
        and(
          eq(schema.students.id, studentId),
          eq(schema.students.schoolId, schoolId)
        )
      )
      .limit(1);

    if (studentData.length === 0) {
      return notFoundResponse('Student not found');
    }

    // Fetch all enrollments for this student
    const enrollments = await db
      .select({
        id: schema.enrollments.id,
        classId: schema.enrollments.classId,
        className: schema.classlist.className,
        classNumber: schema.classlist.classNumber,
        section: schema.classes.section,
        session: schema.classes.session,
        stream: schema.classlist.stream,
        enrollmentDate: schema.enrollments.enrollmentDate,
        isActive: schema.enrollments.isActive,
      })
      .from(schema.enrollments)
      .innerJoin(schema.classes, eq(schema.enrollments.classId, schema.classes.id))
      .innerJoin(schema.classlist, eq(schema.classes.classId, schema.classlist.id))
      .where(eq(schema.enrollments.studentId, studentId));

    return successResponse(
      {
        student: {
          ...studentData[0],
          enrollments,
        },
      },
      'Student retrieved successfully'
    );
  } catch (error) {
    console.error('Error fetching student:', error);
    return errorResponse(
      'Failed to fetch student',
      500,
      error instanceof Error ? error.message : 'An unexpected error occurred'
    );
  }
}

/**
 * Update a student
 * PATCH /api/school-admin/students/[id]
 * 
 * Request Body:
 * {
 *   "name": "Updated Name",
 *   "email": "new@email.com",
 *   "status": "inactive",
 *   ... other fields
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
  const studentId = parseInt(id, 10);

  if (isNaN(studentId)) {
    return errorResponse('Invalid student ID', 400);
  }

  try {
    const db = await getDatabase();
    const body = await request.json();

    // Validate request body
    const validationResult = updateStudentSchema.safeParse(body);
    if (!validationResult.success) {
      return errorResponse(
        'Validation failed',
        400,
        validationResult.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      );
    }

    const updateData = validationResult.data;

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return errorResponse('No fields to update provided', 400);
    }

    // Verify student exists and belongs to this school
    const existingStudent = await db
      .select({ id: schema.students.id })
      .from(schema.students)
      .where(
        and(
          eq(schema.students.id, studentId),
          eq(schema.students.schoolId, schoolId)
        )
      )
      .limit(1);

    if (existingStudent.length === 0) {
      return notFoundResponse('Student not found');
    }

    // Prepare update object
    const updateValues: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (updateData.name !== undefined) updateValues.name = updateData.name.trim();
    if (updateData.gender !== undefined) updateValues.gender = updateData.gender;
    if (updateData.email !== undefined) updateValues.email = updateData.email.trim().toLowerCase();
    if (updateData.address !== undefined) updateValues.address = updateData.address?.trim() || null;
    if (updateData.dateOfBirth !== undefined) {
      updateValues.dateOfBirth = updateData.dateOfBirth ? new Date(updateData.dateOfBirth) : null;
    }
    if (updateData.fatherName !== undefined) updateValues.fatherName = updateData.fatherName?.trim() || null;
    if (updateData.motherName !== undefined) updateValues.motherName = updateData.motherName?.trim() || null;
    if (updateData.category !== undefined) updateValues.category = updateData.category?.trim() || null;
    if (updateData.aadharNumber !== undefined) updateValues.aadharNumber = updateData.aadharNumber?.trim() || null;
    if (updateData.status !== undefined) updateValues.status = updateData.status;

    // Update student
    const updatedStudent = await db
      .update(schema.students)
      .set(updateValues)
      .where(eq(schema.students.id, studentId))
      .returning();

    // Fetch user phone
    const user = await db
      .select({ phone: schema.users.phone })
      .from(schema.users)
      .where(eq(schema.users.id, updatedStudent[0].userId))
      .limit(1);

    return successResponse(
      {
        student: {
          ...updatedStudent[0],
          userPhone: user[0]?.phone,
        },
      },
      'Student updated successfully'
    );
  } catch (error) {
    console.error('Error updating student:', error);
    return errorResponse(
      'Failed to update student',
      500,
      error instanceof Error ? error.message : 'An unexpected error occurred'
    );
  }
}

/**
 * Delete a student
 * DELETE /api/school-admin/students/[id]
 * 
 * Note: This soft-deletes by changing status to 'inactive' and deactivating all enrollments
 * Use query param ?hard=true to permanently delete
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
  const studentId = parseInt(id, 10);
  const hardDelete = request.nextUrl.searchParams.get('hard') === 'true';

  if (isNaN(studentId)) {
    return errorResponse('Invalid student ID', 400);
  }

  try {
    const db = await getDatabase();

    // Verify student exists and belongs to this school
    const existingStudent = await db
      .select({ id: schema.students.id, name: schema.students.name })
      .from(schema.students)
      .where(
        and(
          eq(schema.students.id, studentId),
          eq(schema.students.schoolId, schoolId)
        )
      )
      .limit(1);

    if (existingStudent.length === 0) {
      return notFoundResponse('Student not found');
    }

    if (hardDelete) {
      // Permanently delete (enrollments will cascade)
      await db
        .delete(schema.students)
        .where(eq(schema.students.id, studentId));

      return successResponse(
        { deleted: true, hard: true },
        'Student permanently deleted'
      );
    } else {
      // Soft delete - change status and deactivate enrollments
      await db
        .update(schema.students)
        .set({
          status: 'inactive',
          updatedAt: new Date(),
        })
        .where(eq(schema.students.id, studentId));

      // Deactivate all enrollments
      await db
        .update(schema.enrollments)
        .set({ isActive: false })
        .where(eq(schema.enrollments.studentId, studentId));

      return successResponse(
        { deleted: true, hard: false },
        'Student deactivated and unenrolled from all classes'
      );
    }
  } catch (error) {
    console.error('Error deleting student:', error);
    return errorResponse(
      'Failed to delete student',
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

