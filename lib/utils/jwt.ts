import jwt, { SignOptions } from 'jsonwebtoken';

const JWT_SECRET: string = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Role types supported by the system
 */
export type UserRole = 'student' | 'teacher' | 'admin';

/**
 * Base JWT Payload interface with common fields for all roles
 * Role-specific fields are optional to support different user types
 */
export interface JWTPayload {
  // Common fields for all roles
  schoolId: number;
  role: UserRole;
  
  // Student-specific fields (optional)
  studentId?: number;
  enrollmentId?: number;
  userId?: number;

  // Teacher-specific fields (optional)
  teacherId?: number;
  
}

/**
 * Generate JWT token with user information
 * Supports student, teacher, and admin roles
 * 
 * @param payload - JWT payload containing user and role-specific information
 * @returns JWT token string
 * 
 * @example
 * // Student token
 * generateToken({ userId: 1, schoolId: 1, role: 'student', studentId: 1, enrollmentId: 1 })
 * 
 * @example
 * // Teacher token
 * generateToken({ schoolId: 1, role: 'teacher', teacherId: 1 })
 * 
 * @example
 * // Admin token
 * generateToken({ schoolId: 1, role: 'admin' })
 */
export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as SignOptions);
}

/**
 * Verify and decode JWT token
 */
export function verifyToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired');
    }
    throw new Error('Token verification failed');
  }
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

