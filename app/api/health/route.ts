import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/utils/api-response';
import { checkDatabaseHealth } from '@/lib/db';

/**
 * Health check endpoint
 * GET /api/health
 */
export async function GET() {
  try {
    const dbHealth = await checkDatabaseHealth();

    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: dbHealth ? 'connected' : 'disconnected',
      uptime: process.uptime(),
    };

    if (!dbHealth) {
      return errorResponse('Database connection failed', 503, 'Service unavailable');
    }

    return successResponse(health, 'Service is healthy');
  } catch (error) {
    console.error('Health check error:', error);
    return errorResponse(
      'Health check failed',
      503,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

