import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/utils/api-response';
import { handleOptions } from '@/lib/middleware/cors';
import { authenticateSchoolAdmin } from '@/lib/middleware/school-admin-auth';

/**
 * Verify School Admin Token API
 * GET /api/school-admin/auth/verify
 * 
 * Verifies if the current token is valid and returns school info
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

  const { schoolId, schoolCode, schoolName } = authResult.context;

  return successResponse(
    {
      valid: true,
      school: {
        id: schoolId,
        code: schoolCode,
        name: schoolName,
      },
    },
    'Token is valid'
  );
}

/**
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
  return handleOptions();
}

