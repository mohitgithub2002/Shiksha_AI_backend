import { NextRequest } from 'next/server';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { getDatabase, schema } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/utils/api-response';
import { handleOptions } from '@/lib/middleware/cors';
import { authenticateSchoolAdmin } from '@/lib/middleware/school-admin-auth';
import { z } from 'zod';

// Validation schema for creating a class
const createClassSchema = z.object({
  classId: z.number().positive('Valid class ID from classlist is required'),
  session: z.string().min(1, 'Session is required').max(100),
  section: z.string().min(1, 'Section is required').max(100),
});

/**
 * List all classes for the authenticated school
 * GET /api/school-admin/classes
 * 
 * Query Parameters:
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 * - session: string (filter by session, e.g., "2024-25")
 * - classNumber: number (filter by class number, e.g., 9, 10, 11)
 * - sortBy: 'className' | 'session' | 'section' | 'createdAt' (default: 'className')
 * - sortOrder: 'asc' | 'desc' (default: 'asc')
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
    const session = searchParams.get('session')?.trim() || '';
    const classNumber = searchParams.get('classNumber');
    const sortBy = searchParams.get('sortBy') || 'className';
    const sortOrder = searchParams.get('sortOrder') || 'asc';

    const offset = (page - 1) * limit;

    // Build base condition - always filter by school
    const baseCondition = eq(schema.classes.schoolId, schoolId);

    // Build session filter
    let sessionCondition;
    if (session) {
      sessionCondition = eq(schema.classes.session, session);
    }

    // Build class number filter
    let classNumberCondition;
    if (classNumber) {
      const classNum = parseInt(classNumber, 10);
      if (!isNaN(classNum)) {
        classNumberCondition = eq(schema.classlist.classNumber, classNum);
      }
    }

    // Combine conditions
    const whereConditions = and(
      baseCondition,
      sessionCondition,
      classNumberCondition
    );

    // Determine sort column
    const sortColumnMap: Record<string, typeof schema.classlist.className | typeof schema.classes.session | typeof schema.classes.section | typeof schema.classes.createdAt> = {
      className: schema.classlist.className,
      session: schema.classes.session,
      section: schema.classes.section,
      createdAt: schema.classes.createdAt,
    };
    const sortColumn = sortColumnMap[sortBy] || schema.classlist.className;

    // Execute queries
    const [classesRaw, countResult] = await Promise.all([
      db
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
        .where(whereConditions)
        .orderBy(sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.classes)
        .innerJoin(schema.classlist, eq(schema.classes.classId, schema.classlist.id))
        .where(whereConditions),
    ]);

    // Get student count for each class
    const classIds = classesRaw.map(c => c.id);
    let studentCounts: Map<number, number> = new Map();

    if (classIds.length > 0) {
      const counts = await db
        .select({
          classId: schema.enrollments.classId,
          count: sql<number>`count(*)::int`,
        })
        .from(schema.enrollments)
        .where(
          and(
            sql`${schema.enrollments.classId} IN (${sql.join(classIds.map(id => sql`${id}`), sql`, `)})`,
            eq(schema.enrollments.isActive, true)
          )
        )
        .groupBy(schema.enrollments.classId);

      for (const row of counts) {
        studentCounts.set(row.classId, row.count);
      }
    }

    // Combine classes with student counts
    const classes = classesRaw.map(cls => ({
      ...cls,
      studentCount: studentCounts.get(cls.id) || 0,
    }));

    const totalCount = countResult[0]?.count || 0;
    const totalPages = Math.ceil(totalCount / limit);

    return successResponse(
      {
        classes,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
      'Classes retrieved successfully'
    );
  } catch (error) {
    console.error('Error fetching classes:', error);
    return errorResponse(
      'Failed to fetch classes',
      500,
      error instanceof Error ? error.message : 'An unexpected error occurred'
    );
  }
}

/**
 * Create a new class for the authenticated school
 * POST /api/school-admin/classes
 * 
 * Request Body:
 * {
 *   "classId": 5, (ID from classlist table - e.g., Class 9)
 *   "session": "2024-25",
 *   "section": "A"
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
    const validationResult = createClassSchema.safeParse(body);
    if (!validationResult.success) {
      return errorResponse(
        'Validation failed',
        400,
        validationResult.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      );
    }

    const { classId, session, section } = validationResult.data;

    // Verify the classId exists in classlist
    const classlistEntry = await db
      .select({
        id: schema.classlist.id,
        className: schema.classlist.className,
        classNumber: schema.classlist.classNumber,
        stream: schema.classlist.stream,
        code: schema.classlist.code,
      })
      .from(schema.classlist)
      .where(eq(schema.classlist.id, classId))
      .limit(1);

    if (classlistEntry.length === 0) {
      return errorResponse('Invalid class ID. Please select a valid class from the classlist.', 400);
    }

    // Check for duplicate: same school, session, class, section
    const existingClass = await db
      .select({ id: schema.classes.id })
      .from(schema.classes)
      .where(
        and(
          eq(schema.classes.schoolId, schoolId),
          eq(schema.classes.session, session.trim()),
          eq(schema.classes.classId, classId),
          eq(schema.classes.section, section.trim().toUpperCase())
        )
      )
      .limit(1);

    if (existingClass.length > 0) {
      return errorResponse(
        'Class already exists',
        409,
        `Class ${classlistEntry[0].className} Section ${section.toUpperCase()} for session ${session} already exists`
      );
    }

    // Create the class
    const newClass = await db
      .insert(schema.classes)
      .values({
        schoolId,
        classId,
        session: session.trim(),
        section: section.trim().toUpperCase(),
      })
      .returning();

    return successResponse(
      {
        class: {
          ...newClass[0],
          className: classlistEntry[0].className,
          classNumber: classlistEntry[0].classNumber,
          stream: classlistEntry[0].stream,
          classCode: classlistEntry[0].code,
          studentCount: 0,
        },
      },
      'Class created successfully',
      201
    );
  } catch (error) {
    console.error('Error creating class:', error);

    // Handle unique constraint violation
    if (error instanceof Error && error.message.includes('unique')) {
      return errorResponse('This class already exists for the selected session and section', 409);
    }

    return errorResponse(
      'Failed to create class',
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

