import { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import { logger } from './logger.js';
import { AppError, ValidationError } from './errors.js';

// catch-all error handler — everything lands here eventually
export const errorHandler = (error: unknown, _req: Request, res: Response, next: NextFunction): void => {
  if (res.headersSent) {
    return next(error);
  }

  let appError: AppError;

  if (error instanceof MulterError) {
    // multer has its own error codes, translate them to something the user understands
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? 'File too large. Maximum size is 5MB.'
      : 'Invalid file upload.';
    appError = new ValidationError(message, { field: error.field, code: error.code });
  } else if (error instanceof AppError) {
    // if it's one of ours, use it directly
    appError = error;
  } else if (error && typeof error === 'object' && 'code' in error) {
    // Handle csrf-csrf library errors — it throws with code 'EBADCSRFTOKEN' or similar
    const csrfError = error as { code?: string; message?: string };
    if (csrfError.code === 'EBADCSRFTOKEN' || csrfError.code === 'CSRF_INVALID' ||
        String(csrfError.message || '').toLowerCase().includes('csrf')) {
      // Return 403 with CSRF_INVALID code so the frontend retry logic works
      appError = new AppError(
        'Invalid or missing CSRF token. Please refresh the page and try again.',
        'CSRF_INVALID',
        403,
        { code: 'CSRF_INVALID' }
      );
    } else {
      appError = new AppError('Internal server error', 'INTERNAL_SERVER_ERROR', 500);
    }
  } else {
    // if it's one of ours, use it; otherwise wrap it in a generic 500
    appError = new AppError('Internal server error', 'INTERNAL_SERVER_ERROR', 500);
  }

  // log server errors for debugging
  if (appError.statusCode >= 500) {
    logger.error({ err: error }, 'Unhandled error');
  }

  res.status(appError.statusCode).json({
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
      details: appError.details
    }
  });
};
