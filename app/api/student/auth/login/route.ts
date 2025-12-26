import { NextRequest } from 'next/server';
import { eq, and, desc } from 'drizzle-orm';
import { getDatabase, schema } from '@/lib/db';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/utils/api-response';
import { generateToken } from '@/lib/utils/jwt';
import { verifyPassword } from '@/lib/utils/password';
import { handleOptions } from '@/lib/middleware/cors';
import { z } from 'zod';

// Validation schema for login request
const loginSchema = z.object({
  phone: z.string().min(10).max(20),
  password: z.string().min(6),
});

/**
 * Student Login API
 * POST /api/student/login
 * 
 * Request body:
 * {
 *   "phone": "1234567890",
 *   "password": "password123"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "students": [
 *       {
 *         "token": "jwt_token_here",
 *         "schoolName": "ABC School",
 *         "name": "John Doe",
 *         "class": "10",
 *         "section": "A"
 *       },
 *       {
 *         "schoolName": "XYZ School",
 *         "name": "Jane Smith",
 *         "class": null,
 *         "section": null,
 *         "infoMessage": "No active enrollment found. Please contact your school administrator."
 *       }
 *     ]
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validationResult = loginSchema.safeParse(body);

    if (!validationResult.success) {
      return errorResponse(
        'Validation failed',
        400,
        validationResult.error.issues.map(e => e.message).join(', ')
      );
    }

    const { phone, password } = validationResult.data;

    // Get database instance
    const db = await getDatabase();

    // Find user by phone number
    const user = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.phone, phone))
      .limit(1);

    if (user.length === 0) {
      return unauthorizedResponse('Invalid phone number or password');
    }

    const userData = user[0];

    // Verify password
    const isPasswordValid = await verifyPassword(password, userData.passwordHash);
    if (!isPasswordValid) {
      return unauthorizedResponse('Invalid phone number or password');
    }

    // Optimized single query: Get all students with their latest active enrollment in one go
    // Using LEFT JOIN to include students without enrollments
    // Results are ordered by studentId then enrollmentDate DESC to get latest enrollment first
    const studentsWithEnrollments = await db
      .select({
        studentId: schema.students.id,
        studentName: schema.students.name,
        studentStatus: schema.students.status,
        schoolId: schema.students.schoolId,
        schoolName: schema.schools.name,
        enrollmentId: schema.enrollments.id,
        className: schema.classes.className,
        section: schema.classes.section,
        enrollmentDate: schema.enrollments.enrollmentDate,
        isActive: schema.enrollments.isActive,
      })
      .from(schema.students)
      .innerJoin(schema.schools, eq(schema.students.schoolId, schema.schools.id))
      .leftJoin(
        schema.enrollments,
        and(
          eq(schema.enrollments.studentId, schema.students.id),
          eq(schema.enrollments.isActive, true)
        )
      )
      .leftJoin(schema.classes, eq(schema.enrollments.classId, schema.classes.id))
      .where(eq(schema.students.userId, userData.id))
      .orderBy(
        schema.students.id,
        desc(schema.enrollments.enrollmentDate)
      );

    if (studentsWithEnrollments.length === 0) {
      return errorResponse(
        'No student profile found for this user',
        404,
        'Please contact your school administrator'
      );
    }

    // Process results: Group by student and get latest enrollment
    // Since results are ordered by studentId then enrollmentDate DESC,
    // the first row for each student will be the latest enrollment (or NULL if no enrollment)
    const studentMap = new Map<
      number,
      {
        studentId: number;
        name: string;
        status: string;
        schoolId: number;
        schoolName: string;
        enrollmentId: number | null;
        className: string | null;
        section: string | null;
      }
    >();

    for (const row of studentsWithEnrollments) {
      // Only process if we haven't seen this student yet
      // Since results are ordered, first occurrence is the latest enrollment
      if (!studentMap.has(row.studentId)) {
        studentMap.set(row.studentId, {
          studentId: row.studentId,
          name: row.studentName,
          status: row.studentStatus,
          schoolId: row.schoolId,
          schoolName: row.schoolName,
          enrollmentId: row.enrollmentId,
          className: row.className,
          section: row.section,
        });
      }
    }

    // Process each student and generate response
    const studentsResponse = Array.from(studentMap.values()).map((student) => {
      // Check if student status is not active
      if (student.status !== 'active') {
        return {
          schoolName: student.schoolName,
          name: student.name,
          class: null,
          section: null,
          infoMessage: `Student status is ${student.status}.`,
        };
      }

      // Check if student has no enrollment
      if (!student.enrollmentId) {
        return {
          schoolName: student.schoolName,
          name: student.name,
          class: null,
          section: null,
          infoMessage: 'No active enrollment found.',
        };
      }

      // Student is active and has enrollment - generate token
      const token = generateToken({
        studentId: student.studentId,
        userId: userData.id,
        enrollmentId: student.enrollmentId,
        schoolId: student.schoolId,
        role: 'student',
      });

      return {
        token,
        schoolName: student.schoolName,
        name: student.name,
        class: student.className,
        section: student.section,
      };
    });

    // Check only if there are some students
    const hasValidStudents = studentsResponse[0];

    if (!hasValidStudents) {
      return errorResponse(
        'No active enrollment found for any student profile',
        404,
        'Please contact your school administrator'
      );
    }

    // Prepare response data
    const responseData = {
      students: studentsResponse,
    };

    return successResponse(responseData, 'Login successful');
  } catch (error) {
    console.error('Login error:', error);
    return errorResponse(
      'Login failed',
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

