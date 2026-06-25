import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/env.js';
import { AuthenticationError } from '../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/errors.js';
import { AuthUser, JwtPayload } from '../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/types.js';

// make req.user available on every authenticated request
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// CRIT-1 Fix: Pull JWT from HttpOnly cookie FIRST, fall back to Authorization header
export const authMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  // Priority: cookie > Authorization header (for backward compatibility)
  let token: string | undefined;

  // 1. Check HttpOnly cookie
  if (req.cookies?.token) {
    token = req.cookies.token;
  }

  // 2. Fall back to Authorization header (supports API clients / Swagger / migration period)
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
  }

  if (!token) {
    return next(new AuthenticationError('Missing or invalid token'));
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = {
      id: payload.id,
      fullName: payload.fullName,
      email: payload.email,
      role: payload.role
    };
    next();
  } catch (error) {
    next(new AuthenticationError('Missing or invalid token'));
  }
};

/**
 * Optional auth middleware — sets req.user if a valid JWT is present,
 * but does NOT fail if the token is missing or invalid.
 *
 * Used by the CSRF token endpoint so that authenticated users get
 * a CSRF token bound to their user ID (matching the session identifier
 * used when CSRF is validated on subsequent authenticated requests).
 */
export const optionalAuthMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  let token: string | undefined;

  if (req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
  }

  if (!token) {
    // No token — proceed without setting req.user (anonymous session)
    return next();
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = {
      id: payload.id,
      fullName: payload.fullName,
      email: payload.email,
      role: payload.role
    };
  } catch {
    // Invalid/expired token — proceed without setting req.user
  }

  next();
};
