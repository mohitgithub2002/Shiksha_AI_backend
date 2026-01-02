import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDatabase, schema } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/utils/api-response';
import { handleOptions } from '@/lib/middleware/cors';
import { authenticateSchoolAdmin } from '@/lib/middleware/school-admin-auth';
import { hashPassword } from '@/lib/utils/password';
import { z } from 'zod';

// Validation schema for creating a user
const createUserSchema = z.object({
  phone: z.string().min(10, 'Phone number must be at least 10 digits').max(20),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

/**
 * Create a new user (for student registration flow)
 * POST /api/school-admin/users
 * 
 * This is step 2 in student registration:
 * 1. Check phone (done in previous step)
 * 2. Create user with phone and password <-- This step
 * 3. Create student profile
 * 4. Enroll in class
 * 
 * Request Body:
 * {
 *   "phone": "1234567890",
 *   "password": "securePassword123"
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

  try {
    const db = await getDatabase();
    const body = await request.json();

    // Validate request body
    const validationResult = createUserSchema.safeParse(body);
    if (!validationResult.success) {
      return errorResponse(
        'Validation failed',
        400,
        validationResult.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      );
    }

    const { phone, password } = validationResult.data;

    // Normalize phone number
    const normalizedPhone = phone.replace(/[\s\-\(\)]/g, '');

    // Check if user already exists
    const existingUser = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.phone, normalizedPhone))
      .limit(1);

    if (existingUser.length > 0) {
      return errorResponse(
        'User already exists',
        409,
        'A user with this phone number already exists. Use the existing user ID to create a student profile.'
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const newUser = await db
      .insert(schema.users)
      .values({
        phone: normalizedPhone,
        passwordHash,
      })
      .returning({
        id: schema.users.id,
        phone: schema.users.phone,
        createdAt: schema.users.createdAt,
      });

    return successResponse(
      {
        user: newUser[0],
        nextStep: 'CREATE_STUDENT',
        message: 'User created successfully. Now create the student profile.',
      },
      'User created successfully',
      201
    );
  } catch (error) {
    console.error('Error creating user:', error);

    // Handle unique constraint violation
    if (error instanceof Error && error.message.includes('unique')) {
      return errorResponse(
        'Phone number already registered',
        409,
        'A user with this phone number already exists'
      );
    }

    return errorResponse(
      'Failed to create user',
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

