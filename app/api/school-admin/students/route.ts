import { NextRequest } from 'next/server';
import { eq, and, desc, asc, ilike, or, sql } from 'drizzle-orm';
import { getDatabase, schema } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/utils/api-response';
import { handleOptions } from '@/lib/middleware/cors';
import { authenticateSchoolAdmin } from '@/lib/middleware/school-admin-auth';
import { hashPassword } from '@/lib/utils/password';
import { z } from 'zod';

// Validation schema for creating a new student
const createStudentSchema = z.object({
  userId: z.number().positive('Valid user ID is required'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(200),
  gender: z.enum(['male', 'female', 'other']),
  email: z.string().email('Invalid email format'),
  address: z.string().optional(),
  dateOfBirth: z.string().optional(), // ISO date string
  fatherName: z.string().max(200).optional(),
  motherName: z.string().max(200).optional(),
  category: z.string().max(100).optional(),
  aadharNumber: z.string().max(20).optional(),
  status: z.enum(['active', 'inactive', 'suspended', 'graduated', 'transferred']).optional(),
});

/**
 * List all students for the authenticated school
 * GET /api/school-admin/students
 * 
 * Query Parameters:
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 * - search: string (searches in name, email, aadhar)
 * - status: 'active' | 'inactive' | 'suspended' | 'graduated' | 'transferred'
 * - classId: number (filter by class enrollment)
 * - sortBy: 'name' | 'enrollmentDate' | 'createdAt' (default: 'createdAt')
 * - sortOrder: 'asc' | 'desc' (default: 'desc')
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
    const search = searchParams.get('search')?.trim() || '';
    const status = searchParams.get('status') || '';
    const classId = searchParams.get('classId');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const offset = (page - 1) * limit;

    // Build base conditions - always filter by school
    const baseCondition = eq(schema.students.schoolId, schoolId);

    // Build search condition
    let searchCondition;
    if (search) {
      searchCondition = or(
        ilike(schema.students.name, `%${search}%`),
        ilike(schema.students.email, `%${search}%`),
        ilike(schema.students.aadharNumber, `%${search}%`),
        ilike(schema.students.fatherName, `%${search}%`),
        ilike(schema.students.motherName, `%${search}%`)
      );
    }

    // Build status condition
    let statusCondition;
    if (status && ['active', 'inactive', 'suspended', 'graduated', 'transferred'].includes(status)) {
      statusCondition = eq(schema.students.status, status as typeof schema.students.status.enumValues[number]);
    }

    // Combine conditions
    const whereConditions = and(
      baseCondition,
      searchCondition,
      statusCondition
    );

    // Determine sort column
    const sortColumn = {
      name: schema.students.name,
      enrollmentDate: schema.students.enrollmentDate,
      createdAt: schema.students.createdAt,
    }[sortBy] || schema.students.createdAt;

    // If filtering by class, we need a different query
    if (classId) {
      const classIdNum = parseInt(classId, 10);
      if (isNaN(classIdNum)) {
        return errorResponse('Invalid class ID', 400);
      }

      // Query with class filter through enrollments
      const [studentsRaw, countResult] = await Promise.all([
        db
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
            userId: schema.students.userId,
            userPhone: schema.users.phone,
            enrollmentId: schema.enrollments.id,
            enrollmentIsActive: schema.enrollments.isActive,
            className: schema.classlist.className,
            classNumber: schema.classlist.classNumber,
            section: schema.classes.section,
            session: schema.classes.session,
          })
          .from(schema.students)
          .innerJoin(schema.users, eq(schema.students.userId, schema.users.id))
          .innerJoin(schema.enrollments, eq(schema.enrollments.studentId, schema.students.id))
          .innerJoin(schema.classes, eq(schema.enrollments.classId, schema.classes.id))
          .innerJoin(schema.classlist, eq(schema.classes.classId, schema.classlist.id))
          .where(and(whereConditions, eq(schema.classes.id, classIdNum)))
          .orderBy(sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`count(DISTINCT ${schema.students.id})::int` })
          .from(schema.students)
          .innerJoin(schema.enrollments, eq(schema.enrollments.studentId, schema.students.id))
          .innerJoin(schema.classes, eq(schema.enrollments.classId, schema.classes.id))
          .where(and(whereConditions, eq(schema.classes.id, classIdNum))),
      ]);

      const totalCount = countResult[0]?.count || 0;
      const totalPages = Math.ceil(totalCount / limit);

      return successResponse(
        {
          students: studentsRaw,
          pagination: {
            page,
            limit,
            totalCount,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
          },
        },
        'Students retrieved successfully'
      );
    }

    // Regular query without class filter
    const [studentsRaw, countResult] = await Promise.all([
      db
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
          userId: schema.students.userId,
          userPhone: schema.users.phone,
        })
        .from(schema.students)
        .innerJoin(schema.users, eq(schema.students.userId, schema.users.id))
        .where(whereConditions)
        .orderBy(sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.students)
        .where(whereConditions),
    ]);

    // Fetch active enrollments for these students
    const studentIds = studentsRaw.map(s => s.id);
    let enrollmentsMap: Map<number, {
      enrollmentId: number;
      className: string;
      classNumber: number;
      section: string;
      session: string;
      isActive: boolean;
    }[]> = new Map();

    if (studentIds.length > 0) {
      const enrollments = await db
        .select({
          studentId: schema.enrollments.studentId,
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
            sql`${schema.enrollments.studentId} IN (${sql.join(studentIds.map(id => sql`${id}`), sql`, `)})`,
            eq(schema.enrollments.isActive, true)
          )
        );

      for (const enrollment of enrollments) {
        const existing = enrollmentsMap.get(enrollment.studentId) || [];
        existing.push({
          enrollmentId: enrollment.enrollmentId,
          className: enrollment.className,
          classNumber: enrollment.classNumber,
          section: enrollment.section,
          session: enrollment.session,
          isActive: enrollment.isActive,
        });
        enrollmentsMap.set(enrollment.studentId, existing);
      }
    }

    // Combine student data with enrollments
    const students = studentsRaw.map(student => ({
      ...student,
      enrollments: enrollmentsMap.get(student.id) || [],
    }));

    const totalCount = countResult[0]?.count || 0;
    const totalPages = Math.ceil(totalCount / limit);

    return successResponse(
      {
        students,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
      'Students retrieved successfully'
    );
  } catch (error) {
    console.error('Error fetching students:', error);
    return errorResponse(
      'Failed to fetch students',
      500,
      error instanceof Error ? error.message : 'An unexpected error occurred'
    );
  }
}

/**
 * Create a new student for the authenticated school
 * POST /api/school-admin/students
 * 
 * Request Body:
 * {
 *   "userId": 123, (required - from user creation step)
 *   "name": "Student Name",
 *   "gender": "male" | "female" | "other",
 *   "email": "student@email.com",
 *   "address": "Full Address",
 *   "dateOfBirth": "2005-01-15",
 *   "fatherName": "Father Name",
 *   "motherName": "Mother Name",
 *   "category": "General",
 *   "aadharNumber": "1234-5678-9012"
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
    const validationResult = createStudentSchema.safeParse(body);
    if (!validationResult.success) {
      return errorResponse(
        'Validation failed',
        400,
        validationResult.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      );
    }

    const studentData = validationResult.data;

    // Verify the user exists
    const user = await db
      .select({ id: schema.users.id, phone: schema.users.phone })
      .from(schema.users)
      .where(eq(schema.users.id, studentData.userId))
      .limit(1);

    if (user.length === 0) {
      return errorResponse('User not found. Please create the user first.', 404);
    }

    // Check if student already exists for this user and school
    const existingStudent = await db
      .select({ id: schema.students.id })
      .from(schema.students)
      .where(
        and(
          eq(schema.students.userId, studentData.userId),
          eq(schema.students.schoolId, schoolId)
        )
      )
      .limit(1);

    if (existingStudent.length > 0) {
      return errorResponse(
        'Student already exists',
        409,
        'A student profile already exists for this user in your school'
      );
    }

    // Create the student
    const newStudent = await db
      .insert(schema.students)
      .values({
        schoolId,
        userId: studentData.userId,
        name: studentData.name.trim(),
        gender: studentData.gender,
        email: studentData.email.trim().toLowerCase(),
        address: studentData.address?.trim() || null,
        dateOfBirth: studentData.dateOfBirth ? new Date(studentData.dateOfBirth) : null,
        fatherName: studentData.fatherName?.trim() || null,
        motherName: studentData.motherName?.trim() || null,
        category: studentData.category?.trim() || null,
        aadharNumber: studentData.aadharNumber?.trim() || null,
        status: studentData.status || 'active',
      })
      .returning();

    return successResponse(
      {
        student: {
          ...newStudent[0],
          phone: user[0].phone,
        },
      },
      'Student created successfully',
      201
    );
  } catch (error) {
    console.error('Error creating student:', error);
    return errorResponse(
      'Failed to create student',
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

