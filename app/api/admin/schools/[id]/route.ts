import { NextRequest } from 'next/server';
import { getDatabase, schema } from '@/lib/db';
import { successResponse, errorResponse, notFoundResponse } from '@/lib/utils/api-response';
import { handleOptions } from '@/lib/middleware/cors';
import { eq, ilike, sql, and, ne } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Get a single school by ID
 * GET /api/admin/schools/:id
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const schoolId = parseInt(id, 10);
    
    if (isNaN(schoolId) || schoolId <= 0) {
      return errorResponse('Invalid school ID', 400);
    }
    
    const db = await getDatabase();
    
    const schoolsRaw = await db
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
      .where(eq(schema.schools.id, schoolId))
      .limit(1);
    
    if (schoolsRaw.length === 0) {
      return notFoundResponse('School not found');
    }
    
    // Don't return passwordHash, return hasPassword flag instead
    const { passwordHash, ...schoolData } = schoolsRaw[0];
    const school = {
      ...schoolData,
      hasPassword: !!passwordHash,
    };
    
    return successResponse(
      { school },
      'School retrieved successfully'
    );
  } catch (error) {
    console.error('Error fetching school:', error);
    return errorResponse(
      'Failed to fetch school',
      500,
      error instanceof Error ? error.message : 'An unexpected error occurred'
    );
  }
}

