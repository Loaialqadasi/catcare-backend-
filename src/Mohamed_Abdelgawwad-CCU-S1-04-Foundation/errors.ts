export type ErrorDetails = Record<string, unknown>;

// base error so we always have a status code + error code in responses
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details: ErrorDetails;

  constructor(message: string, code: string, statusCode: number, details: ErrorDetails = {}) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.name = this.constructor.name;
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details: ErrorDetails = {}) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required', details: ErrorDetails = {}) {
    super(message, 'AUTHENTICATION_ERROR', 401, details);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Not authorized', details: ErrorDetails = {}) {
    super(message, 'AUTHORIZATION_ERROR', 403, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details: ErrorDetails = {}) {
    super(message, 'NOT_FOUND', 404, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', details: ErrorDetails = {}) {
    super(message, 'CONFLICT', 409, details);
  }
}

export class DatabaseError extends AppError {
  constructor(message = 'Database error', details: ErrorDetails = {}) {
    super(message, 'DATABASE_ERROR', 500, details);
  }
}
