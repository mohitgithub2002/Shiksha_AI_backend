import { NextRequest } from 'next/server';
import { getDatabase, schema } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/utils/api-response';
import { handleOptions } from '@/lib/middleware/cors';
import { asc, desc, ilike, or, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

/**
 * Get all schools with optional filtering, pagination, and sorting
 * GET /api/admin/schools
 * 
 * Query Parameters:
 * - page: number (default: 1)
 * - limit: number (default: 10, max: 100)
 * - search: string (searches in name, code, city, state)
 * - sortBy: 'name' | 'code' | 'city' | 'createdAt' (default: 'createdAt')
 * - sortOrder: 'asc' | 'desc' (default: 'desc')
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const searchParams = request.nextUrl.searchParams;
    
    // Parse query parameters
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const search = searchParams.get('search')?.trim() || '';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    
    const offset = (page - 1) * limit;
    
    // Build the where clause for search
    const searchCondition = search
      ? or(
          ilike(schema.schools.name, `%${search}%`),
          ilike(schema.schools.code, `%${search}%`),
          ilike(schema.schools.city, `%${search}%`),
          ilike(schema.schools.state, `%${search}%`)
        )
      : undefined;
    
    // Determine sort column
    const sortColumn = {
      name: schema.schools.name,
      code: schema.schools.code,
      city: schema.schools.city,
      createdAt: schema.schools.createdAt,
    }[sortBy] || schema.schools.createdAt;
    
    // Execute queries in parallel for better performance
    const [schoolsRaw, countResult] = await Promise.all([
      db
        .select({
          id: schema.schools.id,
          name: schema.schools.name,
          code: schema.schools.code,
          address: schema.schools.address,
          city: schema.schools.city,
          state: schema.schools.state,
          pinCode: schema.schools.pinCode,
          ownerName: schema.schools.ownerName,
          contactEmail: schema.schools.contactEmail,
          contactPhone: schema.schools.contactPhone,
          passwordHash: schema.schools.passwordHash,
          createdAt: schema.schools.createdAt,
        })
        .from(schema.schools)
        .where(searchCondition)
        .orderBy(sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.schools)
        .where(searchCondition),
    ]);
    
    // Transform to include hasPassword flag instead of passwordHash
    const schools = schoolsRaw.map(({ passwordHash, ...school }) => ({
      ...school,
      hasPassword: !!passwordHash,
    }));
    
    const totalCount = countResult[0]?.count || 0;
    const totalPages = Math.ceil(totalCount / limit);
    
    return successResponse(
      {
        schools,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
      'Schools retrieved successfully'
    );
  } catch (error) {
    console.error('Error fetching schools:', error);
    return errorResponse(
      'Failed to fetch schools',
      500,
      error instanceof Error ? error.message : 'An unexpected error occurred'
    );
  }
}

/**
 * Create a new school
 * POST /api/admin/schools
 * 
 * Request Body:
 * {
 *   "name": "School Name" (required),
 *   "code": "UNIQUE_CODE" (required),
 *   "contactPhone": "1234567890" (required),
 *   "address": "Full address",
 *   "city": "City Name",
 *   "state": "State Name",
 *   "pinCode": "123456",
 *   "ownerName": "Owner Name",
 *   "contactEmail": "email@example.com",
 *   "password": "optional password for school owner login"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const body = await request.json();
    
    // Validate required fields
    const { name, code, address, city, state, pinCode, ownerName, contactEmail, contactPhone, password } = body;
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return errorResponse('School name is required', 400);
    }
    
    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return errorResponse('School code is required', 400);
    }
    
    // contactPhone is now required
    if (!contactPhone || typeof contactPhone !== 'string' || contactPhone.trim().length === 0) {
      return errorResponse('Contact phone number is required', 400);
    }
    
    // Validate code format (alphanumeric with hyphens/underscores, max 50 chars)
    const codeRegex = /^[A-Za-z0-9_-]+$/;
    if (!codeRegex.test(code.trim())) {
      return errorResponse('School code must contain only alphanumeric characters, hyphens, and underscores', 400);
    }
    
    if (code.trim().length > 50) {
      return errorResponse('School code must be 50 characters or less', 400);
    }
    
    // Validate email format if provided
    if (contactEmail && typeof contactEmail === 'string' && contactEmail.trim().length > 0) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(contactEmail.trim())) {
        return errorResponse('Invalid email format', 400);
      }
    }
    
    // Validate phone format
    const phoneRegex = /^[0-9+\-\s()]+$/;
    if (!phoneRegex.test(contactPhone.trim())) {
      return errorResponse('Invalid phone format', 400);
    }
    
    // Validate pin code if provided
    if (pinCode && typeof pinCode === 'string' && pinCode.trim().length > 0) {
      const pinCodeRegex = /^[0-9]{5,10}$/;
      if (!pinCodeRegex.test(pinCode.trim())) {
        return errorResponse('Invalid pin code format (should be 5-10 digits)', 400);
      }
    }
    
    // Validate password if provided (min 6 characters)
    if (password && typeof password === 'string' && password.length > 0) {
      if (password.length < 6) {
        return errorResponse('Password must be at least 6 characters', 400);
      }
    }
    
    // Check if school code already exists (case-insensitive)
    const existingSchool = await db
      .select({ id: schema.schools.id })
      .from(schema.schools)
      .where(ilike(schema.schools.code, code.trim()))
      .limit(1);
    
    if (existingSchool.length > 0) {
      return errorResponse('School code already exists. Please use a unique code.', 409);
    }
    
    // Check for duplicate school with same name in same city (data redundancy check)
    if (city && typeof city === 'string' && city.trim().length > 0) {
      const duplicateSchool = await db
        .select({ id: schema.schools.id })
        .from(schema.schools)
        .where(
          sql`LOWER(${schema.schools.name}) = LOWER(${name.trim()}) AND LOWER(${schema.schools.city}) = LOWER(${city.trim()})`
        )
        .limit(1);
      
      if (duplicateSchool.length > 0) {
        return errorResponse('A school with this name already exists in this city', 409);
      }
    }
    
    // Hash password if provided
    let passwordHash: string | null = null;
    if (password && typeof password === 'string' && password.length >= 6) {
      passwordHash = await bcrypt.hash(password, 10);
    }
    
    // Create the school
    const newSchoolRaw = await db
      .insert(schema.schools)
      .values({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        address: address?.trim() || null,
        city: city?.trim() || null,
        state: state?.trim() || null,
        pinCode: pinCode?.trim() || null,
        ownerName: ownerName?.trim() || null,
        contactEmail: contactEmail?.trim().toLowerCase() || null,
        contactPhone: contactPhone.trim(),
        passwordHash,
      })
      .returning();
    
    // Don't return passwordHash, return hasPassword flag instead
    const { passwordHash: _, ...schoolData } = newSchoolRaw[0];
    const newSchool = {
      ...schoolData,
      hasPassword: !!passwordHash,
    };
    
    return successResponse(
      { school: newSchool },
      'School created successfully',
      201
    );
  } catch (error) {
    console.error('Error creating school:', error);
    
    // Handle unique constraint violation
    if (error instanceof Error && error.message.includes('unique')) {
      return errorResponse('School code already exists', 409);
    }
    
    return errorResponse(
      'Failed to create school',
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