/**
 * Update a school by ID
 * PUT /api/admin/schools/:id
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const schoolId = parseInt(id, 10);
    
    if (isNaN(schoolId) || schoolId <= 0) {
      return errorResponse('Invalid school ID', 400);
    }
    
    const db = await getDatabase();
    const body = await request.json();
    
    // Check if school exists
    const existingSchool = await db
      .select({ id: schema.schools.id })
      .from(schema.schools)
      .where(eq(schema.schools.id, schoolId))
      .limit(1);
    
    if (existingSchool.length === 0) {
      return notFoundResponse('School not found');
    }
    
    const { name, code, address, city, state, pinCode, ownerName, contactEmail, contactPhone, password } = body;
    
    // Validate name if provided
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return errorResponse('School name cannot be empty', 400);
      }
    }
    
    // Validate code if provided
    if (code !== undefined) {
      if (typeof code !== 'string' || code.trim().length === 0) {
        return errorResponse('School code cannot be empty', 400);
      }
      
      const codeRegex = /^[A-Za-z0-9_-]+$/;
      if (!codeRegex.test(code.trim())) {
        return errorResponse('School code must contain only alphanumeric characters, hyphens, and underscores', 400);
      }
      
      if (code.trim().length > 50) {
        return errorResponse('School code must be 50 characters or less', 400);
      }
      
      // Check if new code conflicts with another school
      const codeConflict = await db
        .select({ id: schema.schools.id })
        .from(schema.schools)
        .where(
          and(
            ilike(schema.schools.code, code.trim()),
            ne(schema.schools.id, schoolId)
          )
        )
        .limit(1);
      
      if (codeConflict.length > 0) {
        return errorResponse('School code already exists. Please use a unique code.', 409);
      }
    }
    
    // Validate email format if provided
    if (contactEmail !== undefined && contactEmail !== null && contactEmail !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(contactEmail.trim())) {
        return errorResponse('Invalid email format', 400);
      }
    }
    
    // Validate phone format if provided - contactPhone cannot be empty (required field)
    if (contactPhone !== undefined) {
      if (!contactPhone || typeof contactPhone !== 'string' || contactPhone.trim().length === 0) {
        return errorResponse('Contact phone number cannot be empty', 400);
      }
      const phoneRegex = /^[0-9+\-\s()]+$/;
      if (!phoneRegex.test(contactPhone.trim())) {
        return errorResponse('Invalid phone format', 400);
      }
    }
    
    // Validate pin code if provided
    if (pinCode !== undefined && pinCode !== null && pinCode !== '') {
      const pinCodeRegex = /^[0-9]{5,10}$/;
      if (!pinCodeRegex.test(pinCode.trim())) {
        return errorResponse('Invalid pin code format (should be 5-10 digits)', 400);
      }
    }
    
    // Validate password if provided
    if (password !== undefined && password !== null && password !== '') {
      if (typeof password !== 'string' || password.length < 6) {
        return errorResponse('Password must be at least 6 characters', 400);
      }
    }
    
    // Check for duplicate school with same name in same city (excluding current school)
    const newName = name?.trim() || undefined;
    const newCity = city?.trim() || undefined;
    
    if (newName && newCity) {
      const duplicateSchool = await db
        .select({ id: schema.schools.id })
        .from(schema.schools)
        .where(
          sql`LOWER(${schema.schools.name}) = LOWER(${newName}) AND LOWER(${schema.schools.city}) = LOWER(${newCity}) AND ${schema.schools.id} != ${schoolId}`
        )
        .limit(1);
      
      if (duplicateSchool.length > 0) {
        return errorResponse('A school with this name already exists in this city', 409);
      }
    }
    
    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};
    
    if (name !== undefined) updateData.name = name.trim();
    if (code !== undefined) updateData.code = code.trim().toUpperCase();
    if (address !== undefined) updateData.address = address?.trim() || null;
    if (city !== undefined) updateData.city = city?.trim() || null;
    if (state !== undefined) updateData.state = state?.trim() || null;
    if (pinCode !== undefined) updateData.pinCode = pinCode?.trim() || null;
    if (ownerName !== undefined) updateData.ownerName = ownerName?.trim() || null;
    if (contactEmail !== undefined) updateData.contactEmail = contactEmail?.trim().toLowerCase() || null;
    if (contactPhone !== undefined) updateData.contactPhone = contactPhone.trim();
    
    // Hash and update password if provided
    if (password !== undefined && password !== null && password !== '') {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }
    
    if (Object.keys(updateData).length === 0) {
      return errorResponse('No fields to update', 400);
    }
    
    // Update the school
    const updatedSchoolRaw = await db
      .update(schema.schools)
      .set(updateData)
      .where(eq(schema.schools.id, schoolId))
      .returning();
    
    // Don't return passwordHash, return hasPassword flag instead
    const { passwordHash, ...schoolData } = updatedSchoolRaw[0];
    const updatedSchool = {
      ...schoolData,
      hasPassword: !!passwordHash,
    };
    
    return successResponse(
      { school: updatedSchool },
      'School updated successfully'
    );
  } catch (error) {
    console.error('Error updating school:', error);
    
    if (error instanceof Error && error.message.includes('unique')) {
      return errorResponse('School code already exists', 409);
    }
    
    return errorResponse(
      'Failed to update school',
      500,
      error instanceof Error ? error.message : 'An unexpected error occurred'
    );
  }
}

/**
 * Delete a school by ID
 * DELETE /api/admin/schools/:id
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const schoolId = parseInt(id, 10);
    
    if (isNaN(schoolId) || schoolId <= 0) {
      return errorResponse('Invalid school ID', 400);
    }
    
    const db = await getDatabase();
    
    // Check if school exists
    const existingSchool = await db
      .select({ 
        id: schema.schools.id,
        name: schema.schools.name,
        code: schema.schools.code 
      })
      .from(schema.schools)
      .where(eq(schema.schools.id, schoolId))
      .limit(1);
    
    if (existingSchool.length === 0) {
      return notFoundResponse('School not found');
    }
    
    // Check for related data (students, teachers, classes)
    const [studentCount, teacherCount, classCount] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.students)
        .where(eq(schema.students.schoolId, schoolId)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.teachers)
        .where(eq(schema.teachers.schoolId, schoolId)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.classes)
        .where(eq(schema.classes.schoolId, schoolId)),
    ]);
    
    const totalRelatedRecords = 
      (studentCount[0]?.count || 0) + 
      (teacherCount[0]?.count || 0) + 
      (classCount[0]?.count || 0);
    
    if (totalRelatedRecords > 0) {
      return errorResponse(
        `Cannot delete school. It has ${studentCount[0]?.count || 0} students, ${teacherCount[0]?.count || 0} teachers, and ${classCount[0]?.count || 0} classes associated with it. Please remove all associated data first.`,
        409
      );
    }
    
    // Delete the school
    await db
      .delete(schema.schools)
      .where(eq(schema.schools.id, schoolId));
    
    return successResponse(
      { deleted: existingSchool[0] },
      'School deleted successfully'
    );
  } catch (error) {
    console.error('Error deleting school:', error);
    return errorResponse(
      'Failed to delete school',
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

