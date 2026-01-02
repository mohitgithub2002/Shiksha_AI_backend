import { NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { getDatabase, schema } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/utils/api-response';
import { handleOptions } from '@/lib/middleware/cors';
import { authenticateSchoolAdmin } from '@/lib/middleware/school-admin-auth';
import { z } from 'zod';

// Validation schema for phone check
const checkPhoneSchema = z.object({
  phone: z.string().min(10, 'Phone number must be at least 10 digits').max(20),
});

/**
 * Check if a phone number is already registered
 * POST /api/school-admin/students/check-phone
 * 
 * This is the first step in student registration:
 * 1. Check if user with phone exists
 * 2. If exists, check if student exists for this school
 * 3. Return appropriate next steps
 * 
 * Request Body:
 * {
 *   "phone": "1234567890"
 * }
 * 
 * Response Cases:
 * 1. User doesn't exist - needs to create user first
 * 2. User exists but no student in this school - can directly create student
 * 3. User exists and student exists in this school - already registered
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

  const { schoolId, schoolName } = authResult.context;

  try {
    const db = await getDatabase();
    const body = await request.json();

    // Validate request body
    const validationResult = checkPhoneSchema.safeParse(body);
    if (!validationResult.success) {
      return errorResponse(
        'Validation failed',
        400,
        validationResult.error.issues.map(e => e.message).join(', ')
      );
    }

    const { phone } = validationResult.data;

    // Normalize phone number
    const normalizedPhone = phone.replace(/[\s\-\(\)]/g, '');

    // Check if user exists with this phone
    const existingUser = await db
      .select({
        id: schema.users.id,
        phone: schema.users.phone,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .where(eq(schema.users.phone, normalizedPhone))
      .limit(1);

    if (existingUser.length === 0) {
      // User doesn't exist - need to create user first
      return successResponse(
        {
          userExists: false,
          studentExistsInSchool: false,
          nextStep: 'CREATE_USER',
          message: 'Phone number is not registered. Create a new user account.',
        },
        'Phone number available'
      );
    }

    const user = existingUser[0];

    // User exists - check if student exists for this school
    const existingStudent = await db
      .select({
        id: schema.students.id,
        name: schema.students.name,
        email: schema.students.email,
        status: schema.students.status,
        createdAt: schema.students.createdAt,
      })
      .from(schema.students)
      .where(
        and(
          eq(schema.students.userId, user.id),
          eq(schema.students.schoolId, schoolId)
        )
      )
      .limit(1);

    if (existingStudent.length === 0) {
      // User exists but no student profile in this school
      return successResponse(
        {
          userExists: true,
          studentExistsInSchool: false,
          userId: user.id,
          nextStep: 'CREATE_STUDENT',
          message: 'User account found. You can create a student profile for this school.',
        },
        'User found, student profile needed'
      );
    }

    // Student already exists for this school
    const student = existingStudent[0];

    // Get active enrollments for this student
    const enrollments = await db
      .select({
        enrollmentId: schema.enrollments.id,
        className: schema.classlist.className,
        classNumber: schema.classlist.classNumber,
        section: schema.classes.section,
        session: schema.classes.session,
        isActive: schema.enrollments.isActive,
      })
      .from(schema.enrollments)
      .innerJoin(schema.classes, eq(schema.enrollments.classId, schema.classes.id))
      .innerJoin(schema.classlist, eq(schema.classes.classId, schema.classlist.id))
      .where(
        and(
          eq(schema.enrollments.studentId, student.id),
          eq(schema.enrollments.isActive, true)
        )
      );

    return successResponse(
      {
        userExists: true,
        studentExistsInSchool: true,
        userId: user.id,
        student: {
          id: student.id,
          name: student.name,
          email: student.email,
          status: student.status,
          enrollments,
        },
        nextStep: enrollments.length > 0 ? 'ALREADY_ENROLLED' : 'ENROLL_STUDENT',
        message: enrollments.length > 0
          ? `Student is already registered and enrolled in ${schoolName}`
          : `Student is registered but not enrolled in any class. You can enroll them now.`,
      },
      'Student already registered'
    );
  } catch (error) {
    console.error('Error checking phone:', error);
    return errorResponse(
      'Failed to check phone number',
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

