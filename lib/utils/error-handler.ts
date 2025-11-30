import { NextResponse } from 'next/server';
import { errorResponse, serverErrorResponse } from './api-response';

/**
 * Handle API route errors
 */
export function handleApiError(error: unknown): NextResponse {
  console.error('API Error:', error);

  if (error instanceof Error) {
    // Handle known error types
    if (error.message.includes('not found') || error.message.includes('Not Found')) {
      return errorResponse(error.message, 404);
    }

    if (error.message.includes('unauthorized') || error.message.includes('Unauthorized')) {
      return errorResponse(error.message, 401);
    }

    if (error.message.includes('validation') || error.message.includes('Validation')) {
      return errorResponse(error.message, 400);
    }

    // Generic error
    return errorResponse(error.message, 500);
  }

  // Unknown error
  return serverErrorResponse('An unexpected error occurred');
}

/**
 * Async API route handler wrapper
 */
export function withErrorHandler<T extends unknown[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleApiError(error);
    }
  };
}

