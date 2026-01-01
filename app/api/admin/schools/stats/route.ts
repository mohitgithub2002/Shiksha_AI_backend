import { NextRequest } from 'next/server';
import { getDatabase, schema } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/utils/api-response';
import { handleOptions } from '@/lib/middleware/cors';
import { sql, gte } from 'drizzle-orm';

/**
 * Get school statistics
 * GET /api/admin/schools/stats
 * 
 * Returns aggregated statistics about schools
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    
    // Get current date for time-based calculations
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Execute all queries in parallel for better performance
    const [
      totalSchools,
      recentSchools,
      lastWeekSchools,
      schoolsByState,
      schoolsByCity,
    ] = await Promise.all([
      // Total schools count
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.schools),
      
      // Schools created in last 30 days
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.schools)
        .where(gte(schema.schools.createdAt, thirtyDaysAgo)),
      
      // Schools created in last 7 days
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.schools)
        .where(gte(schema.schools.createdAt, sevenDaysAgo)),
      
      // Schools grouped by state (top 10)
      db
        .select({
          state: schema.schools.state,
          count: sql<number>`count(*)::int`,
        })
        .from(schema.schools)
        .where(sql`${schema.schools.state} IS NOT NULL AND ${schema.schools.state} != ''`)
        .groupBy(schema.schools.state)
        .orderBy(sql`count(*) DESC`)
        .limit(10),
      
      // Schools grouped by city (top 10)
      db
        .select({
          city: schema.schools.city,
          count: sql<number>`count(*)::int`,
        })
        .from(schema.schools)
        .where(sql`${schema.schools.city} IS NOT NULL AND ${schema.schools.city} != ''`)
        .groupBy(schema.schools.city)
        .orderBy(sql`count(*) DESC`)
        .limit(10),
    ]);
    
    return successResponse(
      {
        totalSchools: totalSchools[0]?.count || 0,
        recentSchools: {
          last30Days: recentSchools[0]?.count || 0,
          last7Days: lastWeekSchools[0]?.count || 0,
        },
        byState: schoolsByState,
        byCity: schoolsByCity,
      },
      'School statistics retrieved successfully'
    );
  } catch (error) {
    console.error('Error fetching school statistics:', error);
    return errorResponse(
      'Failed to fetch school statistics',
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

