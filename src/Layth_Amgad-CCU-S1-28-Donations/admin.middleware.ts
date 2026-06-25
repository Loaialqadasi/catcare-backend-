import { NextFunction, Request, Response } from 'express';
import { AuthorizationError } from '../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/errors.js';
import { hasMinRole, UserRole } from '../Mohamed_Abdelgawwad-CCU-S1-04-Foundation/types.js';

// ─── Role-based access control ──────────────────────────────────────────────
// Role hierarchy (low → high privilege):
//   student < volunteer < manager < admin
//
// Capabilities matrix:
//   ┌─────────────┬──────────┬────────────┬─────────┬───────┐
//   │ Capability  │ student  │ volunteer  │ manager │ admin │
//   ├─────────────┼──────────┼────────────┼─────────┼───────┤
//   │ browse cats │    ✓     │     ✓      │    ✓    │   ✓   │
//   │ report emer │    ✓     │     ✓      │    ✓    │   ✓   │
//   │ donate      │    ✓     │     ✓      │    ✓    │   ✓   │
//   │ care log    │    ✗     │     ✓      │    ✓    │   ✓   │
//   │ manage cats │    ✗     │     ✗      │    ✓    │   ✓   │
//   │ review vol  │    ✗     │     ✗      │    ✓    │   ✓   │
//   │ emergency ●│    ✗     │     ✗      │    ✓    │   ✓   │
//   │ review don  │    ✗     │     ✗      │    ✗    │   ✓   │
//   │ manage users│    ✗     │     ✗      │    ✗    │   ✓   │
//   │ reset pass  │    ✗     │     ✗      │    ✗    │   ✓   │
//   └─────────────┴──────────┴────────────┴─────────┴───────┘
//
// "emergency ●" = update emergency status (resolve, cancel, etc.)

/**
 * Generic RBAC guard — allows any role at-or-above the given minimum.
 *
 * Usage:
 *   requireRole('manager')   → manager + admin
 *   requireRole('admin')    → admin only
 */
export function requireRole(minRole: UserRole) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !hasMinRole(req.user.role, minRole)) {
      next(new AuthorizationError(`${minRole} access required`));
      return;
    }
    next();
  };
}

/**
 * Manager-or-admin middleware.
 *
 * Use for: managing cats (CRUD), updating emergency status, reviewing
 * volunteer applications, recording care history on behalf of others.
 */
export const managerMiddleware = requireRole('manager');

/**
 * Admin-only middleware.
 *
 * Use for: user management (create/delete/update users), role changes,
 * password resets, donation review (approve/reject).
 */
export const adminMiddleware = requireRole('admin');

/**
 * Alias kept for backwards compatibility with existing route definitions.
 * Equivalent to adminMiddleware.
 */
export const adminOnlyMiddleware = adminMiddleware;
