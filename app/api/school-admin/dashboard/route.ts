import { NextRequest } from 'next/server';
import { eq, and, sql } from 'drizzle-orm';
import { getDatabase, schema } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/utils/api-response';
import { handleOptions } from '@/lib/middleware/cors';
import { authenticateSchoolAdmin } from '@/lib/middleware/school-admin-auth';

/**
 * School Admin Dashboard Stats API
 * GET /api/school-admin/dashboard
 * 
 * Returns summary statistics for the school dashboard
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

  const { schoolId, schoolName, schoolCode } = authResult.context;

  try {
    const db = await getDatabase();

    // Get all stats in parallel
    const [
      totalStudentsResult,
      activeStudentsResult,
      totalClassesResult,
      activeEnrollmentsResult,
      studentsByStatusResult,
      recentStudentsResult,
    ] = await Promise.all([
      // Total students count
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.students)
        .where(eq(schema.students.schoolId, schoolId)),

      // Active students count
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.students)
        .where(
          and(
            eq(schema.students.schoolId, schoolId),
            eq(schema.students.status, 'active')
          )
        ),

      // Total classes count
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.classes)
        .where(eq(schema.classes.schoolId, schoolId)),

      // Active enrollments count
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.enrollments)
        .innerJoin(schema.classes, eq(schema.enrollments.classId, schema.classes.id))
        .where(
          and(
            eq(schema.classes.schoolId, schoolId),
            eq(schema.enrollments.isActive, true)
          )
        ),

      // Students grouped by status
      db
        .select({
          status: schema.students.status,
          count: sql<number>`count(*)::int`,
        })
        .from(schema.students)
        .where(eq(schema.students.schoolId, schoolId))
        .groupBy(schema.students.status),

      // Recent 5 students
      db
        .select({
          id: schema.students.id,
          name: schema.students.name,
          email: schema.students.email,
          status: schema.students.status,
          createdAt: schema.students.createdAt,
        })
        .from(schema.students)
        .where(eq(schema.students.schoolId, schoolId))
        .orderBy(sql`${schema.students.createdAt} DESC`)
        .limit(5),
    ]);

    // Get classes with student counts
    const classesWithCounts = await db
      .select({
        id: schema.classes.id,
        className: schema.classlist.className,
        classNumber: schema.classlist.classNumber,
        section: schema.classes.section,
        session: schema.classes.session,
        studentCount: sql<number>`count(${schema.enrollments.id})::int`,
      })
      .from(schema.classes)
      .innerJoin(schema.classlist, eq(schema.classes.classId, schema.classlist.id))
      .leftJoin(
        schema.enrollments,
        and(
          eq(schema.enrollments.classId, schema.classes.id),
          eq(schema.enrollments.isActive, true)
        )
      )
      .where(eq(schema.classes.schoolId, schoolId))
      .groupBy(
        schema.classes.id,
        schema.classlist.className,
        schema.classlist.classNumber,
        schema.classes.section,
        schema.classes.session
      )
      .orderBy(schema.classlist.classNumber, schema.classes.section);

    // Format students by status as an object
    const studentsByStatus: Record<string, number> = {};
    for (const row of studentsByStatusResult) {
      studentsByStatus[row.status] = row.count;
    }

    return successResponse(
      {
        school: {
          id: schoolId,
          name: schoolName,
          code: schoolCode,
        },
        stats: {
          totalStudents: totalStudentsResult[0]?.count || 0,
          activeStudents: activeStudentsResult[0]?.count || 0,
          totalClasses: totalClassesResult[0]?.count || 0,
          activeEnrollments: activeEnrollmentsResult[0]?.count || 0,
          studentsByStatus,
        },
        recentStudents: recentStudentsResult,
        classesOverview: classesWithCounts,
      },
      'Dashboard stats retrieved successfully'
    );
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return errorResponse(
      'Failed to fetch dashboard stats',
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

