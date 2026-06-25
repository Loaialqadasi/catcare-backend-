export type UserRole = 'student' | 'volunteer' | 'manager' | 'admin';

/**
 * Role hierarchy (low → high privilege):
 *   student < volunteer < manager < admin
 *
 * Capabilities:
 *   - student:  browse cats, file emergencies, donate, apply to volunteer
 *   - volunteer: everything a student can do + record care history
 *   - manager:  everything a volunteer can do + review volunteer applications,
 *               manage cats (CRUD), update emergency status
 *   - admin:    full access incl. user management, role changes, password resets,
 *               donation review, account deletion
 */
export const ROLE_RANK: Record<UserRole, number> = {
  student: 0,
  volunteer: 1,
  manager: 2,
  admin: 3,
};

export function hasMinRole(userRole: UserRole | undefined, minRole: UserRole): boolean {
  if (!userRole) return false;
  return ROLE_RANK[userRole] >= ROLE_RANK[minRole];
}

export interface AuthUser {
  id: number;
  fullName: string;
  email: string;
  role: UserRole;
}

export interface JwtPayload extends AuthUser {}

export interface Pagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface CursorPagination {
  nextCursor: number | null;
  hasMore: boolean;
  pageSize: number;
}
